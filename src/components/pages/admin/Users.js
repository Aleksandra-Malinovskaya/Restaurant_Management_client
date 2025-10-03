import React, { useState, useEffect } from "react";
import Navbar from "../../NavBar";
import { useAuth } from "../../../context/AuthContext";
import { userAPI } from "../../../services/userAPI";

const Users = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

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

  const filteredUsers = users.filter(
    (u) =>
      u.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateUser = () => {
    alert("Функция добавления пользователя в разработке");
  };

  const handleEditUser = (user) => {
    alert(`Редактирование пользователя: ${user.firstName} ${user.lastName}`);
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      await userAPI.changeRole(userId, newRole);
      loadUsers(); // Перезагружаем список
    } catch (error) {
      console.error("Ошибка изменения роли:", error);
      alert("Не удалось изменить роль пользователя");
    }
  };

  const handleToggleStatus = async (userId, isActive) => {
    try {
      await userAPI.changeStatus(userId, isActive);
      loadUsers(); // Перезагружаем список
    } catch (error) {
      console.error("Ошибка изменения статуса:", error);
      alert("Не удалось изменить статус пользователя");
    }
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
        {/* Заголовок и кнопки */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card bg-white shadow-sm">
              <div className="card-body">
                <div className="row align-items-center">
                  <div className="col-md-6">
                    <h1 className="h3 mb-2">
                      <i className="bi bi-people-fill me-2"></i>
                      Управление пользователями
                    </h1>
                    <p className="text-muted mb-0">
                      Всего пользователей: <strong>{users.length}</strong>
                    </p>
                  </div>
                  <div className="col-md-6 text-end">
                    <button
                      className="btn btn-primary"
                      onClick={handleCreateUser}
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
                  <div className="col-md-6">
                    <div className="input-group">
                      <span className="input-group-text">
                        <i className="bi bi-search"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Поиск по имени, фамилии или email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex gap-2">
                      <button className="btn btn-outline-secondary">
                        <i className="bi bi-filter me-2"></i>
                        Фильтры
                      </button>
                      <button
                        className="btn btn-outline-secondary"
                        onClick={loadUsers}
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
        </div>

        {/* Таблица пользователей */}
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-white">
                <h5 className="mb-0">Список пользователей</h5>
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
                            {currentUser.role === "super_admin" &&
                            user.role !== "super_admin" ? (
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
                            {currentUser.role === "super_admin" &&
                            user.id !== currentUser.id ? (
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
                                  currentUser.id !== user.id
                                }
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              {currentUser.role === "super_admin" &&
                                user.id !== currentUser.id && (
                                  <button className="btn btn-outline-danger">
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
    </div>
  );
};

export default Users;
