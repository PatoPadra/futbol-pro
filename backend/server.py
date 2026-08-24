from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
import os
import re
import logging
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from routes_auth import router as auth_router
from routes_profile import router as profile_router
from routes_matches import router as matches_router
from routes_teams import router as teams_router
from routes_post_match import router as post_match_router
from routes_players import router as players_router
from routes_admin import router as admin_router
from routes_groups import router as groups_router
from routes_tournaments import router as tournaments_router

app = FastAPI(title="App Fútbol API")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(matches_router)
app.include_router(teams_router)
app.include_router(post_match_router)
app.include_router(players_router)
app.include_router(admin_router)
app.include_router(groups_router)
app.include_router(tournaments_router)

@app.get("/api")
async def root():
    return {"message": "App Fútbol API v1"}

@app.get("/api/positions")
async def get_positions():
    from constants import POSITIONS
    return POSITIONS

@app.get("/api/genders")
async def get_genders():
    from constants import GENDERS
    return GENDERS


@app.get("/api/tournament-formats")
async def get_tournament_formats():
    from constants import TOURNAMENT_FORMATS
    return TOURNAMENT_FORMATS


@app.get("/api/formations")
async def get_formations():
    from constants import FORMATIONS, FORMATION_COORDS
    return {
        "formations": {k: v for k, v in FORMATIONS.items()},
        "coords": {k: v for k, v in FORMATION_COORDS.items()},
    }

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

from database import client as db_client, db as app_db, ensure_indexes

ADMIN_EMAILS = ["padrapatricio@gmail.com"]

REQUIRED_ENV_VARS = ("MONGO_URL", "DB_NAME", "JWT_SECRET")


def _validar_entorno():
    """
    Falla al arrancar y no en el primer login. Sin JWT_SECRET, auth.py lo deja en
    None y PyJWT recién explota cuando alguien intenta loguear, con un error que
    no dice nada. Preferimos que el deploy no levante.

    Va acá y no al importar auth.py a propósito: si rompiera el import, los tests
    que importan módulos del backend necesitarían el entorno completo seteado.
    """
    faltantes = [v for v in REQUIRED_ENV_VARS if not os.environ.get(v)]
    if faltantes:
        raise RuntimeError(
            "Faltan variables de entorno obligatorias: "
            + ", ".join(faltantes)
            + ". Configuralas en backend/.env (local) o en el panel del hosting."
        )


@app.on_event("startup")
async def startup():
    _validar_entorno()

    try:
        await ensure_indexes()
    except Exception as e:
        # Los índices son una optimización: que fallen no debe tumbar la app.
        logger.exception(f"No se pudieron crear los índices: {e}")

    try:
        for email in ADMIN_EMAILS:
            # Case-insensitive: un admin registrado antes de que se normalizaran
            # los emails puede estar guardado con mayúsculas y no matchearía.
            await app_db.users.update_many(
                {"email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}},
                {"$set": {"role": "admin"}}
            )
        logger.info("Admin emails promoted")
    except Exception as e:
        logger.exception(f"Startup Mongo error: {e}")

@app.on_event("shutdown")
async def shutdown():
    db_client.close()