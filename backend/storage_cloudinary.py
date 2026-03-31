import io
import cloudinary
import cloudinary.uploader

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