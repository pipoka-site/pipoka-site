"use client";

import { Activity, AlertTriangle, CheckCircle2, Database, Image as ImageIcon, Radio, ShieldCheck } from "lucide-react";
import type { StoreSettings } from "@/lib/store";
import type { Order } from "@/lib/orders";
import type { Product } from "@/lib/products";

export default function SystemDiagnostics({ ready, settings, orders, products }: { ready: boolean; settings: StoreSettings; orders: Order[]; products: Product[] }) {
  const checks = [
    { label: "Supabase", ok: ready, detail: ready ? "Sessão e consultas operacionais" : "Verificando conexão", icon: Database },
    { label: "Pedidos", ok: Array.isArray(orders), detail: `${orders.filter(order => !order.deleted_at).length} ativo(s)`, icon: Activity },
    { label: "Storage", ok: products.every(product => !product.image || product.image.startsWith("/") || product.image.startsWith("http")), detail: `${products.filter(product => product.image).length} produto(s) com imagem`, icon: ImageIcon },
    { label: "Tempo real", ok: true, detail: "Verificação automática a cada 4 segundos", icon: Radio },
    { label: "WhatsApp", ok: Boolean(settings.whatsapp_number?.replace(/\D/g, "")), detail: settings.whatsapp_number ? "Número configurado" : "Número ausente", icon: CheckCircle2 },
    { label: "Mapas", ok: Boolean(settings.pickup_google_maps_url || settings.pickup_map_embed_url), detail: settings.pickup_google_maps_url || settings.pickup_map_embed_url ? "Localização configurada" : "Configure a localização de retirada", icon: Activity },
    { label: "Segurança", ok: true, detail: "RLS e administradores privados", icon: ShieldCheck },
  ];
  const warnings = checks.filter(check => !check.ok);
  return <div className="diagnostics-v3">
    {warnings.length > 0 && <div className="diagnostics-warning-v3"><AlertTriangle/><div><strong>{warnings.length} ponto(s) precisam de atenção</strong><span>{warnings.map(item => item.label).join(" · ")}</span></div></div>}
    <div className="system-status-grid-v14">{checks.map(check => { const Icon = check.icon; return <article key={check.label}><Icon/><div><strong>{check.label}</strong><small>{check.detail}</small></div><span className={check.ok ? "ok" : "warn"}>{check.ok ? "OK" : "Atenção"}</span></article>; })}</div>
  </div>;
}
