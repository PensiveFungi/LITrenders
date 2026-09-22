/* =========================================================================
   stimuli.js — port of data/image/ImageStimulus.kt

   The definitive scene artwork (25 portrait webp) and the object vectors
   (48, converted from the Android VectorDrawables to SVG). Same catalogue,
   same ids, same fallback words and tags as the app.
   ========================================================================= */

const BASE = 'assets/img/stimuli/';

export const IMAGE_STIMULI = [
  { id: "scene_ancla_hundida", title: "Ancla hundida", description: "Ancla oxidada hundida en el fondo del mar, entre algas y corales.", fallbackWord: "ancla", tags: ["mar", "fondo", "óxido"], src: BASE + "stimulus_scene_ancla_hundida.webp" },
  { id: "scene_ansiedad_reloj", title: "Ansiedad", description: "Figura con un cronómetro encendido por cabeza, estallando de energía.", fallbackWord: "ansiedad", tags: ["tiempo", "presión", "mente"], src: BASE + "stimulus_scene_ansiedad_reloj.webp" },
  { id: "scene_azotea_amanecer", title: "Azotea al amanecer", description: "Azotea con una planta y una silla frente al horizonte urbano al amanecer.", fallbackWord: "azotea", tags: ["ciudad", "amanecer", "calma"], src: BASE + "stimulus_scene_azotea_amanecer.webp" },
  { id: "scene_aguila_picada", title: "Águila en picada", description: "Águila lanzándose en picada con las alas extendidas sobre las montañas.", fallbackWord: "águila", tags: ["vuelo", "caza", "montaña"], src: BASE + "stimulus_scene_aguila_picada.webp" },
  { id: "scene_balanza", title: "Balanza desequilibrada", description: "Balanza inclinada: objetos pesados en un plato y una pluma brillante en el otro.", fallbackWord: "balanza", tags: ["equilibrio", "peso", "justicia"], src: BASE + "stimulus_scene_balanza.webp" },
  { id: "scene_murcielago_colgado", title: "Murciélago colgado", description: "Murciélago colgado boca abajo en la oscuridad, con las alas plegadas.", fallbackWord: "murciélago", tags: ["noche", "instinto", "sombra"], src: BASE + "stimulus_scene_murcielago_colgado.webp" },
  { id: "scene_bosque_neblinoso", title: "Bosque neblinoso", description: "Bosque denso cubierto de niebla espesa entre árboles altos.", fallbackWord: "bosque", tags: ["niebla", "misterio", "naturaleza"], src: BASE + "stimulus_scene_bosque_neblinoso.webp" },
  { id: "scene_microfono_roto", title: "Micrófono roto", description: "Micrófono partido tirado en el suelo tras la batalla.", fallbackWord: "micrófono", tags: ["derrota", "escenario", "silencio"], src: BASE + "stimulus_scene_microfono_roto.webp" },
  { id: "scene_espejo_roto", title: "Espejo roto", description: "Espejo quebrado con el reflejo fragmentado en mil pedazos.", fallbackWord: "espejo", tags: ["reflejo", "quiebre", "identidad"], src: BASE + "stimulus_scene_espejo_roto.webp" },
  { id: "scene_pantalla_rota", title: "Pantalla rota", description: "Teléfono con la pantalla estrellada y fisuras por todos lados.", fallbackWord: "pantalla", tags: ["quiebre", "conexión", "distancia"], src: BASE + "stimulus_scene_pantalla_rota.webp" },
  { id: "scene_brujula_sin_norte", title: "Brújula sin norte", description: "Brújula con la aguja girando sin encontrar el norte.", fallbackWord: "brújula", tags: ["rumbo", "duda", "viaje"], src: BASE + "stimulus_scene_brujula_sin_norte.webp" },
  { id: "scene_caballo_desbocado", title: "Caballo desbocado", description: "Caballo galopando desbocado a toda velocidad con la crin al viento.", fallbackWord: "caballo", tags: ["fuerza", "libertad", "impulso"], src: BASE + "stimulus_scene_caballo_desbocado.webp" },
  { id: "scene_jaula_abierta", title: "Jaula abierta", description: "Jaula con la puerta abierta de par en par y nadie dentro.", fallbackWord: "jaula", tags: ["libertad", "escape", "encierro"], src: BASE + "stimulus_scene_jaula_abierta.webp" },
  { id: "scene_calavera_coronada", title: "Calavera coronada", description: "Calavera con una corona dorada descansando sobre el hueso.", fallbackWord: "calavera", tags: ["muerte", "poder", "legado"], src: BASE + "stimulus_scene_calavera_coronada.webp" },
  { id: "scene_calma_total", title: "Calma total", description: "Paisaje sereno de aguas quietas bajo un cielo despejado.", fallbackWord: "calma", tags: ["paz", "quietud", "equilibrio"], src: BASE + "stimulus_scene_calma_total.webp" },
  { id: "scene_chile_en_llamas", title: "Chile en llamas", description: "Chile picante rojo envuelto en llamas ardientes.", fallbackWord: "chile", tags: ["fuego", "picante", "furia"], src: BASE + "stimulus_scene_chile_en_llamas.webp" },
  { id: "scene_cicatriz", title: "Cicatriz", description: "Cicatriz marcada cruzando la piel de lado a lado.", fallbackWord: "cicatriz", tags: ["herida", "marca", "pasado"], src: BASE + "stimulus_scene_cicatriz.webp" },
  { id: "scene_puerta_cerrada", title: "Puerta cerrada", description: "Puerta cerrada con un haz de luz filtrándose por debajo.", fallbackWord: "puerta", tags: ["misterio", "límite", "esperanza"], src: BASE + "stimulus_scene_puerta_cerrada.webp" },
  { id: "scene_cordillera_nevada", title: "Cordillera nevada", description: "Cadena de montañas cubiertas de nieve bajo un cielo despejado.", fallbackWord: "cordillera", tags: ["montaña", "frío", "altura"], src: BASE + "stimulus_scene_cordillera_nevada.webp" },
  { id: "scene_corona_dorada", title: "Corona dorada", description: "Corona de oro brillante rematada con joyas.", fallbackWord: "corona", tags: ["poder", "realeza", "triunfo"], src: BASE + "stimulus_scene_corona_dorada.webp" },
  { id: "scene_criatura_de_sombra", title: "Criatura de sombra", description: "Figura oscura hecha de sombra pura, sin rostro definido.", fallbackWord: "sombra", tags: ["oscuridad", "miedo", "misterio"], src: BASE + "stimulus_scene_criatura_de_sombra.webp" },
  { id: "scene_cuervo_posado", title: "Cuervo posado", description: "Cuervo negro posado, observando fijo con mirada afilada.", fallbackWord: "cuervo", tags: ["noche", "presagio", "silencio"], src: BASE + "stimulus_scene_cuervo_posado.webp" },
  { id: "scene_callejon_oscuro", title: "Callejón oscuro", description: "Callejón estrecho y oscuro entre edificios, apenas iluminado.", fallbackWord: "callejón", tags: ["ciudad", "noche", "peligro"], src: BASE + "stimulus_scene_callejon_oscuro.webp" },
  { id: "scene_desierto_atardecer", title: "Desierto al atardecer", description: "Dunas de un desierto extenso teñidas por el sol del atardecer.", fallbackWord: "desierto", tags: ["arena", "soledad", "calor"], src: BASE + "stimulus_scene_desierto_atardecer.webp" },
  { id: "scene_alegria", title: "Alegría", description: "Explosión de color y energía que irradia pura alegría.", fallbackWord: "alegría", tags: ["felicidad", "energía", "color"], src: BASE + "stimulus_scene_alegria.webp" },
];

export const OBJECT_STIMULI = [
  { id: "object_microphone", title: "Micrófono", description: "Micrófono de mano ilustrado.", fallbackWord: "micrófono", tags: ["voz", "escenario"], src: BASE + "stimulus_object_microphone.svg" },
  { id: "object_sneaker", title: "Zapatilla", description: "Zapatilla deportiva ilustrada.", fallbackWord: "zapatilla", tags: ["calle", "paso"], src: BASE + "stimulus_object_sneaker.svg" },
  { id: "object_cassette", title: "Casete", description: "Casete de música ilustrado.", fallbackWord: "casete", tags: ["música", "recuerdo"], src: BASE + "stimulus_object_cassette.svg" },
  { id: "object_vinyl_record", title: "Vinilo", description: "Disco de vinilo ilustrado.", fallbackWord: "vinilo", tags: ["música", "beat"], src: BASE + "stimulus_object_vinyl_record.svg" },
  { id: "object_spray_can", title: "Aerosol", description: "Lata de pintura ilustrada.", fallbackWord: "aerosol", tags: ["arte", "calle"], src: BASE + "stimulus_object_spray_can.svg" },
  { id: "object_chess_knight", title: "Caballo de ajedrez", description: "Caballo de ajedrez ilustrado.", fallbackWord: "caballo", tags: ["estrategia", "juego"], src: BASE + "stimulus_object_chess_knight.svg" },
  { id: "object_camera", title: "Cámara", description: "Cámara fotográfica ilustrada.", fallbackWord: "cámara", tags: ["imagen", "recuerdo"], src: BASE + "stimulus_object_camera.svg" },
  { id: "object_dice", title: "Dado", description: "Dado de juego ilustrado.", fallbackWord: "dado", tags: ["azar", "suerte"], src: BASE + "stimulus_object_dice.svg" },
  { id: "object_key", title: "Llave", description: "Llave metálica ilustrada.", fallbackWord: "llave", tags: ["puerta", "secreto"], src: BASE + "stimulus_object_key.svg" },
  { id: "object_backpack", title: "Mochila", description: "Mochila de viaje ilustrada.", fallbackWord: "mochila", tags: ["viaje", "calle"], src: BASE + "stimulus_object_backpack.svg" },
  { id: "object_alarm_clock", title: "Reloj", description: "Reloj despertador ilustrado.", fallbackWord: "reloj", tags: ["tiempo", "prisa"], src: BASE + "stimulus_object_alarm_clock.svg" },
  { id: "object_bicycle", title: "Bicicleta", description: "Bicicleta ilustrada.", fallbackWord: "bicicleta", tags: ["ruedas", "barrio"], src: BASE + "stimulus_object_bicycle.svg" },
  { id: "object_headphones", title: "Audífonos", description: "Audífonos de estudio ilustrados.", fallbackWord: "audífonos", tags: ["beat", "sonido"], src: BASE + "stimulus_object_headphones.svg" },
  { id: "object_skateboard", title: "Patineta", description: "Patineta ilustrada.", fallbackWord: "patineta", tags: ["calle", "truco"], src: BASE + "stimulus_object_skateboard.svg" },
  { id: "object_turntable", title: "Tocadiscos", description: "Tocadiscos ilustrado.", fallbackWord: "tocadiscos", tags: ["vinilo", "beat"], src: BASE + "stimulus_object_turntable.svg" },
  { id: "object_boombox", title: "Radiocasete", description: "Radiocasete ilustrado.", fallbackWord: "radiocasete", tags: ["música", "calle"], src: BASE + "stimulus_object_boombox.svg" },
  { id: "object_guitar_pick", title: "Púa", description: "Púa de guitarra ilustrada.", fallbackWord: "púa", tags: ["música", "cuerda"], src: BASE + "stimulus_object_guitar_pick.svg" },
  { id: "object_basketball", title: "Balón", description: "Balón de baloncesto ilustrado.", fallbackWord: "balón", tags: ["deporte", "bote"], src: BASE + "stimulus_object_basketball.svg" },
  { id: "object_boxing_glove", title: "Guante de boxeo", description: "Guante de boxeo ilustrado.", fallbackWord: "guante", tags: ["combate", "fuerza"], src: BASE + "stimulus_object_boxing_glove.svg" },
  { id: "object_crown", title: "Corona", description: "Corona dorada ilustrada.", fallbackWord: "corona", tags: ["rey", "poder"], src: BASE + "stimulus_object_crown.svg" },
  { id: "object_notebook", title: "Cuaderno", description: "Cuaderno abierto ilustrado.", fallbackWord: "cuaderno", tags: ["ideas", "letra"], src: BASE + "stimulus_object_notebook.svg" },
  { id: "object_pencil", title: "Lápiz", description: "Lápiz ilustrado.", fallbackWord: "lápiz", tags: ["escritura", "ideas"], src: BASE + "stimulus_object_pencil.svg" },
  { id: "object_lantern", title: "Farol", description: "Farol de mano ilustrado.", fallbackWord: "farol", tags: ["luz", "noche"], src: BASE + "stimulus_object_lantern.svg" },
  { id: "object_compass", title: "Brújula", description: "Brújula ilustrada.", fallbackWord: "brújula", tags: ["viaje", "norte"], src: BASE + "stimulus_object_compass.svg" },
  { id: "object_sunglasses", title: "Gafas de sol", description: "Gafas de sol ilustradas.", fallbackWord: "gafas", tags: ["estilo", "verano"], src: BASE + "stimulus_object_sunglasses.svg" },
  { id: "object_hourglass", title: "Reloj de arena", description: "Reloj de arena ilustrado.", fallbackWord: "reloj", tags: ["tiempo", "espera"], src: BASE + "stimulus_object_hourglass.svg" },
  { id: "object_paint_brush", title: "Pincel", description: "Pincel de pintura ilustrado.", fallbackWord: "pincel", tags: ["arte", "color"], src: BASE + "stimulus_object_paint_brush.svg" },
  { id: "object_ticket", title: "Entrada", description: "Entrada de evento ilustrada.", fallbackWord: "entrada", tags: ["show", "paso"], src: BASE + "stimulus_object_ticket.svg" },
  { id: "object_rocket", title: "Cohete", description: "Cohete ilustrado.", fallbackWord: "cohete", tags: ["espacio", "vuelo"], src: BASE + "stimulus_object_rocket.svg" },
  { id: "object_planet", title: "Planeta", description: "Planeta con anillos ilustrado.", fallbackWord: "planeta", tags: ["espacio", "órbita"], src: BASE + "stimulus_object_planet.svg" },
  { id: "object_drum", title: "Tambor", description: "Tambor ilustrado.", fallbackWord: "tambor", tags: ["ritmo", "música"], src: BASE + "stimulus_object_drum.svg" },
  { id: "object_speaker", title: "Altavoz", description: "Altavoz de música ilustrado.", fallbackWord: "altavoz", tags: ["sonido", "beat"], src: BASE + "stimulus_object_speaker.svg" },
  { id: "object_chain", title: "Cadena", description: "Cadena metálica ilustrada.", fallbackWord: "cadena", tags: ["metal", "unión"], src: BASE + "stimulus_object_chain.svg" },
  { id: "object_padlock", title: "Candado", description: "Candado ilustrado.", fallbackWord: "candado", tags: ["seguridad", "secreto"], src: BASE + "stimulus_object_padlock.svg" },
  { id: "object_map", title: "Mapa", description: "Mapa plegado ilustrado.", fallbackWord: "mapa", tags: ["viaje", "ruta"], src: BASE + "stimulus_object_map.svg" },
  { id: "object_anchor", title: "Ancla", description: "Ancla marina ilustrada.", fallbackWord: "ancla", tags: ["mar", "peso"], src: BASE + "stimulus_object_anchor.svg" },
  { id: "object_traffic_cone", title: "Cono", description: "Cono de tráfico ilustrado.", fallbackWord: "cono", tags: ["calle", "señal"], src: BASE + "stimulus_object_traffic_cone.svg" },
  { id: "object_coffee_cup", title: "Taza", description: "Taza de café ilustrada.", fallbackWord: "taza", tags: ["pausa", "calor"], src: BASE + "stimulus_object_coffee_cup.svg" },
  { id: "object_playing_card", title: "Carta", description: "Carta de juego ilustrada.", fallbackWord: "carta", tags: ["azar", "juego"], src: BASE + "stimulus_object_playing_card.svg" },
  { id: "object_trophy", title: "Trofeo", description: "Trofeo ilustrado.", fallbackWord: "trofeo", tags: ["meta", "triunfo"], src: BASE + "stimulus_object_trophy.svg" },
  { id: "object_umbrella", title: "Paraguas", description: "Paraguas ilustrado.", fallbackWord: "paraguas", tags: ["lluvia", "calle"], src: BASE + "stimulus_object_umbrella.svg" },
  { id: "object_flashlight", title: "Linterna", description: "Linterna ilustrada.", fallbackWord: "linterna", tags: ["luz", "búsqueda"], src: BASE + "stimulus_object_flashlight.svg" },
  { id: "object_game_controller", title: "Mando", description: "Mando de juego ilustrado.", fallbackWord: "mando", tags: ["juego", "control"], src: BASE + "stimulus_object_game_controller.svg" },
  { id: "object_saxophone", title: "Saxofón", description: "Saxofón ilustrado.", fallbackWord: "saxofón", tags: ["música", "bronce"], src: BASE + "stimulus_object_saxophone.svg" },
  { id: "object_robot", title: "Robot", description: "Robot amistoso ilustrado.", fallbackWord: "robot", tags: ["futuro", "máquina"], src: BASE + "stimulus_object_robot.svg" },
  { id: "object_crystal", title: "Cristal", description: "Cristal brillante ilustrado.", fallbackWord: "cristal", tags: ["luz", "magia"], src: BASE + "stimulus_object_crystal.svg" },
  { id: "object_kite", title: "Cometa", description: "Cometa voladora ilustrada.", fallbackWord: "cometa", tags: ["aire", "vuelo"], src: BASE + "stimulus_object_kite.svg" },
  { id: "object_wrench", title: "Llave inglesa", description: "Llave inglesa ilustrada.", fallbackWord: "llave", tags: ["herramienta", "metal"], src: BASE + "stimulus_object_wrench.svg" },
];

/** One scene per round, cycling through the catalogue. */
export function imageStimulusForRound(roundIndex) {
  if (IMAGE_STIMULI.length === 0) return null;
  if (roundIndex < 0) return null;
  return IMAGE_STIMULI[roundIndex % IMAGE_STIMULI.length];
}

export const OBJECTS_PER_ROUND = 3;

/** Three objects per round, walking the catalogue in fixed steps. */
export function objectSetForRound(roundIndex) {
  if (OBJECT_STIMULI.length === 0) return [];
  const start = (Math.max(0, roundIndex) * OBJECTS_PER_ROUND) % OBJECT_STIMULI.length;
  return Array.from({ length: OBJECTS_PER_ROUND }, (_, i) =>
    OBJECT_STIMULI[(start + i) % OBJECT_STIMULI.length]);
}
