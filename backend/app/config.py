from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    wall_config_path: str = "/config/wall-cast.yaml"
    weather_cache_ttl: int = 900   # 15 minutes
    rain_cache_ttl: int = 300      # 5 minutes
    news_cache_ttl: int = 600      # 10 minutes
    garbage_cache_ttl: int = 3600  # 1 hour
    polestar_cache_ttl: int = 300  # 5 minutes

    # Timezone used for calendar date/time display (IANA name, e.g. "Europe/Amsterdam")
    # Defaults to UTC if not set. Also used by the TZ env var if set.
    timezone: str = "UTC"

    polestar_username: str = ""
    polestar_password: str = ""

    google_calendar_id: str = ""
    google_sa_key_file: str = "/config/google-sa.json"
    calendar_cache_ttl: int = 600   # 10 minutes

    tomtom_api_key: str = ""
    traffic_cache_ttl: int = 300    # 5 minutes

    # Bus departures (vertrektijd.info)
    vertrektijd_api_key: str = ""
    bus_cache_ttl: int = 30         # 30 seconds (real-time data)
    bus_lookahead_min: int = 90     # show departures within this many minutes


settings = Settings()
