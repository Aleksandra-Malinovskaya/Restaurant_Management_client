import React, { useState, useEffect } from "react";
import Navbar from "../../NavBar";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { $authHost } from "../../../http";

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
  const [error, setError] = useState("");

  // Вспомогательная функция для безопасной работы с массивами
  const safeFilter = (data, filterFn) => {
    if (!Array.isArray(data)) {
      console.warn("Данные не являются массивом:", data);
      return [];
    }
    return data.filter(filterFn);
  };

  // Функция для извлечения данных из ответа API (поддержка формата {rows: [], count: X})
  const extractData = (responseData) => {
    if (Array.isArray(responseData)) {
      return responseData;
    } else if (responseData && Array.isArray(responseData.rows)) {
      return responseData.rows;
    } else if (responseData && Array.isArray(responseData.data)) {
      return responseData.data;
    }
    return [];
  };

  const loadStatistics = async () => {
    try {
      setLoading(true);
      setError("");

      // Параллельно загружаем все данные
      const [
        ordersResponse,
        tablesResponse,
        usersResponse,
        dishesResponse,
        reservationsResponse,
      ] = await Promise.all([
        $authHost.get("/orders").catch((err) => {
          return { data: [] };
        }),
        $authHost.get("/tables").catch((err) => {
          return { data: [] };
        }),
        $authHost.get("/users").catch((err) => {
          return { data: [] };
        }),
        $authHost.get("/dishes").catch((err) => {
          return { data: { rows: [] } };
        }),
        $authHost.get("/reservations").catch((err) => {
          return { data: [] };
        }),
      ]);

      // Извлекаем данные с учетом структуры ответа
      const ordersData = extractData(ordersResponse.data);
      const tablesData = extractData(tablesResponse.data);
      const usersData = extractData(usersResponse.data);
      const dishesData = extractData(dishesResponse.data);
      const reservationsData = extractData(reservationsResponse.data);

      console.log("Dishes data for statistics:", dishesData); // Для отладки

      // Анализируем данные и считаем статистику с безопасными методами
      const activeOrders = safeFilter(
        ordersData,
        (order) => order.status === "open" || order.status === "in_progress"
      ).length;

      const freeTables = safeFilter(
        tablesData,
        (table) => table.isActive === true
      ).length;

      const activeEmployees = safeFilter(
        usersData,
        (user) => user.isActive === true
      ).length;

      // Исправляем подсчет блюд на стопе - только по полю isStopped
      const stoppedDishes = safeFilter(
        dishesData,
        (dish) => dish.isStopped === true
      ).length;

      console.log("Stopped dishes count:", stoppedDishes); // Для отладки

      // Выручка за сегодня
      const today = new Date().toISOString().split("T")[0];
      const todayRevenue = safeFilter(ordersData, (order) => {
        const orderDate = order.createdAt ? order.createdAt.split("T")[0] : "";
        return orderDate === today && order.status === "closed";
      }).reduce((sum, order) => sum + parseFloat(order.totalAmount || 0), 0);

      // Бронирования на сегодня
      const todayReservations = safeFilter(reservationsData, (reservation) => {
        const reservationDate = reservation.reservedFrom
          ? reservation.reservedFrom.split("T")[0]
          : "";
        return reservationDate === today && reservation.status === "confirmed";
      }).length;

      const newStats = {
        activeOrders,
        freeTables,
        todayReservations,
        stoppedDishes,
        activeEmployees,
        todayRevenue,
      };

      setStats(newStats);
    } catch (error) {
      console.error("Ошибка загрузки статистики:", error);
      const errorMessage = `Не удалось загрузить статистику: ${error.message}`;
      setError(errorMessage);

      // Fallback данные для демонстрации
      setStats({
        activeOrders: 12,
        freeTables: 8,
        todayReservations: 6,
        stoppedDishes: 3,
        activeEmployees: 9,
        todayRevenue: 18750,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      minimumFractionDigits: 0,
    }).format(amount);
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
            <div className="card border-info">
              <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
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
      </div>
    </div>
  );
};

export default Admin;
