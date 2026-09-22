/* =========================================================================
   legal.js — port of ui/screens/LegalDocumentScreen.kt and
   LegalReconsentScreen.kt

   The consent gate: while the accepted version is behind LEGAL_VERSION, every
   route except Login, the onboarding tour and the documents themselves sends
   the reader here, and accepting is the only way on. Back lands on a guarded
   route, which sends them straight back — that is what a consent gate is.

   The app ships the documents inside the APK so the links work with no
   connection. On the web they are pages on litrenders.com; core/config.js is
   where their addresses live. Nothing here restates or summarises them — the
   published document is the document.
   ========================================================================= */

import { store } from '../core/store.js';
import { navigate, back } from '../core/router.js';
import { LEGAL_DOCUMENTS, legalDocumentById } from '../core/config.js';
import { esc, icon, appScaffold, wireBack, resetAccent } from '../ui/components.js';

/** One document, opened from the gate, from Login or from Ajustes → Legal. */
export function renderLegalDocument(root, { params }) {
  resetAccent();
  const doc = legalDocumentById(params.docId);

  root.innerHTML = `
    <div class="screen">
      ${appScaffold(doc ? doc.title : 'Documento', `
        ${doc ? `
          <p class="muted" style="margin:0">
            Este documento se publica en litrenders.com. Ábrelo para leer la
            versión vigente completa.
          </p>
          <a class="btn btn--primary" href="${esc(doc.url)}" target="_blank" rel="noopener">
            ${icon('doc', { size: 18 })} Abrir ${esc(doc.title.toLowerCase())}
          </a>
          <div class="list">
            ${LEGAL_DOCUMENTS.filter((d) => d.id !== doc.id).map((d) => `
              <a class="row-card" href="#/legal/${esc(d.id)}">
                <span class="row-card__icon">${icon('doc', { size: 22 })}</span>
                <span class="grow"><span class="row-card__title">${esc(d.title)}</span></span>
                <span class="row-card__arrow">${icon('arrow', { size: 20 })}</span>
              </a>`).join('')}
          </div>`
        : `<p class="muted" style="margin:0">Ese documento no existe.</p>`}
      `)}
    </div>`;
  wireBack(root, 'settings');
  return () => {};
}

/** The re-consent gate, for a revision reaching someone already inside. */
export function renderLegalConsent(root) {
  resetAccent();

  root.innerHTML = `
    <div class="screen" style="justify-content:center">
      <div class="stack" style="gap:18px">
        <span class="achv__badge" style="width:64px;height:64px">${icon('shield', { size: 30 })}</span>
        <h1 style="font-size:26px;margin:0">Hemos actualizado los documentos</h1>
        <p class="muted" style="margin:0">
          Para seguir usando Freestyle Academy necesitas aceptar la versión
          vigente de los términos y de la política de privacidad.
        </p>

        <div class="list">
          ${LEGAL_DOCUMENTS.map((d) => `
            <a class="row-card" href="#/legal/${esc(d.id)}">
              <span class="row-card__icon">${icon('doc', { size: 22 })}</span>
              <span class="grow"><span class="row-card__title">${esc(d.title)}</span></span>
              <span class="row-card__arrow">${icon('arrow', { size: 20 })}</span>
            </a>`).join('')}
        </div>

        <button class="btn btn--primary" type="button" data-action="accept">
          ACEPTAR Y CONTINUAR
        </button>
      </div>
    </div>`;

  root.querySelector('[data-action="accept"]').addEventListener('click', () => {
    store.acceptLegalDocuments();
    back('train');
  });

  return () => {};
}

/** Whether this route is allowed to render while consent is outstanding. */
export function isConsentExempt(route) {
  return route === 'legalConsent' || route === 'login' || route === 'onboarding'
    || route.startsWith('legal/');
}

export { navigate };
