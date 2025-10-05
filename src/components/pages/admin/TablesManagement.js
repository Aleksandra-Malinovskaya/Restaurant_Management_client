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
  const [success, setSuccess] = useState("");
  const [showTableModal, setShowTableModal] = useState(false);
  const [showReservationModal, setShowReservationModal] = useState(false);
  const [editingTable, setEditingTable] = useState(null);
  const [editingReservation, setEditingReservation] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [view, setView] = useState("grid");
  const [currentDate, setCurrentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [deleteCheck, setDeleteCheck] = useState({
    open: false,
    table: null,
    conflicts: null,
  });

  // Фильтры
  const [filters, setFilters] = useState({
    status: "all",
    capacity: "all",
    search: "",
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

  // Функция для преобразования времени с учетом часового пояса (для отображения)
  const toLocalISOString = (date) => {
    if (!date) return "";
    const localDate = new Date(date);
    const timezoneOffset = localDate.getTimezoneOffset() * 60000;
    return new Date(localDate.getTime() - timezoneOffset)
      .toISOString()
      .slice(0, 16);
  };

  // Функция для преобразования времени из UTC в локальное (для отображения)
  const fromUTCToLocal = (utcDate) => {
    if (!utcDate) return null;
    const date = new Date(utcDate);
    return date;
  };

  // Функция для преобразования времени из локального в UTC (для отправки на сервер)
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

        // Загружаем данные последовательно для лучшей обработки ошибок
        let loadedTables = [];
        let loadedOrders = [];
        let loadedReservations = [];
        let loadedWaiters = [];

        try {
          console.log("Загрузка столиков...");
          const tablesResponse = await $authHost.get("/tables");
          loadedTables = safeArray(extractData(tablesResponse.data));
          console.log(`Загружено столиков: ${loadedTables.length}`);
        } catch (err) {
          console.error("Ошибка загрузки столиков:", err);
          loadedTables = [];
        }

        try {
          console.log("Загрузка заказов...");
          // Разделяем запросы по статусам для избежания ошибок
          const openOrdersResponse = await $authHost.get("/orders?status=open");
          const inProgressOrdersResponse = await $authHost.get(
            "/orders?status=in_progress"
          );
          const readyOrdersResponse = await $authHost.get(
            "/orders?status=ready"
          );

          const openOrders = safeArray(extractData(openOrdersResponse.data));
          const inProgressOrders = safeArray(
            extractData(inProgressOrdersResponse.data)
          );
          const readyOrders = safeArray(extractData(readyOrdersResponse.data));

          loadedOrders = [...openOrders, ...inProgressOrders, ...readyOrders];
          console.log(
            `Загружено заказов: ${loadedOrders.length} (open: ${openOrders.length}, in_progress: ${inProgressOrders.length}, ready: ${readyOrders.length})`
          );
        } catch (err) {
          console.error("Ошибка загрузки заказов:", err);
          // Пробуем загрузить все заказы без фильтрации
          try {
            const allOrdersResponse = await $authHost.get("/orders");
            loadedOrders = safeArray(extractData(allOrdersResponse.data));
            console.log(`Загружено всех заказов: ${loadedOrders.length}`);
          } catch (fallbackErr) {
            console.error("Ошибка загрузки всех заказов:", fallbackErr);
            loadedOrders = [];
          }
        }

        try {
          console.log("Загрузка бронирований...");
          const reservationsResponse = await $authHost.get("/reservations");
          loadedReservations = safeArray(
            extractData(reservationsResponse.data)
          );
          console.log(`Загружено бронирований: ${loadedReservations.length}`);
        } catch (err) {
          console.error("Ошибка загрузки бронирований:", err);
          loadedReservations = [];
        }

        try {
          console.log("Загрузка официантов...");
          const usersResponse = await $authHost.get("/users?role=waiter");
          loadedWaiters = safeArray(extractData(usersResponse.data));
          console.log(`Загружено официантов: ${loadedWaiters.length}`);
        } catch (err) {
          console.error("Ошибка загрузки официантов:", err);
          loadedWaiters = [];
        }

        // Устанавливаем состояния
        setTables(loadedTables);
        setOrders(loadedOrders);
        setReservations(loadedReservations);
        setWaiters(loadedWaiters);

        // Проверяем, есть ли вообще данные
        const totalLoaded =
          loadedTables.length + loadedOrders.length + loadedReservations.length;
        if (totalLoaded === 0 && !silent) {
          setError(
            "Не удалось загрузить данные. Проверьте подключение к серверу."
          );
        }

        // Автоматическое обновление статусов завершенных бронирований
        try {
          const hasUpdates = await updateCompletedReservations(
            loadedReservations
          );
          if (hasUpdates) {
            console.log(
              "Обнаружены обновления статусов, перезагружаем данные..."
            );
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

  // Отдельный эффект для периодического обновления статусов
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const hasUpdates = await updateCompletedReservations(reservations);
        if (hasUpdates) {
          console.log(
            "Автоматическое обновление статусов, перезагружаем данные..."
          );
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

  // НОВАЯ ФУНКЦИЯ: Получение бронирований для отфильтрованных столиков
  const getFilteredReservations = () => {
    if (filteredTables.length === 0) {
      return [];
    }

    // Получаем ID всех отфильтрованных столиков
    const filteredTableIds = filteredTables.map((table) => table.id);

    // Фильтруем бронирования по ID столиков и выбранной дате
    return reservations.filter((reservation) => {
      const reservationDate = fromUTCToLocal(reservation.reservedFrom)
        .toISOString()
        .split("T")[0];
      return (
        filteredTableIds.includes(reservation.tableId) &&
        reservationDate === currentDate
      );
    });
  };

  // Улучшенная функция определения статуса столика
  const getTableStatus = (table) => {
    const tableOrders = getTableOrders(table.id);
    const currentReservation = getCurrentReservation(table.id);

    // Если есть активные заказы - столик занят
    if (tableOrders.length > 0) return "occupied";

    // Если гости уже за столом (статус seated) - столик занят
    if (currentReservation && currentReservation.status === "seated")
      return "occupied";

    // Если есть подтвержденное бронирование - забронирован
    if (currentReservation && currentReservation.status === "confirmed")
      return "reserved";

    // Проверяем ближайшие бронирования (в течение 30 минут)
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

  // Фильтрация столиков
  const filteredTables = tables.filter((table) => {
    const status = getTableStatus(table);
    const matchesStatus = filters.status === "all" || status === filters.status;
    const matchesCapacity =
      filters.capacity === "all" ||
      table.capacity >= parseInt(filters.capacity);
    const matchesSearch =
      filters.search === "" ||
      table.name.toLowerCase().includes(filters.search.toLowerCase());

    return matchesStatus && matchesCapacity && matchesSearch;
  });

  // Фильтрация бронирований для отфильтрованных столиков
  const filteredReservations = getFilteredReservations();

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

  // Проверка конфликтов при удалении столика
  const checkTableConflicts = async (tableId) => {
    const now = new Date();

    // Проверяем активные заказы
    const activeOrders = orders.filter(
      (order) =>
        order.tableId === tableId &&
        ["open", "in_progress", "ready"].includes(order.status)
    );

    // Проверяем будущие бронирования
    const futureReservations = reservations.filter(
      (reservation) =>
        reservation.tableId === tableId &&
        fromUTCToLocal(reservation.reservedFrom) > now &&
        ["confirmed", "seated"].includes(reservation.status)
    );

    return {
      hasConflicts: activeOrders.length > 0 || futureReservations.length > 0,
      activeOrders,
      futureReservations,
    };
  };

  const handleDeleteTable = async (table) => {
    try {
      // Проверяем конфликты перед удалением
      const conflicts = await checkTableConflicts(table.id);

      if (conflicts.hasConflicts) {
        setDeleteCheck({ open: true, table, conflicts });
        return;
      }

      if (
        !window.confirm(
          `Вы уверены, что хотите удалить столик "${table.name}"?`
        )
      ) {
        return;
      }

      await $authHost.delete(`/tables/${table.id}`);
      await loadData();
      setError("");
      setSuccess("Столик успешно удален");
    } catch (error) {
      console.error("Ошибка удаления столика:", error);
      setError("Не удалось удалить столик");
    }
  };

  // Удаление столика вместе с бронированиями
  const confirmDeleteTable = async (tableId) => {
    try {
      // Сначала удаляем все бронирования этого столика
      const tableReservations = reservations.filter(
        (r) => r.tableId === tableId
      );

      for (const reservation of tableReservations) {
        try {
          await $authHost.delete(`/reservations/${reservation.id}`);
          console.log(
            `Удалено бронирование ${reservation.id} для столика ${tableId}`
          );
        } catch (error) {
          console.error(
            `Ошибка удаления бронирования ${reservation.id}:`,
            error
          );
        }
      }

      // Затем удаляем сам столик
      await $authHost.delete(`/tables/${tableId}`);
      setDeleteCheck({ open: false, table: null, conflicts: null });
      await loadData();
      setError("");
      setSuccess("Столик и связанные бронирования успешно удалены");
    } catch (error) {
      console.error("Ошибка удаления столика:", error);
      setError("Не удалось удалить столик");
    }
  };

  const handleTableSubmit = async (e) => {
    e.preventDefault();
    try {
      // Проверяем уникальность имени столика
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
      setError("");
    } catch (error) {
      console.error("Ошибка сохранения столика:", error);
      if (error.response?.data?.message?.includes("unique")) {
        setError(`Столик с именем "${tableForm.name}" уже существует`);
      } else {
        setError(`Не удалось ${editingTable ? "обновить" : "добавить"} столик`);
      }
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
      setError("");
      setSuccess("Бронирование успешно удалено");
    } catch (error) {
      console.error("Ошибка удаления бронирования:", error);
      setError("Не удалось удалить бронирование");
    }
  };

  // Проверка доступности столика для бронирования через API
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

      // Добавляем excludeReservationId только если он указан
      if (excludeReservationId) {
        params.excludeReservationId = excludeReservationId;
      }

      console.log("Checking availability with params:", params);

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
      // Используем API для проверки доступности
      const isAvailable = await checkTableAvailability(
        selectedTable.id,
        reservationForm.reservedFrom,
        reservationForm.reservedTo,
        editingReservation?.id // ← ПЕРЕДАЕМ ID ТЕКУЩЕГО БРОНИРОВАНИЯ
      );

      if (!isAvailable) {
        setError(
          "Столик уже занят на выбранное время. Выберите другое время или столик."
        );
        return;
      }

      const submitData = {
        ...reservationForm,
        tableId: selectedTable.id,
        reservedFrom: fromLocalToUTC(reservationForm.reservedFrom),
        reservedTo: fromLocalToUTC(reservationForm.reservedTo),
      };

      console.log("Отправка данных бронирования:", submitData);

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
      setError("");
    } catch (error) {
      console.error("Ошибка сохранения бронирования:", error);
      const errorMessage = error.response?.data?.message || error.message;

      if (
        errorMessage.includes("Столик занят") ||
        errorMessage.includes("занят")
      ) {
        setError(
          "Столик уже занят на выбранное время. Выберите другое время или столик."
        );
      } else if (
        errorMessage.includes("вместимость") ||
        errorMessage.includes("capacity")
      ) {
        setError("Превышена вместимость столика");
      } else {
        setError(
          `Не удалось ${
            editingReservation ? "обновить" : "добавить"
          } бронирование: ${errorMessage}`
        );
      }
    }
  };

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

  // Исправленная функция форматирования времени для отображения
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

  // Функция для получения информации об официанте
  const getWaiterInfo = (tableId) => {
    const tableOrders = getTableOrders(tableId);
    if (tableOrders.length > 0) {
      const order = tableOrders[0];
      if (order.waiter) {
        return `${order.waiter.firstName} ${order.waiter.lastName}`;
      }
      // Если в данных заказа нет информации об официанте, ищем среди загруженных официантов
      if (order.waiterId) {
        const waiter = waiters.find((w) => w.id === order.waiterId);
        if (waiter) {
          return `${waiter.firstName} ${waiter.lastName}`;
        }
      }
    }
    return null;
  };

  // Функция для получения перевода статуса бронирования
  const getReservationStatusText = (status) => {
    const translations = {
      confirmed: "Подтверждено",
      seated: "Гости за столом",
      cancelled: "Отменено",
      completed: "Завершено",
    };
    return translations[status] || status;
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

    return {
      totalTables,
      occupiedTables,
      reservedTables,
      freeTables,
      activeOrdersCount,
    };
  };

  const statistics = getStatistics();

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
                          Всего столиков: {statistics.totalTables} | Занято:{" "}
                          {statistics.occupiedTables} | Забронировано:{" "}
                          {statistics.reservedTables} | Свободно:{" "}
                          {statistics.freeTables}
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

        {/* Статистика */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="row text-center">
                  <div className="col-md-2">
                    <div className="border rounded p-3">
                      <h4 className="text-primary">{statistics.totalTables}</h4>
                      <small className="text-muted">Всего столиков</small>
                      {filteredTables.length !== tables.length && (
                        <div className="small text-info mt-1">
                          ↓ {filteredTables.length}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="border rounded p-3">
                      <h4 className="text-danger">
                        {statistics.occupiedTables}
                      </h4>
                      <small className="text-muted">Занято</small>
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="border rounded p-3">
                      <h4 className="text-warning">
                        {statistics.reservedTables}
                      </h4>
                      <small className="text-muted">Забронировано</small>
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="border rounded p-3">
                      <h4 className="text-success">{statistics.freeTables}</h4>
                      <small className="text-muted">Свободно</small>
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="border rounded p-3">
                      <h4 className="text-info">
                        {statistics.activeOrdersCount}
                      </h4>
                      <small className="text-muted">Активных заказов</small>
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="border rounded p-3">
                      <h4 className="text-secondary">
                        {filteredReservations.length}
                      </h4>
                      <small className="text-muted">
                        Бронирований на {currentDate}
                        {filteredTables.length > 0 &&
                          filteredTables.length !== tables.length && (
                            <span className="d-block small text-info">
                              (для отфильтрованных)
                            </span>
                          )}
                      </small>
                    </div>
                  </div>
                </div>

                {/* Информация о фильтрации */}
                {filteredTables.length > 0 &&
                  filteredTables.length !== tables.length && (
                    <div className="row mt-3">
                      <div className="col-12">
                        <div className="alert alert-info py-2">
                          <i className="bi bi-info-circle me-2"></i>
                          <strong>Фильтр активен:</strong> Показано{" "}
                          {filteredTables.length} из {tables.length} столиков.
                          Бронирования отображаются только для выбранных
                          столиков.
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* Фильтры */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="row g-3 align-items-end">
                  <div className="col-md-3">
                    <label className="form-label">Статус столика</label>
                    <select
                      className="form-select"
                      value={filters.status}
                      onChange={(e) =>
                        setFilters((prev) => ({
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
                  <div className="col-md-3">
                    <label className="form-label">Вместимость от</label>
                    <select
                      className="form-select"
                      value={filters.capacity}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          capacity: e.target.value,
                        }))
                      }
                    >
                      <option value="all">Любая</option>
                      <option value="2">2+ человек</option>
                      <option value="4">4+ человек</option>
                      <option value="6">6+ человек</option>
                      <option value="8">8+ человек</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Поиск по названию</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Введите название столика..."
                      value={filters.search}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          search: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Дата для бронирований</label>
                    <input
                      type="date"
                      className="form-control"
                      value={currentDate}
                      onChange={(e) => setCurrentDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="row mt-3">
                  <div className="col-12">
                    <div className="d-flex gap-2">
                      <span className="badge bg-success">Свободен</span>
                      <span className="badge bg-info">Скоро бронь</span>
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
                  <div className="col-md-2">
                    Активных заказов: {orders.length}
                  </div>
                  <div className="col-md-2">
                    Всего бронирований: {reservations.length}
                  </div>
                  <div className="col-md-2">Официантов: {waiters.length}</div>
                  <div className="col-md-3">
                    Отфильтровано: {filteredTables.length}/{tables.length}
                  </div>
                  <div className="col-md-3">
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
                <div className="card-header bg-white d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-grid-3x3-gap me-2"></i>
                    Схема зала
                  </h5>
                  <span className="badge bg-primary">
                    Показано: {filteredTables.length} из {tables.length}
                  </span>
                </div>
                <div className="card-body">
                  {filteredTables.length === 0 ? (
                    <div className="text-center py-5">
                      <i className="bi bi-table display-1 text-muted"></i>
                      <h5 className="mt-3">Столики не найдены</h5>
                      <p className="text-muted">
                        Попробуйте изменить параметры фильтрации
                      </p>
                    </div>
                  ) : (
                    <div className="row g-3">
                      {filteredTables.map((table) => {
                        const status = getTableStatus(table);
                        const tableOrders = getTableOrders(table.id);
                        const tableReservations = getTableReservations(
                          table.id
                        );
                        const currentReservation = getCurrentReservation(
                          table.id
                        );
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

                                {/* Информация об официанте для занятых столиков */}
                                {status === "occupied" && waiterInfo && (
                                  <div className="mb-2 p-2 bg-light rounded">
                                    <small className="text-muted">
                                      Обслуживает:
                                    </small>
                                    <div className="small fw-bold">
                                      {waiterInfo}
                                    </div>
                                  </div>
                                )}

                                {/* Активные заказы */}
                                {tableOrders.length > 0 && (
                                  <div className="mb-2">
                                    <small className="text-muted">
                                      Активные заказы: {tableOrders.length}
                                    </small>
                                    {tableOrders.slice(0, 2).map((order) => (
                                      <div key={order.id} className="small">
                                        <strong>Заказ #{order.id}</strong>
                                        <span className="text-muted">
                                          {" "}
                                          - {order.status}
                                        </span>
                                      </div>
                                    ))}
                                    {tableOrders.length > 2 && (
                                      <small className="text-muted">
                                        ...и еще {tableOrders.length - 2}
                                      </small>
                                    )}
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
                                        -{" "}
                                        {formatTime(
                                          currentReservation.reservedTo
                                        )}
                                      </div>
                                      <div
                                        className={`badge bg-${
                                          currentReservation.status === "seated"
                                            ? "success"
                                            : "warning"
                                        }`}
                                      >
                                        {getReservationStatusText(
                                          currentReservation.status
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
                                      Будущие бронирования:{" "}
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
                                    disabled={status === "occupied"}
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
                  )}
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
                <div className="card-header bg-white d-flex justify-content-between align-items-center">
                  <h5 className="card-title mb-0">
                    <i className="bi bi-list me-2"></i>
                    Список столиков
                  </h5>
                  <span className="badge bg-primary">
                    Показано: {filteredTables.length} из {tables.length}
                  </span>
                </div>
                <div className="card-body">
                  {filteredTables.length === 0 ? (
                    <div className="text-center py-5">
                      <i className="bi bi-table display-1 text-muted"></i>
                      <h5 className="mt-3">Столики не найдены</h5>
                      <p className="text-muted">
                        Попробуйте изменить параметры фильтрации
                      </p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover">
                        <thead className="table-light">
                          <tr>
                            <th>Столик</th>
                            <th>Вместимость</th>
                            <th>Статус</th>
                            <th>Официант</th>
                            <th>Активные заказы</th>
                            <th>Текущее бронирование</th>
                            <th>Будущие бронирования</th>
                            <th width="120">Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTables.map((table) => {
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
                            const waiterInfo = getWaiterInfo(table.id);

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
                                  {waiterInfo ? (
                                    <span className="small">{waiterInfo}</span>
                                  ) : (
                                    <span className="text-muted">-</span>
                                  )}
                                </td>
                                <td>
                                  {tableOrders.length > 0 ? (
                                    <div>
                                      <span className="badge bg-info">
                                        {tableOrders.length}
                                      </span>
                                      {tableOrders.slice(0, 2).map((order) => (
                                        <div key={order.id} className="small">
                                          #{order.id} ({order.status})
                                        </div>
                                      ))}
                                    </div>
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
                                        -{" "}
                                        {formatTime(
                                          currentReservation.reservedTo
                                        )}
                                      </div>
                                      <span
                                        className={`badge bg-${
                                          currentReservation.status === "seated"
                                            ? "success"
                                            : "warning"
                                        }`}
                                      >
                                        {getReservationStatusText(
                                          currentReservation.status
                                        )}
                                      </span>
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
                                      onClick={() =>
                                        handleAddReservation(table)
                                      }
                                      title="Добавить бронирование"
                                      disabled={status === "occupied"}
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
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Список бронирований на выбранную дату ДЛЯ ОТФИЛЬТРОВАННЫХ СТОЛИКОВ */}
        <div className="row mt-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                  <i className="bi bi-calendar-event me-2"></i>
                  Бронирования на {currentDate}
                  {filteredTables.length > 0 &&
                    filteredTables.length !== tables.length && (
                      <span className="badge bg-info ms-2">
                        Только для отфильтрованных столиков
                      </span>
                    )}
                </h5>
                <div>
                  <span className="badge bg-primary me-2">
                    Отфильтровано столиков: {filteredTables.length}
                  </span>
                  <span className="badge bg-secondary">
                    Бронирований: {filteredReservations.length}
                  </span>
                </div>
              </div>
              <div className="card-body">
                {filteredTables.length === 0 ? (
                  <div className="text-center py-4 text-muted">
                    <i className="bi bi-funnel display-4"></i>
                    <h5 className="mt-3">Нет отфильтрованных столиков</h5>
                    <p>
                      Измените параметры фильтрации чтобы увидеть бронирования
                    </p>
                  </div>
                ) : filteredReservations.length === 0 ? (
                  <div className="text-center py-3 text-muted">
                    <i className="bi bi-calendar-x display-4"></i>
                    <h5 className="mt-3">Нет бронирований</h5>
                    <p>
                      На выбранную дату нет бронирований для отфильтрованных
                      столиков
                    </p>
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
                                      : reservation.status === "cancelled"
                                      ? "bg-danger"
                                      : reservation.status === "completed"
                                      ? "bg-secondary"
                                      : "bg-light text-dark"
                                  }`}
                                >
                                  {getReservationStatusText(reservation.status)}
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
                          );
                        })}
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
                          <option value="seated">Гости за столом</option>
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

        {/* Модальное окно подтверждения удаления с конфликтами */}
        {deleteCheck.open && (
          <div
            className="modal show d-block"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title text-danger">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    Невозможно удалить столик
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() =>
                      setDeleteCheck({
                        open: false,
                        table: null,
                        conflicts: null,
                      })
                    }
                  ></button>
                </div>
                <div className="modal-body">
                  <p>
                    На столике "<strong>{deleteCheck.table?.name}</strong>" есть
                    активные элементы:
                  </p>

                  {deleteCheck.conflicts?.activeOrders.length > 0 && (
                    <div className="mb-3">
                      <h6 className="text-danger">Активные заказы:</h6>
                      <ul className="list-group">
                        {deleteCheck.conflicts.activeOrders.map((order) => (
                          <li key={order.id} className="list-group-item">
                            Заказ #{order.id} - {order.status}
                            {order.waiter && (
                              <span className="text-muted">
                                {" "}
                                (обслуживает: {order.waiter.firstName})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {deleteCheck.conflicts?.futureReservations.length > 0 && (
                    <div className="mb-3">
                      <h6 className="text-warning">Будущие бронирования:</h6>
                      <ul className="list-group">
                        {deleteCheck.conflicts.futureReservations.map(
                          (reservation) => (
                            <li
                              key={reservation.id}
                              className="list-group-item"
                            >
                              {reservation.customerName} (
                              {reservation.customerPhone})
                              <br />
                              <small className="text-muted">
                                {formatDateTime(reservation.reservedFrom)} -{" "}
                                {formatTime(reservation.reservedTo)}
                              </small>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="alert alert-warning">
                    <i className="bi bi-info-circle me-2"></i>
                    Завершите все активные заказы и удалите будущие бронирования
                    перед удалением столика.
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      setDeleteCheck({
                        open: false,
                        table: null,
                        conflicts: null,
                      })
                    }
                  >
                    Понятно
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => confirmDeleteTable(deleteCheck.table.id)}
                  >
                    Все равно удалить
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TablesManagement;
