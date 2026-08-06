import type { SelectedOption } from "@/lib/products";

export type OrderStatus = "new" | "approved" | "preparing" | "ready" | "delivery" | "completed" | "cancelled";

export type OrderItemSnapshot = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  image?: string;
  selected_options: SelectedOption[];
  notes?: string;
};

export type Order = {
  id: string;
  order_code: string;
  customer_name: string;
  customer_phone: string;
  customer_id?: string | null;
  fulfillment: "Entrega" | "Retirada";
  address?: string;
  neighborhood?: string;
  complement?: string;
  payment_method: string;
  change_for?: string;
  notes?: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  created_at: string;
  viewed_at?: string | null;
  status_history?: Array<{ status: OrderStatus; at: string }>;
  tracking_token?: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  internal_notes?: string | null;
};

export const orderStatusLabel: Record<OrderStatus, string> = {
  new: "Pendente",
  approved: "Aprovado",
  preparing: "Em preparo",
  ready: "Pronto",
  delivery: "Saiu para entrega",
  completed: "Finalizado",
  cancelled: "Cancelado",
};
