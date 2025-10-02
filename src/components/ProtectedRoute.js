import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Загрузка...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Проверяем, активен ли пользователь
  if (!user.isActive) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger text-center">
          <h4>Учетная запись деактивирована</h4>
          <p>Обратитесь к администратору для активации вашей учетной записи.</p>
        </div>
      </div>
    );
  }

  // Проверяем роль, если требуется определенная
  if (
    requiredRole &&
    user.role !== requiredRole &&
    user.role !== "super_admin"
  ) {
    return (
      <div className="container mt-5">
        <div className="alert alert-warning text-center">
          <h4>Доступ запрещен</h4>
          <p>У вас недостаточно прав для доступа к этой странице.</p>
          <p>
            Требуемая роль: <strong>{requiredRole}</strong>
          </p>
          <p>
            Ваша роль: <strong>{user.role}</strong>
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
