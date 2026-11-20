from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import User, UserStatus, Workspace, WorkspaceRole
from app.domain.schemas import LoginRequest, MeResponse, RegisterRequest, TokenResponse, WorkspaceProfile

router = APIRouter(prefix="/auth", tags=["auth"])


def _to_me_response(user: User) -> MeResponse:
    workspace = user.workspace
    return MeResponse(
        id=str(user.id),
        name=user.name,
        email=user.email,
        role=user.role.value,
        job_title=user.job_title,
        phone=user.phone,
        workspace=WorkspaceProfile(
            id=str(workspace.id),
            name=workspace.name,
            locale=workspace.locale,
            industry=workspace.industry,
            website=workspace.website,
            country=workspace.country,
            city=workspace.city,
            description=workspace.description,
        ),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    workspace = Workspace(name=payload.workspace_name, locale=payload.locale)
    db.add(workspace)
    db.flush()  # populate workspace.id before creating the user row

    user = User(
        workspace_id=workspace.id,
        name=payload.name,
        email=payload.email,
        role=WorkspaceRole.owner_admin,
        status=UserStatus.active,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()

    token = create_access_token(subject=str(user.id), workspace_id=str(workspace.id), role=user.role.value)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    token = create_access_token(subject=str(user.id), workspace_id=str(user.workspace_id), role=user.role.value)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)):
    return _to_me_response(current_user)
