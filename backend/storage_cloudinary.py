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


class ImagenNoSubida(Exception):
    """No se pudo guardar la imagen en Cloudinary.

    Existe para que las rutas puedan distinguir "falló la foto" de cualquier
    otra cosa y contestar algo legible. Antes no había nada: sin CLOUDINARY_URL
    el SDK levantaba `ValueError: Must supply api_key` desde adentro del
    handler, FastAPI devolvía un 500 pelado y al usuario le llegaba
    "Internal Server Error" en inglés.

    La foto es SIEMPRE opcional. Ninguna operación de verdad —completar el
    perfil, crear un invitado— puede fallar porque falle esto.
    """


def hay_credenciales() -> bool:
    """¿Está configurada la cuenta de Cloudinary?

    Sin CLOUDINARY_URL el SDK no se queja al importar ni al configurar: explota
    recién cuando alguien sube una foto. Preguntarlo antes deja avisar con un
    mensaje que se entiende en lugar de un error de librería.
    """
    return bool(cloudinary.config().api_key)


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
    """Sube la imagen y devuelve {photo_url, photo_public_id}.

    Levanta `ImagenNoSubida` ante cualquier problema —cuenta sin configurar,
    Cloudinary caído, timeout— para que el llamador decida qué hacer. Nunca
    deja escapar la excepción cruda del SDK.
    """
    if not hay_credenciales():
        logger.error(
            "CLOUDINARY_URL no está configurada: no se pueden subir imágenes."
        )
        raise ImagenNoSubida("El servicio de fotos no está configurado")

    try:
        return await run_in_threadpool(_subir_sincronico, content, filename, folder)
    except Exception as e:
        logger.warning("Error subiendo %s a Cloudinary: %s", filename, e)
        raise ImagenNoSubida("No pudimos subir la imagen") from e


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
