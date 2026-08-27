"""
Tests de las dos guardas de entorno que el alta abierta volvió necesarias.

Mientras el alta era cerrada —sólo entraba quien un organizador agregaba a
mano— estas dos cosas eran inocuas. Con cualquiera pudiendo registrarse y crear
grupos, dejaron de serlo:

  1. `CORS_ORIGINS` caía en "*" con `allow_credentials=True`, o sea que
     cualquier sitio podía hacerle pedidos autenticados a la API.

  2. La verificación de email apagada permite registrarse con una dirección que
     no es tuya. Lo grave no era la cuenta falsa en sí, sino que `register`
     VINCULABA AUTOMÁTICAMENTE el perfil de invitado que coincidiera por email:
     quien supiera que "juan@gmail.com" fue anotado como invitado se registraba
     con ese mail y heredaba la foto, el nivel estimado y el historial de Juan.

La segunda tiene además una trampa al revés: prender la verificación sin la key
de Brevo es PEOR que tenerla apagada, porque los mails no salen y nadie puede
activar su cuenta. Eso sí tiene que impedir que el server levante.

Los tests parchean `server.os.environ` con un dict propio en vez de tocar el
entorno de verdad: `backend/.env` se carga al importar `database`, así que
borrar una variable del entorno real no sirve —el próximo import la repone— y
además ensuciaría a los demás tests.
"""

import pytest

import server

BASE = {
    "MONGO_URL": "mongodb://localhost:27017",
    "DB_NAME": "test",
    "JWT_SECRET": "x",
    "CORS_ORIGINS": "https://futbol.pro",
}


def con_entorno(monkeypatch, **cambios):
    entorno = {**BASE, **cambios}
    entorno = {k: v for k, v in entorno.items() if v is not None}
    monkeypatch.setattr(server.os, "environ", entorno)
    return entorno


# --------------------------------------------------------------------- #
# CORS
# --------------------------------------------------------------------- #

def test_cors_origins_es_obligatoria():
    """Sin ella el default es '*', y con credenciales eso es la puerta abierta."""
    assert "CORS_ORIGINS" in server.REQUIRED_ENV_VARS


def test_el_server_no_levanta_sin_cors(monkeypatch):
    con_entorno(monkeypatch, CORS_ORIGINS=None)

    with pytest.raises(RuntimeError) as exc:
        server._validar_entorno()

    assert "CORS_ORIGINS" in str(exc.value)


def test_con_cors_configurada_levanta(monkeypatch):
    con_entorno(monkeypatch)
    server._validar_entorno()  # no explota


def test_cors_en_asterisco_levanta_pero_avisa(monkeypatch, caplog):
    """Se permite —hay quien lo necesita en desarrollo— pero no en silencio."""
    con_entorno(monkeypatch, CORS_ORIGINS="*")

    with caplog.at_level("WARNING"):
        server._validar_entorno()

    assert any("CORS_ORIGINS" in r.message for r in caplog.records)


def test_sigue_exigiendo_las_de_siempre(monkeypatch):
    """El agregado no puede haberse llevado puestas las tres que ya estaban."""
    for falta in ("MONGO_URL", "DB_NAME", "JWT_SECRET"):
        con_entorno(monkeypatch, **{falta: None})
        with pytest.raises(RuntimeError) as exc:
            server._validar_entorno()
        assert falta in str(exc.value)


# --------------------------------------------------------------------- #
# Verificación de email
# --------------------------------------------------------------------- #

def test_verificacion_prendida_sin_key_no_levanta(monkeypatch):
    """Es peor que apagada: los mails no salen y nadie puede activar su cuenta."""
    con_entorno(monkeypatch, EMAIL_VERIFICATION_ENABLED="true", BREVO_API_KEY=None)

    with pytest.raises(RuntimeError) as exc:
        server._avisar_si_falta_verificacion()

    assert "BREVO_API_KEY" in str(exc.value)


def test_verificacion_prendida_con_key_esta_bien(monkeypatch):
    con_entorno(monkeypatch, EMAIL_VERIFICATION_ENABLED="true", BREVO_API_KEY="una-key")
    server._avisar_si_falta_verificacion()  # no explota


def test_verificacion_apagada_levanta_pero_avisa_fuerte(monkeypatch, caplog):
    """Puede ser una decisión, pero no puede ser un olvido."""
    con_entorno(monkeypatch, EMAIL_VERIFICATION_ENABLED="false")

    with caplog.at_level("WARNING"):
        server._avisar_si_falta_verificacion()

    mensajes = " ".join(r.message for r in caplog.records)
    assert "APAGADA" in mensajes
    # Y dice la consecuencia concreta, no sólo que está apagada.
    assert "invitados" in mensajes


def test_sin_la_variable_se_comporta_como_apagada(monkeypatch, caplog):
    """El default es false, así que la ausencia tiene que avisar igual."""
    con_entorno(monkeypatch, EMAIL_VERIFICATION_ENABLED=None)

    with caplog.at_level("WARNING"):
        server._avisar_si_falta_verificacion()

    assert any("APAGADA" in r.message for r in caplog.records)
