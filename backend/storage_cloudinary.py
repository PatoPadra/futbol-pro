import io
import logging

import cloudinary
import cloudinary.uploader
from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

# El SDK de Cloudinary es `requests` sincrónico. Llamarlo derecho adentro de un
# handler `async def` no hace lenta esa request: bloquea el event loop, o sea que
# mientras alguien sube una foto de 5 MB desde el celular NINGUNA otra request se
# atiende. Con un solo worker —que es como corre hoy— eso es la app entera
# congelada. Por eso las dos funciones públicas son async y el trabajo real pasa
# por un thread.

# Toma CLOUDINARY_URL desde el environment.
cloudinary.config(secure=True)


def _subir_sincronico(content: bytes, filename: str, folder: str):
    upload_result = cloudinary.uploader.upload(
        io.BytesIO(content),
        folder=folder,
        resource_type="image",
        use_filename=False,
        unique_filename=True,
        overwrite=False,
        filename=filename,
    )

    return {
        "photo_url": upload_result["secure_url"],
        "photo_public_id": upload_result["public_id"],
    }


async def upload_image_bytes(content: bytes, filename: str, folder: str = "futbol-pro"):
    return await run_in_threadpool(_subir_sincronico, content, filename, folder)


def _borrar_sincronico(public_id: str) -> bool:
    try:
        result = cloudinary.uploader.destroy(public_id, resource_type="image")
        ok = result.get("result") == "ok"
        if not ok:
            logger.warning("Cloudinary no borró %s: %s", public_id, result)
        return ok
    except Exception as e:
        # Nunca hacemos fallar la request por esto: la foto nueva ya se subió.
        logger.warning("Error borrando %s de Cloudinary: %s", public_id, e)
        return False


async def delete_image(public_id: str) -> bool:
    """
    Borra una imagen de Cloudinary. Best-effort: si falla, se loguea y se sigue.

    Se usa al REEMPLAZAR una foto. Antes el public_id viejo se pisaba en Mongo y
    el asset quedaba colgado en Cloudinary para siempre, acumulándose contra la
    cuota de la cuenta.
    """
    if not public_id:
        return False
    return await run_in_threadpool(_borrar_sincronico, public_id)
