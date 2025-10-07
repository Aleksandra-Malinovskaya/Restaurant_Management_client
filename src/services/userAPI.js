import { $authHost } from "../http";

export const userAPI = {
  async getAll() {
    const { data } = await $authHost.get("users");
    return data;
  },

  async getOne(id) {
    const { data } = await $authHost.get(`users/${id}`);
    return data;
  },

  async create(userData) {
    const { data } = await $authHost.post("users", userData);
    return data;
  },

  async update(id, userData) {
    const { data } = await $authHost.put(`users/${id}`, userData);
    return data;
  },

  async changeRole(id, role) {
    const { data } = await $authHost.put(`users/${id}/role`, { role });
    return data;
  },

  async changeStatus(id, isActive) {
    const { data } = await $authHost.put(`users/${id}/status`, { isActive });
    return data;
  },

  async delete(id) {
    const { data } = await $authHost.delete(`users/${id}`);
    return data;
  },
};
