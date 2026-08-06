"use client";

import { Bell, Check, PackageCheck, ShoppingBag, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Order } from "@/lib/orders";
import { orderStatusLabel } from "@/lib/orders";

type NotificationItem = {
  id: string;
  orderId: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  kind: "new" | "status" | "cancelled" | "deleted";
};

const STORAGE_KEY = "pipoka-admin-notifications-v1";

export default function AdminNotifications({ orders, enabled, onOpenOrders }: { orders: Order[]; enabled: boolean; onOpenOrders: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const previous = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setItems(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 80))); } catch {}
  }, [items]);

  useEffect(() => {
    const current = new Map(orders.map(order => [order.id, `${order.status}|${order.deleted_at || ""}`]));
    if (!previous.current) {
      previous.current = current;
      return;
    }

    const additions: NotificationItem[] = [];
    for (const order of orders) {
      const before = previous.current.get(order.id);
      const now = current.get(order.id);
      if (!before && order.status === "new" && !order.deleted_at) {
        additions.push({ id: crypto.randomUUID(), orderId: order.id, title: `Novo pedido #${order.order_code}`, body: `${order.customer_name} · R$ ${Number(order.total).toFixed(2).replace(".", ",")}`, createdAt: new Date().toISOString(), read: false, kind: "new" });
      } else if (before && before !== now) {
        if (order.deleted_at && !before.split("|")[1]) {
          additions.push({ id: crypto.randomUUID(), orderId: order.id, title: `Pedido #${order.order_code} excluído`, body: "O pedido foi movido para a área de excluídos.", createdAt: new Date().toISOString(), read: false, kind: "deleted" });
        } else if (order.status === "cancelled" && !before.startsWith("cancelled|")) {
          additions.push({ id: crypto.randomUUID(), orderId: order.id, title: `Pedido #${order.order_code} cancelado`, body: order.customer_name, createdAt: new Date().toISOString(), read: false, kind: "cancelled" });
        } else if (!order.deleted_at) {
          additions.push({ id: crypto.randomUUID(), orderId: order.id, title: `Pedido #${order.order_code} atualizado`, body: orderStatusLabel[order.status], createdAt: new Date().toISOString(), read: false, kind: "status" });
        }
      }
    }
    if (enabled && additions.length) setItems(currentItems => [...additions, ...currentItems].slice(0, 80));
    previous.current = current;
  }, [orders, enabled]);

  const unread = useMemo(() => items.filter(item => !item.read).length, [items]);
  function markAllRead() { setItems(current => current.map(item => ({ ...item, read: true }))); }
  function clearAll() { setItems([]); }
  function openOrders() { markAllRead(); setOpen(false); onOpenOrders(); }

  return <div className="admin-notifications-v3">
    <button type="button" className="admin-notification-button-v3" onClick={() => setOpen(value => !value)} aria-label="Notificações">
      <Bell size={18}/>{unread > 0 && <span>{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <div className="admin-notification-panel-v3">
      <header><div><strong>Notificações</strong><small>{unread ? `${unread} não lida(s)` : "Tudo em dia"}</small></div><button onClick={() => setOpen(false)} aria-label="Fechar"><X size={17}/></button></header>
      <div className="admin-notification-tools-v3"><button onClick={markAllRead}><Check size={15}/> Marcar como lidas</button><button onClick={clearAll}><Trash2 size={15}/> Limpar</button></div>
      <div className="admin-notification-list-v3">
        {items.slice(0, 20).map(item => <button key={item.id} className={item.read ? "read" : ""} onClick={openOrders}>
          {item.kind === "new" ? <ShoppingBag/> : <PackageCheck/>}<span><strong>{item.title}</strong><small>{item.body}</small><time>{new Date(item.createdAt).toLocaleString("pt-BR")}</time></span>
        </button>)}
        {!items.length && <p>Nenhuma notificação registrada neste navegador.</p>}
      </div>
    </div>}
  </div>;
}
