import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../../NavBar";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { orderAPI } from "../../../services/orderAPI";
import { orderItemAPI } from "../../../services/orderItemAPI";

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
      const data = await orderAPI.getAll({
        status: "open,in_progress",
      });
      setOrders(data);
    } catch (error) {
      console.error("Ошибка загрузки заказов:", error);
      setError("Не удалось загрузить заказы");
    } finally {
      setLoading(false);
    }
  }, []);

  const takeOrder = async (orderId) => {
    try {
      await orderAPI.updateStatus(orderId, "in_progress");
      setSuccess("Заказ взят в работу");
      loadOrders();
    } catch (error) {
      console.error("Ошибка взятия заказа:", error);
      setError("Не удалось взять заказ");
    }
  };

  const completeOrder = async (orderId) => {
    try {
      await orderAPI.updateStatus(orderId, "ready");
      setSuccess("Заказ готов к подаче");
      loadOrders();
    } catch (error) {
      console.error("Ошибка завершения заказа:", error);
      setError("Не удалось завершить заказ");
    }
  };

  const takeDish = async (orderItemId) => {
    try {
      await orderItemAPI.updateStatus(orderItemId, "preparing", user.id);
      setSuccess("Блюдо взято в работу");
      loadOrders();
    } catch (error) {
      console.error("Ошибка взятия блюда:", error);
      setError("Не удалось взять блюдо");
    }
  };

  const completeDish = async (orderItemId) => {
    try {
      await orderItemAPI.updateStatus(orderItemId, "completed");
      setSuccess("Блюдо готово");
      loadOrders();
    } catch (error) {
      console.error("Ошибка завершения блюда:", error);
      setError("Не удалось завершить блюдо");
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

  const getOrderBadge = (status) => {
    switch (status) {
      case "open":
        return <span className="badge bg-warning">Ожидает</span>;
      case "in_progress":
        return <span className="badge bg-primary">В работе</span>;
      case "ready":
        return <span className="badge bg-success">Готов</span>;
      default:
        return <span className="badge bg-secondary">{status}</span>;
    }
  };

  const getDishBadge = (status, chefId) => {
    if (status === "completed")
      return <span className="badge bg-success">Готово</span>;
    if (status === "preparing" && chefId === user.id)
      return <span className="badge bg-primary">Вы готовите</span>;
    if (status === "preparing")
      return <span className="badge bg-info">Готовится</span>;
    return <span className="badge bg-secondary">Ожидает</span>;
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
                          Активные заказы
                        </h1>
                        <p className="text-muted mb-0">
                          Управление текущими заказами на кухне
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
                  orders.map((order) => (
                    <div key={order.id} className="card mb-4">
                      <div className="card-header d-flex justify-content-between align-items-center">
                        <div>
                          <h5 className="mb-0">Заказ #{order.id}</h5>
                          <small className="text-muted">
                            Стол: {order.table?.number || "Не указан"} | Время:{" "}
                            {new Date(order.createdAt).toLocaleTimeString()}
                          </small>
                        </div>
                        <div>
                          {getOrderBadge(order.status)}
                          {order.status === "open" && (
                            <button
                              className="btn btn-sm btn-primary ms-2"
                              onClick={() => takeOrder(order.id)}
                            >
                              Взять заказ
                            </button>
                          )}
                          {order.status === "in_progress" && (
                            <button
                              className="btn btn-sm btn-success ms-2"
                              onClick={() => completeOrder(order.id)}
                            >
                              Заказ готов
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="card-body">
                        <div className="table-responsive">
                          <table className="table table-sm">
                            <thead>
                              <tr>
                                <th>Блюдо</th>
                                <th>Количество</th>
                                <th>Статус</th>
                                <th>Действия</th>
                              </tr>
                            </thead>
                            <tbody>
                              {order.items?.map((item) => (
                                <tr key={item.id}>
                                  <td>
                                    <strong>{item.dish?.name}</strong>
                                    <br />
                                    <small className="text-muted">
                                      {item.dish?.category?.name}
                                    </small>
                                  </td>
                                  <td>{item.quantity}</td>
                                  <td>
                                    {getDishBadge(item.status, item.chefId)}
                                  </td>
                                  <td>
                                    {item.status === "ordered" && (
                                      <button
                                        className="btn btn-sm btn-outline-primary"
                                        onClick={() => takeDish(item.id)}
                                      >
                                        Взять блюдо
                                      </button>
                                    )}
                                    {item.status === "preparing" &&
                                      item.chefId === user.id && (
                                        <button
                                          className="btn btn-sm btn-outline-success"
                                          onClick={() => completeDish(item.id)}
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
                      </div>
                    </div>
                  ))
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
