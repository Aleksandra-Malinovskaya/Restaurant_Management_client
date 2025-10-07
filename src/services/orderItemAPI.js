import { $authHost } from "../http";

export const orderItemAPI = {
  async getKitchenItems() {
    const { data } = await $authHost.get("/order-items/kitchen");
    return data;
  },

  async updateStatus(id, status, chefId = null) {
    const updateData = { status };
    if (chefId) {
      updateData.chefId = chefId;
    }
    const { data } = await $authHost.put(
      `/order-items/${id}/status`,
      updateData
    );
    return data;
  },

  async markServed(id) {
    const { data } = await $authHost.put(`/order-items/${id}/served`);
    return data;
  },
};
