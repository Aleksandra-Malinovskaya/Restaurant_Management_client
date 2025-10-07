import React, { useState } from "react";
import Navbar from "../../NavBar";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { userAPI } from "../../../services/userAPI";

const WaiterSettings = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const handleBack = () => {
    navigate("/waiter");
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setProfileError("");
      setProfileSuccess("");

      await userAPI.update(user.id, {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
      });

      updateUser({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
      });

      setProfileSuccess("Данные профиля успешно обновлены");
      setTimeout(() => setProfileSuccess(""), 3000);
    } catch (error) {
      console.error("Ошибка обновления профиля:", error);
      setProfileError(
        error.response?.data?.message || "Не удалось обновить данные профиля"
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("Новые пароли не совпадают");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError("Пароль должен содержать минимум 6 символов");
      return;
    }

    try {
      setLoading(true);

      await userAPI.update(user.id, {
        password: passwordData.newPassword,
      });

      setPasswordSuccess("Пароль успешно изменен");
      setPasswordData({ newPassword: "", confirmPassword: "" });
      setTimeout(() => setPasswordSuccess(""), 3000);
    } catch (error) {
      console.error("Ошибка смены пароля:", error);
      setPasswordError(
        error.response?.data?.message || "Не удалось изменить пароль"
      );
    } finally {
      setLoading(false);
    }
  };

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
                        title="Вернуться на панель официанта"
                      >
                        <i className="bi bi-arrow-left"></i>
                      </button>
                      <div>
                        <h1 className="h3 mb-2">
                          <i className="bi bi-gear me-2"></i>
                          Настройки официанта
                        </h1>
                        <p className="text-muted mb-0">
                          Управление настройками аккаунта
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-md-6">
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-person me-2"></i>
                  Редактирование профиля
                </h5>
              </div>
              <div className="card-body">
                {profileError && (
                  <div className="alert alert-danger">{profileError}</div>
                )}
                {profileSuccess && (
                  <div className="alert alert-success">{profileSuccess}</div>
                )}

                <form onSubmit={handleProfileUpdate}>
                  <div className="mb-3">
                    <label className="form-label">Имя</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileData.firstName}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          firstName: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Фамилия</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profileData.lastName}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          lastName: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={profileData.email}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          email: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={loading}
                  >
                    {loading ? "Обновление..." : "Обновить профиль"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">
                  <i className="bi bi-key me-2"></i>
                  Смена пароля
                </h5>
              </div>
              <div className="card-body">
                {passwordError && (
                  <div className="alert alert-danger">{passwordError}</div>
                )}
                {passwordSuccess && (
                  <div className="alert alert-success">{passwordSuccess}</div>
                )}

                <form onSubmit={handlePasswordChange}>
                  <div className="mb-3">
                    <label className="form-label">Новый пароль</label>
                    <input
                      type="password"
                      className="form-control"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          newPassword: e.target.value,
                        })
                      }
                      required
                      minLength={6}
                    />
                    <div className="form-text">
                      Пароль должен содержать минимум 6 символов
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Подтверждение пароля</label>
                    <input
                      type="password"
                      className="form-control"
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
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={loading}
                  >
                    {loading ? "Изменение..." : "Сменить пароль"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaiterSettings;
