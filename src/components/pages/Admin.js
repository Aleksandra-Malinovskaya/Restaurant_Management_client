import React from "react";
import NavBar from "../NavBar";
import { useAuth } from "../../context/AuthContext";

const Admin = () => {
  const { user } = useAuth();

  const adminCards = [
    {
      title: "👥 Пользователи",
      description: "Управление сотрудниками",
      path: "/admin/users",
      color: "primary",
      icon: "bi-people",
    },
    {
      title: "🍽️ Блюда",
      description: "Управление меню ресторана",
      path: "/admin/dishes",
      color: "success",
      icon: "bi-egg-fried",
    },
    {
      title: "🪑 Столики",
      description: "Управление столиками",
      path: "/admin/tables",
      color: "warning",
      icon: "bi-table",
    },
    {
      title: "📊 Статистика",
      description: "Отчеты и аналитика",
      path: "/admin/stats",
      color: "info",
      icon: "bi-graph-up",
    },
    {
      title: "📋 Заказы",
      description: "Просмотр всех заказов",
      path: "/admin/orders",
      color: "secondary",
      icon: "bi-receipt",
    },
    {
      title: "📅 Бронирования",
      description: "Управление бронированиями",
      path: "/admin/reservations",
      color: "dark",
      icon: "bi-calendar-check",
    },
  ];

  const handleCardClick = (path) => {
    alert(`Переход на: ${path}\n\nСтраница в разработке!`);
  };

  return (
    <div className="min-vh-100 bg-light">
      <NavBar />

      <div className="container-fluid py-4">
        {/* Заголовок */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card bg-white shadow-sm">
              <div className="card-body">
                <h1 className="h3 mb-2">
                  <i className="bi bi-speedometer2 me-2"></i>
                  Панель администратора
                </h1>
                <p className="text-muted mb-0">
                  Добро пожаловать, {user?.firstName} {user?.lastName}
                </p>
                <div className="mt-2">
                  <span className="badge bg-primary">
                    {user?.role === "super_admin"
                      ? "Супер-администратор"
                      : "Администратор"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Карточки функций */}
        <div className="row g-3">
          {adminCards.map((card, index) => (
            <div key={index} className="col-xl-4 col-lg-6 col-md-6">
              <div
                className={`card border-${card.color} shadow-sm h-100`}
                style={{ cursor: "pointer" }}
                onClick={() => handleCardClick(card.path)}
              >
                <div className="card-body text-center">
                  <i
                    className={`bi ${card.icon} text-${card.color} display-4 mb-3`}
                  ></i>
                  <h5 className="card-title">{card.title}</h5>
                  <p className="card-text text-muted">{card.description}</p>
                </div>
                <div
                  className={`card-footer bg-${card.color} bg-opacity-10 text-center`}
                >
                  <small className="text-muted">Нажмите для перехода</small>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Статистика или уведомления */}
        <div className="row mt-5">
          <div className="col-12">
            <div className="card border-info">
              <div className="card-header bg-info text-white">
                <i className="bi bi-info-circle me-2"></i>
                Быстрая статистика
              </div>
              <div className="card-body">
                <div className="row text-center">
                  <div className="col-md-3">
                    <h4 className="text-primary">12</h4>
                    <small className="text-muted">Активных заказов</small>
                  </div>
                  <div className="col-md-3">
                    <h4 className="text-success">8</h4>
                    <small className="text-muted">Свободных столиков</small>
                  </div>
                  <div className="col-md-3">
                    <h4 className="text-warning">5</h4>
                    <small className="text-muted">Бронирований сегодня</small>
                  </div>
                  <div className="col-md-3">
                    <h4 className="text-danger">3</h4>
                    <small className="text-muted">Блюд на стопе</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
