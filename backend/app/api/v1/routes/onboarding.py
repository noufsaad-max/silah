from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.routes.auth import _to_me_response
from app.core.deps import get_current_user, get_db
from app.db.models import User
from app.domain.schemas import MeResponse, OnboardingCompleteRequest

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.post("/complete", response_model=MeResponse)
def complete_onboarding(
    payload: OnboardingCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workspace = current_user.workspace

    if payload.company_name is not None:
        workspace.name = payload.company_name
    if payload.industry is not None:
        workspace.industry = payload.industry
    if payload.website is not None:
        workspace.website = payload.website
    if payload.country is not None:
        workspace.country = payload.country
    if payload.city is not None:
        workspace.city = payload.city
    if payload.company_description is not None:
        workspace.description = payload.company_description

    if payload.name is not None:
        current_user.name = payload.name
    if payload.job_title is not None:
        current_user.job_title = payload.job_title
    if payload.phone is not None:
        current_user.phone = payload.phone

    db.commit()
    db.refresh(current_user)
    return _to_me_response(current_user)
