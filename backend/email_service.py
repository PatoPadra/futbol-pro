import os
import ssl
import smtplib
from urllib.parse import quote
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText


def send_verification_email(email: str, name: str, token: str):
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_username = os.environ.get("SMTP_USERNAME")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    smtp_from_email = os.environ.get("SMTP_FROM_EMAIL")
    smtp_use_tls = os.environ.get("SMTP_USE_TLS", "true").lower() == "true"
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")

    if not smtp_host or not smtp_from_email:
        raise RuntimeError("Faltan SMTP_HOST o SMTP_FROM_EMAIL en variables de entorno")

    verify_url = f"{frontend_url}/verificar-email?token={quote(token)}"

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
    message["From"] = smtp_from_email
    message["To"] = email
    message.attach(MIMEText(text_body, "plain", "utf-8"))
    message.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        if smtp_use_tls:
            server.starttls(context=ssl.create_default_context())

        if smtp_username and smtp_password:
            server.login(smtp_username, smtp_password)

        server.sendmail(smtp_from_email, [email], message.as_string())