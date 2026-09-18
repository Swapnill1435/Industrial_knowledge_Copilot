import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

interface DashboardData {
  documents: number;
  ready_documents: number;
  users: number;
  queries: number;
}

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<DashboardData>("/dashboard")
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main>
      <h1>Operational Overview</h1>
      <p className="subtitle">Real-time status of indexed industrial knowledge base and query activity.</p>

      <div className="stats-grid">
        <div className="card stat-card">
          <span className="stat-label">Total Documents</span>
          <span className="stat-value">{loading ? "—" : data?.documents ?? 0}</span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Ready Vector Index</span>
          <span className="stat-value" style={{ color: "#10b981" }}>
            {loading ? "—" : data?.ready_documents ?? 0}
          </span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Authorized Users</span>
          <span className="stat-value">{loading ? "—" : data?.users ?? 0}</span>
        </div>

        <div className="card stat-card">
          <span className="stat-label">Questions Answered</span>
          <span className="stat-value" style={{ color: "#06b6d4" }}>
            {loading ? "—" : data?.queries ?? 0}
          </span>
        </div>
      </div>

      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, color: "#fff", marginBottom: "0.25rem" }}>
            Query Industrial Knowledge
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Ask operational, safety, or equipment procedure questions grounded in company manuals.
          </p>
        </div>
        <Link to="/ask">
          <button>Ask Copilot →</button>
        </Link>
      </div>
    </main>
  );
};
