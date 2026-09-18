import hashlib
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin
from ..config import get_settings
from ..database import get_db
from ..models import Document, DocumentStatus, User
from ..schemas import DocumentOut, ReindexOut
from ..services.indexing import process_document_background
from ..services.rag import delete_document_vectors

router = APIRouter(prefix="/documents", tags=["documents"])
settings = get_settings()

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".xlsx", ".txt"}


@router.get("", response_model=list[DocumentOut])
def list_documents(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list(db.scalars(select(Document).order_by(Document.created_at.desc())))


@router.post("", response_model=DocumentOut, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    filename = file.filename or "file.txt"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    content = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.max_upload_size_mb} MB.",
        )

    if len(content) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    # Calculate SHA-256 hash for deduplication
    file_hash = hashlib.sha256(content).hexdigest()
    existing_doc = db.scalar(select(Document).where(Document.file_hash == file_hash))
    if existing_doc:
        if existing_doc.status == DocumentStatus.ready:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Duplicate document! An identical file is already indexed: '{existing_doc.original_name}' (ID: {existing_doc.id}).",
            )
        elif existing_doc.status == DocumentStatus.processing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Document '{existing_doc.original_name}' is currently being processed.",
            )

    stored_name = f"{uuid4().hex}{suffix}"
    upload_dir = Path(settings.upload_path)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = upload_dir / stored_name
    file_path.write_bytes(content)

    doc = Document(
        original_name=filename,
        stored_name=stored_name,
        content_type=file.content_type,
        size_bytes=len(content),
        file_hash=file_hash,
        status=DocumentStatus.processing,
        progress=5,
        uploaded_by_id=current.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Launch indexing in background task
    background_tasks.add_task(process_document_background, doc.id)

    return doc


@router.post("/{document_id}/reindex", response_model=ReindexOut)
def reindex_document(
    document_id: int,
    background_tasks: BackgroundTasks,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    file_path = Path(settings.upload_path) / doc.stored_name
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Stored file for document '{doc.original_name}' is missing on server.",
        )

    doc.status = DocumentStatus.processing
    doc.progress = 5
    doc.error = None
    db.commit()

    background_tasks.add_task(process_document_background, doc.id)

    return ReindexOut(
        message=f"Re-indexing initiated for document '{doc.original_name}'.",
        document_id=doc.id,
        status=doc.status.value,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    doc = db.get(Document, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    delete_document_vectors(doc.id)
    file_path = Path(settings.upload_path) / doc.stored_name
    if file_path.exists():
        file_path.unlink()

    db.delete(doc)
    db.commit()
