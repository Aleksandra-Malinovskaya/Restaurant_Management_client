import React, { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "../../NavBar";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { $authHost } from "../../../http";
import { toast } from "react-toastify";
import socketService from "../../../services/socket";

const Tranee = () => {
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
  const [notifications, setNotifications] = useState([]);

  // Refs для отслеживания состояния без триггеров рендеринга
  const notificationTimeoutRef = useRef(null);
  const processedNotificationsRef = useRef(new Set());

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

  const formatCurrency = (amount) => {
    const numAmount = parseFloat(amount) || 0;
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numAmount);
  };

  // Функция для добавления уведомления с защитой от дубликатов
  const addNotification = useCallback(
    (data, type = "dish") => {
      const notificationId =
        type === "dish"
          ? `dish-${data.orderId}-${data.dishName}`
          : `order-${data.orderId}`;

      // Проверяем, не обрабатывали ли мы уже это уведомление
      if (processedNotificationsRef.current.has(notificationId)) {
        console.log(
          `🔄 Tranee: Пропускаем дублирующее уведомление ${notificationId}`
        );
        return;
      }

      // Добавляем в множество обработанных
      processedNotificationsRef.current.add(notificationId);

      // Очищаем через 10 секунд из множества обработанных
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      notificationTimeoutRef.current = setTimeout(() => {
        processedNotificationsRef.current.delete(notificationId);
      }, 10000);

      // Показываем toast
      if (type === "dish") {
        toast.info(`🍽️ ${data.message}`, {
          position: "top-right",
          autoClose: 6000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } else {
        toast.success(`🛎️ ${data.message}`, {
          position: "top-right",
          autoClose: 8000,
        });
      }

      // Добавляем в список уведомлений
      setNotifications((prev) => {
        const newNotification = {
          ...data,
          id: notificationId,
          type,
          timestamp: data.timestamp || new Date().toLocaleTimeString(),
        };

        // Ограничиваем список 6 уведомлениями
        return [newNotification, ...prev.slice(0, 5)];
      });

      // Обновляем статистику
      loadStatistics();
    },
    [loadStatistics]
  );

  // WebSocket уведомления
  useEffect(() => {
    console.log("Tranee: Начало инициализации WebSocket");

    const dishNotificationHandler = (data) => {
      console.log("🍽️ Tranee: Получено уведомление о готовом блюде:", data);
      addNotification(data, "dish");
    };

    const orderNotificationHandler = (data) => {
      console.log("🛎️ Tranee: Получено уведомление о готовом заказе:", data);
      addNotification(data, "order");
    };

    try {
      // Подключаемся к WebSocket
      socketService.connect();

      // Сообщаем серверу о роли стажера
      if (user) {
        console.log(
          "📤 Tranee: Отправка user_connected с ролью tranee, userId:",
          user.id
        );
        socketService.userConnected({
          role: "tranee",
          userId: user.id,
        });
      }

      // Подписываемся на уведомления
      socketService.subscribeToWaiterDishNotifications(dishNotificationHandler);
      socketService.subscribeToWaiterOrderNotifications(
        orderNotificationHandler
      );
    } catch (error) {
      console.error("❌ Tranee: Ошибка инициализации WebSocket:", error);
      toast.error("Ошибка подключения к уведомлениям с кухни");
    }

    return () => {
      console.log("🧹 Tranee: Очистка WebSocket подписок");
      // Отписываемся от всех уведомлений при размонтировании
      socketService.unsubscribeAll();

      // Очищаем таймеры
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, [user, addNotification]);

  useEffect(() => {
    loadStatistics();

    const interval = setInterval(loadStatistics, 60000);
    return () => clearInterval(interval);
  }, [loadStatistics]);

  const traneeCards = [
    {
      title: "📋 Меню ресторана",
      description: "Просмотр всего меню и состава блюд",
      path: "/tranee/menu",
      color: "success",
      icon: "bi-book",
    },
    {
      title: "⚙️ Настройки",
      description: "Смена пароля и личных данных",
      path: "/tranee/settings",
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

  const clearNotifications = () => {
    setNotifications([]);
    processedNotificationsRef.current.clear();
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
                      <i className="bi bi-person-badge me-2"></i>
                      Панель стажера
                      {socketService.getConnectionStatus() && (
                        <span className="badge bg-success ms-2">
                          <i className="bi bi-wifi"></i> Online
                        </span>
                      )}
                    </h1>
                    <p className="text-muted mb-0">
                      Добро пожаловать, {user?.firstName} {user?.lastName}
                    </p>
                    <small className="text-info">
                      <i className="bi bi-info-circle me-1"></i>
                      Режим обучения - доступен просмотр меню и статистики
                    </small>
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

        {/* Панель уведомлений WebSocket */}
        {notifications.length > 0 && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-success">
                <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
                  <span>
                    <i className="bi bi-bell me-2"></i>
                    Уведомления с кухни ({notifications.length})
                  </span>
                  <button
                    className="btn btn-sm btn-light"
                    onClick={clearNotifications}
                  >
                    <i className="bi bi-trash me-1"></i>
                    Очистить
                  </button>
                </div>
                <div className="card-body">
                  <div className="row">
                    {notifications.map((notif) => (
                      <div key={notif.id} className="col-md-4 mb-2">
                        <div className="alert alert-success py-2">
                          <small>
                            <strong>{notif.message}</strong>
                            <br />
                            <span className="text-muted">
                              <i className="bi bi-clock me-1"></i>
                              {notif.timestamp}
                            </span>
                            {notif.tableNumber && (
                              <>
                                <br />
                                <span className="text-muted">
                                  <i className="bi bi-table me-1"></i>
                                  Стол: {notif.tableNumber}
                                </span>
                              </>
                            )}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
                  <i className="bi bi-graph-up me-2"></i>
                  Статистика зала (только просмотр)
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
              <i className="bi bi-mortarboard me-2"></i>
              Функции стажера
            </h4>
          </div>
        </div>

        {/* Карточки функций */}
        <div className="row g-3 justify-content-center">
          {traneeCards.map((card, index) => (
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

        {/* Информация для стажера */}
        <div className="row mt-4">
          <div className="col-12">
            <div className="card border-primary">
              <div className="card-header bg-primary text-white">
                <i className="bi bi-mortarboard me-2"></i>
                Информация для стажера
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-6">
                    <h6>Доступные функции:</h6>
                    <ul className="list-unstyled">
                      <li>
                        <i className="bi bi-check-circle text-success me-2"></i>
                        Просмотр меню ресторана
                      </li>
                      <li>
                        <i className="bi bi-check-circle text-success me-2"></i>
                        Просмотр статистики зала
                      </li>
                      <li>
                        <i className="bi bi-check-circle text-success me-2"></i>
                        Получение уведомлений с кухни
                      </li>
                      <li>
                        <i className="bi bi-check-circle text-success me-2"></i>
                        Настройки профиля
                      </li>
                    </ul>
                  </div>
                  <div className="col-md-6">
                    <h6>Ограничения:</h6>
                    <ul className="list-unstyled">
                      <li>
                        <i className="bi bi-x-circle text-secondary me-2"></i>
                        Управление столиками
                      </li>
                      <li>
                        <i className="bi bi-x-circle text-secondary me-2"></i>
                        Создание заказов
                      </li>
                      <li>
                        <i className="bi bi-x-circle text-secondary me-2"></i>
                        Управление бронированиями
                      </li>
                      <li>
                        <i className="bi bi-x-circle text-secondary me-2"></i>
                        Финансовые операции
                      </li>
                    </ul>
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

export default Tranee;
