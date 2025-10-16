import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const { user, login, register, isLoading } = useAuth();
  const navigate = useNavigate();

  // Редирект если пользователь уже авторизован
  useEffect(() => {
    console.log("🔍 Auth проверка пользователя:", user);
    if (user) {
      console.log("✅ Пользователь авторизован, редирект...");

      // Даем небольшой таймаут для стабильности
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 100);
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Валидация
    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    if (!isLogin && formData.password.length < 6) {
      setError("Пароль должен содержать минимум 6 символов");
      return;
    }

    console.log("📤 Отправка формы:", isLogin ? "Login" : "Register");

    const result = isLogin
      ? await login(formData.email, formData.password)
      : await register(
          formData.email,
          formData.password,
          formData.firstName,
          formData.lastName
        );

    console.log("📨 Результат:", result);

    if (!result.success) {
      setError(result.message);
    } else {
      console.log("✅ Успех! Пользователь должен быть перенаправлен...");
      // Редирект произойдет автоматически благодаря useEffect выше
    }
  };

  return (
    <div className="container-fluid vh-100 bg-light">
      <div className="row h-100 justify-content-center align-items-center">
        <div className="col-md-5">
          <div className="card shadow">
            <div
              className="card-header text-white text-center"
              style={{
                background: "linear-gradient(45deg, #007bff, #0056b3)",
              }}
            >
              <h4 className="mb-0">
                <i className="bi bi-shop me-2"></i>
                Ресторан
              </h4>
              <small>Система управления</small>
            </div>

            <div className="card-body p-4">
              <div className="text-center mb-4">
                <div className="btn-group" role="group">
                  <button
                    type="button"
                    className={`btn ${
                      isLogin ? "btn-primary" : "btn-outline-primary"
                    }`}
                    onClick={() => setIsLogin(true)}
                  >
                    Вход
                  </button>
                  <button
                    type="button"
                    className={`btn ${
                      !isLogin ? "btn-primary" : "btn-outline-primary"
                    }`}
                    onClick={() => setIsLogin(false)}
                  >
                    Регистрация
                  </button>
                </div>
              </div>

              {error && (
                <div className="alert alert-danger alert-dismissible fade show">
                  {error}
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setError("")}
                  ></button>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                {!isLogin && (
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Имя *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.firstName}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            firstName: e.target.value,
                          })
                        }
                        required
                        placeholder="Введите имя"
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Фамилия *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.lastName}
                        onChange={(e) =>
                          setFormData({ ...formData, lastName: e.target.value })
                        }
                        required
                        placeholder="Введите фамилию"
                      />
                    </div>
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    className="form-control"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    placeholder="example@mail.com"
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Пароль *</label>
                  <input
                    type="password"
                    className="form-control"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    placeholder="Минимум 6 символов"
                    minLength="6"
                  />
                </div>

                {!isLogin && (
                  <div className="mb-3">
                    <label className="form-label">Подтвердите пароль *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          confirmPassword: e.target.value,
                        })
                      }
                      required
                      placeholder="Повторите пароль"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary w-100 py-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      {isLogin ? "Вход..." : "Регистрация..."}
                    </>
                  ) : isLogin ? (
                    "Войти"
                  ) : (
                    "Зарегистрироваться"
                  )}
                </button>
              </form>

              <div className="text-center mt-3">
                <small className="text-muted">
                  {isLogin ? "Нет аккаунта?" : "Уже есть аккаунт?"}{" "}
                  <button
                    type="button"
                    className="btn btn-link p-0 text-decoration-none"
                    onClick={() => setIsLogin(!isLogin)}
                  >
                    {isLogin ? "Зарегистрироваться" : "Войти"}
                  </button>
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
