/**
 * Catálogo de video de fondo.
 *
 * Todos los clips son de Mixkit (Envato): licencia gratuita, uso comercial
 * permitido y sin atribución obligatoria. Guardamos igual el crédito en cada
 * entrada porque cuesta nada y nos deja auditar de dónde salió cada archivo.
 *
 * Cada id fue verificado contra el CDN (HTTP 206 en 720p, 360p y poster) antes
 * de entrar acá. Si alguno empieza a fallar, el reproductor se queda en el
 * poster en lugar de romper la pantalla — ver VideoBackground.
 *
 * SELF-HOSTED: los archivos viven en `frontend/public/videos/` como
 * `<id>-720.mp4`, `<id>-360.mp4` y `<id>-poster.jpg`. No dependemos del CDN
 * de Mixkit en runtime. Para regenerarlos o agregar un clip nuevo, el patrón de
 * origen es `https://assets.mixkit.co/videos/<id>/<id>-720.mp4` (y
 * `<id>-thumb-720-0.jpg` para el poster).
 */

// Servimos los archivos desde nuestro propio dominio (public/videos/). El
// default va en el código y no en una variable de entorno a propósito: `.env`
// está en .gitignore, así que un REACT_APP_* no sobreviviría al deploy.
// La variable queda como override para mover los archivos a un bucket o CDN
// más adelante — quien la use tiene que servir los mismos nombres planos.
const MEDIA_BASE = process.env.REACT_APP_MEDIA_BASE || '/videos';

/**
 * URL del mp4 para una calidad ('720' | '360').
 *
 * Estan las dos a proposito: en un hero a pantalla completa el 360p (640x360)
 * se escala 2x o mas en cualquier monitor y se ve blando, pero mandarle 720p a
 * un celular son ~6 MB para tapar una pantalla de 375px. VideoBackground elige
 * segun el viewport.
 *
 * 720p es el techo: Mixkit tiene 1080p y 4K, pero el 1080 de un clip de 23s
 * pesa 76 MB — mas de 400 MB para los ocho, impracticable en un repo.
 */
function videoUrl(id, quality) {
  return `${MEDIA_BASE}/${id}-${quality}.mp4`;
}

/** Devuelve la URL del frame de poster (lo que se ve antes de que cargue el video). */
function posterUrl(id) {
  return `${MEDIA_BASE}/${id}-poster.jpg`;
}

/**
 * De los 19 clips del catálogo, sólo estos 8 tienen los mp4 bajados: son los
 * únicos que alguna pantalla reproduce. Los otros 11 existen sólo como poster
 * (el carrusel usa 12 como imagen fija, y varias secciones usan el poster sin
 * video), así que bajar sus videos era cargar ~35 MB al repo para nada.
 *
 * Si mañana ponés un clip sin video en un hero, VideoBackground lo detecta por
 * esta marca y se queda en el poster en vez de pedir un archivo que no existe.
 */
const IDS_CON_VIDEO = new Set([767, 4567, 41372, 42531, 42537, 42540, 43499, 44602]);

/**
 * `nivel`: 'profesional' | 'amateur'  — cómo se ve el partido, no la liga real.
 * `genero`: 'masculino' | 'femenino' | 'mixto'
 * `alt`: descripción para lectores de pantalla y para el atributo title.
 * `focus`: object-position, para que la acción no quede tapada por el texto.
 * `dur`: duración real en segundos, medida contra el CDN. Importa: un clip de
 *   3 segundos en un hero que rota cada 8 se reinicia dos veces y se ve a
 *   saltos. Para fondos que se ven mucho tiempo, usá clips de 8s o más.
 */
const RAW_CLIPS = [
  // — Profesional / masculino —
  { id: 43485, nivel: 'profesional', genero: 'masculino', alt: 'Jugada en un partido semiprofesional de fútbol 11', dur: 6.7, focus: '50% 45%' },
  { id: 43499, nivel: 'profesional', genero: 'masculino', alt: 'Jugada de gol en un partido semiprofesional', dur: 8.1, focus: '50% 40%' },
  { id: 43481, nivel: 'profesional', genero: 'masculino', alt: 'Disputa entre dos equipos en un partido de fútbol', dur: 5.2, focus: '50% 45%' },
  { id: 43483, nivel: 'profesional', genero: 'masculino', alt: 'Mano a mano entre delantero y defensor', dur: 5.0, focus: '50% 50%' },
  { id: 43484, nivel: 'profesional', genero: 'masculino', alt: 'Jugador gambeteando en un uno contra uno', dur: 3.5, focus: '50% 45%' },
  { id: 43494, nivel: 'profesional', genero: 'masculino', alt: 'Primer plano de un jugador pateando un penal', dur: 5.7, focus: '50% 50%' },
  { id: 43495, nivel: 'profesional', genero: 'masculino', alt: 'Penal visto desde detrás de la red del arco', dur: 7.2, focus: '50% 45%' },
  { id: 43492, nivel: 'profesional', genero: 'masculino', alt: 'Jugador acomodando la pelota para patear un penal', dur: 7.0, focus: '50% 55%' },
  { id: 42546, nivel: 'profesional', genero: 'masculino', alt: 'Jugador saltando durante un entrenamiento', dur: 6.0, focus: '50% 40%' },

  // — Femenino —
  { id: 42537, nivel: 'amateur', genero: 'femenino', alt: 'Jugadora haciendo jueguitos con la pelota en una cancha de futsal', dur: 16.0, focus: '50% 50%' },
  { id: 42531, nivel: 'amateur', genero: 'femenino', alt: 'Jugadora haciendo freestyle con la pelota en la calle', dur: 17.1, focus: '50% 45%' },
  { id: 42540, nivel: 'amateur', genero: 'femenino', alt: 'Jugadora dominando la pelota con pie y cabeza en una cancha urbana', dur: 18.0, focus: '50% 45%' },

  // — Amateur / mixto —
  { id: 41372, nivel: 'amateur', genero: 'mixto', alt: 'Partido de fútbol en cancha de césped visto desde arriba', dur: 23.3, focus: '50% 50%' },
  { id: 44602, nivel: 'amateur', genero: 'mixto', alt: 'Grupo de amigos de distintos países festejando un gol', dur: 12.2, focus: '50% 40%' },
  { id: 43479, nivel: 'amateur', genero: 'mixto', alt: 'Manos de un equipo juntas antes de arrancar el partido', dur: 3.1, focus: '50% 50%' },
  { id: 44601, nivel: 'amateur', genero: 'mixto', alt: 'Amigos mirando un partido juntos', dur: 21.5, focus: '50% 40%' },
  { id: 767, nivel: 'amateur', genero: 'masculino', alt: 'Tres jugadores jugando al fútbol en una cancha de cemento', dur: 10.1, focus: '50% 50%' },
  { id: 4567, nivel: 'amateur', genero: 'masculino', alt: 'Jugadores llegando a la cancha para jugar el partido', dur: 30.0, focus: '50% 45%' },
  { id: 4262, nivel: 'profesional', genero: 'mixto', alt: 'Vista aérea de un estadio de fútbol', dur: 7.6, focus: '50% 50%' },
];

/** Etiqueta que mostramos en los chips del carrusel. */
export const NIVEL_LABELS = {
  profesional: 'Profesional',
  amateur: 'Amateur',
};

export const GENERO_LABELS = {
  masculino: 'Masculino',
  femenino: 'Femenino',
  mixto: 'Mixto',
};

/** Catálogo completo, ya con URLs resueltas. */
export const CLIPS = RAW_CLIPS.map((c) => ({
  ...c,
  key: String(c.id),
  tieneVideo: IDS_CON_VIDEO.has(c.id),
  src720: videoUrl(c.id, '720'),
  src360: videoUrl(c.id, '360'),
  poster: posterUrl(c.id),
  credito: 'Mixkit — licencia gratuita',
}));

/** Índice por id, para pedir un clip puntual sin recorrer el array. */
const BY_ID = new Map(CLIPS.map((c) => [c.key, c]));

/** Un clip por id. Devuelve undefined si no existe (el llamador decide). */
export function getClip(id) {
  return BY_ID.get(String(id));
}

/**
 * Filtra el catálogo. Sin argumentos devuelve todo.
 * pickClips({ genero: 'femenino' }) / pickClips({ nivel: 'profesional' })
 */
export function pickClips({ nivel, genero, ids } = {}) {
  if (ids) return ids.map((id) => BY_ID.get(String(id))).filter(Boolean);
  return CLIPS.filter(
    (c) => (!nivel || c.nivel === nivel) && (!genero || c.genero === genero),
  );
}

/**
 * Los clips del hero. Tres criterios, en este orden:
 *  1. Duración >= 8s: el hero rota cada 8s y un clip más corto se reinicia a la
 *     vista. Esto descarta varios clips buenos (43485 a 6.7s, 43479 a 3.1s).
 *  2. Género alternado: dos mixtos, dos femeninos, dos masculinos. Es lo primero
 *     que ve alguien que entra, y el pedido de cubrir los tres es explícito.
 *  3. Acción centrada, para que el scrim y el título no la tapen.
 */
// El orden es por PESO, no estetico: el hero monta el clip activo y precarga el
// siguiente, asi que los dos primeros definen la carga inicial de la landing.
// Antes abria con 41372 (7.8 MB, el mas pesado del set) y el primer paint eran
// 11 MB. Asi arranca en 7.6 MB y encima la rotacion de genero queda perfecta:
// masculino, mixto, femenino, masculino, mixto, femenino.
//   43499  3.2 MB  masculino profesional
//   44602  4.4 MB  mixto
//   42537  5.7 MB  femenino
//   767    2.8 MB  masculino amateur
//   41372  7.8 MB  mixto
//   42531  6.3 MB  femenino
export const HERO_CLIPS = pickClips({ ids: [43499, 44602, 42537, 767, 41372, 42531] });

/**
 * Mezcla para el carrusel "así se ve": una de cada cosa, en orden intercalado
 * para que ninguna categoría quede toda junta.
 */
export const SHOWCASE_CLIPS = pickClips({
  ids: [43481, 42540, 44602, 43494, 42531, 767, 43495, 42537, 4567, 43484, 41372, 43479],
});

/**
 * Fondos secundarios que quedan detrás de contenido mucho tiempo (banner del
 * dashboard, secciones oscuras). Acá la duración manda más que en el hero:
 * son los cuatro clips más largos del catálogo, todos de 18s para arriba.
 */
export const AMBIENT_CLIPS = pickClips({ ids: [4567, 41372, 44601, 42540] });
