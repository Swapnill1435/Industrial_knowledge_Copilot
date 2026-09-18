import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { removeToken } from "../api";

interface User {
  id: number;
  email: string;
  full_name: string;
  role: "admin" | "employee";
}

interface NavbarProps {
  user: User | null;
}

export const Navbar: React.FC<NavbarProps> = ({ user }) => {
  const navigate = useNavigate();

  const handleSignOut = () => {
    removeToken();
    navigate("/login");
  };

  return (
    <header>
      <div className="brand">
        <div className="logo-icon">IK</div>
        <span>Industrial Copilot</span>
      </div>

      <nav>
        <NavLink to="/" end>
          Dashboard
        </NavLink>
        <NavLink to="/ask">Ask Copilot</NavLink>
        {user?.role === "admin" && (
          <>
            <NavLink to="/documents">Documents</NavLink>
            <NavLink to="/users">Users</NavLink>
          </>
        )}
      </nav>

      {user && (
        <div className="user-badge">
          <div className="user-info">
            <span className="name">{user.full_name}</span>
            <span className="role">{user.role}</span>
          </div>
          <button className="ghost sm" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      )}
    </header>
  );
};
