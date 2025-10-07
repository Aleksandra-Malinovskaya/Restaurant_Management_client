import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../NavBar";
import { $authHost } from "../../../http";

const WaiterTables = () => {
  const navigate = useNavigate();
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Загружаем столики
      const tablesResponse = await $authHost.get("/tables");
      setTables(tablesResponse.data);

      // Загружаем активные заказы
      const ordersResponse = await $authHost.get("/orders");
      const activeOrders = ordersResponse.data.filter((order) =>
        ["open", "in_progress", "ready"].includes(order.status)
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
  };

  const handleBack = () => {
    navigate("/waiter");
  };

  const handleTableClick = (table) => {
    navigate(`/waiter/table/${table.id}`);
  };

  const getTableStatus = (table) => {
    const tableOrders = orders.filter(
      (order) =>
        order.tableId === table.id &&
        ["open", "in_progress", "ready"].includes(order.status)
    );

    const now = new Date();
    const currentReservation = reservations.find(
      (reservation) =>
        reservation.tableId === table.id &&
        new Date(reservation.reservedFrom) <= now &&
        new Date(reservation.reservedTo) >= now &&
        ["confirmed", "seated"].includes(reservation.status)
    );

    if (tableOrders.length > 0) return "occupied";
    if (currentReservation && currentReservation.status === "seated")
      return "occupied";
    if (currentReservation && currentReservation.status === "confirmed")
      return "reserved";

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

  // Фильтрация столиков
  const filteredTables = tables.filter((table) => {
    const status = getTableStatus(table);
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    const matchesSearch = table.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    return matchesStatus && matchesSearch;
  });

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
                  Список столиков ({filteredTables.length})
                </h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  {filteredTables.map((table) => {
                    const status = getTableStatus(table);
                    const tableOrders = orders.filter(
                      (order) => order.tableId === table.id
                    );
                    const currentOrder =
                      tableOrders.length > 0 ? tableOrders[0] : null;

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
                                        : "bi-person-plus"
                                    }
                                  `}
                                ></i>
                              </div>
                              <h5 className={`text-${getStatusColor(status)}`}>
                                {getStatusText(status)}
                              </h5>
                            </div>

                            {currentOrder && (
                              <div className="mb-3 p-2 bg-light rounded">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <small className="text-muted">Заказ:</small>
                                  <span
                                    className={`badge bg-${
                                      currentOrder.status === "ready"
                                        ? "success"
                                        : currentOrder.status === "in_progress"
                                        ? "warning"
                                        : "primary"
                                    }`}
                                  >
                                    {currentOrder.status === "ready"
                                      ? "Готов"
                                      : currentOrder.status === "in_progress"
                                      ? "Готовится"
                                      : "Открыт"}
                                  </span>
                                </div>
                                <div className="small">
                                  <strong>Сумма:</strong>{" "}
                                  {currentOrder.totalAmount} ₽
                                </div>
                                <div className="small">
                                  <strong>Блюд:</strong>{" "}
                                  {currentOrder.items?.length || 0}
                                </div>
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
                    <h5 className="mt-3 text-muted">Столики не найдены</h5>
                    <p className="text-muted">
                      Попробуйте изменить параметры фильтрации
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
