import React, { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "../../NavBar";
import { useNavigate } from "react-router-dom";
import { dishAPI } from "../../../services/dishAPI";
import { $authHost } from "../../../http";
import { toast } from "react-toastify";
import socketService from "../../../services/socket";

const TraneeMenu = () => {
  const navigate = useNavigate();
  const [dishes, setDishes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 12,
  });
  const [notifications, setNotifications] = useState([]);

  // Refs для отслеживания состояния без триггеров рендеринга
  const notificationTimeoutRef = useRef(null);
  const processedNotificationsRef = useRef(new Set());

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

        // Фильтруем только активные блюда для стажера
        const activeDishes = dishesData.filter(
          (dish) => dish.isActive && !dish.isStopped
        );

        setDishes(activeDishes);
        setCategories(categoriesData);
        setPagination((prev) => ({
          ...prev,
          currentPage: page,
          totalCount: activeDishes.length,
          totalPages: Math.ceil(activeDishes.length / prev.limit),
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

  // Функция для добавления уведомления с защитой от дубликатов
  const addNotification = useCallback((data, type = "dish") => {
    const notificationId =
      type === "dish"
        ? `dish-${data.orderId}-${data.dishName}`
        : `order-${data.orderId}`;

    // Проверяем, не обрабатывали ли мы уже это уведомление
    if (processedNotificationsRef.current.has(notificationId)) {
      console.log(
        `🔄 TraneeMenu: Пропускаем дублирующее уведомление ${notificationId}`
      );
      return;
    }

    // Добавляем в множество обработанных
    processedNotificationsRef.current.add(notificationId);

    // Очищаем через 10 секунд из множества обработанных
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
    }
    notificationTimeoutRef.current = setTimeout(() => {
      processedNotificationsRef.current.delete(notificationId);
    }, 10000);

    // Показываем toast
    if (type === "dish") {
      toast.info(`🍽️ ${data.message}`, {
        position: "top-right",
        autoClose: 6000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } else {
      toast.success(`🛎️ ${data.message}`, {
        position: "top-right",
        autoClose: 8000,
      });
    }

    // Добавляем в список уведомлений
    setNotifications((prev) => {
      const newNotification = {
        ...data,
        id: notificationId,
        type,
        timestamp: data.timestamp || new Date().toLocaleTimeString(),
      };

      // Ограничиваем список 6 уведомлениями
      return [newNotification, ...prev.slice(0, 5)];
    });
  }, []);

  // WebSocket уведомления для страницы меню
  useEffect(() => {
    console.log("TraneeMenu: Начало инициализации WebSocket");

    const orderNotificationHandler = (data) => {
      console.log("🛎️ TraneeMenu: Уведомление о готовом заказе:", data);
      addNotification(data, "order");
    };

    const dishNotificationHandler = (data) => {
      console.log("🍽️ TraneeMenu: Уведомление о готовом блюде:", data);
      addNotification(data, "dish");
    };

    try {
      // Подписываемся на уведомления
      socketService.subscribeToWaiterOrderNotifications(
        orderNotificationHandler
      );
      socketService.subscribeToWaiterDishNotifications(dishNotificationHandler);

      return () => {
        console.log("🧹 TraneeMenu: Очистка WebSocket подписок");
        // Отписываемся от всех уведомлений при размонтировании
        socketService.unsubscribeAll();

        // Очищаем таймеры
        if (notificationTimeoutRef.current) {
          clearTimeout(notificationTimeoutRef.current);
        }
      };
    } catch (error) {
      console.error("TraneeMenu: Ошибка инициализации WebSocket:", error);
    }
  }, [addNotification]);

  useEffect(() => {
    loadMenu(1);
  }, [loadMenu]);

  const handleBack = () => {
    navigate("/tranee");
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

  const clearNotifications = () => {
    setNotifications([]);
    processedNotificationsRef.current.clear();
  };

  // Фильтрация по поиску
  const filteredDishes = dishes.filter(
    (dish) =>
      dish.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dish.ingredients?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                        title="Вернуться на панель стажера"
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
                          Просмотр доступных блюд и их состава (режим обучения)
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
                <div className="card-header bg-info text-white d-flex justify-content-between align-items-center">
                  <span>
                    <i className="bi bi-bell me-2"></i>
                    Уведомления с кухни ({notifications.length})
                  </span>
                  <button
                    className="btn btn-sm btn-light"
                    onClick={clearNotifications}
                  >
                    <i className="bi bi-trash me-1"></i>
                    Очистить
                  </button>
                </div>
                <div className="card-body">
                  <div className="row">
                    {notifications.map((notif) => (
                      <div key={notif.id} className="col-md-6 mb-2">
                        <div
                          className={`alert ${
                            notif.type === "order"
                              ? "alert-success"
                              : "alert-info"
                          } py-2`}
                        >
                          <small>
                            <strong>{notif.message}</strong>
                            <br />
                            <span className="text-muted">
                              <i className="bi bi-clock me-1"></i>
                              {notif.timestamp}
                            </span>
                            {notif.tableNumber && (
                              <>
                                <br />
                                <span className="text-muted">
                                  <i className="bi bi-table me-1"></i>
                                  Стол: {notif.tableNumber}
                                </span>
                              </>
                            )}
                            {notif.dishName && (
                              <>
                                <br />
                                <span className="text-muted">
                                  <i className="bi bi-egg-fried me-1"></i>
                                  Блюдо: {notif.dishName}
                                </span>
                              </>
                            )}
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

        {/* Фильтры */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Поиск блюд</label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <i className="bi bi-search"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Название блюда или ингредиенты..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Категория</label>
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
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Карточки блюд */}
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                  Доступные блюда ({filteredDishes.length})
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
                  {filteredDishes.map((dish) => (
                    <div key={dish.id} className="col-md-6 col-lg-4 col-xl-3">
                      <div className="card h-100 border-success">
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
                            <span className="badge bg-success">Доступно</span>
                          </div>
                        </div>
                        <div className="card-body">
                          <h5 className="card-title">{dish.name}</h5>

                          <p className="card-text text-muted small">
                            {dish.ingredients || "Описание отсутствует"}
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
                            <div className="mb-2">
                              <small className="text-muted">
                                <i className="bi bi-clock me-1"></i>
                                Приготовление: {dish.cookingTimeMin} мин
                              </small>
                            </div>
                          )}

                          {dish.allergens && (
                            <div className="mb-2">
                              <small className="text-warning">
                                <i className="bi bi-exclamation-triangle me-1"></i>
                                Аллергены: {dish.allergens}
                              </small>
                            </div>
                          )}

                          {dish.nutritionInfo && (
                            <div className="mb-2">
                              <small className="text-info">
                                <i className="bi bi-info-circle me-1"></i>
                                {dish.nutritionInfo}
                              </small>
                            </div>
                          )}
                        </div>
                        <div className="card-footer bg-success bg-opacity-10">
                          <small className="text-success">
                            <i className="bi bi-check-circle me-1"></i>
                            Доступно для заказа
                          </small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredDishes.length === 0 && (
                  <div className="text-center py-5">
                    <i className="bi bi-search display-1 text-muted"></i>
                    <h5 className="mt-3 text-muted">Блюда не найдены</h5>
                    <p className="text-muted">
                      {searchTerm
                        ? "Попробуйте изменить поисковый запрос"
                        : "Попробуйте выбрать другую категорию"}
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

        {/* Категории с карточками */}
        <div className="row mt-4">
          {categories.map((category) => {
            const categoryDishes = filteredDishes.filter(
              (dish) => dish.category?.id === category.id
            );

            if (categoryDishes.length === 0) return null;

            return (
              <div key={category.id} className="col-12 mb-4">
                <div className="card">
                  <div className="card-header bg-primary text-white">
                    <h5 className="mb-0">
                      {category.name} ({categoryDishes.length})
                    </h5>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      {categoryDishes.map((dish) => (
                        <div
                          key={dish.id}
                          className="col-xl-3 col-lg-4 col-md-6"
                        >
                          <div className="card h-100">
                            {dish.imgUrl && (
                              <img
                                src={getImageUrl(dish.imgUrl)}
                                alt={dish.name}
                                className="card-img-top"
                                style={{ height: "200px", objectFit: "cover" }}
                              />
                            )}
                            <div className="card-body">
                              <h6 className="card-title">{dish.name}</h6>
                              <p className="card-text small text-muted">
                                {dish.ingredients || "Описание отсутствует"}
                              </p>
                              {dish.allergens && (
                                <p className="card-text">
                                  <small className="text-warning">
                                    <strong>Аллергены:</strong> {dish.allergens}
                                  </small>
                                </p>
                              )}
                            </div>
                            <div className="card-footer">
                              <div className="d-flex justify-content-between align-items-center">
                                <span className="h5 mb-0 text-primary">
                                  {formatCurrency(dish.price)}
                                </span>
                                <span className="badge bg-info">
                                  {dish.cookingTimeMin || 15} мин.
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TraneeMenu;
