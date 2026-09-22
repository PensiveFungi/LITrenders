/* =========================================================================
   modes.js — port of data/TrainingModes.kt + ui/modes/TrainingModeVisuals.kt
   The durations / stimulus flags below are asserted by
   TrainingModePresetIntegrityTest.kt — do not change them casually.
   ========================================================================= */

import { Difficulty } from '../core/domain.js';

export const StimulusType = { WORDS: 'WORDS', IMAGES: 'IMAGES' };

export const TRAINING_MODES = [
  {
    id: 'fms',
    displayName: 'FMS',
    description: 'Práctica en solitario al estilo liga: 4 asaltos de 60s sin cambiar de estímulo.',
    difficulty: Difficulty.HARD,
    roundDurationsSeconds: [60, 60, 60, 60],
    useRandomStimuli: true,
    allowStimulusChanges: false,
    stimulusType: StimulusType.WORDS,
  },
  {
    id: 'red_bull',
    displayName: 'Red Bull',
    description: '3 asaltos intensos de 90s con estímulos que cambian sobre la marcha.',
    difficulty: Difficulty.HARD,
    roundDurationsSeconds: [90, 90, 90],
    useRandomStimuli: true,
    allowStimulusChanges: true,
    stimulusType: StimulusType.WORDS,
  },
  {
    id: 'god_level',
    displayName: 'God Level',
    description: '4 rondas exigentes de 50s con estímulos que cambian sobre la marcha para perfiles avanzados.',
    difficulty: Difficulty.HARD,
    roundDurationsSeconds: [50, 50, 50, 50],
    useRandomStimuli: true,
    allowStimulusChanges: true,
    stimulusType: StimulusType.WORDS,
  },
  {
    id: 'con_estimulos',
    displayName: 'Con estímulos',
    description: 'Reacciona a palabras estímulo que cambian en cada ronda.',
    difficulty: Difficulty.MEDIUM,
    roundDurationsSeconds: [45, 45, 45, 45],
    useRandomStimuli: true,
    allowStimulusChanges: true,
    stimulusType: StimulusType.WORDS,
  },
  {
    id: 'easy',
    displayName: 'Easy Mode',
    description: 'Ritmo relajado para calentar: 2 rondas largas y sin presión de tiempo.',
    difficulty: Difficulty.EASY,
    roundDurationsSeconds: [90, 90],
    useRandomStimuli: false,
    allowStimulusChanges: false,
    stimulusType: StimulusType.WORDS,
  },
  {
    id: 'hard',
    displayName: 'Hard Mode',
    description: 'Rondas cortas y exigentes para freestylers con experiencia.',
    difficulty: Difficulty.HARD,
    roundDurationsSeconds: [45, 45, 45, 45],
    useRandomStimuli: true,
    allowStimulusChanges: false,
    stimulusType: StimulusType.WORDS,
  },
  {
    id: 'incremental',
    displayName: 'Incremental',
    description: 'La dificultad sube: cada ronda tiene menos tiempo que la anterior.',
    difficulty: Difficulty.MEDIUM,
    roundDurationsSeconds: [60, 45, 30, 20],
    useRandomStimuli: true,
    allowStimulusChanges: false,
    stimulusType: StimulusType.WORDS,
  },
  {
    id: 'tematicas',
    displayName: 'Temáticas',
    description: 'Una mezcla variada de finales de rima distintos en cada ronda.',
    difficulty: Difficulty.MEDIUM,
    roundDurationsSeconds: [60, 60, 60],
    useRandomStimuli: true,
    allowStimulusChanges: false,
    stimulusType: StimulusType.WORDS,
  },
  {
    id: 'palabras',
    displayName: 'Palabras',
    description: 'Practica con una palabra estímulo fija por ronda.',
    difficulty: Difficulty.MEDIUM,
    roundDurationsSeconds: [60, 60, 60],
    useRandomStimuli: false,
    allowStimulusChanges: false,
    stimulusType: StimulusType.WORDS,
  },
  {
    id: 'imagenes',
    displayName: 'Imágenes',
    description: 'Estímulos visuales: próximamente. Por ahora usamos palabras estímulo.',
    difficulty: Difficulty.MEDIUM,
    roundDurationsSeconds: [60, 60, 60],
    useRandomStimuli: true,
    allowStimulusChanges: false,
    stimulusType: StimulusType.IMAGES,
  },
  {
    id: 'libre',
    displayName: 'Libre',
    description: 'Sin reglas fijas: tú eliges las rimas y el ritmo de la sesión.',
    difficulty: Difficulty.MEDIUM,
    roundDurationsSeconds: [60],
    useRandomStimuli: false,
    allowStimulusChanges: false,
    stimulusType: StimulusType.WORDS,
  },
];

export function modeById(id) {
  return TRAINING_MODES.find((m) => m.id === id) || null;
}

export function roundsOf(mode) {
  return mode.roundDurationsSeconds.length;
}

/* ---------- Visual registry (TrainingModeVisuals.kt) ---------- */

function style(
  modeId, title, subtitle, oneLineDescription,
  primary, secondary, highlight, bg,
  icon, badgeLabel, timerLabel, stimulusLabel, stimulusHint,
  micTitle, micHint, intensity, chips
) {
  return {
    modeId, title, subtitle, oneLineDescription,
    palette: { primary, secondary, highlight, bg },
    icon, badgeLabel, timerLabel, stimulusLabel, stimulusHint,
    micTitle, micHint, intensity,
    motion: { pulseMillis: 900 - intensity * 90 },
    chips,
  };
}

const DEFAULT_STYLE = style(
  'libre', 'Libre', 'FREESTYLE ACADEMY', 'Sesión abierta · tú marcas el ritmo',
  '#7C3CFF', '#19D3E6', '#A66BFF', '#111321',
  'mic', 'ACADEMY MODE', 'TU ESPACIO', 'LIENZO ABIERTO', 'Sin estímulo obligatorio',
  'EMPEZAR LIBRE', 'Abrir herramientas', 2, ['TIMER ON', 'RIMAS AUTO', 'BEAT 92 BPM']
);

const STYLES = [
  style('fms', 'FMS', 'ENTRENAMIENTO DE LIGA', '4 × 60s · palabras aleatorias · estímulo bloqueado',
    '#FF174C', '#FFFFFF', '#FF174C', '#1A0710',
    'scoreboard', 'FMS INSPIRED', 'MINUTO LIBRE', 'PALABRA FIJA', 'Métrica estable · estímulo fijo',
    'EMPEZAR A RIMAR', 'Sin cambios durante la ronda', 5, ['FLOW', 'MÉTRICA', 'PUNCHLINE']),

  style('red_bull', 'Red Bull Batalla', 'MODO CLÁSICO', '3 × 90s · batalla energética · cambios habilitados',
    '#FF174C', '#FFD600', '#24C6FF', '#07142A',
    'bolt', 'BATALLA INSPIRED', 'TU TURNO', 'ESTÍMULO DINÁMICO', 'Cambio automático disponible',
    'TOCA PARA RIMAR', 'Cambiar estímulo', 5, ['AGILIDAD', 'RESPUESTA', 'ENERGÍA']),

  style('god_level', 'God Level', 'SOLO TRAINING', '4 × 50s · campeonato · cambios habilitados',
    '#8D4DFF', '#E0B83D', '#FF335F', '#130F24',
    'crown', 'GOD LEVEL INSPIRED', 'RONDA EXTREMA', 'ESTÍMULO DINÁMICO', 'Cambio automático disponible',
    'ACTIVAR MICRÓFONO', 'Nuevo estímulo', 5, ['PRESENCIA', 'TÉCNICA', 'ATAQUE']),

  style('con_estimulos', 'Con Estímulos', 'FREESTYLE ACADEMY', '4 × 45s · palabras reactivas · cambios habilitados',
    '#7C3CFF', '#19D3E6', '#A66BFF', '#121126',
    'spark', 'ACADEMY MODE', 'REACCIÓN RÁPIDA', 'PALABRAS EN SECUENCIA', 'Próximo estímulo en la ronda',
    'TOCA PARA RIMAR', 'Cambiar ahora', 4, ['ESPEJO', 'RIESGO', 'FUEGO']),

  style('easy', 'Easy Mode', 'CALENTAMIENTO', '2 × 90s · palabra fija · baja presión',
    '#42D6C9', '#A9FFF5', '#8BE7DF', '#0A2628',
    'leaf', 'ACADEMY MODE', 'FLUYE SIN PRESIÓN', 'PALABRA FIJA', 'Respira · escucha el beat · construye',
    'EMPEZAR SUAVE', 'Mantener estímulo', 1, ['RESPIRA', 'CONECTA', 'FLUYE']),

  style('hard', 'Hard Mode', 'ALTA EXIGENCIA', '4 × 45s · urgente · estímulo bloqueado',
    '#FF3B72', '#FF7A1A', '#B24CFF', '#250817',
    'flame', 'ACADEMY MODE', 'MÁXIMA PRESIÓN', 'PALABRA FIJA', 'Última ronda · sin cambios',
    'ENTRAR EN ZONA', 'Estímulo bloqueado', 5, ['VELOCIDAD', 'DOBLE TEMPO', 'REMATE']),

  style('incremental', 'Incremental', 'DIFICULTAD PROGRESIVA', '60 → 45 → 30 → 20 · presión escalonada',
    '#8E4DFF', '#19D3E6', '#B45CFF', '#121126',
    'steps', 'ACADEMY MODE', 'SIGUE SUBIENDO', 'PALABRA FIJA', 'Siguiente etapa: 20s',
    'SEGUIR SUBIENDO', '60 → 45 → 30 → 20', 4, ['60s', '45s', '30s', '20s']),

  style('tematicas', 'Temáticas', 'FREESTYLE ACADEMY', '3 × 60s · foco narrativo central',
    '#7C3CFF', '#F4B84A', '#A66BFF', '#121126',
    'topic', 'ACADEMY MODE', 'DESARROLLA UNA HISTORIA', 'TEMÁTICA', 'Mantén coherencia y cierra con remate',
    'TOCA PARA RIMAR', 'Nueva temática', 3, ['INICIO', 'DESARROLLO', 'REMATE']),

  style('palabras', 'Palabras', 'FREESTYLE ACADEMY', '3 × 60s · una palabra durante toda la ronda',
    '#7C3CFF', '#19D3E6', '#A66BFF', '#111321',
    'text', 'ACADEMY MODE', 'CONSTRUYE ALREDEDOR', 'PALABRA FIJA', 'Una palabra durante toda la ronda',
    'TOCA PARA RIMAR', 'Elegir otra palabra', 2, ['HORIZONTE', 'PUENTE', 'MONTE']),

  style('imagenes', 'Imágenes', 'ESTÍMULO VISUAL', '3 × 60s · imagen local con respaldo de palabra',
    '#19D3E6', '#7C3CFF', '#28E8FF', '#09242D',
    'image', 'ACADEMY MODE', 'OBSERVA · CONECTA · RIMA', 'IMAGEN', 'Describe detalles y crea una historia',
    'TOCA PARA RIMAR', 'Cambiar imagen', 3, ['LUZ', 'CIUDAD', 'LLUVIA']),

  DEFAULT_STYLE,
];

const STYLE_BY_ID = Object.fromEntries(STYLES.map((s) => [s.modeId, s]));

export function styleForModeId(modeId) {
  return STYLE_BY_ID[modeId] || DEFAULT_STYLE;
}

/* ---------- Image stimuli (data/image/ImageStimulus.kt) ---------- */

export const IMAGE_STIMULI = [
  {
    id: 'urban_night',
    title: 'Noche urbana',
    accessibleDescription: 'Silueta abstracta de edificios nocturnos con luna y avenida central.',
    fallbackWord: 'ciudad',
    tags: ['luz', 'ciudad', 'lluvia'],
    scene: { horizonColor: '#0B1024', skyColor: '#073B4C', accentColor: '#7C3CFF', moon: true },
  },
  {
    id: 'gold_stage',
    title: 'Escenario dorado',
    accessibleDescription: 'Tarima geométrica iluminada por focos cálidos y sombras profundas.',
    fallbackWord: 'escenario',
    tags: ['foco', 'corona', 'ritmo'],
    scene: { horizonColor: '#1A0F07', skyColor: '#23162D', accentColor: '#F4B84A', moon: false },
  },
  {
    id: 'neon_bridge',
    title: 'Puente neón',
    accessibleDescription: 'Puente abstracto con líneas cian que cruzan una ciudad oscura.',
    fallbackWord: 'puente',
    tags: ['camino', 'neón', 'altura'],
    scene: { horizonColor: '#07131F', skyColor: '#062B35', accentColor: '#19D3E6', moon: false },
  },
];

export function imageStimulusForRound(roundIndex) {
  if (IMAGE_STIMULI.length === 0) return null;
  if (roundIndex < 0) return null;
  return IMAGE_STIMULI[roundIndex % IMAGE_STIMULI.length];
}
