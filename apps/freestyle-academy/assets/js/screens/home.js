/* home.js — port of ui/screens/HomeScreen.kt (route: train) */

import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { PlanEntitlements, planDisplayName } from '../core/plans.js';
import {
  esc, icon, rowCard, sectionHead, resetAccent, upsell,
} from '../ui/components.js';

export function renderHome(root) {
  resetAccent();

  function view() {
    const p = store.progress;
    const alias = store.displayAlias;
    const guest = !store.isAccount;

    return `
      <div class="home-head">
        <div class="grow">
          <h1>¡Qué onda, ${esc(alias)}!</h1>
          <p>¿Listo para soltar barras?</p>
        </div>
        <button class="iconbtn iconbtn--bordered" type="button" data-go="profile"
                aria-label="Abrir perfil">${icon('person')}</button>
      </div>

      <div class="row row--wrap" style="gap:8px">
        <span class="pill">${icon('flame', { size: 15 })} Racha ${p.practiceStreakDays}</span>
        <span class="pill pill--muted">${esc(planDisplayName(store.planTier))}</span>
        ${guest ? '<span class="pill pill--muted">Invitado</span>' : ''}
      </div>

      <button class="hero" type="button" data-action="recommended">
        <span class="hero__eyebrow">SESIÓN RECOMENDADA</span>
        <span class="hero__title">ENTRENA AHORA</span>
        <span class="hero__desc">Un tablero con cuatro grupos de rima al azar. Sin configurar nada.</span>
        <span class="row" style="gap:7px;margin-top:6px;color:#fff;font-weight:700;font-size:14px">
          Jugar ahora ${icon('arrow', { size: 17 })}
        </span>
      </button>

      <div class="section">
        ${sectionHead('Entrenamiento')}
        <div class="list">
          ${rowCard({
            title: 'Entrenar',
            subtitle: 'Elige y ordena tus rondas: Easy, Hard, Temáticas, Imágenes, Objetos, Minuto Libre.',
            iconName: 'dumbbell',
            action: 'entrenar',
          })}
          ${rowCard({
            title: 'Entrenamiento Personalizado',
            subtitle: 'Un tablero de rimas en vivo con hasta cuatro grupos. Sin XP ni rachas.',
            iconName: 'grid',
            action: 'personalizado',
          })}
        </div>
      </div>

      <div class="section">
        ${sectionHead('Batallas')}
        <div class="list">
          ${rowCard({
            title: 'Master Serie',
            subtitle: 'Disciplina · Métrica · Competencia',
            iconName: 'scoreboard',
            action: 'battle',
            value: 'master_serie',
          })}
          ${rowCard({
            title: 'Gallos',
            subtitle: 'Energía · Escenario · Legado',
            iconName: 'bolt',
            action: 'battle',
            value: 'gallos',
          })}
        </div>
      </div>

      ${guest ? `
        <div class="upsell">
          <p class="upsell__title">${icon('person', { size: 17 })} Estás como invitado</p>
          <p class="muted" style="margin:0">
            Practica todo lo que quieras. Para guardar tu progreso, tu racha y tus
            logros necesitas una cuenta.
          </p>
          <button class="btn btn--primary btn--compact" type="button" data-go="login">
            Crear cuenta o iniciar sesión
          </button>
        </div>`
      : (!PlanEntitlements.hasXpProgression(store.planTier)
          ? upsell('Desbloquea tu progreso',
                   'Con Plus tus sesiones se evalúan con IA y suman XP, niveles y logros.')
          : '')}

      <div class="section">
        ${sectionHead('Tus herramientas')}
        <div class="tool-grid">
          <button class="tool-card" type="button" data-go="library">
            ${icon('library')}
            <span class="tool-card__title">Librería</span>
            <span class="dim">${Object.keys(store.rhymes).length} grupos de rima</span>
          </button>
          <button class="tool-card" type="button" data-go="progress">
            ${icon('chart')}
            <span class="tool-card__title">Progreso</span>
            <span class="dim">Nivel ${p.currentLevel}</span>
          </button>
        </div>
      </div>`;
  }

  function paint() {
    root.innerHTML = view();
    root.querySelectorAll('[data-go]').forEach((el) =>
      el.addEventListener('click', () => navigate(el.dataset.go)));

    // The hero card is the app's "sesión recomendada": it opens the
    // Personalizado board on four random rhyme groups straight away, which is
    // what HomeScreen's onStartRecommended does.
    root.querySelector('[data-action="recommended"]')
      ?.addEventListener('click', () => navigate('personalizado?immediate=true'));

    root.querySelectorAll('[data-action="entrenar"]').forEach((el) =>
      el.addEventListener('click', () => navigate('entrenar')));

    root.querySelectorAll('[data-action="personalizado"]').forEach((el) =>
      el.addEventListener('click', () => navigate('personalizado')));

    root.querySelectorAll('[data-action="battle"]').forEach((el) =>
      el.addEventListener('click', () =>
        navigate(`battleRoom?presetId=${encodeURIComponent(el.dataset.value)}`)));
  }

  paint();
  const off = [
    store.on('progress', paint),
    store.on('profile', paint),
    store.on('scope', paint),
    store.on('plan', paint),
  ];
  return () => off.forEach((f) => f());
}
