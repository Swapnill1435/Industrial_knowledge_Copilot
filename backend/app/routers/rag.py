from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import QueryLog, User
from ..schemas import AnswerOut, QuestionIn
from ..services.rag import answer_question

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/query", response_model=AnswerOut)
def query(payload: QuestionIn, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        answer, sources = answer_question(payload.question, payload.top_k)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"RAG query service error: {exc}")

    # Log query history
    db.add(QueryLog(question=payload.question, user_id=current.id))
    db.commit()

    return AnswerOut(answer=answer, sources=sources)
