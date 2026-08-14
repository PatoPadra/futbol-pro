import io
import logging

import cloudinary
import cloudinary.uploader

logger = logging.getLogger(__name__)

# Toma CLOUDINARY_URL desde el environment.
cloudinary.config(secure=True)


def upload_image_bytes(content: bytes, filename: str, folder: str = "futbol-pro"):
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

def delete_image(public_id: str) -> bool:
    """
    Borra una imagen de Cloudinary. Best-effort: si falla, se loguea y se sigue.

    Se usa al REEMPLAZAR una foto. Antes el public_id viejo se pisaba en Mongo y
    el asset quedaba colgado en Cloudinary para siempre, acumulándose contra la
    cuota de la cuenta.
    """
    if not public_id:
        return False
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
