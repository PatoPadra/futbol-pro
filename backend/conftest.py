"""Config de pytest para el backend.

Deja el directorio backend/ en sys.path y garantiza las env vars que
database.py exige al importarse (MONGO_URL y DB_NAME). AsyncIOMotorClient
no abre la conexion hasta la primera query, asi que los tests unitarios
corren sin Mongo levantado.
"""

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).parent

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "futbol_pro_test")
