from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import SessionLocal

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_claims(token: str = Depends(oauth2_scheme)) -> dict:
    claims = decode_access_token(token)
    if claims is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return claims


def get_current_workspace_id(claims: dict = Depends(get_current_claims)) -> str:
    # Every workspace-scoped query in the app must filter by this value.
    # Never trust a workspace_id passed in a request body or query string.
    return claims["workspace_id"]


def get_current_user(claims: dict = Depends(get_current_claims), db: Session = Depends(get_db)):
    # Import here (not at module top) to avoid a circular import between
    # deps and models at app startup.
    import uuid

    from app.db.models import User

    # claims["sub"] is a plain string from the JWT payload -- convert to a
    # real uuid.UUID explicitly rather than relying on the Uuid column type
    # to coerce a bare string on the way into the query.
    try:
        user_id = uuid.UUID(claims["sub"])
    except (ValueError, KeyError, AttributeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists")
    return user


def require_role(*allowed_roles: str):
    def checker(claims: dict = Depends(get_current_claims)) -> dict:
        if claims.get("role") not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return claims

    return checker
