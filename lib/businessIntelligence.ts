import type { Order } from "@/lib/orders";

export type BIPeriod = "today" | "7d" | "30d" | "month" | "year";
export type BIDataPoint = { label: string; value: number; secondary?: number };
export type BIRankingItem = { label: string; quantity: number; revenue: number };
export type BIInsight = { tone: "positive" | "warning" | "neutral"; title: string; text: string };

export type BusinessIntelligenceData = {
  orders: Order[];
  previousOrders: Order[];
  revenue: number;
  previousRevenue: number;
  growthPercent: number | null;
  orderCount: number;
  ticketAverage: number;
  cancelledCount: number;
  revenueSeries: BIDataPoint[];
  orderSeries: BIDataPoint[];
  topProducts: BIRankingItem[];
  topFlavors: BIRankingItem[];
  topCustomers: BIRankingItem[];
  payments: BIDataPoint[];
  fulfillment: BIDataPoint[];
  hourly: BIDataPoint[];
  weekdays: BIDataPoint[];
  insights: BIInsight[];
};

const DAY_MS = 86_400_000;

function localStartOfDay(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function periodBounds(period: BIPeriod, now = new Date()) {
  const today = localStartOfDay(now);
  let start = today;
  let previousStart = today;
  let previousEnd = today;
  let bucket: "hour" | "day" | "month" = "day";

  if (period === "today") {
    start = today;
    previousStart = new Date(today.getTime() - DAY_MS);
    previousEnd = today;
    bucket = "hour";
  } else if (period === "7d") {
    start = new Date(today.getTime() - 6 * DAY_MS);
    previousStart = new Date(start.getTime() - 7 * DAY_MS);
    previousEnd = start;
  } else if (period === "30d") {
    start = new Date(today.getTime() - 29 * DAY_MS);
    previousStart = new Date(start.getTime() - 30 * DAY_MS);
    previousEnd = start;
  } else if (period === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    previousEnd = start;
  } else {
    start = new Date(now.getFullYear(), 0, 1);
    previousStart = new Date(now.getFullYear() - 1, 0, 1);
    previousEnd = start;
    bucket = "month";
  }

  const end = new Date(now.getTime() + 1000);
  return { start, end, previousStart, previousEnd, bucket };
}

function validOrders(orders: Order[]) {
  return orders.filter((order) => !order.deleted_at);
}

function revenueOrders(orders: Order[]) {
  return orders.filter((order) => order.status !== "cancelled");
}

function between(order: Order, start: Date, end: Date) {
  const time = new Date(order.created_at).getTime();
  return time >= start.getTime() && time < end.getTime();
}

function groupSeries(orders: Order[], start: Date, end: Date, bucket: "hour" | "day" | "month") {
  const map = new Map<string, { label: string; revenue: number; count: number; sort: number }>();
  const cursor = new Date(start);

  while (cursor < end) {
    let key = "";
    let label = "";
    let next: Date;
    if (bucket === "hour") {
      key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}-${cursor.getHours()}`;
      label = `${String(cursor.getHours()).padStart(2, "0")}h`;
      next = new Date(cursor.getTime() + 60 * 60_000);
    } else if (bucket === "month") {
      key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      label = cursor.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    } else {
      key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
      label = cursor.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      next = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
    map.set(key, { label, revenue: 0, count: 0, sort: cursor.getTime() });
    cursor.setTime(next.getTime());
  }

  orders.forEach((order) => {
    const date = new Date(order.created_at);
    let key = "";
    if (bucket === "hour") key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
    else if (bucket === "month") key = `${date.getFullYear()}-${date.getMonth()}`;
    else key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const current = map.get(key);
    if (!current) return;
    current.count += 1;
    if (order.status !== "cancelled") current.revenue += Number(order.total || 0);
  });

  return [...map.values()].sort((a, b) => a.sort - b.sort);
}

function rankingFromItems(orders: Order[], flavor = false): BIRankingItem[] {
  const map = new Map<string, BIRankingItem>();
  revenueOrders(orders).forEach((order) => {
    order.items.forEach((item) => {
      if (flavor) {
        item.selected_options.forEach((option) => {
          const label = option.optionName?.trim();
          if (!label) return;
          const quantity = Math.max(1, Number(option.quantity || 1)) * Number(item.quantity || 1);
          const current = map.get(label) || { label, quantity: 0, revenue: 0 };
          current.quantity += quantity;
          current.revenue += Number(option.price || 0) * quantity;
          map.set(label, current);
        });
      } else {
        const label = item.name || "Produto";
        const current = map.get(label) || { label, quantity: 0, revenue: 0 };
        current.quantity += Number(item.quantity || 0);
        current.revenue += Number(item.unit_price || 0) * Number(item.quantity || 0);
        map.set(label, current);
      }
    });
  });
  return [...map.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 10);
}

function rankingCustomers(orders: Order[]): BIRankingItem[] {
  const map = new Map<string, BIRankingItem>();
  revenueOrders(orders).forEach((order) => {
    const phone = order.customer_phone.replace(/\D/g, "");
    const key = phone || order.customer_name;
    const label = order.customer_name || "Cliente";
    const current = map.get(key) || { label, quantity: 0, revenue: 0 };
    current.quantity += 1;
    current.revenue += Number(order.total || 0);
    map.set(key, current);
  });
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
}

function categorical(orders: Order[], getter: (order: Order) => string): BIDataPoint[] {
  const map = new Map<string, number>();
  orders.forEach((order) => {
    const label = getter(order) || "Não informado";
    map.set(label, (map.get(label) || 0) + 1);
  });
  return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function calculateBusinessIntelligence(orders: Order[], period: BIPeriod, now = new Date()): BusinessIntelligenceData {
  const bounds = periodBounds(period, now);
  const active = validOrders(orders);
  const current = active.filter((order) => between(order, bounds.start, bounds.end));
  const previous = active.filter((order) => between(order, bounds.previousStart, bounds.previousEnd));
  const currentRevenueOrders = revenueOrders(current);
  const previousRevenueOrders = revenueOrders(previous);
  const revenue = currentRevenueOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const previousRevenue = previousRevenueOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const growthPercent = previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : null;
  const series = groupSeries(current, bounds.start, bounds.end, bounds.bucket);
  const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const weekdayMap = new Map<string, number>(weekdayLabels.map((label) => [label, 0]));
  const hourMap = new Map<string, number>();
  current.forEach((order) => {
    const date = new Date(order.created_at);
    const weekday = weekdayLabels[date.getDay()];
    weekdayMap.set(weekday, (weekdayMap.get(weekday) || 0) + 1);
    const hour = `${String(date.getHours()).padStart(2, "0")}h`;
    hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
  });

  const topProducts = rankingFromItems(current);
  const topFlavors = rankingFromItems(current, true);
  const topCustomers = rankingCustomers(current);
  const payments = categorical(currentRevenueOrders, (order) => order.payment_method);
  const fulfillment = categorical(currentRevenueOrders, (order) => order.fulfillment);
  const hourly = [...hourMap.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => Number(a.label.slice(0, 2)) - Number(b.label.slice(0, 2)));
  const weekdays = weekdayLabels.map((label) => ({ label, value: weekdayMap.get(label) || 0 }));
  const insights: BIInsight[] = [];

  if (growthPercent !== null) {
    insights.push({
      tone: growthPercent >= 0 ? "positive" : "warning",
      title: growthPercent >= 0 ? "Crescimento no período" : "Queda no período",
      text: `O faturamento ${growthPercent >= 0 ? "cresceu" : "caiu"} ${Math.abs(growthPercent).toFixed(1).replace(".", ",")}% em relação ao período anterior.`,
    });
  }
  if (topProducts[0]) insights.push({ tone: "positive", title: "Produto líder", text: `${topProducts[0].label} lidera com ${topProducts[0].quantity} unidade(s) vendida(s).` });
  if (topFlavors[0]) insights.push({ tone: "neutral", title: "Sabor mais escolhido", text: `${topFlavors[0].label} foi a opção mais escolhida no período.` });
  const bestHour = [...hourly].sort((a, b) => b.value - a.value)[0];
  if (bestHour?.value) insights.push({ tone: "neutral", title: "Horário de pico", text: `${bestHour.label} concentrou o maior volume de pedidos.` });
  const bestWeekday = [...weekdays].sort((a, b) => b.value - a.value)[0];
  if (bestWeekday?.value) insights.push({ tone: "positive", title: "Melhor dia", text: `${bestWeekday.label} foi o dia com mais pedidos no período.` });
  if (current.length > 0) {
    const cancellationRate = (current.filter((order) => order.status === "cancelled").length / current.length) * 100;
    if (cancellationRate > 10) insights.push({ tone: "warning", title: "Atenção aos cancelamentos", text: `${cancellationRate.toFixed(1).replace(".", ",")}% dos pedidos foram cancelados.` });
  }

  return {
    orders: current,
    previousOrders: previous,
    revenue,
    previousRevenue,
    growthPercent,
    orderCount: current.length,
    ticketAverage: currentRevenueOrders.length ? revenue / currentRevenueOrders.length : 0,
    cancelledCount: current.filter((order) => order.status === "cancelled").length,
    revenueSeries: series.map((item) => ({ label: item.label, value: item.revenue })),
    orderSeries: series.map((item) => ({ label: item.label, value: item.count })),
    topProducts,
    topFlavors,
    topCustomers,
    payments,
    fulfillment,
    hourly,
    weekdays,
    insights,
  };
}
