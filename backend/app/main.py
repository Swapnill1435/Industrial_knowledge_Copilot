from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from .auth import hash_password
from .config import get_settings
from .database import Base, SessionLocal, engine
from .models import Role, User
from .routers import auth, dashboard, documents, rag, users

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup sequence
    settings.ensure_directories()
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if not db.scalar(select(func.count(User.id))):
            admin_user = User(
                email=settings.initial_admin_email.lower(),
                full_name="System Administrator",
                password_hash=hash_password(settings.initial_admin_password),
                role=Role.admin,
            )
            db.add(admin_user)
            db.commit()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    description="Industrial Knowledge Copilot API with RAG pipeline and background indexing",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        settings.frontend_origin,
    ],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoint
@app.get("/health", tags=["system"])
def health():
    return {"status": "ok", "app": settings.app_name, "version": "0.2.0"}


# Register sub-routers
app.include_router(auth.router, prefix=settings.api_prefix)
app.include_router(users.router, prefix=settings.api_prefix)
app.include_router(documents.router, prefix=settings.api_prefix)
app.include_router(rag.router, prefix=settings.api_prefix)
app.include_router(dashboard.router, prefix=settings.api_prefix)
