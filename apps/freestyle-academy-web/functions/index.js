/* =========================================================================
   Freestyle Academy — AI feedback proxy (Firebase Cloud Functions, 2nd gen)

   Why a proxy: the Groq API key must never reach the browser. The web app
   posts audio here; this function calls Groq and returns only the analysis.

   Pipeline:
     1. whisper-large-v3-turbo  → Spanish transcript
     2. llama-3.3-70b-versatile → FMS-dimension scoring of that transcript

   Deploy:
     cd functions && npm install
     firebase functions:secrets:set GROQ_API_KEY
     firebase deploy --only functions
   ========================================================================= */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

const GROQ_API_KEY = defineSecret('GROQ_API_KEY');

admin.initializeApp();

/* ---------- Configuration ---------- */

const STT_MODEL = 'whisper-large-v3-turbo';
const LLM_MODEL = 'llama-3.3-70b-versatile';
const GROQ_BASE = 'https://api.groq.com/openai/v1';

/**
 * Origins allowed to call this function directly.
 * Requests served through the Firebase Hosting rewrite are same-origin and
 * never hit this check.
 */
const ALLOWED_ORIGINS = [
  'https://litrenders.com',
  'https://www.litrenders.com',
  'http://localhost:5000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

/** Require a signed-in Firebase user. Set to false only while testing. */
const REQUIRE_AUTH = true;

const MAX_AUDIO_BYTES = 22 * 1024 * 1024;

/* ---------- Naive in-memory rate limit ----------
   Per-instance only, so it is a courtesy guard rather than a hard quota.
   For real enforcement, move the counter into Firestore. */

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 6;
const rateBuckets = new Map();

function rateLimited(key) {
  const now = Date.now();
  const bucket = (rateBuckets.get(key) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (bucket.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(key, bucket);
    return true;
  }
  bucket.push(now);
  rateBuckets.set(key, bucket);
  if (rateBuckets.size > 5000) rateBuckets.clear();
  return false;
}

/* ---------- Helpers ---------- */

function applyCors(req, res) {
  const origin = req.get('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
  }
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
}

async function verifyCaller(req) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    return await admin.auth().verifyIdToken(match[1]);
  } catch {
    return null;
  }
}

function extensionFor(mimeType) {
  if (!mimeType) return 'webm';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm';
}

/* ---------- Groq calls ---------- */

async function transcribe(apiKey, audioBuffer, mimeType) {
  const form = new FormData();
  form.append(
    'file',
    new Blob([audioBuffer], { type: mimeType || 'audio/webm' }),
    `round.${extensionFor(mimeType)}`
  );
  form.append('model', STT_MODEL);
  form.append('language', 'es');
  form.append('response_format', 'json');
  form.append(
    'prompt',
    'Transcripción de una sesión de freestyle rap en español. Jerga urbana, rimas y juegos de palabras.'
  );

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`STT ${res.status}: ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  return String(data.text || '').trim();
}

const SYSTEM_PROMPT = `Eres juez de freestyle en español, con el criterio de la FMS (Freestyle Master Series).

Evalúas SOLO la transcripción de una ronda improvisada. Puntúas cinco dimensiones de 0 a 10:
- rima: densidad, variedad y calidad de las rimas (asonante/consonante, multisílabas).
- flow: cadencia, métrica, constancia del ritmo en el texto.
- tecnica: recursos técnicos — juegos de palabras, dobles sentidos, aliteración, encabalgamiento.
- escena: fuerza de la puesta en escena que transmite el texto — actitud, remates, construcción.
- respuestas: uso del estímulo dado y capacidad de responder a él.

Reglas estrictas:
- Sé exigente y honesto. Una ronda floja recibe notas bajas. No infles las puntuaciones.
- Si la transcripción es muy corta, incoherente o parece ruido, pon notas bajas y dilo.
- Juzga solo lo que está en la transcripción. Nunca inventes contenido que no aparezca.
- Escribe en español rioplatense neutro, directo, sin humo y sin promesas de fama.
- Máximo 3 fortalezas y 3 mejoras, de una frase cada una y accionables.
- rhymeWords: hasta 8 palabras de la transcripción que funcionan como rimas.

Responde ÚNICAMENTE con JSON válido, sin texto alrededor, con esta forma exacta:
{"scores":{"rima":0,"flow":0,"tecnica":0,"escena":0,"respuestas":0},"strengths":["..."],"improvements":["..."],"rhymeWords":["..."]}`;

async function score(apiKey, transcript, context) {
  const userPrompt = [
    `Modo: ${context.modeName || 'Libre'}`,
    `Dificultad: ${context.difficulty || 'Medio'}`,
    context.rhymeKey ? `Terminación de rima objetivo: -${context.rhymeKey}` : null,
    context.stimulusWords && context.stimulusWords.length
      ? `Palabras estímulo: ${context.stimulusWords.join(', ')}`
      : null,
    `Duración: ${context.durationSeconds || 0} segundos`,
    '',
    'Transcripción:',
    transcript,
  ].filter(Boolean).join('\n');

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      temperature: 0.3,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`LLM ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return { scores: {}, strengths: [], improvements: [], rhymeWords: [] };
  }
}

/* ---------- Handler ---------- */

exports.analyzeRound = onRequest(
  {
    secrets: [GROQ_API_KEY],
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 120,
    maxInstances: 10,
    cors: false, // handled manually so the allow-list stays explicit
  },
  async (req, res) => {
    applyCors(req, res);

    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return; }

    let uid = 'anonymous';
    if (REQUIRE_AUTH) {
      const decoded = await verifyCaller(req);
      if (!decoded) { res.status(401).json({ error: 'unauthenticated' }); return; }
      uid = decoded.uid;
    } else {
      const decoded = await verifyCaller(req);
      if (decoded) uid = decoded.uid;
    }

    if (rateLimited(uid)) { res.status(429).json({ error: 'rate_limited' }); return; }

    const { audioBase64, mimeType, context = {} } = req.body || {};
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.status(400).json({ error: 'missing_audio' });
      return;
    }

    let audioBuffer;
    try {
      audioBuffer = Buffer.from(audioBase64, 'base64');
    } catch {
      res.status(400).json({ error: 'invalid_audio' });
      return;
    }
    if (audioBuffer.length === 0) { res.status(400).json({ error: 'empty_audio' }); return; }
    if (audioBuffer.length > MAX_AUDIO_BYTES) { res.status(413).json({ error: 'audio_too_large' }); return; }

    const apiKey = GROQ_API_KEY.value();
    if (!apiKey) { res.status(500).json({ error: 'missing_api_key' }); return; }

    try {
      const transcript = await transcribe(apiKey, audioBuffer, mimeType);

      const words = transcript.split(/\s+/).filter(Boolean);
      const durationSeconds = Number(context.durationSeconds) || 0;
      const wordsPerMinute = durationSeconds > 0
        ? Math.round((words.length / durationSeconds) * 60)
        : 0;

      // Too little speech to judge: return the measured facts, score nothing.
      if (words.length < 12) {
        res.status(200).json({
          transcript,
          wordCount: words.length,
          wordsPerMinute,
          scores: { rima: 0, flow: 0, tecnica: 0, escena: 0, respuestas: 0 },
          strengths: [],
          improvements: ['Apenas se detectó voz en la grabación. Acerca el micrófono y sube el volumen.'],
          rhymeWords: [],
        });
        return;
      }

      const analysis = await score(apiKey, transcript, context);

      res.status(200).json({
        transcript,
        wordCount: words.length,
        wordsPerMinute,
        scores: analysis.scores || {},
        strengths: analysis.strengths || [],
        improvements: analysis.improvements || [],
        rhymeWords: analysis.rhymeWords || [],
      });
    } catch (err) {
      console.error('[analyzeRound]', err);
      res.status(502).json({ error: 'upstream_failed' });
    }
  }
);
