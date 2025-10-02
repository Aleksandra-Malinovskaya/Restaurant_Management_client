import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Редирект если уже авторизован
  React.useEffect(() => {
    console.log("🔍 Login проверка авторизации:", isAuthenticated);
    if (isAuthenticated) {
      console.log("✅ Уже авторизован, редирект на /dashboard");
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    console.log("📤 Отправка формы login");

    const result = await login(formData.email, formData.password);

    if (result.success) {
      console.log("✅ Login успешен, ждем обновления состояния...");
      // Не делаем navigate здесь - сработает useEffect выше
    } else {
      console.log("❌ Login ошибка:", result.message);
      setError(result.message);
      setIsLoading(false);
    }
  };

  const testBackend = async () => {
    try {
      const response = await fetch("http://localhost:5000/api/auth/me", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await response.json();
      console.log("Тест бэкенда:", data);
      alert(`Бэкенд отвечает: ${data.user ? "Авторизован" : "Не авторизован"}`);
    } catch (err) {
      console.error("Бэкенд не доступен:", err);
      alert("Бэкенд не доступен!");
    }
  };

  return (
    <div className="container-fluid vh-100 bg-light">
      <div className="row h-100 justify-content-center align-items-center">
        <div className="col-md-4 col-sm-8">
          <div className="text-center mb-3">
            <button
              onClick={testBackend}
              className="btn btn-outline-secondary btn-sm"
            >
              Проверить авторизацию
            </button>
          </div>

          <div className="card shadow">
            <div className="card-header bg-primary text-white text-center">
              <h4 className="mb-0">
                <i className="bi bi-shop me-2"></i>
                Ресторан "DINOSER"
              </h4>
              <small>Система управления</small>
            </div>
            <div className="card-body p-4">
              <h5 className="card-title text-center mb-4">Вход в систему</h5>

              {error && (
                <div className="alert alert-danger">
                  <strong>Ошибка:</strong> {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="email" className="form-label">
                    <i className="bi bi-envelope me-2"></i>
                    Email адрес
                  </label>
                  <input
                    type="email"
                    className="form-control"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="admin@restaurant.com"
                    required
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="password" className="form-label">
                    <i className="bi bi-lock me-2"></i>
                    Пароль
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Введите пароль"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn btn-primary w-100 py-2"
                >
                  {isLoading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                      ></span>
                      Вход...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-box-arrow-in-right me-2"></i>
                      Войти
                    </>
                  )}
                </button>
              </form>

              <div className="text-center mt-3">
                <small className="text-muted">
                  Нет аккаунта?{" "}
                  <Link to="/register" className="text-decoration-none">
                    Зарегистрироваться
                  </Link>
                </small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
