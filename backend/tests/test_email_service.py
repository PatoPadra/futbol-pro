"""Tests de la construcción del mail de verificación (sin tocar la red)."""

import os

import pytest

from email_service import _construir_mail


@pytest.fixture(autouse=True)
def _entorno(monkeypatch):
    monkeypatch.setenv("BREVO_SENDER_EMAIL", "no-responder@ejemplo.com")
    monkeypatch.delenv("BREVO_SENDER_NAME", raising=False)
    monkeypatch.setenv("FRONTEND_URL", "https://futbol-pro.onrender.com")


def test_payload_tiene_la_forma_que_espera_brevo():
    p = _construir_mail("jugador@gmail.com", "Matías", "tok123")
    assert set(p) == {"sender", "to", "subject", "htmlContent", "textContent"}
    assert p["sender"]["email"] == "no-responder@ejemplo.com"
    assert p["to"] == [{"email": "jugador@gmail.com", "name": "Matías"}]
    assert p["subject"]


def test_nombre_de_remitente_por_defecto():
    assert _construir_mail("a@b.com", "Ana", "t")["sender"]["name"] == "App Fútbol"


def test_nombre_de_remitente_configurable(monkeypatch):
    monkeypatch.setenv("BREVO_SENDER_NAME", "Fútbol Pro")
    assert _construir_mail("a@b.com", "Ana", "t")["sender"]["name"] == "Fútbol Pro"


def test_link_de_verificacion_usa_frontend_url():
    p = _construir_mail("a@b.com", "Ana", "tok123")
    esperado = "https://futbol-pro.onrender.com/verificar-email?token=tok123"
    assert esperado in p["htmlContent"]
    assert esperado in p["textContent"]


def test_frontend_url_con_barra_final_no_duplica_la_barra():
    # Un FRONTEND_URL mal cargado en Render no debe romper el link.
    os.environ["FRONTEND_URL"] = "https://futbol-pro.onrender.com/"
    p = _construir_mail("a@b.com", "Ana", "tok")
    assert "onrender.com/verificar-email" in p["textContent"]
    assert "onrender.com//verificar-email" not in p["textContent"]


def test_el_token_se_escapa_en_la_url():
    # secrets.token_urlsafe no genera estos caracteres, pero si algún día cambia
    # el generador, el link no se tiene que romper.
    p = _construir_mail("a@b.com", "Ana", "a+b/c=d")
    assert "token=a%2Bb%2Fc%3Dd" in p["textContent"]


def test_ambas_versiones_del_cuerpo_llevan_el_nombre():
    p = _construir_mail("a@b.com", "Matías", "t")
    assert "Matías" in p["htmlContent"]
    assert "Matías" in p["textContent"]
