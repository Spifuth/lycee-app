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
    # API-version segment of the DiceBear URL. This is a contract with the deployed
    # dicebear/api image, NOT a constant: image v2 serves /9.x/, image v4 serves
    # /10.x/ and 404s on /9.x/. Bump this in the same change as the image tag.
    dicebear_api_version: str = "10.x"

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

    # --- Limites de débit ---------------------------------------------------
    # Toutes sont indexées sur l'IP client (`Limiter(key_func=get_remote_address)`).
    # Dans une salle de classe, les ~30 élèves partagent UNE SEULE IP publique
    # (NAT du wifi de l'établissement), donc chaque valeur ci-dessous est en
    # pratique un budget pour toute la salle, pas par élève. Elles sont calibrées
    # dans ce sens, et exposées en configuration pour rester réglables le jour J
    # via Infisical sans reconstruire l'image.
    #
    # Ne pas confondre avec l'incident du 2026-05-26 : celui-là venait de
    # `--proxy-headers` manquant, qui écrasait des IP distinctes dans un seul
    # compteur. Ce correctif fonctionne. Ici le comptage par IP est correct — et
    # un comptage par IP correct est exactement ce qu'il ne faut pas quand toute
    # la salle est derrière la même IP.
    rate_limit_signup_per_hour: int = 120
    rate_limit_login_per_min: int = 60
    rate_limit_login_qr_per_min: int = 60
    rate_limit_quiz_submit_per_min: int = 120
    rate_limit_vote_per_min: int = 120
    rate_limit_question_per_min: int = 60
    rate_limit_reaction_per_min: int = 240
    rate_limit_discord_click_per_min: int = 60
    rate_limit_easter_egg_per_min: int = 60
    rate_limit_events_per_min: int = 600

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
