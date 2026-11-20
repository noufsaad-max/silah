from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Silah API"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "postgresql+psycopg2://silah:silah@localhost:5432/silah"
    JWT_SECRET: str = "change-me-in-env"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Agent-pipeline persistence (products/runs/prospects/outreach), kept in
    # Supabase -- a separate datastore from DATABASE_URL above, which owns
    # auth/workspaces/onboarding only. See app/integrations/supabase/database.py
    # and docs/00-assumptions-and-decisions.md ("Hybrid persistence").
    # Credentials ONLY ever come from environment variables / .env -- never
    # hardcode a URL or key here or anywhere else in the codebase.
    SUPABASE_URL: str | None = None
    SUPABASE_KEY: str | None = None

    # Real agent LLM config (see app/agents/vendor/CHANGES.md). All optional:
    # unset means the real agent adapters can't be constructed (they raise
    # clearly on first use) but the mock adapters -- the default -- still
    # work with nothing configured.
    LLM_MODEL: str | None = None
    LLM_API_KEY: str | None = None
    LLM_BASE_URL: str | None = None
    SILAH_OPENAI_API_KEY: str | None = None
    SILAH_OPENAI_BASE_URL: str | None = None

    # Outreach sending (app/integrations/email/smtp_sender.py). Optional:
    # unset means "approve then send" still works but Send fails clearly
    # with a 503 instead of silently pretending to have sent anything --
    # see PipelineService.mark_sent. Credentials ONLY from env vars, same
    # rule as everything above.
    SMTP_HOST: str | None = None  # defaults to smtp.gmail.com if unset
    SMTP_PORT: int = 587
    SMTP_USE_TLS: bool = True
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None  # Gmail: an App Password, not your login password


settings = Settings()
