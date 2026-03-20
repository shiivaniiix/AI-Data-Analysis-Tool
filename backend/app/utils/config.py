from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openai_api_key: str = ""
    supabase_url: str = ""
    supabase_key: str = ""
    # Local dev: SQLite file beside cwd (see app/utils/db.py for engine options).
    # PostgreSQL: set DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname and pip install -r requirements-postgres.txt
    database_url: str = "sqlite:///./datachat.db"
    jwt_secret_key: str = "change_me_in_production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 120
    otp_expire_minutes: int = 10
    email_sender: str = ""
    email_password: str = ""
    debug_show_otp: bool = False
    supabase_storage_bucket: str = "datachat-ai-files"
    openai_model: str = "gpt-4o-mini"
    share_token_expire_minutes: int = 10080  # 7 days

    # Environment variables are loaded by app/main.py via `load_dotenv()`.
    # Keeping pydantic settings OS-env-only avoids double-loading and stale env-file variants.
    model_config = SettingsConfigDict()


settings = Settings()
