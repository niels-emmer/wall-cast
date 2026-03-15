from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    wall_config_path: str = "/config/wall-cast.yaml"
    weather_cache_ttl: int = 900   # 15 minutes
    rain_cache_ttl: int = 300      # 5 minutes
    news_cache_ttl: int = 600      # 10 minutes


settings = Settings()
