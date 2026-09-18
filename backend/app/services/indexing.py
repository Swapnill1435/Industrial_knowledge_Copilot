import logging
from pathlib import Path

# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import SessionLocal
from ..models import Document, DocumentStatus
from .extraction import chunk_pages, extract_pages
from .rag import index_document

logger = logging.getLogger("indexing")
settings = get_settings()


def process_document_background(document_id: int) -> None:
    """
    Background worker task to extract, chunk, embed, and index a document.
    Updates Document progress percentage and status in DB.
    """
    db: Session = SessionLocal()
    try:
        doc = db.get(Document, document_id)
        if not doc:
            logger.error(f"Document {document_id} not found for background indexing.")
            return

        doc.status = DocumentStatus.processing
        doc.progress = 10
        doc.error = None
        db.commit()

        path = Path(settings.upload_path) / doc.stored_name
        if not path.exists():
            raise FileNotFoundError(f"Stored file does not exist: {doc.stored_name}")

        # Step 1: Extraction (10% -> 30%)
        logger.info(f"Extracting pages from document {document_id}...")
        pages = extract_pages(path)
        doc.progress = 35
        db.commit()

        # Step 2: Chunking (35% -> 55%)
        logger.info(f"Chunking pages for document {document_id}...")
        chunks = chunk_pages(pages)
        if not chunks:
            raise ValueError("No readable text content extracted from document.")
        doc.progress = 60
        db.commit()

        # Step 3: Embedding & Chroma Vector Indexing (60% -> 90%)
        logger.info(f"Indexing {len(chunks)} chunks into vector store for document {document_id}...")
        index_document(doc.id, doc.original_name, chunks)
        doc.progress = 90
        db.commit()

        # Step 4: Completion (100%)
        doc.status = DocumentStatus.ready
        doc.progress = 100
        doc.chunk_count = len(chunks)
        db.commit()
        logger.info(f"Document {document_id} successfully indexed into knowledge base.")

    except Exception as exc:
        logger.exception(f"Failed to index document {document_id}: {exc}")
        db.rollback()
        doc = db.get(Document, document_id)
        if doc:
            doc.status = DocumentStatus.failed
            doc.progress = 0
            doc.error = str(exc)[:1000]
            db.commit()
    finally:
        db.close()
