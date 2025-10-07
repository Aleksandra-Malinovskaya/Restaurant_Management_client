import React, { createContext, useState, useContext, useEffect } from "react";
import { authAPI } from "../services/api";
import { JWT_TOKEN, USER_DATA } from "../utils/consts";

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem(JWT_TOKEN);
      const savedUser = localStorage.getItem(USER_DATA);

      console.log("🔐 checkAuth:", { token, savedUser });

      // Проверяем что savedUser не undefined и не null
      if (token && savedUser && savedUser !== "undefined") {
        try {
          const userData = JSON.parse(savedUser);
          console.log(
            "✅ Устанавливаем пользователя из localStorage:",
            userData
          );
          setUser(userData);

          // Проверяем актуальность токена
          try {
            const data = await authAPI.checkAuth();
            console.log("✅ Токен валиден:", data.user);
            setUser(data.user);
            localStorage.setItem(USER_DATA, JSON.stringify(data.user));
          } catch (e) {
            console.log("⚠️ Токен невалиден, но используем сохраненные данные");
            // Оставляем сохраненные данные
          }
        } catch (parseError) {
          console.error("❌ Ошибка парсинга user из localStorage:", parseError);
          // Очищаем некорректные данные
          localStorage.removeItem(USER_DATA);
          localStorage.removeItem(JWT_TOKEN);
        }
      } else {
        console.log("❌ Нет токена или пользователя в localStorage");
        setUser(null);
      }
    } catch (error) {
      console.error("❌ Ошибка checkAuth:", error);
      setUser(null);
    }
  };

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      console.log("🔐 Начало login:", email);
      const data = await authAPI.login(email, password);
      console.log("✅ Login успешен:", data);

      setUser(data.user);
      return { success: true };
    } catch (e) {
      console.error("❌ Ошибка login:", e);
      return {
        success: false,
        message: e.response?.data?.message || "Ошибка авторизации",
      };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email, password, firstName, lastName) => {
    setIsLoading(true);
    try {
      const data = await authAPI.register(email, password, firstName, lastName);
      setUser(data.user);
      return { success: true };
    } catch (e) {
      return {
        success: false,
        message: e.response?.data?.message || "Ошибка регистрации",
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    console.log("🚪 Logout");
    localStorage.removeItem(JWT_TOKEN);
    localStorage.removeItem(USER_DATA);
    setUser(null);
  };

  // Функция для обновления данных пользователя
  const updateUser = (newUserData) => {
    setUser((prevUser) => ({
      ...prevUser,
      ...newUserData,
    }));
    // Также обновляем в localStorage
    const updatedUser = { ...user, ...newUserData };
    localStorage.setItem(USER_DATA, JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser, // Добавляем setUser
        updateUser, // Добавляем updateUser
        isLoading,
        login,
        register,
        logout,
        isAuth: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
