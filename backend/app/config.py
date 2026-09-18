from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Industrial Knowledge Copilot"
    api_prefix: str = "/api"
    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-2.5-flash"
    gemini_embedding_model: str = "gemini-embedding-001"
    jwt_secret: str = "development-only-change-me"
    access_token_expire_minutes: int = 480
    database_url: str = "sqlite:///./data/app.db"
    chroma_path: str = "./data/chroma"
    upload_path: str = "./uploads"
    max_upload_size_mb: int = 25
    distance_threshold: float = 0.85
    frontend_origin: str = "http://localhost:5173"
    initial_admin_email: str = "admin@example.com"
    initial_admin_password: str = "ChangeMe123!"

    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    def ensure_directories(self) -> None:
        Path(self.upload_path).mkdir(parents=True, exist_ok=True)
        Path(self.chroma_path).mkdir(parents=True, exist_ok=True)
        if self.database_url.startswith("sqlite:///./"):
            Path(self.database_url.removeprefix("sqlite:///./")).parent.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()

