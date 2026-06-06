from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "dev"
    database_url: str = "sqlite:////data/app.db"
    jwt_secret: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    jwt_ttl_days: int = 30

    public_base_url: str = "http://localhost:4321"
    cors_origins: str = "http://localhost:4321"

    dicebear_url: str = "http://dicebear:3000"
    dicebear_style: str = "pixel-art"

    ollama_url: str = ""
    ollama_model: str = "qwen2.5:3b-instruct"
    ollama_timeout_s: int = 30
    ollama_rate_limit_per_min: int = 3

    admin_password_hash: str = ""
    bot_token: str = ""  # Shared secret pour les appels FenrirBot ↔ lycee-app
    fenrirbot_url: str = "http://fenrirbot:8085"

    discord_webhook_questions: str = ""
    discord_webhook_staff: str = ""
    discord_invite_url: str = ""

    rate_limit_signup_per_hour: int = 15
    rate_limit_events_per_min: int = 60

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
