import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../../NavBar";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { $authHost } from "../../../http";

const AdminPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeOrders: 0,
    freeTables: 0,
    todayReservations: 0,
    dishesOnTable: 0,
    activeEmployees: 0,
    todayRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStatistics = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [
        ordersResponse,
        tablesResponse,
        reservationsResponse,
        employeesResponse,
      ] = await Promise.all([
        $authHost.get("/orders").catch(() => ({ data: [] })),
        $authHost.get("/tables").catch(() => ({ data: [] })),
        $authHost.get("/reservations").catch(() => ({ data: [] })),
        $authHost.get("/employees/active").catch(() => ({ data: [] })),
      ]);

      const orders = Array.isArray(ordersResponse.data)
        ? ordersResponse.data
        : [];
      const tables = Array.isArray(tablesResponse.data)
        ? tablesResponse.data
        : [];
      const reservations = Array.isArray(reservationsResponse.data)
        ? reservationsResponse.data
        : [];
      const employees = Array.isArray(employeesResponse.data)
        ? employeesResponse.data
        : [];

      // Активные заказы
      const activeOrders = orders.filter((order) =>
        ["open", "in_progress", "ready"].includes(order.status)
      ).length;

      // Свободные столики
      const now = new Date();
      const occupiedTables = tables.filter((table) => {
        const tableOrders = orders.filter(
          (order) =>
            order.tableId === table.id &&
            ["open", "in_progress", "ready"].includes(order.status)
        );

        const currentReservation = reservations.find(
          (reservation) =>
            reservation.tableId === table.id &&
            new Date(reservation.reservedFrom) <= now &&
            new Date(reservation.reservedTo) >= now &&
            ["confirmed", "seated"].includes(reservation.status)
        );

        return (
          tableOrders.length > 0 ||
          (currentReservation && currentReservation.status === "seated")
        );
      }).length;

      const freeTables = tables.length - occupiedTables;

      // Бронирования на сегодня
      const today = new Date().toISOString().split("T")[0];
      const todayReservations = reservations.filter((reservation) => {
        const reservationDate = new Date(reservation.reservedFrom)
          .toISOString()
          .split("T")[0];
        return (
          reservationDate === today &&
          ["confirmed", "seated"].includes(reservation.status)
        );
      }).length;

      // Блюда на столе (активные заказы с блюдами)
      const dishesOnTable = orders
        .filter((order) =>
          ["open", "in_progress", "ready"].includes(order.status)
        )
        .reduce((sum, order) => sum + (order.itemsCount || 0), 0);

      // Активные сотрудники
      const activeEmployees = employees.length;

      // Выручка за сегодня
      const todayRevenue = orders
        .filter((order) => {
          const orderDate = order.createdAt
            ? order.createdAt.split("T")[0]
            : "";
          return orderDate === today && order.status === "closed";
        })
        .reduce((sum, order) => sum + (order.totalAmount || 0), 0);

      setStats({
        activeOrders,
        freeTables,
        todayReservations,
        dishesOnTable,
        activeEmployees,
        todayRevenue,
      });
    } catch (error) {
      console.error("Ошибка загрузки статистики:", error);
      setError("Не удалось загрузить статистику");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatistics();

    // Обновление статистики каждые 30 секунд
    const interval = setInterval(loadStatistics, 30000);
    return () => clearInterval(interval);
  }, [loadStatistics]);

  // ИСПРАВЛЕННЫЕ ПУТИ - все ведут на /admin-panel/*
  const adminCards = [
    {
      title: "🍽️ Блюда",
      description: "Управление меню ресторана",
      path: "/admin-panel/dishes",
      color: "primary",
      icon: "bi-cup-straw",
    },
    {
      title: "📑 Категории",
      description: "Управление категориями блюд",
      path: "/admin-panel/categories",
      color: "success",
      icon: "bi-tags",
    },
    {
      title: "📊 Статистика",
      description: "Подробная статистика и отчеты",
      path: "/admin-panel/stats", // исправлено с statistics на stats
      color: "info",
      icon: "bi-graph-up",
    },
    {
      title: "🪑 Столики и заказы",
      description: "Управление столиками и QR-кодами",
      path: "/admin-panel/tables",
      color: "warning",
      icon: "bi-table",
    },
    {
      title: "⚙️ Настройки",
      description: "Настройки системы",
      path: "/admin-panel/settings", // исправлено с /admin/settings на /admin-panel/settings
      color: "dark",
      icon: "bi-gear",
    },
  ];

  const handleCardClick = (path) => {
    navigate(path);
  };

  const handleRefreshStats = () => {
    loadStatistics();
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
                      Панель администратора
                    </h1>
                    <p className="text-muted mb-0">
                      Добро пожаловать, {user?.firstName} {user?.lastName}
                    </p>
                  </div>
                  <div className="col-md-4 text-end">
                    <span className="badge bg-danger fs-6">Администратор</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Сообщение об ошибке */}
        {error && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="alert alert-warning d-flex align-items-center justify-content-between">
                <div>
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error}
                </div>
                <button
                  className="btn btn-sm btn-outline-warning"
                  onClick={handleRefreshStats}
                >
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Повторить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Быстрая статистика */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-primary">
              <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                <span>
                  <i className="bi bi-info-circle me-2"></i>
                  Быстрая статистика
                </span>
                <div>
                  <small className="me-3">
                    Обновлено: {new Date().toLocaleTimeString()}
                  </small>
                  <button
                    className="btn btn-sm btn-light"
                    onClick={handleRefreshStats}
                    disabled={loading}
                  >
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Обновить
                  </button>
                </div>
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
                      <h4 className="text-info mb-1">
                        {stats.todayReservations}
                      </h4>
                      <small className="text-muted">Бронирований сегодня</small>
                    </div>
                  </div>
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-warning mb-1">
                        {stats.dishesOnTable}
                      </h4>
                      <small className="text-muted">Блюд на столе</small>
                    </div>
                  </div>
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-secondary mb-1">
                        {stats.activeEmployees}
                      </h4>
                      <small className="text-muted">Активных сотрудников</small>
                    </div>
                  </div>
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-dark mb-1">{stats.todayRevenue} ₽</h4>
                      <small className="text-muted">Выручка сегодня</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Управление системой */}
        <div className="row mb-4">
          <div className="col-12">
            <h4 className="mb-3">
              <i className="bi bi-gear me-2"></i>
              Управление системой
            </h4>
          </div>
        </div>

        {/* Карточки функций */}
        <div className="row g-3 justify-content-center">
          {adminCards.map((card, index) => (
            <div key={index} className="col-xl-4 col-lg-4 col-md-6">
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
      </div>
    </div>
  );
};

export default AdminPanel;
