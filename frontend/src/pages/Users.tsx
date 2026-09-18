import React, { FormEvent, useEffect, useState } from "react";
import { api } from "../api";

interface UserItem {
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "employee";
}

export const Users: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "employee">("employee");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const data = await api<UserItem[]>("/users");
      setUsers(data);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setSubmitting(true);

    try {
      const newUser = await api<UserItem>("/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          full_name: fullName,
          password,
          role,
        }),
      });

      setSuccessMsg(`User '${newUser.full_name}' (${newUser.email}) created successfully.`);
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("employee");
      fetchUsers();
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main>
      <h1>User Access Management</h1>
      <p className="subtitle">Provision and manage employee and administrator roles for the copilot.</p>

      {/* Create User Form */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem", color: "#fff", marginBottom: "1rem" }}>Provision New User</h2>
        <form onSubmit={handleCreateUser} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", alignItems: "end" }}>
          <label>
            Full Name
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              required
            />
          </label>

          <label>
            Corporate Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane.doe@company.com"
              required
            />
          </label>

          <label>
            Initial Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              minLength={8}
              required
            />
          </label>

          <label>
            System Role
            <select value={role} onChange={(e) => setRole(e.target.value as any)}>
              <option value="employee">Employee</option>
              <option value="admin">Administrator</option>
            </select>
          </label>

          <button disabled={submitting}>{submitting ? "Creating…" : "Create User"}</button>
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

      {/* User Table */}
      <div className="card">
        <div className="table-header">
          <h2 style={{ fontSize: "1.1rem", color: "#fff" }}>Authorized Users ({filteredUsers.length})</h2>
          <input
            type="text"
            className="search-input"
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filteredUsers.map((u) => (
          <div key={u.id} className="doc-row">
            <div className="doc-info">
              <span className="name">{u.full_name}</span>
              <div className="meta">
                <span>{u.email}</span>
                <span className={`badge ${u.role === "admin" ? "ready" : "processing"}`}>{u.role}</span>
              </div>
            </div>
          </div>
        ))}

        {!filteredUsers.length && (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem" }}>
            No users found matching your search.
          </p>
        )}
      </div>
    </main>
  );
};
