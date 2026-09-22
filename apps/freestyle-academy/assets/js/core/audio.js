/* =========================================================================
   audio.js — mic metering, per-turn recording and the beat player.

   Web counterparts of audio/MicrophoneLevelRecorder.kt, audio/SessionRecorder.kt
   and audio/MusicPlayerManager.kt.

   Honest by design, like the app: when the mic is unavailable or permission is
   denied the level stays at 0 and the timer ring stays flat — never faked.
   ========================================================================= */

import { BEAT_FILES, BEATS_BASE } from './config.js';

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME_CANDIDATES.find((t) => {
    try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
  }) || null;
}

/* =========================================================================
   Microphone: level metering + per-turn segment recording
   ========================================================================= */

export class MicSession {
  constructor() {
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.buffer = null;
    this.recorder = null;
    this.chunks = [];
    /** 'unknown' | 'granted' | 'denied' | 'unsupported' */
    this.permission = 'unknown';
    this.mimeType = pickMimeType();
    /** Real mic-on seconds, excluding pauses — what XpMultipliers reads. */
    this.recordedSeconds = 0;
    this._recordStartedAt = null;
  }

  get isSupported() {
    return Boolean(navigator.mediaDevices?.getUserMedia);
  }

  get canRecord() {
    return Boolean(this.mimeType) && this.isSupported;
  }

  /**
   * Requests mic access and starts the analyser.
   *
   * echoCancellation stays ON: the beat plays through the speakers during a
   * turn, and without it that bleed lands in the recording and wrecks the
   * transcription. On headphones it costs nothing.
   */
  async start() {
    if (!this.isSupported) { this.permission = 'unsupported'; return false; }
    if (this.stream) return true;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      this.permission = 'granted';
    } catch (err) {
      this.permission = err?.name === 'NotAllowedError' ? 'denied' : 'unsupported';
      return false;
    }

    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.source = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.7;
      this.source.connect(this.analyser);
      this.buffer = new Uint8Array(this.analyser.fftSize);
    } catch (err) {
      console.warn('[audio] analyser unavailable', err);
      this.analyser = null;
    }
    return true;
  }

  /** Normalized 0..1 RMS level, or 0 when not actually metering. */
  level() {
    if (!this.analyser || !this.buffer) return 0;
    this.analyser.getByteTimeDomainData(this.buffer);
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i += 1) {
      const v = (this.buffer[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this.buffer.length) * 3.2);
  }

  startSegment() {
    if (!this.stream || !this.canRecord || this.recorder) return false;
    try {
      this.chunks = [];
      this.recorder = new MediaRecorder(this.stream, { mimeType: this.mimeType });
      this.recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) this.chunks.push(e.data);
      };
      this.recorder.start(1000);
      this._recordStartedAt = Date.now();
      return true;
    } catch (err) {
      console.warn('[audio] recorder failed to start', err);
      this.recorder = null;
      return false;
    }
  }

  /** Stops the segment and resolves with its Blob (or null). */
  stopSegment() {
    return new Promise((resolve) => {
      const rec = this.recorder;
      if (!rec || rec.state === 'inactive') { this.recorder = null; resolve(null); return; }
      this._accrue();
      rec.onstop = () => {
        const blob = this.chunks.length ? new Blob(this.chunks, { type: this.mimeType }) : null;
        this.chunks = [];
        this.recorder = null;
        resolve(blob);
      };
      try { rec.stop(); } catch { this.recorder = null; resolve(null); }
    });
  }

  _accrue() {
    if (this._recordStartedAt != null) {
      this.recordedSeconds += Math.round((Date.now() - this._recordStartedAt) / 1000);
      this._recordStartedAt = null;
    }
  }

  get isRecording() { return this.recorder?.state === 'recording'; }

  pause() {
    try {
      if (this.isRecording) { this._accrue(); this.recorder.pause(); }
    } catch { /* unsupported */ }
  }

  resume() {
    try {
      if (this.recorder?.state === 'paused') {
        this.recorder.resume();
        this._recordStartedAt = Date.now();
      }
    } catch { /* unsupported */ }
  }

  async stop() {
    await this.stopSegment();
    try { this.source?.disconnect(); } catch { /* ignore */ }
    try { await this.ctx?.close(); } catch { /* ignore */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null; this.ctx = null; this.analyser = null;
    this.source = null; this.buffer = null;
  }
}

/** Blob → base64 with no data: prefix, for the callable payload. */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/* =========================================================================
   Beat player — MusicPlayerManager's playlist rules

   Empty selection shuffles ("Aleatorio"), one track loops, several play in
   order and loop as a unit.
   ========================================================================= */

/** A friendly track name from a beat file name. */
export function beatDisplayName(fileName) {
  return String(fileName)
    .replace(/\.[^.]+$/, '')
    .replace(/^\(?\s*free\s*\)?_?/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Beat';
}

export const availableBeats = () => BEAT_FILES.slice();

export class BeatPlayer {
  constructor() {
    this.audio = null;
    this.playlist = [];
    this.index = 0;
    this.muted = false;
    this.onChange = null;
  }

  get available() { return BEAT_FILES.length > 0; }
  get currentFile() { return this.playlist[this.index] ?? null; }
  get currentName() {
    return this.currentFile ? beatDisplayName(this.currentFile) : 'Sin beat';
  }
  get isPlaying() { return Boolean(this.audio) && !this.audio.paused; }

  /** Empty = shuffle everything; one = loop it; several = play in order. */
  setPlaylist(files) {
    const chosen = (files && files.length) ? files.slice() : shuffle(BEAT_FILES);
    this.playlist = chosen.filter((f) => BEAT_FILES.includes(f));
    this.index = 0;
    return this;
  }

  _ensure() {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.addEventListener('ended', () => this.next());
      this.audio.addEventListener('error', () => this.next());
    }
    return this.audio;
  }

  async play() {
    if (!this.available || this.playlist.length === 0) return false;
    const el = this._ensure();
    const src = BEATS_BASE + this.currentFile;
    if (!el.src.endsWith(encodeURI(this.currentFile))) {
      el.src = src;
      el.loop = this.playlist.length === 1;
    }
    el.muted = this.muted;
    try {
      await el.play();
      this.onChange?.();
      return true;
    } catch {
      // Autoplay refused until a user gesture; the caller retries on tap.
      return false;
    }
  }

  pause() { this.audio?.pause(); this.onChange?.(); }

  toggle() { return this.isPlaying ? (this.pause(), false) : (this.play(), true); }

  next() {
    if (this.playlist.length === 0) return;
    this.index = (this.index + 1) % this.playlist.length;
    if (this.audio) {
      this.audio.src = BEATS_BASE + this.currentFile;
      this.audio.loop = this.playlist.length === 1;
      this.audio.play().catch(() => {});
    }
    this.onChange?.();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.audio) this.audio.muted = muted;
    this.onChange?.();
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio = null;
    }
  }
}

function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
