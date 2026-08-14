"""Tests de la parte pura del rate limiter: la resolución de la IP del cliente."""

from types import SimpleNamespace

from services.rate_limit import client_ip


def _request(headers=None, host="10.0.0.1"):
    """Request mínimo: client_ip sólo mira .headers y .client."""
    return SimpleNamespace(
        headers=headers or {},
        client=SimpleNamespace(host=host) if host else None,
    )


def test_sin_proxy_usa_la_ip_de_la_conexion():
    assert client_ip(_request(host="203.0.113.7")) == "203.0.113.7"


def test_detras_del_proxy_usa_el_primer_x_forwarded_for():
    # Render mete la IP real primera y va agregando los proxies a la derecha.
    req = _request(headers={"x-forwarded-for": "203.0.113.7, 70.41.3.18"}, host="10.0.0.1")
    assert client_ip(req) == "203.0.113.7"


def test_x_forwarded_for_con_espacios_se_limpia():
    req = _request(headers={"x-forwarded-for": "  203.0.113.7  ,10.0.0.2"})
    assert client_ip(req) == "203.0.113.7"


def test_x_forwarded_for_con_una_sola_ip():
    assert client_ip(_request(headers={"x-forwarded-for": "203.0.113.7"})) == "203.0.113.7"


def test_sin_client_no_explota():
    # Puede pasar con algunos transportes de test; no queremos un 500 en el login.
    assert client_ip(_request(host=None)) == "desconocido"


def test_x_forwarded_for_vacio_cae_a_la_ip_de_conexion():
    req = _request(headers={"x-forwarded-for": ""}, host="203.0.113.9")
    assert client_ip(req) == "203.0.113.9"
