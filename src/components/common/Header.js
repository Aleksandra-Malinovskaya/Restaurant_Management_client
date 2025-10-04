import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Ошибка при выходе:", error);
    }
  };

  const getRoleDisplayName = (role) => {
    const roleNames = {
      super_admin: "Супер-админ",
      admin: "Администратор",
      waiter: "Официант",
      chef: "Повар",
      trainee: "Стажер",
    };
    return roleNames[role] || role;
  };

  return (
    <header className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm">
      <div className="container-fluid">
        {/* Логотип и название */}
        <a className="navbar-brand fw-bold" href="/">
          <i className="bi bi-cup-hot-fill me-2"></i>
          Restaurant Management
        </a>

        {/* Кнопка для мобильной версии */}
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Навигация */}
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            {user && (
              <>
                <li className="nav-item">
                  <a className="nav-link" href="/admin">
                    <i className="bi bi-speedometer2 me-1"></i>
                    Панель управления
                  </a>
                </li>
                <li className="nav-item">
                  <a className="nav-link" href="/users">
                    <i className="bi bi-people me-1"></i>
                    Пользователи
                  </a>
                </li>
                <li className="nav-item">
                  <a className="nav-link" href="/menu">
                    <i className="bi bi-menu-button me-1"></i>
                    Меню
                  </a>
                </li>
                <li className="nav-item">
                  <a className="nav-link" href="/orders">
                    <i className="bi bi-receipt me-1"></i>
                    Заказы
                  </a>
                </li>
              </>
            )}
          </ul>

          {/* Информация пользователя и выход */}
          {user && (
            <div className="navbar-nav ms-auto">
              <div className="nav-item dropdown">
                <a
                  className="nav-link dropdown-toggle d-flex align-items-center"
                  href="#"
                  role="button"
                  data-bs-toggle="dropdown"
                >
                  <div
                    className="bg-primary rounded-circle d-flex align-items-center justify-content-center me-2"
                    style={{ width: "32px", height: "32px" }}
                  >
                    <span className="text-white fw-bold small">
                      {user.firstName?.[0]}
                      {user.lastName?.[0]}
                    </span>
                  </div>
                  <span className="me-2">
                    {user.firstName} {user.lastName}
                  </span>
                </a>
                <ul className="dropdown-menu dropdown-menu-end">
                  <li>
                    <div className="dropdown-item-text">
                      <small className="text-muted">
                        {getRoleDisplayName(user.role)}
                      </small>
                    </div>
                  </li>
                  <li>
                    <hr className="dropdown-divider" />
                  </li>
                  <li>
                    <a className="dropdown-item" href="/profile">
                      <i className="bi bi-person me-2"></i>
                      Профиль
                    </a>
                  </li>
                  <li>
                    <button
                      className="dropdown-item text-danger"
                      onClick={handleLogout}
                    >
                      <i className="bi bi-box-arrow-right me-2"></i>
                      Выйти
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
