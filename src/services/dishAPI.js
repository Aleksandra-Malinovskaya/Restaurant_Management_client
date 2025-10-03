import { $authHost } from "../http";

export const dishAPI = {
  async getAll(params = {}) {
    const { data } = await $authHost.get("dishes", { params });
    return data;
  },

  async getOne(id) {
    const { data } = await $authHost.get(`dishes/${id}`);
    return data;
  },

  async create(dishData) {
    const { data } = await $authHost.post("dishes", dishData);
    return data;
  },

  async update(id, dishData) {
    const { data } = await $authHost.put(`dishes/${id}`, dishData);
    return data;
  },

  async toggleStop(id) {
    const { data } = await $authHost.put(`dishes/${id}/stop`);
    return data;
  },

  async delete(id) {
    const { data } = await $authHost.delete(`dishes/${id}`);
    return data;
  },
};
