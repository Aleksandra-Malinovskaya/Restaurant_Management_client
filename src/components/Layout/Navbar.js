import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      super_admin: { class: "bg-danger", text: "Супер-админ" },
      admin: { class: "bg-warning", text: "Администратор" },
      waiter: { class: "bg-info", text: "Официант" },
      chef: { class: "bg-success", text: "Повар" },
      trainee: { class: "bg-secondary", text: "Стажер" },
    };

    const config = roleConfig[role] || { class: "bg-dark", text: role };
    return <span className={`badge ${config.class} ms-2`}>{config.text}</span>;
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        <Link className="navbar-brand" to="/dashboard">
          <i className="bi bi-shop me-2"></i>
          Ресторан "DINOSER"
        </Link>

        <div className="navbar-nav ms-auto">
          <div className="nav-item dropdown">
            <button
              className="nav-link dropdown-toggle d-flex align-items-center btn btn-link text-decoration-none text-white border-0"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
              style={{ background: "none" }}
            >
              <i className="bi bi-person-circle me-2"></i>
              {user?.firstName} {user?.lastName}
              {getRoleBadge(user?.role)}
            </button>
            <ul className="dropdown-menu dropdown-menu-end">
              <li>
                <span className="dropdown-item-text">
                  <small>Вы вошли как {user?.email}</small>
                </span>
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
