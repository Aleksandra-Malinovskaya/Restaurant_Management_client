import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../../NavBar";
import { $authHost } from "../../../http";
import { useAuth } from "../../../context/AuthContext";

const WaiterTable = () => {
  const { tableId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [table, setTable] = useState(null);
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeTab, setActiveTab] = useState("order");

  // Состояния для форм
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [reservationForm, setReservationForm] = useState({
    customerName: "",
    customerPhone: "",
    guestCount: 2,
    reservedFrom: "",
    reservedTo: "",
  });

  const [orderForm, setOrderForm] = useState({
    items: [],
  });

  const [newOrderItem, setNewOrderItem] = useState({
    dishId: "",
    quantity: 1,
    notes: "",
  });

  useEffect(() => {
    if (tableId) {
      loadTableData();
    }
  }, [tableId]);

  const loadTableData = async () => {
    try {
      setLoading(true);

      // Загружаем данные столика
      const tableResponse = await $authHost.get(`/tables/${tableId}`);
      setTable(tableResponse.data);

      // Загружаем активные заказы столика
      const ordersResponse = await $authHost.get("/orders");
      const tableOrders = ordersResponse.data.filter(
        (order) =>
          order.tableId === parseInt(tableId) &&
          ["open", "in_progress", "ready"].includes(order.status)
      );
      setOrders(tableOrders);

      // Загружаем бронирования столика
      const today = new Date().toISOString().split("T")[0];
      const reservationsResponse = await $authHost.get(
        `/reservations?date=${today}`
      );
      const tableReservations = reservationsResponse.data.filter(
        (reservation) => reservation.tableId === parseInt(tableId)
      );
      setReservations(tableReservations);

      // Загружаем меню
      const dishesResponse = await $authHost.get("/dishes");
      setDishes(dishesResponse.data.rows || dishesResponse.data);
    } catch (error) {
      console.error("Ошибка загрузки данных столика:", error);
      setError("Не удалось загрузить данные столика");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate("/waiter");
  };

  // Функции для бронирований
  const handleCreateReservation = () => {
    const now = new Date();
    const from = new Date(now.getTime() + 30 * 60000);
    const to = new Date(from.getTime() + 2 * 60 * 60000);

    setReservationForm({
      customerName: "",
      customerPhone: "",
      guestCount: table ? Math.min(table.capacity, 2) : 2,
      reservedFrom: from.toISOString().slice(0, 16),
      reservedTo: to.toISOString().slice(0, 16),
    });
    setShowReservationModal(true);
  };

  const handleReservationSubmit = async (e) => {
    e.preventDefault();
    try {
      const reservationData = {
        tableId: parseInt(tableId),
        customerName: reservationForm.customerName,
        customerPhone: reservationForm.customerPhone,
        guestCount: reservationForm.guestCount,
        reservedFrom: new Date(reservationForm.reservedFrom).toISOString(),
        reservedTo: new Date(reservationForm.reservedTo).toISOString(),
        status: "confirmed",
      };

      await $authHost.post("/reservations", reservationData);
      setSuccess("Бронирование успешно создано");
      setShowReservationModal(false);
      await loadTableData();
    } catch (error) {
      console.error("Ошибка создания бронирования:", error);
      setError(
        error.response?.data?.message || "Не удалось создать бронирование"
      );
    }
  };

  // Функции для заказов
  const handleCreateOrder = () => {
    setSelectedOrder(null);
    setOrderForm({ items: [] });
    setNewOrderItem({ dishId: "", quantity: 1, notes: "" });
    setShowOrderModal(true);
  };

  const handleAddOrderItem = () => {
    if (!newOrderItem.dishId) {
      setError("Выберите блюдо");
      return;
    }

    const selectedDish = dishes.find(
      (dish) => dish.id === parseInt(newOrderItem.dishId)
    );
    if (!selectedDish) {
      setError("Блюдо не найдено");
      return;
    }

    const newItem = {
      id: Date.now(),
      dishId: parseInt(newOrderItem.dishId),
      dish: selectedDish,
      quantity: newOrderItem.quantity,
      notes: newOrderItem.notes,
      price: selectedDish.price,
    };

    setOrderForm((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));

    setNewOrderItem({ dishId: "", quantity: 1, notes: "" });
  };

  const handleRemoveOrderItem = (index) => {
    setOrderForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    try {
      if (orderForm.items.length === 0) {
        setError("Добавьте хотя бы одно блюдо в заказ");
        return;
      }

      const orderData = {
        tableId: parseInt(tableId),
        waiterId: user.id,
        items: orderForm.items.map((item) => ({
          dishId: item.dishId,
          quantity: item.quantity,
          notes: item.notes,
          price: item.price,
        })),
      };

      await $authHost.post("/orders", orderData);
      setSuccess("Заказ успешно создан");
      setShowOrderModal(false);
      await loadTableData();
    } catch (error) {
      console.error("Ошибка создания заказа:", error);
      setError(error.response?.data?.message || "Не удалось создать заказ");
    }
  };

  const handleMarkServed = async (orderId) => {
    try {
      // Получаем все позиции заказа
      const orderResponse = await $authHost.get(`/orders/${orderId}`);
      const order = orderResponse.data;

      // Отмечаем все готовые позиции как поданные
      for (const item of order.items) {
        if (item.status === "ready") {
          await $authHost.put(`/order-items/${item.id}/served`);
        }
      }

      setSuccess("Блюда отмечены как поданные");
      await loadTableData();
    } catch (error) {
      console.error("Ошибка отметки подачи:", error);
      setError("Не удалось отметить блюда как поданные");
    }
  };

  const calculateOrderTotal = (items) => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getCurrentReservation = () => {
    const now = new Date();
    return reservations.find(
      (reservation) =>
        new Date(reservation.reservedFrom) <= now &&
        new Date(reservation.reservedTo) >= now &&
        ["confirmed", "seated"].includes(reservation.status)
    );
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

  if (!table) {
    return (
      <div className="min-vh-100 bg-light">
        <Navbar />
        <div className="container-fluid py-4">
          <div className="alert alert-danger">Столик не найден</div>
          <button className="btn btn-secondary" onClick={handleBack}>
            Назад
          </button>
        </div>
      </div>
    );
  }

  const currentReservation = getCurrentReservation();
  const activeOrder = orders.length > 0 ? orders[0] : null;

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
                        title="Вернуться к списку столиков"
                      >
                        <i className="bi bi-arrow-left"></i>
                      </button>
                      <div>
                        <h1 className="h3 mb-2">
                          <i className="bi bi-table me-2"></i>
                          Столик: {table.name}
                        </h1>
                        <p className="text-muted mb-0">
                          Вместимость: {table.capacity} человек
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 text-end">
                    <div className="btn-group">
                      {!activeOrder && (
                        <button
                          className="btn btn-primary"
                          onClick={handleCreateOrder}
                        >
                          <i className="bi bi-plus-circle me-1"></i>
                          Создать заказ
                        </button>
                      )}
                      <button
                        className="btn btn-outline-warning"
                        onClick={handleCreateReservation}
                      >
                        <i className="bi bi-calendar-plus me-1"></i>
                        Забронировать
                      </button>
                    </div>
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
              </div>
            </div>
          </div>
        )}

        {/* Информация о столике */}
        <div className="row mb-4">
          <div className="col-md-4">
            <div className="card">
              <div className="card-body text-center">
                <div
                  className={`display-6 text-${
                    activeOrder ? "danger" : "success"
                  }`}
                >
                  <i
                    className={`bi ${
                      activeOrder ? "bi-person-check-fill" : "bi-person-plus"
                    }`}
                  ></i>
                </div>
                <h5>{activeOrder ? "Занят" : "Свободен"}</h5>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card">
              <div className="card-body text-center">
                <div className="display-6 text-warning">
                  <i className="bi bi-clock"></i>
                </div>
                <h5>{currentReservation ? "Забронирован" : "Свободен"}</h5>
                {currentReservation && (
                  <small className="text-muted">
                    {currentReservation.customerName}
                  </small>
                )}
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card">
              <div className="card-body text-center">
                <div className="display-6 text-info">
                  <i className="bi bi-cup-straw"></i>
                </div>
                <h5>{activeOrder ? "Активный заказ" : "Нет заказов"}</h5>
                {activeOrder && (
                  <small className="text-muted">
                    {calculateOrderTotal(activeOrder.items || [])} ₽
                  </small>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Навигация */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-white p-0">
                <ul className="nav nav-tabs card-header-tabs">
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        activeTab === "order" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("order")}
                    >
                      <i className="bi bi-cart me-2"></i>
                      Заказ
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        activeTab === "reservations" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("reservations")}
                    >
                      <i className="bi bi-calendar-event me-2"></i>
                      Бронирования
                    </button>
                  </li>
                </ul>
              </div>

              <div className="card-body">
                {/* Вкладка Заказ */}
                {activeTab === "order" && (
                  <div>
                    {activeOrder ? (
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-4">
                          <h5>Активный заказ #{activeOrder.id}</h5>
                          <div>
                            <span
                              className={`badge bg-${
                                activeOrder.status === "ready"
                                  ? "success"
                                  : activeOrder.status === "in_progress"
                                  ? "warning"
                                  : "primary"
                              } me-2`}
                            >
                              {activeOrder.status === "ready"
                                ? "Готов к подаче"
                                : activeOrder.status === "in_progress"
                                ? "Готовится"
                                : "Открыт"}
                            </span>
                            {activeOrder.status === "ready" && (
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleMarkServed(activeOrder.id)}
                              >
                                Отметить как поданный
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="table-responsive">
                          <table className="table table-hover">
                            <thead className="table-light">
                              <tr>
                                <th>Блюдо</th>
                                <th>Количество</th>
                                <th>Цена</th>
                                <th>Сумма</th>
                                <th>Статус</th>
                                <th>Примечания</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(activeOrder.items || []).map((item) => (
                                <tr key={item.id}>
                                  <td>{item.dish?.name}</td>
                                  <td>{item.quantity}</td>
                                  <td>{item.price} ₽</td>
                                  <td>{item.price * item.quantity} ₽</td>
                                  <td>
                                    <span
                                      className={`badge bg-${
                                        item.status === "ready"
                                          ? "success"
                                          : item.status === "preparing"
                                          ? "warning"
                                          : item.status === "served"
                                          ? "secondary"
                                          : "primary"
                                      }`}
                                    >
                                      {item.status === "ready"
                                        ? "Готово"
                                        : item.status === "preparing"
                                        ? "Готовится"
                                        : item.status === "served"
                                        ? "Подано"
                                        : "Заказано"}
                                    </span>
                                  </td>
                                  <td>
                                    <small className="text-muted">
                                      {item.notes || "-"}
                                    </small>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan="3" className="text-end">
                                  <strong>Итого:</strong>
                                </td>
                                <td colSpan="3">
                                  <strong>
                                    {calculateOrderTotal(
                                      activeOrder.items || []
                                    )}{" "}
                                    ₽
                                  </strong>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-5">
                        <i className="bi bi-cart display-1 text-muted"></i>
                        <h5 className="mt-3 text-muted">
                          Нет активных заказов
                        </h5>
                        <p className="text-muted mb-4">
                          Создайте новый заказ для этого столика
                        </p>
                        <button
                          className="btn btn-primary"
                          onClick={handleCreateOrder}
                        >
                          <i className="bi bi-plus-circle me-1"></i>
                          Создать заказ
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Вкладка Бронирования */}
                {activeTab === "reservations" && (
                  <div>
                    <div className="d-flex justify-content-between align-items-center mb-4">
                      <h5>Бронирования столика</h5>
                      <button
                        className="btn btn-outline-warning btn-sm"
                        onClick={handleCreateReservation}
                      >
                        <i className="bi bi-calendar-plus me-1"></i>
                        Добавить бронирование
                      </button>
                    </div>

                    {reservations.length === 0 ? (
                      <div className="text-center py-4">
                        <i className="bi bi-calendar-x display-1 text-muted"></i>
                        <p className="text-muted mt-3">
                          Нет бронирований для этого столика
                        </p>
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-hover">
                          <thead className="table-light">
                            <tr>
                              <th>Клиент</th>
                              <th>Телефон</th>
                              <th>Время</th>
                              <th>Гости</th>
                              <th>Статус</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reservations.map((reservation) => (
                              <tr key={reservation.id}>
                                <td>{reservation.customerName}</td>
                                <td>{reservation.customerPhone}</td>
                                <td>
                                  {new Date(
                                    reservation.reservedFrom
                                  ).toLocaleString()}{" "}
                                  -{" "}
                                  {new Date(
                                    reservation.reservedTo
                                  ).toLocaleString()}
                                </td>
                                <td>
                                  <span className="badge bg-secondary">
                                    {reservation.guestCount} чел.
                                  </span>
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
                                      ? "Гости за столом"
                                      : "Завершено"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно бронирования */}
      {showReservationModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Новое бронирование</h5>
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
                    <div className="col-12">
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
                    <div className="col-12">
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
                        {Array.from(
                          { length: table.capacity },
                          (_, i) => i + 1
                        ).map((num) => (
                          <option key={num} value={num}>
                            {num} человек
                          </option>
                        ))}
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
                    onClick={() => setShowReservationModal(false)}
                  >
                    Отмена
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Создать бронирование
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно заказа */}
      {showOrderModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  Новый заказ для столика {table.name}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowOrderModal(false)}
                ></button>
              </div>
              <form onSubmit={handleOrderSubmit}>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-12">
                      <div className="card">
                        <div className="card-header">
                          <h6 className="mb-0">Добавить блюдо</h6>
                        </div>
                        <div className="card-body">
                          <div className="row g-2">
                            <div className="col-md-5">
                              <select
                                className="form-select"
                                value={newOrderItem.dishId}
                                onChange={(e) =>
                                  setNewOrderItem({
                                    ...newOrderItem,
                                    dishId: e.target.value,
                                  })
                                }
                              >
                                <option value="">Выберите блюдо</option>
                                {dishes
                                  .filter(
                                    (dish) => dish.isActive && !dish.isStopped
                                  )
                                  .map((dish) => (
                                    <option key={dish.id} value={dish.id}>
                                      {dish.name} - {dish.price} ₽
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div className="col-md-2">
                              <input
                                type="number"
                                className="form-control"
                                min="1"
                                value={newOrderItem.quantity}
                                onChange={(e) =>
                                  setNewOrderItem({
                                    ...newOrderItem,
                                    quantity: parseInt(e.target.value),
                                  })
                                }
                              />
                            </div>
                            <div className="col-md-3">
                              <input
                                type="text"
                                className="form-control"
                                placeholder="Примечания"
                                value={newOrderItem.notes}
                                onChange={(e) =>
                                  setNewOrderItem({
                                    ...newOrderItem,
                                    notes: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="col-md-2">
                              <button
                                type="button"
                                className="btn btn-primary w-100"
                                onClick={handleAddOrderItem}
                              >
                                Добавить
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="col-12">
                      <div className="card">
                        <div className="card-header d-flex justify-content-between align-items-center">
                          <h6 className="mb-0">Блюда в заказе</h6>
                          <div>
                            <span className="badge bg-primary me-2">
                              {orderForm.items.length} блюд
                            </span>
                            <span className="badge bg-success">
                              Итого: {calculateOrderTotal(orderForm.items)} ₽
                            </span>
                          </div>
                        </div>
                        <div className="card-body">
                          {orderForm.items.length === 0 ? (
                            <p className="text-muted text-center mb-0">
                              Нет добавленных блюд
                            </p>
                          ) : (
                            <div className="table-responsive">
                              <table className="table table-sm">
                                <thead>
                                  <tr>
                                    <th>Блюдо</th>
                                    <th>Цена</th>
                                    <th>Кол-во</th>
                                    <th>Сумма</th>
                                    <th>Примечания</th>
                                    <th width="50"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {orderForm.items.map((item, index) => (
                                    <tr key={item.id}>
                                      <td>{item.dish?.name}</td>
                                      <td>{item.price} ₽</td>
                                      <td>{item.quantity}</td>
                                      <td>{item.price * item.quantity} ₽</td>
                                      <td>
                                        <small className="text-muted">
                                          {item.notes || ""}
                                        </small>
                                      </td>
                                      <td>
                                        <button
                                          type="button"
                                          className="btn btn-outline-danger btn-sm"
                                          onClick={() =>
                                            handleRemoveOrderItem(index)
                                          }
                                        >
                                          <i className="bi bi-trash"></i>
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr>
                                    <td colSpan="3" className="text-end">
                                      <strong>Итого:</strong>
                                    </td>
                                    <td colSpan="3">
                                      <strong>
                                        {calculateOrderTotal(orderForm.items)} ₽
                                      </strong>
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowOrderModal(false)}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={orderForm.items.length === 0}
                  >
                    Создать заказ
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

export default WaiterTable;
