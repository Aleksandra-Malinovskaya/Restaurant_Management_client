import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../../NavBar";
import { $authHost } from "../../../http";
import { useNavigate } from "react-router-dom";

const StatsAdmin = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("daily");

  // Данные статистики
  const [dailyStats, setDailyStats] = useState(null);
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [popularDishes, setPopularDishes] = useState(null);
  const [employeeStats, setEmployeeStats] = useState(null);

  // Фильтры
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split("T")[0],
    startDate: new Date(new Date().setDate(new Date().getDate() - 7))
      .toISOString()
      .split("T")[0],
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    period: "month",
    dishesLimit: 10,
  });

  const handleBack = () => {
    navigate("/admin-panel");
  };

  // Дополнительная статистика по сотрудникам
  const loadEmployeeStats = useCallback(async () => {
    try {
      // Статистика по официантам через UserController
      const waiterStats = await $authHost.get("/users/stats/waiters");
      // Статистика по поварам через UserController
      const chefStats = await $authHost.get("/users/stats/chefs");

      setEmployeeStats({
        waiters: waiterStats.data,
        chefs: chefStats.data,
      });
    } catch (err) {
      console.error("Ошибка загрузки статистики сотрудников:", err);
      // Устанавливаем пустые данные вместо ошибки
      setEmployeeStats({
        waiters: [],
        chefs: [],
      });
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const requests = [];

      // Загружаем данные в зависимости от активной вкладки
      switch (activeTab) {
        case "daily":
          requests.push(
            $authHost
              .get(`/stats/daily?date=${filters.date}`)
              .then((res) => {
                console.log("📊 Daily stats response:", res.data);
                setDailyStats(res.data);
              })
              .catch((err) => {
                console.error("Ошибка загрузки дневной статистики:", err);
                setDailyStats(null);
              })
          );
          break;
        case "weekly":
          requests.push(
            $authHost
              .get(`/stats/weekly?startDate=${filters.startDate}`)
              .then((res) => setWeeklyStats(res.data))
              .catch((err) => {
                console.error("Ошибка загрузки недельной статистики:", err);
                setWeeklyStats(null);
              })
          );
          break;
        case "monthly":
          requests.push(
            $authHost
              .get(`/stats/monthly?year=${filters.year}&month=${filters.month}`)
              .then((res) => {
                console.log("Monthly stats response:", res.data);
                setMonthlyStats(res.data);
              })
              .catch((err) => {
                console.error("Ошибка загрузки месячной статистики:", err);
                setMonthlyStats(null);
              })
          );
          break;
        case "dishes":
          requests.push(
            $authHost
              .get(
                `/stats/popular-dishes?period=${filters.period}&limit=${filters.dishesLimit}`
              )
              .then((res) => setPopularDishes(res.data))
              .catch((err) => {
                console.error("Ошибка загрузки популярных блюд:", err);
                setPopularDishes(null);
              })
          );
          break;
        case "employees":
          requests.push(loadEmployeeStats());
          break;
        default:
          console.warn(`Неизвестная вкладка: ${activeTab}`);
          break;
      }

      await Promise.all(requests);
    } catch (err) {
      console.error("Ошибка загрузки статистики:", err);
      setError("Не удалось загрузить статистику");
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    filters.date,
    filters.startDate,
    filters.year,
    filters.month,
    filters.period,
    filters.dishesLimit,
    loadEmployeeStats,
  ]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Упрощенная функция форматирования чисел
  const formatNumber = (num) => {
    if (num === null || num === undefined || isNaN(num)) return "0";
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Функция для безопасного отображения чисел
  const safeNumber = (num, defaultValue = 0) => {
    if (num === null || num === undefined || isNaN(num)) return defaultValue;
    return num;
  };

  // Функция для расчета среднего чека
  const calculateAverageCheck = (revenue, ordersCount) => {
    if (!revenue || !ordersCount || ordersCount === 0) return 0;
    return revenue / ordersCount;
  };

  // ИСПРАВЛЕННАЯ ФУНКЦИЯ: Обработка статусов заказов
  const getOrderStatuses = (stats) => {
    if (!stats || !stats.orderStatuses) {
      return [];
    }

    // Если orderStatuses - это массив
    if (Array.isArray(stats.orderStatuses)) {
      return stats.orderStatuses;
    }

    // Если orderStatuses - это объект
    if (typeof stats.orderStatuses === "object") {
      return Object.entries(stats.orderStatuses).map(([status, count]) => ({
        status,
        count,
      }));
    }

    return [];
  };

  // Функция для перевода статусов на русский
  const translateStatus = (status) => {
    const statusMap = {
      open: "Открыт",
      in_progress: "В работе",
      ready: "Готов",
      closed: "Закрыт",
      completed: "Завершен",
      pending: "В ожидании",
      paid: "Оплачен",
      cancelled: "Отменен",
      served: "Обслужен",
      payment: "Оплата",
    };

    return statusMap[status] || status;
  };

  // Рендер вкладки дневной статистики - ИСПРАВЛЕННЫЙ
  const renderDailyStats = () => {
    if (!dailyStats)
      return (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-calendar-x display-4"></i>
          <p className="mt-3">Нет данных за выбранную дату</p>
        </div>
      );

    // Получаем статусы заказов
    const orderStatuses = getOrderStatuses(dailyStats);
    console.log("📊 Order statuses data:", orderStatuses);

    return (
      <div className="row">
        <div className="col-12 mb-3">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">
                <i className="bi bi-calendar-day me-2"></i>
                Статистика за{" "}
                {new Date(dailyStats.date || filters.date).toLocaleDateString(
                  "ru-RU"
                )}
              </h5>
            </div>
            <div className="card-body">
              <div className="row">
                {/* Заказы */}
                <div className="col-md-6">
                  <div className="card bg-light">
                    <div className="card-body">
                      <h6 className="card-title text-primary">
                        <i className="bi bi-cart me-2"></i>
                        Заказы
                      </h6>
                      <div className="row text-center">
                        <div className="col-6">
                          <div className="border-end">
                            <h3 className="text-primary">
                              {formatNumber(
                                dailyStats.orders?.total ||
                                  dailyStats.totalOrders ||
                                  0
                              )}
                            </h3>
                            <small className="text-muted">Всего заказов</small>
                          </div>
                        </div>
                        <div className="col-6">
                          <div>
                            <h3 className="text-success">
                              {formatNumber(
                                dailyStats.orders?.revenue ||
                                  dailyStats.totalRevenue ||
                                  0
                              )}
                            </h3>
                            <small className="text-muted">Общая выручка</small>
                          </div>
                        </div>
                      </div>
                      <div className="row text-center mt-3">
                        <div className="col-6">
                          <div className="border-end">
                            <h4 className="text-info">
                              {formatNumber(
                                dailyStats.orders?.averageOrderValue ||
                                  calculateAverageCheck(
                                    dailyStats.orders?.revenue ||
                                      dailyStats.totalRevenue,
                                    dailyStats.orders?.total ||
                                      dailyStats.totalOrders
                                  )
                              )}
                            </h4>
                            <small className="text-muted">Средний чек</small>
                          </div>
                        </div>
                        <div className="col-6">
                          <div>
                            <h4 className="text-warning">
                              {formatNumber(
                                dailyStats.orders?.uniqueWaiters || 0
                              )}
                            </h4>
                            <small className="text-muted">
                              Работало официантов
                            </small>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Бронирования */}
                <div className="col-md-6">
                  <div className="card bg-light">
                    <div className="card-body">
                      <h6 className="card-title text-success">
                        <i className="bi bi-calendar-check me-2"></i>
                        Бронирования
                      </h6>
                      <div className="row text-center">
                        <div className="col-6">
                          <div className="border-end">
                            <h3 className="text-success">
                              {formatNumber(
                                dailyStats.reservations?.total ||
                                  dailyStats.totalReservations ||
                                  0
                              )}
                            </h3>
                            <small className="text-muted">
                              Всего бронирований
                            </small>
                          </div>
                        </div>
                        <div className="col-6">
                          <div>
                            <h3 className="text-info">
                              {formatNumber(
                                dailyStats.reservations?.totalGuests ||
                                  dailyStats.totalGuests ||
                                  0
                              )}
                            </h3>
                            <small className="text-muted">Всего гостей</small>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ИСПРАВЛЕННЫЙ БЛОК: Статусы заказов */}
              <div className="row mt-4">
                <div className="col-12">
                  <div className="card">
                    <div className="card-header">
                      <h6 className="card-title mb-0">Статусы заказов</h6>
                    </div>
                    <div className="card-body">
                      {orderStatuses.length > 0 ? (
                        <div className="row">
                          {orderStatuses.map((statusItem, index) => {
                            const status = statusItem.status || statusItem.name;
                            const count =
                              statusItem.count ||
                              statusItem.value ||
                              statusItem.quantity;

                            if (!status || count === undefined) return null;

                            return (
                              <div
                                key={status || index}
                                className="col-md-3 col-6 mb-2"
                              >
                                <div className="d-flex justify-content-between align-items-center p-2 border rounded">
                                  <span className="text-capitalize">
                                    {translateStatus(status)}
                                  </span>
                                  <span className="badge bg-primary">
                                    {formatNumber(count)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {/* Добавляем фиксированные статусы, если их нет в данных */}
                          {!orderStatuses.some((s) => s.status === "open") && (
                            <div className="col-md-3 col-6 mb-2">
                              <div className="d-flex justify-content-between align-items-center p-2 border rounded">
                                <span>Открыт</span>
                                <span className="badge bg-secondary">0</span>
                              </div>
                            </div>
                          )}

                          {!orderStatuses.some(
                            (s) => s.status === "in_progress"
                          ) && (
                            <div className="col-md-3 col-6 mb-2">
                              <div className="d-flex justify-content-between align-items-center p-2 border rounded">
                                <span>В работе</span>
                                <span className="badge bg-secondary">0</span>
                              </div>
                            </div>
                          )}

                          {!orderStatuses.some((s) => s.status === "ready") && (
                            <div className="col-md-3 col-6 mb-2">
                              <div className="d-flex justify-content-between align-items-center p-2 border rounded">
                                <span>Готов</span>
                                <span className="badge bg-secondary">0</span>
                              </div>
                            </div>
                          )}

                          {!orderStatuses.some(
                            (s) => s.status === "closed"
                          ) && (
                            <div className="col-md-3 col-6 mb-2">
                              <div className="d-flex justify-content-between align-items-center p-2 border rounded">
                                <span>Закрыт</span>
                                <span className="badge bg-secondary">0</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        // Если нет данных о статусах, показываем фиксированный набор
                        <div className="row">
                          {["open", "in_progress", "ready", "closed"].map(
                            (status) => (
                              <div key={status} className="col-md-3 col-6 mb-2">
                                <div className="d-flex justify-content-between align-items-center p-2 border rounded">
                                  <span className="text-capitalize">
                                    {translateStatus(status)}
                                  </span>
                                  <span className="badge bg-secondary">0</span>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Остальные функции рендеринга (weeklyStats, monthlyStats, popularDishes, employeeStats)
  // остаются без изменений...

  // Рендер вкладки недельной статистики
  const renderWeeklyStats = () => {
    if (!weeklyStats)
      return (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-calendar-x display-4"></i>
          <p className="mt-3">Нет данных за выбранную неделю</p>
        </div>
      );

    return (
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">
                <i className="bi bi-calendar-week me-2"></i>
                Недельная статистика ({weeklyStats.period?.start} -{" "}
                {weeklyStats.period?.end})
              </h5>
            </div>
            <div className="card-body">
              {/* Итоги недели */}
              <div className="row mb-4">
                <div className="col-md-3">
                  <div className="card bg-primary text-white">
                    <div className="card-body text-center">
                      <h3>{formatNumber(weeklyStats.totals?.orders?.total)}</h3>
                      <small>Всего заказов</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card bg-success text-white">
                    <div className="card-body text-center">
                      <h3>
                        {formatNumber(weeklyStats.totals?.orders?.revenue)}
                      </h3>
                      <small>Общая выручка</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card bg-info text-white">
                    <div className="card-body text-center">
                      <h3>
                        {formatNumber(weeklyStats.totals?.reservations?.total)}
                      </h3>
                      <small>Бронирования</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="card bg-warning text-white">
                    <div className="card-body text-center">
                      <h3>
                        {formatNumber(
                          weeklyStats.totals?.reservations?.totalGuests
                        )}
                      </h3>
                      <small>Всего гостей</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ежедневная статистика */}
              <div className="card">
                <div className="card-header">
                  <h6 className="card-title mb-0">Статистика по дням</h6>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-striped">
                      <thead>
                        <tr>
                          <th>Дата</th>
                          <th>Заказы</th>
                          <th>Выручка</th>
                          <th>Средний чек</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(weeklyStats.dailyStats || []).map((day) => (
                          <tr key={day.date}>
                            <td>
                              {new Date(day.date).toLocaleDateString("ru-RU")}
                            </td>
                            <td>
                              <span className="badge bg-primary">
                                {formatNumber(day.ordersCount)}
                              </span>
                            </td>
                            <td className="text-success fw-bold">
                              {formatNumber(day.dailyRevenue)}
                            </td>
                            <td className="text-info">
                              {formatNumber(
                                calculateAverageCheck(
                                  day.dailyRevenue,
                                  day.ordersCount
                                )
                              )}
                            </td>
                          </tr>
                        ))}
                        {(weeklyStats.dailyStats || []).length === 0 && (
                          <tr>
                            <td
                              colSpan="4"
                              className="text-center text-muted py-3"
                            >
                              Нет данных за выбранную неделю
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Рендер вкладки месячной статистики
  const renderMonthlyStats = () => {
    if (!monthlyStats)
      return (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-calendar-x display-4"></i>
          <p className="mt-3">Нет данных за выбранный месяц</p>
        </div>
      );

    // Получаем данные для расчета среднего чека
    const ordersTotal = monthlyStats.totals?.orders?.total || 0;
    const ordersRevenue = monthlyStats.totals?.orders?.revenue || 0;
    const averageOrderValue =
      monthlyStats.totals?.orders?.averageOrderValue ||
      calculateAverageCheck(ordersRevenue, ordersTotal);

    return (
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">
                <i className="bi bi-calendar-month me-2"></i>
                Статистика за {monthlyStats.period?.monthName}{" "}
                {monthlyStats.period?.year}
              </h5>
            </div>
            <div className="card-body">
              {/* Ключевые метрики */}
              <div className="row mb-4">
                <div className="col-md-2">
                  <div className="card border-primary">
                    <div className="card-body text-center">
                      <h4 className="text-primary">
                        {formatNumber(ordersTotal)}
                      </h4>
                      <small className="text-muted">Заказов</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-2">
                  <div className="card border-success">
                    <div className="card-body text-center">
                      <h4 className="text-success">
                        {formatNumber(ordersRevenue)}
                      </h4>
                      <small className="text-muted">Выручка</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-2">
                  <div className="card border-info">
                    <div className="card-body text-center">
                      <h4 className="text-info">
                        {formatNumber(averageOrderValue)}
                      </h4>
                      <small className="text-muted">Средний чек</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-2">
                  <div className="card border-warning">
                    <div className="card-body text-center">
                      <h4 className="text-warning">
                        {formatNumber(
                          safeNumber(monthlyStats.totals?.orders?.maxOrderValue)
                        )}
                      </h4>
                      <small className="text-muted">Макс. заказ</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-2">
                  <div className="card border-secondary">
                    <div className="card-body text-center">
                      <h4 className="text-secondary">
                        {formatNumber(monthlyStats.totals?.reservations?.total)}
                      </h4>
                      <small className="text-muted">Бронирований</small>
                    </div>
                  </div>
                </div>
                <div className="col-md-2">
                  <div className="card border-dark">
                    <div className="card-body text-center">
                      <h4 className="text-dark">
                        {formatNumber(
                          monthlyStats.totals?.reservations?.totalGuests
                        )}
                      </h4>
                      <small className="text-muted">Гостей</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ежедневная статистика */}
              <div className="card">
                <div className="card-header">
                  <h6 className="card-title mb-0">Ежедневная статистика</h6>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-sm table-hover">
                      <thead>
                        <tr>
                          <th>Дата</th>
                          <th>Заказы</th>
                          <th>Выручка</th>
                          <th>Средний чек</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(monthlyStats.dailyStats || []).map((day) => {
                          const dayAverageCheck =
                            day.averageOrderValue ||
                            calculateAverageCheck(
                              day.dailyRevenue,
                              day.ordersCount
                            );

                          return (
                            <tr key={day.date}>
                              <td>
                                {new Date(day.date).toLocaleDateString("ru-RU")}
                              </td>
                              <td>
                                <span className="badge bg-primary">
                                  {formatNumber(day.ordersCount)}
                                </span>
                              </td>
                              <td className="text-success fw-bold">
                                {formatNumber(day.dailyRevenue)}
                              </td>
                              <td className="text-info">
                                {formatNumber(dayAverageCheck)}
                              </td>
                            </tr>
                          );
                        })}
                        {(monthlyStats.dailyStats || []).length === 0 && (
                          <tr>
                            <td
                              colSpan="4"
                              className="text-center text-muted py-3"
                            >
                              Нет данных за выбранный месяц
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Рендер вкладки популярных блюд
  const renderPopularDishes = () => {
    if (!popularDishes)
      return (
        <div className="text-center py-5 text-muted">
          <i className="bi bi-egg display-4"></i>
          <p className="mt-3">Нет данных о популярных блюдах</p>
        </div>
      );

    return (
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">
                <i className="bi bi-graph-up me-2"></i>
                Популярные блюда ({popularDishes.period})
              </h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Блюдо</th>
                      <th>Цена</th>
                      <th>Количество</th>
                      <th>Выручка</th>
                      <th>Уникальных заказов</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(popularDishes.popularDishes || []).map((dish, index) => (
                      <tr key={dish.dishId}>
                        <td>
                          <span className="badge bg-primary">{index + 1}</span>
                        </td>
                        <td className="fw-bold">{dish.dishName}</td>
                        <td>{formatNumber(dish.price)}</td>
                        <td>
                          <span className="badge bg-success">
                            {formatNumber(dish.totalQuantity)}
                          </span>
                        </td>
                        <td className="text-success fw-bold">
                          {formatNumber(dish.totalRevenue)}
                        </td>
                        <td>
                          <span className="badge bg-info">
                            {formatNumber(dish.uniqueOrders)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(popularDishes.popularDishes || []).length === 0 && (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-3">
                          Нет данных о популярных блюдах
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Рендер вкладки сотрудников
  const renderEmployeeStats = () => {
    if (!employeeStats)
      return (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Загрузка...</span>
          </div>
          <p className="mt-3">Загрузка статистики сотрудников...</p>
        </div>
      );

    return (
      <div className="row">
        {/* Статистика по официантам */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">
                <i className="bi bi-people me-2"></i>
                Официанты
              </h5>
            </div>
            <div className="card-body">
              {(employeeStats.waiters || []).length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Официант</th>
                        <th>Заказы</th>
                        <th>Выручка</th>
                        <th>Средний чек</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(employeeStats.waiters || []).map((waiter) => {
                        const waiterAverageCheck =
                          waiter.averageOrderValue ||
                          calculateAverageCheck(
                            waiter.totalRevenue,
                            waiter.totalOrders
                          );

                        return (
                          <tr key={waiter.waiterId}>
                            <td>{waiter.waiterName}</td>
                            <td>
                              <span className="badge bg-primary">
                                {formatNumber(waiter.totalOrders)}
                              </span>
                            </td>
                            <td className="text-success fw-bold">
                              {formatNumber(waiter.totalRevenue)}
                            </td>
                            <td className="text-info">
                              {formatNumber(waiterAverageCheck)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-muted py-3">
                  <i className="bi bi-info-circle display-4"></i>
                  <p className="mt-2">Нет данных по официантам</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Статистика по поварам */}
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">
                <i className="bi bi-egg-fried me-2"></i>
                Повара
              </h5>
            </div>
            <div className="card-body">
              {(employeeStats.chefs || []).length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Повар</th>
                        <th>Блюд приготовлено</th>
                        <th>Среднее время</th>
                        <th>Активных заказов</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(employeeStats.chefs || []).map((chef) => (
                        <tr key={chef.chefId}>
                          <td>{chef.chefName}</td>
                          <td>
                            <span className="badge bg-success">
                              {formatNumber(chef.totalDishesPrepared)}
                            </span>
                          </td>
                          <td className="text-info">
                            {formatNumber(chef.averagePreparationTime)} мин
                          </td>
                          <td>
                            <span className="badge bg-warning">
                              {formatNumber(chef.activeOrders)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-muted py-3">
                  <i className="bi bi-info-circle display-4"></i>
                  <p className="mt-2">Нет данных по поварам</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
                          <i className="bi bi-graph-up-arrow me-2"></i>
                          Статистика ресторана
                        </h1>
                        <p className="text-muted mb-0">
                          Аналитика продаж, бронирований и эффективности работы
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 text-end">
                    <div className="text-muted">
                      <i className="bi bi-calendar me-1"></i>
                      {new Date().toLocaleDateString("ru-RU", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
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

        {/* Вкладки */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <ul className="nav nav-tabs card-header-tabs">
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        activeTab === "daily" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("daily")}
                    >
                      <i className="bi bi-calendar-day me-1"></i>
                      День
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        activeTab === "weekly" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("weekly")}
                    >
                      <i className="bi bi-calendar-week me-1"></i>
                      Неделя
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        activeTab === "monthly" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("monthly")}
                    >
                      <i className="bi bi-calendar-month me-1"></i>
                      Месяц
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        activeTab === "dishes" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("dishes")}
                    >
                      <i className="bi bi-egg-fried me-1"></i>
                      Популярные блюда
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      className={`nav-link ${
                        activeTab === "employees" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("employees")}
                    >
                      <i className="bi bi-people me-1"></i>
                      Сотрудники
                    </button>
                  </li>
                </ul>
              </div>
              <div className="card-body">
                {/* Фильтры */}
                <div className="row mb-4">
                  <div className="col-12">
                    <div className="card bg-light">
                      <div className="card-body py-3">
                        <div className="row g-3 align-items-center">
                          {activeTab === "daily" && (
                            <div className="col-md-3">
                              <label className="form-label">Дата</label>
                              <input
                                type="date"
                                className="form-control"
                                value={filters.date}
                                onChange={(e) =>
                                  setFilters((prev) => ({
                                    ...prev,
                                    date: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          )}
                          {activeTab === "weekly" && (
                            <div className="col-md-3">
                              <label className="form-label">
                                Начало недели
                              </label>
                              <input
                                type="date"
                                className="form-control"
                                value={filters.startDate}
                                onChange={(e) =>
                                  setFilters((prev) => ({
                                    ...prev,
                                    startDate: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          )}
                          {activeTab === "monthly" && (
                            <>
                              <div className="col-md-3">
                                <label className="form-label">Год</label>
                                <select
                                  className="form-select"
                                  value={filters.year}
                                  onChange={(e) =>
                                    setFilters((prev) => ({
                                      ...prev,
                                      year: parseInt(e.target.value),
                                    }))
                                  }
                                >
                                  {[2023, 2024, 2025].map((year) => (
                                    <option key={year} value={year}>
                                      {year}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="col-md-3">
                                <label className="form-label">Месяц</label>
                                <select
                                  className="form-select"
                                  value={filters.month}
                                  onChange={(e) =>
                                    setFilters((prev) => ({
                                      ...prev,
                                      month: parseInt(e.target.value),
                                    }))
                                  }
                                >
                                  {Array.from(
                                    { length: 12 },
                                    (_, i) => i + 1
                                  ).map((month) => (
                                    <option key={month} value={month}>
                                      {new Date(
                                        2023,
                                        month - 1
                                      ).toLocaleDateString("ru-RU", {
                                        month: "long",
                                      })}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </>
                          )}
                          {activeTab === "dishes" && (
                            <>
                              <div className="col-md-3">
                                <label className="form-label">Период</label>
                                <select
                                  className="form-select"
                                  value={filters.period}
                                  onChange={(e) =>
                                    setFilters((prev) => ({
                                      ...prev,
                                      period: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="day">День</option>
                                  <option value="week">Неделя</option>
                                  <option value="month">Месяц</option>
                                  <option value="year">Год</option>
                                </select>
                              </div>
                              <div className="col-md-3">
                                <label className="form-label">Лимит</label>
                                <select
                                  className="form-select"
                                  value={filters.dishesLimit}
                                  onChange={(e) =>
                                    setFilters((prev) => ({
                                      ...prev,
                                      dishesLimit: parseInt(e.target.value),
                                    }))
                                  }
                                >
                                  <option value="5">Топ 5</option>
                                  <option value="10">Топ 10</option>
                                  <option value="20">Топ 20</option>
                                </select>
                              </div>
                            </>
                          )}
                          <div className="col-md-3">
                            <button
                              className="btn btn-primary mt-4"
                              onClick={loadStats}
                              disabled={loading}
                            >
                              {loading ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-2" />
                                  Загрузка...
                                </>
                              ) : (
                                <>
                                  <i className="bi bi-arrow-clockwise me-2"></i>
                                  Обновить
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Контент вкладки */}
                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Загрузка...</span>
                    </div>
                    <p className="mt-3 text-muted">Загрузка статистики...</p>
                  </div>
                ) : (
                  <>
                    {activeTab === "daily" && renderDailyStats()}
                    {activeTab === "weekly" && renderWeeklyStats()}
                    {activeTab === "monthly" && renderMonthlyStats()}
                    {activeTab === "dishes" && renderPopularDishes()}
                    {activeTab === "employees" && renderEmployeeStats()}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsAdmin;
