"use client";

import Image from "next/image";
import Link from "next/link";
import { Bell, Check, ChefHat, Clock3, Package, ShieldCheck, Truck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { OrderStatus } from "@/lib/orders";
import { getSettings, getTrackedOrder } from "@/lib/supabase";
import { defaultSettings } from "@/lib/store";

type TrackedItem = {
  name: string;
  quantity: number;
  unit_price?: number;
  image?: string;
  selected_options?: Array<{ group_name?: string; groupName?: string; option_name?: string; optionName?: string; name?: string }>;
  notes?: string;
};
type TrackedOrder = {
  order_code: string;
  customer_name: string;
  fulfillment: "Entrega" | "Retirada";
  payment_method?: string;
  status: OrderStatus;
  created_at: string;
  total: number;
  items: TrackedItem[];
  status_history?: Array<{ status: OrderStatus; at: string }>;
};

const rank: Record<OrderStatus, number> = { new: 0, approved: 1, preparing: 2, ready: 3, delivery: 4, completed: 5, cancelled: -1 };

function TrackingContent() {
  const params = useSearchParams();
  const fromLink = Boolean(params.get("pedido") && params.get("codigo"));
  const [orderCode, setOrderCode] = useState(params.get("pedido") || "");
  const [token, setToken] = useState(params.get("codigo") || "");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [estimated, setEstimated] = useState({ min: 30, max: 40 });
  const previousStatus = useRef<OrderStatus | null>(null);

  const steps = useMemo(() => order?.fulfillment === "Retirada"
    ? [
        { status: "approved" as OrderStatus, label: "Pedido aceito", icon: Check },
        { status: "preparing" as OrderStatus, label: "Preparando", icon: ChefHat },
        { status: "ready" as OrderStatus, label: "Pronto", icon: Package },
      ]
    : [
        { status: "approved" as OrderStatus, label: "Pedido aceito", icon: Check },
        { status: "preparing" as OrderStatus, label: "Preparando", icon: ChefHat },
        { status: "ready" as OrderStatus, label: "Pronto", icon: Package },
        { status: "delivery" as OrderStatus, label: "Saiu para entrega", icon: Truck },
      ], [order?.fulfillment]);

  function sound() {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 760;
      gain.gain.setValueAtTime(0.001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.52);
      window.setTimeout(() => void context.close(), 700);
    } catch {}
  }

  async function load(silent = false) {
    if (!orderCode.trim() || !token.trim()) {
      if (!silent) setError("Informe o número e o código do pedido.");
      return;
    }
    if (!silent) setLoading(true);
    try {
      const data = await getTrackedOrder(orderCode, token) as TrackedOrder | null;
      if (!data) throw new Error("Pedido não encontrado. Confira o link recebido.");
      if (previousStatus.current && previousStatus.current !== data.status) sound();
      previousStatus.current = data.status;
      setOrder({ ...data, total: Number(data.total || 0), items: Array.isArray(data.items) ? data.items : [], status_history: Array.isArray(data.status_history) ? data.status_history : [] });
      setError("");
    } catch (cause) {
      if (!silent) setError(cause instanceof Error ? cause.message : "Não foi possível acompanhar o pedido.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void getSettings().then((value: any) => setEstimated({ min: Number(value?.estimated_time_min || 30), max: Number(value?.estimated_time_max || 40) })).catch(() => {});
    if (!orderCode || !token) {
      try {
        const saved = JSON.parse(localStorage.getItem("pipoka-last-order") || "null");
        if (saved?.orderCode && saved?.trackingToken) { setOrderCode(saved.orderCode); setToken(saved.trackingToken); }
      } catch {}
    }
  }, []);
  useEffect(() => { if (orderCode && token && !order) void load(); }, [orderCode, token]);
  useEffect(() => {
    if (!order) return;
    const tick = () => { if (document.visibilityState === "visible") void load(true); };
    const id = window.setInterval(tick, 2500);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [order?.order_code, token]);

  function submit(event: FormEvent) { event.preventDefault(); void load(); }
  const current = order?.status || "new";
  const statusInfo = current === "new" ? { icon: "🍿", title: "Pedido recebido!", text: "Aguardando a confirmação da PIPOKÁ." }
    : current === "approved" ? { icon: "✅", title: "Pedido aceito!", text: "Seu pedido foi confirmado e entrou na fila de preparo." }
    : current === "preparing" ? { icon: "👨‍🍳", title: "Estamos preparando sua pipoca!", text: "Tudo está sendo preparado com muito carinho." }
    : current === "ready" ? { icon: "📦", title: order?.fulfillment === "Retirada" ? "Seu pedido está pronto para retirada!" : "Seu pedido está pronto!", text: order?.fulfillment === "Retirada" ? "Pode vir buscar sua delícia." : "Ele será enviado em breve." }
    : current === "delivery" ? { icon: "🛵", title: "Seu pedido saiu para entrega!", text: "Já está a caminho de você. Fique de olho!" }
    : current === "cancelled" ? { icon: "⚠️", title: "Pedido cancelado", text: "Fale com a PIPOKÁ para mais informações." }
    : { icon: "❤️", title: "Obrigado por escolher a PIPOKÁ!", text: "Esperamos que tenha gostado." };
  const whatsapp = `https://wa.me/${defaultSettings.whatsapp_number}`;

  return <section className="tracking-page-pro"><div className="tracking-shell-pro">
    <header className="tracking-brand-pro">
      <Link href="/" className="tracking-back-pro" aria-label="Voltar">←</Link>
      <Image src="/logo.jpeg" alt="PIPOKÁ Gourmet" width={150} height={150} className="tracking-logo-pro" priority />
      <button onClick={() => { setSoundEnabled(value => !value); if (!soundEnabled) window.setTimeout(sound, 20); }} className="tracking-sound-pro"><Bell size={18}/>{soundEnabled ? "Som ativado" : "Ativar som"}<i className={soundEnabled ? "on" : ""}/></button>
      <h1>Acompanhe seu pedido</h1><p>Tudo sendo preparado com muito carinho para você! ♡</p>
      <span className="tracking-estimate-pro"><Clock3 size={19}/> Tempo estimado: <strong>{estimated.min} a {estimated.max} minutos</strong></span>
    </header>

    {(!fromLink && !order) && <form onSubmit={submit} className="tracking-search-pro"><input value={orderCode} onChange={e => setOrderCode(e.target.value.replace(/\D/g, ""))} placeholder="Número do pedido"/><input value={token} onChange={e => setToken(e.target.value.trim())} placeholder="Código de acompanhamento"/><button disabled={loading}>{loading ? "Buscando..." : "Acompanhar"}</button></form>}
    {error && <p className="tracking-error-pro">{error}</p>}

    {order && <>
      <main className="tracking-status-card-pro">
        <div className="tracking-progress-pro">{steps.map((step, index) => {
          const Icon = step.icon;
          const done = rank[current] >= rank[step.status] || current === "completed";
          const active = current === step.status;
          const time = order.status_history?.find(entry => entry.status === step.status)?.at;
          return <div key={step.status} className={`${done ? "done" : ""} ${active ? "active" : ""}`}><span><Icon/></span><strong>{step.label}</strong><small>{time ? new Date(time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Aguardando"}</small>{index < steps.length - 1 && <i/>}</div>;
        })}</div>
        <div className={`tracking-message-pro status-${current}`}><b>{statusInfo.icon}</b><div><strong>{statusInfo.title}</strong><p>{statusInfo.text}</p></div></div>
      </main>

      <section className="tracking-order-card-pro"><h2>Seu pedido</h2>
        <div className="tracking-products-pro">{order.items.map((item, index) => <article key={`${item.name}-${index}`} className="tracking-product-pro">
          <div className="tracking-product-image-pro">{item.image ? <Image src={item.image} alt={item.name} fill sizes="120px" className="object-cover" unoptimized={item.image.startsWith("http")}/> : <span>🍿</span>}</div>
          <div><div className="tracking-product-title-pro"><strong>{item.quantity}x {item.name}</strong><em>{order.fulfillment}</em></div>{item.selected_options?.length ? <><h3>Sabores</h3>{item.selected_options.map((option, optionIndex) => <small key={optionIndex}>• {option.option_name || option.optionName || option.name}</small>)}</> : null}{item.notes && <small>Obs.: {item.notes}</small>}</div>
        </article>)}</div>
        <dl><div><dt>Pedido realizado em</dt><dd>{new Date(order.created_at).toLocaleString("pt-BR")}</dd></div><div><dt>Número do pedido</dt><dd>#{order.order_code}</dd></div><div><dt>Tipo de pedido</dt><dd>{order.fulfillment}</dd></div><div><dt>Forma de pagamento</dt><dd>{order.payment_method || "—"}</dd></div></dl>
        <div className="tracking-total-pro"><span>Total do pedido</span><strong>R$ {order.total.toFixed(2).replace(".", ",")}</strong></div>
      </section>

      <footer className="tracking-help-pro"><div><h3>Precisa de ajuda?</h3><p>Fale com a gente no WhatsApp!</p></div><a href={whatsapp} target="_blank" rel="noreferrer">Conversar</a></footer>
      <p className="tracking-security-pro"><ShieldCheck size={19}/> Seus dados estão protegidos e seu pedido está seguro com a gente.</p>
    </>}
  </div></section>;
}

export default function TrackingPage() { return <Suspense fallback={<div className="container-pipoka py-20 text-center">Carregando...</div>}><TrackingContent/></Suspense>; }
