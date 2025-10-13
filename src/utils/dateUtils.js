// Функция для проверки активных заказов на столике
export const hasActiveOrders = (orders, tableId) => {
  return orders.some(
    (order) =>
      order.tableId === tableId &&
      ["open", "in_progress", "ready", "served", "payment"].includes(
        order.status
      )
  );
};

// dateUtils.js - пример корректных функций
export const formatForDateTimeLocal = (date) => {
  if (!date) return "";

  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const localToUTC = (localDateTimeString) => {
  if (!localDateTimeString) return null;

  // Создаем дату из локальной строки
  const localDate = new Date(localDateTimeString);

  // Возвращаем в ISO формате (уже в UTC)
  return localDate.toISOString();
};

export const formatLocalDateTime = (utcDateString) => {
  if (!utcDateString) return "";

  const date = new Date(utcDateString);
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const UTCToLocal = (utcDateTime) => {
  const date = new Date(utcDateTime);
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() + timezoneOffset + 3 * 60 * 60000);
};

// Функция для автоматического завершения бронирований
export const autoCompleteReservation = async (tableId, $authHost) => {
  try {
    // Получаем все бронирования столика
    const reservationsResponse = await $authHost.get("/reservations");
    const tableReservations = reservationsResponse.data.filter(
      (r) => r.tableId === tableId && r.status === "seated"
    );

    const now = new Date();

    for (const reservation of tableReservations) {
      // Если время брони истекло или прошло более 15 минут после окончания
      const reservedTo = new Date(reservation.reservedTo);
      const fifteenMinutesAfter = new Date(reservedTo.getTime() + 15 * 60000);

      // Коррекция времени для сравнения
      const timezoneOffset = now.getTimezoneOffset() * 60000;
      const localNow = new Date(
        now.getTime() + timezoneOffset + 3 * 60 * 60000
      );
      const localFifteenMinutesAfter = new Date(
        fifteenMinutesAfter.getTime() + timezoneOffset + 3 * 60 * 60000
      );

      if (localNow > localFifteenMinutesAfter) {
        // Автоматически завершаем бронь
        await $authHost.put(`/reservations/${reservation.id}`, {
          status: "completed",
        });
        console.log(`Бронирование ${reservation.id} автоматически завершено`);
        return true;
      }
    }
  } catch (error) {
    console.error("Ошибка при автоматическом завершении брони:", error);
  }
  return false;
};

// Функция для автоматического обновления брони при создании заказа
export const autoUpdateReservationToSeated = async (tableId, $authHost) => {
  try {
    // Получаем все бронирования столика
    const reservationsResponse = await $authHost.get("/reservations");
    const tableReservations = reservationsResponse.data.filter(
      (r) => r.tableId === tableId
    );

    const now = new Date();

    // Ищем активную бронь
    const activeReservation = tableReservations.find((reservation) => {
      const reservedFrom = UTCToLocal(reservation.reservedFrom);
      const reservedTo = UTCToLocal(reservation.reservedTo);
      return (
        reservedFrom <= now &&
        reservedTo >= now &&
        reservation.status === "confirmed"
      );
    });

    if (activeReservation) {
      // Автоматически переводим в статус "seated"
      await $authHost.put(`/reservations/${activeReservation.id}`, {
        status: "seated",
      });
      console.log(
        `Бронирование ${activeReservation.id} автоматически переведено в "seated"`
      );
      return activeReservation.id;
    }
  } catch (error) {
    console.error("Ошибка при автоматическом обновлении брони:", error);
  }
  return null;
};
