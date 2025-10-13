import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../../NavBar";
import { $authHost } from "../../../http";
import { useAuth } from "../../../context/AuthContext";
import {
  autoCompleteReservation,
  autoUpdateReservationToSeated,
  formatLocalDateTime,
  localToUTC,
  formatForDateTimeLocal,
} from "../../../utils/dateUtils";

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

  // Автообновление данных каждые 5 секунд
  const loadTableData = useCallback(async () => {
    try {
      // Загружаем данные столика
      const tableResponse = await $authHost.get(`/tables/${tableId}`);
      setTable(tableResponse.data);

      // Загружаем активные заказы столика (ВКЛЮЧАЯ payment)
      const ordersResponse = await $authHost.get("/orders");
      const tableOrders = ordersResponse.data.filter(
        (order) =>
          order.tableId === parseInt(tableId) &&
          ["open", "in_progress", "ready", "served", "payment"].includes(
            order.status
          )
      );

      // Исправление: правильное отображение цен
      const ordersWithCorrectPrices = tableOrders.map((order) => ({
        ...order,
        items: order.items.map((item) => ({
          ...item,
          price: item.itemPrice || item.dish?.price || 0,
        })),
      }));

      setOrders(ordersWithCorrectPrices);

      // Загружаем бронирования столика
      const reservationsResponse = await $authHost.get("/reservations");
      const tableReservations = reservationsResponse.data.filter(
        (reservation) => reservation.tableId === parseInt(tableId)
      );
      setReservations(tableReservations);

      // Загружаем меню (только при первом запуске)
      if (dishes.length === 0) {
        const dishesResponse = await $authHost.get("/dishes");
        setDishes(dishesResponse.data.rows || dishesResponse.data);
      }
    } catch (error) {
      console.error("Ошибка загрузки данных столика:", error);
      if (!error.message.includes("Network Error")) {
        setError("Не удалось загрузить данные столика");
      }
    } finally {
      setLoading(false);
    }
  }, [tableId, dishes.length]);

  useEffect(() => {
    if (tableId) {
      loadTableData();

      // Автообновление каждые 5 секунд
      const interval = setInterval(loadTableData, 5000);
      return () => clearInterval(interval);
    }
  }, [tableId, loadTableData]);

  // Периодическая проверка и авто-завершение бронирований
  useEffect(() => {
    const checkAndCompleteReservations = async () => {
      try {
        const now = new Date();

        for (const reservation of reservations) {
          // Если бронь в статусе "seated" и время истекло более 15 минут назад
          if (reservation.status === "seated") {
            const reservedTo = new Date(reservation.reservedTo);
            const fifteenMinutesAfter = new Date(
              reservedTo.getTime() + 15 * 60000
            );

            // Коррекция времени для сравнения
            const timezoneOffset = now.getTimezoneOffset() * 60000;
            const localNow = new Date(
              now.getTime() + timezoneOffset + 3 * 60 * 60000
            );
            const localFifteenMinutesAfter = new Date(
              fifteenMinutesAfter.getTime() + timezoneOffset + 3 * 60 * 60000
            );

            if (localNow > localFifteenMinutesAfter) {
              // Проверяем, есть ли активные заказы
              const tableOrders = orders.filter(
                (order) =>
                  order.tableId === reservation.tableId &&
                  [
                    "open",
                    "in_progress",
                    "ready",
                    "served",
                    "payment",
                  ].includes(order.status)
              );

              // Если активных заказов нет - завершаем бронь
              if (tableOrders.length === 0) {
                await $authHost.put(`/reservations/${reservation.id}`, {
                  status: "completed",
                });
                console.log(
                  `Бронирование ${reservation.id} автоматически завершено по времени`
                );
                // Перезагружаем данные
                await loadTableData();
              }
            }
          }
        }
      } catch (error) {
        console.error(
          "Ошибка при автоматической проверке бронирований:",
          error
        );
      }
    };

    // Проверяем каждые 5 минут
    const interval = setInterval(checkAndCompleteReservations, 5 * 60 * 1000);

    // Первая проверка при загрузке
    checkAndCompleteReservations();

    return () => clearInterval(interval);
  }, [reservations, orders, loadTableData]);

  // Возврат к списку столов
  const handleBack = () => {
    navigate("/waiter/tables");
  };

  const handleCreateReservation = () => {
    const now = new Date();

    // Простое и понятное вычисление времени
    const from = new Date(now.getTime() + 30 * 60000); // +30 минут
    const to = new Date(from.getTime() + 2 * 60 * 60000); // +2 часа

    console.log("Создание брони - вычисленное время:", {
      now: now.toLocaleString("ru-RU"),
      from: from.toLocaleString("ru-RU"),
      to: to.toLocaleString("ru-RU"),
      fromFormatted: formatForDateTimeLocal(from),
      toFormatted: formatForDateTimeLocal(to),
    });

    setReservationForm({
      customerName: "",
      customerPhone: "",
      guestCount: table ? Math.min(table.capacity, 2) : 2,
      reservedFrom: formatForDateTimeLocal(from),
      reservedTo: formatForDateTimeLocal(to),
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
        reservedFrom: localToUTC(reservationForm.reservedFrom),
        reservedTo: localToUTC(reservationForm.reservedTo),
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

  // Добавление блюд в существующий заказ
  const handleAddToOrder = (order) => {
    setSelectedOrder(order);
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
      id: Date.now() + Math.random(),
      dishId: parseInt(newOrderItem.dishId),
      dish: selectedDish,
      quantity: newOrderItem.quantity,
      notes: newOrderItem.notes,
      price: selectedDish.price,
      status: "ordered",
    };

    setOrderForm((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));

    setNewOrderItem({ dishId: "", quantity: 1, notes: "" });
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    try {
      if (orderForm.items.length === 0) {
        setError("Добавьте хотя бы одно блюдо в заказ");
        return;
      }

      if (selectedOrder) {
        const orderData = {
          items: orderForm.items.map((item) => ({
            dishId: item.dishId,
            quantity: item.quantity,
            notes: item.notes,
            price: item.price || item.dish?.price,
          })),
        };

        await $authHost.post(`/orders/${selectedOrder.id}/items`, orderData);
        setSuccess("Новые блюда добавлены в заказ");
      } else {
        const orderData = {
          tableId: parseInt(tableId),
          waiterId: user.id,
          items: orderForm.items.map((item) => ({
            dishId: item.dishId,
            quantity: item.quantity,
            notes: item.notes,
            price: item.price || item.dish?.price,
          })),
        };

        await $authHost.post("/orders", orderData);
        setSuccess("Заказ успешно создан");

        // АВТОМАТИЧЕСКОЕ ОБНОВЛЕНИЕ БРОНИ ПРИ СОЗДАНИИ ЗАКАЗА
        await autoUpdateReservationToSeated(parseInt(tableId), $authHost);
      }

      setShowOrderModal(false);
      await loadTableData();
    } catch (error) {
      console.error("Ошибка создания/обновления заказа:", error);
      if (error.response?.status === 404) {
        setError(
          "Endpoint для добавления блюд не найден. Обратитесь к администратору."
        );
      } else {
        setError(error.response?.data?.message || "Не удалось создать заказ");
      }
    }
  };

  // ФУНКЦИЯ: Подача отдельного блюда
  const handleServeDish = async (orderItemId) => {
    try {
      await $authHost.put(`/orders/order-items/${orderItemId}/served`);
      setSuccess("Блюдо отмечено как поданное");
      await loadTableData();
    } catch (error) {
      console.error("Ошибка отметки подачи блюда:", error);
      setError(
        error.response?.data?.message ||
          "Не удалось отметить блюдо как поданное"
      );
    }
  };

  // ФУНКЦИЯ: Перевод всего заказа в статус "Подано"
  const handleMarkOrderServed = async (orderId) => {
    try {
      await $authHost.put(`/orders/${orderId}/served`);
      setSuccess("Заказ переведен в статус 'Подано'");
      await loadTableData();
    } catch (error) {
      console.error("Ошибка перевода заказа в статус 'Подано':", error);
      setError(
        error.response?.data?.message ||
          "Не удалось перевести заказ в статус 'Подано'"
      );
    }
  };

  // ФУНКЦИЯ: Перевод заказа в статус "Ожидание оплаты"
  const handleMarkOrderPayment = async (orderId) => {
    try {
      await $authHost.put(`/orders/${orderId}/payment`);
      setSuccess("Заказ переведен в статус 'Ожидание оплаты'");

      // АВТОМАТИЧЕСКОЕ ЗАВЕРШЕНИЕ БРОНИ ПРИ ПЕРЕВОДЕ В ОПЛАТУ
      const order = orders.find((o) => o.id === orderId);
      if (order) {
        await autoCompleteReservation(order.tableId, $authHost);
      }

      await loadTableData();
    } catch (error) {
      console.error("Ошибка перевода заказа в статус оплаты:", error);
      setError(
        error.response?.data?.message ||
          "Не удалось перевести заказ в статус оплаты"
      );
    }
  };

  // ФУНКЦИЯ: Закрытие заказа
  const handleCloseOrder = async (orderId) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      await $authHost.put(`/orders/${orderId}/close`);
      setSuccess("Заказ успешно закрыт");

      // АВТОМАТИЧЕСКОЕ ЗАВЕРШЕНИЕ БРОНИ
      await autoCompleteReservation(order.tableId, $authHost);

      await loadTableData();
    } catch (error) {
      console.error("Ошибка закрытия заказа:", error);
      if (error.response?.status === 400) {
        const errorData = error.response?.data;
        if (errorData?.forceCloseAvailable) {
          setError(
            `Не удалось закрыть заказ: ${errorData.message}. Хотите принудительно закрыть?`
          );
        } else {
          setError(
            errorData?.message ||
              "Не все блюда поданы. Невозможно закрыть заказ."
          );
        }
      } else {
        setError("Не удалось закрыть заказ");
      }
    }
  };

  // Корректный расчет суммы
  const calculateOrderTotal = (items) => {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((total, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      return total + price * quantity;
    }, 0);
  };

  // Проверка статуса заказа
  const getOrderStatusInfo = (order) => {
    if (!order)
      return { status: "open", label: "Открыт", badgeClass: "primary" };

    const items = order.items || [];
    const readyItems = items.filter((item) => item.status === "ready").length;

    if (order.status === "served") {
      return { status: "served", label: "Подано", badgeClass: "info" };
    }
    if (order.status === "payment") {
      return {
        status: "payment",
        label: "Ожидание оплаты",
        badgeClass: "warning",
      };
    }
    if (order.status === "closed") {
      return { status: "closed", label: "Закрыт", badgeClass: "secondary" };
    } else if (readyItems > 0) {
      return {
        status: "ready",
        label: "Готов к подаче",
        badgeClass: "success",
      };
    } else if (items.some((item) => item.status === "preparing")) {
      return {
        status: "in_progress",
        label: "Готовится",
        badgeClass: "warning",
      };
    } else {
      return { status: "open", label: "Открыт", badgeClass: "primary" };
    }
  };

  // ФУНКЦИЯ: Проверка, можно ли подать блюдо
  const canServeDish = (item) => {
    return item.status === "ready";
  };

  // ФУНКЦИЯ: Проверка, можно ли перевести заказ в статус "Подано"
  const canMarkOrderServed = (order) => {
    if (!order || !order.items || order.items.length === 0) return false;
    const allServed = order.items.every((item) => item.status === "served");
    const notAlreadyServed = order.status !== "served";
    return allServed && notAlreadyServed;
  };

  // ФУНКЦИЯ: Проверка, можно ли перевести заказ в статус оплаты
  const canMarkOrderPayment = (order) => {
    return order.status === "served";
  };

  // Функция для фильтрации бронирований на сегодня
  const getTodayReservations = () => {
    const today = new Date().toISOString().split("T")[0];
    return reservations.filter((reservation) => {
      const reservationDate = new Date(reservation.reservedFrom)
        .toISOString()
        .split("T")[0];
      return reservationDate === today;
    });
  };

  const activeOrder = orders.length > 0 ? orders[0] : null;
  const orderStatusInfo = activeOrder ? getOrderStatusInfo(activeOrder) : null;
  const todayReservations = getTodayReservations();

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
            Назад к столикам
          </button>
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
                      <button
                        className="btn btn-primary"
                        onClick={
                          activeOrder
                            ? () => handleAddToOrder(activeOrder)
                            : handleCreateOrder
                        }
                      >
                        <i className="bi bi-plus-circle me-1"></i>
                        {activeOrder ? "Добавить блюда" : "Создать заказ"}
                      </button>
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

        {/* Статус столика */}
        <div className="row mb-4">
          <div className="col-md-6">
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
          <div className="col-md-6">
            <div className="card">
              <div className="card-body text-center">
                <div className="display-6 text-info">
                  <i className="bi bi-cup-straw"></i>
                </div>
                <h5>{activeOrder ? "Активный заказ" : "Нет заказов"}</h5>
                {activeOrder && (
                  <small className="text-muted">
                    Сумма: {calculateOrderTotal(activeOrder.items || [])} ₽
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
                              className={`badge bg-${orderStatusInfo?.badgeClass} me-2`}
                            >
                              {orderStatusInfo?.label}
                            </span>

                            {canMarkOrderServed(activeOrder) && (
                              <button
                                className="btn btn-info btn-sm me-2"
                                onClick={() =>
                                  handleMarkOrderServed(activeOrder.id)
                                }
                              >
                                Отметить как поданный
                              </button>
                            )}
                            {canMarkOrderPayment(activeOrder) && (
                              <button
                                className="btn btn-warning btn-sm me-2"
                                onClick={() =>
                                  handleMarkOrderPayment(activeOrder.id)
                                }
                              >
                                Перевести к оплате
                              </button>
                            )}
                            <button
                              className="btn btn-primary btn-sm me-2"
                              onClick={() => handleAddToOrder(activeOrder)}
                            >
                              Добавить блюда
                            </button>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleCloseOrder(activeOrder.id)}
                            >
                              Закрыть заказ
                            </button>
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
                                <th width="120">Действия</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(activeOrder.items || []).map((item) => (
                                <tr key={item.id}>
                                  <td>
                                    {item.dish?.name || "Неизвестное блюдо"}
                                  </td>
                                  <td>{item.quantity}</td>
                                  <td>
                                    {item.itemPrice || item.dish?.price || 0} ₽
                                  </td>
                                  <td>
                                    {(
                                      (item.itemPrice ||
                                        item.dish?.price ||
                                        0) * (item.quantity || 0)
                                    ).toFixed(2)}{" "}
                                    ₽
                                  </td>
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
                                  <td>
                                    {canServeDish(item) && (
                                      <button
                                        className="btn btn-success btn-sm"
                                        onClick={() => handleServeDish(item.id)}
                                        title="Отметить как поданное"
                                      >
                                        <i className="bi bi-check-lg"></i>{" "}
                                        Подать
                                      </button>
                                    )}
                                    {item.status === "served" && (
                                      <span className="badge bg-secondary">
                                        Подано
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan="3" className="text-end">
                                  <strong>Итого:</strong>
                                </td>
                                <td colSpan="4">
                                  <strong>
                                    {calculateOrderTotal(
                                      activeOrder.items || []
                                    ).toFixed(2)}{" "}
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
                      <h5>Бронирования столика на сегодня</h5>
                      <button
                        className="btn btn-outline-warning btn-sm"
                        onClick={handleCreateReservation}
                      >
                        <i className="bi bi-calendar-plus me-1"></i>
                        Добавить бронирование
                      </button>
                    </div>

                    {todayReservations.length === 0 ? (
                      <div className="text-center py-4">
                        <i className="bi bi-calendar-x display-1 text-muted"></i>
                        <p className="text-muted mt-3">
                          Нет бронирований для этого столика на сегодня
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
                            {todayReservations.map((reservation) => (
                              <tr key={reservation.id}>
                                <td>{reservation.customerName}</td>
                                <td>{reservation.customerPhone}</td>
                                <td>
                                  {formatLocalDateTime(
                                    reservation.reservedFrom
                                  )}{" "}
                                  -{" "}
                                  {formatLocalDateTime(reservation.reservedTo)}
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
                                        : reservation.status === "completed"
                                        ? "bg-secondary"
                                        : "bg-light text-dark"
                                    }`}
                                  >
                                    {reservation.status === "confirmed"
                                      ? "Подтверждено"
                                      : reservation.status === "seated"
                                      ? "Гости за столом"
                                      : reservation.status === "completed"
                                      ? "Завершено"
                                      : reservation.status}
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
                  {selectedOrder
                    ? `Добавить блюда в заказ #${selectedOrder.id}`
                    : `Новый заказ для столика ${table.name}`}
                </h5>
                {selectedOrder && (
                  <span className="badge bg-info ms-2">
                    Режим добавления блюд
                  </span>
                )}
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
                          <h6 className="mb-0">
                            {selectedOrder
                              ? "Новые блюда в заказе"
                              : "Блюда в заказе"}
                          </h6>
                          <div>
                            <span className="badge bg-primary me-2">
                              {orderForm.items.length} блюд
                            </span>
                            <span className="badge bg-success">
                              Итого:{" "}
                              {calculateOrderTotal(orderForm.items).toFixed(2)}{" "}
                              ₽
                            </span>
                          </div>
                        </div>
                        <div className="card-body">
                          {orderForm.items.length === 0 ? (
                            <p className="text-muted text-center mb-0">
                              {selectedOrder
                                ? "Добавьте новые блюда в заказ"
                                : "Нет добавленных блюд"}
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
                                    <th width="80">Действия</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {orderForm.items.map((item, index) => (
                                    <tr key={item.id}>
                                      <td>
                                        {item.dish?.name}
                                        {selectedOrder && (
                                          <span className="badge bg-success ms-1">
                                            Новое
                                          </span>
                                        )}
                                      </td>
                                      <td>{item.price} ₽</td>
                                      <td>{item.quantity}</td>
                                      <td>
                                        {(
                                          (item.price || 0) *
                                          (item.quantity || 0)
                                        ).toFixed(2)}{" "}
                                        ₽
                                      </td>
                                      <td>
                                        <small className="text-muted">
                                          {item.notes || ""}
                                        </small>
                                      </td>
                                      <td>
                                        <button
                                          type="button"
                                          className="btn btn-outline-danger btn-sm"
                                          onClick={() => {
                                            setOrderForm((prev) => ({
                                              ...prev,
                                              items: prev.items.filter(
                                                (_, i) => i !== index
                                              ),
                                            }));
                                          }}
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
                                        {calculateOrderTotal(
                                          orderForm.items
                                        ).toFixed(2)}{" "}
                                        ₽
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
                    {selectedOrder ? "Добавить блюда" : "Создать заказ"}
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
