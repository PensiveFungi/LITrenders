/* =========================================================================
   login.js — port of ui/screens/LoginScreen.kt

   Google, email + contraseña, or carry on as a guest. Login is NOT a gate:
   everything in the app works without an account, it just isn't banked.

   The consent checkbox is where a fresh install accepts the documents, which
   on a fresh install is everyone. Someone already inside when a revision
   lands meets the re-consent gate instead (screens/legal.js).

   A brand-new sign-up pauses on "revisa tu correo" — the app enters only once
   that prompt is cleared, so a new account never slips past it.
   ========================================================================= */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import {
  auth, signInWithGoogle, signInWithEmail, signUpWithEmail,
  sendPasswordResetEmail, resendVerificationEmail, authErrorMessage,
} from '../core/firebase.js';
import { isFirebaseConfigured, LEGAL_DOCUMENTS } from '../core/config.js';
import { esc, icon, resetAccent, toast } from '../ui/components.js';

export function renderLogin(root) {
  resetAccent();

  let mode = 'signin';          // 'signin' | 'signup'
  let busy = false;
  let error = '';
  let accepted = store.legalAccepted;
  let pendingEmail = null;      // set after a sign-up, cleared by "Continuar"

  function consentHtml() {
    return `
      <label class="check">
        <input type="checkbox" id="accept" ${accepted ? 'checked' : ''}>
        <span>
          Acepto los
          ${LEGAL_DOCUMENTS.map((d, i) =>
            `${i > 0 ? ' y la ' : ''}<a href="#/legal/${esc(d.id)}">${esc(d.title.toLowerCase())}</a>`).join('')}.
        </span>
      </label>`;
  }

  function verifyView() {
    return `
      <div class="stack" style="gap:16px;align-items:center;text-align:center">
        <span class="achv__badge" style="width:64px;height:64px">${icon('mail', { size: 30 })}</span>
        <h1 style="font-size:26px;margin:0">Revisa tu correo</h1>
        <p class="muted" style="margin:0">
          Te enviamos un enlace de verificación a ${esc(pendingEmail)}. Ábrelo
          para confirmar que la cuenta es tuya.
        </p>
        <button class="btn btn--primary" type="button" data-action="continue">CONTINUAR</button>
        <button class="btn btn--ghost btn--compact" type="button" data-action="resend">
          Volver a enviar el correo
        </button>
      </div>`;
  }

  function view() {
    if (pendingEmail) return verifyView();

    const signup = mode === 'signup';
    return `
      <div class="stack" style="gap:20px">
        <div class="stack" style="gap:6px">
          <span class="brand-mark">${icon('mic', { size: 26 })}</span>
          <h1 style="font-size:28px;margin:0">
            ${signup ? 'Crea tu cuenta' : 'Entra a la academia'}
          </h1>
          <p class="muted" style="margin:0">
            Tu progreso, tu racha y tu librería viajan contigo entre el teléfono
            y la web.
          </p>
        </div>

        ${!isFirebaseConfigured() ? `
          <p class="notice">${icon('info', { size: 17 })}<span>
            Las cuentas todavía no están conectadas en esta instalación. Puedes
            entrenar como invitado mientras tanto.
          </span></p>` : `
          <button class="btn btn--google" type="button" data-action="google" ${busy ? 'disabled' : ''}>
            ${icon('google', { size: 19 })} Continuar con Google
          </button>

          <div class="divider"><span>o con tu correo</span></div>

          <div class="field">
            <label class="field__label" for="email">Correo</label>
            <input class="input" id="email" type="email" autocomplete="email"
                   placeholder="tu@correo.com">
          </div>

          <div class="field">
            <label class="field__label" for="password">Contraseña</label>
            <input class="input" id="password" type="password"
                   autocomplete="${signup ? 'new-password' : 'current-password'}"
                   placeholder="Mínimo 6 caracteres">
          </div>

          <button class="btn btn--primary" type="button" data-action="submit" ${busy ? 'disabled' : ''}>
            ${busy ? 'UN MOMENTO…' : (signup ? 'CREAR CUENTA' : 'INICIAR SESIÓN')}
          </button>

          <div class="row row--between">
            <button class="btn btn--ghost btn--compact" type="button" data-action="mode">
              ${signup ? '¿Ya tienes cuenta? Entra' : 'Crear una cuenta'}
            </button>
            ${!signup ? `<button class="btn btn--ghost btn--compact" type="button" data-action="reset">
              Olvidé mi contraseña</button>` : ''}
          </div>`}

        <!-- The consent checkbox sits outside the account block on purpose:
             entering as a guest is use of the app too, and it is the only
             place a guest can accept. -->
        ${consentHtml()}

        ${error ? `<p class="notice notice--error">${icon('info', { size: 17 })}<span>${esc(error)}</span></p>` : ''}

        <button class="btn btn--outline" type="button" data-action="guest">
          Entrar como invitado
        </button>
        <p class="dim center" style="margin:0">
          Como invitado puedes entrenar todo lo que quieras; nada se guarda.
        </p>
      </div>`;
  }

  function readConsent() {
    const box = root.querySelector('#accept');
    if (box) accepted = box.checked;
  }

  function fields() {
    return {
      email: root.querySelector('#email')?.value.trim() || '',
      password: root.querySelector('#password')?.value || '',
    };
  }

  async function run(fn) {
    busy = true; error = ''; paint();
    try { await fn(); } catch (err) {
      error = authErrorMessage(err);
    }
    busy = false; paint();
  }

  function paint() {
    root.innerHTML = `<div class="screen screen--auth">${view()}</div>`;

    root.querySelector('#accept')?.addEventListener('change', readConsent);

    root.querySelector('[data-action="mode"]')?.addEventListener('click', () => {
      readConsent();
      mode = mode === 'signup' ? 'signin' : 'signup';
      error = '';
      paint();
    });

    root.querySelector('[data-action="guest"]')?.addEventListener('click', () => {
      readConsent();
      // Entering as a guest is still use of the app, so it passes the same
      // consent checkbox — otherwise the gate would bounce them straight back.
      if (!accepted) { error = 'Acepta los documentos para continuar.'; paint(); return; }
      store.acceptLegalDocuments();
      store.completeOnboarding();
      navigate('train', { replace: true });
    });

    root.querySelector('[data-action="google"]')?.addEventListener('click', () => {
      readConsent();
      if (!accepted) { error = 'Acepta los documentos para continuar.'; paint(); return; }
      store.acceptLegalDocuments();
      run(() => signInWithGoogle());
    });

    root.querySelector('[data-action="submit"]')?.addEventListener('click', () => {
      readConsent();
      const { email, password } = fields();
      if (!email || !password) { error = 'Escribe tu correo y tu contraseña.'; paint(); return; }
      if (!accepted) { error = 'Acepta los documentos para continuar.'; paint(); return; }
      store.acceptLegalDocuments();
      run(async () => {
        if (mode === 'signup') {
          pendingEmail = await signUpWithEmail(email, password);
        } else {
          await signInWithEmail(email, password);
        }
      });
    });

    root.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
      const { email } = fields();
      if (!email) { error = 'Escribe tu correo para enviarte el enlace.'; paint(); return; }
      run(async () => {
        await sendPasswordResetEmail(email);
        toast('Te enviamos un enlace para cambiarla');
      });
    });

    root.querySelector('[data-action="resend"]')?.addEventListener('click', () =>
      run(async () => {
        await resendVerificationEmail();
        toast('Correo reenviado');
      }));

    root.querySelector('[data-action="continue"]')?.addEventListener('click', () => {
      pendingEmail = null;
      store.completeOnboarding();
      navigate('train', { replace: true });
    });
  }

  paint();

  // Signing in enters the app — but never while the post-sign-up prompt is up.
  const off = auth.onChange((user) => {
    if (user && !pendingEmail) {
      store.completeOnboarding();
      navigate('train', { replace: true });
    }
  });

  return off;
}
