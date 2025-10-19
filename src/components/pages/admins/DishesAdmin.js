import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../../NavBar";
import { useNavigate } from "react-router-dom";
import { $authHost } from "../../../http";

const DishesAdmin = () => {
  const navigate = useNavigate();
  const [dishes, setDishes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingDish, setEditingDish] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    ingredients: "",
    allergens: "",
    nutritionInfo: "",
    price: "",
    cookingTimeMin: 15,
    isActive: true,
    isStopped: false,
    categoryId: "",
    img: null,
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 9,
  });
  const [filters, setFilters] = useState({
    sortBy: "name",
    sortOrder: "asc",
    categoryId: "",
    status: "all",
    search: "",
  });

  const safeArray = (data) => {
    if (!data) return [];
    return Array.isArray(data) ? data : [];
  };

  const buildQueryString = useCallback(
    (page = 1) => {
      const params = new URLSearchParams();
      params.append("page", page);
      params.append("limit", pagination.limit);

      if (filters.categoryId) {
        params.append("categoryId", filters.categoryId);
      }
      if (filters.status !== "all") {
        params.append("isActive", filters.status === "active");
      }

      return params.toString();
    },
    [pagination.limit, filters.categoryId, filters.status]
  );

  const applySorting = useCallback(
    (dishesData) => {
      return [...dishesData].sort((a, b) => {
        let aValue, bValue;

        switch (filters.sortBy) {
          case "name":
            aValue = a.name?.toLowerCase() || "";
            bValue = b.name?.toLowerCase() || "";
            break;
          case "price":
            aValue = parseFloat(a.price) || 0;
            bValue = parseFloat(b.price) || 0;
            break;
          case "cookingTime":
            aValue = a.cookingTimeMin || 0;
            bValue = b.cookingTimeMin || 0;
            break;
          case "createdAt":
            aValue = new Date(a.createdAt).getTime();
            bValue = new Date(b.createdAt).getTime();
            break;
          default:
            aValue = a.name?.toLowerCase() || "";
            bValue = b.name?.toLowerCase() || "";
        }

        if (filters.sortOrder === "asc") {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
    },
    [filters.sortBy, filters.sortOrder]
  );

  const loadDishes = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError("");

        const queryString = buildQueryString(page);
        const [dishesResponse, categoriesResponse] = await Promise.all([
          $authHost.get(`/dishes?${queryString}`).catch((err) => {
            console.error("Ошибка загрузки блюд:", err);
            return { data: { rows: [], count: 0 } };
          }),
          $authHost.get("/categories").catch((err) => {
            console.error("Ошибка загрузки категорий:", err);
            return { data: { rows: [] } };
          }),
        ]);

        let dishesData = dishesResponse.data?.rows || dishesResponse.data || [];
        const categoriesData =
          categoriesResponse.data?.rows || categoriesResponse.data || [];
        const totalCount = dishesResponse.data?.count || 0;

        // Применяем сортировку на клиенте
        dishesData = applySorting(dishesData);

        // Применяем поиск на клиенте
        if (filters.search) {
          dishesData = dishesData.filter(
            (dish) =>
              dish.name.toLowerCase().includes(filters.search.toLowerCase()) ||
              dish.ingredients
                ?.toLowerCase()
                .includes(filters.search.toLowerCase())
          );
        }

        setDishes(safeArray(dishesData));
        setCategories(safeArray(categoriesData));
        setPagination((prev) => ({
          ...prev,
          currentPage: page,
          totalCount,
          totalPages: Math.ceil(totalCount / prev.limit),
        }));
      } catch (error) {
        console.error("Общая ошибка загрузки:", error);
        setError("Не удалось загрузить данные");
        setDishes([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    },
    [buildQueryString, applySorting, filters.search]
  );

  useEffect(() => {
    loadDishes(1);
  }, [loadDishes]);

  const handleBack = () => {
    navigate("/admin-panel");
  };

  const handleAddNew = () => {
    setEditingDish(null);
    setFormData({
      name: "",
      ingredients: "",
      allergens: "",
      nutritionInfo: "",
      price: "",
      cookingTimeMin: 15,
      isActive: false, // Можно создать неактивное блюдо
      isStopped: false, // Можно создать на стопе
      categoryId: categories[0]?.id || "",
      img: null,
    });
    setShowModal(true);
  };

  const handleEdit = (dish) => {
    setEditingDish(dish);
    setFormData({
      name: dish.name || "",
      ingredients: dish.ingredients || "",
      allergens: dish.allergens || "",
      nutritionInfo: dish.nutritionInfo || "",
      price: dish.price || "",
      cookingTimeMin: dish.cookingTimeMin || 15,
      isActive: dish.isActive !== undefined ? dish.isActive : true,
      isStopped: dish.isStopped !== undefined ? dish.isStopped : false,
      categoryId: dish.categoryId || "",
      img: null,
    });
    setShowModal(true);
  };

  const handleDelete = async (dishId) => {
    if (!window.confirm("Вы уверены, что хотите удалить это блюдо?")) {
      return;
    }

    try {
      await $authHost.delete(`/dishes/${dishId}`);
      await loadDishes(pagination.currentPage);
    } catch (error) {
      console.error("Ошибка удаления блюда:", error);
      setError("Не удалось удалить блюдо");
    }
  };

  const handleToggleActive = async (dish) => {
    try {
      // Отправляем только необходимые поля для изменения статуса
      await $authHost.put(`/dishes/${dish.id}`, {
        isActive: !dish.isActive,
        // Оставляем остальные поля без изменений
        name: dish.name,
        price: dish.price,
        categoryId: dish.categoryId,
        ingredients: dish.ingredients,
        allergens: dish.allergens,
        nutritionInfo: dish.nutritionInfo,
        cookingTimeMin: dish.cookingTimeMin,
        isStopped: dish.isStopped, // Важно: сохраняем текущее значение стопа
      });
      await loadDishes(pagination.currentPage);
    } catch (error) {
      console.error("Ошибка изменения статуса блюда:", error);
      console.error("Детали ошибки:", error.response?.data);
      setError("Не удалось изменить статус блюда");
    }
  };

  const handleToggleStop = async (dish) => {
    try {
      await $authHost.put(`/dishes/${dish.id}/stop`, {
        isStopped: !dish.isStopped,
      });
      await loadDishes(pagination.currentPage);
    } catch (error) {
      console.error("Ошибка изменения стоп-статуса блюда:", error);
      console.error("Детали ошибки:", error.response?.data);
      setError("Не удалось изменить стоп-статус блюда");
    }
  };

  const checkDishNameExists = async (name, excludeId = null) => {
    try {
      const response = await $authHost.get("/dishes");
      const allDishes = response.data?.rows || response.data || [];
      return allDishes.some(
        (dish) =>
          dish.name.toLowerCase() === name.toLowerCase() &&
          dish.id !== excludeId
      );
    } catch (error) {
      console.error("Ошибка проверки названия:", error);
      return false;
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      // Проверка минимального времени приготовления
      if (parseInt(formData.cookingTimeMin) < 15) {
        setError("Минимальное время приготовления - 15 минут");
        return;
      }

      // Проверка уникальности названия
      const nameExists = await checkDishNameExists(
        formData.name,
        editingDish?.id
      );
      if (nameExists) {
        setError("Блюдо с таким названием уже существует");
        return;
      }

      const submitData = new FormData();
      submitData.append("name", formData.name);
      submitData.append("ingredients", formData.ingredients);
      submitData.append("allergens", formData.allergens);
      submitData.append("nutritionInfo", formData.nutritionInfo);
      submitData.append("price", parseFloat(formData.price));
      submitData.append("cookingTimeMin", parseInt(formData.cookingTimeMin));
      submitData.append("isActive", formData.isActive.toString()); // Преобразуем в строку
      submitData.append("isStopped", formData.isStopped.toString()); // Преобразуем в строку
      submitData.append("categoryId", formData.categoryId);

      if (formData.img) {
        submitData.append("img", formData.img);
      }

      console.log("Отправка данных...");
      console.log("isActive:", formData.isActive);
      console.log("isStopped:", formData.isStopped);

      if (editingDish) {
        await $authHost.put(`/dishes/${editingDish.id}`, submitData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        await $authHost.post("/dishes", submitData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      }

      setShowModal(false);
      await loadDishes(pagination.currentPage);
    } catch (error) {
      console.error("Полная ошибка:", error);
      console.error("Response data:", error.response?.data);
      console.error("Response status:", error.response?.status);

      if (error.response?.data?.message?.includes("названием уже существует")) {
        setError("Блюдо с таким названием уже существует");
      } else {
        setError(
          `Не удалось ${editingDish ? "обновить" : "добавить"} блюдо: ${
            error.response?.data?.message || error.message
          }`
        );
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked, files } = e.target;

    // Проверка минимального времени приготовления при вводе
    if (name === "cookingTimeMin" && parseInt(value) < 15) {
      setError("Минимальное время приготовления - 15 минут");
    } else if (name === "cookingTimeMin" && parseInt(value) >= 15) {
      setError("");
    }

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? checked : type === "file" ? files[0] : value,
    }));
  };

  const handleFilterChange = (filterName, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterName]: value,
    }));
  };

  const handleSortChange = (sortBy) => {
    setFilters((prev) => ({
      ...prev,
      sortBy,
      sortOrder:
        prev.sortBy === sortBy && prev.sortOrder === "asc" ? "desc" : "asc",
    }));
  };

  const clearFilters = () => {
    setFilters({
      sortBy: "name",
      sortOrder: "asc",
      categoryId: "",
      status: "all",
      search: "",
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getImageUrl = (imgUrl) => {
    if (!imgUrl) return null;
    if (imgUrl.startsWith("http")) return imgUrl;
    return `http://localhost:5000${imgUrl}`;
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadDishes(newPage);
    }
  };

  const dishesList = safeArray(dishes);
  const categoriesList = safeArray(categories);

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
                          <i className="bi bi-egg-fried me-2"></i>
                          Управление блюдами
                        </h1>
                        <p className="text-muted mb-0">
                          Всего блюд: {pagination.totalCount}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 text-end">
                    <button className="btn btn-primary" onClick={handleAddNew}>
                      <i className="bi bi-plus-circle me-1"></i>
                      Добавить блюдо
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

        {/* Фильтры и сортировка */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-light">
                <h6 className="card-title mb-0">
                  <i className="bi bi-funnel me-2"></i>
                  Фильтры и сортировка
                </h6>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label">Поиск</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Поиск по названию или ингредиентам..."
                      value={filters.search}
                      onChange={(e) =>
                        handleFilterChange("search", e.target.value)
                      }
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Категория</label>
                    <select
                      className="form-select"
                      value={filters.categoryId}
                      onChange={(e) =>
                        handleFilterChange("categoryId", e.target.value)
                      }
                    >
                      <option value="">Все категории</option>
                      {categoriesList.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Статус</label>
                    <select
                      className="form-select"
                      value={filters.status}
                      onChange={(e) =>
                        handleFilterChange("status", e.target.value)
                      }
                    >
                      <option value="all">Все</option>
                      <option value="active">Активные</option>
                      <option value="inactive">Неактивные</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Сортировка</label>
                    <div className="input-group">
                      <select
                        className="form-select"
                        value={filters.sortBy}
                        onChange={(e) => handleSortChange(e.target.value)}
                      >
                        <option value="name">По названию</option>
                        <option value="price">По цене</option>
                        <option value="cookingTime">
                          По времени приготовления
                        </option>
                        <option value="createdAt">По дате создания</option>
                      </select>
                      <button
                        className="btn btn-outline-secondary"
                        type="button"
                        onClick={() => handleSortChange(filters.sortBy)}
                      >
                        <i
                          className={`bi ${
                            filters.sortOrder === "asc"
                              ? "bi-sort-up"
                              : "bi-sort-down"
                          }`}
                        ></i>
                      </button>
                    </div>
                  </div>
                  <div className="col-md-2 d-flex align-items-end">
                    <button
                      className="btn btn-outline-secondary w-100"
                      onClick={clearFilters}
                    >
                      <i className="bi bi-arrow-clockwise me-1"></i>
                      Сбросить
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-white d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                  <i className="bi bi-list me-2"></i>
                  Список блюд
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
                {dishesList.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="bi bi-egg-fried display-1 text-muted"></i>
                    <h5 className="mt-3">Блюд не найдено</h5>
                    <p className="text-muted">
                      Попробуйте изменить параметры фильтрации
                    </p>
                    <button
                      className="btn btn-primary me-2"
                      onClick={clearFilters}
                    >
                      <i className="bi bi-arrow-clockwise me-1"></i>
                      Сбросить фильтры
                    </button>
                    <button
                      className="btn btn-outline-primary"
                      onClick={handleAddNew}
                    >
                      <i className="bi bi-plus-circle me-1"></i>
                      Добавить блюдо
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="row g-3">
                      {dishesList.map((dish) => (
                        <div
                          key={dish.id}
                          className="col-xl-4 col-lg-6 col-md-6"
                        >
                          <div
                            className={`card h-100 ${
                              !dish.isActive ? "opacity-50" : ""
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
                                <span
                                  className={`badge ${
                                    dish.isActive ? "bg-success" : "bg-danger"
                                  } me-1`}
                                >
                                  {dish.isActive ? "Активно" : "Неактивно"}
                                </span>
                                <span
                                  className={`badge ${
                                    dish.isStopped
                                      ? "bg-warning"
                                      : "bg-secondary"
                                  }`}
                                >
                                  {dish.isStopped ? "На стопе" : "Доступно"}
                                </span>
                              </div>
                            </div>
                            <div className="card-body">
                              <h5 className="card-title">
                                {dish.name || "Без названия"}
                              </h5>
                              <p className="card-text text-muted small">
                                <strong>Ингредиенты:</strong>{" "}
                                {dish.ingredients || "Не указаны"}
                              </p>
                              {dish.allergens && (
                                <p className="card-text text-muted small">
                                  <strong>Аллергены:</strong> {dish.allergens}
                                </p>
                              )}
                              <div className="mb-2">
                                <strong className="text-primary">
                                  {formatCurrency(dish.price || 0)}
                                </strong>
                                <span className="text-muted ms-2">
                                  • {dish.cookingTimeMin || 15} мин
                                </span>
                              </div>
                              <small className="text-muted">
                                Категория:{" "}
                                {dish.category?.name ||
                                  categoriesList.find(
                                    (c) => c.id === dish.categoryId
                                  )?.name ||
                                  "Не указана"}
                              </small>
                            </div>
                            <div className="card-footer bg-transparent">
                              <div className="btn-group w-100">
                                <button
                                  className="btn btn-outline-primary btn-sm"
                                  onClick={() => handleEdit(dish)}
                                >
                                  <i className="bi bi-pencil"></i>
                                </button>
                                <button
                                  className={`btn btn-sm ${
                                    dish.isActive
                                      ? "btn-outline-warning"
                                      : "btn-outline-success"
                                  }`}
                                  onClick={() => handleToggleActive(dish)}
                                  title={
                                    dish.isActive
                                      ? "Деактивировать"
                                      : "Активировать"
                                  }
                                >
                                  <i
                                    className={`bi ${
                                      dish.isActive ? "bi-pause" : "bi-play"
                                    }`}
                                  ></i>
                                </button>
                                <button
                                  className={`btn btn-sm ${
                                    dish.isStopped
                                      ? "btn-outline-info"
                                      : "btn-outline-warning"
                                  }`}
                                  onClick={() => handleToggleStop(dish)}
                                  title={
                                    dish.isStopped
                                      ? "Снять со стопа"
                                      : "Поставить на стоп"
                                  }
                                >
                                  <i
                                    className={`bi ${
                                      dish.isStopped
                                        ? "bi-play"
                                        : "bi-slash-circle"
                                    }`}
                                  ></i>
                                </button>
                                <button
                                  className="btn btn-outline-danger btn-sm"
                                  onClick={() => handleDelete(dish.id)}
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

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
                            {[...Array(pagination.totalPages)].map(
                              (_, index) => (
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
                              )
                            )}
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
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Модальное окно */}
        {showModal && (
          <div
            className="modal show d-block"
            tabIndex="-1"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {editingDish
                      ? "Редактирование блюда"
                      : "Добавление нового блюда"}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowModal(false)}
                  ></button>
                </div>
                <form onSubmit={handleFormSubmit}>
                  <div className="modal-body">
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label">Название блюда *</label>
                        <input
                          type="text"
                          className="form-control"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Категория *</label>
                        <select
                          className="form-select"
                          name="categoryId"
                          value={formData.categoryId}
                          onChange={handleInputChange}
                          required
                        >
                          <option value="">Выберите категорию</option>
                          {categoriesList.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-12">
                        <label className="form-label">Ингредиенты</label>
                        <textarea
                          className="form-control"
                          rows="3"
                          name="ingredients"
                          value={formData.ingredients}
                          onChange={handleInputChange}
                          placeholder="Перечислите ингредиенты через запятую"
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Аллергены</label>
                        <input
                          type="text"
                          className="form-control"
                          name="allergens"
                          value={formData.allergens}
                          onChange={handleInputChange}
                          placeholder="Глютен, лактоза, орехи и т.д."
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Пищевая ценность</label>
                        <input
                          type="text"
                          className="form-control"
                          name="nutritionInfo"
                          value={formData.nutritionInfo}
                          onChange={handleInputChange}
                          placeholder="Ккал, белки, жиры, углеводы"
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">Цена *</label>
                        <input
                          type="number"
                          className="form-control"
                          name="price"
                          value={formData.price}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">
                          Время приготовления (мин) *
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          name="cookingTimeMin"
                          value={formData.cookingTimeMin}
                          onChange={handleInputChange}
                          min="15"
                          required
                        />
                        <div className="form-text text-warning">
                          Минимальное время приготовления - 15 минут
                        </div>
                      </div>
                      <div className="col-12">
                        <label className="form-label">Изображение блюда</label>
                        <input
                          type="file"
                          className="form-control"
                          name="img"
                          accept="image/*"
                          onChange={handleInputChange}
                        />
                        <div className="form-text">
                          {editingDish?.imgUrl &&
                            "Текущее изображение будет заменено"}
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            name="isActive"
                            checked={formData.isActive}
                            onChange={handleInputChange}
                            id="isActive"
                          />
                          <label
                            className="form-check-label"
                            htmlFor="isActive"
                          >
                            Блюдо активно
                          </label>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            name="isStopped"
                            checked={formData.isStopped}
                            onChange={handleInputChange}
                            id="isStopped"
                          />
                          <label
                            className="form-check-label"
                            htmlFor="isStopped"
                          >
                            Блюдо на стопе
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowModal(false)}
                    >
                      Отмена
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {editingDish ? "Обновить" : "Добавить"}
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

export default DishesAdmin;
