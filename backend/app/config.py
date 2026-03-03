from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env", env_file_encoding="utf-8", extra="ignore"
    )

    # Database
    database_url: str = "postgresql+asyncpg://mailmind:mailmind_dev@localhost:5432/mailmind"

    # Qdrant
    qdrant_url: str = "http://localhost:6333"

    # Nylas
    nylas_client_id: str = ""
    nylas_api_key: str = ""
    nylas_api_uri: str = "https://api.us.nylas.com"

    # Session
    session_secret: str = "change-me-in-production"

    # CORS
    backend_cors_origins: str = "http://localhost:3000"

    # OpenAI
    openai_api_key: str = ""


settings = Settings()
