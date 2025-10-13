import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../../NavBar";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { $authHost } from "../../../http";

const ChefOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await $authHost.get("/orders/kitchen");

      // Фильтруем заказы, чтобы показать только те, у которых есть блюда в статусе ordered или preparing
      const filteredOrders = response.data.filter(
        (order) =>
          order.items &&
          order.items.some((item) =>
            ["ordered", "preparing"].includes(item.status)
          )
      );

      setOrders(filteredOrders);
    } catch (error) {
      console.error("Ошибка загрузки заказов:", error);
      setError("Не удалось загрузить заказы");
    } finally {
      setLoading(false);
    }
  }, []);

  const takeDish = async (orderItemId) => {
    try {
      await $authHost.put(`/orders/order-items/${orderItemId}/take`);
      setSuccess("Блюдо взято в работу");
      loadOrders();
    } catch (error) {
      console.error("Ошибка взятия блюда:", error);
      setError(error.response?.data?.message || "Не удалось взять блюдо");
    }
  };

  const completeDish = async (orderItemId) => {
    try {
      await $authHost.put(`/orders/order-items/${orderItemId}/complete`);
      setSuccess("Блюдо готово");
      loadOrders();
    } catch (error) {
      console.error("Ошибка завершения блюда:", error);
      setError(error.response?.data?.message || "Не удалось завершить блюдо");
    }
  };

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const handleBack = () => {
    navigate("/chef");
  };

  const getOrderBadge = (order) => {
    const hasOrderedItems = order.items?.some(
      (item) => item.status === "ordered"
    );
    const hasPreparingItems = order.items?.some(
      (item) => item.status === "preparing"
    );
    const hasReadyItems = order.items?.some((item) => item.status === "ready");

    if (hasOrderedItems)
      return <span className="badge bg-warning">Новые блюда</span>;
    if (hasPreparingItems)
      return <span className="badge bg-primary">В работе</span>;
    if (hasReadyItems)
      return <span className="badge bg-success">Готовы к подаче</span>;

    return <span className="badge bg-secondary">Завершен</span>;
  };

  const getDishBadge = (status, chefId) => {
    if (status === "ready")
      return <span className="badge bg-success">Готово</span>;
    if (status === "preparing" && chefId === user.id)
      return <span className="badge bg-primary">Вы готовите</span>;
    if (status === "preparing")
      return <span className="badge bg-info">Готовит другой повар</span>;
    return <span className="badge bg-secondary">Ожидает</span>;
  };

  // Функция для проверки, можно ли взять блюдо
  const canTakeDish = (item) => {
    return (
      item.status === "ordered" ||
      (item.status === "preparing" && item.chefId === user.id)
    );
  };

  // Функция для проверки, можно ли отметить блюдо как готовое
  const canCompleteDish = (item) => {
    return item.status === "preparing" && item.chefId === user.id;
  };

  // Функция для фильтрации блюд - показываем только те, которые нужно готовить
  const getKitchenItems = (items) => {
    return items.filter((item) =>
      ["ordered", "preparing", "ready"].includes(item.status)
    );
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
                          <i className="bi bi-list-check me-2"></i>
                          Кухня - Активные заказы
                        </h1>
                        <p className="text-muted mb-0">
                          Управление приготовлением блюд
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 text-end">
                    <button className="btn btn-primary" onClick={loadOrders}>
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

        {success && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="alert alert-success">
                <i className="bi bi-check-circle me-2"></i>
                {success}
              </div>
            </div>
          </div>
        )}

        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                {orders.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="bi bi-cup display-1 text-muted"></i>
                    <h5 className="mt-3 text-muted">Нет активных заказов</h5>
                    <p className="text-muted">Все заказы выполнены</p>
                  </div>
                ) : (
                  orders.map((order) => {
                    const kitchenItems = getKitchenItems(order.items || []);

                    return (
                      <div key={order.id} className="card mb-4">
                        <div className="card-header d-flex justify-content-between align-items-center">
                          <div>
                            <h5 className="mb-0">Заказ #{order.id}</h5>
                            <small className="text-muted">
                              Стол: {order.table?.name || "Не указан"} | Время:{" "}
                              {new Date(order.createdAt).toLocaleTimeString()} |
                              Официант:{" "}
                              {order.waiter?.firstName || "Не назначен"}
                            </small>
                          </div>
                          <div>{getOrderBadge(order)}</div>
                        </div>
                        <div className="card-body">
                          {kitchenItems.length === 0 ? (
                            <div className="text-center py-3">
                              <p className="text-muted mb-0">
                                Все блюда этого заказа поданы или завершены
                              </p>
                            </div>
                          ) : (
                            <div className="table-responsive">
                              <table className="table table-sm">
                                <thead>
                                  <tr>
                                    <th>Блюдо</th>
                                    <th>Количество</th>
                                    <th>Примечания</th>
                                    <th>Статус</th>
                                    <th>Действия</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {kitchenItems.map((item) => (
                                    <tr key={item.id}>
                                      <td>
                                        <strong>{item.dish?.name}</strong>
                                        <br />
                                        <small className="text-muted">
                                          {item.dish?.category?.name ||
                                            "Без категории"}
                                        </small>
                                      </td>
                                      <td>{item.quantity}</td>
                                      <td>
                                        <small className="text-muted">
                                          {item.notes || "-"}
                                        </small>
                                      </td>
                                      <td>
                                        {getDishBadge(item.status, item.chefId)}
                                      </td>
                                      <td>
                                        {canTakeDish(item) && (
                                          <button
                                            className="btn btn-sm btn-outline-primary me-1"
                                            onClick={() => takeDish(item.id)}
                                            disabled={
                                              item.status === "preparing" &&
                                              item.chefId !== user.id
                                            }
                                          >
                                            {item.status === "ordered"
                                              ? "Взять"
                                              : "Продолжить"}
                                          </button>
                                        )}
                                        {canCompleteDish(item) && (
                                          <button
                                            className="btn btn-sm btn-outline-success"
                                            onClick={() =>
                                              completeDish(item.id)
                                            }
                                          >
                                            Готово
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChefOrders;
