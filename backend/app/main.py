from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.certificate import User

Base.metadata.create_all(bind=engine)

with SessionLocal() as db:
    existing = db.query(User).filter(User.email == settings.ADMIN_EMAIL.lower()).first()
    if not existing:
        db.add(
            User(
                email=settings.ADMIN_EMAIL.lower(),
                name=settings.ADMIN_NAME,
                role="admin",
                password_hash=hash_password(settings.ADMIN_PASSWORD),
            )
        )
        db.commit()

app = FastAPI(
    title="CertiChain Academic Certificate Verification API",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/docs/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
