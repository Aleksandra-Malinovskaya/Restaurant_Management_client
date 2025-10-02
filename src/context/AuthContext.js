import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
} from "react";
import { authService } from "../services/authService";

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const savedUser = localStorage.getItem("user");

      console.log("🔐 checkAuth:", { token, savedUser });

      if (token && savedUser) {
        const userData = JSON.parse(savedUser);
        console.log("✅ Устанавливаем пользователя из localStorage:", userData);

        setUser(userData);
        setIsAuthenticated(true);

        // Дополнительная проверка токена
        try {
          const data = await authService.checkAuth();
          console.log("✅ Токен валиден:", data.user);
          setUser(data.user);
          localStorage.setItem("user", JSON.stringify(data.user));
        } catch (error) {
          console.log("⚠️ Токен невалиден, но используем сохраненные данные");
          // Оставляем сохраненные данные
        }
      } else {
        console.log("❌ Нет токена или пользователя в localStorage");
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error("❌ Ошибка checkAuth:", error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log("🔄 useEffect запущен");
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    try {
      console.log("🔐 Начало login:", email);
      const data = await authService.login(email, password);
      console.log("✅ Login успешен:", data);

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // ЯВНО устанавливаем состояние
      setUser(data.user);
      setIsAuthenticated(true);

      console.log("✅ Состояние установлено!", {
        user: data.user,
        isAuthenticated: true,
      });

      return { success: true };
    } catch (error) {
      console.error("❌ Ошибка login:", error);
      return {
        success: false,
        message: error.message || "Ошибка авторизации",
      };
    }
  };

  const register = async (email, password, firstName, lastName) => {
    try {
      const data = await authService.register(
        email,
        password,
        firstName,
        lastName
      );
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setUser(data.user);
      setIsAuthenticated(true);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.message || "Ошибка регистрации",
      };
    }
  };

  const logout = () => {
    console.log("🚪 Logout");
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    checkAuth,
  };

  console.log("🔄 AuthContext рендер:", {
    user,
    isLoading,
    isAuthenticated,
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
