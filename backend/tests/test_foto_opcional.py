"""
Tests de que la foto de perfil es DE VERDAD opcional.

EL BUG QUE ESTOS TESTS CUIDAN: la pantalla de alta subía la foto ANTES de
guardar el perfil, y `upload_image_bytes` no atrapaba nada. CUALQUIER fallo de
la subida —un timeout, la red del celular, un arranque en frío con una foto de
5 MB— salía como un 500 sin manejar, el front cortaba en el `await` y el
`PUT /api/profile` no salía nunca. Al usuario le llegaba "Internal Server Error".

Varios usuarios reportaron no poder crear su perfil desde el celular; en la base
había 19 registrados y CERO partidos jugados.

La foto es el paso 1 de la pantalla y el cuadro más grande, así que casi todo el
mundo la tocaba. Y no había forma de sacarla: reintentar volvía a fallar igual.

Dos garantías acá:
  1. Sin credenciales no se escapa la excepción cruda del SDK: sale
     `ImagenNoSubida`, que las rutas traducen a un 503 legible.
  2. Que la foto falle no toca el perfil: los datos que la persona cargó
     siguen guardados.
"""

import uuid
from datetime import datetime, timezone

import cloudinary
import pytest
from fastapi import HTTPException

import routes_profile as rp
import storage_cloudinary as sc
from models import ProfileUpdate

AHORA = datetime.now(timezone.utc)


@pytest.fixture
def sin_credenciales(monkeypatch):
    """Cloudinary sin configurar.

    Es la forma más directa y determinista de hacer fallar la subida; el fallo
    que se ve en la cancha suele ser un timeout, pero para el llamador el
    contrato es el mismo.
    """
    monkeypatch.setattr(cloudinary.config(), "api_key", None, raising=False)
    return True


async def sembrar_perfil_vacio(db):
    user_id = str(uuid.uuid4())
    await db.player_profiles.insert_one({
        "id": str(uuid.uuid4()), "user_id": user_id, "name": "Juan",
        "email": "juan@example.com", "player_type": "frecuente",
        "birth_date": None, "gender": None, "primary_position": None,
        "secondary_positions": [], "matches_played": 0,
        "created_at": AHORA.isoformat(),
    })
    return {"user_id": user_id, "role": "jugador"}


async def test_sin_credenciales_no_se_escapa_el_error_del_sdk(sin_credenciales):
    """Antes salía `ValueError: Must supply api_key` y el usuario veía un 500."""
    assert sc.hay_credenciales() is False

    with pytest.raises(sc.ImagenNoSubida):
        await sc.upload_image_bytes(b"loquesea", "foto.jpg", "futbol-pro/profiles")


async def test_el_error_de_cloudinary_se_envuelve(monkeypatch):
    """Cualquier fallo de la subida —red, timeout, cuota— sale como ImagenNoSubida."""
    monkeypatch.setattr(cloudinary.config(), "api_key", "una-clave", raising=False)

    def explota(*args, **kwargs):
        raise RuntimeError("Cloudinary se cayó")

    monkeypatch.setattr(sc, "_subir_sincronico", explota)

    with pytest.raises(sc.ImagenNoSubida):
        await sc.upload_image_bytes(b"loquesea", "foto.jpg", "futbol-pro/profiles")


async def test_la_ruta_contesta_503_y_no_500(mongo_en_memoria, sin_credenciales):
    """El front muestra el `detail` tal cual: tiene que ser castellano legible."""
    user = await sembrar_perfil_vacio(mongo_en_memoria)

    class ArchivoFalso:
        content_type = "image/jpeg"
        filename = "foto.jpg"

        async def read(self):
            return b"bytes-de-una-foto"

    with pytest.raises(HTTPException) as e:
        await rp.upload_photo(file=ArchivoFalso(), user=user)

    assert e.value.status_code == 503
    assert "Internal Server Error" not in str(e.value.detail)
    assert "perfil" in e.value.detail.lower()


async def test_el_perfil_se_guarda_aunque_la_foto_falle(mongo_en_memoria, sin_credenciales):
    """El corazón del arreglo: la foto opcional no puede costar el alta.

    Reproduce el orden que usa la pantalla ahora — perfil primero, foto
    después— y comprueba que el fallo de la segunda no borra a la primera.
    """
    user = await sembrar_perfil_vacio(mongo_en_memoria)

    await rp.update_profile(
        ProfileUpdate(
            name="Juan Perez",
            birth_date="1995-06-15",
            gender="masculino",
            primary_position="ST",
        ),
        user=user,
    )

    class ArchivoFalso:
        content_type = "image/jpeg"
        filename = "foto.jpg"

        async def read(self):
            return b"bytes-de-una-foto"

    with pytest.raises(HTTPException):
        await rp.upload_photo(file=ArchivoFalso(), user=user)

    guardado = await mongo_en_memoria.player_profiles.find_one({"user_id": user["user_id"]})
    assert guardado["birth_date"] == "1995-06-15"
    assert guardado["gender"] == "masculino"
    assert guardado["primary_position"] == "ST"
    assert guardado.get("photo_url") is None

    # Y con esos tres campos el login ya lo considera un perfil completo, que es
    # lo que destraba el resto de la app (ver has_profile en routes_auth).
    assert bool(guardado.get("primary_position") and guardado.get("birth_date"))
