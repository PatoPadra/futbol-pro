"""
Envío de mails vía la API HTTP de Brevo.

Antes esto usaba SMTP, que no sirve en Render: el plan free bloquea los puertos
de SMTP saliente. La API de Brevo va por HTTPS normal, así que pasa sin problema.

Variables de entorno:
    BREVO_API_KEY       (obligatoria) la key de Brevo, panel > SMTP & API > API Keys
    BREVO_SENDER_EMAIL  (obligatoria) dirección remitente
    BREVO_SENDER_NAME   (opcional)    nombre visible, por defecto "App Fútbol"
    FRONTEND_URL        (opcional)    base del link de verificación

Sobre el remitente: si el dominio de BREVO_SENDER_EMAIL no está autenticado en
Brevo, Brevo lo reemplaza automáticamente por uno propio (@brevosend.com) para
cumplir con las reglas de Gmail y Yahoo. El mail llega igual; sólo se ve una
dirección genérica. Cuando tengas dominio propio y lo autentiques, el remitente
pasa a ser el tuyo sin tocar una línea de código.
"""

import logging
import os
from urllib.parse import quote

import httpx

logger = logging.getLogger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
TIMEOUT_SEGUNDOS = 15.0


def _construir_mail(email: str, name: str, token: str) -> dict:
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    # safe="" para que escape TODO, incluida la barra: quote() por defecto la
    # deja pasar y rompería el parámetro. Hoy secrets.token_urlsafe no genera
    # barras, pero no queremos que el link dependa de eso.
    verify_url = f"{frontend_url}/verificar-email?token={quote(token, safe='')}"

    text_body = f"""
Hola {name},

Gracias por registrarte en App Futbol.

Para activar tu cuenta, entrá en este link:
{verify_url}

El link vence en 24 horas.

Si vos no creaste esta cuenta, ignorá este mensaje.
""".strip()

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #0f172a;">
        <h2>Verificá tu cuenta</h2>
        <p>Hola <strong>{name}</strong>,</p>
        <p>Gracias por registrarte en App Futbol.</p>
        <p>Para activar tu cuenta, hacé click en este botón:</p>
        <p>
          <a href="{verify_url}"
             style="display:inline-block;padding:12px 20px;background:#16a34a;color:#fff;text-decoration:none;border-radius:10px;font-weight:bold;">
             Verificar cuenta
          </a>
        </p>
        <p>Si el botón no funciona, copiá y pegá este link:</p>
        <p>{verify_url}</p>
        <p style="color:#64748b;font-size:13px;">El link vence en 24 horas.</p>
        <p>Si vos no creaste esta cuenta, ignorá este mensaje.</p>
      </body>
    </html>
    """

    return {
        "sender": {
            "email": os.environ["BREVO_SENDER_EMAIL"],
            "name": os.environ.get("BREVO_SENDER_NAME", "App Fútbol"),
        },
        "to": [{"email": email, "name": name}],
        "subject": "Verificá tu cuenta en App Futbol",
        "htmlContent": html_body,
        "textContent": text_body,
    }


async def send_verification_email(email: str, name: str, token: str) -> str:
    """
    Manda el mail de verificación. Devuelve el messageId de Brevo.

    Es async a propósito: la versión con SMTP era bloqueante y se llamaba desde
    una ruta async, así que frenaba el event loop entero mientras hablaba con el
    servidor de mail. Con httpx.AsyncClient el resto de los requests siguen
    andando.

    Levanta RuntimeError si falta configuración o si Brevo rechaza el envío. Los
    llamadores deciden qué hacer con eso.
    """
    api_key = os.environ.get("BREVO_API_KEY")
    sender_email = os.environ.get("BREVO_SENDER_EMAIL")
    if not api_key or not sender_email:
        raise RuntimeError(
            "Faltan BREVO_API_KEY o BREVO_SENDER_EMAIL en las variables de entorno"
        )

    payload = _construir_mail(email, name, token)

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SEGUNDOS) as client:
            response = await client.post(
                BREVO_API_URL,
                json=payload,
                headers={
                    "api-key": api_key,
                    "content-type": "application/json",
                    "accept": "application/json",
                },
            )
    except httpx.HTTPError as e:
        raise RuntimeError(f"No se pudo contactar a Brevo: {e}") from e

    # 201 = enviado. Cualquier otra cosa es un problema.
    if response.status_code != 201:
        # El cuerpo del error de Brevo no incluye la API key, es seguro loguearlo.
        raise RuntimeError(
            f"Brevo rechazó el envío (HTTP {response.status_code}): {response.text}"
        )

    message_id = response.json().get("messageId", "")
    logger.info("Mail de verificación enviado a %s (messageId=%s)", email, message_id)
    return message_id
