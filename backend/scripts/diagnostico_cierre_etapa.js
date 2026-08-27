/**
 * Diagnóstico de cierre de etapa — SOLO LECTURA.
 *
 * Cómo correrlo:
 *
 *     mongosh "<MONGO_URL>/<DB_NAME>" --file backend/scripts/diagnostico_cierre_etapa.js
 *
 * No escribe nada: son find/aggregate/count. Se puede correr contra producción
 * sin backup previo y sin ventana de mantenimiento.
 *
 * Para qué: la auditoría encontró bugs que corrompen datos en silencio. Este
 * script mide CUÁNTO daño hay antes de tocar una línea de código. Las fases de
 * reparación tienen condiciones de entrada que se leen de acá — sobre todo la
 * de índices únicos, que falla si quedan duplicados, y falla en silencio porque
 * ensure_indexes está envuelto en try/except.
 *
 * Cada bloque imprime un veredicto OK / REVISAR. Guardá la salida: es la línea
 * de base contra la que se verifica cada fase.
 */

const R = { ok: 0, revisar: 0 };

function titulo(n, texto) {
  print("");
  print("=".repeat(72));
  print(`Q${n}  ${texto}`);
  print("=".repeat(72));
}

function veredicto(bien, mensajeOk, mensajeMal) {
  if (bien) {
    R.ok++;
    print(`  ✔ OK — ${mensajeOk}`);
  } else {
    R.revisar++;
    print(`  ✘ REVISAR — ${mensajeMal}`);
  }
}

function muestra(arr, n) {
  const lim = n || 5;
  if (!arr.length) return;
  print(`  Muestra (hasta ${lim}):`);
  arr.slice(0, lim).forEach((x) => print("    " + JSON.stringify(x)));
  if (arr.length > lim) print(`    … y ${arr.length - lim} más`);
}

print("");
print("DIAGNÓSTICO DE CIERRE DE ETAPA — futbol-pro");
print("Base: " + db.getName() + "   ·   " + new Date().toISOString());

/* ------------------------------------------------------------------ *
 * BLOQUE A — El player_score congelado
 *
 * El diseño de match_outcomes evita evaluar un resultado con el rating que
 * ese mismo resultado ya modificó: por eso el puntaje se congela al armar los
 * equipos. Pero _enrich_assignments lo recalcula en vivo cuando falta, y
 * adjust_teams persiste lo que devuelve el cliente. Estas tres consultas dicen
 * si eso ya ensució datos.
 * ------------------------------------------------------------------ */

titulo(1, "Generaciones de equipos con player_score nulo o ausente");
{
  const filas = db.team_generations
    .aggregate([
      {
        $project: {
          _id: 0,
          match_id: 1,
          total: { $size: "$assignments" },
          sin: {
            $size: {
              $filter: {
                input: "$assignments",
                as: "a",
                cond: { $not: [{ $isNumber: "$$a.player_score" }] },
              },
            },
          },
        },
      },
      { $match: { sin: { $gt: 0 } } },
      {
        $group: {
          _id: { todos: { $eq: ["$sin", "$total"] } },
          n: { $sum: 1 },
          ejemplos: { $push: "$match_id" },
        },
      },
    ])
    .toArray();

  const total = filas.reduce((acc, f) => acc + f.n, 0);
  print(`  Generaciones con algún score faltante: ${total}`);
  filas.forEach((f) => {
    const etiqueta = f._id.todos
      ? "TODOS los jugadores sin score (equipos enteros al prior neutro)"
      : "algunos sin score (corrupción parcial: tuerce la fuerza de un solo lado)";
    print(`    · ${f.n} — ${etiqueta}`);
    muestra(f.ejemplos, 3);
  });
  veredicto(
    total === 0,
    "todas las generaciones tienen el puntaje congelado",
    `${total} generaciones dependen del recálculo en vivo. Son las que se corrompen al tocar los equipos.`
  );
}

titulo(2, "Generaciones con todos los player_score idénticos (síntoma del fallback)");
{
  const filas = db.team_generations
    .aggregate([
      {
        $project: {
          _id: 0,
          match_id: 1,
          n: { $size: "$assignments" },
          distintos: { $size: { $setUnion: "$assignments.player_score" } },
        },
      },
      { $match: { distintos: { $lte: 1 }, n: { $gt: 1 } } },
    ])
    .toArray();

  print(`  Generaciones sospechosas: ${filas.length}`);
  muestra(filas);
  veredicto(
    filas.length === 0,
    "ninguna generación tiene los puntajes aplastados a un solo valor",
    `${filas.length} generaciones tienen un único valor para todo el plantel: su expected_home es un 0.5 fabricado.`
  );
}

titulo(3, "Efecto en match_outcomes: expected clavado en 0.5");
{
  // Un partido genuinamente parejo da 0.4987 o 0.5031, nunca 0.5000 exacto:
  // _fuerza promedia floats distintos. El 0.5 clavado sólo sale de que ambos
  // promedios sean idénticos, y la única forma sistemática es el prior neutro.
  const exactos = db.match_outcomes.countDocuments({ expected: 0.5 });
  const partidos = db.matches.countDocuments({ "result.expected_home": 0.5 });
  print(`  Filas de match_outcomes con expected == 0.5 exacto: ${exactos}`);
  print(`  Partidos con result.expected_home == 0.5 exacto:    ${partidos}`);
  veredicto(
    exactos === 0 && partidos === 0,
    "ningún puntaje se calculó sobre una expectativa fabricada",
    `hay puntaje repartido con expected 0.5. En un 1-0 eso da 7.30 al ganador y 2.70 al perdedor: el sistema declaró "sorpresa" en partidos que no lo fueron.`
  );
}

titulo(4, "Generaciones que pasaron por el cliente (marcador forense: player_age)");
{
  // team_balancer.py NUNCA escribe player_age. Sólo lo agrega _enrich_assignments,
  // que corre al responder el GET. Un assignment guardado que lo tenga volvió sí
  // o sí por el round-trip del cliente, o sea que pasó por adjust_teams.
  const tocados = db.team_generations.distinct("match_id", {
    "assignments.player_age": { $exists: true },
  });
  print(`  Generaciones que volvieron por el cliente: ${tocados.length}`);

  const outcomes = tocados.length
    ? db.match_outcomes.countDocuments({ match_id: { $in: tocados } })
    : 0;
  const conResultado = tocados.length
    ? db.matches.countDocuments({ id: { $in: tocados }, "result.expected_home": { $ne: null } })
    : 0;

  print(`  De esos, con puntaje ya repartido (match_outcomes): ${outcomes}`);
  print(`  De esos, con resultado cargado:                     ${conResultado}`);
  print("  Nota: el marcador es de una sola dirección. Captura todo lo que pasó por");
  print("  adjust_teams, pero un cliente que mande player_age: null también queda");
  print("  marcado. Preferible ese falso positivo que un falso negativo.");
  veredicto(
    outcomes === 0,
    "ningún puntaje se calculó sobre equipos que pasaron por el cliente",
    `${outcomes} filas de puntaje salieron de partidos ajustados a mano: su expectativa puede estar contaminada.`
  );
}

/* ------------------------------------------------------------------ *
 * BLOQUE B — Duplicados que bloquean los índices únicos
 *
 * PRECONDICIÓN DURA de la fase de blindaje: las cuatro tienen que dar cero
 * antes de crear un índice unique. Si no, la creación falla — y falla callada,
 * porque ensure_indexes está en try/except: la app levanta igual y alguien va
 * a creer que la garantía existe.
 * ------------------------------------------------------------------ */

titulo(5, "Perfiles con el mismo user_id (bloquea unique en player_profiles)");
{
  const filas = db.player_profiles
    .aggregate([
      { $match: { user_id: { $type: "string" } } },
      { $group: { _id: "$user_id", n: { $sum: 1 }, ids: { $push: "$id" } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  print(`  Usuarios con más de un perfil: ${filas.length}`);
  muestra(filas);
  veredicto(
    filas.length === 0,
    "cada usuario tiene un solo perfil",
    `${filas.length} usuarios tienen el historial partido al medio: find_one devuelve uno arbitrario.`
  );
}

titulo(6, "Dobles inscripciones activas al mismo partido");
{
  const filas = db.match_registrations
    .aggregate([
      { $match: { status: { $ne: "baja" } } },
      {
        $group: {
          _id: { match_id: "$match_id", player_id: "$player_id" },
          n: { $sum: 1 },
          ids: { $push: "$id" },
        },
      },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  print(`  Pares (partido, jugador) duplicados: ${filas.length}`);
  muestra(filas);
  veredicto(
    filas.length === 0,
    "nadie está anotado dos veces al mismo partido",
    `${filas.length} casos: ese jugador se cuenta doble en el cupo, aparece dos veces en el balanceador y suma dos partidos jugados.`
  );
}

titulo(7, "Dobles membresías al mismo grupo");
{
  // Sin filtrar por status a propósito: add_group_member reusa el doc existente,
  // así que el índice único va sobre (group_id, player_id) sin importar el estado.
  const filas = db.group_members
    .aggregate([
      {
        $group: {
          _id: { group_id: "$group_id", player_id: "$player_id" },
          n: { $sum: 1 },
          estados: { $push: "$status" },
          ids: { $push: "$id" },
        },
      },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  print(`  Pares (grupo, jugador) duplicados: ${filas.length}`);
  muestra(filas);
  veredicto(filas.length === 0, "una membresía por persona por grupo", `${filas.length} casos bloquean el índice único.`);
}

titulo(8, "Invitados distintos compartiendo email");
{
  const filas = db.player_profiles
    .aggregate([
      { $match: { player_type: "invitado", user_id: null, email: { $ne: null } } },
      { $group: { _id: "$email", n: { $sum: 1 }, ids: { $push: "$id" } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  print(`  Emails con más de un invitado: ${filas.length}`);
  muestra(filas);
  veredicto(
    filas.length === 0,
    "ningún email tiene dos invitados",
    `${filas.length} personas van a recuperar sólo una mitad de su historial al registrarse, y en silencio.`
  );
}

/* ------------------------------------------------------------------ *
 * BLOQUE C — Estados imposibles y huérfanos
 * ------------------------------------------------------------------ */

titulo(9, "Partidos en estado imposible");
{
  const porEstado = db.matches.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]).toArray();
  print("  Distribución de estados:");
  porEstado.forEach((e) => print(`    · ${e._id}: ${e.n}`));

  const CATALOGO = [
    "abierto",
    "cerrado",
    "equipos_generados",
    "equipos_confirmados",
    "finalizado",
    "completado",
    "cancelado",
  ];
  const fuera = porEstado.filter((e) => CATALOGO.indexOf(e._id) === -1);
  if (fuera.length) print("  Estados FUERA del catálogo: " + JSON.stringify(fuera));

  const finSinConteo = db.matches.countDocuments({
    status: { $in: ["finalizado", "completado"] },
    counted_player_ids: { $size: 0 },
  });
  // Ésta es la prueba directa del bug de transiciones: un partido abierto o
  // cerrado con gente ya contada estuvo finalizado y volvió atrás.
  const abiertoConConteo = db.matches.countDocuments({
    status: { $in: ["abierto", "cerrado"] },
    counted_player_ids: { $not: { $size: 0 } },
  });

  print(`  Finalizados sin jugadores contados:        ${finSinConteo}`);
  print(`  Abiertos/cerrados CON jugadores contados:  ${abiertoConConteo}   <-- volvieron atrás`);
  veredicto(
    fuera.length === 0 && abiertoConConteo === 0,
    "ningún partido volvió atrás desde finalizado y no hay estados inventados",
    `${abiertoConConteo} partidos retrocedieron de estado. Mientras estuvieron así, los seis endpoints de post-partido quedaron cerrados sobre datos ya cargados.`
  );
}

titulo(10, "Huérfanos de merge de invitados y de borrado de grupo");
{
  const perfilesVivos = db.player_profiles.distinct("id");
  const partidosVivos = db.matches.distinct("id");
  const gruposVivos = db.groups.distinct("id");

  const outHuerfanos = db.match_outcomes.countDocuments({ player_id: { $nin: perfilesVivos } });
  const selfHuerfanas = db.self_evaluations.countDocuments({ player_id: { $nin: perfilesVivos } });
  const raterHuerfano = db.peer_ratings.countDocuments({ rater_id: { $nin: perfilesVivos } });
  const notasHuerfanas = db.player_match_notes.countDocuments({ player_id: { $nin: perfilesVivos } });
  const outSinPartido = db.match_outcomes.countDocuments({ match_id: { $nin: partidosVivos } });
  const equiposSinGrupo = db.tournament_teams.countDocuments({ group_id: { $nin: gruposVivos } });

  print(`  match_outcomes de jugadores que ya no existen:   ${outHuerfanos}   <-- daño del merge`);
  print(`  self_evaluations de jugadores inexistentes:      ${selfHuerfanas}`);
  print(`  peer_ratings con rater inexistente:              ${raterHuerfano}`);
  print(`  player_match_notes de jugadores inexistentes:    ${notasHuerfanas}`);
  print(`  match_outcomes de partidos borrados:             ${outSinPartido}   <-- daño del borrado de grupo`);
  print(`  tournament_teams de grupos borrados:             ${equiposSinGrupo}   <-- torneo inejecutable`);

  // La direccion contraria, que es la que se olvida: un PERFIL apuntando a un
  // usuario que ya no existe.
  const idsDeUsuario = db.users.distinct("id");
  const perfilesSinCuenta = db.player_profiles.countDocuments({
    user_id: { $type: "string", $nin: idsDeUsuario },
  });
  print(`  player_profiles con user_id inexistente:         ${perfilesSinCuenta}   <-- cuenta borrada a mano`);

  const total = outHuerfanos + selfHuerfanas + raterHuerfano + notasHuerfanas + outSinPartido + equiposSinGrupo + perfilesSinCuenta;
  veredicto(
    total === 0,
    "no hay referencias colgadas",
    `${total} documentos huérfanos (ver el detalle arriba). Los match_outcomes colgados los sigue leyendo el cálculo de rating por player_id, así que ahí hay gente arrastrando puntaje de partidos que ya no existen; los demás son restos que ensucian sin hacer daño.`
  );
}

/* ------------------------------------------------------------------ */

print("");
print("=".repeat(72));
print(`RESUMEN — ${R.ok} en OK, ${R.revisar} para revisar`);
print("=".repeat(72));
print("");
print("Cómo leerlo:");
print("  · Q1-Q4 miden el daño del player_score. Si Q4 da 0 outcomes, el histórico está limpio");
print("    y la discusión sobre cómo repararlo se vuelve académica.");
print("  · Q5-Q8 son la precondición de los índices únicos. Tienen que dar CERO antes de crearlos.");
print("  · Q9 dice si el bug de transiciones ya se manifestó.");
print("  · Q10 cuantifica lo que el merge y el borrado de grupo dejaron colgado.");
print("");
