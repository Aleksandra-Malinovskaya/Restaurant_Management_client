import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  SUPER_ADMIN_ROLE,
  ADMIN_ROLE,
  WAITER_ROLE,
  CHEF_ROLE,
  TRAINEE_ROLE,
} from "../utils/consts";

// Основные страницы
import Auth from "./pages/Auth";
import Admin from "./pages/admin/Admin";
import Waiter from "./pages/Waiter";
import Chef from "./pages/Chef";
import Trainee from "./pages/Trainee";

// Админские страницы управления
import Users from "./pages/admin/Users";
import Dishes from "./pages/admin/Dishes";
import Categories from "./pages/admin/Categories";
import TablesManagement from "./pages/admin/TablesManagement";
import Stats from "./pages/admin/Stats";

const AppRouter = () => {
  const { user } = useAuth();

  console.log("🔄 AppRouter:", { user });

  // Определяем на какую страницу перенаправлять пользователя
  const getRolePage = () => {
    console.log("🎯 Определение страницы для роли:", user?.role);

    if (!user) {
      console.log("❌ Нет пользователя, показываем Auth");
      return <Auth />;
    }

    switch (user.role) {
      case SUPER_ADMIN_ROLE:
      case ADMIN_ROLE:
        console.log("✅ Перенаправляем на Admin");
        return <Admin />;
      case WAITER_ROLE:
        console.log("✅ Перенаправляем на Waiter");
        return <Waiter />;
      case CHEF_ROLE:
        console.log("✅ Перенаправляем на Chef");
        return <Chef />;
      case TRAINEE_ROLE:
        console.log("✅ Перенаправляем на Trainee");
        return <Trainee />;
      default:
        console.log("❓ Неизвестная роль, показываем Auth");
        return <Auth />;
    }
  };

  return (
    <Routes>
      {/* Основной маршрут */}
      <Route path="/" element={getRolePage()} />

      {/* Страницы авторизации */}
      <Route path="/auth" element={<Auth />} />

      {/* Главные страницы по ролям */}
      <Route path="/admin" element={<Admin />} />
      <Route path="/waiter" element={<Waiter />} />
      <Route path="/chef" element={<Chef />} />
      <Route path="/trainee" element={<Trainee />} />

      {/* Админские страницы управления - ДОЛЖНЫ БЫТЬ ПОЛНЫЕ ПУТИ */}
      <Route path="/admin/users" element={<Users />} />
      <Route path="/admin/dishes" element={<Dishes />} />
      <Route path="/admin/categories" element={<Categories />} />
      <Route path="/admin/tables" element={<TablesManagement />} />
      <Route path="/admin/statistics" element={<Stats />} />

      {/* Запасной маршрут */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRouter;
