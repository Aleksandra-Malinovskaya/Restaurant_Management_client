import { $authHost } from "../http";

export const orderAPI = {
  async getAll(params = {}) {
    const { data } = await $authHost.get("/orders", { params });
    return data;
  },

  async getKitchenOrders() {
    const { data } = await $authHost.get("/orders/kitchen");
    return data;
  },

  async getOne(id) {
    const { data } = await $authHost.get(`/orders/${id}`);
    return data;
  },

  async updateStatus(id, status) {
    const { data } = await $authHost.put(`/orders/${id}/status`, { status });
    return data;
  },

  async closeOrder(id, force = false) {
    const { data } = await $authHost.put(`/orders/${id}/close`, { force });
    return data;
  },

  async canClose(id) {
    const { data } = await $authHost.get(`/orders/${id}/can-close`);
    return data;
  },
};
