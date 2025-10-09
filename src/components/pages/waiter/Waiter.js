import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../../NavBar";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { $authHost } from "../../../http";

const Waiter = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeOrders: 0,
    readyOrders: 0,
    occupiedTables: 0,
    freeTables: 0,
    todayReservations: 0,
    todayRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStatistics = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [ordersResponse, tablesResponse, reservationsResponse] =
        await Promise.all([
          $authHost.get("/orders").catch(() => ({ data: [] })),
          $authHost.get("/tables").catch(() => ({ data: [] })),
          $authHost.get("/reservations").catch(() => ({ data: [] })),
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

      // Активные заказы
      const activeOrders = orders.filter((order) =>
        ["open", "in_progress", "ready"].includes(order.status)
      ).length;

      // Готовые заказы
      const readyOrders = orders.filter(
        (order) => order.status === "ready"
      ).length;

      // Статистика столиков
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
        readyOrders,
        occupiedTables,
        freeTables,
        todayReservations,
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

  const waiterCards = [
    {
      title: "🪑 Управление столиками",
      description: "Просмотр и управление всеми столиками",
      path: "/waiter/tables",
      color: "primary",
      icon: "bi-grid-3x3-gap",
    },
    {
      title: "📋 Меню ресторана",
      description: "Просмотр всего меню и состава блюд",
      path: "/waiter/menu",
      color: "success",
      icon: "bi-book",
    },
    {
      title: "📅 Бронирования",
      description: "Управление бронированиями столиков",
      path: "/waiter/reservations",
      color: "info",
      icon: "bi-calendar-event",
    },
    {
      title: "⚙️ Настройки",
      description: "Смена пароля и личных данных",
      path: "/waiter/settings",
      color: "warning",
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
                      Панель официанта
                    </h1>
                    <p className="text-muted mb-0">
                      Добро пожаловать, {user?.firstName} {user?.lastName}
                    </p>
                  </div>
                  <div className="col-md-4 text-end">
                    <span className="badge bg-success fs-6">Официант</span>
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
            <div className="card border-success">
              <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
                <span>
                  <i className="bi bi-info-circle me-2"></i>
                  Статистика зала
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
                      <h4 className="text-warning mb-1">{stats.readyOrders}</h4>
                      <small className="text-muted">Готовы к подаче</small>
                    </div>
                  </div>
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-danger mb-1">
                        {stats.occupiedTables}
                      </h4>
                      <small className="text-muted">Занято столиков</small>
                    </div>
                  </div>
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-success mb-1">{stats.freeTables}</h4>
                      <small className="text-muted">Свободно столиков</small>
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
                      <h4 className="text-dark mb-1">{stats.todayRevenue}</h4>
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
              Управление залом
            </h4>
          </div>
        </div>

        {/* Карточки функций */}
        <div className="row g-3 justify-content-center">
          {waiterCards.map((card, index) => (
            <div key={index} className="col-xl-3 col-lg-4 col-md-6">
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
                    Перейти
                  </small>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Срочные уведомления */}
        <div className="row mt-4">
          <div className="col-12">
            <div className="card border-warning">
              <div className="card-header bg-warning text-white">
                <i className="bi bi-bell me-2"></i>
                Срочные уведомления
              </div>
              <div className="card-body">
                {stats.readyOrders > 0 ? (
                  <div className="alert alert-success mb-0">
                    <i className="bi bi-cup-straw me-2"></i>
                    <strong>Внимание!</strong> {stats.readyOrders} заказ(ов)
                    готовы к подаче. Пожалуйста, заберите их с кухни.
                  </div>
                ) : stats.todayReservations > 0 ? (
                  <div className="alert alert-info mb-0">
                    <i className="bi bi-calendar-check me-2"></i>
                    На сегодня запланировано {stats.todayReservations}{" "}
                    бронирований. Подготовьте столики к приему гостей.
                  </div>
                ) : (
                  <p className="text-muted mb-0">
                    <i className="bi bi-check-circle me-2 text-success"></i>
                    Все заказы обработаны, срочных действий не требуется
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Waiter;
