import React from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getRoleName = (role) => {
    const roles = {
      super_admin: "Супер-админ",
      admin: "Администратор",
      waiter: "Официант",
      chef: "Повар",
      trainee: "Стажер",
    };
    return roles[role] || role;
  };

  const getNavbarColor = () => {
    switch (user?.role) {
      case "super_admin":
        return "dark";
      case "admin":
        return "primary";
      case "waiter":
        return "success";
      case "chef":
        return "warning";
      default:
        return "secondary";
    }
  };

  if (!user) return null;

  return (
    <nav
      className={`navbar navbar-expand-lg navbar-dark bg-${getNavbarColor()}`}
    >
      <div className="container-fluid">
        <span className="navbar-brand mb-0 h1">
          <i className="bi bi-shop me-2"></i>
          Ресторан "DINOSER"
        </span>

        <div className="navbar-nav ms-auto">
          <div className="nav-item dropdown">
            <button
              className="nav-link dropdown-toggle text-white btn btn-link border-0"
              data-bs-toggle="dropdown"
              style={{ background: "none" }}
            >
              <i className="bi bi-person-circle me-2"></i>
              {user.firstName} {user.lastName}
              <span className="badge bg-light text-dark ms-2">
                {getRoleName(user.role)}
              </span>
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li>
                <span className="dropdown-item-text small">{user.email}</span>
              </li>
              <li>
                <hr className="dropdown-divider" />
              </li>
              <li>
                <button className="dropdown-item" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2"></i>
                  Выйти
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
