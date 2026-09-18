import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { api, removeToken, token } from "./api";
import { Navbar } from "./components/Navbar";
import { Ask } from "./pages/Ask";
import { Dashboard } from "./pages/Dashboard";
import { Documents } from "./pages/Documents";
import { Login } from "./pages/Login";
import { Users } from "./pages/Users";
import "./styles.css";

interface User {
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "employee";
}

const Shell: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<User>("/auth/me")
      .then(setUser)
      .catch((err) => {
        console.error("Auth error:", err);
        removeToken();
        navigate("/login");
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return (
      <div className="center-layout">
        <div style={{ color: "var(--accent-cyan)", fontWeight: 600 }}>Loading Copilot Workspace…</div>
      </div>
    );
  }

  return (
    <>
      <Navbar user={user} />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ask" element={<Ask />} />
        <Route
          path="/documents"
          element={user?.role === "admin" ? <Documents /> : <Navigate to="/" replace />}
        />
        <Route
          path="/users"
          element={user?.role === "admin" ? <Users /> : <Navigate to="/" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

const ProtectedRoute: React.FC = () => {
  const authToken = token();
  if (!authToken) {
    return <Navigate to="/login" replace />;
  }
  return <Shell />;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={<ProtectedRoute />} />
      </Routes>
    </BrowserRouter>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
