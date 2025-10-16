import { io } from "socket.io-client";

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect() {
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    this.socket = io("http://localhost:5000", {
      transports: ["websocket", "polling"],
    });

    this.socket.on("connect", () => {
      console.log("✅ WebSocket connected, ID:", this.socket.id);
      this.isConnected = true;
    });

    this.socket.on("disconnect", () => {
      console.log("❌ WebSocket disconnected");
      this.isConnected = false;
    });

    this.socket.on("connect_error", (error) => {
      console.error("❌ WebSocket connection error:", error);
      this.isConnected = false;
    });

    return this.socket;
  }

  // Уведомление о подключении пользователя
  userConnected(userData) {
    if (this.socket && this.isConnected) {
      console.log("📤 Отправка user_connected:", userData);
      this.socket.emit("user_connected", userData);
    } else {
      console.log("❌ WebSocket не подключен для отправки user_connected");
    }
  }

  // Подписка на уведомления для повара
  subscribeToChefNotifications(callback) {
    if (this.socket) {
      console.log("👨‍🍳 Подписка на уведомления для повара");
      this.socket.on("new_order_notification", callback);
    }
  }

  // Подписка на уведомления для официанта о готовых заказах
  subscribeToWaiterOrderNotifications(callback) {
    if (this.socket) {
      console.log("👨‍💼 Подписка на уведомления о готовых заказах");
      this.socket.on("order_ready_notification", callback);
    }
  }

  // Подписка на уведомления для официанта о готовых блюдах
  subscribeToWaiterDishNotifications(callback) {
    if (this.socket) {
      console.log("🍽️ Подписка на уведомления о готовых блюдах");
      this.socket.on("dish_ready_notification", callback);
    }
  }

  // Отписка от всех уведомлений
  unsubscribeAll() {
    if (this.socket) {
      console.log("🧹 Очистка всех WebSocket подписок");
      this.socket.off("new_order_notification");
      this.socket.off("order_ready_notification");
      this.socket.off("dish_ready_notification");
    }
  }

  // Отключение
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Проверка подключения
  getConnectionStatus() {
    return this.isConnected;
  }
}

const socketService = new SocketService();
export default socketService;
