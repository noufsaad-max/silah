from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# NOTE: we use the `bcrypt` package directly instead of passlib's
# CryptContext. passlib 1.7.4 (unmaintained since 2020) does a
# version-sniffing self-test against bcrypt's internals at import/first-use
# time that is incompatible with bcrypt>=4.1 -- it surfaces as
#   AttributeError: module 'bcrypt' has no attribute '__about__'
# followed by a spurious
#   ValueError: password cannot be longer than 72 bytes
# on ANY password, even short ones. Calling bcrypt.hashpw/checkpw ourselves
# avoids passlib entirely.

_BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    pw_bytes = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    pw_bytes = plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    try:
        return bcrypt.checkpw(pw_bytes, hashed.encode("utf-8"))
    except ValueError:
        # malformed/legacy hash
        return False


def create_access_token(subject: str, workspace_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "workspace_id": workspace_id, "role": role, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
