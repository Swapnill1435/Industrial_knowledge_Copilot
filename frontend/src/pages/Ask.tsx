import React, { FormEvent, useState } from "react";
import { api } from "../api";

interface Source {
  document_id: number;
  document_name: string;
  page: number | null;
  excerpt: string;
  score?: number;
}

interface AnswerResult {
  answer: string;
  sources: Source[];
}

interface QueryHistoryItem {
  question: string;
  result: AnswerResult;
  timestamp: string;
}

const EXAMPLE_QUESTIONS = [
  "What is the emergency shutdown procedure for Boiler B-2?",
  "What is the recommended maintenance schedule for Centrifugal Pump P-101?",
  "What safety gear is required for handling high-pressure steam valves?",
];

export const Ask: React.FC = () => {
  const [question, setQuestion] = useState("");
  const [topK, setTopK] = useState(5);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);

  const handleAsk = async (e?: FormEvent, targetQuestion?: string) => {
    if (e) e.preventDefault();
    const queryStr = targetQuestion || question;
    if (!queryStr.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await api<AnswerResult>("/rag/query", {
        method: "POST",
        body: JSON.stringify({ question: queryStr, top_k: topK }),
      });
      setResult(res);

      setHistory((prev) => [
        { question: queryStr, result: res, timestamp: new Date().toLocaleTimeString() },
        ...prev.filter((h) => h.question !== queryStr).slice(0, 9),
      ]);
    } catch (err: any) {
      setError(err.message || "Failed to retrieve answer");
    } finally {
      setLoading(false);
    }
  };

  const selectHistoryItem = (item: QueryHistoryItem) => {
    setQuestion(item.question);
    setResult(item.result);
  };

  return (
    <main>
      <h1>Ask Knowledge Copilot</h1>
      <p className="subtitle">Retrieve grounded answers directly from indexed engineering specifications and manuals.</p>

      <div className="ask-layout">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <form className="card ask-form" onSubmit={(e) => handleAsk(e)}>
            <label>
              Your Question
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask any question about procedures, specifications, equipment maintenance, or safety guidelines..."
                required
              />
            </label>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", width: "100%" }}>Try asking:</span>
              {EXAMPLE_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="ghost sm"
                  onClick={() => {
                    setQuestion(q);
                    handleAsk(undefined, q);
                  }}
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="form-controls">
              <label style={{ flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
                <span>Top passages (top_k):</span>
                <select
                  value={topK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                  style={{ width: "80px", padding: "0.4rem" }}
                >
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={8}>8</option>
                </select>
              </label>

              <button disabled={loading || !question.trim()}>
                {loading ? "Analyzing Knowledge Base…" : "Ask Question"}
              </button>
            </div>
          </form>

          {error && <div className="error-text">{error}</div>}

          {result && (
            <div className="card answer-card">
              <div className="answer-header">
                <h2>Copilot Answer</h2>
                <span className="badge ready">{result.sources.length} Sources Cited</span>
              </div>

              <div className="answer-body">{result.answer}</div>

              <h3 style={{ fontSize: "1rem", color: "#fff", marginBottom: "0.75rem" }}>Retrieved Excerpts & Citations</h3>
              <div className="sources-list">
                {result.sources.map((src, i) => (
                  <div className="source-item" key={i}>
                    <div className="source-header">
                      <span className="source-title">
                        [Source {i + 1}] {src.document_name} {src.page ? `— Page ${src.page}` : ""}
                      </span>
                      {src.score !== undefined && (
                        <span className="source-score">{Math.round(src.score * 100)}% match</span>
                      )}
                    </div>
                    <div className="source-excerpt">{src.excerpt}</div>
                  </div>
                ))}
                {!result.sources.length && (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    No specific document passages exceeded the distance threshold for this query.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Query History */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="card" style={{ padding: "1.2rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#fff", marginBottom: "0.75rem" }}>
              Session Query History
            </h3>
            {history.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Your search history will appear here.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {history.map((h, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectHistoryItem(h)}
                    style={{
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--bg-card-border)",
                      padding: "0.6rem 0.8rem",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div style={{ fontWeight: 500, color: "#fff", marginBottom: "0.2rem" }}>{h.question}</div>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{h.timestamp}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
