import os
import jwt
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.concurrency import run_in_threadpool

from database import db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 72


# bcrypt está hecho para ser lento a propósito: son ~150-300 ms de CPU por
# hasheo. Adentro de un handler async eso no es "el login tarda un poco", es el
# event loop parado ese cuarto de segundo, con todas las demás requests
# esperando. Por eso van por un thread.
async def hash_password(password: str) -> str:
    return await run_in_threadpool(pwd_context.hash, password)


async def verify_password(plain: str, hashed: str) -> bool:
    return await run_in_threadpool(pwd_context.verify, plain, hashed)


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    El rol sale de la base, NO del token.

    Antes se leía de payload["role"], que se congela cuando se emite el token y
    vive 72hs. Eso significaba que un admin degradado conservaba sus permisos
    hasta que venciera el token, que un ascenso no aplicaba hasta re-loguear, y
    que el token de un usuario borrado seguía siendo válido. El rol se usa para
    autorizar en ~20 lugares, así que tiene que reflejar el estado actual.

    El costo es una query por request autenticado, que va por el índice de
    users.id (ver INDEX_SPEC en database.py).
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="No autenticado")
    payload = decode_token(credentials.credentials)

    user_id = payload["sub"]
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "role": 1})
    if not user:
        # Cuenta borrada (o token de otra base): el token no debe seguir sirviendo.
        raise HTTPException(status_code=401, detail="La cuenta ya no existe")

    return {"user_id": user_id, "role": user.get("role", "jugador")}


def require_roles(allowed_roles: list):
    async def dependency(user=Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="No autorizado para esta acción")
        return user
    return dependency
