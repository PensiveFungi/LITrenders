/* =========================================================================
   feedback.js — client for the AI feedback pipeline

   Sends a round's audio to the Cloud Function in functions/index.js, which
   holds the Groq key server-side and returns:
     { transcript, wordCount, wordsPerMinute, scores{}, total, strengths[],
       improvements[], rhymeWords[] }

   The dimensions match FMS judging: rima, flow, técnica, puesta en escena,
   respuestas. Scores come from the LLM; the word/minute figures are measured
   from the transcript, not invented.
   ========================================================================= */

import { AI_FEEDBACK_ENDPOINT, AI_FEEDBACK_ENABLED } from './config.js';
import { getIdToken } from './firebase.js';
import { blobToBase64 } from './audio.js';

export const FEEDBACK_DIMENSIONS = [
  { key: 'rima', label: 'Rima' },
  { key: 'flow', label: 'Flow' },
  { key: 'tecnica', label: 'Técnica' },
  { key: 'escena', label: 'Puesta en escena' },
  { key: 'respuestas', label: 'Respuestas' },
];

export class FeedbackUnavailable extends Error {
  constructor(message, { reason = 'unknown' } = {}) {
    super(message);
    this.name = 'FeedbackUnavailable';
    this.reason = reason;
  }
}

export function isFeedbackEnabled() {
  return AI_FEEDBACK_ENABLED && Boolean(AI_FEEDBACK_ENDPOINT);
}

/**
 * Analyses one round.
 * @param {Blob}   blob      recorded audio for the round
 * @param {object} context   { modeName, difficultyLabel, rhymeKey, stimulusWords, durationSeconds }
 */
export async function analyzeRound(blob, context) {
  if (!isFeedbackEnabled()) {
    throw new FeedbackUnavailable('El análisis con IA está desactivado.', { reason: 'disabled' });
  }
  if (!blob || blob.size === 0) {
    throw new FeedbackUnavailable('No se grabó audio en esta ronda.', { reason: 'no-audio' });
  }
  // Groq's Whisper endpoint caps uploads; keep well under it.
  if (blob.size > 22 * 1024 * 1024) {
    throw new FeedbackUnavailable('La grabación es demasiado larga para analizar.', { reason: 'too-large' });
  }

  const audioBase64 = await blobToBase64(blob);
  const token = await getIdToken();

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(AI_FEEDBACK_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        audioBase64,
        mimeType: blob.type || 'audio/webm',
        context: {
          modeName: context.modeName || '',
          difficulty: context.difficultyLabel || '',
          rhymeKey: context.rhymeKey || '',
          stimulusWords: (context.stimulusWords || []).slice(0, 12),
          durationSeconds: context.durationSeconds || 0,
        },
      }),
    });
  } catch {
    throw new FeedbackUnavailable(
      'No se pudo conectar con el servidor de análisis.',
      { reason: 'network' }
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new FeedbackUnavailable(
      'Inicia sesión para usar el análisis con IA.',
      { reason: 'auth' }
    );
  }
  if (response.status === 429) {
    throw new FeedbackUnavailable(
      'Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.',
      { reason: 'rate-limit' }
    );
  }
  if (response.status === 404 || response.status === 501) {
    throw new FeedbackUnavailable(
      'El análisis con IA todavía no está desplegado.',
      { reason: 'not-deployed' }
    );
  }
  if (!response.ok) {
    throw new FeedbackUnavailable(
      'El servidor de análisis devolvió un error.',
      { reason: 'server' }
    );
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new FeedbackUnavailable('Respuesta inválida del servidor.', { reason: 'server' });
  }

  return normalize(data);
}

function clampScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(10, Math.max(0, Math.round(n * 10) / 10));
}

function normalize(data) {
  const scores = {};
  FEEDBACK_DIMENSIONS.forEach(({ key }) => {
    scores[key] = clampScore(data?.scores?.[key]);
  });
  const values = Object.values(scores);
  const total = values.length
    ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
    : 0;

  const asStrings = (arr) =>
    Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && s.trim()).slice(0, 4) : [];

  return {
    transcript: typeof data?.transcript === 'string' ? data.transcript.trim() : '',
    wordCount: Number(data?.wordCount) || 0,
    wordsPerMinute: Number(data?.wordsPerMinute) || 0,
    scores,
    total,
    strengths: asStrings(data?.strengths),
    improvements: asStrings(data?.improvements),
    rhymeWords: asStrings(data?.rhymeWords),
  };
}

/** XP multiplier applied on top of the measured session XP, as in the app's plan. */
export function xpMultiplierForScore(total) {
  if (total >= 8.5) return 1.25;
  if (total >= 7) return 1.15;
  if (total >= 5) return 1.05;
  return 1;
}
