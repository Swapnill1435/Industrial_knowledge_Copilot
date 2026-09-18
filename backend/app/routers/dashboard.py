from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import Document, DocumentStatus, QueryLog, User
from ..schemas import DashboardOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardOut)
def dashboard(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return DashboardOut(
        documents=db.scalar(select(func.count(Document.id))) or 0,
        ready_documents=db.scalar(select(func.count(Document.id)).where(Document.status == DocumentStatus.ready)) or 0,
        users=db.scalar(select(func.count(User.id))) or 0,
        queries=db.scalar(select(func.count(QueryLog.id))) or 0,
    )
