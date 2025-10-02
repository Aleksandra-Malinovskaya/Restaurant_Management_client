import { $host, $authHost } from "../http";
import { JWT_TOKEN, USER_DATA } from "../utils/consts";

export const authAPI = {
  async login(email, password) {
    const { data } = await $host.post("auth/login", { email, password });
    console.log("📨 Данные от сервера при логине:", data);

    // Убедимся что данные есть перед записью
    if (data.token && data.user) {
      localStorage.setItem(JWT_TOKEN, data.token);
      localStorage.setItem(USER_DATA, JSON.stringify(data.user));
      console.log("✅ Данные записаны в localStorage:", data.user);
    } else {
      console.error("❌ Нет token или user в ответе сервера");
    }
    return data;
  },

  async register(email, password, firstName, lastName) {
    const { data } = await $host.post("auth/register", {
      email,
      password,
      firstName,
      lastName,
    });
    console.log("📨 Данные от сервера при регистрации:", data);

    if (data.token && data.user) {
      localStorage.setItem(JWT_TOKEN, data.token);
      localStorage.setItem(USER_DATA, JSON.stringify(data.user));
      console.log("✅ Данные записаны в localStorage:", data.user);
    } else {
      console.error("❌ Нет token или user в ответе сервера");
    }
    return data;
  },

  async checkAuth() {
    try {
      const { data } = await $authHost.get("auth/me");
      console.log("🔐 Проверка авторизации:", data);
      if (data.user) {
        localStorage.setItem(USER_DATA, JSON.stringify(data.user));
      }
      return data;
    } catch (error) {
      console.error("❌ Ошибка проверки авторизации:", error);
      throw error;
    }
  },
};
