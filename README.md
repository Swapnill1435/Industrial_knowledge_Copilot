# Industrial Knowledge Copilot

A clean ITPM MVP for authenticated, role-based document search using retrieval-augmented generation (RAG). Admins upload and manage PDF, DOCX, XLSX, and TXT files; employees ask questions and receive Gemini-generated answers with document/page sources.

## Architecture

```text
React UI -> FastAPI + JWT -> SQLite (users, documents, query logs)
                         -> Extract/chunk -> Gemini embeddings -> ChromaDB
Question -> Gemini query embedding -> top chunks -> Gemini 2.5 Flash -> cited answer
```

Scanned-document OCR, knowledge graphs, IoT, and predictive maintenance are intentionally out of scope.

## Run locally

Prerequisites: Python 3.11+, Node.js 20+, and a Gemini API key.

1. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`, `JWT_SECRET`, and the initial admin password.
2. Start the API from `backend`:

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

3. In a second terminal, start the web app from `frontend`:

   ```powershell
   npm install
   npm run dev
   ```

4. Open `http://localhost:5173` and sign in using `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` from `.env`.

API docs are available at `http://localhost:8000/docs`; health is at `http://localhost:8000/health`.

## API summary

- `POST /api/auth/login`, `GET /api/auth/me`
- `POST/GET /api/users` (admin)
- `POST/GET/DELETE /api/documents` (writes require admin)
- `POST /api/rag/query` (authenticated)
- `GET /api/dashboard` (authenticated)

## Production notes

This is a prototype. Before production, add migrations, background ingestion jobs, file size/rate limits, malware scanning, secret management, HTTPS, refresh/revocation tokens, audit policy, backups, and document-level authorization.
