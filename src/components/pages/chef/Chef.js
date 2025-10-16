import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../../NavBar";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { $authHost } from "../../../http";
import { toast } from "react-toastify";
import socketService from "../../../services/socket";

const Chef = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    activeOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    stoppedDishes: 0,
    myActiveOrders: 0,
    todayPrepared: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState([]);

  const chefCards = [
    {
      title: "👨‍🍳 Активные заказы",
      description: "Управление текущими заказами",
      path: "/chef/orders",
      color: "primary",
      icon: "bi-list-check",
    },
    {
      title: "🍽️ Меню ресторана",
      description: "Просмотр всего меню",
      path: "/chef/menu",
      color: "success",
      icon: "bi-book",
    },
    {
      title: "⏱️ История заказов",
      description: "Просмотр выполненных заказов",
      path: "/chef/history",
      color: "info",
      icon: "bi-clock-history",
    },
    {
      title: "🔧 Настройки",
      description: "Смена пароля и настройки",
      path: "/chef/settings",
      color: "warning",
      icon: "bi-gear",
    },
  ];

  const handleCardClick = (path) => {
    navigate(path);
  };

  const handleRefreshStats = () => {
    loadStatistics();
  };

  const loadStatistics = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      // Получаем все необходимые данные
      const [ordersResponse, dishesResponse, kitchenItemsResponse] =
        await Promise.all([
          $authHost.get("/orders/kitchen").catch(() => ({ data: [] })),
          $authHost.get("/dishes").catch(() => ({ data: { rows: [] } })),
          $authHost.get("/order-items/kitchen").catch(() => ({ data: [] })),
        ]);

      const orders = Array.isArray(ordersResponse.data)
        ? ordersResponse.data
        : [];
      const dishes = Array.isArray(dishesResponse.data?.rows)
        ? dishesResponse.data.rows
        : dishesResponse.data || [];
      const kitchenItems = Array.isArray(kitchenItemsResponse.data)
        ? kitchenItemsResponse.data
        : [];

      console.log("Данные для статистики:", {
        ordersCount: orders.length,
        dishesCount: dishes.length,
        kitchenItemsCount: kitchenItems.length,
        kitchenItemsSample: kitchenItems.slice(0, 3), // Показываем первые 3 для отладки
      });

      // 1. АКТИВНЫЕ ЗАКАЗЫ - заказы, где есть хотя бы одно блюдо со статусом ordered, preparing или ready
      const activeOrders = orders.filter((order) => {
        if (!order.items || !Array.isArray(order.items)) return false;
        return order.items.some((item) =>
          ["ordered", "preparing", "ready"].includes(item.status)
        );
      }).length;

      // 2. ЗАКАЗЫ В ПРИГОТОВЛЕНИИ - заказы, где есть хотя бы одно блюдо со статусом preparing
      const preparingOrders = orders.filter((order) => {
        if (!order.items || !Array.isArray(order.items)) return false;
        return order.items.some((item) => item.status === "preparing");
      }).length;

      // 3. ЗАКАЗЫ ГОТОВЫЕ К ПОДАЧЕ - заказы со статусом ready
      const readyOrders = orders.filter(
        (order) => order.status === "ready"
      ).length;

      // 4. БЛЮДА НА СТОПЕ
      const stoppedDishes = dishes.filter(
        (dish) => dish.isStopped === true
      ).length;

      // 5. МОИ ТЕКУЩИЕ БЛЮДА
      const myActiveOrders = kitchenItems.filter((item) => {
        const isMyItem =
          item.chefId === user?.id || (item.chef && item.chef.id === user?.id);
        return isMyItem && item.status === "preparing";
      }).length;

      // 6. ПРИГОТОВЛЕНО СЕГОДНЯ - НОВАЯ ЛОГИКА
      const today = new Date();
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );

      // Получаем ВСЕ заказы за сегодня для анализа
      const allOrdersResponse = await $authHost.get("/orders");
      const allOrders = Array.isArray(allOrdersResponse.data)
        ? allOrdersResponse.data
        : [];

      // Собираем все блюда из всех заказов за сегодня
      const allItemsToday = [];
      allOrders.forEach((order) => {
        if (order.items && Array.isArray(order.items)) {
          const orderDate = new Date(order.createdAt);
          // Если заказ создан сегодня
          if (orderDate >= todayStart) {
            order.items.forEach((item) => {
              allItemsToday.push({
                ...item,
                orderCreatedAt: order.createdAt,
                orderDate: orderDate,
              });
            });
          }
        }
      });

      const todayPrepared = allItemsToday.filter((item) => {
        // Проверяем, что блюдо приготовлено этим поваром
        const isMyItem =
          item.chefId === user?.id || (item.chef && item.chef.id === user?.id);
        if (!isMyItem) return false;

        // Блюдо считается приготовленным если оно ready или served
        // И оно было в заказе созданном сегодня
        return ["ready", "served"].includes(item.status);
      }).length;

      console.log("Статистика приготовлено сегодня:", {
        allOrdersCount: allOrders.length,
        allItemsTodayCount: allItemsToday.length,
        todayPrepared,
        myItems: allItemsToday
          .filter(
            (item) =>
              item.chefId === user?.id ||
              (item.chef && item.chef.id === user?.id)
          )
          .map((item) => ({
            id: item.id,
            dish: item.dish?.name,
            status: item.status,
            chefId: item.chefId,
            chef: item.chef,
            orderCreatedAt: item.orderCreatedAt,
            orderDate: item.orderDate?.toISOString(),
          })),
      });

      setStats({
        activeOrders,
        preparingOrders,
        readyOrders,
        stoppedDishes,
        myActiveOrders,
        todayPrepared,
      });
    } catch (error) {
      console.error("Ошибка загрузки статистики:", error);
      setError("Не удалось загрузить статистику");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // WebSocket уведомления для повара
  useEffect(() => {
    console.log("Chef: Начало инициализации WebSocket");

    const newOrderHandler = (data) => {
      console.log("Chef: Получено WebSocket уведомление о новом заказе:", data);

      toast.info(`🔥 Новый заказ #${data.order?.id || data.orderId}`, {
        position: "bottom-right",
        autoClose: 5000,
      });

      setNotifications((prev) => [data, ...prev.slice(0, 4)]);
      loadStatistics();
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
      console.error("Chef: Ошибка инициализации WebSocket:", error);
    }

    return () => {
      socketService.unsubscribeAll();
    };
  }, [user, loadStatistics]);

  useEffect(() => {
    loadStatistics();

    const interval = setInterval(loadStatistics, 60000);
    return () => clearInterval(interval);
  }, [loadStatistics]);

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
        {/* Заголовок и приветствие */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card bg-white shadow-sm">
              <div className="card-body">
                <div className="row align-items-center">
                  <div className="col-md-8">
                    <h1 className="h3 mb-2">
                      <i className="bi bi-speedometer2 me-2"></i>
                      Панель повара
                      {socketService.getConnectionStatus() && (
                        <span className="badge bg-success ms-2">
                          <i className="bi bi-wifi"></i> Online
                        </span>
                      )}
                    </h1>
                    <p className="text-muted mb-0">
                      Добро пожаловать, шеф {user?.firstName} {user?.lastName}
                    </p>
                  </div>
                  <div className="col-md-4 text-end">
                    <span className="badge bg-warning fs-6">Повар</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Сообщение об ошибке */}
        {error && (
          <div className="row mb-4">
            <div className="col-12">
              <div className="alert alert-warning d-flex align-items-center justify-content-between">
                <div>
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  {error}
                </div>
                <button
                  className="btn btn-sm btn-outline-warning"
                  onClick={handleRefreshStats}
                >
                  <i className="bi bi-arrow-clockwise me-1"></i>
                  Повторить
                </button>
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

        {/* Быстрая статистика */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-warning">
              <div className="card-header bg-warning text-white d-flex justify-content-between align-items-center">
                <span>
                  <i className="bi bi-info-circle me-2"></i>
                  Кухонная статистика
                </span>
                <div>
                  <small className="me-3">
                    Обновлено: {new Date().toLocaleTimeString()}
                  </small>
                  <button
                    className="btn btn-sm btn-light"
                    onClick={handleRefreshStats}
                    disabled={loading}
                  >
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Обновить
                  </button>
                </div>
              </div>
              <div className="card-body">
                <div className="row text-center">
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-primary mb-1">
                        {stats.activeOrders}
                      </h4>
                      <small className="text-muted">Активных заказов</small>
                    </div>
                  </div>
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-warning mb-1">
                        {stats.preparingOrders}
                      </h4>
                      <small className="text-muted">В приготовлении</small>
                    </div>
                  </div>
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-success mb-1">{stats.readyOrders}</h4>
                      <small className="text-muted">Готовы к подаче</small>
                    </div>
                  </div>
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-danger mb-1">
                        {stats.stoppedDishes}
                      </h4>
                      <small className="text-muted">Блюд на стопе</small>
                    </div>
                  </div>
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-info mb-1">{stats.myActiveOrders}</h4>
                      <small className="text-muted">Мои текущие блюда</small>
                    </div>
                  </div>
                  <div className="col-md-2 mb-3">
                    <div className="border rounded p-3 bg-light">
                      <h4 className="text-dark mb-1">{stats.todayPrepared}</h4>
                      <small className="text-muted">Приготовлено сегодня</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Основные функции */}
        <div className="row">
          <div className="col-12">
            <h4 className="mb-3">
              <i className="bi bi-grid-3x3-gap me-2"></i>
              Управление кухней
            </h4>
          </div>
        </div>

        {/* Карточки функций */}
        <div className="row g-3 justify-content-center">
          {chefCards.map((card, index) => (
            <div key={index} className="col-xl-3 col-lg-4 col-md-6">
              <div
                className={`card border-${card.color} shadow-sm h-100`}
                style={{ cursor: "pointer", transition: "all 0.3s" }}
                onClick={() => handleCardClick(card.path)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 25px rgba(0,0,0,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 2px 10px rgba(0,0,0,0.1)";
                }}
              >
                <div className="card-body text-center">
                  <i
                    className={`bi ${card.icon} text-${card.color} display-4 mb-3`}
                  ></i>
                  <h5 className="card-title">{card.title}</h5>
                  <p className="card-text text-muted">{card.description}</p>
                </div>
                <div
                  className={`card-footer bg-${card.color} bg-opacity-10 text-center`}
                >
                  <small className="text-muted">
                    <i className="bi bi-arrow-right me-1"></i>
                    Перейти
                  </small>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Срочные уведомления */}
        <div className="row mt-4">
          <div className="col-12">
            <div className="card border-danger">
              <div className="card-header bg-danger text-white">
                <i className="bi bi-bell me-2"></i>
                Срочные уведомления
              </div>
              <div className="card-body">
                {stats.stoppedDishes > 0 ? (
                  <div className="alert alert-warning mb-0">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    <strong>Внимание!</strong> {stats.stoppedDishes} блюд(а)
                    находятся на стопе. Проверьте доступность ингредиентов.
                  </div>
                ) : (
                  <p className="text-muted mb-0">
                    <i className="bi bi-check-circle me-2 text-success"></i>
                    Все блюда доступны для заказа
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chef;
