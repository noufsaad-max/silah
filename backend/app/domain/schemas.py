from pydantic import BaseModel, EmailStr


class WorkspaceCreate(BaseModel):
    name: str
    locale: str = "en"


class RegisterRequest(BaseModel):
    workspace_name: str
    name: str
    email: EmailStr
    password: str
    locale: str = "en"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class WorkspaceProfile(BaseModel):
    id: str
    name: str
    locale: str
    industry: str | None = None
    website: str | None = None
    country: str | None = None
    city: str | None = None
    description: str | None = None


class MeResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    job_title: str | None = None
    phone: str | None = None
    workspace: WorkspaceProfile


class OnboardingCompleteRequest(BaseModel):
    # Workspace fields (brief section 6, "Company Information")
    company_name: str | None = None
    industry: str | None = None
    website: str | None = None
    country: str | None = None
    city: str | None = None
    company_description: str | None = None
    # User fields (brief section 6, "Personal Information")
    name: str | None = None
    job_title: str | None = None
    phone: str | None = None
    # Product/campaign fields (product_name, target_market, etc.) are
    # intentionally NOT here -- there is no Campaign table yet (Phase 2,
    # see docs/03-implementation-plan.md). The onboarding wizard keeps that
    # part of its state in the browser only until Phase 2 lands.
