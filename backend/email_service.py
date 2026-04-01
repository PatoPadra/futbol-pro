import os
import ssl
import smtplib
from urllib.parse import quote
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SMTP_HOST = os.environ.get("SMTP_HOST")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.environ.get("SMTP_FROM_EMAIL")
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")


def send_verification_email(email: str, name: str, token: str):
    if not SMTP_HOST or not SMTP_FROM_EMAIL:
        raise RuntimeError("Faltan SMTP_HOST o SMTP_FROM_EMAIL en variables de entorno")

    verify_url = f"{FRONTEND_URL}/verificar-email?token={quote(token)}"

    subject = "Verificá tu cuenta en App Futbol"

    text_body = f"""
Hola {name},

Gracias por registrarte en App Futbol.

Para activar tu cuenta, hacé click en este link:
{verify_url}

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
        <p>Si vos no creaste esta cuenta, ignorá este mensaje.</p>
      </body>
    </html>
    """

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = email
    message.attach(MIMEText(text_body, "plain", "utf-8"))
    message.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        if SMTP_USE_TLS:
            server.starttls(context=ssl.create_default_context())

        if SMTP_USERNAME and SMTP_PASSWORD:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)

        server.sendmail(SMTP_FROM_EMAIL, [email], message.as_string())