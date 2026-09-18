from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8)
    role: Literal["admin", "employee"] = "employee"


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
    model_config = ConfigDict(from_attributes=True)


class DocumentOut(BaseModel):
    id: int
    original_name: str
    content_type: str | None
    size_bytes: int
    file_hash: str | None
    status: str
    progress: int
    chunk_count: int
    error: str | None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class QuestionIn(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    top_k: int = Field(default=5, ge=1, le=10)


class Source(BaseModel):
    document_id: int
    document_name: str
    page: int | None
    excerpt: str
    score: float | None = None


class AnswerOut(BaseModel):
    answer: str
    sources: list[Source]


class ReindexOut(BaseModel):
    message: str
    document_id: int
    status: str


class DashboardOut(BaseModel):
    documents: int
    ready_documents: int
    users: int
    queries: int

