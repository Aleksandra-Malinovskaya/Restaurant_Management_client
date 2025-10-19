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
import Waiter from "./pages/waiter/Waiter";
import Chef from "./pages/chef/Chef";
import AdminPanel from "./pages/admins/AdminPanel";

// Админские страницы управления
import Users from "./pages/admin/Users";
import Dishes from "./pages/admin/Dishes";
import Categories from "./pages/admin/Categories";
import TablesManagement from "./pages/admin/TablesManagement";
import Stats from "./pages/admin/Stats";

// Страницы управления повара
import ChefMenu from "./pages/chef/ChefMenu";
import ChefOrders from "./pages/chef/ChefOrders";
import ChefSettings from "./pages/chef/ChefSettings";
import ChefHistory from "./pages/chef/ChefHistory";

import WaiterSettings from "./pages/waiter/WaiterSettings";
import WaiterMenu from "./pages/waiter/WaiterMenu";
import WaiterTable from "./pages/waiter/WaiterTable";
import WaiterReservations from "./pages/waiter/WaiterReservations";
import WaiterTables from "./pages/waiter/WaiterTables";

import AdminSettings from "./pages/admins/AdminSettings";
import TablesManagementAdmin from "./pages/admins/TablesManagementAdmin";
import DishesAdmin from "./pages/admins/DishesAdmin";
import CategoriesAdmin from "./pages/admins/CategoriesAdmin";
import StatsAdmin from "./pages/admins/StatsAdmin";

import Tranee from "./pages/trainee/Tranee";
import TraneeMenu from "./pages/trainee/TraneeMenu";
import TraneeSettings from "./pages/trainee/TraneeSettings";

// Компонент для защиты маршрутов
const ProtectedRoute = ({ role, requiredRole, children }) => {
  if (!role) {
    return <Navigate to="/auth" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

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
        console.log("✅ Перенаправляем супер-админа на /admin");
        return <Navigate to="/admin" replace />;
      case ADMIN_ROLE:
        console.log("✅ Перенаправляем админа на /admin-panel");
        return <Navigate to="/admin-panel" replace />;
      case WAITER_ROLE:
        console.log("✅ Перенаправляем на Waiter");
        return <Navigate to="/waiter" replace />;
      case CHEF_ROLE:
        console.log("✅ Перенаправляем на Chef");
        return <Navigate to="/chef" replace />;
      case TRAINEE_ROLE:
        console.log("✅ Перенаправляем на Trainee");
        return <Navigate to="/trainee" replace />;
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

      {/* Главные страницы по ролям с защитой */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute role={user?.role} requiredRole={SUPER_ADMIN_ROLE}>
            <Admin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-panel"
        element={
          <ProtectedRoute role={user?.role} requiredRole={ADMIN_ROLE}>
            <AdminPanel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/waiter"
        element={
          <ProtectedRoute role={user?.role} requiredRole={WAITER_ROLE}>
            <Waiter />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chef"
        element={
          <ProtectedRoute role={user?.role} requiredRole={CHEF_ROLE}>
            <Chef />
          </ProtectedRoute>
        }
      />
      <Route
        path="/trainee"
        element={
          <ProtectedRoute role={user?.role} requiredRole={TRAINEE_ROLE}>
            <Tranee />
          </ProtectedRoute>
        }
      />

      {/* Админские страницы управления (только для супер-админа) */}
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute role={user?.role} requiredRole={SUPER_ADMIN_ROLE}>
            <Users />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/dishes"
        element={
          <ProtectedRoute role={user?.role} requiredRole={SUPER_ADMIN_ROLE}>
            <Dishes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/categories"
        element={
          <ProtectedRoute role={user?.role} requiredRole={SUPER_ADMIN_ROLE}>
            <Categories />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/tables"
        element={
          <ProtectedRoute role={user?.role} requiredRole={SUPER_ADMIN_ROLE}>
            <TablesManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/statistics"
        element={
          <ProtectedRoute role={user?.role} requiredRole={SUPER_ADMIN_ROLE}>
            <Stats />
          </ProtectedRoute>
        }
      />

      {/* Маршруты повара */}
      <Route
        path="/chef/orders"
        element={
          <ProtectedRoute role={user?.role} requiredRole={CHEF_ROLE}>
            <ChefOrders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chef/menu"
        element={
          <ProtectedRoute role={user?.role} requiredRole={CHEF_ROLE}>
            <ChefMenu />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chef/history"
        element={
          <ProtectedRoute role={user?.role} requiredRole={CHEF_ROLE}>
            <ChefHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chef/settings"
        element={
          <ProtectedRoute role={user?.role} requiredRole={CHEF_ROLE}>
            <ChefSettings />
          </ProtectedRoute>
        }
      />

      {/* Маршруты официанта */}
      <Route
        path="/waiter/settings"
        element={
          <ProtectedRoute role={user?.role} requiredRole={WAITER_ROLE}>
            <WaiterSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/waiter/menu"
        element={
          <ProtectedRoute role={user?.role} requiredRole={WAITER_ROLE}>
            <WaiterMenu />
          </ProtectedRoute>
        }
      />
      <Route
        path="/waiter/table/:tableId"
        element={
          <ProtectedRoute role={user?.role} requiredRole={WAITER_ROLE}>
            <WaiterTable />
          </ProtectedRoute>
        }
      />
      <Route
        path="/waiter/tables"
        element={
          <ProtectedRoute role={user?.role} requiredRole={WAITER_ROLE}>
            <WaiterTables />
          </ProtectedRoute>
        }
      />
      <Route
        path="/waiter/reservations"
        element={
          <ProtectedRoute role={user?.role} requiredRole={WAITER_ROLE}>
            <WaiterReservations />
          </ProtectedRoute>
        }
      />

      {/* АДМИН-ПАНЕЛЬ МАРШРУТЫ (для обычных админов) */}
      <Route
        path="/admin-panel/tables"
        element={
          <ProtectedRoute role={user?.role} requiredRole={ADMIN_ROLE}>
            <TablesManagementAdmin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-panel/settings"
        element={
          <ProtectedRoute role={user?.role} requiredRole={ADMIN_ROLE}>
            <AdminSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-panel/dishes"
        element={
          <ProtectedRoute role={user?.role} requiredRole={ADMIN_ROLE}>
            <DishesAdmin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-panel/categories"
        element={
          <ProtectedRoute role={user?.role} requiredRole={ADMIN_ROLE}>
            <CategoriesAdmin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-panel/stats"
        element={
          <ProtectedRoute role={user?.role} requiredRole={ADMIN_ROLE}>
            <StatsAdmin />
          </ProtectedRoute>
        }
      />
      <Route path="/tranee" element={<Tranee />} />
      <Route path="/tranee/menu" element={<TraneeMenu />} />
      <Route path="/tranee/settings" element={<TraneeSettings />} />

      {/* Страница "Не авторизован" */}
      <Route
        path="/unauthorized"
        element={
          <div className="container-fluid vh-100 bg-light d-flex justify-content-center align-items-center">
            <div className="card shadow">
              <div className="card-body text-center p-5">
                <i className="bi bi-shield-exclamation display-1 text-warning"></i>
                <h3 className="mt-3">Доступ запрещен</h3>
                <p className="text-muted">
                  У вас недостаточно прав для доступа к этой странице
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => window.history.back()}
                >
                  Назад
                </button>
              </div>
            </div>
          </div>
        }
      />

      {/* Запасной маршрут */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRouter;
