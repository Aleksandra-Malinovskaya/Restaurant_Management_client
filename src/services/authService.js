import $api from "./api";

export const authService = {
  async login(email, password) {
    const response = await $api.post("/auth/login", { email, password });
    return response.data;
  },

  async register(email, password, firstName, lastName) {
    const response = await $api.post("/auth/register", {
      email,
      password,
      firstName,
      lastName,
    });
    return response.data;
  },

  async checkAuth() {
    const response = await $api.get("/auth/me");
    return response.data;
  },

  logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },
};
