import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../../NavBar";
import { useNavigate } from "react-router-dom";
import { $authHost } from "../../../http";

const CategoriesAdmin = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
  });
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");

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

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [categoriesResponse, dishesResponse] = await Promise.all([
        $authHost.get("/categories").catch((err) => {
          console.error("Ошибка загрузки категорий:", err);
          return { data: { rows: [] } };
        }),
        $authHost.get("/dishes").catch((err) => {
          console.error("Ошибка загрузки блюд:", err);
          return { data: { rows: [] } };
        }),
      ]);

      const categoriesData = extractData(categoriesResponse.data);
      const dishesData = extractData(dishesResponse.data);

      setCategories(safeArray(categoriesData));
      setDishes(safeArray(dishesData));
    } catch (error) {
      console.error("Общая ошибка загрузки:", error);
      setError("Не удалось загрузить данные");
      setCategories([]);
      setDishes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleBack = () => {
    navigate("/admin-panel");
  };

  const handleAddNew = () => {
    setEditingCategory(null);
    setFormData({
      name: "",
    });
    setShowModal(true);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name || "",
    });
    setShowModal(true);
  };

  const getDishesCountByCategory = (categoryId) => {
    return dishes.filter((dish) => dish.categoryId === categoryId).length;
  };

  const handleDelete = async (category) => {
    const dishesCount = getDishesCountByCategory(category.id);

    if (dishesCount > 0) {
      setError(
        `Нельзя удалить категорию "${category.name}", так как в ней находится ${dishesCount} блюд(о). Сначала переместите или удалите блюда из этой категории.`
      );
      return;
    }

    if (
      !window.confirm(
        `Вы уверены, что хотите удалить категорию "${category.name}"?`
      )
    ) {
      return;
    }

    try {
      await $authHost.delete(`/categories/${category.id}`);
      await loadCategories();
    } catch (error) {
      console.error("Ошибка удаления категории:", error);
      if (error.response?.data?.message) {
        setError(error.response.data.message);
      } else {
        setError("Не удалось удалить категорию");
      }
    }
  };

  const checkCategoryNameExists = async (name, excludeId = null) => {
    try {
      const response = await $authHost.get("/categories");
      const allCategories = extractData(response.data);
      return allCategories.some(
        (category) =>
          category.name.toLowerCase() === name.toLowerCase() &&
          category.id !== excludeId
      );
    } catch (error) {
      console.error("Ошибка проверки названия:", error);
      return false;
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      // Проверка уникальности названия
      const nameExists = await checkCategoryNameExists(
        formData.name,
        editingCategory?.id
      );
      if (nameExists) {
        setError("Категория с таким названием уже существует");
        return;
      }

      // Отправляем данные на сервер
      const submitData = {
        name: formData.name,
      };

      console.log("Отправка данных:", submitData);

      if (editingCategory) {
        await $authHost.put(`/categories/${editingCategory.id}`, submitData);
      } else {
        await $authHost.post("/categories", submitData);
      }

      setShowModal(false);
      await loadCategories();
    } catch (error) {
      console.error("Ошибка сохранения категории:", error);
      console.error("Response data:", error.response?.data);

      if (error.response?.data?.message?.includes("уже существует")) {
        setError("Категория с таким названием уже существует");
      } else {
        setError(
          `Не удалось ${editingCategory ? "обновить" : "добавить"} категорию: ${
            error.response?.data?.message || error.message
          }`
        );
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // Сортируем категории
  const sortedCategories = [...categories].sort((a, b) => {
    let aValue, bValue;

    switch (sortBy) {
      case "name":
        aValue = a.name?.toLowerCase() || "";
        bValue = b.name?.toLowerCase() || "";
        break;
      case "dishesCount":
        aValue = getDishesCountByCategory(a.id);
        bValue = getDishesCountByCategory(b.id);
        break;
      case "createdAt":
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
        break;
      default:
        aValue = a.name?.toLowerCase() || "";
        bValue = b.name?.toLowerCase() || "";
    }

    if (sortOrder === "asc") {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    }
  });

  const categoriesList = safeArray(sortedCategories);

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
        {/* Заголовок и кнопки */}
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
                          <i className="bi bi-folder-fill me-2"></i>
                          Управление категориями
                        </h1>
                        <p className="text-muted mb-0">
                          Всего категорий: {categoriesList.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 text-end">
                    <button className="btn btn-primary" onClick={handleAddNew}>
                      <i className="bi bi-plus-circle me-1"></i>
                      Добавить категорию
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

        {/* Сортировка */}
        <div className="row mb-3">
          <div className="col-12">
            <div className="card">
              <div className="card-body py-2">
                <div className="d-flex align-items-center">
                  <span className="me-2 text-muted">Сортировка:</span>
                  <div className="btn-group">
                    <button
                      className={`btn btn-sm ${
                        sortBy === "name"
                          ? "btn-primary"
                          : "btn-outline-primary"
                      }`}
                      onClick={() => handleSort("name")}
                    >
                      По названию{" "}
                      {sortBy === "name" && (
                        <i
                          className={`bi ${
                            sortOrder === "asc" ? "bi-sort-up" : "bi-sort-down"
                          } ms-1`}
                        ></i>
                      )}
                    </button>
                    <button
                      className={`btn btn-sm ${
                        sortBy === "dishesCount"
                          ? "btn-primary"
                          : "btn-outline-primary"
                      }`}
                      onClick={() => handleSort("dishesCount")}
                    >
                      По количеству блюд{" "}
                      {sortBy === "dishesCount" && (
                        <i
                          className={`bi ${
                            sortOrder === "asc" ? "bi-sort-up" : "bi-sort-down"
                          } ms-1`}
                        ></i>
                      )}
                    </button>
                    <button
                      className={`btn btn-sm ${
                        sortBy === "createdAt"
                          ? "btn-primary"
                          : "btn-outline-primary"
                      }`}
                      onClick={() => handleSort("createdAt")}
                    >
                      По дате создания{" "}
                      {sortBy === "createdAt" && (
                        <i
                          className={`bi ${
                            sortOrder === "asc" ? "bi-sort-up" : "bi-sort-down"
                          } ms-1`}
                        ></i>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Список категорий */}
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-white">
                <h5 className="card-title mb-0">
                  <i className="bi bi-list me-2"></i>
                  Список категорий
                </h5>
              </div>
              <div className="card-body">
                {categoriesList.length === 0 ? (
                  <div className="text-center py-5">
                    <i className="bi bi-folder display-1 text-muted"></i>
                    <h5 className="mt-3">Категорий пока нет</h5>
                    <p className="text-muted">
                      Добавьте первую категорию для блюд
                    </p>
                    <button className="btn btn-primary" onClick={handleAddNew}>
                      <i className="bi bi-plus-circle me-1"></i>
                      Добавить категорию
                    </button>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead className="table-light">
                        <tr>
                          <th
                            style={{ cursor: "pointer" }}
                            onClick={() => handleSort("name")}
                          >
                            Название
                            {sortBy === "name" && (
                              <i
                                className={`bi ${
                                  sortOrder === "asc"
                                    ? "bi-sort-up"
                                    : "bi-sort-down"
                                } ms-1`}
                              ></i>
                            )}
                          </th>
                          <th
                            style={{ cursor: "pointer" }}
                            onClick={() => handleSort("dishesCount")}
                          >
                            Количество блюд
                            {sortBy === "dishesCount" && (
                              <i
                                className={`bi ${
                                  sortOrder === "asc"
                                    ? "bi-sort-up"
                                    : "bi-sort-down"
                                } ms-1`}
                              ></i>
                            )}
                          </th>
                          <th
                            style={{ cursor: "pointer" }}
                            onClick={() => handleSort("createdAt")}
                          >
                            Дата создания
                            {sortBy === "createdAt" && (
                              <i
                                className={`bi ${
                                  sortOrder === "asc"
                                    ? "bi-sort-up"
                                    : "bi-sort-down"
                                } ms-1`}
                              ></i>
                            )}
                          </th>
                          <th width="150">Действия</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoriesList.map((category) => {
                          const dishesCount = getDishesCountByCategory(
                            category.id
                          );
                          return (
                            <tr key={category.id}>
                              <td>
                                <strong>{category.name}</strong>
                              </td>
                              <td>
                                <span
                                  className={`badge ${
                                    dishesCount > 0
                                      ? "bg-primary"
                                      : "bg-secondary"
                                  }`}
                                >
                                  {dishesCount} блюд(а)
                                </span>
                              </td>
                              <td>
                                <small className="text-muted">
                                  {new Date(
                                    category.createdAt
                                  ).toLocaleDateString("ru-RU")}
                                </small>
                              </td>
                              <td>
                                <div className="btn-group">
                                  <button
                                    className="btn btn-outline-primary btn-sm"
                                    onClick={() => handleEdit(category)}
                                    title="Редактировать"
                                  >
                                    <i className="bi bi-pencil"></i>
                                  </button>
                                  <button
                                    className="btn btn-outline-danger btn-sm"
                                    onClick={() => handleDelete(category)}
                                    disabled={dishesCount > 0}
                                    title={
                                      dishesCount > 0
                                        ? "Нельзя удалить - есть блюда в категории"
                                        : "Удалить"
                                    }
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

        {/* Модальное окно для добавления/редактирования */}
        {showModal && (
          <div
            className="modal show d-block"
            tabIndex="-1"
            style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          >
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {editingCategory
                      ? "Редактирование категории"
                      : "Добавление новой категории"}
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
                      <div className="col-12">
                        <label className="form-label">
                          Название категории *
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          required
                          placeholder="Например: Горячие блюда, Напитки, Десерты"
                        />
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
                      {editingCategory ? "Обновить" : "Добавить"}
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

export default CategoriesAdmin;
