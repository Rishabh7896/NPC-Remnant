from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = ""
    database_url: str = "sqlite:///./remnant.db"
    frontend_origin: str = "http://localhost:5173"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

settings = Settings()
