from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_URL: str = "http://localhost:5173"
    JWT_SECRET: str = "change-this-to-a-long-random-secret-in-production"
    JWT_EXPIRES_MINUTES: int = 720
    ADMIN_EMAIL: str = "admin@certichain.edu"
    ADMIN_PASSWORD: str = "CertiChain@2026"
    ADMIN_NAME: str = "Dr. Elena Vance (Registrar)"
    SQLALCHEMY_DATABASE_URL: str = "sqlite:///./certichain.db"
    BLOCKCHAIN_RPC_URL: str = "http://127.0.0.1:8545"
    CONTRACT_ADDRESS: str = ""
    BLOCKCHAIN_PRIVATE_KEY: str = ""
    STRICT_BLOCKCHAIN_MODE: bool = False
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
