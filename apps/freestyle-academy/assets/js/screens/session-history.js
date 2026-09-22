/* =========================================================================
   session-history.js — port of ui/screens/SessionHistoryScreen.kt and
   SessionRecordingScreen.kt

   One row per kept session. The register is permanent — only the audio can be
   deleted, and a deleted turn stays listed as a marker rather than
   disappearing, because the row is the record that the turn happened.

   `xpEarned` shows an em dash when it is null. Null is not zero: a register
   carries no XP when the plan doesn't accrue it, when the session was played
   offline, or when the evaluation failed — none of which mean the rapping
   scored nothing.

   Transcripts are a Pro tool (PlanEntitlements.hasTranscripts) and survive
   deleting the audio, because the text is not the recording.
   ========================================================================= */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { PlanEntitlements } from '../core/plans.js';
import { formatDateTime, formatDurationSeconds } from '../core/domain.js';
import {
  listRecordings, getRecording, deleteSegmentAudio, deleteAllAudio,
  hasRecording, segmentUrl,
} from '../core/recordings.js';
import {
  esc, icon, appScaffold, wireBack, emptyState, upsell, summaryRows,
  resetAccent, confirmDialog, toast,
} from '../ui/components.js';

/* ========================= The list ========================= */

export function renderSessionHistory(root) {
  resetAccent();

  if (!PlanEntitlements.hasLibraryAndHistory(store.planTier)) {
    root.innerHTML = `
      <div class="screen">
        ${appScaffold('Historial de sesiones', upsell('Disponible con Plus',
          'Guarda cada sesión con su grabación por rondas y vuelve a escucharte cuando quieras.'))}
      </div>`;
    wireBack(root, 'profile');
    root.querySelectorAll('[data-go]').forEach((el) =>
      el.addEventListener('click', () => navigate(el.dataset.go)));
    return () => {};
  }

  let rows = null;

  function view() {
    if (rows === null) {
      return `<div class="card row" style="gap:14px">
        <span class="spinner"></span><span class="muted">Cargando tus sesiones…</span>
      </div>`;
    }
    if (rows.length === 0) {
      return emptyState('Sin sesiones guardadas',
        'Termina una sesión con el micrófono activo y quedará aquí, con su grabación y su evaluación.');
    }
    return `<div class="list">${rows.map((r) => `
      <button class="row-card" type="button" data-id="${r.id}">
        <span class="row-card__icon">${icon(hasRecording(r) ? 'waveform' : 'doc', { size: 22 })}</span>
        <span class="grow">
          <span class="row-card__title" style="display:block">${esc(r.modeName)}</span>
          <span class="row-card__sub" style="display:block">
            ${esc(formatDateTime(r.timestampMillis))} · ${esc(formatDurationSeconds(r.durationSeconds))}
          </span>
        </span>
        <span style="font-weight:700;color:var(--accent-bright)">
          ${r.xpEarned == null ? '—' : `+${r.xpEarned}`}
        </span>
      </button>`).join('')}</div>`;
  }

  function paint() {
    root.innerHTML = `<div class="screen">${appScaffold('Historial de sesiones', `
      <p class="muted" style="margin:0">
        Cada sesión queda registrada. La grabación se puede borrar; el registro no.
      </p>
      <div data-slot="list">${view()}</div>
    `)}</div>`;
    wireBack(root, 'profile');
    root.querySelectorAll('[data-id]').forEach((el) =>
      el.addEventListener('click', () => navigate(`sessionRecording/${el.dataset.id}`)));
  }

  paint();
  listRecordings(store.scope).then((r) => { rows = r; paint(); });
  return () => {};
}

/* ========================= One session ========================= */

export function renderSessionRecording(root, { params }) {
  resetAccent();

  const id = Number(params.recordingId);
  let record = null;
  let loaded = false;
  const urls = [];

  function releaseUrls() {
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  }

  function segmentRow(s) {
    const showTranscript = PlanEntitlements.hasTranscripts(store.planTier);
    const url = segmentUrl(s);
    if (url) urls.push(url);

    return `
      <div class="card stack" style="gap:10px">
        <div class="row row--between">
          <span>
            <span class="eyebrow" style="display:block">${esc(s.roundLabel)}</span>
            ${s.performerName
              ? `<span class="dim">${esc(s.performerName)}</span>`
              : `<span class="dim">${esc(formatDurationSeconds(s.durationSeconds))}</span>`}
          </span>
          ${!s.deleted ? `
            <button class="iconbtn iconbtn--sm" type="button" data-drop="${s.roundNumber}"
                    aria-label="Borrar la grabación de ${esc(s.roundLabel)}">
              ${icon('trash', { size: 18 })}
            </button>` : ''}
        </div>

        ${s.deleted
          ? `<p class="dim" style="margin:0">${icon('info', { size: 15 })} Grabación eliminada</p>`
          : url
            ? `<audio controls preload="none" src="${url}" style="width:100%"></audio>`
            : `<p class="dim" style="margin:0">Audio no disponible en este navegador.</p>`}

        ${s.transcript && showTranscript
          ? `<div class="transcript">${esc(s.transcript)}</div>`
          : (s.transcript && !showTranscript
              ? `<p class="dim" style="margin:0">${icon('lock', { size: 14 })} La transcripción es parte de Pro.</p>`
              : '')}
      </div>`;
  }

  function body() {
    if (!loaded) {
      return `<div class="card row" style="gap:14px">
        <span class="spinner"></span><span class="muted">Cargando…</span>
      </div>`;
    }
    if (!record) {
      return emptyState('Sesión no encontrada',
        'Este registro ya no existe en este navegador.');
    }

    return `
      <div class="card stack">
        ${summaryRows([
          ['Modo', record.modeName],
          ['Fecha', formatDateTime(record.timestampMillis)],
          ['Duración', formatDurationSeconds(record.durationSeconds)],
          ['XP', record.xpEarned == null ? '—' : `+${record.xpEarned}`],
          ['Turnos', `${record.segments.length}`],
        ])}
      </div>

      ${record.segments.length === 0
        ? `<p class="dim" style="margin:0">Este registro se guardó sin audio.</p>`
        : record.segments.map(segmentRow).join('')}

      ${hasRecording(record) ? `
        <button class="btn btn--outline" type="button" data-action="drop-all">
          ${icon('trash', { size: 18 })} Borrar toda la grabación
        </button>` : ''}

      <p class="dim" style="margin:0">
        Borrar el audio no cambia lo que la sesión sumó ni quita el registro.
      </p>`;
  }

  function paint() {
    releaseUrls();
    root.innerHTML = `<div class="screen">${appScaffold(
      record?.modeName || 'Sesión', `<div data-slot="body">${body()}</div>`
    )}</div>`;
    wireBack(root, 'sessionHistory');

    root.querySelectorAll('[data-drop]').forEach((el) =>
      el.addEventListener('click', async () => {
        const n = Number(el.dataset.drop);
        const ok = await confirmDialog({
          title: '¿Borrar esta grabación?',
          message: 'El turno sigue en el registro, marcado como eliminado. Su transcripción se conserva.',
          confirmText: 'Borrar audio',
          danger: true,
        });
        if (!ok) return;
        record = await deleteSegmentAudio(store.scope, id, n);
        paint();
        toast('Grabación borrada');
      }));

    root.querySelector('[data-action="drop-all"]')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: '¿Borrar toda la grabación?',
        message: 'Se borra el audio de todos los turnos. El registro de la sesión se mantiene.',
        confirmText: 'Borrar todo',
        danger: true,
      });
      if (!ok) return;
      record = await deleteAllAudio(store.scope, id);
      paint();
      toast('Grabación borrada');
    });
  }

  paint();
  getRecording(store.scope, id).then((r) => { record = r; loaded = true; paint(); });

  return releaseUrls;
}
