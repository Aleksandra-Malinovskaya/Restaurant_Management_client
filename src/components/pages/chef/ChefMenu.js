import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../../NavBar";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { dishAPI } from "../../../services/dishAPI";
import { $authHost } from "../../../http";
import { toast } from "react-toastify";
import socketService from "../../../services/socket";

const ChefMenu = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dishes, setDishes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 9,
  });
  const [notifications, setNotifications] = useState([]);

  const loadMenu = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError("");

        const params = {
          page,
          limit: pagination.limit,
          ...(selectedCategory !== "all" && { categoryId: selectedCategory }),
        };

        const [dishesResponse, categoriesResponse] = await Promise.all([
          dishAPI.getAll(params),
          $authHost.get("/categories"),
        ]);

        const dishesData = dishesResponse.rows || dishesResponse.data || [];
        const categoriesData = categoriesResponse.data || [];

        setDishes(dishesData);
        setCategories(categoriesData);
        setPagination((prev) => ({
          ...prev,
          currentPage: page,
          totalCount: dishesResponse.count || 0,
          totalPages: Math.ceil((dishesResponse.count || 0) / prev.limit),
        }));
      } catch (error) {
        console.error("Ошибка загрузки меню:", error);
        setError("Не удалось загрузить меню");
      } finally {
        setLoading(false);
      }
    },
    [selectedCategory, pagination.limit]
  );

  const toggleDishStop = async (dish) => {
    try {
      await dishAPI.toggleStop(dish.id);

      toast.success(
        `Блюдо ${dish.isStopped ? "снято со стопа" : "поставлено на стоп"}`
      );
      loadMenu(pagination.currentPage);
    } catch (error) {
      console.error("Ошибка изменения статуса блюда:", error);
      console.error("Детали ошибки:", error.response?.data);
      setError(
        error.response?.data?.message || "Не удалось изменить статус блюда"
      );
    }
  };

  // WebSocket уведомления для страницы меню
  useEffect(() => {
    console.log("ChefMenu: Начало инициализации WebSocket");

    let socket;

    try {
      // Подключаемся к WebSocket
      socket = socketService.connect();

      // Сообщаем серверу о роли повара
      if (user) {
        console.log(
          "ChefMenu: Отправка user_connected с ролью chef, userId:",
          user.id
        );
        socketService.userConnected({
          role: "chef",
          userId: user.id,
        });
      }

      // Подписываемся на уведомления
      socketService.subscribeToChefNotifications((data) => {
        console.log(
          "ChefMenu: Получено WebSocket уведомление о новом заказе:",
          data
        );

        // Toast уведомление в правом нижнем углу
        toast.info(`🔥 Новый заказ #${data.order?.id || data.orderId}`, {
          position: "bottom-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: "light",
        });

        // Добавляем в список уведомлений
        setNotifications((prev) => [data, ...prev.slice(0, 4)]);
      });

      // Дополнительная подписка для отладки
      socket.on("new_order_notification", (data) => {
        console.log(
          "ChefMenu: Прямое уведомление new_order_notification:",
          data
        );
      });
    } catch (error) {
      console.error("ChefMenu: Ошибка инициализации WebSocket:", error);
    }

    return () => {
      console.log("ChefMenu: Очистка WebSocket подписок");
      socketService.unsubscribeAll();
    };
  }, [user]);

  useEffect(() => {
    loadMenu(1);
  }, [loadMenu]);

  const handleBack = () => {
    navigate("/chef");
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadMenu(newPage);
    }
  };

  const getImageUrl = (imgUrl) => {
    if (!imgUrl) return null;
    if (imgUrl.startsWith("http")) return imgUrl;
    return `http://localhost:5000${imgUrl}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
    }).format(amount);
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
                          <i className="bi bi-book me-2"></i>
                          Меню ресторана
                          {socketService.getConnectionStatus() && (
                            <span className="badge bg-success ms-2">
                              <i className="bi bi-wifi"></i> Online
                            </span>
                          )}
                        </h1>
                        <p className="text-muted mb-0">
                          Просмотр и управление доступностью блюд
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 text-end">
                    <button
                      className="btn btn-primary"
                      onClick={() => loadMenu(pagination.currentPage)}
                    >
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

        {/* Фильтр по категориям */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="row g-3 align-items-center">
                  <div className="col-md-4">
                    <label className="form-label">Фильтр по категории</label>
                    <select
                      className="form-select"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <option value="all">Все категории</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-8">
                    <div className="d-flex flex-wrap gap-2">
                      {categories.map((category) => (
                        <button
                          key={category.id}
                          className={`btn btn-sm ${
                            selectedCategory === category.id.toString()
                              ? "btn-primary"
                              : "btn-outline-primary"
                          }`}
                          onClick={() =>
                            setSelectedCategory(category.id.toString())
                          }
                        >
                          {category.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Список блюд */}
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                  Список блюд ({pagination.totalCount})
                </h5>
                {pagination.totalPages > 1 && (
                  <div className="d-flex align-items-center">
                    <span className="me-3 text-muted">
                      Страница {pagination.currentPage} из{" "}
                      {pagination.totalPages}
                    </span>
                    <div className="btn-group">
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() =>
                          handlePageChange(pagination.currentPage - 1)
                        }
                        disabled={pagination.currentPage === 1}
                      >
                        <i className="bi bi-chevron-left"></i>
                      </button>
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() =>
                          handlePageChange(pagination.currentPage + 1)
                        }
                        disabled={
                          pagination.currentPage === pagination.totalPages
                        }
                      >
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="card-body">
                <div className="row g-3">
                  {dishes.map((dish) => (
                    <div key={dish.id} className="col-md-6 col-lg-4">
                      <div
                        className={`card h-100 ${
                          dish.isStopped ? "border-danger" : "border-success"
                        }`}
                      >
                        <div className="position-relative">
                          {dish.imgUrl ? (
                            <img
                              src={getImageUrl(dish.imgUrl)}
                              className="card-img-top"
                              alt={dish.name}
                              style={{
                                height: "200px",
                                objectFit: "cover",
                              }}
                              onError={(e) => {
                                console.error(
                                  "Ошибка загрузки изображения:",
                                  dish.imgUrl
                                );
                                e.target.style.display = "none";
                              }}
                            />
                          ) : (
                            <div
                              className="card-img-top bg-light d-flex align-items-center justify-content-center"
                              style={{ height: "200px" }}
                            >
                              <i className="bi bi-egg-fried display-4 text-muted"></i>
                            </div>
                          )}
                          <div className="position-absolute top-0 end-0 m-2">
                            {dish.isStopped ? (
                              <span className="badge bg-danger">На стопе</span>
                            ) : (
                              <span className="badge bg-success">Доступно</span>
                            )}
                          </div>
                        </div>
                        <div className="card-body">
                          <h5 className="card-title">{dish.name}</h5>

                          <p className="card-text text-muted small">
                            {dish.description || "Описание отсутствует"}
                          </p>

                          <div className="mb-2">
                            <strong className="text-primary">
                              {formatCurrency(dish.price)}
                            </strong>
                          </div>

                          <div className="mb-2">
                            <small className="text-muted">
                              Категория: {dish.category?.name || "Не указана"}
                            </small>
                          </div>

                          {dish.cookingTimeMin && (
                            <div className="mb-3">
                              <small className="text-muted">
                                <i className="bi bi-clock me-1"></i>
                                Время приготовления: {dish.cookingTimeMin} мин
                              </small>
                            </div>
                          )}
                        </div>
                        <div className="card-footer">
                          <button
                            className={`btn btn-sm w-100 ${
                              dish.isStopped ? "btn-success" : "btn-warning"
                            }`}
                            onClick={() => toggleDishStop(dish)}
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2" />
                                Загрузка...
                              </>
                            ) : (
                              <>
                                <i
                                  className={`bi bi-${
                                    dish.isStopped ? "play" : "pause"
                                  } me-1`}
                                ></i>
                                {dish.isStopped
                                  ? "Снять со стопа"
                                  : "Поставить на стоп"}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {dishes.length === 0 && (
                  <div className="text-center py-5">
                    <i className="bi bi-egg display-1 text-muted"></i>
                    <h5 className="mt-3 text-muted">Блюда не найдены</h5>
                    <p className="text-muted">
                      Попробуйте выбрать другую категорию
                    </p>
                  </div>
                )}

                {/* Пагинация внизу */}
                {pagination.totalPages > 1 && (
                  <div className="d-flex justify-content-center mt-4">
                    <nav>
                      <ul className="pagination">
                        <li
                          className={`page-item ${
                            pagination.currentPage === 1 ? "disabled" : ""
                          }`}
                        >
                          <button
                            className="page-link"
                            onClick={() =>
                              handlePageChange(pagination.currentPage - 1)
                            }
                          >
                            <i className="bi bi-chevron-left"></i>
                          </button>
                        </li>
                        {[...Array(pagination.totalPages)].map((_, index) => (
                          <li
                            key={index}
                            className={`page-item ${
                              pagination.currentPage === index + 1
                                ? "active"
                                : ""
                            }`}
                          >
                            <button
                              className="page-link"
                              onClick={() => handlePageChange(index + 1)}
                            >
                              {index + 1}
                            </button>
                          </li>
                        ))}
                        <li
                          className={`page-item ${
                            pagination.currentPage === pagination.totalPages
                              ? "disabled"
                              : ""
                          }`}
                        >
                          <button
                            className="page-link"
                            onClick={() =>
                              handlePageChange(pagination.currentPage + 1)
                            }
                          >
                            <i className="bi bi-chevron-right"></i>
                          </button>
                        </li>
                      </ul>
                    </nav>
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

export default ChefMenu;
