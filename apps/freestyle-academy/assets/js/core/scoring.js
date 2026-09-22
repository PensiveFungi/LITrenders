/* =========================================================================
   scoring.js — the post-session AI evaluation.

   Port of the AiScoringClient / AppViewModel.evaluatePendingSession path.

   This is the ONLY source of XP. It runs from the captured turn audio the
   moment the session ends, calls the app's existing `scoreFreestyle`
   callable once per segment, parses the model output and applies the award
   through the same gate every XP-showing screen reads.

   Every failure mode is honest: the session simply earns no XP. There is no
   fallback award.
   ========================================================================= */

import { store } from './store.js';
import { scoreFreestyle, backendAvailable } from './firebase.js';
import { blobToBase64 } from './audio.js';
import {
  parseAssessment, sessionXp, stimulusXp, weightedAverage, computeXp, ScoringState,
} from './ai.js';

/** Live evaluation state, watched by the results screen. */
export const scoring = {
  state: ScoringState.IDLE,
  /** Why it is unavailable, when it is: 'guest' | 'plan' | 'offline' | 'no-audio' | 'failed' */
  reason: null,
  assessments: [],
  transcripts: [],
  breakdown: null,
  totalXp: 0,
  stimulusBonus: 0,
  flow: 0,
  rhyme: 0,
  _listeners: new Set(),

  on(fn) { this._listeners.add(fn); fn(this); return () => this._listeners.delete(fn); },
  _emit() { this._listeners.forEach((fn) => { try { fn(this); } catch (e) { console.error(e); } }); },

  reset() {
    this.state = ScoringState.IDLE;
    this.reason = null;
    this.assessments = [];
    this.transcripts = [];
    this.breakdown = null;
    this.totalXp = 0;
    this.stimulusBonus = 0;
    this.flow = 0;
    this.rhyme = 0;
    this._emit();
  },

  _unavailable(reason) {
    this.state = ScoringState.UNAVAILABLE;
    this.reason = reason;
    this._emit();
  },
};

/**
 * Evaluates a finished session.
 *
 * @param {Array}  segments  [{ blob, roundLabel, durationSeconds, stimuli }]
 * @param {number} opts.recordedSeconds real mic-on seconds (pauses excluded)
 * @param {boolean} opts.isBattle
 * @param {number} opts.streakDays
 */
export async function runScoring(segments, { recordedSeconds, isBattle, streakDays }) {
  scoring.reset();

  // The same two halves the write path enforces, checked before anything is
  // uploaded so we never ask the server for an award we would refuse.
  if (!store.isAccount) { scoring._unavailable('guest'); return; }
  if (!store.accruesXp) { scoring._unavailable('plan'); return; }
  if (!backendAvailable()) { scoring._unavailable('offline'); return; }
  if (!segments || segments.length === 0) { scoring._unavailable('no-audio'); return; }
  if (!navigator.onLine) { scoring._unavailable('offline'); return; }

  scoring.state = ScoringState.RUNNING;
  scoring._emit();

  const assessments = [];
  const transcripts = [];
  const durations = [];

  try {
    for (const segment of segments) {
      // Sequential on purpose: two Groq round-trips per segment, and the
      // callable caps concurrency at 10 instances for the whole project.
      // eslint-disable-next-line no-await-in-loop
      const audioBase64 = await blobToBase64(segment.blob);
      // eslint-disable-next-line no-await-in-loop
      const res = await scoreFreestyle({
        audioBase64,
        mimeType: segment.blob.type,
        roundLabel: segment.roundLabel,
        durationSeconds: segment.durationSeconds,
        stimuli: segment.stimuli,
      });

      transcripts.push({ roundLabel: segment.roundLabel, text: res.transcript || '' });
      durations.push(segment.durationSeconds || 0);

      const parsed = parseAssessment(res.rawModelOutput);
      if (parsed) assessments.push(parsed);
    }
  } catch (err) {
    console.warn('[scoring] failed', err);
    scoring.transcripts = transcripts;
    scoring._unavailable('failed');
    return;
  }

  scoring.transcripts = transcripts;

  if (assessments.length === 0) {
    // Silence, or unusable audio: reported as such rather than scored at zero.
    scoring._unavailable('no-audio');
    return;
  }

  const base = sessionXp(assessments);
  const breakdown = computeXp({
    baseXp: base,
    streakDays: streakDays || 0,
    recordedSeconds: recordedSeconds || 0,
    isBattle: Boolean(isBattle),
  });

  scoring.assessments = assessments;
  scoring.breakdown = breakdown;
  scoring.totalXp = breakdown.totalXp;
  scoring.stimulusBonus = stimulusXp(assessments);
  scoring.flow = weightedAverage(assessments, durations, (a) => a.flowScore);
  scoring.rhyme = weightedAverage(assessments, durations, (a) => a.rhymeDensity);
  scoring.state = ScoringState.READY;

  store.applyAiXpAward(breakdown.totalXp);
  scoring._emit();
}

/** The Spanish explanation for why no XP was awarded. */
export function unavailableMessage(reason) {
  switch (reason) {
    case 'guest':
      return 'Inicia sesión con una cuenta para que tus sesiones sumen XP.';
    case 'plan':
      return 'El XP, los niveles y la evaluación con IA son parte de Plus.';
    case 'offline':
      return 'Esta sesión se jugó sin conexión, así que no suma XP.';
    case 'no-audio':
      return 'No se detectó voz suficiente para evaluar la sesión.';
    case 'failed':
      return 'La evaluación no se pudo completar. La sesión queda registrada sin XP.';
    default:
      return 'La evaluación no está disponible.';
  }
}
