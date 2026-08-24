"""
Torneos: un torneo agrupa GRUPOS existentes y cada grupo juega como un equipo.

El plantel de cada equipo no se define acá: es la lista de miembros del grupo,
que ya vive en group_members. Por eso un torneo es liviano — nombre, formato,
qué grupos entran, el fixture y los resultados.

Quién puede qué:
  - crear un torneo: organizadores y admins (igual que crear un grupo);
  - sumar un grupo al torneo: hay que ser organizador DE ESE grupo, para que
    nadie meta el grupo de otro en su torneo;
  - cargar resultados y generar el fixture: quien creó el torneo, o un admin;
  - ver el torneo: cualquiera que sea miembro de alguno de los grupos que juegan.
"""

from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from constants import TOURNAMENT_FORMAT_MAP
from database import db
from models import (
    AddTournamentTeamRequest,
    CreateTournamentRequest,
    SetFixtureResultRequest,
)
from services.permissions import get_group_or_404, get_group_membership
from services.profiles import get_my_profile_or_404
from services.tournament import (
    MAX_ZONES,
    clasificados,
    fixture_de_eliminacion,
    fixture_de_liga,
    fixture_de_zonas,
    ganador_de,
    repartir_en_zonas,
    stage_label,
    tabla_de_posiciones,
)
from utils.mongo import clean_mongo

router = APIRouter(prefix="/api/tournaments", tags=["tournaments"])


async def _get_tournament_or_404(tournament_id: str) -> dict:
    tournament = await db.tournaments.find_one({"id": tournament_id}, {"_id": 0})
    if not tournament:
        raise HTTPException(status_code=404, detail="Torneo no encontrado")
    return tournament


async def _teams_of(tournament_id: str) -> list:
    return await db.tournament_teams.find(
        {"tournament_id": tournament_id}, {"_id": 0}
    ).sort("seed", 1).to_list(200)


async def _fixtures_of(tournament_id: str) -> list:
    return await db.tournament_fixtures.find(
        {"tournament_id": tournament_id}, {"_id": 0}
    ).sort([("round", 1), ("order", 1)]).to_list(1000)


def _can_manage(tournament: dict, profile: dict, user) -> bool:
    return user["role"] == "admin" or tournament.get("created_by") == profile["id"]


async def _ensure_can_manage(tournament: dict, user) -> dict:
    profile = await get_my_profile_or_404(user)
    if not _can_manage(tournament, profile, user):
        raise HTTPException(
            status_code=403,
            detail="Solo quien creó el torneo puede administrarlo",
        )
    return profile


async def _ensure_can_view(tournament: dict, user) -> dict:
    """
    Ve el torneo quien lo creó, un admin, o cualquiera que sea miembro activo de
    alguno de los grupos que están jugando. Un torneo es información compartida
    entre los grupos que participan: si jugás, lo ves.
    """
    profile = await get_my_profile_or_404(user)
    if _can_manage(tournament, profile, user):
        return profile

    group_ids = [t["group_id"] for t in await _teams_of(tournament["id"])]
    if group_ids:
        soy_miembro = await db.group_members.count_documents({
            "group_id": {"$in": group_ids},
            "player_id": profile["id"],
            "status": "activo",
        })
        if soy_miembro:
            return profile

    raise HTTPException(status_code=403, detail="No participás de este torneo")


async def _ensure_organiza_el_grupo(group_id: str, profile: dict, user) -> dict:
    """
    Para meter un grupo en un torneo hay que organizarlo. Sin esto cualquiera
    podría anotar el grupo de otro a jugar un torneo que ese grupo no eligió.
    """
    group = await get_group_or_404(group_id)
    if user["role"] == "admin":
        return group

    membership = await get_group_membership(group_id, profile["id"])
    if not membership or membership.get("member_role") != "organizador":
        raise HTTPException(
            status_code=403,
            detail=f"Solo un organizador de «{group['name']}» puede sumarlo a un torneo",
        )
    return group


async def _members_count_by_group(group_ids: list) -> dict:
    if not group_ids:
        return {}
    cursor = db.group_members.aggregate([
        {"$match": {"group_id": {"$in": group_ids}, "status": "activo"}},
        {"$group": {"_id": "$group_id", "total": {"$sum": 1}}},
    ])
    return {row["_id"]: row["total"] async for row in cursor}


def _serializar_fixture(fixture: dict, nombres: dict) -> dict:
    return clean_mongo({
        **fixture,
        "stage_label": stage_label(fixture["stage"], fixture.get("zone")),
        "home_team_name": nombres.get(fixture.get("home_team_id")),
        "away_team_name": nombres.get(fixture.get("away_team_id")),
        "winner_team_id": ganador_de(fixture),
    })


async def _serializar_torneo(tournament: dict, profile: dict, user, teams=None) -> dict:
    if teams is None:
        teams = await _teams_of(tournament["id"])
    formato = TOURNAMENT_FORMAT_MAP.get(tournament["format"], {})
    nombres = {t["id"]: t["name"] for t in teams}
    return clean_mongo({
        **tournament,
        "format_label": formato.get("name", tournament["format"]),
        "teams_count": len(teams),
        "can_manage": _can_manage(tournament, profile, user),
        "champion_name": nombres.get(tournament.get("champion_team_id")),
    })


@router.post("")
async def create_tournament(data: CreateTournamentRequest, user=Depends(get_current_user)):
    if user["role"] not in ["admin", "organizador"]:
        raise HTTPException(
            status_code=403,
            detail="Solo organizadores o admins pueden crear torneos",
        )

    nombre = data.name.strip()
    if len(nombre) < 3:
        raise HTTPException(status_code=400, detail="El nombre del torneo es muy corto")

    profile = await get_my_profile_or_404(user)
    now = datetime.now(timezone.utc).isoformat()
    tournament_id = str(uuid.uuid4())

    tournament_doc = {
        "id": tournament_id,
        "name": nombre,
        "format": data.format,
        "status": "borrador",
        "zones_count": max(1, min(int(data.zones_count or 2), MAX_ZONES)),
        "qualifiers_per_zone": max(1, int(data.qualifiers_per_zone or 2)),
        "created_by": profile["id"],
        "champion_team_id": None,
        "created_at": now,
    }
    await db.tournaments.insert_one(tournament_doc)

    # Los grupos que vinieron en el alta se agregan acá mismo. Si alguno no se
    # puede sumar, el torneo YA quedó creado: preferimos eso a dejar al usuario
    # con un 403 y sin torneo. El que falló se avisa en la respuesta.
    agregados, rechazados = [], []
    for group_id in dict.fromkeys(data.group_ids):
        try:
            group = await _ensure_organiza_el_grupo(group_id, profile, user)
        except HTTPException as exc:
            rechazados.append({"group_id": group_id, "detail": exc.detail})
            continue
        agregados.append(await _crear_equipo(tournament_id, group, len(agregados), now))

    serializado = await _serializar_torneo(tournament_doc, profile, user, teams=agregados)
    serializado["rejected_groups"] = rechazados
    return serializado


async def _crear_equipo(tournament_id: str, group: dict, seed: int, now: str) -> dict:
    """
    Suma un grupo al torneo como equipo.

    El nombre se copia del grupo en vez de leerse siempre en vivo: si mañana el
    grupo se renombra, el torneo ya jugado sigue diciendo contra quién se jugó.
    """
    team_doc = {
        "id": str(uuid.uuid4()),
        "tournament_id": tournament_id,
        "group_id": group["id"],
        "name": group["name"],
        "zone": None,
        "seed": seed,
        "created_at": now,
    }
    await db.tournament_teams.insert_one(team_doc)
    return team_doc


@router.get("")
async def list_tournaments(user=Depends(get_current_user)):
    """Los torneos que creé más los que juega algún grupo del que soy miembro."""
    profile = await get_my_profile_or_404(user)

    if user["role"] == "admin":
        tournaments = await db.tournaments.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    else:
        memberships = await db.group_members.find(
            {"player_id": profile["id"], "status": "activo"}, {"_id": 0}
        ).to_list(500)
        mis_grupos = [m["group_id"] for m in memberships]

        equipos = await db.tournament_teams.find(
            {"group_id": {"$in": mis_grupos}}, {"_id": 0}
        ).to_list(500) if mis_grupos else []
        ids_por_equipo = {e["tournament_id"] for e in equipos}

        tournaments = await db.tournaments.find(
            {"$or": [
                {"id": {"$in": list(ids_por_equipo)}},
                {"created_by": profile["id"]},
            ]},
            {"_id": 0},
        ).sort("created_at", -1).to_list(200)

    if not tournaments:
        return []

    # Un solo aggregate para contar equipos de todos los torneos de la lista,
    # en vez de una query por torneo.
    ids = [t["id"] for t in tournaments]
    cursor = db.tournament_teams.aggregate([
        {"$match": {"tournament_id": {"$in": ids}}},
        {"$group": {"_id": "$tournament_id", "total": {"$sum": 1}}},
    ])
    conteo = {row["_id"]: row["total"] async for row in cursor}

    return [
        clean_mongo({
            **t,
            "format_label": TOURNAMENT_FORMAT_MAP.get(t["format"], {}).get("name", t["format"]),
            "teams_count": conteo.get(t["id"], 0),
            "can_manage": _can_manage(t, profile, user),
        })
        for t in tournaments
    ]


@router.get("/{tournament_id}")
async def get_tournament(tournament_id: str, user=Depends(get_current_user)):
    """El torneo entero de una: equipos, fixture y tabla. Es lo que pinta la pantalla."""
    tournament = await _get_tournament_or_404(tournament_id)
    profile = await _ensure_can_view(tournament, user)

    teams = await _teams_of(tournament_id)
    fixtures = await _fixtures_of(tournament_id)
    nombres = {t["id"]: t["name"] for t in teams}
    counts = await _members_count_by_group([t["group_id"] for t in teams])

    return {
        "tournament": await _serializar_torneo(tournament, profile, user, teams=teams),
        "teams": [
            clean_mongo({**t, "members_count": counts.get(t["group_id"], 0)})
            for t in teams
        ],
        "fixtures": [_serializar_fixture(fx, nombres) for fx in fixtures],
        "standings": tabla_de_posiciones(teams, fixtures),
    }


@router.post("/{tournament_id}/teams")
async def add_tournament_team(
    tournament_id: str, data: AddTournamentTeamRequest, user=Depends(get_current_user)
):
    tournament = await _get_tournament_or_404(tournament_id)
    profile = await _ensure_can_manage(tournament, user)

    if tournament["status"] != "borrador":
        raise HTTPException(
            status_code=400,
            detail="El torneo ya arrancó: no se pueden sumar equipos",
        )

    group = await _ensure_organiza_el_grupo(data.group_id, profile, user)

    ya_esta = await db.tournament_teams.find_one(
        {"tournament_id": tournament_id, "group_id": data.group_id}, {"_id": 0}
    )
    if ya_esta:
        raise HTTPException(status_code=400, detail="Ese grupo ya está en el torneo")

    seed = await db.tournament_teams.count_documents({"tournament_id": tournament_id})
    now = datetime.now(timezone.utc).isoformat()
    return clean_mongo(await _crear_equipo(tournament_id, group, seed, now))


@router.delete("/{tournament_id}/teams/{team_id}")
async def remove_tournament_team(
    tournament_id: str, team_id: str, user=Depends(get_current_user)
):
    tournament = await _get_tournament_or_404(tournament_id)
    await _ensure_can_manage(tournament, user)

    if tournament["status"] != "borrador":
        raise HTTPException(
            status_code=400,
            detail="El torneo ya arrancó: no se pueden sacar equipos",
        )

    borrado = await db.tournament_teams.delete_one(
        {"id": team_id, "tournament_id": tournament_id}
    )
    if not borrado.deleted_count:
        raise HTTPException(status_code=404, detail="Ese equipo no está en el torneo")

    return {"message": "Equipo sacado del torneo"}


@router.post("/{tournament_id}/fixture")
async def generate_fixture(tournament_id: str, user=Depends(get_current_user)):
    """
    Arma el fixture y arranca el torneo.

    Se puede volver a llamar mientras el torneo esté en borrador o en fase de
    grupos SIN resultados cargados. Apenas hay un resultado, regenerar borraría
    lo jugado, así que se rechaza.
    """
    tournament = await _get_tournament_or_404(tournament_id)
    await _ensure_can_manage(tournament, user)

    teams = await _teams_of(tournament_id)
    if len(teams) < 2:
        raise HTTPException(
            status_code=400, detail="Hacen falta al menos 2 equipos para armar el fixture"
        )

    ya_jugados = await db.tournament_fixtures.count_documents(
        {"tournament_id": tournament_id, "status": "jugado"}
    )
    if ya_jugados:
        raise HTTPException(
            status_code=400,
            detail="Ya hay resultados cargados. Borrá el torneo si querés empezar de cero",
        )

    formato = tournament["format"]
    now = datetime.now(timezone.utc).isoformat()

    if formato == "liga":
        crudos = fixture_de_liga(teams)
        nuevo_estado = "fase_grupos"
    elif formato == "zonas_eliminatoria":
        repartidos = repartir_en_zonas(teams, tournament.get("zones_count", 2))
        for team in repartidos:
            await db.tournament_teams.update_one(
                {"id": team["id"]}, {"$set": {"zone": team["zone"]}}
            )
        crudos = fixture_de_zonas(repartidos)
        nuevo_estado = "fase_grupos"
    else:  # eliminacion
        crudos = fixture_de_eliminacion([t["id"] for t in teams])
        nuevo_estado = "eliminatoria"

    if not crudos:
        raise HTTPException(
            status_code=400,
            detail="No se pudo armar el fixture con esos equipos. Revisá la cantidad de zonas",
        )

    await db.tournament_fixtures.delete_many({"tournament_id": tournament_id})
    docs = await _persistir_fixtures(tournament_id, crudos, now)

    await db.tournaments.update_one(
        {"id": tournament_id},
        {"$set": {"status": nuevo_estado, "champion_team_id": None}},
    )

    nombres = {t["id"]: t["name"] for t in teams}
    return {
        "message": "Fixture generado",
        "status": nuevo_estado,
        "fixtures": [_serializar_fixture(fx, nombres) for fx in docs],
    }


async def _persistir_fixtures(tournament_id: str, crudos: list, now: str) -> list:
    """
    Guarda los fixtures que devolvió el motor y traduce `next_index` a ids.

    El motor no puede saber los uuid, así que apunta a la llave siguiente por
    índice dentro de su propia lista. Acá se generan los ids primero y recién
    después se resuelven los punteros, en una sola pasada.
    """
    ids = [str(uuid.uuid4()) for _ in crudos]

    docs = []
    for indice, crudo in enumerate(crudos):
        siguiente = crudo.pop("next_index", None)
        docs.append({
            "id": ids[indice],
            "tournament_id": tournament_id,
            **crudo,
            "home_score": None,
            "away_score": None,
            "status": "pendiente",
            "next_fixture_id": ids[siguiente] if siguiente is not None else None,
            "next_slot": crudo.get("next_slot"),
            "created_at": now,
        })

    if docs:
        await db.tournament_fixtures.insert_many([dict(d) for d in docs])
    return docs


@router.put("/{tournament_id}/fixtures/{fixture_id}")
async def set_fixture_result(
    tournament_id: str,
    fixture_id: str,
    data: SetFixtureResultRequest,
    user=Depends(get_current_user),
):
    """Carga (o corrige) el resultado de un partido y hace avanzar la llave."""
    tournament = await _get_tournament_or_404(tournament_id)
    await _ensure_can_manage(tournament, user)

    fixture = await db.tournament_fixtures.find_one(
        {"id": fixture_id, "tournament_id": tournament_id}, {"_id": 0}
    )
    if not fixture:
        raise HTTPException(status_code=404, detail="Partido no encontrado")

    if not fixture.get("home_team_id") or not fixture.get("away_team_id"):
        raise HTTPException(
            status_code=400,
            detail="Esta llave todavía no tiene los dos equipos definidos",
        )

    actualizado = {
        **fixture,
        "home_score": data.home_score,
        "away_score": data.away_score,
        "status": "jugado",
    }
    await db.tournament_fixtures.update_one(
        {"id": fixture_id},
        {"$set": {
            "home_score": data.home_score,
            "away_score": data.away_score,
            "status": "jugado",
        }},
    )

    ganador = ganador_de(actualizado)

    await _propagar_ganador(
        fixture.get("next_fixture_id"), fixture.get("next_slot"), ganador
    )

    await _revisar_final(tournament_id)

    profile = await get_my_profile_or_404(user)
    teams = await _teams_of(tournament_id)
    nombres = {t["id"]: t["name"] for t in teams}
    fixtures = await _fixtures_of(tournament_id)
    actualizado_doc = await _get_tournament_or_404(tournament_id)

    return {
        "fixtures": [_serializar_fixture(fx, nombres) for fx in fixtures],
        "standings": tabla_de_posiciones(teams, fixtures),
        "tournament": await _serializar_torneo(actualizado_doc, profile, user, teams=teams),
    }


async def _propagar_ganador(fixture_id: str | None, slot: str | None, equipo: str | None) -> None:
    """
    Sienta a `equipo` en una butaca de la llave siguiente, y limpia en cascada lo
    que haya quedado abajo si esa butaca cambia de ocupante.

    La cascada es el punto. Antes esto sólo escribía el next_fixture_id
    INMEDIATO, y con eso alcanza mientras nadie corrija nada. Pero si el torneo
    ya avanzó dos rondas y se corrige un resultado de octavos que cambia el
    ganador, el equipo viejo seguía figurando como ganador de cuartos, de semis
    y hasta como campeón: la llave siguiente ya estaba jugada y su propio avance
    ya estaba persistido. El torneo quedaba mintiendo sin que nada avisara.

    Ahora, si la butaca cambia de ocupante y esa llave ya estaba jugada, el
    resultado se borra (se jugó contra otro rival: ya no significa nada) y se
    sigue hacia abajo desasentando a quien había avanzado desde ahí. Termina
    solo porque las llaves apuntan siempre hacia adelante.

    `equipo=None` es válido y quiere decir "esta butaca vuelve a estar vacía":
    pasa cuando un resultado se corrige a empate, que en eliminación no define.
    """
    if not fixture_id:
        return

    siguiente = await db.tournament_fixtures.find_one({"id": fixture_id}, {"_id": 0})
    if not siguiente:
        return

    campo = "home_team_id" if slot == "home" else "away_team_id"
    if siguiente.get(campo) == equipo:
        return  # nada cambió: no hay por qué tocar lo que ya se jugó

    cambios = {campo: equipo}
    estaba_jugado = siguiente.get("status") == "jugado"
    if estaba_jugado:
        cambios.update({"home_score": None, "away_score": None, "status": "pendiente"})

    await db.tournament_fixtures.update_one({"id": fixture_id}, {"$set": cambios})

    if estaba_jugado:
        await _propagar_ganador(
            siguiente.get("next_fixture_id"), siguiente.get("next_slot"), None
        )


async def _revisar_final(tournament_id: str) -> None:
    """
    Marca el torneo como finalizado cuando ya no queda nada por jugar.

    En liga y zonas eso es "todos los partidos jugados"; en llaves es "la final
    tiene ganador". El campeón se guarda en el torneo para no tener que
    recalcularlo cada vez que alguien abre la pantalla.
    """
    fixtures = await _fixtures_of(tournament_id)
    if not fixtures:
        return

    tournament = await _get_tournament_or_404(tournament_id)
    teams = await _teams_of(tournament_id)

    # Todas las ramas escriben estado Y campeón, incluso para "volver atrás":
    # corregir el resultado de una final ya cargada tiene que DESfinalizar el
    # torneo, no dejarlo con un campeón viejo que ya no gana nada.
    final = next((fx for fx in fixtures if fx["stage"] == "final"), None)
    if final:
        campeon = ganador_de(final)
        await db.tournaments.update_one(
            {"id": tournament_id},
            {"$set": {
                "status": "finalizado" if campeon else "eliminatoria",
                "champion_team_id": campeon,
            }},
        )
        return

    if tournament["format"] == "liga":
        completo = all(fx["status"] == "jugado" for fx in fixtures)
        tabla = tabla_de_posiciones(teams, fixtures)
        campeon = tabla[0]["team_id"] if (completo and tabla) else None
        await db.tournaments.update_one(
            {"id": tournament_id},
            {"$set": {
                "status": "finalizado" if completo else "fase_grupos",
                "champion_team_id": campeon,
            }},
        )
    # En zonas_eliminatoria no se finaliza acá: terminar la fase de grupos sólo
    # habilita generar la eliminatoria (ver /playoffs).


@router.post("/{tournament_id}/playoffs")
async def generate_playoffs(tournament_id: str, user=Depends(get_current_user)):
    """
    Arma las llaves con los clasificados de la fase de zonas.

    Se pide explícitamente y no sale solo al cargar el último resultado: el
    organizador suele querer mirar la tabla antes de cerrar la fase, y sobre
    todo poder corregir un resultado mal cargado sin que ya haya llaves armadas
    a partir de él.
    """
    tournament = await _get_tournament_or_404(tournament_id)
    await _ensure_can_manage(tournament, user)

    if tournament["format"] != "zonas_eliminatoria":
        raise HTTPException(
            status_code=400,
            detail="Este torneo no tiene fase de zonas + eliminatoria",
        )

    teams = await _teams_of(tournament_id)
    fixtures = await _fixtures_of(tournament_id)
    de_zonas = [fx for fx in fixtures if fx["stage"] == "zona"]

    if not de_zonas:
        raise HTTPException(status_code=400, detail="Todavía no se generó la fase de zonas")

    pendientes = [fx for fx in de_zonas if fx["status"] != "jugado"]
    if pendientes:
        raise HTTPException(
            status_code=400,
            detail=f"Faltan {len(pendientes)} partidos de la fase de zonas",
        )

    # Mismo resguardo que generate_fixture: "generar llaves" no puede querer
    # decir "borrar los playoffs que ya se jugaron". Sin esto, un doble click o
    # una segunda visita a la pantalla se llevaba puesta la semifinal cargada,
    # en silencio y sin que nadie lo hubiera pedido.
    playoffs_jugados = await db.tournament_fixtures.count_documents(
        {"tournament_id": tournament_id, "stage": {"$ne": "zona"}, "status": "jugado"}
    )
    if playoffs_jugados:
        raise HTTPException(
            status_code=400,
            detail="Las llaves ya están en juego. Borrá el torneo si querés empezar de cero",
        )

    sembrados = clasificados(teams, fixtures, tournament.get("qualifiers_per_zone", 2))
    if len(sembrados) < 2:
        raise HTTPException(
            status_code=400, detail="No hay suficientes clasificados para armar las llaves"
        )

    # Las llaves arrancan después de la última fecha de zonas, así el número de
    # ronda sigue creciendo y el fixture se ordena solo.
    ultima_ronda = max((fx["round"] for fx in de_zonas), default=0)
    crudos = fixture_de_eliminacion(sembrados, ronda_inicial=ultima_ronda + 1)

    now = datetime.now(timezone.utc).isoformat()
    await db.tournament_fixtures.delete_many(
        {"tournament_id": tournament_id, "stage": {"$ne": "zona"}}
    )
    docs = await _persistir_fixtures(tournament_id, crudos, now)

    await db.tournaments.update_one(
        {"id": tournament_id}, {"$set": {"status": "eliminatoria"}}
    )

    nombres = {t["id"]: t["name"] for t in teams}
    return {
        "message": "Llaves generadas",
        "qualified": [nombres.get(t) for t in sembrados],
        "fixtures": [_serializar_fixture(fx, nombres) for fx in docs],
    }


@router.delete("/{tournament_id}")
async def delete_tournament(tournament_id: str, user=Depends(get_current_user)):
    tournament = await _get_tournament_or_404(tournament_id)
    await _ensure_can_manage(tournament, user)

    await db.tournament_fixtures.delete_many({"tournament_id": tournament_id})
    await db.tournament_teams.delete_many({"tournament_id": tournament_id})
    await db.tournaments.delete_one({"id": tournament_id})

    return {"message": "Torneo borrado"}
