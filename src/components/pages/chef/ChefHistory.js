import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../../NavBar";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { orderAPI } from "../../../services/orderAPI";
import { $authHost } from "../../../http";
import { toast } from "react-toastify";
import socketService from "../../../services/socket";

const ChefHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [completedOrders, setCompletedOrders] = useState([]);
  const [completedDishes, setCompletedDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeFilter, setTimeFilter] = useState("today");
  const [activeTab, setActiveTab] = useState("orders");
  const [notifications, setNotifications] = useState([]);

  const loadHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      // Рассчитываем дату начала
      let startDate = new Date();
      switch (timeFilter) {
        case "today":
          startDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        default:
          startDate.setHours(0, 0, 0, 0);
      }

      // Получаем ВСЕ заказы и анализируем их items
      const allOrdersResponse = await orderAPI.getAll();

      // Собираем ВСЕ блюда из ВСЕХ заказов
      const allItemsFromOrders = [];
      allOrdersResponse.forEach((order) => {
        if (order.items && Array.isArray(order.items)) {
          const orderDate = new Date(order.createdAt);
          order.items.forEach((item) => {
            allItemsFromOrders.push({
              ...item,
              orderId: order.id,
              orderStatus: order.status,
              orderCreatedAt: order.createdAt,
              orderDate: orderDate,
            });
          });
        }
      });

      // Фильтруем завершенные заказы
      const filteredOrders = allOrdersResponse.filter((order) => {
        const orderDate = new Date(order.updatedAt || order.createdAt);
        const isClosed = order.status === "closed";
        const isInDateRange = orderDate >= startDate;

        return isClosed && isInDateRange;
      });

      // Фильтруем приготовленные блюда из ВСЕХ блюд
      const filteredDishes = allItemsFromOrders.filter((item) => {
        const itemDate = new Date(item.updatedAt || item.createdAt);
        const isMyItem =
          item.chefId === user?.id || (item.chef && item.chef.id === user?.id);
        const isPrepared = ["ready", "served"].includes(item.status);
        const isInDateRange = itemDate >= startDate;

        return isMyItem && isPrepared && isInDateRange;
      });

      setCompletedOrders(filteredOrders);
      setCompletedDishes(filteredDishes);
    } catch (error) {
      console.error("Ошибка загрузки истории:", error);
      setError("Не удалось загрузить историю");
    } finally {
      setLoading(false);
    }
  }, [timeFilter, user]);

  // WebSocket уведомления для страницы истории
  useEffect(() => {
    console.log("ChefHistory: Начало инициализации WebSocket");

    const newOrderHandler = (data) => {
      console.log(
        "ChefHistory: Получено WebSocket уведомление о новом заказе:",
        data
      );

      toast.info(`🔥 Новый заказ #${data.order?.id || data.orderId}`, {
        position: "bottom-right",
        autoClose: 5000,
      });

      setNotifications((prev) => [data, ...prev.slice(0, 4)]);
    };

    try {
      socketService.subscribeToChefNotifications(newOrderHandler);

      if (user) {
        socketService.userConnected({
          role: "chef",
          userId: user.id,
        });
      }
    } catch (error) {
      console.error("ChefHistory: Ошибка инициализации WebSocket:", error);
    }

    return () => {
      socketService.unsubscribeAll();
    };
  }, [user]);

  useEffect(() => {
    // Используем основную функцию
    loadHistory();
  }, [loadHistory]);

  const handleBack = () => {
    navigate("/chef");
  };

  const handleRefresh = () => {
    loadHistory();
  };

  const getTimeFilterText = () => {
    switch (timeFilter) {
      case "today":
        return "сегодня";
      case "week":
        return "за неделю";
      case "month":
        return "за месяц";
      default:
        return "";
    }
  };

  const calculateTotalRevenue = () => {
    return completedOrders.reduce(
      (sum, order) => sum + parseFloat(order.totalAmount || 0),
      0
    );
  };

  const calculateDishesCount = () => {
    return completedDishes.reduce((sum, item) => sum + (item.quantity || 1), 0);
  };

  const calculateAveragePreparationTime = () => {
    const itemsWithTime = completedDishes.filter(
      (item) => item.createdAt && item.updatedAt
    );
    if (itemsWithTime.length === 0) return 0;

    const totalTime = itemsWithTime.reduce((sum, item) => {
      const start = new Date(item.createdAt);
      const end = new Date(item.updatedAt);
      return sum + (end - start) / (1000 * 60); // время в минутах
    }, 0);

    return Math.round(totalTime / itemsWithTime.length);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("ru-RU", {
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
                        title="Вернуться на панель повара"
                      >
                        <i className="bi bi-arrow-left"></i>
                      </button>
                      <div>
                        <h1 className="h3 mb-2">
                          <i className="bi bi-clock-history me-2"></i>
                          История работы
                          {socketService.getConnectionStatus() && (
                            <span className="badge bg-success ms-2">
                              <i className="bi bi-wifi"></i> Online
                            </span>
                          )}
                        </h1>
                        <p className="text-muted mb-0">
                          Статистика выполненных заказов и блюд
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 text-end">
                    <button className="btn btn-primary" onClick={handleRefresh}>
                      <i className="bi bi-arrow-clockwise me-2"></i>
                      Обновить
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
              <div className="alert alert-danger">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
              </div>
            </div>
          </div>
        )}

        {/* Панель уведомлений WebSocket */}
        {notifications.length > 0 && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="card border-info">
                <div className="card-header bg-info text-white">
                  <i className="bi bi-bell me-2"></i>
                  Последние уведомления
                </div>
                <div className="card-body">
                  <div className="row">
                    {notifications.map((notif, index) => (
                      <div key={index} className="col-md-3 mb-2">
                        <div className="alert alert-info py-2">
                          <small>
                            <strong>{notif.message}</strong>
                            <br />
                            <span className="text-muted">
                              {notif.timestamp}
                            </span>
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

        {/* Фильтры по времени */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="row g-3 align-items-center">
                  <div className="col-md-4">
                    <label className="form-label">Период</label>
                    <select
                      className="form-select"
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value)}
                    >
                      <option value="today">Сегодня</option>
                      <option value="week">Неделя</option>
                      <option value="month">Месяц</option>
                    </select>
                  </div>
                  <div className="col-md-8">
                    <div className="d-flex flex-wrap gap-2">
                      <button
                        className={`btn btn-sm ${
                          timeFilter === "today"
                            ? "btn-primary"
                            : "btn-outline-primary"
                        }`}
                        onClick={() => setTimeFilter("today")}
                      >
                        Сегодня
                      </button>
                      <button
                        className={`btn btn-sm ${
                          timeFilter === "week"
                            ? "btn-primary"
                            : "btn-outline-primary"
                        }`}
                        onClick={() => setTimeFilter("week")}
                      >
                        Неделя
                      </button>
                      <button
                        className={`btn btn-sm ${
                          timeFilter === "month"
                            ? "btn-primary"
                            : "btn-outline-primary"
                        }`}
                        onClick={() => setTimeFilter("month")}
                      >
                        Месяц
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-info">
              <div className="card-header bg-info text-white">
                <i className="bi bi-graph-up me-2"></i>
                Статистика {getTimeFilterText()}
              </div>
              <div className="card-body">
                <div className="row text-center">
                  <div className="col-md-3 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-primary mb-1">
                        {completedOrders.length}
                      </h4>
                      <small className="text-muted">Завершенных заказов</small>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-success mb-1">
                        {calculateDishesCount()}
                      </h4>
                      <small className="text-muted">Приготовленных блюд</small>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-warning mb-1">
                        {formatCurrency(calculateTotalRevenue())}
                      </h4>
                      <small className="text-muted">Общая выручка</small>
                    </div>
                  </div>
                  <div className="col-md-3 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-info mb-1">
                        {calculateAveragePreparationTime()} мин
                      </h4>
                      <small className="text-muted">
                        Среднее время приготовления
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Табы для переключения между заказами и блюдами */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <ul className="nav nav-tabs card-header-tabs">
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        activeTab === "orders" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("orders")}
                    >
                      <i className="bi bi-list-check me-2"></i>
                      Завершенные заказы ({completedOrders.length})
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        activeTab === "dishes" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("dishes")}
                    >
                      <i className="bi bi-egg-fried me-2"></i>
                      Мои приготовленные блюда ({completedDishes.length})
                    </button>
                  </li>
                </ul>
              </div>
              <div className="card-body">
                {activeTab === "orders" ? (
                  /* Список завершенных заказов */
                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>ID заказа</th>
                          <th>Стол</th>
                          <th>Количество блюд</th>
                          <th>Сумма</th>
                          <th>Время завершения</th>
                          <th>Официант</th>
                        </tr>
                      </thead>
                      <tbody>
                        {completedOrders.map((order) => (
                          <tr key={order.id}>
                            <td>
                              <strong>#{order.id}</strong>
                            </td>
                            <td>{order.table?.name || "Не указан"}</td>
                            <td>
                              <span className="badge bg-primary">
                                {order.items?.length || 0}
                              </span>
                            </td>
                            <td className="text-success fw-bold">
                              {formatCurrency(order.totalAmount || 0)}
                            </td>
                            <td>
                              <small className="text-muted">
                                {formatDate(order.updatedAt || order.createdAt)}
                              </small>
                            </td>
                            <td>
                              {order.waiter ? (
                                `${order.waiter.firstName} ${order.waiter.lastName}`
                              ) : (
                                <span className="text-muted">Не указан</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {completedOrders.length === 0 && (
                      <div className="text-center py-5">
                        <i className="bi bi-cup display-1 text-muted"></i>
                        <h5 className="mt-3 text-muted">
                          Нет завершенных заказов
                        </h5>
                        <p className="text-muted">
                          За выбранный период завершенные заказы отсутствуют
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Список приготовленных блюд */
                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>Блюдо</th>
                          <th>Количество</th>
                          <th>Статус</th>
                          <th>Заказ</th>
                          <th>Время начала</th>
                          <th>Время завершения</th>
                          <th>Время приготовления</th>
                        </tr>
                      </thead>
                      <tbody>
                        {completedDishes.map((item) => {
                          const startTime = new Date(item.createdAt);
                          const endTime = new Date(item.updatedAt);
                          const preparationTime = Math.round(
                            (endTime - startTime) / (1000 * 60)
                          ); // в минутах

                          return (
                            <tr key={item.id}>
                              <td>
                                <strong>
                                  {item.dish?.name || "Неизвестное блюдо"}
                                </strong>
                                {item.dish?.category?.name && (
                                  <>
                                    <br />
                                    <small className="text-muted">
                                      {item.dish.category.name}
                                    </small>
                                  </>
                                )}
                              </td>
                              <td>
                                <span className="badge bg-success">
                                  {item.quantity || 1}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`badge ${
                                    item.status === "ready"
                                      ? "bg-success"
                                      : "bg-info"
                                  }`}
                                >
                                  {item.status === "ready"
                                    ? "Готово"
                                    : "Подано"}
                                </span>
                              </td>
                              <td>
                                <strong>#{item.orderId || "N/A"}</strong>
                              </td>
                              <td>
                                <small className="text-muted">
                                  {startTime.toLocaleTimeString("ru-RU")}
                                  <br />
                                  {startTime.toLocaleDateString("ru-RU")}
                                </small>
                              </td>
                              <td>
                                <small className="text-muted">
                                  {endTime.toLocaleTimeString("ru-RU")}
                                  <br />
                                  {endTime.toLocaleDateString("ru-RU")}
                                </small>
                              </td>
                              <td>
                                <span
                                  className={`badge ${
                                    preparationTime <= 10
                                      ? "bg-success"
                                      : preparationTime <= 20
                                      ? "bg-warning"
                                      : "bg-danger"
                                  }`}
                                >
                                  {preparationTime} мин
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {completedDishes.length === 0 && (
                      <div className="text-center py-5">
                        <i className="bi bi-egg display-1 text-muted"></i>
                        <h5 className="mt-3 text-muted">
                          Нет приготовленных блюд
                        </h5>
                        <p className="text-muted">
                          За выбранный период вы не приготовили ни одного блюда
                        </p>
                        <div className="mt-3">
                          <small className="text-muted">
                            Проверьте консоль браузера для отладки данных
                          </small>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Дополнительная статистика по блюдам */}
        {activeTab === "dishes" && completedDishes.length > 0 && (
          <div className="row">
            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h5 className="mb-0">
                    <i className="bi bi-bar-chart me-2"></i>
                    Статистика по блюдам
                  </h5>
                </div>
                <div className="card-body">
                  {/* Группировка блюд по названию */}
                  {(() => {
                    const dishStats = {};
                    completedDishes.forEach((item) => {
                      const dishName = item.dish?.name || "Неизвестное блюдо";
                      if (!dishStats[dishName]) {
                        dishStats[dishName] = {
                          count: 0,
                          totalQuantity: 0,
                          totalTime: 0,
                          items: [],
                        };
                      }
                      dishStats[dishName].count++;
                      dishStats[dishName].totalQuantity += item.quantity || 1;
                      const prepTime = Math.round(
                        (new Date(item.updatedAt) - new Date(item.createdAt)) /
                          (1000 * 60)
                      );
                      dishStats[dishName].totalTime += prepTime;
                      dishStats[dishName].items.push(item);
                    });

                    return (
                      <div className="row">
                        {Object.entries(dishStats).map(([dishName, stats]) => {
                          const avgTime = Math.round(
                            stats.totalTime / stats.count
                          );
                          return (
                            <div
                              key={dishName}
                              className="col-md-6 col-lg-4 mb-3"
                            >
                              <div className="card border-secondary">
                                <div className="card-body">
                                  <h6 className="card-title">{dishName}</h6>
                                  <div className="row text-center">
                                    <div className="col-4">
                                      <div className="border-end">
                                        <h5 className="text-primary mb-1">
                                          {stats.totalQuantity}
                                        </h5>
                                        <small className="text-muted">
                                          Порций
                                        </small>
                                      </div>
                                    </div>
                                    <div className="col-4">
                                      <div className="border-end">
                                        <h5 className="text-success mb-1">
                                          {stats.count}
                                        </h5>
                                        <small className="text-muted">
                                          Раз приготовлено
                                        </small>
                                      </div>
                                    </div>
                                    <div className="col-4">
                                      <h5 className="text-info mb-1">
                                        {avgTime} мин
                                      </h5>
                                      <small className="text-muted">
                                        Среднее время
                                      </small>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChefHistory;
