import React, { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "../../NavBar";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { $authHost } from "../../../http";
import { toast } from "react-toastify";
import socketService from "../../../services/socket";

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
  const [notifications, setNotifications] = useState([]);

  // Refs для отслеживания состояния
  const notificationTimeoutRef = useRef(null);
  const processedNotificationsRef = useRef(new Set());
  const shownAutoReservationNotificationsRef = useRef(new Set()); // Только для автоматических уведомлений

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

  // Функция для ручной проверки бронирований (по кнопке)
  const handleCheckReservations = async () => {
    try {
      console.log("🔍 Ручная проверка всех ближайших бронирований...");
      const response = await $authHost.get("/reservations/upcoming/check");
      const result = response.data;

      console.log("Результат проверки бронирований:", result);

      // Извлекаем массив бронирований из ответа
      const upcomingReservations = result.upcomingReservations || [];

      console.log(
        "Найдено бронирований для ручной проверки:",
        upcomingReservations
      );

      if (upcomingReservations && upcomingReservations.length > 0) {
        // Показываем ОДНО общее уведомление о количестве бронирований
        toast.info(
          `Найдено ${upcomingReservations.length} ближайших бронирований`,
          {
            position: "top-right",
            autoClose: 5000,
          }
        );

        // Показываем уведомления для всех найденных броней
        upcomingReservations.forEach((reservation) => {
          const notificationId = `reservation-manual-${
            reservation.id
          }-${Date.now()}`;

          // Рассчитываем оставшееся время
          const now = new Date();
          const reservedFrom = new Date(reservation.reservedFrom);
          const minutesUntil = Math.round((reservedFrom - now) / 60000);

          // Получаем название стола (может быть в разных полях)
          const tableName =
            reservation.tableName ||
            reservation.table?.name ||
            `Стол ${reservation.tableId}` ||
            "Неизвестный стол";

          const message = `Бронирование через ${minutesUntil} мин.: ${reservation.customerName}`;

          // Добавляем в список уведомлений БЕЗ отдельного toast
          setNotifications((prev) => {
            const newNotification = {
              id: notificationId,
              type: "reservation_upcoming",
              message: message,
              timestamp: new Date().toLocaleTimeString(),
              reservationId: reservation.id,
              tableNumber: tableName,
              minutesUntil: minutesUntil,
              customerName: reservation.customerName,
            };

            // Ограничиваем список 8 уведомлениями
            return [newNotification, ...prev.slice(0, 7)];
          });
        });
      } else {
        toast.info("Ближайших бронирований не найдено", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error("Ошибка ручной проверки бронирований:", error);
      toast.error("Ошибка при проверке бронирований");
    }
  };
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
      let notificationId;

      if (type === "reservation") {
        notificationId = `reservation-${data.reservationId}`;
      } else if (type === "reservation_upcoming") {
        notificationId = `reservation-upcoming-${data.reservationId}`;
      } else {
        notificationId =
          type === "dish"
            ? `dish-${data.orderId}-${data.dishName}`
            : `order-${data.orderId}`;
      }

      // Проверяем, не обрабатывали ли мы уже это уведомление
      if (processedNotificationsRef.current.has(notificationId)) {
        console.log(
          `🔄 Waiter: Пропускаем дублирующее уведомление ${notificationId}`
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

      // Показываем toast с разными стилями
      if (type === "dish") {
        toast.info(`🍽️ ${data.message}`, {
          position: "top-right",
          autoClose: 6000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } else if (type === "order") {
        toast.success(`🛎️ ${data.message}`, {
          position: "top-right",
          autoClose: 8000,
        });
      } else if (type === "reservation") {
        toast.warning(`📅 ${data.message}`, {
          position: "top-right",
          autoClose: 10000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } else if (type === "reservation_upcoming") {
        toast.warning(`⏰ ${data.message}`, {
          position: "top-right",
          autoClose: 15000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
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

        // Ограничиваем список 8 уведомлениями
        return [newNotification, ...prev.slice(0, 7)];
      });

      // Обновляем статистику
      loadStatistics();
    },
    [loadStatistics]
  );

  // WebSocket уведомления
  useEffect(() => {
    console.log("Waiter: Начало инициализации WebSocket");

    const dishNotificationHandler = (data) => {
      console.log("🍽️ Waiter: Получено уведомление о готовом блюде:", data);
      addNotification(data, "dish");
    };

    const orderNotificationHandler = (data) => {
      console.log("🛎️ Waiter: Получено уведомление о готовом заказе:", data);
      addNotification(data, "order");
    };

    const reservationNotificationHandler = (data) => {
      console.log("📅 Waiter: Получено уведомление о бронировании:", data);

      // Для автоматических уведомлений о бронированиях за 15 минут
      if (data.type === "reservation_upcoming") {
        const notificationId = `reservation-auto-${data.reservationId}`;

        // Проверяем, не показывали ли мы уже это автоматическое уведомление
        if (!shownAutoReservationNotificationsRef.current.has(notificationId)) {
          shownAutoReservationNotificationsRef.current.add(notificationId);

          console.log(
            "⏰ Автоматическое уведомление за 15 минут:",
            data.message
          );
          addNotification(data, "reservation_upcoming");

          // Очищаем через 2 часа (после того как бронь прошла)
          setTimeout(() => {
            shownAutoReservationNotificationsRef.current.delete(notificationId);
          }, 2 * 60 * 60 * 1000);
        }
      } else {
        // Обычные уведомления о бронированиях
        addNotification(data, "reservation");
      }
    };

    try {
      // Подключаемся к WebSocket
      socketService.connect();

      // Сообщаем серверу о роли официанта
      if (user) {
        console.log(
          "📤 Waiter: Отправка user_connected с ролью waiter, userId:",
          user.id
        );
        socketService.userConnected({
          role: "waiter",
          userId: user.id,
        });
      }

      // Подписываемся на уведомления
      socketService.subscribeToWaiterDishNotifications(dishNotificationHandler);
      socketService.subscribeToWaiterOrderNotifications(
        orderNotificationHandler
      );
      socketService.subscribeToReservationNotifications(
        reservationNotificationHandler
      );
    } catch (error) {
      console.error("❌ Waiter: Ошибка инициализации WebSocket:", error);
      toast.error("Ошибка подключения к уведомлениям");
    }

    return () => {
      console.log("🧹 Waiter: Очистка WebSocket подписок");
      // Отписываемся от всех уведомлений при размонтировании
      socketService.unsubscribeAll();
      socketService.unsubscribeFromReservationNotifications();

      // Очищаем таймеры
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, [user, addNotification]);

  // Загрузка статистики при монтировании
  useEffect(() => {
    loadStatistics();
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
                      <i className="bi bi-speedometer2 me-2"></i>
                      Панель официанта
                      {socketService.getConnectionStatus() && (
                        <span className="badge bg-success ms-2">
                          <i className="bi bi-wifi"></i> Online
                        </span>
                      )}
                    </h1>
                    <p className="text-muted mb-0">
                      Добро пожаловать, {user?.firstName} {user?.lastName}
                    </p>
                  </div>
                  <div className="col-md-4 text-end">
                    <button
                      className="btn btn-outline-info btn-sm"
                      onClick={handleCheckReservations}
                      title="Показать все ближайшие бронирования (до 15 минут)"
                    >
                      <i className="bi bi-alarm me-1"></i>
                      Проверка бронирования
                    </button>
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
                    Уведомления ({notifications.length})
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
                        <div
                          className={`alert ${
                            notif.type === "reservation" ||
                            notif.type === "reservation_upcoming"
                              ? "alert-warning"
                              : notif.type === "order"
                              ? "alert-success"
                              : "alert-info"
                          } py-2`}
                        >
                          <small>
                            <strong>
                              {notif.type === "reservation_upcoming"
                                ? "⏰ "
                                : notif.type === "reservation"
                                ? "📅 "
                                : notif.type === "order"
                                ? "🛎️ "
                                : "🍽️ "}
                              {notif.message}
                            </strong>
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
                            {notif.minutesUntil && (
                              <>
                                <br />
                                <span className="text-muted">
                                  <i className="bi bi-alarm me-1"></i>
                                  Через: {notif.minutesUntil} мин.
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
