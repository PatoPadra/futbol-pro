from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import os
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

@app.get("/api")
async def root():
    return {"message": "App Fútbol API v1"}

@app.get("/api/positions")
async def get_positions():
    from constants import POSITIONS
    return POSITIONS

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

from database import client as db_client, db as app_db

ADMIN_EMAILS = ["padrapatricio@gmail.com"]

@app.on_event("startup")
async def startup():
    try:
        for email in ADMIN_EMAILS:
            await app_db.users.update_many(
                {"email": email},
                {"$set": {"role": "admin"}}
            )
        logger.info("Admin emails promoted")
    except Exception as e:
        logger.exception(f"Startup Mongo error: {e}")

@app.on_event("shutdown")
async def shutdown():
    db_client.close()