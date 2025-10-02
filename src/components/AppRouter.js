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

// Страницы для разных ролей
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Waiter from "./pages/Waiter";
import Chef from "./pages/Chef";
import Trainee from "./pages/Trainee";

const AppRouter = () => {
  const { user, isAuth } = useAuth();

  console.log("🔄 AppRouter:", { user, isAuth });

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
      <Route path="/" element={getRolePage()} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/waiter" element={<Waiter />} />
      <Route path="/chef" element={<Chef />} />
      <Route path="/trainee" element={<Trainee />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRouter;
