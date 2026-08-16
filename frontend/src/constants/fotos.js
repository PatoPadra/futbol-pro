/**
 * Catalogo de fotos.
 *
 * Todas de Pexels (licencia gratuita, uso comercial, sin atribucion
 * obligatoria), self-hosteadas en `public/fotos/<id>.jpg` a 1280px de ancho.
 * Guardamos el credito igual, para poder auditar de donde salio cada una.
 *
 * El criterio de seleccion no fue estetico sino de identificacion: que
 * cualquiera que entre se reconozca. Por eso hay barro, potrero, cemento,
 * los Andes de Jujuy, canchas de barrio sudamericanas, femenino y partidos
 * de noche. Quedaron AFUERA a proposito las canchas identificables por club
 * (Bombonera, Monumental, Libertadores de America): una cancha con escudo
 * hace que la mitad de los usuarios se sienta ajena.
 *
 * Los videos viven aparte, en `media.js`.
 */

const BASE = process.env.REACT_APP_FOTOS_BASE || '/fotos';

/**
 * `forma` sale del alto/ancho real del archivo y NO es decorativa:
 *   'ancha'    (ratio >= 1.35) sirve de banda de encabezado
 *   'cuadrada' (1.0 a 1.35)    sirve de tarjeta o bloque
 *   'alta'     (ratio < 1)     sirve de panel lateral o tarjeta vertical
 * Estirar una 'alta' en una banda ancha la recorta a una tira sin sentido.
 */
const RAW = [
  // --- andes ---
  { id: 36414022, contexto: 'andes', forma: 'cuadrada', ratio: 1.33, alt: 'Canchas en el desierto de altura de Olaroz Chico, Jujuy, aérea' },
  { id: 36414021, contexto: 'andes', forma: 'alta', ratio: 0.75, alt: 'Amigos jugando en una cancha de Olaroz Chico, Jujuy, con los cerros atrás' },
  { id: 36414019, contexto: 'andes', forma: 'alta', ratio: 0.75, alt: 'Cancha en Olaroz Chico, Jujuy, entre montañas' },
  { id: 36414020, contexto: 'andes', forma: 'alta', ratio: 0.75, alt: 'Cancha de pasto contra el paisaje de montaña de Jujuy' },
  { id: 24205283, contexto: 'andes', forma: 'alta', ratio: 0.75, alt: 'Hinchada en un partido en Jujuy, cielo limpio' },
  // --- argentina ---
  { id: 1392732, contexto: 'argentina', forma: 'ancha', ratio: 1.5, alt: 'Dos pibes jugando contra un mural en San Nicolás, Buenos Aires' },
  { id: 31564496, contexto: 'argentina', forma: 'ancha', ratio: 1.5, alt: 'Cancha rústica en Córdoba al amanecer, blanco y negro' },
  { id: 13241581, contexto: 'argentina', forma: 'ancha', ratio: 1.5, alt: 'Partido en Mendoza, día de sol' },
  { id: 9410605, contexto: 'argentina', forma: 'cuadrada', ratio: 1.33, alt: 'Cancha vacía en Buenos Aires, drone con luces y sombras' },
  { id: 38197493, contexto: 'argentina', forma: 'cuadrada', ratio: 1.0, alt: 'Dos adolescentes jugando un partido en Buenos Aires' },
  { id: 27299639, contexto: 'argentina', forma: 'alta', ratio: 0.75, alt: 'Chicos jugando un partido contra un fondo de grafitis en Buenos Aires' },
  // --- sudtierra ---
  { id: 17291206, contexto: 'sudtierra', forma: 'ancha', ratio: 1.78, alt: 'Cancha rodeada de casas en Vila Planalto, Brasil, drone' },
  { id: 13596311, contexto: 'sudtierra', forma: 'ancha', ratio: 1.5, alt: 'Chico jugando en una cancha rodeada de casas en Bogotá, blanco y negro' },
  { id: 32879589, contexto: 'sudtierra', forma: 'ancha', ratio: 1.5, alt: 'Chicos jugando en un barrio de Río de Janeiro' },
  { id: 15293580, contexto: 'sudtierra', forma: 'ancha', ratio: 1.5, alt: 'Adolescentes jugando en un parque de Medellín' },
  { id: 12954195, contexto: 'sudtierra', forma: 'ancha', ratio: 1.5, alt: 'Partido juvenil en un barrio de Venezuela, aérea' },
  { id: 29251743, contexto: 'sudtierra', forma: 'alta', ratio: 0.77, alt: 'Cancha rústica en Ceará, Brasil, entre árboles' },
  { id: 25526177, contexto: 'sudtierra', forma: 'alta', ratio: 0.67, alt: 'Siluetas jugando al atardecer en cancha urbana' },
  { id: 32812738, contexto: 'sudtierra', forma: 'alta', ratio: 0.67, alt: 'Pelota sobre adoquines con siluetas de fondo' },
  { id: 18686482, contexto: 'sudtierra', forma: 'alta', ratio: 0.67, alt: 'Partido en una cancha de arena en Paudalho, Brasil' },
  { id: 30113641, contexto: 'sudtierra', forma: 'alta', ratio: 0.67, alt: 'Cancha rodeada de casas de colores en Cundinamarca, Colombia, aérea' },
  { id: 26424121, contexto: 'sudtierra', forma: 'alta', ratio: 0.67, alt: 'Jugador en acción en Paraguay, blanco y negro dramático' },
  // --- sudmontania ---
  { id: 17044943, contexto: 'sudmontania', forma: 'ancha', ratio: 1.5, alt: 'Cancha con jugadores en Nuevo Chimbote, Perú, contra la montaña' },
  { id: 15335175, contexto: 'sudmontania', forma: 'ancha', ratio: 1.5, alt: 'Chicos jugando con un pueblo y montañas nevadas de fondo' },
  { id: 32101183, contexto: 'sudmontania', forma: 'ancha', ratio: 1.5, alt: 'Equipo entrenando con las montañas atrás' },
  { id: 18372782, contexto: 'sudmontania', forma: 'alta', ratio: 0.67, alt: 'Cancha rural contra una cordillera con neblina, vista de pueblo' },
  // --- barro ---
  { id: 30754774, contexto: 'barro', forma: 'ancha', ratio: 1.65, alt: 'Dos jugadores disputando la pelota en una cancha de barro' },
  { id: 12828798, contexto: 'barro', forma: 'ancha', ratio: 1.5, alt: 'Equipo amateur entrenando en cancha de barro' },
  { id: 10667337, contexto: 'barro', forma: 'ancha', ratio: 1.5, alt: 'Partido en Neira, Colombia, bajo la lluvia' },
  { id: 17512216, contexto: 'barro', forma: 'alta', ratio: 0.8, alt: 'Dos tipos jugando en cancha de barro, Tanzania' },
  { id: 10667339, contexto: 'barro', forma: 'alta', ratio: 0.66, alt: 'Pibes disputando la pelota en una cancha de barro en Neira, Colombia' },
  { id: 10667409, contexto: 'barro', forma: 'alta', ratio: 0.63, alt: 'Partido a pura garra sobre el barro' },
  // --- cemento ---
  { id: 38416333, contexto: 'cemento', forma: 'cuadrada', ratio: 1.33, alt: 'Chicos jugando abajo de un puente, blanco y negro' },
  { id: 36914533, contexto: 'cemento', forma: 'cuadrada', ratio: 1.33, alt: 'Adolescentes jugando en cancha al aire libre en la ciudad' },
  { id: 8838868, contexto: 'cemento', forma: 'cuadrada', ratio: 1.33, alt: 'Cancha de cemento azul con jugadores, aérea' },
  { id: 11155146, contexto: 'cemento', forma: 'alta', ratio: 0.67, alt: 'Cuatro pibes jugando en cancha de cemento en la ciudad' },
  // --- nocturno ---
  { id: 186239, contexto: 'nocturno', forma: 'ancha', ratio: 1.78, alt: 'Cancha de noche con jugadores bajo las luces' },
  { id: 1646735, contexto: 'nocturno', forma: 'ancha', ratio: 1.5, alt: 'Cancha con luces al anochecer, entrenando' },
  { id: 32761357, contexto: 'nocturno', forma: 'cuadrada', ratio: 1.33, alt: 'Cancha iluminada de noche desde arriba' },
  { id: 16826135, contexto: 'nocturno', forma: 'alta', ratio: 0.67, alt: 'Pelota junto al arco bajo los reflectores' },
  // --- femenino ---
  { id: 36784173, contexto: 'femenino', forma: 'ancha', ratio: 1.5, alt: 'Jugadoras compitiendo intensamente' },
  { id: 32366610, contexto: 'femenino', forma: 'ancha', ratio: 1.5, alt: 'Partido de fútbol femenino en Chile, día de sol' },
  { id: 15914785, contexto: 'femenino', forma: 'ancha', ratio: 1.4, alt: 'Dos jugadoras en un partido al aire libre' },
  { id: 32707824, contexto: 'femenino', forma: 'alta', ratio: 0.71, alt: 'Jugadoras disputando un partido en Chile' },
  // --- equipo ---
  { id: 32179187, contexto: 'equipo', forma: 'ancha', ratio: 1.78, alt: 'Equipo festejando la victoria' },
  { id: 32424863, contexto: 'equipo', forma: 'ancha', ratio: 1.5, alt: 'Equipo amateur haciendo la ronda antes de salir' },
  { id: 37313578, contexto: 'equipo', forma: 'ancha', ratio: 1.5, alt: 'Ronda del equipo bajo las luces, de noche' },
  { id: 33613894, contexto: 'equipo', forma: 'alta', ratio: 0.8, alt: 'Jugadores abrazados festejando después del partido' },
  // --- chicos ---
  { id: 13517352, contexto: 'chicos', forma: 'ancha', ratio: 1.61, alt: 'Chicos jugando en la calle, blanco y negro' },
  { id: 14059349, contexto: 'chicos', forma: 'ancha', ratio: 1.5, alt: 'Pibes jugando sobre adoquines, blanco y negro' },
  { id: 36315147, contexto: 'chicos', forma: 'alta', ratio: 0.67, alt: 'Dos chicos jugando en una calle arbolada' },
  // --- detalle ---
  { id: 32962876, contexto: 'detalle', forma: 'alta', ratio: 0.76, alt: 'Botines sobre el pasto en un entrenamiento' },
  { id: 13422994, contexto: 'detalle', forma: 'alta', ratio: 0.56, alt: 'Pie sobre la pelota en pasto verde' },
];

export const CONTEXTO_LABELS = {
  andes: 'Andes',
  argentina: 'Argentina',
  sudtierra: 'Potrero',
  sudmontania: 'Montania',
  barro: 'Barro',
  cemento: 'Cemento',
  nocturno: 'De noche',
  femenino: 'Femenino',
  equipo: 'Equipo',
  chicos: 'En la calle',
  detalle: 'Detalle',
};

export const FOTOS = RAW.map((f) => ({
  ...f,
  key: String(f.id),
  src: `${BASE}/${f.id}.jpg`,
  credito: 'Pexels — licencia gratuita',
}));

const POR_ID = new Map(FOTOS.map((f) => [f.key, f]));

/** Una foto por id. undefined si no existe: el llamador decide que hacer. */
export function getFoto(id) {
  return POR_ID.get(String(id));
}

/**
 * Filtra el catalogo. pickFotos({ contexto: 'barro' }), pickFotos({ forma: 'ancha' }),
 * pickFotos({ ids: [1392732, 31564496] }) para traer puntuales en orden.
 */
export function pickFotos({ contexto, forma: f, ids } = {}) {
  if (ids) return ids.map((id) => POR_ID.get(String(id))).filter(Boolean);
  return FOTOS.filter((x) => (!contexto || x.contexto === contexto) && (!f || x.forma === f));
}

/**
 * Encabezado de cada pagina. Curado a mano y una foto por pagina, sin repetir:
 * si cada pantalla elige por su cuenta, tres terminan con la misma imagen y la
 * app se siente pobre. Todas son 'ancha' porque van en una banda horizontal.
 */
const ENCABEZADOS = {
  // Lista de partidos: aerea de canchas entre casas, se lee como 'muchas fechas'
  'partidos': 17291206,
  // Un partido concreto, de dia
  'partido': 13241581,
  // Cancha vacia al amanecer: esta por llenarse
  'crear-partido': 31564496,
  // Aerea de un partido: la mirada tactica, como el dibujo de la cancha
  'equipos': 12954195,
  // Bajo la lluvia: lo que queda despues de jugar
  'post-partido': 10667337,
  // La jugada en disputa, que es lo que se vota
  'estadisticas': 30754774,
  // Jugadora en pleno partido: el perfil no tiene genero
  'perfil': 36784173,
  // Cancha de noche: las fechas acumuladas
  'historial': 186239,
  // La ronda antes de salir: te estas sumando al equipo
  'completar-perfil': 32424863,
  // El festejo del equipo: un grupo es esto
  'grupo': 32179187,
  // Ronda bajo las luces: se esta armando el grupo
  'crear-grupo': 37313578,
  // Chicos en la calle: sumar a alguien que todavia no esta
  'invitar': 13517352,
  // Cancha con luces al anochecer: el turno que hay que coordinar
  'organizador': 1646735,
  // Entrenamiento con montanias: calmo, el panel no tiene que gritar
  'admin': 32101183,
  // Pibes contra un mural porteno: la bienvenida
  'verificar': 1392732,
};

/** Foto de encabezado de una pagina. Devuelve undefined si el slug no existe. */
export function fotoDePagina(slug) {
  return getFoto(ENCABEZADOS[slug]);
}

export const SLUGS_DE_PAGINA = Object.keys(ENCABEZADOS);

/** Verticales fuertes, para paneles laterales y tarjetas altas. */
export const DESTACADAS_ALTAS = pickFotos({ ids: [36414021, 36414019, 36414020, 27299639, 26424121, 30113641, 25526177, 18372782] });

/**
 * Para estados vacios: canchas sin nadie o con poca gente. Un festejo multitudinario
 * detras de un 'todavia no hay partidos' se contradice solo.
 */
export const FOTOS_VACIO = pickFotos({ ids: [31564496, 16826135, 32812738, 13422994, 32962876, 9410605] });
