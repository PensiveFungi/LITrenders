/* =========================================================================
   audio.js — microphone level metering + per-round recording
   Web counterpart of audio/MicrophoneLevelRecorder.kt and ui/components/Microphone.kt

   Honest by design, like the Android original: when the mic is unavailable or
   permission is denied, the amplitude stays at 0 rather than faking a signal.
   ========================================================================= */

const RECORDER_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return RECORDER_MIME_CANDIDATES.find((t) => {
    try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
  }) || null;
}

export class MicrophoneSession {
  constructor() {
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.buffer = null;
    this.recorder = null;
    this.chunks = [];
    this.permission = 'unknown'; // 'unknown' | 'granted' | 'denied' | 'unsupported'
    this.mimeType = pickMimeType();
  }

  get isSupported() {
    return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  get canRecord() {
    return Boolean(this.mimeType) && this.isSupported;
  }

  /**
   * Requests mic access and sets up the analyser.
   * Returns true when live metering is running.
   *
   * echoCancellation/noiseSuppression are left ON: with no backing beat played
   * by the page there is nothing to bleed into the mic, and they measurably
   * improve transcription quality on laptop mics. If beat playback is added
   * later, revisit this — see README, "Known limitations".
   */
  async start() {
    if (!this.isSupported) {
      this.permission = 'unsupported';
      return false;
    }
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
      this.permission = err && err.name === 'NotAllowedError' ? 'denied' : 'unsupported';
      return false;
    }

    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new Ctx();
      if (this.audioContext.state === 'suspended') await this.audioContext.resume();
      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.72;
      this.source.connect(this.analyser);
      this.buffer = new Uint8Array(this.analyser.fftSize);
    } catch (err) {
      console.warn('[audio] analyser unavailable', err);
      this.analyser = null;
    }
    return true;
  }

  /** Normalized 0..1 input level (RMS), or 0 when not actively metering. */
  sampleAmplitude() {
    if (!this.analyser || !this.buffer) return 0;
    this.analyser.getByteTimeDomainData(this.buffer);
    let sumSquares = 0;
    for (let i = 0; i < this.buffer.length; i += 1) {
      const v = (this.buffer[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / this.buffer.length);
    // Gentle curve so ordinary speech fills a useful part of the meter.
    return Math.min(1, rms * 3.2);
  }

  startRecording() {
    if (!this.stream || !this.canRecord || this.recorder) return false;
    try {
      this.chunks = [];
      this.recorder = new MediaRecorder(this.stream, { mimeType: this.mimeType });
      this.recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.chunks.push(e.data);
      };
      this.recorder.start(1000);
      return true;
    } catch (err) {
      console.warn('[audio] MediaRecorder failed to start', err);
      this.recorder = null;
      return false;
    }
  }

  /** Stops recording and resolves with the captured Blob (or null). */
  stopRecording() {
    return new Promise((resolve) => {
      const rec = this.recorder;
      if (!rec || rec.state === 'inactive') {
        this.recorder = null;
        resolve(null);
        return;
      }
      rec.onstop = () => {
        const blob = this.chunks.length > 0
          ? new Blob(this.chunks, { type: this.mimeType })
          : null;
        this.chunks = [];
        this.recorder = null;
        resolve(blob);
      };
      try { rec.stop(); } catch { this.recorder = null; resolve(null); }
    });
  }

  get isRecording() {
    return Boolean(this.recorder && this.recorder.state === 'recording');
  }

  pauseRecording() {
    try { if (this.isRecording) this.recorder.pause(); } catch { /* unsupported */ }
  }

  resumeRecording() {
    try {
      if (this.recorder && this.recorder.state === 'paused') this.recorder.resume();
    } catch { /* unsupported */ }
  }

  async stop() {
    await this.stopRecording();
    try { this.source?.disconnect(); } catch { /* ignore */ }
    try { await this.audioContext?.close(); } catch { /* ignore */ }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.buffer = null;
  }
}

/** Blob → base64 (no data: prefix), for the JSON call to the Cloud Function. */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
