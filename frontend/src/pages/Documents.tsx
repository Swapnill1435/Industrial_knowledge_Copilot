import React, { FormEvent, useEffect, useState } from "react";
import { api } from "../api";

interface DocumentItem {
  id: number;
  original_name: string;
  content_type: string | null;
  size_bytes: number;
  file_hash: string | null;
  status: "processing" | "ready" | "failed";
  progress: number;
  chunk_count: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export const Documents: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchDocuments = async () => {
    try {
      const data = await api<DocumentItem[]>("/documents");
      setDocuments(data);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Poll for document progress if any document is currently 'processing'
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === "processing");
    if (!hasProcessing) return;

    const timer = setInterval(() => {
      fetchDocuments();
    }, 3000);

    return () => clearInterval(timer);
  }, [documents]);

  const handleUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file") as File;

    if (!file || file.size === 0) {
      setError("Please select a valid non-empty file.");
      return;
    }

    setUploading(true);

    try {
      const createdDoc = await api<DocumentItem>("/documents", {
        method: "POST",
        body: formData,
      });

      setSuccessMsg(`Document '${createdDoc.original_name}' uploaded successfully. Background indexing initiated.`);
      form.reset();
      fetchDocuments();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleReindex = async (docId: number, docName: string) => {
    setError("");
    setSuccessMsg("");
    try {
      await api(`/documents/${docId}/reindex`, { method: "POST" });
      setSuccessMsg(`Re-indexing initiated for '${docName}'.`);
      fetchDocuments();
    } catch (err: any) {
      setError(err.message || "Failed to trigger re-indexing");
    }
  };

  const handleDelete = async (docId: number, docName: string) => {
    if (!confirm(`Are you sure you want to delete '${docName}' and remove its vector index?`)) return;
    setError("");
    setSuccessMsg("");

    try {
      await api(`/documents/${docId}`, { method: "DELETE" });
      setSuccessMsg(`Document '${docName}' deleted.`);
      fetchDocuments();
    } catch (err: any) {
      setError(err.message || "Failed to delete document");
    }
  };

  const filteredDocs = documents.filter(
    (d) =>
      d.original_name.toLowerCase().includes(search.toLowerCase()) ||
      d.status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main>
      <h1>Document Knowledge Index</h1>
      <p className="subtitle">Upload operational manuals, SOPs, and specifications for vector embedding and retrieval.</p>

      {/* Upload Box */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", color: "#fff", marginBottom: "0.5rem" }}>Upload & Index Document</h2>
        <form onSubmit={handleUpload} style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: "260px" }}>
            <input type="file" name="file" accept=".pdf,.docx,.xlsx,.txt" required disabled={uploading} />
            <small style={{ color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
              Supported formats: PDF, DOCX, XLSX, TXT (Max 25 MB). Automatic SHA-256 duplicate detection.
            </small>
          </div>
          <button disabled={uploading}>{uploading ? "Uploading…" : "Upload & Index"}</button>
        </form>

        {error && <div className="error-text" style={{ marginTop: "1rem" }}>{error}</div>}
        {successMsg && (
          <div
            style={{
              marginTop: "1rem",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10b981",
              padding: "0.5rem 0.75rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.85rem",
              border: "1px solid rgba(16, 185, 129, 0.3)",
            }}
          >
            {successMsg}
          </div>
        )}
      </div>

      {/* Document List */}
      <div className="card">
        <div className="table-header">
          <h2 style={{ fontSize: "1.1rem", color: "#fff" }}>Indexed Documents ({filteredDocs.length})</h2>
          <input
            type="text"
            className="search-input"
            placeholder="Search documents by name or status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filteredDocs.map((doc) => (
          <div key={doc.id} className="doc-row">
            <div className="doc-info">
              <span className="name">{doc.original_name}</span>
              <div className="meta">
                <span className={`badge ${doc.status}`}>{doc.status}</span>
                <span>{(doc.size_bytes / 1024).toFixed(1)} KB</span>
                <span>{doc.chunk_count} Chunks</span>
                <span>{new Date(doc.created_at).toLocaleDateString()}</span>
              </div>

              {doc.status === "processing" && (
                <div style={{ marginTop: "0.4rem" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--accent-cyan)" }}>
                    Indexing Progress: {doc.progress}%
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${doc.progress}%` }} />
                  </div>
                </div>
              )}

              {doc.error && (
                <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                  Error: {doc.error}
                </div>
              )}
            </div>

            <div className="doc-actions">
              {doc.status !== "processing" && (
                <button
                  type="button"
                  className="ghost sm"
                  onClick={() => handleReindex(doc.id, doc.original_name)}
                  title="Re-run chunking and vector embedding"
                >
                  Re-index
                </button>
              )}
              <button
                type="button"
                className="danger sm"
                onClick={() => handleDelete(doc.id, doc.original_name)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}

        {!filteredDocs.length && (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem" }}>
            No documents found matching your filter criteria.
          </p>
        )}
      </div>
    </main>
  );
};
