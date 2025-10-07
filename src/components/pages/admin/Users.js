import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../../NavBar";
import { useAuth } from "../../../context/AuthContext";
import { userAPI } from "../../../services/userAPI";

const Users = () => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Состояния для модальных окон
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Данные форм и ошибки для каждой модалки
  const [newUserData, setNewUserData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "waiter",
    password: "",
    confirmPassword: "",
  });
  const [createErrors, setCreateErrors] = useState({});

  const [editUserData, setEditUserData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "waiter",
  });
  const [editErrors, setEditErrors] = useState({});

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState({});

  // Защита от null в currentUser
  const isSuperAdmin = currentUser?.role === "super_admin";
  const currentUserId = currentUser?.id;

  useEffect(() => {
    // Если пользователь не авторизован, перенаправляем на страницу входа
    if (!currentUser) {
      navigate("/login");
      return;
    }
    loadUsers();
  }, [currentUser, navigate]);

  const handleBackToAdmin = () => {
    navigate("/admin");
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await userAPI.getAll();
      setUsers(data);
    } catch (error) {
      console.error("Ошибка загрузки пользователей:", error);
      setError("Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      await userAPI.changeRole(userId, newRole);
      setSuccess("Роль пользователя успешно изменена");
      loadUsers();
    } catch (error) {
      console.error("Ошибка изменения роли:", error);
      setError("Не удалось изменить роль пользователя");
    }
  };

  const handleToggleStatus = async (userId, isActive) => {
    try {
      await userAPI.changeStatus(userId, isActive);
      setSuccess(`Пользователь ${isActive ? "активирован" : "деактивирован"}`);
      loadUsers();
    } catch (error) {
      console.error("Ошибка изменения статуса:", error);
      setError("Не удалось изменить статус пользователя");
    }
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      super_admin: { class: "bg-danger", text: "Супер-админ" },
      admin: { class: "bg-primary", text: "Администратор" },
      waiter: { class: "bg-success", text: "Официант" },
      chef: { class: "bg-warning", text: "Повар" },
      trainee: { class: "bg-secondary", text: "Стажер" },
    };
    const config = roleConfig[role] || { class: "bg-dark", text: role };
    return <span className={`badge ${config.class}`}>{config.text}</span>;
  };

  const getStatusBadge = (isActive) => {
    return isActive ? (
      <span className="badge bg-success">Активен</span>
    ) : (
      <span className="badge bg-danger">Неактивен</span>
    );
  };

  // Фильтрация пользователей
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && user.isActive) ||
      (statusFilter === "inactive" && !user.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Валидация формы создания пользователя
  const validateCreateForm = () => {
    const errors = {};

    if (!newUserData.firstName.trim()) {
      errors.firstName = "Имя обязательно для заполнения";
    }

    if (!newUserData.lastName.trim()) {
      errors.lastName = "Фамилия обязательна для заполнения";
    }

    if (!newUserData.email.trim()) {
      errors.email = "Email обязателен для заполнения";
    } else if (!/\S+@\S+\.\S+/.test(newUserData.email)) {
      errors.email = "Введите корректный email";
    }

    if (!newUserData.password) {
      errors.password = "Пароль обязателен для заполнения";
    } else if (newUserData.password.length < 6) {
      errors.password = "Пароль должен содержать минимум 6 символов";
    }

    if (!newUserData.confirmPassword) {
      errors.confirmPassword = "Подтверждение пароля обязательно";
    } else if (newUserData.password !== newUserData.confirmPassword) {
      errors.confirmPassword = "Пароли не совпадают";
    }

    return errors;
  };

  // Создание пользователя
  const handleCreateUser = async (e) => {
    e.preventDefault();

    const errors = validateCreateForm();
    setCreateErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await userAPI.create({
        firstName: newUserData.firstName,
        lastName: newUserData.lastName,
        email: newUserData.email,
        role: newUserData.role,
        password: newUserData.password,
        isActive: true,
      });

      setSuccess("Пользователь успешно создан");
      setShowCreateModal(false);
      setNewUserData({
        firstName: "",
        lastName: "",
        email: "",
        role: "waiter",
        password: "",
        confirmPassword: "",
      });
      setCreateErrors({});
      loadUsers();
    } catch (error) {
      console.error("Ошибка создания пользователя:", error);
      setCreateErrors({
        submit:
          error.response?.data?.message || "Не удалось создать пользователя",
      });
    }
  };

  // Валидация формы редактирования
  const validateEditForm = () => {
    const errors = {};

    if (!editUserData.firstName.trim()) {
      errors.firstName = "Имя обязательно для заполнения";
    }

    if (!editUserData.lastName.trim()) {
      errors.lastName = "Фамилия обязательна для заполнения";
    }

    if (!editUserData.email.trim()) {
      errors.email = "Email обязателен для заполнения";
    } else if (!/\S+@\S+\.\S+/.test(editUserData.email)) {
      errors.email = "Введите корректный email";
    }

    return errors;
  };

  // Редактирование пользователя
  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditUserData({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      role: user.role,
    });
    setEditErrors({});
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();

    const errors = validateEditForm();
    setEditErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await userAPI.update(selectedUser.id, editUserData);
      setSuccess("Данные пользователя успешно обновлены");
      setShowEditModal(false);
      setEditErrors({});
      loadUsers();
    } catch (error) {
      console.error("Ошибка обновления пользователя:", error);
      setEditErrors({
        submit:
          error.response?.data?.message ||
          "Не удалось обновить данные пользователя",
      });
    }
  };

  // Удаление пользователя
  const handleDeleteUser = async (user) => {
    if (
      !window.confirm(
        `Вы уверены, что хотите удалить пользователя ${user.firstName} ${user.lastName}?`
      )
    ) {
      return;
    }

    try {
      await userAPI.delete(user.id);
      setSuccess("Пользователь успешно удален");
      loadUsers();
    } catch (error) {
      console.error("Ошибка удаления пользователя:", error);
      setError("Не удалось удалить пользователя");
    }
  };

  // Валидация формы смены пароля
  const validatePasswordForm = () => {
    const errors = {};

    if (!passwordData.newPassword) {
      errors.newPassword = "Пароль обязателен для заполнения";
    } else if (passwordData.newPassword.length < 6) {
      errors.newPassword = "Пароль должен содержать минимум 6 символов";
    }

    if (!passwordData.confirmPassword) {
      errors.confirmPassword = "Подтверждение пароля обязательно";
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = "Пароли не совпадают";
    }

    return errors;
  };

  // Смена пароля
  const handleChangePasswordClick = (user) => {
    setSelectedUser(user);
    setPasswordData({
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordErrors({});
    setShowPasswordModal(true);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    const errors = validatePasswordForm();
    setPasswordErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await userAPI.update(selectedUser.id, {
        password: passwordData.newPassword, // Пароль передается правильно
      });

      setSuccess("Пароль успешно изменен");
      setShowPasswordModal(false);
      setPasswordData({
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordErrors({});
    } catch (error) {
      console.error("Ошибка смены пароля:", error);
      setPasswordErrors({
        submit: error.response?.data?.message || "Не удалось изменить пароль",
      });
    }
  };

  // Сброс фильтров
  const handleResetFilters = () => {
    setSearchTerm("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  // Закрытие модальных окон с очисткой ошибок
  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setCreateErrors({});
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditErrors({});
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordErrors({});
  };

  // Если пользователь вышел, показываем только загрузку
  if (!currentUser) {
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
        {/* Заголовок и кнопки */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card bg-white shadow-sm">
              <div className="card-body">
                <div className="row align-items-center">
                  <div className="col-md-6">
                    <div className="d-flex align-items-center">
                      {/* Кнопка назад */}
                      <button
                        className="btn btn-outline-secondary me-3"
                        onClick={handleBackToAdmin}
                        title="Вернуться на панель админа"
                      >
                        <i className="bi bi-arrow-left"></i>
                      </button>
                      <div>
                        <h1 className="h3 mb-2">
                          <i className="bi bi-people-fill me-2"></i>
                          Управление пользователями
                        </h1>
                        <p className="text-muted mb-0">
                          Всего пользователей: <strong>{users.length}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6 text-end">
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowCreateModal(true)}
                    >
                      <i className="bi bi-person-plus me-2"></i>
                      Добавить пользователя
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Сообщения об ошибках и успехе */}
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

        {/* Статистика по ролям */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="row text-center">
                  <div className="col-md-2">
                    <div className="border-end">
                      <h5 className="text-primary">
                        {users.filter((u) => u.role === "super_admin").length}
                      </h5>
                      <small className="text-muted">Супер-админы</small>
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="border-end">
                      <h5 className="text-primary">
                        {users.filter((u) => u.role === "admin").length}
                      </h5>
                      <small className="text-muted">Администраторы</small>
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="border-end">
                      <h5 className="text-success">
                        {users.filter((u) => u.role === "waiter").length}
                      </h5>
                      <small className="text-muted">Официанты</small>
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="border-end">
                      <h5 className="text-warning">
                        {users.filter((u) => u.role === "chef").length}
                      </h5>
                      <small className="text-muted">Повара</small>
                    </div>
                  </div>
                  <div className="col-md-2">
                    <div className="border-end">
                      <h5 className="text-secondary">
                        {users.filter((u) => u.role === "trainee").length}
                      </h5>
                      <small className="text-muted">Стажеры</small>
                    </div>
                  </div>
                  <div className="col-md-2">
                    <h5 className="text-info">
                      {users.filter((u) => u.isActive).length}/{users.length}
                    </h5>
                    <small className="text-muted">Активные/Всего</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Поиск и фильтры */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label">Поиск</label>
                    <div className="input-group">
                      <span className="input-group-text">
                        <i className="bi bi-search"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Имя, фамилия, email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Роль</label>
                    <select
                      className="form-select"
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                    >
                      <option value="all">Все роли</option>
                      <option value="super_admin">Супер-админ</option>
                      <option value="admin">Администратор</option>
                      <option value="waiter">Официант</option>
                      <option value="chef">Повар</option>
                      <option value="trainee">Стажер</option>
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Статус</label>
                    <select
                      className="form-select"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">Все статусы</option>
                      <option value="active">Активные</option>
                      <option value="inactive">Неактивные</option>
                    </select>
                  </div>
                  <div className="col-md-3 d-flex align-items-end">
                    <div className="d-grid gap-2 w-100">
                      <button
                        className="btn btn-outline-secondary"
                        onClick={loadUsers}
                      >
                        <i className="bi bi-arrow-clockwise me-2"></i>
                        Обновить
                      </button>
                      <button
                        className="btn btn-outline-secondary"
                        onClick={handleResetFilters}
                      >
                        <i className="bi bi-x-circle me-2"></i>
                        Сбросить фильтры
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Таблица пользователей */}
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-white">
                <h5 className="mb-0">
                  Список пользователей ({filteredUsers.length})
                </h5>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>ID</th>
                        <th>Пользователь</th>
                        <th>Email</th>
                        <th>Роль</th>
                        <th>Статус</th>
                        <th>Дата регистрации</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <code>#{user.id}</code>
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              <div
                                className="bg-primary rounded-circle d-flex align-items-center justify-content-center me-3"
                                style={{ width: "40px", height: "40px" }}
                              >
                                <span className="text-white fw-bold">
                                  {user.firstName?.[0]}
                                  {user.lastName?.[0]}
                                </span>
                              </div>
                              <div>
                                <div className="fw-semibold">
                                  {user.firstName} {user.lastName}
                                </div>
                                <small className="text-muted">
                                  {user.role === "super_admin" &&
                                    "Владелец системы"}
                                </small>
                              </div>
                            </div>
                          </td>
                          <td>{user.email}</td>
                          <td>
                            {/* Исправленная проверка */}
                            {isSuperAdmin && user.role !== "super_admin" ? (
                              <select
                                className="form-select form-select-sm"
                                value={user.role}
                                onChange={(e) =>
                                  handleChangeRole(user.id, e.target.value)
                                }
                                style={{ width: "auto" }}
                              >
                                <option value="admin">Администратор</option>
                                <option value="waiter">Официант</option>
                                <option value="chef">Повар</option>
                                <option value="trainee">Стажер</option>
                              </select>
                            ) : (
                              getRoleBadge(user.role)
                            )}
                          </td>
                          <td>
                            {/* Исправленная проверка */}
                            {isSuperAdmin && user.id !== currentUserId ? (
                              <div className="form-check form-switch">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={user.isActive}
                                  onChange={(e) =>
                                    handleToggleStatus(
                                      user.id,
                                      e.target.checked
                                    )
                                  }
                                />
                              </div>
                            ) : (
                              getStatusBadge(user.isActive)
                            )}
                          </td>
                          <td>
                            <small className="text-muted">
                              {user.createdAt
                                ? new Date(user.createdAt).toLocaleDateString(
                                    "ru-RU"
                                  )
                                : "Н/Д"}
                            </small>
                          </td>
                          <td>
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-outline-primary"
                                onClick={() => handleEditUser(user)}
                                disabled={
                                  user.role === "super_admin" &&
                                  currentUserId !== user.id
                                }
                                title="Редактировать"
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                className="btn btn-outline-warning"
                                onClick={() => handleChangePasswordClick(user)}
                                title="Сменить пароль"
                              >
                                <i className="bi bi-key"></i>
                              </button>
                              {/* Исправленная проверка */}
                              {isSuperAdmin && user.id !== currentUserId && (
                                <button
                                  className="btn btn-outline-danger"
                                  onClick={() => handleDeleteUser(user)}
                                  title="Удалить"
                                >
                                  <i className="bi bi-trash"></i>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredUsers.length === 0 && (
                  <div className="text-center py-5">
                    <i className="bi bi-people display-1 text-muted"></i>
                    <h5 className="mt-3 text-muted">
                      {users.length === 0
                        ? "Пользователи не найдены"
                        : "Пользователи по вашему запросу не найдены"}
                    </h5>
                    <p className="text-muted">
                      Попробуйте изменить условия поиска
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Модальные окна */}
      {showCreateModal && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Добавить пользователя</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleCloseCreateModal}
                ></button>
              </div>
              <form onSubmit={handleCreateUser}>
                <div className="modal-body">
                  {createErrors.submit && (
                    <div className="alert alert-danger">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      {createErrors.submit}
                    </div>
                  )}

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Имя *</label>
                      <input
                        type="text"
                        className={`form-control ${
                          createErrors.firstName ? "is-invalid" : ""
                        }`}
                        value={newUserData.firstName}
                        onChange={(e) =>
                          setNewUserData({
                            ...newUserData,
                            firstName: e.target.value,
                          })
                        }
                        required
                      />
                      {createErrors.firstName && (
                        <div className="invalid-feedback">
                          {createErrors.firstName}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Фамилия *</label>
                      <input
                        type="text"
                        className={`form-control ${
                          createErrors.lastName ? "is-invalid" : ""
                        }`}
                        value={newUserData.lastName}
                        onChange={(e) =>
                          setNewUserData({
                            ...newUserData,
                            lastName: e.target.value,
                          })
                        }
                        required
                      />
                      {createErrors.lastName && (
                        <div className="invalid-feedback">
                          {createErrors.lastName}
                        </div>
                      )}
                    </div>
                    <div className="col-12">
                      <label className="form-label">Email *</label>
                      <input
                        type="email"
                        className={`form-control ${
                          createErrors.email ? "is-invalid" : ""
                        }`}
                        value={newUserData.email}
                        onChange={(e) =>
                          setNewUserData({
                            ...newUserData,
                            email: e.target.value,
                          })
                        }
                        required
                      />
                      {createErrors.email && (
                        <div className="invalid-feedback">
                          {createErrors.email}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Роль *</label>
                      <select
                        className="form-select"
                        value={newUserData.role}
                        onChange={(e) =>
                          setNewUserData({
                            ...newUserData,
                            role: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="waiter">Официант</option>
                        <option value="chef">Повар</option>
                        <option value="trainee">Стажер</option>
                        <option value="admin">Администратор</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Пароль *</label>
                      <input
                        type="password"
                        className={`form-control ${
                          createErrors.password ? "is-invalid" : ""
                        }`}
                        value={newUserData.password}
                        onChange={(e) =>
                          setNewUserData({
                            ...newUserData,
                            password: e.target.value,
                          })
                        }
                        required
                        minLength={6}
                      />
                      {createErrors.password && (
                        <div className="invalid-feedback">
                          {createErrors.password}
                        </div>
                      )}
                    </div>
                    <div className="col-12">
                      <label className="form-label">
                        Подтверждение пароля *
                      </label>
                      <input
                        type="password"
                        className={`form-control ${
                          createErrors.confirmPassword ? "is-invalid" : ""
                        }`}
                        value={newUserData.confirmPassword}
                        onChange={(e) =>
                          setNewUserData({
                            ...newUserData,
                            confirmPassword: e.target.value,
                          })
                        }
                        required
                        minLength={6}
                      />
                      {createErrors.confirmPassword && (
                        <div className="invalid-feedback">
                          {createErrors.confirmPassword}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCloseCreateModal}
                  >
                    Отмена
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Создать пользователя
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования пользователя */}
      {showEditModal && selectedUser && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Редактировать пользователя</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleCloseEditModal}
                ></button>
              </div>
              <form onSubmit={handleUpdateUser}>
                <div className="modal-body">
                  {editErrors.submit && (
                    <div className="alert alert-danger">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      {editErrors.submit}
                    </div>
                  )}

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Имя *</label>
                      <input
                        type="text"
                        className={`form-control ${
                          editErrors.firstName ? "is-invalid" : ""
                        }`}
                        value={editUserData.firstName}
                        onChange={(e) =>
                          setEditUserData({
                            ...editUserData,
                            firstName: e.target.value,
                          })
                        }
                        required
                      />
                      {editErrors.firstName && (
                        <div className="invalid-feedback">
                          {editErrors.firstName}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Фамилия *</label>
                      <input
                        type="text"
                        className={`form-control ${
                          editErrors.lastName ? "is-invalid" : ""
                        }`}
                        value={editUserData.lastName}
                        onChange={(e) =>
                          setEditUserData({
                            ...editUserData,
                            lastName: e.target.value,
                          })
                        }
                        required
                      />
                      {editErrors.lastName && (
                        <div className="invalid-feedback">
                          {editErrors.lastName}
                        </div>
                      )}
                    </div>
                    <div className="col-12">
                      <label className="form-label">Email *</label>
                      <input
                        type="email"
                        className={`form-control ${
                          editErrors.email ? "is-invalid" : ""
                        }`}
                        value={editUserData.email}
                        onChange={(e) =>
                          setEditUserData({
                            ...editUserData,
                            email: e.target.value,
                          })
                        }
                        required
                      />
                      {editErrors.email && (
                        <div className="invalid-feedback">
                          {editErrors.email}
                        </div>
                      )}
                    </div>
                    <div className="col-12">
                      <label className="form-label">Роль *</label>
                      <select
                        className="form-select"
                        value={editUserData.role}
                        onChange={(e) =>
                          setEditUserData({
                            ...editUserData,
                            role: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="waiter">Официант</option>
                        <option value="chef">Повар</option>
                        <option value="trainee">Стажер</option>
                        <option value="admin">Администратор</option>
                        {isSuperAdmin && (
                          <option value="super_admin">Супер-админ</option>
                        )}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCloseEditModal}
                  >
                    Отмена
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Сохранить изменения
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно смены пароля */}
      {showPasswordModal && selectedUser && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Сменить пароль</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={handleClosePasswordModal}
                ></button>
              </div>
              <form onSubmit={handleChangePassword}>
                <div className="modal-body">
                  {passwordErrors.submit && (
                    <div className="alert alert-danger">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      {passwordErrors.submit}
                    </div>
                  )}

                  <p>
                    Смена пароля для:{" "}
                    <strong>
                      {selectedUser.firstName} {selectedUser.lastName}
                    </strong>
                  </p>
                  <div className="row g-3">
                    <div className="col-12">
                      <label className="form-label">Новый пароль *</label>
                      <input
                        type="password"
                        className={`form-control ${
                          passwordErrors.newPassword ? "is-invalid" : ""
                        }`}
                        value={passwordData.newPassword}
                        onChange={(e) =>
                          setPasswordData({
                            ...passwordData,
                            newPassword: e.target.value,
                          })
                        }
                        required
                        minLength={6}
                        placeholder="Минимум 6 символов"
                      />
                      {passwordErrors.newPassword && (
                        <div className="invalid-feedback">
                          {passwordErrors.newPassword}
                        </div>
                      )}
                    </div>
                    <div className="col-12">
                      <label className="form-label">
                        Подтверждение пароля *
                      </label>
                      <input
                        type="password"
                        className={`form-control ${
                          passwordErrors.confirmPassword ? "is-invalid" : ""
                        }`}
                        value={passwordData.confirmPassword}
                        onChange={(e) =>
                          setPasswordData({
                            ...passwordData,
                            confirmPassword: e.target.value,
                          })
                        }
                        required
                        minLength={6}
                      />
                      {passwordErrors.confirmPassword && (
                        <div className="invalid-feedback">
                          {passwordErrors.confirmPassword}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClosePasswordModal}
                  >
                    Отмена
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Сменить пароль
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Затемнение фона для модальных окон */}
      {(showCreateModal || showEditModal || showPasswordModal) && (
        <div className="modal-backdrop show"></div>
      )}
    </div>
  );
};

export default Users;
