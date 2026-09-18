import React, { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setToken } from "../api";

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
      const body = new URLSearchParams({ username: email, password });
      
      const response = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Invalid email or password");
      }

      const data = await response.json();
      setToken(data.access_token);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="center-layout">
      <div className="card login-card">
        <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          <div className="logo-icon" style={{ margin: "0 auto 1rem auto", width: 48, height: 48, fontSize: "1.4rem" }}>
            IK
          </div>
          <h1>Industrial Copilot</h1>
          <p className="subtitle">Sign in to access industrial operations knowledge base</p>
        </div>

        {error && <div className="error-text">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label>
            Corporate Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          <button disabled={loading} style={{ marginTop: "0.5rem" }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};
