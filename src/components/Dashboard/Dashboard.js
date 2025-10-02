import React from "react";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../Layout/Navbar";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const getDashboardCards = () => {
    const baseCards = [
      {
        title: "Меню",
        description: "Просмотр меню ресторана",
        icon: "bi-card-checklist",
        path: "/menu",
        color: "primary",
      },
    ];

    const roleCards = {
      super_admin: [
        {
          title: "Пользователи",
          description: "Управление сотрудниками",
          icon: "bi-people",
          path: "/users",
          color: "danger",
        },
        {
          title: "Статистика",
          description: "Отчеты и аналитика",
          icon: "bi-graph-up",
          path: "/stats",
          color: "info",
        },
      ],
      admin: [
        {
          title: "Блюда",
          description: "Управление меню",
          icon: "bi-egg-fried",
          path: "/dishes",
          color: "success",
        },
        {
          title: "Столики",
          description: "Управление столиками",
          icon: "bi-table",
          path: "/tables",
          color: "warning",
        },
      ],
      waiter: [
        {
          title: "Заказы",
          description: "Создание и управление заказами",
          icon: "bi-receipt",
          path: "/orders",
          color: "success",
        },
        {
          title: "Бронирования",
          description: "Управление бронированиями",
          icon: "bi-calendar-check",
          path: "/reservations",
          color: "info",
        },
      ],
      chef: [
        {
          title: "Кухня",
          description: "Управление заказами на кухне",
          icon: "bi-fire",
          path: "/kitchen",
          color: "warning",
        },
      ],
    };

    return [...baseCards, ...(roleCards[user?.role] || [])];
  };

  const handleCardClick = (path) => {
    navigate(path);
  };

  return (
    <div className="min-vh-100 bg-light">
      <Navbar />

      <div className="container-fluid py-4">
        <div className="row mb-4">
          <div className="col-12">
            <h1 className="h3">
              <i className="bi bi-speedometer2 me-2"></i>
              Панель управления
            </h1>
            <p className="text-muted">
              Добро пожаловать, {user?.firstName} {user?.lastName}
            </p>
          </div>
        </div>

        <div className="row g-3">
          {getDashboardCards().map((card, index) => (
            <div key={index} className="col-xl-3 col-lg-4 col-md-6">
              <div
                className={`card border-${card.color} shadow-sm h-100 cursor-pointer`}
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

        {getDashboardCards().length === 1 && (
          <div className="row mt-5">
            <div className="col-12">
              <div className="alert alert-info text-center">
                <i className="bi bi-info-circle me-2"></i>
                Ваш аккаунт ожидает подтверждения администратором для получения
                полного доступа к системе.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
