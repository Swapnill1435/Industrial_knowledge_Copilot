# Industrial Knowledge Copilot — Complete Project Explanation

## 1. Project overview

Industrial Knowledge Copilot is a Retrieval-Augmented Generation (RAG) web application. It allows an organization to upload technical documents and ask questions about their contents in natural language.

For example, an engineer can ask:

> What is the maintenance procedure for Pump P-101?

Instead of asking Gemini to answer from its general training alone, the application first retrieves relevant passages from the organization's uploaded documents. Gemini receives those passages as context and creates a grounded answer with source and page citations.

The MVP supports text-based PDF, DOCX, XLSX, and TXT documents. OCR, knowledge graphs, IoT, and predictive maintenance are intentionally outside its scope.

## 2. Technology stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React and TypeScript | Browser interface |
| Build tool | Vite | Runs and builds the frontend |
| Backend | FastAPI and Python | REST API and application logic |
| App database | SQLite | Stores users, documents, and query logs |
| ORM | SQLAlchemy | Maps Python classes to database tables |
| Vector database | ChromaDB | Stores and searches document embeddings |
| Answer model | Gemini 2.5 Flash | Generates the final grounded response |
| Embedding model | Gemini Embedding | Converts text into semantic vectors |
| PDF extraction | PyMuPDF | Reads text and page numbers from PDFs |
| Word extraction | python-docx | Reads DOCX paragraphs |
| Spreadsheet extraction | pandas/openpyxl | Reads XLSX sheets and cells |
| Authentication | JWT | Protects API requests |

## 3. High-level architecture

```text
                          INDUSTRIAL KNOWLEDGE COPILOT

┌──────────────┐       HTTP/JSON       ┌────────────────────────────┐
│ React client │ ────────────────────> │ FastAPI backend            │
│ Login        │                       │ Auth and role checks       │
│ Dashboard    │ <──────────────────── │ Document and RAG endpoints │
│ Documents    │                       └─────────────┬──────────────┘
│ Ask          │                                     │
└──────────────┘                     ┌───────────────┼───────────────┐
                                     │               │               │
                                ┌────▼─────┐   ┌─────▼─────┐   ┌────▼──────┐
                                │ SQLite  │   │ ChromaDB  │   │ Gemini API│
                                │ App data│   │ Vectors   │   │ AI models │
                                └──────────┘   └───────────┘   └───────────┘
```

SQLite and ChromaDB serve different purposes. SQLite stores structured application records. ChromaDB stores numerical representations of document chunks and performs semantic similarity search.

## 4. RAG architecture

RAG means **Retrieval-Augmented Generation**.

- **Retrieval**: Find passages related to the question.
- **Augmented**: Add those passages to the AI model's prompt.
- **Generation**: Generate an answer using the retrieved evidence.

RAG is useful because private industrial documents were not necessarily included in a general AI model's training data. Retrieval supplies the organization's own information at question time.

### Document ingestion flow

```text
Admin uploads file
        ↓
Validate extension, size, and duplicate hash
        ↓
Save the original file
        ↓
Create a processing record in SQLite
        ↓
Extract readable text
        ↓
Split text into overlapping chunks
        ↓
Create a Gemini embedding for every chunk
        ↓
Store vectors, text, document ID, filename, and page in ChromaDB
        ↓
Mark the document ready in SQLite
```

### Question-answering flow

```text
Employee asks a question
        ↓
Create an embedding for the question
        ↓
Search ChromaDB for nearby document vectors
        ↓
Apply a relevance threshold and remove duplicates
        ↓
Build context blocks labelled [Source 1], [Source 2], etc.
        ↓
Send instructions, question, and context to Gemini 2.5 Flash
        ↓
Return the answer, excerpts, filenames, page numbers, and scores
        ↓
Store the question in SQLite for dashboard statistics
```

## 5. Why chunking is required

Sending every document in full would be slow, expensive, and may exceed the model's context limit. The application breaks extracted text into smaller passages called **chunks**.

Chunks overlap slightly. If one chunk ends in the middle of an explanation, the next chunk repeats part of the previous one. This helps preserve meaning across boundaries.

Each chunk keeps metadata such as:

- document database ID;
- original filename;
- page number, when available;
- chunk number.

This metadata is how the final answer can show its source.

## 6. Embeddings and vector search

An **embedding** is a list of numbers representing the meaning of text. Texts with similar meanings normally have vectors located close together in vector space.

For example, “pump lubrication interval” and “how often should the pump be oiled?” use different words but express similar intent. Semantic vector search can connect them better than exact keyword matching.

The project uses two task modes:

- `RETRIEVAL_DOCUMENT` when embedding stored document chunks;
- `RETRIEVAL_QUERY` when embedding a user's question.

ChromaDB compares the question vector with stored chunk vectors using cosine distance. Lower distance means higher similarity. The application converts distance into a display score and discards results beyond the configured threshold.

## 7. Grounding and citations

**Grounding** means requiring the generated answer to rely on supplied evidence. The Gemini system instruction tells the model to:

- answer strictly from retrieved context;
- cite factual statements with `[Source N]`;
- state when the evidence is insufficient;
- avoid inventing missing information;
- use a professional, safety-oriented tone.

The backend also extracts citation numbers from the generated answer and returns matching source records. This makes the output more transparent, although production systems should perform even stronger citation verification.

## 8. Authentication and authorization

Authentication answers: **Who is the user?**

Authorization answers: **What is that user allowed to do?**

The user submits an email and password. Passwords are stored as one-way bcrypt hashes, not plain text. After successful login, FastAPI creates a signed JSON Web Token (JWT).

The frontend stores the token and sends it in subsequent requests:

```text
Authorization: Bearer <token>
```

Protected endpoints decode and verify the token before loading the user.

Roles:

- **Admin**: upload, re-index, delete documents, and create users.
- **Employee**: view available documents, use the dashboard, and ask questions.

This is **role-based access control (RBAC)**.

## 9. Application database

SQLite contains three main tables:

### Users

Stores email, full name, password hash, role, and creation time.

### Documents

Stores the original and generated filenames, MIME type, byte size, SHA-256 hash, processing status, progress, chunk count, errors, uploader, and timestamps.

### Query logs

Stores questions, users, and timestamps for usage tracking and dashboard statistics.

The actual files are stored in the uploads directory. Their vectorized chunks are stored separately in ChromaDB.

## 10. Backend folder responsibilities

```text
backend/
├── app/
│   ├── main.py              Application creation and router registration
│   ├── config.py            Environment-based settings
│   ├── database.py          SQLAlchemy engine and sessions
│   ├── models.py            SQLite table models
│   ├── schemas.py           API input/output validation
│   ├── auth.py              Password, JWT, and role functions
│   ├── routers/
│   │   ├── auth.py          Login and current-user endpoints
│   │   ├── users.py         Admin user management
│   │   ├── documents.py     Upload, list, re-index, and delete
│   │   ├── rag.py           Question-answer endpoint
│   │   └── dashboard.py     Summary counts
│   └── services/
│       ├── extraction.py    File parsing and chunking
│       ├── indexing.py      Background ingestion workflow
│       └── rag.py           Gemini, ChromaDB, retrieval, and generation
├── tests/                   Automated API tests
└── requirements.txt         Python packages
```

## 11. Frontend folder responsibilities

```text
frontend/
├── src/
│   ├── main.tsx             Routes, session loading, and app entry point
│   ├── api.ts               Shared authenticated API request helper
│   ├── styles.css           Application styling
│   ├── components/
│   │   └── Navbar.tsx       Navigation and sign-out control
│   └── pages/
│       ├── Login.tsx        Login form
│       ├── Dashboard.tsx    Application statistics
│       ├── Documents.tsx    Upload and document management
│       ├── Ask.tsx          RAG question and cited answer view
│       └── Users.tsx        Admin user creation
├── package.json             JavaScript packages and commands
└── vite.config.ts           Frontend build configuration
```

## 12. Important technical vocabulary

### Package

A **package** is reusable code installed as a dependency. Examples include FastAPI, SQLAlchemy, React, and ChromaDB. Python packages are listed in `requirements.txt`; JavaScript packages are listed in `package.json`.

### Import

An **import** makes code from another module or package available in the current file.

```python
from fastapi import FastAPI
```

This does not copy FastAPI's code into the file. It loads the installed package and exposes the requested `FastAPI` object.

### Module

A **module** is usually one Python file containing related code. For example, `auth.py` is the authentication module.

### Function

A **function** is a reusable operation. It accepts inputs, performs work, and may return a result. `answer_question()` performs the retrieval and answer-generation workflow.

### Class

A **class** is a blueprint for objects. SQLAlchemy model classes define database records, while Pydantic schema classes define validated API data.

### Decorator

A **decorator** is the `@something` syntax placed above a function or class to add behavior.

```python
@router.get("/documents")
def list_documents():
    ...
```

Here, the decorator registers the function as an HTTP GET endpoint.

### `@lru_cache`

`lru_cache` means **Least Recently Used cache**. It remembers a function's returned value so repeated calls with the same arguments do not repeat the work.

```python
@lru_cache
def get_settings():
    return Settings()
```

Without caching, every caller could construct a new settings object. With caching, the application reuses one object. The project also caches the Gemini client and ChromaDB collection so these resources are initialized once per process instead of once per request.

### Environment variable

An **environment variable** is configuration kept outside source code. The `.env` file contains values such as model names, paths, the JWT secret, and the Gemini API key. Secrets should never be committed to Git.

### API

An **Application Programming Interface** defines how software components communicate. The React frontend calls FastAPI endpoints using HTTP requests and receives JSON responses.

### Endpoint and route

An **endpoint** is an API operation at a URL and HTTP method, such as `POST /api/rag/query`. A **route** connects that request to a backend function.

### REST

REST is a common API style using HTTP methods: GET reads, POST creates or starts work, and DELETE removes resources.

### JSON

JSON is the text data format exchanged between frontend and backend. It represents values using objects, arrays, strings, numbers, booleans, and null.

### Schema and Pydantic

A **schema** describes valid request or response data. Pydantic checks types, required fields, string lengths, email formats, and number ranges before business logic runs.

### ORM and SQLAlchemy

An **Object-Relational Mapper** lets Python code work with database rows through objects. SQLAlchemy translates expressions such as `select(User)` into SQL.

### Database session

A SQLAlchemy **session** is a unit of database work. It loads, creates, updates, or deletes records. `commit()` permanently records changes; `rollback()` cancels an unsuccessful transaction.

### Dependency injection

FastAPI's `Depends(...)` supplies shared resources to endpoint functions. It is used for database sessions, current-user authentication, and admin authorization. This avoids repeating the same setup and checking code in every endpoint.

### Background task

A **background task** begins after the upload response is returned. Extraction and embedding may take time, so the API returns a processing document immediately while indexing continues. The frontend polls document status to display progress.

### Hash and SHA-256

A **hash** is a fixed-length fingerprint calculated from file bytes. Identical files have the same SHA-256 hash. The upload endpoint uses it to detect duplicate documents.

### MIME type and extension

The extension is the filename ending such as `.pdf`. A MIME type describes content for HTTP, such as `application/pdf`. The MVP validates supported extensions and records the MIME type.

### Token

A token is a signed credential presented after login. The JWT contains the user identifier, role, and expiration time. A signature prevents undetected modification.

### CORS

Cross-Origin Resource Sharing controls whether a browser frontend at one origin may call a backend at another. Development uses React at port 5173 and FastAPI at port 8000, so the backend explicitly allows the frontend origin.

### Type hint

Python type hints such as `list[str]` describe expected data types. TypeScript provides similar static type checking for frontend code. Types improve readability and catch mistakes before runtime.

### Async and `await`

`async` functions can pause during input/output work without blocking all other work. `await file.read()` asynchronously reads an uploaded file.

### Singleton-like cached client

The cached Gemini client and Chroma collection behave like process-level shared instances. This reduces repeated setup. Strictly speaking, `lru_cache` is a caching technique rather than the formal Singleton design pattern.

### Cosine distance and relevance threshold

Cosine distance measures how different two vector directions are. Smaller values indicate closer semantic meaning. The relevance threshold rejects weak matches so unrelated passages are not sent to Gemini.

### Temperature

Temperature controls generation randomness. This project uses a low value because industrial answers should be consistent and precise rather than highly creative.

### Hallucination

A hallucination is confident-looking text not supported by evidence. RAG, grounding instructions, relevance filtering, and citations reduce hallucination risk, but cannot guarantee perfect accuracy.

## 13. Important design decisions

### Why FastAPI?

It provides strong validation, automatic interactive API documentation, dependency injection, and good support for Python AI libraries.

### Why React?

It supports reusable interface components and fast state-driven updates for upload progress and answers.

### Why SQLite?

It is simple, serverless, and suitable for a student prototype. A production multi-user deployment could migrate to PostgreSQL.

### Why ChromaDB?

It offers straightforward persistent vector storage and similarity search for a local prototype.

### Why Gemini 2.5 Flash?

It is used for low-latency answer generation, while the Gemini embedding model is specialized for semantic retrieval. Generation and embedding are separate jobs and use separate models.

## 14. Error and safety handling

The implementation includes:

- authenticated protected endpoints;
- admin-only document and user changes;
- password hashing;
- token expiration;
- supported-file validation;
- empty-file and size checks;
- duplicate-file detection;
- failed processing status and stored error messages;
- database rollback during failed indexing;
- relevance filtering;
- instructions to avoid unsupported answers;
- deletion of both the file record and its vectors.

## 15. Current MVP limitations

- Scanned PDFs need OCR and are unsupported.
- Background tasks run inside the API process rather than a durable worker queue.
- SQLite is best for small deployments.
- There is no document-level permission model.
- JWT access tokens do not yet have refresh or revocation support.
- Citation correctness is encouraged and partially checked, not formally proven.
- A live Gemini API key and internet access are required for embeddings and generation.
- Industrial answers should still be reviewed by qualified personnel before safety-critical action.

## 16. How to explain the project in one minute

> Industrial Knowledge Copilot is a role-based RAG application for searching company technical documents. An administrator uploads a PDF, Word document, spreadsheet, or text file. The FastAPI backend extracts the text, divides it into overlapping chunks, creates semantic embeddings with Gemini, and stores those vectors with source metadata in ChromaDB. When an employee asks a question, the system embeds the question and retrieves the most semantically relevant chunks. It filters weak and duplicate matches, supplies the remaining passages to Gemini 2.5 Flash, and returns a grounded answer with document and page citations. SQLite stores users, document status, and query history, while JWT authentication protects the APIs. React provides the login, dashboard, document management, user management, and question-answering interface.

## 17. Likely viva questions

### Is this simply a chatbot?

No. A normal chatbot can answer from general training. This system first retrieves evidence from an organization-controlled knowledge base and uses that evidence to construct a grounded answer.

### Why not store vectors in SQLite?

SQLite is optimized for structured records and exact queries. ChromaDB is designed to index high-dimensional vectors and perform nearest-neighbor similarity search.

### Why are embeddings created twice?

Document chunks are embedded during ingestion and stored. Each new question is embedded at query time so it can be compared with those stored vectors.

### Does the language model search the documents itself?

No. The backend performs vector retrieval first. Gemini receives only the selected passages, question, and grounding instructions.

### How are page citations preserved?

PDF extraction processes pages individually. The page number is attached to every resulting chunk as ChromaDB metadata and returned with retrieved sources.

### What happens when the answer is absent?

Weak retrieval matches are rejected. The prompt also instructs Gemini to state that information is missing instead of inventing an answer.

### Why is OCR excluded?

The MVP focuses on digitally readable documents. OCR would introduce image processing, recognition errors, additional dependencies, and a larger testing scope.

### Can this replace engineering judgment?

No. It is a knowledge retrieval assistant. Safety-critical procedures require verification against controlled source documents and organizational policy.

## 18. Definition of a successful end-to-end demonstration

The prototype is working end to end when:

1. an admin can log in;
2. an employee account can be created;
3. a text-based document can be uploaded;
4. its status changes from processing to ready;
5. ChromaDB contains its chunks and metadata;
6. a relevant question retrieves those chunks;
7. Gemini produces a grounded answer;
8. the UI displays document and page citations;
9. unauthorized users cannot access protected operations;
10. dashboard counts reflect the activity.

