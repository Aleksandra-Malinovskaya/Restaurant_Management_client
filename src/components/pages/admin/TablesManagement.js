import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../../NavBar";
import { useNavigate } from "react-router-dom";
import { $authHost } from "../../../http";

const TablesManagement = () => {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [waiters, setWaiters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTableModal, setShowTableModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [editingReservation, setEditingReservation] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [view, setView] = useState("grid");
  const [currentDate, setCurrentDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const [tableForm, setTableForm] = useState({
    name: "",
    capacity: 2,
  });

  const [reservationForm, setReservationForm] = useState({
    customerName: "",
    customerPhone: "",
    guestCount: 2,
    reservedFrom: "",
    reservedTo: "",
    status: "confirmed",
  });

  // Функция для преобразования времени с учетом часового пояса
  const toLocalISOString = (date) => {
    const localDate = new Date(date);
    const timezoneOffset = localDate.getTimezoneOffset() * 60000;
    return new Date(localDate.getTime() - timezoneOffset)
      .toISOString()
      .slice(0, 16);
  };

  // Функция для преобразования времени из UTC в локальное
  const fromUTCToLocal = (utcDate) => {
    if (!utcDate) return null;
    const date = new Date(utcDate);
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() + timezoneOffset);
  };

  // Функция для преобразования времени из локального в UTC
  const fromLocalToUTC = (localDate) => {
    if (!localDate) return null;
    const date = new Date(localDate);
    const timezoneOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - timezoneOffset);
  };

  const safeArray = (data) => {
    if (!data) return [];
    return Array.isArray(data) ? data : [];
  };

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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [
        tablesResponse,
        ordersResponse,
        reservationsResponse,
        usersResponse,
      ] = await Promise.all([
        $authHost.get("/tables").catch((err) => {
          console.error("Ошибка загрузки столиков:", err);
          return { data: [] };
        }),
        $authHost.get("/orders?status=open,in_progress,ready").catch((err) => {
          console.error("Ошибка загрузки заказов:", err);
          return { data: [] };
        }),
        $authHost.get(`/reservations?date=${currentDate}`).catch((err) => {
          console.error("Ошибка загрузки бронирований:", err);
          return { data: [] };
        }),
        $authHost.get("/users?role=waiter").catch((err) => {
          console.error("Ошибка загрузки официантов:", err);
          return { data: [] };
        }),
      ]);

      console.log("Загруженные заказы:", extractData(ordersResponse.data));
      console.log(
        "Загруженные бронирования:",
        extractData(reservationsResponse.data)
      );

      setTables(safeArray(extractData(tablesResponse.data)));
      setOrders(safeArray(extractData(ordersResponse.data)));
      setReservations(safeArray(extractData(reservationsResponse.data)));
      setWaiters(safeArray(extractData(usersResponse.data)));
    } catch (error) {
      console.error("Общая ошибка загрузки:", error);
      setError("Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBack = () => {
    navigate("/admin");
  };

  // Столики
  const handleAddTable = () => {
    setEditingTable(null);
    setTableForm({ name: "", capacity: 2 });
    setShowTableModal(true);
  };

  const handleEditTable = (table) => {
    setEditingTable(table);
    setTableForm({ name: table.name, capacity: table.capacity });
    setShowTableModal(true);
  };

  const handleDeleteTable = async (table) => {
    // Проверяем активные заказы
    const activeOrders = orders.filter(
      (order) =>
        order.tableId === table.id &&
        ["open", "in_progress", "ready"].includes(order.status)
    );

    // Проверяем будущие бронирования
    const now = new Date();
    const futureReservations = reservations.filter(
      (reservation) =>
        reservation.tableId === table.id &&
        fromUTCToLocal(reservation.reservedFrom) > now &&
        ["confirmed"].includes(reservation.status)
    );

    if (activeOrders.length > 0 || futureReservations.length > 0) {
      let message = `Нельзя удалить столик "${table.name}".`;
      if (activeOrders.length > 0) {
        message += ` Есть активные заказы: ${activeOrders.length}.`;
      }
      if (futureReservations.length > 0) {
        message += ` Есть будущие бронирования: ${futureReservations.length}.`;
      }
      setError(message);
      return;
    }

    if (
      !window.confirm(`Вы уверены, что хотите удалить столик "${table.name}"?`)
    ) {
      return;
    }

    try {
      await $authHost.delete(`/tables/${table.id}`);
      await loadData();
    } catch (error) {
      console.error("Ошибка удаления столика:", error);
      setError("Не удалось удалить столик");
    }
  };

  const handleTableSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTable) {
        await $authHost.put(`/tables/${editingTable.id}`, tableForm);
      } else {
        await $authHost.post("/tables", tableForm);
      }
      setShowTableModal(false);
      await loadData();
    } catch (error) {
      console.error("Ошибка сохранения столика:", error);
      setError(`Не удалось ${editingTable ? "обновить" : "добавить"} столик`);
    }
  };

  // Бронирования
  const handleAddReservation = (table) => {
    setSelectedTable(table);
    setEditingReservation(null);
    const now = new Date();
    const from = new Date(now.getTime() + 30 * 60000); // +30 минут
    const to = new Date(from.getTime() + 2 * 60 * 60000); // +2 часа

    setReservationForm({
      customerName: "",
      customerPhone: "",
      guestCount: Math.min(table.capacity, 2),
      reservedFrom: toLocalISOString(from),
      reservedTo: toLocalISOString(to),
      status: "confirmed",
    });
    setShowReservationModal(true);
  };

  const handleEditReservation = (reservation) => {
    setEditingReservation(reservation);
    setSelectedTable(tables.find((t) => t.id === reservation.tableId));
    setReservationForm({
      customerName: reservation.customerName,
      customerPhone: reservation.customerPhone,
      guestCount: reservation.guestCount,
      reservedFrom: toLocalISOString(reservation.reservedFrom),
      reservedTo: toLocalISOString(reservation.reservedTo),
      status: reservation.status,
    });
    setShowReservationModal(true);
  };

  const handleDeleteReservation = async (reservation) => {
    if (
      !window.confirm(`Удалить бронирование для ${reservation.customerName}?`)
    ) {
      return;
    }

    try {
      await $authHost.delete(`/reservations/${reservation.id}`);
      await loadData();
    } catch (error) {
      console.error("Ошибка удаления бронирования:", error);
      setError("Не удалось удалить бронирование");
    }
  };

  const handleReservationSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...reservationForm,
        tableId: selectedTable.id,
        reservedFrom: fromLocalToUTC(
          reservationForm.reservedFrom
        ).toISOString(),
        reservedTo: fromLocalToUTC(reservationForm.reservedTo).toISOString(),
      };

      console.log("Отправка бронирования:", submitData);

      if (editingReservation) {
        await $authHost.put(
          `/reservations/${editingReservation.id}`,
          submitData
        );
      } else {
        await $authHost.post("/reservations", submitData);
      }
      setShowReservationModal(false);
      await loadData();
    } catch (error) {
      console.error("Ошибка сохранения бронирования:", error);
      setError(
        `Не удалось ${
          editingReservation ? "обновить" : "добавить"
        } бронирование: ${error.response?.data?.message || error.message}`
      );
    }
  };

  // Вспомогательные функции
  const getTableOrders = (tableId) => {
    return orders.filter(
      (order) =>
        order.tableId === tableId &&
        ["open", "in_progress", "ready"].includes(order.status)
    );
  };

  const getTableReservations = (tableId) => {
    return reservations.filter(
      (reservation) => reservation.tableId === tableId
    );
  };

  const getCurrentReservation = (tableId) => {
    const now = new Date();
    return reservations.find(
      (reservation) =>
        reservation.tableId === tableId &&
        fromUTCToLocal(reservation.reservedFrom) <= now &&
        fromUTCToLocal(reservation.reservedTo) >= now &&
        ["confirmed", "seated"].includes(reservation.status)
    );
  };

  const getTableStatus = (table) => {
    const tableOrders = getTableOrders(table.id);
    const currentReservation = getCurrentReservation(table.id);

    console.log(`Столик ${table.name}:`, {
      orders: tableOrders.length,
      currentReservation: currentReservation
        ? currentReservation.customerName
        : "нет",
      status:
        tableOrders.length > 0
          ? "occupied"
          : currentReservation
          ? "reserved"
          : "free",
    });

    if (tableOrders.length > 0) return "occupied";
    if (currentReservation) return "reserved";
    return "free";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "occupied":
        return "danger";
      case "reserved":
        return "warning";
      case "free":
        return "success";
      default:
        return "secondary";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "occupied":
        return "Занят";
      case "reserved":
        return "Забронирован";
      case "free":
        return "Свободен";
      default:
        return "Неизвестно";
    }
  };

  const formatTime = (utcDate) => {
    if (!utcDate) return "";
    const localDate = fromUTCToLocal(utcDate);
    return localDate.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateTime = (utcDate) => {
    if (!utcDate) return "";
    const localDate = fromUTCToLocal(utcDate);
    return localDate.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
                        title="Вернуться на панель админа"
                      >
                        <i className="bi bi-arrow-left"></i>
                      </button>
                      <div>
                        <h1 className="h3 mb-2">
                          <i className="bi bi-table me-2"></i>
                          Управление столиками
                        </h1>
                        <p className="text-muted mb-0">
                          Всего столиков: {tables.length} | Занято:{" "}
                          {
                            tables.filter(
                              (t) => getTableStatus(t) === "occupied"
                            ).length
                          }{" "}
                          | Забронировано:{" "}
                          {
                            tables.filter(
                              (t) => getTableStatus(t) === "reserved"
                            ).length
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 text-end">
                    <div className="btn-group me-2">
                      <button
                        className={`btn btn-outline-primary ${
                          view === "grid" ? "active" : ""
                        }`}
                        onClick={() => setView("grid")}
                      >
                        <i className="bi bi-grid-3x3-gap me-1"></i>
                        Сетка
                      </button>
                      <button
                        className={`btn btn-outline-primary ${
                          view === "list" ? "active" : ""
                        }`}
                        onClick={() => setView("list")}
                      >
                        <i className="bi bi-list me-1"></i>
                        Список
                      </button>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={handleAddTable}
                    >
                      <i className="bi bi-plus-circle me-1"></i>
                      Добавить столик
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="alert alert-danger alert-dismissible fade show">
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

        {/* Фильтр по дате */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-body py-2">
                <div className="row align-items-center">
                  <div className="col-md-4">
                    <label className="form-label">Дата для бронирований:</label>
                    <input
                      type="date"
                      className="form-control"
                      value={currentDate}
                      onChange={(e) => setCurrentDate(e.target.value)}
                    />
                  </div>
                  <div className="col-md-8">
                    <div className="d-flex gap-2 mt-3">
                      <span className="badge bg-success">Свободен</span>
                      <span className="badge bg-warning">Забронирован</span>
                      <span className="badge bg-danger">Занят</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Отладочная информация */}
        <div className="row mb-3">
          <div className="col-12">
            <div className="card border-info">
              <div className="card-header bg-info text-white py-2">
                <small>
                  <i className="bi bi-info-circle me-1"></i>Отладочная
                  информация
                </small>
              </div>
              <div className="card-body py-2">
                <div className="row small text-muted">
                  <div className="col-md-4">
                    Активных заказов: {orders.length}
                  </div>
                  <div className="col-md-4">
                    Бронирований сегодня: {reservations.length}
                  </div>
                  <div className="col-md-4">
                    Текущее время: {new Date().toLocaleString("ru-RU")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Сетка столиков */}
        {view === "grid" && (
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header bg-white">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-grid-3x3-gap me-2"></i>
                    Схема зала
                  </h5>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    {tables.map((table) => {
                      const status = getTableStatus(table);
                      const tableOrders = getTableOrders(table.id);
                      const tableReservations = getTableReservations(table.id);
                      const currentReservation = getCurrentReservation(
                        table.id
                      );

                      return (
                        <div
                          key={table.id}
                          className="col-xl-3 col-lg-4 col-md-6"
                        >
                          <div
                            className={`card border-${getStatusColor(
                              status
                            )} h-100`}
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
                                    className={`bi ${
                                      status === "occupied"
                                        ? "bi-person-check-fill"
                                        : status === "reserved"
                                        ? "bi-clock-fill"
                                        : "bi-person-plus"
                                    }`}
                                  ></i>
                                </div>
                                <h5
                                  className={`text-${getStatusColor(status)}`}
                                >
                                  {getStatusText(status)}
                                </h5>
                              </div>

                              {/* Активные заказы */}
                              {tableOrders.length > 0 && (
                                <div className="mb-2">
                                  <small className="text-muted">
                                    Активные заказы:
                                  </small>
                                  {tableOrders.map((order) => (
                                    <div key={order.id} className="small">
                                      <strong>Заказ #{order.id}</strong>
                                      {order.waiter && (
                                        <span className="text-muted">
                                          {" "}
                                          - {order.waiter.firstName}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Текущее бронирование */}
                              {currentReservation && (
                                <div className="mb-2">
                                  <small className="text-muted">
                                    Текущее бронирование:
                                  </small>
                                  <div className="small">
                                    <strong>
                                      {currentReservation.customerName}
                                    </strong>
                                    <div>
                                      {currentReservation.customerPhone}
                                    </div>
                                    <div>
                                      {formatTime(
                                        currentReservation.reservedFrom
                                      )}{" "}
                                      -
                                      {formatTime(
                                        currentReservation.reservedTo
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Будущие бронирования */}
                              {tableReservations.filter(
                                (r) =>
                                  fromUTCToLocal(r.reservedFrom) > new Date()
                              ).length > 0 && (
                                <div>
                                  <small className="text-muted">
                                    Будущие:{" "}
                                    {
                                      tableReservations.filter(
                                        (r) =>
                                          fromUTCToLocal(r.reservedFrom) >
                                          new Date()
                                      ).length
                                    }
                                  </small>
                                </div>
                              )}
                            </div>
                            <div className="card-footer bg-transparent">
                              <div className="btn-group w-100">
                                <button
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() => handleEditTable(table)}
                                  title="Редактировать столик"
                                >
                                  <i className="bi bi-pencil"></i>
                                </button>
                                <button
                                  className="btn btn-outline-success btn-sm"
                                  onClick={() => handleAddReservation(table)}
                                  title="Добавить бронирование"
                                >
                                  <i className="bi bi-calendar-plus"></i>
                                </button>
                                <button
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => handleDeleteTable(table)}
                                  title="Удалить столик"
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Табличный вид */}
        {view === "list" && (
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header bg-white">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-list me-2"></i>
                    Список столиков
                  </h5>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead className="table-light">
                        <tr>
                          <th>Столик</th>
                          <th>Вместимость</th>
                          <th>Статус</th>
                          <th>Активные заказы</th>
                          <th>Текущее бронирование</th>
                          <th>Будущие бронирования</th>
                          <th width="120">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tables.map((table) => {
                          const status = getTableStatus(table);
                          const tableOrders = getTableOrders(table.id);
                          const tableReservations = getTableReservations(
                            table.id
                          );
                          const currentReservation = getCurrentReservation(
                            table.id
                          );
                          const futureReservations = tableReservations.filter(
                            (r) => fromUTCToLocal(r.reservedFrom) > new Date()
                          );

                          return (
                            <tr key={table.id}>
                              <td>
                                <strong>{table.name}</strong>
                              </td>
                              <td>
                                <span className="badge bg-secondary">
                                  {table.capacity} чел.
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`badge bg-${getStatusColor(
                                    status
                                  )}`}
                                >
                                  {getStatusText(status)}
                                </span>
                              </td>
                              <td>
                                {tableOrders.length > 0 ? (
                                  tableOrders.map((order) => (
                                    <div key={order.id} className="small">
                                      <div>
                                        #{order.id} ({order.waiter?.firstName})
                                      </div>
                                      <small className="text-muted">
                                        {order.status}
                                      </small>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-muted">Нет</span>
                                )}
                              </td>
                              <td>
                                {currentReservation ? (
                                  <div className="small">
                                    <div>
                                      <strong>
                                        {currentReservation.customerName}
                                      </strong>
                                    </div>
                                    <div>
                                      {currentReservation.customerPhone}
                                    </div>
                                    <div className="text-muted">
                                      {formatTime(
                                        currentReservation.reservedFrom
                                      )}{" "}
                                      -
                                      {formatTime(
                                        currentReservation.reservedTo
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted">Нет</span>
                                )}
                              </td>
                              <td>
                                {futureReservations.length > 0 ? (
                                  <div>
                                    <span className="badge bg-info">
                                      {futureReservations.length}
                                    </span>
                                    <div className="small text-muted">
                                      {futureReservations
                                        .slice(0, 2)
                                        .map((r) => (
                                          <div key={r.id}>
                                            {r.customerName} (
                                            {formatTime(r.reservedFrom)})
                                          </div>
                                        ))}
                                      {futureReservations.length > 2 && "..."}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-muted">Нет</span>
                                )}
                              </td>
                              <td>
                                <div className="btn-group">
                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={() => handleEditTable(table)}
                                    title="Редактировать"
                                  >
                                    <i className="bi bi-pencil"></i>
                                  </button>
                                  <button
                                    className="btn btn-outline-success btn-sm"
                                    onClick={() => handleAddReservation(table)}
                                    title="Добавить бронирование"
                                  >
                                    <i className="bi bi-calendar-plus"></i>
                                  </button>
                                  <button
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => handleDeleteTable(table)}
                                    title="Удалить"
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Список всех бронирований */}
        <div className="row mt-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-white">
                <h5 className="card-title mb-0">
                  <i className="bi bi-calendar-event me-2"></i>
                  Все бронирования на{" "}
                  {new Date(currentDate).toLocaleDateString("ru-RU")}
                </h5>
              </div>
              <div className="card-body">
                {reservations.length === 0 ? (
                  <div className="text-center py-3 text-muted">
                    Нет бронирований на выбранную дату
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead className="table-light">
                        <tr>
                          <th>Столик</th>
                          <th>Клиент</th>
                          <th>Телефон</th>
                          <th>Гости</th>
                          <th>Время</th>
                          <th>Статус</th>
                          <th width="100">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reservations.map((reservation) => (
                          <tr key={reservation.id}>
                            <td>
                              <strong>{reservation.table?.name}</strong>
                            </td>
                            <td>{reservation.customerName}</td>
                            <td>{reservation.customerPhone}</td>
                            <td>
                              <span className="badge bg-secondary">
                                {reservation.guestCount} чел.
                              </span>
                            </td>
                            <td>
                              <div className="small">
                                {formatDateTime(reservation.reservedFrom)} -
                                <br />
                                {formatDateTime(reservation.reservedTo)}
                              </div>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  reservation.status === "confirmed"
                                    ? "bg-warning"
                                    : reservation.status === "seated"
                                    ? "bg-success"
                                    : "bg-secondary"
                                }`}
                              >
                                {reservation.status === "confirmed"
                                  ? "Подтверждено"
                                  : reservation.status === "seated"
                                  ? "Заселено"
                                  : reservation.status}
                              </span>
                            </td>
                            <td>
                              <div className="btn-group">
                                <button
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() =>
                                    handleEditReservation(reservation)
                                  }
                                  title="Редактировать"
                                >
                                  <i className="bi bi-pencil"></i>
                                </button>
                                <button
                                  className="btn btn-outline-danger btn-sm"
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
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Модальное окно столика */}
        {showTableModal && (
          <div
            className="modal show d-block"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {editingTable
                      ? "Редактирование столика"
                      : "Добавление столика"}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowTableModal(false)}
                  ></button>
                </div>
                <form onSubmit={handleTableSubmit}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-12">
                        <label className="form-label">Название столика *</label>
                        <input
                          type="text"
                          className="form-control"
                          name="name"
                          value={tableForm.name}
                          onChange={(e) =>
                            setTableForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          required
                          placeholder="Например: Столик 1, У окна, VIP зона"
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Вместимость *</label>
                        <select
                          className="form-select"
                          name="capacity"
                          value={tableForm.capacity}
                          onChange={(e) =>
                            setTableForm((prev) => ({
                              ...prev,
                              capacity: parseInt(e.target.value),
                            }))
                          }
                          required
                        >
                          {[2, 4, 6, 8, 10].map((num) => (
                            <option key={num} value={num}>
                              {num} человек
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowTableModal(false)}
                    >
                      Отмена
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingTable ? "Обновить" : "Добавить"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Модальное окно бронирования */}
        {showReservationModal && selectedTable && (
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
                    onClick={() => setShowReservationModal(false)}
                  ></button>
                </div>
                <form onSubmit={handleReservationSubmit}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-12">
                        <div className="alert alert-info">
                          <i className="bi bi-info-circle me-2"></i>
                          Столик: <strong>{selectedTable.name}</strong>{" "}
                          (вместимость: {selectedTable.capacity} чел.)
                        </div>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Имя клиента *</label>
                        <input
                          type="text"
                          className="form-control"
                          name="customerName"
                          value={reservationForm.customerName}
                          onChange={(e) =>
                            setReservationForm((prev) => ({
                              ...prev,
                              customerName: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Телефон *</label>
                        <input
                          type="tel"
                          className="form-control"
                          name="customerPhone"
                          value={reservationForm.customerPhone}
                          onChange={(e) =>
                            setReservationForm((prev) => ({
                              ...prev,
                              customerPhone: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">
                          Количество гостей *
                        </label>
                        <select
                          className="form-select"
                          name="guestCount"
                          value={reservationForm.guestCount}
                          onChange={(e) =>
                            setReservationForm((prev) => ({
                              ...prev,
                              guestCount: parseInt(e.target.value),
                            }))
                          }
                          required
                        >
                          {Array.from(
                            { length: selectedTable.capacity },
                            (_, i) => i + 1
                          ).map((num) => (
                            <option key={num} value={num}>
                              {num} человек
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Статус</label>
                        <select
                          className="form-select"
                          name="status"
                          value={reservationForm.status}
                          onChange={(e) =>
                            setReservationForm((prev) => ({
                              ...prev,
                              status: e.target.value,
                            }))
                          }
                        >
                          <option value="confirmed">Подтверждено</option>
                          <option value="seated">Заселено</option>
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Начало *</label>
                        <input
                          type="datetime-local"
                          className="form-control"
                          name="reservedFrom"
                          value={reservationForm.reservedFrom}
                          onChange={(e) =>
                            setReservationForm((prev) => ({
                              ...prev,
                              reservedFrom: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Конец *</label>
                        <input
                          type="datetime-local"
                          className="form-control"
                          name="reservedTo"
                          value={reservationForm.reservedTo}
                          onChange={(e) =>
                            setReservationForm((prev) => ({
                              ...prev,
                              reservedTo: e.target.value,
                            }))
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
                      onClick={() => setShowReservationModal(false)}
                    >
                      Отмена
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingReservation ? "Обновить" : "Добавить"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TablesManagement;
