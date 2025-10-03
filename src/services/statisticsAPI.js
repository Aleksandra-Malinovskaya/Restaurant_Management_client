import { $authHost } from "../http";

export const statisticsAPI = {
  async getDashboardStats() {
    const { data } = await $authHost.get("stats/dashboard");
    return data;
  },

  async getDailyStats(date) {
    const { data } = await $authHost.get("stats/daily", { params: { date } });
    return data;
  },

  async getWeeklyStats() {
    const { data } = await $authHost.get("stats/weekly");
    return data;
  },

  async getMonthlyStats() {
    const { data } = await $authHost.get("stats/monthly");
    return data;
  },

  async getPopularDishes(period = "month") {
    const { data } = await $authHost.get("stats/popular-dishes", {
      params: { period },
    });
    return data;
  },
};
