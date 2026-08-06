import type { Order } from "@/lib/orders";

export type DashboardMetrics = {
  activeOrders: Order[];
  todayOrders: Order[];
  validTodayOrders: Order[];
  revenueToday: number;
  ticketAverageToday: number;
  delayedToday: number;
  deliveriesToday: number;
  pickupsToday: number;
  realAverageMinutes: number | null;
};

export function isSameLocalDay(value: string | Date, reference = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.getFullYear() === reference.getFullYear()
    && date.getMonth() === reference.getMonth()
    && date.getDate() === reference.getDate();
}

export function getRealDurationMinutes(order: Order): number | null {
  if (order.status !== "completed" || !Array.isArray(order.status_history)) return null;
  const approved = order.status_history.find((entry) => entry.status === "approved");
  const completed = [...order.status_history].reverse().find((entry) => entry.status === "completed");
  if (!approved || !completed) return null;
  const minutes = (new Date(completed.at).getTime() - new Date(approved.at).getTime()) / 60_000;
  return Number.isFinite(minutes) && minutes >= 0 && minutes <= 360 ? minutes : null;
}

export function calculateDashboardMetrics(orders: Order[], now = new Date()): DashboardMetrics {
  const activeOrders = orders.filter((order) => !order.deleted_at);
  const todayOrders = activeOrders.filter((order) => isSameLocalDay(order.created_at, now));
  const validTodayOrders = todayOrders.filter((order) => order.status !== "cancelled");
  const revenueToday = validTodayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const durations = activeOrders.map(getRealDurationMinutes).filter((value): value is number => value !== null);

  return {
    activeOrders,
    todayOrders,
    validTodayOrders,
    revenueToday,
    ticketAverageToday: validTodayOrders.length ? revenueToday / validTodayOrders.length : 0,
    delayedToday: todayOrders.filter((order) => order.status !== "completed" && order.status !== "cancelled" && now.getTime() - new Date(order.created_at).getTime() > 30 * 60_000).length,
    deliveriesToday: todayOrders.filter((order) => order.fulfillment === "Entrega").length,
    pickupsToday: todayOrders.filter((order) => order.fulfillment === "Retirada").length,
    realAverageMinutes: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
  };
}
