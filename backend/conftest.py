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

import pytest  # noqa: E402  (después de tocar sys.path)
from mongomock_motor import AsyncMongoMockClient  # noqa: E402



# El barrido se hace una sola vez y no en cada test: sys.modules tiene cientos de
# entradas con el venv cargado, y mirar el archivo de cada una son syscalls que
# en Windows se notan (eran ~1,5 s POR test, más de un minuto de suite).
#
# Se recalcula si aparecieron módulos nuevos, que es lo que pasa cuando pytest
# termina de importar el último archivo de tests.
_RAIZ = str(BACKEND_DIR) + os.sep
_VENV = str(BACKEND_DIR / "venv") + os.sep
_cache = {"modulos": None, "vistos": 0}


def _modulos_con_db():
    """Los módulos del backend que tienen atado un `db` del import."""
    if _cache["modulos"] is not None and len(sys.modules) == _cache["vistos"]:
        return _cache["modulos"]

    encontrados = []
    for modulo in list(sys.modules.values()):
        archivo = getattr(modulo, "__file__", None)
        if not archivo or not archivo.startswith(_RAIZ) or archivo.startswith(_VENV):
            continue
        if hasattr(modulo, "db"):
            encontrados.append(modulo)

    _cache["modulos"] = encontrados
    _cache["vistos"] = len(sys.modules)
    return encontrados


@pytest.fixture
def mongo_en_memoria(monkeypatch):
    """Mongo en memoria, limpio para cada test, en TODO el backend.

    Los módulos hacen `from database import db`, así que el nombre `db` queda
    atado en cada uno al importarse y hay que parchearlo módulo por módulo.

    Antes cada archivo de tests listaba los suyos a mano, y eso es un footgun con
    una punta muy fea: cuando una ruta empieza a apoyarse en un service nuevo, el
    test que no lo agregó a la lista le pega a la base DE VERDAD. No falla
    ruidosamente — o pasa igual habiendo escrito en producción, o revienta con un
    "Event loop is closed" que no dice nada de lo que pasó. Ya ocurrió dos veces.

    Acá se recorre lo que esté importado, se busca todo módulo del backend que
    tenga un `db`, y se lo parchea. Un service nuevo queda cubierto sin que nadie
    se acuerde de nada.
    """
    fake = AsyncMongoMockClient()["test"]
    for modulo in _modulos_con_db():
        monkeypatch.setattr(modulo, "db", fake, raising=False)
    return fake
