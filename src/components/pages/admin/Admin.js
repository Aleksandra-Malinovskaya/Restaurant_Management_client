import React, { useState, useEffect } from "react";
import Navbar from "../../NavBar";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeOrders: 0,
    freeTables: 0,
    todayReservations: 0,
    stoppedDishes: 0,
    activeEmployees: 0,
    todayRevenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      // Здесь будут реальные запросы к API
      // Пока используем mock данные
      const mockStats = {
        activeOrders: 24,
        freeTables: 15,
        todayReservations: 8,
        stoppedDishes: 3,
        activeEmployees: 12,
        todayRevenue: 45230,
      };
      setStats(mockStats);
    } catch (error) {
      console.error("Ошибка загрузки статистики:", error);
    } finally {
      setLoading(false);
    }
  };

  const adminCards = [
    {
      title: "👥 Пользователи",
      description: "Управление сотрудниками и ролями",
      path: "/admin/users",
      color: "primary",
      icon: "bi-people-fill",
      role: "super_admin",
    },
    {
      title: "🍽️ Блюда",
      description: "Управление меню ресторана",
      path: "/admin/dishes",
      color: "success",
      icon: "bi-egg-fried",
      role: "admin",
    },
    {
      title: "📂 Категории",
      description: "Управление категориями блюд",
      path: "/admin/categories",
      color: "info",
      icon: "bi-folder-fill",
      role: "admin",
    },
    {
      title: "🪑 Столики",
      description: "Управление столиками и QR-кодами",
      path: "/admin/tables",
      color: "warning",
      icon: "bi-table",
      role: "admin",
    },
    {
      title: "📊 Статистика",
      description: "Отчеты и аналитика продаж",
      path: "/admin/statistics",
      color: "dark",
      icon: "bi-graph-up",
      role: "admin",
    },
    {
      title: "📋 Все заказы",
      description: "Просмотр и управление заказами",
      path: "/admin/orders",
      color: "secondary",
      icon: "bi-receipt",
      role: "admin",
    },
  ];

  const handleCardClick = (path) => {
    navigate(path);
  };

  const getAvailableCards = () => {
    return adminCards.filter(
      (card) => user?.role === "super_admin" || card.role !== "super_admin"
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-vh-100 bg-light">
        <Navbar />
        <div className="d-flex justify-content-center align-items-center vh-100">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Загрузка...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light">
      <Navbar />

      <div className="container-fluid py-4">
        {/* Заголовок и приветствие */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card bg-white shadow-sm">
              <div className="card-body">
                <div className="row align-items-center">
                  <div className="col-md-8">
                    <h1 className="h3 mb-2">
                      <i className="bi bi-speedometer2 me-2"></i>
                      {user?.role === "super_admin"
                        ? "Панель супер-администратора"
                        : "Панель администратора"}
                    </h1>
                    <p className="text-muted mb-0">
                      Добро пожаловать, {user?.firstName} {user?.lastName}
                    </p>
                  </div>
                  <div className="col-md-4 text-end">
                    <span
                      className={`badge ${
                        user?.role === "super_admin"
                          ? "bg-danger"
                          : "bg-primary"
                      } fs-6`}
                    >
                      {user?.role === "super_admin"
                        ? "Супер-администратор"
                        : "Администратор"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Быстрая статистика */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-info">
              <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
                <span>
                  <i className="bi bi-info-circle me-2"></i>
                  Быстрая статистика
                </span>
                <small>Обновлено: {new Date().toLocaleTimeString()}</small>
              </div>
              <div className="card-body">
                <div className="row text-center">
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-primary mb-1">
                        {stats.activeOrders}
                      </h4>
                      <small className="text-muted">Активных заказов</small>
                    </div>
                  </div>
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-success mb-1">{stats.freeTables}</h4>
                      <small className="text-muted">Свободных столиков</small>
                    </div>
                  </div>
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-warning mb-1">
                        {stats.todayReservations}
                      </h4>
                      <small className="text-muted">Бронирований сегодня</small>
                    </div>
                  </div>
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-danger mb-1">
                        {stats.stoppedDishes}
                      </h4>
                      <small className="text-muted">Блюд на стопе</small>
                    </div>
                  </div>
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-info mb-1">
                        {stats.activeEmployees}
                      </h4>
                      <small className="text-muted">Активных сотрудников</small>
                    </div>
                  </div>
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-dark mb-1">
                        {formatCurrency(stats.todayRevenue)}
                      </h4>
                      <small className="text-muted">Выручка сегодня</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Основные функции */}
        <div className="row">
          <div className="col-12">
            <h4 className="mb-3">
              <i className="bi bi-grid-3x3-gap me-2"></i>
              Управление системой
            </h4>
          </div>
        </div>

        <div className="row g-3">
          {getAvailableCards().map((card, index) => (
            <div key={index} className="col-xl-4 col-lg-6 col-md-6">
              <div
                className={`card border-${card.color} shadow-sm h-100`}
                style={{ cursor: "pointer", transition: "all 0.3s" }}
                onClick={() => handleCardClick(card.path)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 25px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 2px 10px rgba(0,0,0,0.1)";
                }}
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
                  <small className="text-muted">
                    <i className="bi bi-arrow-right me-1"></i>
                    Перейти к управлению
                  </small>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Последние действия */}
        <div className="row mt-5">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-clock-history me-2"></i>
                  Последние действия
                </h5>
              </div>
              <div className="card-body">
                <div className="list-group list-group-flush">
                  <div className="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <i className="bi bi-person-plus text-success me-2"></i>
                      Новый пользователь: Иван Петров (официант)
                    </div>
                    <small className="text-muted">10 минут назад</small>
                  </div>
                  <div className="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <i className="bi bi-egg-fried text-warning me-2"></i>
                      Блюдо "Пицца Маргарита" поставлено на стоп
                    </div>
                    <small className="text-muted">1 час назад</small>
                  </div>
                  <div className="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                      <i className="bi bi-table text-info me-2"></i>
                      Добавлен новый столик №15
                    </div>
                    <small className="text-muted">2 часа назад</small>
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
