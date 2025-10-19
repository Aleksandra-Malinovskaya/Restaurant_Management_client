import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../NavBar";
import { $authHost } from "../../../http";
import { formatLocalDateTime } from "../../../utils/dateUtils";
import { toast } from "react-toastify";
import socketService from "../../../services/socket";
import { useAuth } from "../../../context/AuthContext"; // Добавляем контекст аутентификации

const WaiterTables = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); // Получаем данные пользователя
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState("all"); // "all" или "my"

  // Refs для отслеживания состояния без триггеров рендеринга
  const notificationTimeoutRef = useRef(null);
  const processedNotificationsRef = useRef(new Set());

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Загружаем столики
      const tablesResponse = await $authHost.get("/tables");
      setTables(tablesResponse.data);

      // Загружаем активные заказы (ВКЛЮЧАЯ served и payment)
      const ordersResponse = await $authHost.get("/orders");
      const activeOrders = ordersResponse.data.filter((order) =>
        ["open", "in_progress", "ready", "served", "payment"].includes(
          order.status
        )
      );
      setOrders(activeOrders);

      // Загружаем сегодняшние бронирования
      const today = new Date().toISOString().split("T")[0];
      const reservationsResponse = await $authHost.get(
        `/reservations?date=${today}`
      );
      setReservations(reservationsResponse.data);
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
    } finally {
      setLoading(false);
    }
  }, []);

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
          `🔄 WaiterTables: Пропускаем дублирующее уведомление ${notificationId}`
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

      // Автоматически обновляем данные при уведомлении
      loadData();
    },
    [loadData]
  );

  // WebSocket уведомления
  useEffect(() => {
    console.log("WaiterTables: Инициализация WebSocket");

    const orderNotificationHandler = (data) => {
      console.log("🛎️ WaiterTables: Уведомление о готовом заказе:", data);
      addNotification(data, "order");
    };

    const dishNotificationHandler = (data) => {
      console.log("🍽️ WaiterTables: Уведомление о готовом блюде:", data);
      addNotification(data, "dish");
    };

    try {
      // Подписываемся на уведомления
      socketService.subscribeToWaiterOrderNotifications(
        orderNotificationHandler
      );
      socketService.subscribeToWaiterDishNotifications(dishNotificationHandler);

      return () => {
        console.log("🧹 WaiterTables: Очистка WebSocket подписок");
        // Отписываемся от всех уведомлений при размонтировании
        socketService.unsubscribeAll();

        // Очищаем таймеры
        if (notificationTimeoutRef.current) {
          clearTimeout(notificationTimeoutRef.current);
        }
      };
    } catch (error) {
      console.error("❌ WaiterTables: Ошибка инициализации WebSocket:", error);
    }
  }, [addNotification]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBack = () => {
    navigate("/waiter");
  };

  const clearNotifications = () => {
    setNotifications([]);
    processedNotificationsRef.current.clear();
  };

  const handleTableClick = (table) => {
    navigate(`/waiter/table/${table.id}`);
  };

  // Получаем столы официанта (где есть его активные заказы)
  const getMyTables = () => {
    if (!user) return [];

    const myOrders = orders.filter((order) => order.waiterId === user.id);
    const myTableIds = [...new Set(myOrders.map((order) => order.tableId))];

    return tables.filter((table) => myTableIds.includes(table.id));
  };

  // ИСПРАВЛЕННАЯ функция определения статуса столика с учетом закрытых заказов
  const getTableStatus = (table) => {
    const tableOrders = orders.filter(
      (order) =>
        order.tableId === table.id &&
        ["open", "in_progress", "ready", "served", "payment"].includes(
          order.status
        )
    );

    const now = new Date();

    // Исправляем проверку бронирований - добавляем коррекцию времени
    const currentReservation = reservations.find((reservation) => {
      if (reservation.tableId !== table.id) return false;

      const reservedFrom = new Date(reservation.reservedFrom);
      const reservedTo = new Date(reservation.reservedTo);

      // КОРРЕКТИРОВКА ВРЕМЕНИ ДЛЯ СРАВНЕНИЯ (UTC+3)
      const timezoneOffset = now.getTimezoneOffset() * 60000;
      const localNow = new Date(
        now.getTime() + timezoneOffset + 3 * 60 * 60000
      );
      const localReservedFrom = new Date(
        reservedFrom.getTime() + timezoneOffset + 3 * 60 * 60000
      );
      const localReservedTo = new Date(
        reservedTo.getTime() + timezoneOffset + 3 * 60 * 60000
      );

      return (
        localReservedFrom <= localNow &&
        localReservedTo >= localNow &&
        ["confirmed", "seated"].includes(reservation.status)
      );
    });

    // ВАЖНОЕ ИЗМЕНЕНИЕ: если есть активные заказы - стол ЗАНЯТ
    if (tableOrders.length > 0) return "occupied";

    // Если заказов нет, но есть активная бронь со статусом "seated" - проверяем время
    if (currentReservation && currentReservation.status === "seated") {
      // Если время брони еще не истекло, но заказов нет - стол все равно ЗАНЯТ
      // (гости могут просто отдыхать)
      return "occupied";
    }

    if (currentReservation && currentReservation.status === "confirmed")
      return "reserved";

    // ДОБАВЛЯЕМ ПРОВЕРКУ НА СКОРОЕ БРОНИРОВАНИЕ
    const soon = new Date(now.getTime() + 30 * 60000); // 30 минут
    const upcomingReservation = reservations.find((reservation) => {
      if (reservation.tableId !== table.id) return false;

      const reservedFrom = new Date(reservation.reservedFrom);
      const reservedTo = new Date(reservation.reservedTo);

      // КОРРЕКТИРОВКА ВРЕМЕНИ
      const timezoneOffset = now.getTimezoneOffset() * 60000;
      const localSoon = new Date(
        soon.getTime() + timezoneOffset + 3 * 60 * 60000
      );
      const localReservedFrom = new Date(
        reservedFrom.getTime() + timezoneOffset + 3 * 60 * 60000
      );
      const localReservedTo = new Date(
        reservedTo.getTime() + timezoneOffset + 3 * 60 * 60000
      );

      return (
        localReservedFrom <= localSoon &&
        localReservedTo > now &&
        ["confirmed", "seated"].includes(reservation.status)
      );
    });

    if (upcomingReservation) return "reserved_soon";

    return "free";
  };

  // Обновите функцию getStatusText
  const getStatusText = (status) => {
    switch (status) {
      case "occupied":
        return "Занят";
      case "reserved":
        return "Забронирован";
      case "reserved_soon":
        return "Скоро бронь";
      case "free":
        return "Свободен";
      default:
        return "Неизвестно";
    }
  };

  // Обновите функцию getStatusColor
  const getStatusColor = (status) => {
    switch (status) {
      case "occupied":
        return "danger";
      case "reserved":
        return "warning";
      case "reserved_soon":
        return "info";
      case "free":
        return "success";
      default:
        return "secondary";
    }
  };

  // Функция для получения информации о бронировании столика
  const getTableReservationInfo = (tableId) => {
    const now = new Date();
    const tableReservations = reservations.filter((r) => r.tableId === tableId);

    // Текущее бронирование
    const currentReservation = tableReservations.find((reservation) => {
      const reservedFrom = new Date(reservation.reservedFrom);
      const reservedTo = new Date(reservation.reservedTo);

      const timezoneOffset = now.getTimezoneOffset() * 60000;
      const localNow = new Date(
        now.getTime() + timezoneOffset + 3 * 60 * 60000
      );
      const localReservedFrom = new Date(
        reservedFrom.getTime() + timezoneOffset + 3 * 60 * 60000
      );
      const localReservedTo = new Date(
        reservedTo.getTime() + timezoneOffset + 3 * 60 * 60000
      );

      return (
        localReservedFrom <= localNow &&
        localReservedTo >= localNow &&
        ["confirmed", "seated"].includes(reservation.status)
      );
    });

    if (currentReservation) {
      return {
        type: "current",
        reservation: currentReservation,
        text: `Бронь до: ${formatLocalDateTime(currentReservation.reservedTo)}`,
      };
    }

    // Ближайшее бронирование
    const soon = new Date(now.getTime() + 30 * 60000);
    const upcomingReservation = tableReservations.find((reservation) => {
      const reservedFrom = new Date(reservation.reservedFrom);
      const reservedTo = new Date(reservation.reservedTo);

      const timezoneOffset = now.getTimezoneOffset() * 60000;
      const localSoon = new Date(
        soon.getTime() + timezoneOffset + 3 * 60 * 60000
      );
      const localReservedFrom = new Date(
        reservedFrom.getTime() + timezoneOffset + 3 * 60 * 60000
      );
      const localReservedTo = new Date(
        reservedTo.getTime() + timezoneOffset + 3 * 60 * 60000
      );

      return (
        localReservedFrom <= localSoon &&
        localReservedTo > now &&
        ["confirmed", "seated"].includes(reservation.status)
      );
    });

    if (upcomingReservation) {
      return {
        type: "upcoming",
        reservation: upcomingReservation,
        text: `Бронь с: ${formatLocalDateTime(
          upcomingReservation.reservedFrom
        )}`,
      };
    }

    return null;
  };

  // Получаем заказы для конкретного стола
  const getTableOrders = (tableId) => {
    return orders.filter(
      (order) =>
        order.tableId === tableId &&
        ["open", "in_progress", "ready", "served", "payment"].includes(
          order.status
        )
    );
  };

  // Проверяем, является ли стол "моим" (есть активные заказы официанта)
  const isMyTable = (table) => {
    if (!user) return false;
    const tableOrders = getTableOrders(table.id);
    return tableOrders.some((order) => order.waiterId === user.id);
  };

  // Фильтрация столиков
  const filteredTables = tables.filter((table) => {
    const status = getTableStatus(table);
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    const matchesSearch = table.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    // Фильтр по вкладкам
    const matchesTab =
      activeTab === "all" || (activeTab === "my" && isMyTable(table));

    return matchesStatus && matchesSearch && matchesTab;
  });

  // Функция для получения текста статуса заказа
  const getOrderStatusText = (status) => {
    switch (status) {
      case "open":
        return "Открыт";
      case "in_progress":
        return "Готовится";
      case "ready":
        return "Готов";
      case "served":
        return "Подано";
      case "payment":
        return "Ожидает оплаты";
      default:
        return status;
    }
  };

  // Функция для получения цвета статуса заказа
  const getOrderStatusColor = (status) => {
    switch (status) {
      case "open":
        return "primary";
      case "in_progress":
        return "warning";
      case "ready":
        return "success";
      case "served":
        return "info";
      case "payment":
        return "warning";
      default:
        return "secondary";
    }
  };

  // Функция для расчета суммы заказа
  const calculateOrderTotal = (items) => {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((total, item) => {
      const price = Number(item.price) || Number(item.itemPrice) || 0;
      const quantity = Number(item.quantity) || 0;
      return total + price * quantity;
    }, 0);
  };

  // Получаем статистику по моим столам
  const getMyTablesStats = () => {
    const myTables = getMyTables();
    const myOrders = orders.filter((order) => order.waiterId === user?.id);

    return {
      totalTables: myTables.length,
      activeOrders: myOrders.filter((order) =>
        ["open", "in_progress", "ready"].includes(order.status)
      ).length,
      readyOrders: myOrders.filter((order) => order.status === "ready").length,
      totalRevenue: myOrders.reduce(
        (sum, order) => sum + (order.totalAmount || 0),
        0
      ),
    };
  };

  const myStats = getMyTablesStats();

  if (loading) {
    return (
      <div className="min-vh-100 bg-light">
        <Navbar />
        <div className="container-fluid py-4">
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ height: "50vh" }}
          >
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Загрузка...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-light">
      <Navbar />

      <div className="container-fluid py-4">
        {/* Заголовок */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card bg-white shadow-sm">
              <div className="card-body">
                <div className="row align-items-center">
                  <div className="col-md-6">
                    <div className="d-flex align-items-center">
                      <button
                        className="btn btn-outline-secondary me-3"
                        onClick={handleBack}
                        title="Вернуться на панель официанта"
                      >
                        <i className="bi bi-arrow-left"></i>
                      </button>
                      <div>
                        <h1 className="h3 mb-2">
                          <i className="bi bi-grid-3x3-gap me-2"></i>
                          Управление столиками
                          {socketService.getConnectionStatus() && (
                            <span className="badge bg-success ms-2">
                              <i className="bi bi-wifi"></i> Online
                            </span>
                          )}
                        </h1>
                        <p className="text-muted mb-0">
                          Всего столиков: {tables.length} | Занято:{" "}
                          {
                            tables.filter(
                              (t) => getTableStatus(t) === "occupied"
                            ).length
                          }{" "}
                          | Свободно:{" "}
                          {
                            tables.filter((t) => getTableStatus(t) === "free")
                              .length
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 text-end">
                    <button className="btn btn-primary" onClick={loadData}>
                      <i className="bi bi-arrow-clockwise me-2"></i>
                      Обновить
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Уведомления с кухни */}
        {notifications.length > 0 && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-info">
                <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
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
                      <div key={notif.id} className="col-md-6 mb-2">
                        <div
                          className={`alert ${
                            notif.type === "order"
                              ? "alert-success"
                              : "alert-info"
                          } py-2`}
                        >
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
                            {notif.dishName && (
                              <>
                                <br />
                                <span className="text-muted">
                                  <i className="bi bi-egg-fried me-1"></i>
                                  Блюдо: {notif.dishName}
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

        {/* Навигация по вкладкам */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-white p-0">
                <ul className="nav nav-tabs card-header-tabs">
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        activeTab === "all" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("all")}
                    >
                      <i className="bi bi-grid-3x3 me-2"></i>
                      Все столы
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        activeTab === "my" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("my")}
                    >
                      <i className="bi bi-person-check me-2"></i>
                      Мои столы
                      {myStats.totalTables > 0 && (
                        <span className="badge bg-primary ms-1">
                          {myStats.totalTables}
                        </span>
                      )}
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Статистика моих столов (только на вкладке "Мои столы") */}
        {activeTab === "my" && myStats.totalTables > 0 && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-primary">
                <div className="card-header bg-primary text-white">
                  <i className="bi bi-person-check me-2"></i>
                  Моя статистика
                </div>
                <div className="card-body">
                  <div className="row text-center">
                    <div className="col-md-4 mb-4">
                      <div className="border rounded p-3 bg-light">
                        <h4 className="text-primary mb-1">
                          {myStats.totalTables}
                        </h4>
                        <small className="text-muted">Мои столы</small>
                      </div>
                    </div>
                    <div className="col-md-4 mb-4">
                      <div className="border rounded p-3 bg-light">
                        <h4 className="text-warning mb-1">
                          {myStats.activeOrders}
                        </h4>
                        <small className="text-muted">Активные заказы</small>
                      </div>
                    </div>
                    <div className="col-md-4 mb-4">
                      <div className="border rounded p-3 bg-light">
                        <h4 className="text-success mb-1">
                          {myStats.readyOrders}
                        </h4>
                        <small className="text-muted">Готовы к подаче</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Фильтры */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Поиск столиков</label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <i className="bi bi-search"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Название столика..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Статус столика</label>
                    <select
                      className="form-select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">Все статусы</option>
                      <option value="free">Свободен</option>
                      <option value="occupied">Занят</option>
                      <option value="reserved">Забронирован</option>
                      <option value="reserved_soon">Скоро бронь</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Список столиков */}
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-white">
                <h5 className="mb-0">
                  {activeTab === "all" ? "Все столики" : "Мои столики"} (
                  {filteredTables.length})
                </h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  {filteredTables.map((table) => {
                    const status = getTableStatus(table);
                    const tableOrders = getTableOrders(table.id);
                    const currentOrder =
                      tableOrders.length > 0 ? tableOrders[0] : null;
                    const reservationInfo = getTableReservationInfo(table.id);
                    const isMy = isMyTable(table);

                    return (
                      <div
                        key={table.id}
                        className="col-xl-3 col-lg-4 col-md-6"
                      >
                        <div
                          className={`card border-${getStatusColor(
                            status
                          )} h-100`}
                          style={{ cursor: "pointer", transition: "all 0.3s" }}
                          onClick={() => handleTableClick(table)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform =
                              "translateY(-5px)";
                            e.currentTarget.style.boxShadow =
                              "0 8px 25px rgba(0,0,0,0.15)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow =
                              "0 2px 10px rgba(0,0,0,0.1)";
                          }}
                        >
                          <div
                            className={`card-header bg-${getStatusColor(
                              status
                            )} text-white`}
                          >
                            <div className="d-flex justify-content-between align-items-center">
                              <h6 className="mb-0">
                                <i className="bi bi-table me-1"></i>
                                {table.name}
                                {isMy && (
                                  <span className="badge bg-light text-dark ms-1">
                                    <i className="bi bi-person-check"></i>
                                  </span>
                                )}
                              </h6>
                              <span className="badge bg-light text-dark">
                                {table.capacity} чел.
                              </span>
                            </div>
                          </div>
                          <div className="card-body">
                            <div className="text-center mb-3">
                              <div
                                className={`display-6 text-${getStatusColor(
                                  status
                                )}`}
                              >
                                <i
                                  className={`
                                    bi 
                                    ${
                                      status === "occupied"
                                        ? "bi-person-check-fill"
                                        : status === "reserved"
                                        ? "bi-clock-fill"
                                        : status === "reserved_soon"
                                        ? "bi-clock-history"
                                        : "bi-person-plus"
                                    }
                                  `}
                                ></i>
                              </div>
                              <h5 className={`text-${getStatusColor(status)}`}>
                                {getStatusText(status)}
                              </h5>
                            </div>

                            {/* Информация о бронировании */}
                            {reservationInfo && (
                              <div className="mb-2 p-2 bg-light rounded">
                                <div className="small text-muted">
                                  <i className="bi bi-calendar-event me-1"></i>
                                  {reservationInfo.text}
                                </div>
                                {reservationInfo.reservation && (
                                  <div className="small">
                                    <strong>Клиент:</strong>{" "}
                                    {reservationInfo.reservation.customerName}
                                  </div>
                                )}
                              </div>
                            )}

                            {currentOrder && (
                              <div className="mb-3 p-2 bg-light rounded">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <small className="text-muted">Заказ:</small>
                                  <span
                                    className={`badge bg-${getOrderStatusColor(
                                      currentOrder.status
                                    )}`}
                                  >
                                    {getOrderStatusText(currentOrder.status)}
                                  </span>
                                </div>
                                <div className="small">
                                  <strong>Сумма:</strong>{" "}
                                  {calculateOrderTotal(
                                    currentOrder.items || []
                                  )}{" "}
                                </div>
                                <div className="small">
                                  <strong>Блюд:</strong>{" "}
                                  {currentOrder.items?.length || 0}
                                </div>
                                {isMy && (
                                  <div className="small text-success">
                                    <i className="bi bi-person-check me-1"></i>
                                    Ваш заказ
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="card-footer bg-transparent text-center">
                            <small className="text-muted">
                              <i className="bi bi-arrow-right me-1"></i>
                              Нажмите для управления
                            </small>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredTables.length === 0 && (
                  <div className="text-center py-5">
                    <i className="bi bi-table display-1 text-muted"></i>
                    <h5 className="mt-3 text-muted">
                      {activeTab === "all"
                        ? "Столики не найдены"
                        : "У вас нет активных столов"}
                    </h5>
                    <p className="text-muted">
                      {activeTab === "all"
                        ? "Попробуйте изменить параметры фильтрации"
                        : "Начните принимать заказы, чтобы увидеть свои столы здесь"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaiterTables;
