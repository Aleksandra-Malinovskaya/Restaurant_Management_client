import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../NavBar";
import { $authHost } from "../../../http";
import { toast } from "react-toastify";
import socketService from "../../../services/socket";
import {
  formatLocalDateTime,
  localToUTC,
  formatForDateTimeLocal,
} from "../../../utils/dateUtils";

const WaiterReservations = () => {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [notifications, setNotifications] = useState([]);

  // Refs для отслеживания состояния без триггеров рендеринга
  const notificationTimeoutRef = useRef(null);
  const processedNotificationsRef = useRef(new Set());

  const [filters, setFilters] = useState({
    date: new Date().toISOString().split("T")[0],
    status: "all",
  });

  const [reservationForm, setReservationForm] = useState({
    tableId: "",
    customerName: "",
    customerPhone: "",
    guestCount: 2,
    reservedFrom: "",
    reservedTo: "",
    status: "confirmed",
  });

  // Функция для добавления уведомления с защитой от дубликатов
  const addNotification = (data, type = "dish") => {
    const notificationId =
      type === "dish"
        ? `dish-${data.orderId}-${data.dishName}`
        : `order-${data.orderId}`;

    // Проверяем, не обрабатывали ли мы уже это уведомление
    if (processedNotificationsRef.current.has(notificationId)) {
      console.log(
        `🔄 WaiterReservations: Пропускаем дублирующее уведомление ${notificationId}`
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
  };

  // WebSocket уведомления
  useEffect(() => {
    console.log("WaiterReservations: Инициализация WebSocket");

    const orderNotificationHandler = (data) => {
      console.log("🛎️ WaiterReservations: Уведомление о готовом заказе:", data);
      addNotification(data, "order");
    };

    const dishNotificationHandler = (data) => {
      console.log("🍽️ WaiterReservations: Уведомление о готовом блюде:", data);
      addNotification(data, "dish");
    };

    try {
      // Подписываемся на уведомления
      socketService.subscribeToWaiterOrderNotifications(
        orderNotificationHandler
      );
      socketService.subscribeToWaiterDishNotifications(dishNotificationHandler);

      return () => {
        console.log("🧹 WaiterReservations: Очистка WebSocket подписок");
        // Отписываемся от всех уведомлений при размонтировании
        socketService.unsubscribeAll();

        // Очищаем таймеры
        if (notificationTimeoutRef.current) {
          clearTimeout(notificationTimeoutRef.current);
        }
      };
    } catch (error) {
      console.error(
        "❌ WaiterReservations: Ошибка инициализации WebSocket:",
        error
      );
    }
  }, []);

  // Исправленный useEffect без ESLint warning
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Загружаем бронирования
        const reservationsResponse = await $authHost.get(
          `/reservations?date=${filters.date}`
        );
        let filteredReservations = reservationsResponse.data;

        if (filters.status !== "all") {
          filteredReservations = filteredReservations.filter(
            (reservation) => reservation.status === filters.status
          );
        }

        setReservations(filteredReservations);

        // Загружаем столики
        const tablesResponse = await $authHost.get("/tables");
        setTables(tablesResponse.data);
      } catch (error) {
        console.error("Ошибка загрузки данных:", error);
        setError("Не удалось загрузить данные");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [filters.date, filters.status]);

  const handleBack = () => {
    navigate("/waiter");
  };

  const clearNotifications = () => {
    setNotifications([]);
    processedNotificationsRef.current.clear();
  };

  const handleCreateReservation = () => {
    setEditingReservation(null);
    const now = new Date();

    const from = new Date(now.getTime() + 30 * 60000);
    const to = new Date(from.getTime() + 2 * 60 * 60000);

    console.log("Создание брони (WaiterReservations):", {
      now: now.toLocaleString("ru-RU"),
      from: from.toLocaleString("ru-RU"),
      to: to.toLocaleString("ru-RU"),
    });

    setReservationForm({
      tableId: "",
      customerName: "",
      customerPhone: "",
      guestCount: 2,
      reservedFrom: formatForDateTimeLocal(from),
      reservedTo: formatForDateTimeLocal(to),
      status: "confirmed",
    });
    setShowModal(true);
  };

  // Остальные функции остаются без изменений...
  const handleEditReservation = (reservation) => {
    setEditingReservation(reservation);

    // Прямое использование времени из базы данных
    const reservedFrom = new Date(reservation.reservedFrom);
    const reservedTo = new Date(reservation.reservedTo);

    console.log("Редактирование брони:", {
      fromDB: reservation.reservedFrom,
      toDB: reservation.reservedTo,
      fromLocal: reservedFrom.toLocaleString("ru-RU"),
      toLocal: reservedTo.toLocaleString("ru-RU"),
    });

    setReservationForm({
      tableId: reservation.tableId.toString(),
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      guestCount: reservation.guestCount,
      reservedFrom: formatForDateTimeLocal(reservedFrom),
      reservedTo: formatForDateTimeLocal(reservedTo),
      status: reservation.status,
    });
    setShowModal(true);
  };

  const handleReservationSubmit = async (e) => {
    e.preventDefault();
    try {
      const reservationData = {
        tableId: parseInt(reservationForm.tableId),
        customerName: reservationForm.customerName,
        customerPhone: reservationForm.customerPhone,
        guestCount: reservationForm.guestCount,
        reservedFrom: localToUTC(reservationForm.reservedFrom),
        reservedTo: localToUTC(reservationForm.reservedTo),
        status: reservationForm.status,
      };

      if (editingReservation) {
        await $authHost.put(
          `/reservations/${editingReservation.id}`,
          reservationData
        );
        setSuccess("Бронирование успешно обновлено");
      } else {
        await $authHost.post("/reservations", reservationData);
        setSuccess("Бронирование успешно создано");
      }

      setShowModal(false);

      // Перезагружаем данные
      const reservationsResponse = await $authHost.get(
        `/reservations?date=${filters.date}`
      );
      let filteredReservations = reservationsResponse.data;

      if (filters.status !== "all") {
        filteredReservations = filteredReservations.filter(
          (reservation) => reservation.status === filters.status
        );
      }

      setReservations(filteredReservations);
    } catch (error) {
      console.error("Ошибка сохранения бронирования:", error);
      setError(
        error.response?.data?.message || "Не удалось сохранить бронирование"
      );
    }
  };

  const handleChangeStatus = async (reservationId, newStatus) => {
    try {
      await $authHost.put(`/reservations/${reservationId}/status`, {
        status: newStatus,
      });
      setSuccess("Статус бронирования изменен");

      // Обновляем данные
      const reservationsResponse = await $authHost.get(
        `/reservations?date=${filters.date}`
      );
      let filteredReservations = reservationsResponse.data;

      if (filters.status !== "all") {
        filteredReservations = filteredReservations.filter(
          (reservation) => reservation.status === filters.status
        );
      }

      setReservations(filteredReservations);
    } catch (error) {
      console.error("Ошибка изменения статуса:", error);
      setError("Не удалось изменить статус бронирования");
    }
  };

  const handleDeleteReservation = async (reservation) => {
    if (
      !window.confirm(`Удалить бронирование для ${reservation.customerName}?`)
    ) {
      return;
    }

    try {
      await $authHost.delete(`/reservations/${reservation.id}`);
      setSuccess("Бронирование удалено");

      // Обновляем данные
      const reservationsResponse = await $authHost.get(
        `/reservations?date=${filters.date}`
      );
      let filteredReservations = reservationsResponse.data;

      if (filters.status !== "all") {
        filteredReservations = filteredReservations.filter(
          (reservation) => reservation.status === filters.status
        );
      }

      setReservations(filteredReservations);
    } catch (error) {
      console.error("Ошибка удаления бронирования:", error);
      setError("Не удалось удалить бронирование");
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      confirmed: "Подтверждено",
      seated: "Гости за столом",
      cancelled: "Отменено",
      completed: "Завершено",
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      confirmed: "warning",
      seated: "success",
      cancelled: "danger",
      completed: "secondary",
    };
    return colorMap[status] || "light";
  };

  const getTableName = (tableId) => {
    const table = tables.find((t) => t.id === tableId);
    return table ? table.name : `Столик #${tableId}`;
  };

  const getTableCapacity = (tableId) => {
    const table = tables.find((t) => t.id === tableId);
    return table ? table.capacity : 0;
  };

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
                          <i className="bi bi-calendar-event me-2"></i>
                          Управление бронированиями
                          {socketService.getConnectionStatus() && (
                            <span className="badge bg-success ms-2">
                              <i className="bi bi-wifi"></i> Online
                            </span>
                          )}
                        </h1>
                        <p className="text-muted mb-0">
                          Всего бронирований: {reservations.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 text-end">
                    <button
                      className="btn btn-primary"
                      onClick={handleCreateReservation}
                    >
                      <i className="bi bi-calendar-plus me-1"></i>
                      Добавить бронирование
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="row mb-3">
            <div className="col-12">
              <div className="alert alert-danger">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setError("")}
                ></button>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="row mb-3">
            <div className="col-12">
              <div className="alert alert-success">
                <i className="bi bi-check-circle me-2"></i>
                {success}
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSuccess("")}
                ></button>
              </div>
            </div>
          </div>
        )}

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

        {/* Фильтры */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Дата</label>
                    <input
                      type="date"
                      className="form-control"
                      value={filters.date}
                      onChange={(e) =>
                        setFilters({ ...filters, date: e.target.value })
                      }
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Статус</label>
                    <select
                      className="form-select"
                      value={filters.status}
                      onChange={(e) =>
                        setFilters({ ...filters, status: e.target.value })
                      }
                    >
                      <option value="all">Все статусы</option>
                      <option value="confirmed">Подтверждено</option>
                      <option value="seated">Гости за столом</option>
                      <option value="completed">Завершено</option>
                    </select>
                  </div>
                  <div className="col-md-4 d-flex align-items-end">
                    <button
                      className="btn btn-outline-secondary w-100"
                      onClick={() => {
                        const loadData = async () => {
                          try {
                            setLoading(true);
                            const reservationsResponse = await $authHost.get(
                              `/reservations?date=${filters.date}`
                            );
                            let filteredReservations =
                              reservationsResponse.data;

                            if (filters.status !== "all") {
                              filteredReservations =
                                filteredReservations.filter(
                                  (reservation) =>
                                    reservation.status === filters.status
                                );
                            }

                            setReservations(filteredReservations);
                          } catch (error) {
                            console.error("Ошибка загрузки данных:", error);
                            setError("Не удалось загрузить данные");
                          } finally {
                            setLoading(false);
                          }
                        };
                        loadData();
                      }}
                    >
                      <i className="bi bi-arrow-clockwise me-1"></i>
                      Обновить
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="row mb-4">
          <div className="col-md-3">
            <div className="card bg-warning text-white">
              <div className="card-body text-center">
                <h4 className="mb-0">
                  {reservations.filter((r) => r.status === "confirmed").length}
                </h4>
                <small>Подтверждено</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-success text-white">
              <div className="card-body text-center">
                <h4 className="mb-0">
                  {reservations.filter((r) => r.status === "seated").length}
                </h4>
                <small>Гости за столом</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-info text-white">
              <div className="card-body text-center">
                <h4 className="mb-0">
                  {reservations.filter((r) => r.status === "completed").length}
                </h4>
                <small>Завершено</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-secondary text-white">
              <div className="card-body text-center">
                <h4 className="mb-0">{reservations.length}</h4>
                <small>Всего</small>
              </div>
            </div>
          </div>
        </div>

        {/* Список бронирований */}
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-white">
                <h5 className="mb-0">
                  Бронирования на{" "}
                  {new Date(filters.date).toLocaleDateString("ru-RU")}
                </h5>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Столик</th>
                        <th>Клиент</th>
                        <th>Телефон</th>
                        <th>Время</th>
                        <th>Гости</th>
                        <th>Статус</th>
                        <th width="150">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map((reservation) => (
                        <tr key={reservation.id}>
                          <td>
                            <div>
                              <strong>
                                {getTableName(reservation.tableId)}
                              </strong>
                              <div className="small text-muted">
                                Вместимость:{" "}
                                {getTableCapacity(reservation.tableId)} чел.
                              </div>
                            </div>
                          </td>
                          <td>
                            <strong>{reservation.customerName}</strong>
                          </td>
                          <td>{reservation.customerPhone}</td>
                          <td>
                            <div className="small">
                              <div>
                                <strong>Начало:</strong>{" "}
                                {formatLocalDateTime(reservation.reservedFrom)}
                              </div>
                              <div>
                                <strong>Конец:</strong>{" "}
                                {formatLocalDateTime(reservation.reservedTo)}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge bg-secondary">
                              {reservation.guestCount} чел.
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge bg-${getStatusColor(
                                reservation.status
                              )}`}
                            >
                              {getStatusText(reservation.status)}
                            </span>
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-outline-primary"
                                onClick={() =>
                                  handleEditReservation(reservation)
                                }
                                title="Редактировать"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              {reservation.status === "confirmed" && (
                                <button
                                  className="btn btn-outline-success"
                                  onClick={() =>
                                    handleChangeStatus(reservation.id, "seated")
                                  }
                                  title="Отметить как 'Гости за столом'"
                                >
                                  <i className="bi bi-person-check"></i>
                                </button>
                              )}
                              {reservation.status === "seated" && (
                                <button
                                  className="btn btn-outline-secondary"
                                  onClick={() =>
                                    handleChangeStatus(
                                      reservation.id,
                                      "completed"
                                    )
                                  }
                                  title="Завершить бронирование"
                                >
                                  <i className="bi bi-check-circle"></i>
                                </button>
                              )}
                              <button
                                className="btn btn-outline-danger"
                                onClick={() =>
                                  handleDeleteReservation(reservation)
                                }
                                title="Удалить"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {reservations.length === 0 && (
                  <div className="text-center py-5">
                    <i className="bi bi-calendar-x display-1 text-muted"></i>
                    <h5 className="mt-3 text-muted">Бронирования не найдены</h5>
                    <p className="text-muted">
                      {filters.status !== "all"
                        ? `Нет бронирований со статусом "${getStatusText(
                            filters.status
                          )}" на выбранную дату`
                        : "Нет бронирований на выбранную дату"}
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={handleCreateReservation}
                    >
                      <i className="bi bi-calendar-plus me-1"></i>
                      Создать первое бронирование
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно бронирования */}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {editingReservation
                    ? "Редактирование бронирования"
                    : "Новое бронирование"}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                ></button>
              </div>
              <form onSubmit={handleReservationSubmit}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label">Столик *</label>
                      <select
                        className="form-select"
                        value={reservationForm.tableId}
                        onChange={(e) => {
                          const tableId = e.target.value;
                          setReservationForm({ ...reservationForm, tableId });
                          if (tableId) {
                            const table = tables.find(
                              (t) => t.id === parseInt(tableId)
                            );
                            if (table) {
                              setReservationForm((prev) => ({
                                ...prev,
                                guestCount: Math.min(
                                  prev.guestCount,
                                  table.capacity
                                ),
                              }));
                            }
                          }
                        }}
                        required
                      >
                        <option value="">Выберите столик</option>
                        {tables.map((table) => (
                          <option key={table.id} value={table.id}>
                            {table.name} (вместимость: {table.capacity} чел.)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Имя клиента *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={reservationForm.customerName}
                        onChange={(e) =>
                          setReservationForm({
                            ...reservationForm,
                            customerName: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Телефон *</label>
                      <input
                        type="tel"
                        className="form-control"
                        value={reservationForm.customerPhone}
                        onChange={(e) =>
                          setReservationForm({
                            ...reservationForm,
                            customerPhone: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Количество гостей *</label>
                      <select
                        className="form-select"
                        value={reservationForm.guestCount}
                        onChange={(e) =>
                          setReservationForm({
                            ...reservationForm,
                            guestCount: parseInt(e.target.value),
                          })
                        }
                        required
                      >
                        {reservationForm.tableId ? (
                          Array.from(
                            {
                              length: getTableCapacity(
                                parseInt(reservationForm.tableId)
                              ),
                            },
                            (_, i) => i + 1
                          ).map((num) => (
                            <option key={num} value={num}>
                              {num} человек
                            </option>
                          ))
                        ) : (
                          <option value="2">2 человека</option>
                        )}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Статус</label>
                      <select
                        className="form-select"
                        value={reservationForm.status}
                        onChange={(e) =>
                          setReservationForm({
                            ...reservationForm,
                            status: e.target.value,
                          })
                        }
                      >
                        <option value="confirmed">Подтверждено</option>
                        <option value="seated">Гости за столом</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Начало *</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={reservationForm.reservedFrom}
                        onChange={(e) =>
                          setReservationForm({
                            ...reservationForm,
                            reservedFrom: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Конец *</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={reservationForm.reservedTo}
                        onChange={(e) =>
                          setReservationForm({
                            ...reservationForm,
                            reservedTo: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Отмена
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingReservation ? "Обновить" : "Создать"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaiterReservations;
