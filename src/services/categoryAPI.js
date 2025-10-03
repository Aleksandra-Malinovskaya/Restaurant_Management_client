import { $authHost } from "../http";

export const categoryAPI = {
  async getAll() {
    const { data } = await $authHost.get("categories");
    return data;
  },

  async create(categoryData) {
    const { data } = await $authHost.post("categories", categoryData);
    return data;
  },

  async update(id, categoryData) {
    const { data } = await $authHost.put(`categories/${id}`, categoryData);
    return data;
  },

  async delete(id) {
    const { data } = await $authHost.delete(`categories/${id}`);
    return data;
  },
};
