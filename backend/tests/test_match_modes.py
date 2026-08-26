"""
Tests de la fase 1 de los modos de partido: modo, tipo, resultado y asistencia.

Lo que más se cuida acá es el contador de partidos jugados. Es un número
acumulado en el perfil del jugador que alimenta el índice de confianza del
rating, y hasta ahora se tocaba con un `$inc` suelto adentro de finalize: sin
registro de a quién se le había sumado, sin forma de corregirlo, y sumando de
nuevo si alguien finalizaba dos veces. Los errores de un contador así no se ven
— se acumulan callados. Por eso la mitad de estos tests son sobre eso.

El armado sigue el mismo criterio que test_routes_tournaments.py: Mongo en
memoria, las funciones de ruta llamadas directamente (lo que se prueba es la
lógica, no el ruteo de FastAPI ni el JWT) y `db` parcheado en CADA módulo que
hace `from database import db` — de eso se ocupa el fixture `mongo_en_memoria`
de conftest.py, que los cubre a todos.
"""

from datetime import datetime, timezone
import uuid

import pytest
from fastapi import HTTPException
import database
import routes_matches as rm
import routes_post_match as rpm
from constants import DEFAULT_MATCH_MODE, capacidades_de, jugo_el_partido, modo_label
from models import CreateMatchRequest, SetAttendanceRequest, SetMatchResultRequest, UpdateMatchRequest
from services import matches as svc_matches


async def sembrar_jugador(db, nombre="Jugador", role="organizador"):
    """Un usuario con perfil. Devuelve (user, profile_id)."""
    user_id = str(uuid.uuid4())
    profile_id = str(uuid.uuid4())
    await db.player_profiles.insert_one({
        "id": profile_id,
        "user_id": user_id,
        "name": nombre,
        "player_type": "frecuente",
        "matches_played": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"user_id": user_id, "role": role}, profile_id


async def sembrar_grupo(db, profile_id, *, default_match_mode=None):
    group_id = str(uuid.uuid4())
    doc = {
        "id": group_id,
        "name": "Los del martes",
        "created_by": profile_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if default_match_mode is not None:
        doc["default_match_mode"] = default_match_mode
    await db.groups.insert_one(doc)
    await db.group_members.insert_one({
        "id": str(uuid.uuid4()),
        "group_id": group_id,
        "player_id": profile_id,
        "member_role": "organizador",
        "status": "activo",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return group_id


async def crear_partido(db, user, group_id, **extra):
    data = CreateMatchRequest(
        group_id=group_id,
        title="Partido del sábado",
        modality=5,
        date="2026-09-05",
        time="20:00",
        location="La cancha",
        **extra,
    )
    return await rm.create_match(data, user=user)


async def anotar(db, match_id, player_id, status="titular", order=1):
    await db.match_registrations.insert_one({
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "player_id": player_id,
        "status": status,
        "order": order,
        "registered_at": datetime.now(timezone.utc).isoformat(),
    })


async def cerrar(db, match_id):
    """Cierra la inscripción.

    Finalizar exige que esté cerrada: no tiene sentido contar como jugado un
    partido al que todavía se puede anotar gente.
    """
    await db.matches.update_one({"id": match_id}, {"$set": {"status": "cerrado"}})


async def partidos_jugados(db, profile_id):
    perfil = await db.player_profiles.find_one({"id": profile_id}, {"_id": 0})
    return perfil.get("matches_played", 0)


# ---------------------------------------------------------------------------
# El modo se hereda del grupo
# ---------------------------------------------------------------------------

async def test_el_partido_hereda_el_modo_del_grupo(mongo_en_memoria):
    db = mongo_en_memoria
    user, profile_id = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, profile_id, default_match_mode="diversion")

    partido = await crear_partido(db, user, group_id)

    assert partido.mode == "diversion"
    assert partido.mode_label == "Sólo anotarse"
    # Diversión no arma equipos ni evalúa: es lo que tiene que leer el front.
    assert partido.capabilities["team_source"] == "ninguno"
    assert partido.capabilities["rating_por_partido"] is False


async def test_el_modo_elegido_le_gana_al_del_grupo(mongo_en_memoria):
    db = mongo_en_memoria
    user, profile_id = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, profile_id, default_match_mode="diversion")

    partido = await crear_partido(db, user, group_id, mode="pro")

    assert partido.mode == "pro"
    assert partido.capabilities["stats_configurables"] is True


async def test_grupo_sin_default_cae_al_modo_de_siempre(mongo_en_memoria):
    """Un grupo de antes de que existieran los modos se comporta como siempre."""
    db = mongo_en_memoria
    user, profile_id = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, profile_id)  # sin default_match_mode

    partido = await crear_partido(db, user, group_id)

    assert partido.mode == DEFAULT_MATCH_MODE == "avanzado"
    assert partido.match_type == "oficial"


async def test_el_duplicado_hereda_modo_y_tipo(mongo_en_memoria):
    """Duplicar es 'la fecha que viene de lo mismo', no 'un partido nuevo'."""
    db = mongo_en_memoria
    user, profile_id = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, profile_id)
    original = await crear_partido(db, user, group_id, mode="diversion", match_type="practica")

    duplicado = await rm.duplicate_match(original.id, user=user)
    doc = await db.matches.find_one({"id": duplicado["id"]}, {"_id": 0})

    assert doc["mode"] == "diversion"
    assert doc["match_type"] == "practica"
    # El duplicado arranca sin resultado y sin nadie contado.
    assert doc["result"] is None
    assert doc["counted_player_ids"] == []


async def test_un_partido_viejo_sin_modo_se_lee_como_avanzado(mongo_en_memoria):
    """No hace falta migrar para poder leer: el default cubre el hueco."""
    datos = svc_matches.datos_de_modo({"id": "x"})

    assert datos["mode"] == "avanzado"
    assert datos["mode_label"] == modo_label("avanzado")
    assert datos["match_type"] == "oficial"
    assert datos["home_label"] == "Equipo A"
    assert datos["away_label"] == "Equipo B"


def test_un_modo_inventado_no_revienta():
    assert capacidades_de("modo_que_no_existe") == capacidades_de(DEFAULT_MATCH_MODE)
    assert capacidades_de(None) == capacidades_de(DEFAULT_MATCH_MODE)


# ---------------------------------------------------------------------------
# El modo se congela cuando el partido deja de estar abierto
# ---------------------------------------------------------------------------

async def test_el_modo_se_puede_cambiar_mientras_esta_abierto(mongo_en_memoria):
    db = mongo_en_memoria
    user, profile_id = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, profile_id)
    partido = await crear_partido(db, user, group_id)

    await rm.update_match(partido.id, UpdateMatchRequest(mode="pro"), user=user)

    doc = await db.matches.find_one({"id": partido.id}, {"_id": 0})
    assert doc["mode"] == "pro"


async def test_el_modo_no_se_puede_cambiar_despues_de_cerrar(mongo_en_memoria):
    """Ya hay equipos o evaluaciones cargadas bajo las reglas del modo viejo."""
    db = mongo_en_memoria
    user, profile_id = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, profile_id)
    partido = await crear_partido(db, user, group_id)
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "cerrado"}})

    with pytest.raises(HTTPException) as exc:
        await rm.update_match(partido.id, UpdateMatchRequest(mode="pro"), user=user)

    assert exc.value.status_code == 400
    doc = await db.matches.find_one({"id": partido.id}, {"_id": 0})
    assert doc["mode"] == "avanzado"


async def test_el_tipo_si_se_puede_corregir_despues(mongo_en_memoria):
    """Marcar un partido como práctica no reescribe nada: es una etiqueta."""
    db = mongo_en_memoria
    user, profile_id = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, profile_id)
    partido = await crear_partido(db, user, group_id)
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "finalizado"}})

    await rm.update_match(partido.id, UpdateMatchRequest(match_type="practica"), user=user)

    doc = await db.matches.find_one({"id": partido.id}, {"_id": 0})
    assert doc["match_type"] == "practica"


# ---------------------------------------------------------------------------
# Resultado
# ---------------------------------------------------------------------------

async def test_no_se_puede_cargar_el_resultado_de_un_partido_sin_jugar(mongo_en_memoria):
    db = mongo_en_memoria
    user, profile_id = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, profile_id)
    partido = await crear_partido(db, user, group_id)

    with pytest.raises(HTTPException) as exc:
        await rpm.set_match_result(partido.id, SetMatchResultRequest(home_score=3, away_score=1), user=user)

    assert exc.value.status_code == 400


async def test_se_carga_y_se_corrige_el_resultado(mongo_en_memoria):
    db = mongo_en_memoria
    user, profile_id = await sembrar_jugador(db, nombre="Pato")
    group_id = await sembrar_grupo(db, profile_id)
    partido = await crear_partido(db, user, group_id)
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "finalizado"}})

    primera = await rpm.set_match_result(
        partido.id, SetMatchResultRequest(home_score=3, away_score=1, notes="  llovía  "), user=user
    )
    assert primera["message"] == "Resultado guardado"
    assert primera["result"]["home_score"] == 3
    # La nota se guarda sin los espacios de los costados.
    assert primera["result"]["notes"] == "llovía"
    assert primera["result"]["loaded_by_name"] == "Pato"

    segunda = await rpm.set_match_result(
        partido.id, SetMatchResultRequest(home_score=2, away_score=2), user=user
    )
    assert segunda["message"] == "Resultado corregido"

    doc = await db.matches.find_one({"id": partido.id}, {"_id": 0})
    assert doc["result"]["home_score"] == 2
    assert doc["result"]["away_score"] == 2
    # Corregir sin nota la borra en vez de dejar la vieja pegada a otro marcador.
    assert doc["result"]["notes"] is None


async def test_una_nota_en_blanco_no_se_guarda_como_nota(mongo_en_memoria):
    db = mongo_en_memoria
    user, profile_id = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, profile_id)
    partido = await crear_partido(db, user, group_id)
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "finalizado"}})

    res = await rpm.set_match_result(
        partido.id, SetMatchResultRequest(home_score=1, away_score=0, notes="   "), user=user
    )

    assert res["result"]["notes"] is None


def test_un_marcador_absurdo_no_pasa():
    """El techo existe para que un dedo gordo no corrompa el rating más adelante."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        SetMatchResultRequest(home_score=100, away_score=0)
    with pytest.raises(ValidationError):
        SetMatchResultRequest(home_score=-1, away_score=0)


# ---------------------------------------------------------------------------
# Asistencia y contador de partidos jugados
# ---------------------------------------------------------------------------

async def test_finalizar_cuenta_solo_a_los_titulares(mongo_en_memoria):
    """Sin asistencia marcada vale la regla vieja: el titular jugó, el suplente no."""
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id)

    _, titular = await sembrar_jugador(db, "Titular")
    _, suplente = await sembrar_jugador(db, "Suplente")
    await anotar(db, partido.id, titular, "titular", 1)
    await anotar(db, partido.id, suplente, "suplente", 2)

    await cerrar(db, partido.id)
    await rpm.finalize_match(partido.id, user=user)

    assert await partidos_jugados(db, titular) == 1
    assert await partidos_jugados(db, suplente) == 0


async def test_finalizar_dos_veces_no_cuenta_dos_veces(mongo_en_memoria):
    """El bug que motivó todo esto: un doble click sumaba dos partidos a cada uno."""
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id)

    _, titular = await sembrar_jugador(db, "Titular")
    await anotar(db, partido.id, titular, "titular", 1)

    await cerrar(db, partido.id)
    await rpm.finalize_match(partido.id, user=user)
    await rpm.finalize_match(partido.id, user=user)
    await rpm.finalize_match(partido.id, user=user)

    assert await partidos_jugados(db, titular) == 1


async def test_el_que_falto_no_suma_partido(mongo_en_memoria):
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id)

    _, vino = await sembrar_jugador(db, "Vino")
    _, planto = await sembrar_jugador(db, "Plantó")
    await anotar(db, partido.id, vino, "titular", 1)
    await anotar(db, partido.id, planto, "titular", 2)

    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "cerrado"}})
    await rpm.set_attendance(
        partido.id,
        SetAttendanceRequest(entries=[
            {"player_id": vino, "attendance": "presente"},
            {"player_id": planto, "attendance": "sin_aviso"},
        ]),
        user=user,
    )
    await rpm.finalize_match(partido.id, user=user)

    assert await partidos_jugados(db, vino) == 1
    assert await partidos_jugados(db, planto) == 0


async def test_el_suplente_que_entro_si_suma_partido(mongo_en_memoria):
    """Marcarlo presente le gana a que en la lista figure como suplente."""
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id)

    _, suplente = await sembrar_jugador(db, "Suplente")
    await anotar(db, partido.id, suplente, "suplente", 1)

    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "cerrado"}})
    await rpm.set_attendance(
        partido.id,
        SetAttendanceRequest(entries=[{"player_id": suplente, "attendance": "presente"}]),
        user=user,
    )
    await rpm.finalize_match(partido.id, user=user)

    assert await partidos_jugados(db, suplente) == 1


async def test_corregir_la_asistencia_despues_de_finalizar_reajusta_el_contador(mongo_en_memoria):
    """Los dos sentidos: el que se creyó que jugó y no, y el que jugó y no figuraba."""
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id)

    _, uno = await sembrar_jugador(db, "Uno")
    _, dos = await sembrar_jugador(db, "Dos")
    await anotar(db, partido.id, uno, "titular", 1)
    await anotar(db, partido.id, dos, "suplente", 2)

    await cerrar(db, partido.id)
    await rpm.finalize_match(partido.id, user=user)
    assert await partidos_jugados(db, uno) == 1
    assert await partidos_jugados(db, dos) == 0

    # Tres días después: Uno en realidad no fue y Dos terminó jugando.
    await rpm.set_attendance(
        partido.id,
        SetAttendanceRequest(entries=[
            {"player_id": uno, "attendance": "ausente"},
            {"player_id": dos, "attendance": "presente"},
        ]),
        user=user,
    )

    assert await partidos_jugados(db, uno) == 0
    assert await partidos_jugados(db, dos) == 1


async def test_borrar_la_marca_vuelve_a_la_regla_vieja(mongo_en_memoria):
    """Sin marca no es lo mismo que ausente: es 'no se tomó asistencia'."""
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id)

    _, titular = await sembrar_jugador(db, "Titular")
    await anotar(db, partido.id, titular, "titular", 1)

    await cerrar(db, partido.id)
    await rpm.finalize_match(partido.id, user=user)
    await rpm.set_attendance(
        partido.id,
        SetAttendanceRequest(entries=[{"player_id": titular, "attendance": "ausente"}]),
        user=user,
    )
    assert await partidos_jugados(db, titular) == 0

    await rpm.set_attendance(
        partido.id,
        SetAttendanceRequest(entries=[{"player_id": titular, "attendance": None}]),
        user=user,
    )
    assert await partidos_jugados(db, titular) == 1

    reg = await db.match_registrations.find_one({"match_id": partido.id, "player_id": titular}, {"_id": 0})
    assert "attendance" not in reg


async def test_el_contador_no_queda_en_negativo(mongo_en_memoria):
    """Red por si el contador arranca en cero y algo intenta restarle."""
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id)

    _, jugador = await sembrar_jugador(db, "Jugador")
    await anotar(db, partido.id, jugador, "titular", 1)

    await cerrar(db, partido.id)
    await rpm.finalize_match(partido.id, user=user)
    # Alguien deja el contador en cero por fuera (arrastre de datos viejos).
    await db.player_profiles.update_one({"id": jugador}, {"$set": {"matches_played": 0}})

    await rpm.set_attendance(
        partido.id,
        SetAttendanceRequest(entries=[{"player_id": jugador, "attendance": "ausente"}]),
        user=user,
    )

    assert await partidos_jugados(db, jugador) == 0


async def test_no_se_marca_asistencia_con_la_inscripcion_abierta(mongo_en_memoria):
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id)

    _, jugador = await sembrar_jugador(db)
    await anotar(db, partido.id, jugador, "titular", 1)

    with pytest.raises(HTTPException) as exc:
        await rpm.set_attendance(
            partido.id,
            SetAttendanceRequest(entries=[{"player_id": jugador, "attendance": "presente"}]),
            user=user,
        )

    assert exc.value.status_code == 400


async def test_no_se_marca_asistencia_de_alguien_que_no_esta_anotado(mongo_en_memoria):
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id)
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "cerrado"}})

    _, ajeno = await sembrar_jugador(db, "Ajeno")

    with pytest.raises(HTTPException) as exc:
        await rpm.set_attendance(
            partido.id,
            SetAttendanceRequest(entries=[{"player_id": ajeno, "attendance": "presente"}]),
            user=user,
        )

    assert exc.value.status_code == 400


async def test_un_partido_cancelado_no_se_finaliza(mongo_en_memoria):
    db = mongo_en_memoria
    user, organizador = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, organizador)
    partido = await crear_partido(db, user, group_id)
    await db.matches.update_one({"id": partido.id}, {"$set": {"status": "cancelado"}})

    with pytest.raises(HTTPException) as exc:
        await rpm.finalize_match(partido.id, user=user)

    assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# Migración de lo que ya existía
# ---------------------------------------------------------------------------

async def test_la_migracion_no_duplica_el_conteo_de_un_partido_ya_jugado(mongo_en_memoria):
    """
    El riesgo real de esta fase.

    Un partido finalizado con el código viejo ya le sumó el partido a sus
    titulares, pero no dejó registro de a quién. Si después de migrar el
    sincronizador creyera que no contó a nadie, se lo sumaría de nuevo.
    """
    db = mongo_en_memoria
    _, jugador = await sembrar_jugador(db, "De antes")
    match_id = str(uuid.uuid4())
    await db.matches.insert_one({
        "id": match_id,
        "group_id": str(uuid.uuid4()),
        "organizer_id": jugador,
        "title": "Partido viejo",
        "modality": 5,
        "date": "2026-01-10",
        "time": "20:00",
        "location": "La cancha",
        "deadline": "2026-01-10T12:00:00+00:00",
        "status": "finalizado",
        "is_recurring": False,
        "max_players": 10,
        "created_at": "2026-01-01T00:00:00+00:00",
    })
    await anotar(db, match_id, jugador, "titular", 1)
    # Como lo habría dejado el código viejo: contado, pero sin registro de eso.
    await db.player_profiles.update_one({"id": jugador}, {"$set": {"matches_played": 1}})

    await database.backfill_match_defaults()

    doc = await db.matches.find_one({"id": match_id}, {"_id": 0})
    assert doc["mode"] == "avanzado"
    assert doc["match_type"] == "oficial"
    assert doc["counted_player_ids"] == [jugador]

    # Y ahora sí: sincronizar no le suma un segundo partido.
    await svc_matches.sincronizar_partidos_jugados(match_id)
    assert await partidos_jugados(db, jugador) == 1


async def test_el_sincronizador_se_defiende_solo_si_la_migracion_no_corrio(mongo_en_memoria):
    """Misma protección, sin depender de que el backfill haya pasado."""
    db = mongo_en_memoria
    _, jugador = await sembrar_jugador(db, "De antes")
    match_id = str(uuid.uuid4())
    await db.matches.insert_one({
        "id": match_id,
        "group_id": str(uuid.uuid4()),
        "organizer_id": jugador,
        "status": "finalizado",
        "title": "Partido viejo",
        "modality": 5,
        "date": "2026-01-10",
        "time": "20:00",
        "location": "La cancha",
        "deadline": "2026-01-10T12:00:00+00:00",
        "is_recurring": False,
        "max_players": 10,
        "created_at": "2026-01-01T00:00:00+00:00",
    })
    await anotar(db, match_id, jugador, "titular", 1)
    await db.player_profiles.update_one({"id": jugador}, {"$set": {"matches_played": 1}})

    await svc_matches.sincronizar_partidos_jugados(match_id)

    assert await partidos_jugados(db, jugador) == 1


async def test_la_migracion_es_idempotente(mongo_en_memoria):
    db = mongo_en_memoria
    user, profile_id = await sembrar_jugador(db)
    group_id = await sembrar_grupo(db, profile_id, default_match_mode="pro")
    partido = await crear_partido(db, user, group_id)

    await database.backfill_match_defaults()
    await database.backfill_match_defaults()

    doc = await db.matches.find_one({"id": partido.id}, {"_id": 0})
    grupo = await db.groups.find_one({"id": group_id}, {"_id": 0})
    # No pisa lo que ya estaba elegido.
    assert doc["mode"] == "pro"
    assert grupo["default_match_mode"] == "pro"


# ---------------------------------------------------------------------------
# La regla de "jugó o no jugó", suelta
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "registration, esperado",
    [
        ({"status": "titular"}, True),
        ({"status": "suplente"}, False),
        ({"status": "titular", "attendance": "presente"}, True),
        ({"status": "titular", "attendance": "ausente"}, False),
        ({"status": "titular", "attendance": "sin_aviso"}, False),
        ({"status": "suplente", "attendance": "presente"}, True),
        # Un valor que no está en el catálogo se ignora y vale la regla vieja.
        ({"status": "titular", "attendance": "cualquier_cosa"}, True),
    ],
)
def test_quien_cuenta_como_que_jugo(registration, esperado):
    assert jugo_el_partido(registration) is esperado
