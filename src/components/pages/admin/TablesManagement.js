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
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showTableModal, setShowTableModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [editingReservation, setEditingReservation] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState("tables");

  // Фильтры для разных вкладок
  const [tableFilters, setTableFilters] = useState({
    status: "all",
    capacity: "all",
    search: "",
  });

  const [orderFilters, setOrderFilters] = useState({
    status: "all",
    search: "",
  });

  const [reservationFilters, setReservationFilters] = useState({
    status: "all",
    date: new Date().toISOString().split("T")[0],
  });

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

  const [orderForm, setOrderForm] = useState({
    waiterId: "",
    status: "open",
    items: [],
  });

  const [newOrderItem, setNewOrderItem] = useState({
    dishId: "",
    quantity: 1,
    notes: "",
  });

  // Функция для преобразования времени с учетом часового пояса
  const toLocalISOString = (date) => {
    if (!date) return "";
    const localDate = new Date(date);
    const timezoneOffset = localDate.getTimezoneOffset() * 60000;
    return new Date(localDate.getTime() - timezoneOffset)
      .toISOString()
      .slice(0, 16);
  };

  const fromUTCToLocal = (utcDate) => {
    if (!utcDate) return null;
    const date = new Date(utcDate);
    return date;
  };

  const fromLocalToUTC = (localDate) => {
    if (!localDate) return null;
    const date = new Date(localDate);
    return date.toISOString();
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

  // Функция для автоматического обновления статусов завершенных бронирований
  const updateCompletedReservations = useCallback(async (reservationsList) => {
    const now = new Date();
    const completedReservations = reservationsList.filter(
      (reservation) =>
        reservation.status === "seated" &&
        fromUTCToLocal(reservation.reservedTo) < now
    );

    let hasUpdates = false;

    for (const reservation of completedReservations) {
      try {
        await $authHost.put(`/reservations/${reservation.id}`, {
          status: "completed",
        });
        console.log(
          `Бронирование ${reservation.id} переведено в статус "completed"`
        );
        hasUpdates = true;
      } catch (error) {
        console.error(
          `Ошибка обновления бронирования ${reservation.id}:`,
          error
        );
      }
    }

    return hasUpdates;
  }, []);

  const loadData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
        }
        setError("");

        let loadedTables = [];
        let loadedOrders = [];
        let loadedReservations = [];
        let loadedWaiters = [];
        let loadedDishes = [];

        try {
          const tablesResponse = await $authHost.get("/tables");
          loadedTables = safeArray(extractData(tablesResponse.data));
        } catch (err) {
          console.error("Ошибка загрузки столиков:", err);
          loadedTables = [];
        }

        try {
          // Загружаем все активные заказы ВКЛЮЧАЯ payment
          const allOrdersResponse = await $authHost.get("/orders");
          loadedOrders = safeArray(extractData(allOrdersResponse.data));
          // Фильтруем только активные заказы (ДОБАВЛЕН payment)
          loadedOrders = loadedOrders.filter((order) =>
            ["open", "in_progress", "ready", "payment"].includes(order.status)
          );
        } catch (err) {
          console.error("Ошибка загрузки заказов:", err);
          loadedOrders = [];
        }

        try {
          const reservationsResponse = await $authHost.get("/reservations");
          loadedReservations = safeArray(
            extractData(reservationsResponse.data)
          );
        } catch (err) {
          console.error("Ошибка загрузки бронирований:", err);
          loadedReservations = [];
        }

        try {
          // Загружаем только официантов и админов
          const usersResponse = await $authHost.get("/users");
          const allUsers = safeArray(extractData(usersResponse.data));
          // Фильтруем только официантов и админов
          loadedWaiters = allUsers.filter(
            (user) => user.role === "waiter" || user.role === "admin"
          );
        } catch (err) {
          console.error("Ошибка загрузки официантов:", err);
          loadedWaiters = [];
        }

        try {
          const dishesResponse = await $authHost.get("/dishes");
          loadedDishes = safeArray(extractData(dishesResponse.data));
        } catch (err) {
          console.error("Ошибка загрузки блюд:", err);
          loadedDishes = [];
        }

        setTables(loadedTables);
        setOrders(loadedOrders);
        setReservations(loadedReservations);
        setWaiters(loadedWaiters);
        setDishes(loadedDishes);

        // Автоматическое обновление статусов завершенных бронирований
        try {
          const hasUpdates = await updateCompletedReservations(
            loadedReservations
          );
          if (hasUpdates) {
            setTimeout(() => loadData(true), 1000);
          }
        } catch (updateErr) {
          console.error(
            "Ошибка при обновлении статусов бронирований:",
            updateErr
          );
        }
      } catch (error) {
        console.error("Общая ошибка загрузки:", error);
        if (!silent) {
          setError(
            "Не удалось загрузить данные. Проверьте подключение к серверу."
          );
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [updateCompletedReservations]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Периодическое обновление статусов
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const hasUpdates = await updateCompletedReservations(reservations);
        if (hasUpdates) {
          await loadData(true);
        }
      } catch (error) {
        console.error("Ошибка при автоматическом обновлении статусов:", error);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [reservations, updateCompletedReservations, loadData]);

  const handleBack = () => {
    navigate("/admin");
  };

  // Вспомогательные функции
  const getTableOrders = (tableId) => {
    return orders.filter(
      (order) =>
        order.tableId === tableId &&
        ["open", "in_progress", "ready", "payment"].includes(order.status) // ДОБАВЛЕН payment
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

    // ЕСЛИ ЕСТЬ ЗАКАЗ В ЛЮБОМ АКТИВНОМ СТАТУСЕ (включая payment) - СТОЛИК ЗАНЯТ
    if (tableOrders.length > 0) return "occupied";
    if (currentReservation && currentReservation.status === "seated")
      return "occupied";
    if (currentReservation && currentReservation.status === "confirmed")
      return "reserved";

    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 60000);
    const upcomingReservation = reservations.find(
      (reservation) =>
        reservation.tableId === table.id &&
        fromUTCToLocal(reservation.reservedFrom) <= soon &&
        fromUTCToLocal(reservation.reservedTo) > now &&
        ["confirmed", "seated"].includes(reservation.status)
    );

    if (upcomingReservation) return "reserved_soon";
    return "free";
  };

  const canCreateOrder = (tableId) => {
    const tableOrders = getTableOrders(tableId);
    return tableOrders.length === 0;
  };

  const getActiveOrder = (tableId) => {
    const tableOrders = getTableOrders(tableId);
    return tableOrders.length > 0 ? tableOrders[0] : null;
  };

  // Функция для получения цены блюда
  const getItemPrice = (item) => {
    const price = item.price || item.itemPrice || 0;
    return Number(price) || 0;
  };

  // Функция для получения названия блюда
  const getItemName = (item) => {
    return item.dish?.name || item.name || "Неизвестное блюдо";
  };

  // Функция для расчета суммы заказа
  const calculateOrderTotal = (orderItems) => {
    if (!orderItems || !Array.isArray(orderItems)) return 0;

    const total = orderItems.reduce((total, item) => {
      const price = getItemPrice(item);
      const quantity = Number(item.quantity) || 0;
      return total + price * quantity;
    }, 0);

    return total;
  };

  // Фильтрация для разных вкладок
  const filteredTables = tables.filter((table) => {
    const status = getTableStatus(table);
    const matchesStatus =
      tableFilters.status === "all" || status === tableFilters.status;
    const matchesCapacity =
      tableFilters.capacity === "all" ||
      table.capacity >= parseInt(tableFilters.capacity);
    const matchesSearch =
      tableFilters.search === "" ||
      table.name.toLowerCase().includes(tableFilters.search.toLowerCase());

    return matchesStatus && matchesCapacity && matchesSearch;
  });

  const filteredOrders = orders.filter((order) => {
    const matchesStatus =
      orderFilters.status === "all" || order.status === orderFilters.status;
    const table = tables.find((t) => t.id === order.tableId);
    const matchesSearch =
      orderFilters.search === "" ||
      (table &&
        table.name.toLowerCase().includes(orderFilters.search.toLowerCase())) ||
      order.id.toString().includes(orderFilters.search);

    return matchesStatus && matchesSearch;
  });

  const filteredReservations = reservations.filter((reservation) => {
    const reservationDate = fromUTCToLocal(reservation.reservedFrom)
      .toISOString()
      .split("T")[0];
    const matchesDate = reservationDate === reservationFilters.date;
    const matchesStatus =
      reservationFilters.status === "all" ||
      reservation.status === reservationFilters.status;

    return matchesDate && matchesStatus;
  });

  // Функции для столиков
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
    try {
      if (
        !window.confirm(
          `Вы уверены, что хотите удалить столик "${table.name}"?`
        )
      ) {
        return;
      }

      await $authHost.delete(`/tables/${table.id}`);
      await loadData();
      setSuccess("Столик успешно удален");
    } catch (error) {
      console.error("Ошибка удаления столика:", error);
      setError("Не удалось удалить столик");
    }
  };

  const handleTableSubmit = async (e) => {
    e.preventDefault();
    try {
      const existingTable = tables.find(
        (table) =>
          table.name.toLowerCase() === tableForm.name.toLowerCase() &&
          table.id !== (editingTable?.id || null)
      );

      if (existingTable) {
        setError(`Столик с именем "${tableForm.name}" уже существует`);
        return;
      }

      if (editingTable) {
        await $authHost.put(`/tables/${editingTable.id}`, tableForm);
        setSuccess("Столик успешно обновлен");
      } else {
        await $authHost.post("/tables", tableForm);
        setSuccess("Столик успешно добавлен");
      }
      setShowTableModal(false);
      await loadData();
    } catch (error) {
      console.error("Ошибка сохранения столика:", error);
      setError(`Не удалось ${editingTable ? "обновить" : "добавить"} столик`);
    }
  };

  // Функции для бронирований
  const handleAddReservation = (table = null) => {
    setSelectedTable(table);
    setEditingReservation(null);
    const now = new Date();
    const from = new Date(now.getTime() + 30 * 60000);
    const to = new Date(from.getTime() + 2 * 60 * 60000);

    setReservationForm({
      customerName: "",
      customerPhone: "",
      guestCount: table ? Math.min(table.capacity, 2) : 2,
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
      setSuccess("Бронирование успешно удалено");
    } catch (error) {
      console.error("Ошибка удаления бронирования:", error);
      setError("Не удалось удалить бронирование");
    }
  };

  const checkTableAvailability = async (
    tableId,
    reservedFrom,
    reservedTo,
    excludeReservationId = null
  ) => {
    try {
      const params = {
        tableId,
        reservedFrom: fromLocalToUTC(reservedFrom),
        reservedTo: fromLocalToUTC(reservedTo),
      };

      if (excludeReservationId) {
        params.excludeReservationId = excludeReservationId;
      }

      const response = await $authHost.get("/reservations/available", {
        params: params,
      });
      return response.data.available;
    } catch (error) {
      console.error("Ошибка проверки доступности:", error);
      return false;
    }
  };

  const handleReservationSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!selectedTable) {
        setError("Выберите столик для бронирования");
        return;
      }

      const isAvailable = await checkTableAvailability(
        selectedTable.id,
        reservationForm.reservedFrom,
        reservationForm.reservedTo,
        editingReservation?.id
      );

      if (!isAvailable) {
        setError("Столик уже занят на выбранное время");
        return;
      }

      const submitData = {
        ...reservationForm,
        tableId: selectedTable.id,
        reservedFrom: fromLocalToUTC(reservationForm.reservedFrom),
        reservedTo: fromLocalToUTC(reservationForm.reservedTo),
      };

      if (editingReservation) {
        await $authHost.put(
          `/reservations/${editingReservation.id}`,
          submitData
        );
        setSuccess("Бронирование успешно обновлено");
      } else {
        await $authHost.post("/reservations", submitData);
        setSuccess("Бронирование успешно создано");
      }
      setShowReservationModal(false);
      await loadData();
    } catch (error) {
      console.error("Ошибка сохранения бронирования:", error);
      setError("Не удалось сохранить бронирование");
    }
  };

  // Функции для заказов
  const handleViewOrder = (order) => {
    const table = tables.find((t) => t.id === order.tableId);
    if (table) {
      setSelectedOrder(order);
      setSelectedTable(table);

      // Преобразуем данные для отображения
      const transformedItems = (order.items || []).map((item) => ({
        ...item,
        price: getItemPrice(item),
        dish: item.dish || { name: getItemName(item) },
      }));

      setOrderForm({
        waiterId: order.waiterId || "",
        status: order.status,
        items: transformedItems,
      });
      setShowOrderModal(true);
    }
  };

  const handleCreateOrder = (table) => {
    if (!canCreateOrder(table.id)) {
      setError("На столике уже есть активный заказ");
      return;
    }

    setSelectedOrder(null);
    setSelectedTable(table);
    setOrderForm({
      waiterId: "",
      status: "open",
      items: [],
    });
    setNewOrderItem({
      dishId: "",
      quantity: 1,
      notes: "",
    });
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
      status: "ordered",
      price: selectedDish.price,
      itemPrice: selectedDish.price,
    };

    setOrderForm((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));

    setNewOrderItem({
      dishId: "",
      quantity: 1,
      notes: "",
    });
  };

  const handleRemoveOrderItem = (index) => {
    setOrderForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Функция сохранения заказа
  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!orderForm.waiterId) {
        setError("Выберите официанта");
        return;
      }

      if (orderForm.items.length === 0) {
        setError("Добавьте хотя бы одно блюдо в заказ");
        return;
      }

      const orderData = {
        tableId: selectedTable.id,
        waiterId: parseInt(orderForm.waiterId),
        status: orderForm.status,
        items: orderForm.items.map((item) => ({
          dishId: item.dishId,
          quantity: item.quantity,
          notes: item.notes,
          price: item.price,
        })),
      };

      console.log("Отправка заказа:", orderData);

      if (selectedOrder) {
        await $authHost.put(`/orders/${selectedOrder.id}`, orderData);
        setSuccess("Заказ успешно обновлен");
      } else {
        await $authHost.post("/orders", orderData);
        setSuccess("Заказ успешно создан");
      }

      setShowOrderModal(false);
      await loadData();
    } catch (error) {
      console.error("Ошибка сохранения заказа:", error);
      console.error("Детали ошибки:", error.response?.data);
      setError(
        `Не удалось ${selectedOrder ? "обновить" : "создать"} заказ: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  };

  const handleOrderStatusChange = async (orderId, newStatus) => {
    try {
      await $authHost.put(`/orders/${orderId}/status`, { status: newStatus });
      setSuccess("Статус заказа обновлен");
      await loadData();
    } catch (error) {
      console.error("Ошибка изменения статуса заказа:", error);
      setError("Не удалось изменить статус заказа");
    }
  };

  // Функция закрытия заказа
  const handleCloseOrder = async (orderId) => {
    try {
      await $authHost.put(`/orders/${orderId}/close`);
      setSuccess("Заказ успешно закрыт");
      await loadData();
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

  // Функция для принудительного закрытия заказа
  const handleForceCloseOrder = async (orderId) => {
    try {
      if (
        window.confirm(
          "Вы уверены, что хотите принудительно закрыть заказ? Все неподанные блюда будут отмечены как поданные."
        )
      ) {
        await $authHost.put(`/orders/${orderId}/close`, { force: true });
        setSuccess("Заказ принудительно закрыт");
        await loadData();
      }
    } catch (error) {
      console.error("Ошибка принудительного закрытия заказа:", error);
      setError("Не удалось закрыть заказ");
    }
  };

  // Вспомогательные функции для отображения
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

  const getOrderStatusColor = (status) => {
    switch (status) {
      case "open":
        return "primary";
      case "in_progress":
        return "warning";
      case "ready":
        return "success";
      case "payment": // ДОБАВЛЕНО
        return "info";
      case "closed":
        return "secondary";
      default:
        return "light";
    }
  };

  const getOrderStatusText = (status) => {
    const translations = {
      open: "Открыт",
      in_progress: "В работе",
      ready: "Готов",
      payment: "Ожидание оплаты", // ДОБАВЛЕНО
      closed: "Закрыт",
    };
    return translations[status] || status;
  };

  const getReservationStatusText = (status) => {
    const translations = {
      confirmed: "Подтверждено",
      seated: "Гости за столом",
      cancelled: "Отменено",
      completed: "Завершено",
    };
    return translations[status] || status;
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

  const getWaiterInfo = (tableId) => {
    const tableOrders = getTableOrders(tableId);
    if (tableOrders.length > 0) {
      const order = tableOrders[0];
      if (order.waiter) {
        return `${order.waiter.firstName} ${order.waiter.lastName}`;
      }
      if (order.waiterId) {
        const waiter = waiters.find((w) => w.id === order.waiterId);
        if (waiter) {
          return `${waiter.firstName} ${waiter.lastName}`;
        }
      }
    }
    return null;
  };

  // Статистика
  const getStatistics = () => {
    const totalTables = tables.length;
    const occupiedTables = tables.filter(
      (t) => getTableStatus(t) === "occupied"
    ).length;
    const reservedTables = tables.filter(
      (t) => getTableStatus(t) === "reserved"
    ).length;
    const freeTables = tables.filter(
      (t) => getTableStatus(t) === "free"
    ).length;
    const activeOrdersCount = orders.length;
    const paymentOrdersCount = orders.filter(
      (order) => order.status === "payment"
    ).length;

    return {
      totalTables,
      occupiedTables,
      reservedTables,
      freeTables,
      activeOrdersCount,
      paymentOrdersCount,
    };
  };

  const statistics = getStatistics();

  const tabs = [
    { id: "tables", label: "Схема зала", icon: "bi-grid-3x3-gap" },
    { id: "orders", label: "Заказы", icon: "bi-cart" },
    { id: "reservations", label: "Бронирования", icon: "bi-calendar-event" },
  ];

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
                          Управление столиками и заказами
                        </h1>
                        <p className="text-muted mb-0">
                          Всего столиков: {statistics.totalTables} | Занято:{" "}
                          {statistics.occupiedTables} | Забронировано:{" "}
                          {statistics.reservedTables} | Свободно:{" "}
                          {statistics.freeTables} | Активных заказов:{" "}
                          {statistics.activeOrdersCount} | Ожидают оплаты:{" "}
                          {statistics.paymentOrdersCount}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 text-end">
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
          <div className="row mb-3">
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

        {success && (
          <div className="row mb-3">
            <div className="col-12">
              <div className="alert alert-success alert-dismissible fade show">
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

        {/* Табы */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-white p-0">
                <ul className="nav nav-tabs card-header-tabs">
                  {tabs.map((tab) => (
                    <li key={tab.id} className="nav-item">
                      <button
                        className={`nav-link ${
                          activeTab === tab.id ? "active" : ""
                        }`}
                        onClick={() => setActiveTab(tab.id)}
                      >
                        <i className={`bi ${tab.icon} me-2`}></i>
                        {tab.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card-body">
                {/* Вкладка Столики */}
                {activeTab === "tables" && (
                  <div>
                    <div className="row mb-4">
                      <div className="col-md-4">
                        <label className="form-label">Статус столика</label>
                        <select
                          className="form-select"
                          value={tableFilters.status}
                          onChange={(e) =>
                            setTableFilters((prev) => ({
                              ...prev,
                              status: e.target.value,
                            }))
                          }
                        >
                          <option value="all">Все статусы</option>
                          <option value="free">Свободен</option>
                          <option value="reserved">Забронирован</option>
                          <option value="occupied">Занят</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Вместимость</label>
                        <select
                          className="form-select"
                          value={tableFilters.capacity}
                          onChange={(e) =>
                            setTableFilters((prev) => ({
                              ...prev,
                              capacity: e.target.value,
                            }))
                          }
                        >
                          <option value="all">Любая</option>
                          <option value="2">2+ человек</option>
                          <option value="4">4+ человек</option>
                          <option value="6">6+ человек</option>
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Поиск</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Название столика..."
                          value={tableFilters.search}
                          onChange={(e) =>
                            setTableFilters((prev) => ({
                              ...prev,
                              search: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="row g-3">
                      {filteredTables.map((table) => {
                        const status = getTableStatus(table);
                        const activeOrder = getActiveOrder(table.id);
                        const canCreateNewOrder = canCreateOrder(table.id);
                        const waiterInfo = getWaiterInfo(table.id);

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
                                          : status === "reserved_soon"
                                          ? "bi-clock-history"
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

                                {activeOrder && (
                                  <div className="mb-3 p-2 bg-light rounded">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                      <small className="text-muted">
                                        Активный заказ:
                                      </small>
                                      <span
                                        className={`badge bg-${getOrderStatusColor(
                                          activeOrder.status
                                        )}`}
                                      >
                                        {getOrderStatusText(activeOrder.status)}
                                      </span>
                                    </div>
                                    {waiterInfo && (
                                      <div className="small">
                                        <strong>Официант:</strong> {waiterInfo}
                                      </div>
                                    )}
                                    <div className="small">
                                      <strong>Сумма:</strong>{" "}
                                      {calculateOrderTotal(
                                        activeOrder.items || []
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="card-footer bg-transparent">
                                <div className="btn-group w-100">
                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={() => handleEditTable(table)}
                                  >
                                    <i className="bi bi-pencil"></i>
                                  </button>
                                  {activeOrder ? (
                                    <button
                                      className="btn btn-outline-info btn-sm"
                                      onClick={() =>
                                        handleViewOrder(activeOrder)
                                      }
                                    >
                                      <i className="bi bi-eye"></i>
                                    </button>
                                  ) : (
                                    <button
                                      className="btn btn-outline-success btn-sm"
                                      onClick={() => handleCreateOrder(table)}
                                      disabled={!canCreateNewOrder}
                                    >
                                      <i className="bi bi-plus-circle"></i>
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-outline-warning btn-sm"
                                    onClick={() => handleAddReservation(table)}
                                    disabled={status === "occupied"}
                                  >
                                    <i className="bi bi-calendar-plus"></i>
                                  </button>
                                  <button
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => handleDeleteTable(table)}
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

                    {filteredTables.length === 0 && (
                      <div className="text-center py-5">
                        <i className="bi bi-table display-1 text-muted"></i>
                        <h5 className="mt-3">Столики не найдены</h5>
                        <p className="text-muted">
                          Попробуйте изменить параметры фильтрации
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Вкладка Заказы */}
                {activeTab === "orders" && (
                  <div>
                    <div className="row mb-4">
                      <div className="col-md-6">
                        <label className="form-label">Статус заказа</label>
                        <select
                          className="form-select"
                          value={orderFilters.status}
                          onChange={(e) =>
                            setOrderFilters((prev) => ({
                              ...prev,
                              status: e.target.value,
                            }))
                          }
                        >
                          <option value="all">Все статусы</option>
                          <option value="open">Открыт</option>
                          <option value="in_progress">В работе</option>
                          <option value="ready">Готов</option>
                          <option value="payment">Ожидание оплаты</option>
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Поиск</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="ID заказа или столик..."
                          value={orderFilters.search}
                          onChange={(e) =>
                            setOrderFilters((prev) => ({
                              ...prev,
                              search: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead className="table-light">
                          <tr>
                            <th>ID заказа</th>
                            <th>Столик</th>
                            <th>Официант</th>
                            <th>Статус</th>
                            <th>Количество блюд</th>
                            <th>Сумма</th>
                            <th>Создан</th>
                            <th width="180">Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOrders.map((order) => {
                            const table = tables.find(
                              (t) => t.id === order.tableId
                            );
                            const waiter = waiters.find(
                              (w) => w.id === order.waiterId
                            );
                            const totalAmount = calculateOrderTotal(
                              order.items || []
                            );

                            return (
                              <tr key={order.id}>
                                <td>
                                  <strong>#{order.id}</strong>
                                </td>
                                <td>
                                  {table ? (
                                    <span className="badge bg-secondary">
                                      {table.name}
                                    </span>
                                  ) : (
                                    <span className="text-muted">
                                      Не найден
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {waiter ? (
                                    <span>
                                      {waiter.firstName} {waiter.lastName}
                                    </span>
                                  ) : (
                                    <span className="text-muted">
                                      Не назначен
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <span
                                    className={`badge bg-${getOrderStatusColor(
                                      order.status
                                    )}`}
                                  >
                                    {getOrderStatusText(order.status)}
                                  </span>
                                </td>
                                <td>
                                  <span className="badge bg-info">
                                    {order.items?.length || 0}
                                  </span>
                                </td>
                                <td>
                                  <strong>{totalAmount}</strong>
                                </td>
                                <td>
                                  <small className="text-muted">
                                    {formatDateTime(order.createdAt)}
                                  </small>
                                </td>
                                <td>
                                  <div className="btn-group">
                                    <button
                                      className="btn btn-outline-primary btn-sm"
                                      onClick={() => handleViewOrder(order)}
                                      title="Просмотреть заказ"
                                    >
                                      <i className="bi bi-eye"></i>
                                    </button>

                                    {/* Для заказов в статусе payment - только кнопка закрытия */}
                                    {order.status === "payment" && (
                                      <button
                                        className="btn btn-outline-success btn-sm"
                                        onClick={() =>
                                          handleCloseOrder(order.id)
                                        }
                                        title="Закрыть заказ после оплаты"
                                      >
                                        <i className="bi bi-check-circle"></i>{" "}
                                        Закрыть
                                      </button>
                                    )}

                                    {/* Для других статусов - обычные кнопки */}
                                    {order.status !== "payment" && (
                                      <>
                                        {order.status === "open" && (
                                          <button
                                            className="btn btn-outline-warning btn-sm"
                                            onClick={() =>
                                              handleOrderStatusChange(
                                                order.id,
                                                "in_progress"
                                              )
                                            }
                                            title="Начать приготовление"
                                          >
                                            <i className="bi bi-play-circle"></i>
                                          </button>
                                        )}
                                        {order.status === "in_progress" && (
                                          <button
                                            className="btn btn-outline-success btn-sm"
                                            onClick={() =>
                                              handleOrderStatusChange(
                                                order.id,
                                                "ready"
                                              )
                                            }
                                            title="Отметить готовым"
                                          >
                                            <i className="bi bi-check-circle"></i>
                                          </button>
                                        )}
                                        {order.status === "ready" && (
                                          <>
                                            <button
                                              className="btn btn-outline-secondary btn-sm"
                                              onClick={() =>
                                                handleCloseOrder(order.id)
                                              }
                                              title="Закрыть заказ"
                                            >
                                              <i className="bi bi-x-circle"></i>
                                            </button>
                                            <button
                                              className="btn btn-outline-danger btn-sm"
                                              onClick={() =>
                                                handleForceCloseOrder(order.id)
                                              }
                                              title="Принудительно закрыть заказ"
                                            >
                                              <i className="bi bi-exclamation-circle"></i>
                                            </button>
                                          </>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {filteredOrders.length === 0 && (
                      <div className="text-center py-5">
                        <i className="bi bi-cart display-1 text-muted"></i>
                        <h5 className="mt-3">Заказы не найдены</h5>
                        <p className="text-muted">
                          Нет активных заказов по выбранным фильтрам
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Вкладка Бронирования */}
                {activeTab === "reservations" && (
                  <div>
                    <div className="row mb-4">
                      <div className="col-md-6">
                        <label className="form-label">Дата</label>
                        <input
                          type="date"
                          className="form-control"
                          value={reservationFilters.date}
                          onChange={(e) =>
                            setReservationFilters((prev) => ({
                              ...prev,
                              date: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Статус</label>
                        <select
                          className="form-select"
                          value={reservationFilters.status}
                          onChange={(e) =>
                            setReservationFilters((prev) => ({
                              ...prev,
                              status: e.target.value,
                            }))
                          }
                        >
                          <option value="all">Все статусы</option>
                          <option value="confirmed">Подтверждено</option>
                          <option value="seated">Гости за столом</option>
                          <option value="completed">Завершено</option>
                        </select>
                      </div>
                    </div>

                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="mb-0">
                        Бронирования на {reservationFilters.date}
                      </h6>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleAddReservation()}
                      >
                        <i className="bi bi-plus-circle me-1"></i>
                        Добавить бронирование
                      </button>
                    </div>

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
                          {filteredReservations.map((reservation) => {
                            const table = tables.find(
                              (t) => t.id === reservation.tableId
                            );
                            return (
                              <tr key={reservation.id}>
                                <td>
                                  <strong>
                                    {table?.name ||
                                      `Столик #${reservation.tableId}`}
                                  </strong>
                                  {table && (
                                    <div className="small text-muted">
                                      Вместимость: {table.capacity} чел.
                                    </div>
                                  )}
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
                                        : reservation.status === "completed"
                                        ? "bg-secondary"
                                        : "bg-light text-dark"
                                    }`}
                                  >
                                    {getReservationStatusText(
                                      reservation.status
                                    )}
                                  </span>
                                </td>
                                <td>
                                  <div className="btn-group">
                                    <button
                                      className="btn btn-outline-primary btn-sm"
                                      onClick={() =>
                                        handleEditReservation(reservation)
                                      }
                                    >
                                      <i className="bi bi-pencil"></i>
                                    </button>
                                    <button
                                      className="btn btn-outline-danger btn-sm"
                                      onClick={() =>
                                        handleDeleteReservation(reservation)
                                      }
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

                    {filteredReservations.length === 0 && (
                      <div className="text-center py-5">
                        <i className="bi bi-calendar-x display-1 text-muted"></i>
                        <h5 className="mt-3">Бронирования не найдены</h5>
                        <p className="text-muted">
                          Нет бронирований на выбранную дату
                        </p>
                      </div>
                    )}
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
                          value={tableForm.name}
                          onChange={(e) =>
                            setTableForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Вместимость *</label>
                        <select
                          className="form-select"
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
        {showReservationModal && (
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
                        <label className="form-label">Столик *</label>
                        <select
                          className="form-select"
                          value={selectedTable?.id || ""}
                          onChange={(e) => {
                            const table = tables.find(
                              (t) => t.id === parseInt(e.target.value)
                            );
                            setSelectedTable(table);
                            if (table) {
                              setReservationForm((prev) => ({
                                ...prev,
                                guestCount: Math.min(
                                  prev.guestCount,
                                  table.capacity
                                ),
                              }));
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
                          value={reservationForm.guestCount}
                          onChange={(e) =>
                            setReservationForm((prev) => ({
                              ...prev,
                              guestCount: parseInt(e.target.value),
                            }))
                          }
                          required
                        >
                          {selectedTable &&
                            Array.from(
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
                          value={reservationForm.status}
                          onChange={(e) =>
                            setReservationForm((prev) => ({
                              ...prev,
                              status: e.target.value,
                            }))
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

        {/* Модальное окно заказа */}
        {showOrderModal && selectedTable && (
          <div
            className="modal show d-block"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {selectedOrder
                      ? `Заказ для столика "${selectedTable.name}"`
                      : `Новый заказ для столика "${selectedTable.name}"`}
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
                      <div className="col-md-6">
                        <label className="form-label">Официант *</label>
                        <select
                          className="form-select"
                          value={orderForm.waiterId}
                          onChange={(e) =>
                            setOrderForm((prev) => ({
                              ...prev,
                              waiterId: e.target.value,
                            }))
                          }
                          required
                        >
                          <option value="">Выберите официанта</option>
                          {waiters.map((waiter) => (
                            <option key={waiter.id} value={waiter.id}>
                              {waiter.firstName} {waiter.lastName} (
                              {waiter.role === "admin" ? "Админ" : "Официант"})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Статус заказа</label>
                        <select
                          className="form-select"
                          value={orderForm.status}
                          onChange={(e) =>
                            setOrderForm((prev) => ({
                              ...prev,
                              status: e.target.value,
                            }))
                          }
                        >
                          <option value="open">Открыт</option>
                          <option value="in_progress">В работе</option>
                          <option value="ready">Готов</option>
                        </select>
                      </div>

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
                                    setNewOrderItem((prev) => ({
                                      ...prev,
                                      dishId: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Выберите блюдо</option>
                                  {dishes.map((dish) => (
                                    <option key={dish.id} value={dish.id}>
                                      {dish.name} - {dish.price}
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
                                    setNewOrderItem((prev) => ({
                                      ...prev,
                                      quantity: parseInt(e.target.value),
                                    }))
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
                                    setNewOrderItem((prev) => ({
                                      ...prev,
                                      notes: e.target.value,
                                    }))
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
                                Итого: {calculateOrderTotal(orderForm.items)}
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
                                      <tr key={item.id || index}>
                                        <td>{getItemName(item)}</td>
                                        <td>{getItemPrice(item)}</td>
                                        <td>{item.quantity || 0}</td>
                                        <td>
                                          {getItemPrice(item) *
                                            (item.quantity || 0)}
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
                                          {calculateOrderTotal(orderForm.items)}
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
                      {selectedOrder ? "Обновить заказ" : "Создать заказ"}
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
