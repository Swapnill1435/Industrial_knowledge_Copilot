import re
from functools import lru_cache
from typing import Any

# pyrefly: ignore [missing-import]
import chromadb
from google import genai
# pyrefly: ignore [missing-import]
from google.genai import types

from ..config import get_settings

settings = get_settings()


@lru_cache
def gemini_client():
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    return genai.Client(api_key=settings.gemini_api_key)


@lru_cache
def collection():
    client = chromadb.PersistentClient(path=settings.chroma_path)
    return client.get_or_create_collection("industrial_documents", metadata={"hnsw:space": "cosine"})


def embed(texts: list[str], task_type: str) -> list[list[float]]:
    result = gemini_client().models.embed_content(
        model=settings.gemini_embedding_model,
        contents=texts,
        config=types.EmbedContentConfig(task_type=task_type),
    )
    return [item.values for item in result.embeddings]


def index_document(document_id: int, name: str, chunks: list[dict[str, Any]]) -> None:
    if not chunks:
        raise ValueError("No readable text found in document")
    
    # First delete any old vectors for this document
    delete_document_vectors(document_id)
    
    texts = [chunk["text"] for chunk in chunks]
    vectors = embed(texts, "RETRIEVAL_DOCUMENT")
    
    collection().upsert(
        ids=[f"doc-{document_id}-{i}" for i in range(len(chunks))],
        documents=texts,
        embeddings=vectors,
        metadatas=[
            {
                "document_id": document_id,
                "document_name": name,
                "page": c["page"] or 0,
                "chunk_id": c.get("chunk_id", i),
            }
            for i, c in enumerate(chunks)
        ],
    )


def delete_document_vectors(document_id: int) -> None:
    try:
        collection().delete(where={"document_id": document_id})
    except Exception:
        pass


def answer_question(question: str, top_k: int = 5) -> tuple[str, list[dict[str, Any]]]:
    if not settings.gemini_api_key:
        return (
            "GEMINI_API_KEY is not set. Please set your API key in backend/.env to enable RAG answer generation.",
            [],
        )

    query_vector = embed([question], "RETRIEVAL_QUERY")[0]
    results = collection().query(
        query_embeddings=[query_vector],
        n_results=min(top_k * 2, 20),
        include=["documents", "metadatas", "distances"],
    )

    raw_docs = results.get("documents", [[]])[0]
    raw_metas = results.get("metadatas", [[]])[0]
    raw_dists = results.get("distances", [[]])[0]

    if not raw_docs:
        return "I could not find any relevant information in the indexed documents.", []

    # 1. Filter by distance threshold and deduplicate similar content
    filtered_items = []
    seen_excerpts = set()

    for doc, meta, dist in zip(raw_docs, raw_metas, raw_dists):
        if dist is not None and dist > settings.distance_threshold:
            continue

        # Check for near-duplicate excerpt prefixes
        normalized_snippet = doc[:100].strip().lower()
        if normalized_snippet in seen_excerpts:
            continue
        seen_excerpts.add(normalized_snippet)

        score = max(0.0, min(1.0, round(1.0 - (dist if dist is not None else 0.5), 3)))
        filtered_items.append({
            "doc": doc,
            "meta": meta,
            "dist": dist,
            "score": score,
        })

        if len(filtered_items) >= top_k:
            break

    if not filtered_items:
        return (
            "I searched the knowledge base, but found no passages exceeding the relevance threshold for your query.",
            [],
        )

    # 2. Build prompt context with clear [Source N] markers
    context_blocks = []
    sources = []

    for idx, item in enumerate(filtered_items, 1):
        meta = item["meta"]
        doc = item["doc"]
        page_str = f", Page {meta['page']}" if meta.get("page") else ""
        context_blocks.append(f"[Source {idx}] (Document: {meta['document_name']}{page_str})\n{doc}")

        sources.append({
            "document_id": meta["document_id"],
            "document_name": meta["document_name"],
            "page": meta.get("page") if meta.get("page") != 0 else None,
            "excerpt": doc[:350] + ("..." if len(doc) > 350 else ""),
            "score": item["score"],
        })

    context_str = "\n\n".join(context_blocks)

    system_instruction = """You are an expert Industrial Knowledge Copilot. Your sole task is to answer operational, engineering, and procedure questions based STRICTLY on the provided Context passages.

Guidelines:
1. Ground every statement directly in the provided sources.
2. Cite all facts inline using [Source N] tags corresponding to the source numbers in the context.
3. If the context does not contain enough information to fully answer the question, state clearly what is known from the context and what information is missing.
4. Maintain a professional, safety-oriented, precise technical tone. Do not make assumptions or introduce outside knowledge."""

    prompt = f"""Question: {question}

Context:
{context_str}

Answer:"""

    try:
        response = gemini_client().models.generate_content(
            model=settings.gemini_chat_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2,
            ),
        )
        answer_text = response.text or "No answer was returned by the language model."
    except Exception as exc:
        answer_text = f"Failed to generate answer using Gemini API: {exc}"

    # Validate citations present in answer
    cited_indices = set(int(m) for m in re.findall(r"\[Source\s+(\d+)\]", answer_text))
    if cited_indices:
        # Keep sources that were explicitly cited, or top sources if none matched bounds
        valid_sources = [s for i, s in enumerate(sources, 1) if i in cited_indices]
        if valid_sources:
            sources = valid_sources

    return answer_text, sources
