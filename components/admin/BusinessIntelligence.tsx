"use client";

import { useMemo, useState } from "react";
import { BarChart3, Download, FileSpreadsheet, Lightbulb, Printer, RefreshCw, Save, Target, TrendingDown, TrendingUp } from "lucide-react";
import type { Order } from "@/lib/orders";
import type { StoreSettings } from "@/lib/store";
import { calculateBusinessIntelligence, type BIDataPoint, type BIPeriod, type BIRankingItem } from "@/lib/businessIntelligence";

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

function SimpleBarChart({ data, currencyValues = false }: { data: BIDataPoint[]; currencyValues?: boolean }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  if (!data.some((item) => item.value > 0)) return <div className="bi-empty-v2">Os dados aparecerão conforme os pedidos forem registrados.</div>;
  return <div className="bi-bar-chart-v2" role="img" aria-label="Gráfico de barras">
    {data.map((item) => <div className="bi-bar-column-v2" key={item.label} title={`${item.label}: ${currencyValues ? currency(item.value) : item.value}`}>
      <span>{currencyValues ? currency(item.value) : item.value}</span>
      <i style={{ height: `${Math.max(4, (item.value / max) * 100)}%` }}/>
      <small>{item.label}</small>
    </div>)}
  </div>;
}

function DonutChart({ data }: { data: BIDataPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!total) return <div className="bi-empty-v2">Sem dados no período.</div>;
  let offset = 0;
  const gradients = data.map((item, index) => {
    const start = (offset / total) * 100;
    offset += item.value;
    const end = (offset / total) * 100;
    const colors = ["#d4af37", "#7b1632", "#3ca370", "#4976bd", "#a65caa", "#d47a37"];
    return `${colors[index % colors.length]} ${start}% ${end}%`;
  }).join(",");
  return <div className="bi-donut-wrap-v2">
    <div className="bi-donut-v2" style={{ background: `conic-gradient(${gradients})` }}><strong>{total}</strong><span>pedidos</span></div>
    <div className="bi-legend-v2">{data.map((item) => <div key={item.label}><i/><span>{item.label}</span><strong>{Math.round((item.value / total) * 100)}%</strong></div>)}</div>
  </div>;
}

function Ranking({ data, revenue = false }: { data: BIRankingItem[]; revenue?: boolean }) {
  if (!data.length) return <div className="bi-empty-v2">Sem dados no período.</div>;
  return <div className="bi-ranking-v2">{data.slice(0, 8).map((item, index) => <div key={`${item.label}-${index}`}>
    <b>{index + 1}º</b><span>{item.label}</span><strong>{revenue ? currency(item.revenue) : `${item.quantity} un.`}</strong>
  </div>)}</div>;
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function BusinessIntelligence({
  orders,
  settings,
  busy,
  onSettingsChange,
  onSave,
  onRefresh,
}: {
  orders: Order[];
  settings: StoreSettings;
  busy: boolean;
  onSettingsChange: (settings: StoreSettings) => void;
  onSave: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [period, setPeriod] = useState<BIPeriod>("30d");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const data = useMemo(() => calculateBusinessIntelligence(orders, period), [orders, period]);
  const goalRevenue = Number(settings.bi_revenue_goal || 0);
  const goalOrders = Number(settings.bi_orders_goal || 0);
  const revenueProgress = goalRevenue > 0 ? Math.min(100, (data.revenue / goalRevenue) * 100) : 0;
  const orderProgress = goalOrders > 0 ? Math.min(100, (data.orderCount / goalOrders) * 100) : 0;

  function exportCsv() {
    const rows = [
      ["Indicador", "Valor"],
      ["Faturamento", data.revenue.toFixed(2)],
      ["Pedidos", String(data.orderCount)],
      ["Ticket médio", data.ticketAverage.toFixed(2)],
      ["Cancelados", String(data.cancelledCount)],
      [],
      ["Produto", "Quantidade", "Faturamento"],
      ...data.topProducts.map((item) => [item.label, String(item.quantity), item.revenue.toFixed(2)]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    downloadBlob(`pipoka-bi-${period}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
  }

  function exportExcel() {
    const productRows = data.topProducts.map((item) => `<tr><td>${item.label}</td><td>${item.quantity}</td><td>${item.revenue.toFixed(2)}</td></tr>`).join("");
    const html = `<html><head><meta charset="UTF-8"></head><body><h1>PIPOKÁ Gourmet - Business Intelligence</h1><table border="1"><tr><th>Faturamento</th><td>${data.revenue.toFixed(2)}</td></tr><tr><th>Pedidos</th><td>${data.orderCount}</td></tr><tr><th>Ticket médio</th><td>${data.ticketAverage.toFixed(2)}</td></tr></table><h2>Produtos</h2><table border="1"><tr><th>Produto</th><th>Quantidade</th><th>Faturamento</th></tr>${productRows}</table></body></html>`;
    downloadBlob(`pipoka-bi-${period}.xls`, html, "application/vnd.ms-excel;charset=utf-8");
  }

  return <section className="bi-page-v2">
    <div className="admin-section-title-v4 bi-title-v2"><div><h1>Inteligência do Negócio</h1><p>Gráficos, metas e recomendações construídos com os pedidos ativos da PIPOKÁ.</p>{lastUpdatedAt && <small>Atualizado às {lastUpdatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small>}</div><div className="bi-export-v2"><button disabled={refreshing} onClick={async()=>{setRefreshing(true);try{await onRefresh();setLastUpdatedAt(new Date());}finally{setRefreshing(false);}}}><RefreshCw className={refreshing?"spin":""}/> {refreshing?"Atualizando...":"Atualizar"}</button><button onClick={exportCsv}><Download/> CSV</button><button onClick={exportExcel}><FileSpreadsheet/> Excel</button><button onClick={() => window.print()}><Printer/> PDF / imprimir</button></div></div>

    <div className="bi-filter-v2">
      {(["today", "7d", "30d", "month", "year"] as BIPeriod[]).map((value) => <button key={value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>{({ today: "Hoje", "7d": "7 dias", "30d": "30 dias", month: "Este mês", year: "Este ano" } as Record<BIPeriod, string>)[value]}</button>)}
    </div>

    <div className="bi-kpis-v2">
      <article><small>Faturamento</small><strong>{currency(data.revenue)}</strong><span className={(data.growthPercent || 0) >= 0 ? "up" : "down"}>{data.growthPercent === null ? "Sem comparação" : <>{(data.growthPercent || 0) >= 0 ? <TrendingUp/> : <TrendingDown/>}{Math.abs(data.growthPercent || 0).toFixed(1).replace(".", ",")}%</>}</span></article>
      <article><small>Pedidos</small><strong>{data.orderCount}</strong><span>{data.cancelledCount} cancelado(s)</span></article>
      <article><small>Ticket médio</small><strong>{currency(data.ticketAverage)}</strong><span>Pedidos válidos</span></article>
      <article><small>Período anterior</small><strong>{currency(data.previousRevenue)}</strong><span>{data.previousOrders.length} pedido(s)</span></article>
    </div>

    {settings.bi_show_insights && <section className="bi-insights-v2"><div className="bi-card-heading-v2"><Lightbulb/><div><h2>Insights automáticos</h2><p>Leitura simples dos principais movimentos da loja.</p></div></div><div className="bi-insight-grid-v2">{data.insights.length ? data.insights.map((insight, index) => <article className={insight.tone} key={`${insight.title}-${index}`}><strong>{insight.title}</strong><p>{insight.text}</p></article>) : <div className="bi-empty-v2">Ainda não há dados suficientes para gerar insights.</div>}</div></section>}

    <div className="bi-grid-v2">
      {settings.bi_show_revenue_chart && <article className="bi-chart-card-v2 wide"><div className="bi-card-heading-v2"><TrendingUp/><div><h2>Faturamento por período</h2><p>Pedidos cancelados e excluídos não entram no valor.</p></div></div><SimpleBarChart data={data.revenueSeries} currencyValues/></article>}
      {settings.bi_show_orders_chart && <article className="bi-chart-card-v2"><div className="bi-card-heading-v2"><BarChart3/><div><h2>Quantidade de pedidos</h2><p>Volume registrado no período selecionado.</p></div></div><SimpleBarChart data={data.orderSeries}/></article>}
      {settings.bi_show_payments_chart && <article className="bi-chart-card-v2"><div className="bi-card-heading-v2"><BarChart3/><div><h2>Formas de pagamento</h2><p>Participação de cada forma utilizada.</p></div></div><DonutChart data={data.payments}/></article>}
      {settings.bi_show_fulfillment_chart && <article className="bi-chart-card-v2"><div className="bi-card-heading-v2"><BarChart3/><div><h2>Entrega × retirada</h2><p>Como os clientes preferem receber.</p></div></div><DonutChart data={data.fulfillment}/></article>}
      {settings.bi_show_peak_chart && <article className="bi-chart-card-v2 wide"><div className="bi-card-heading-v2"><BarChart3/><div><h2>Horários de maior movimento</h2><p>Distribuição dos pedidos ao longo do dia.</p></div></div><SimpleBarChart data={data.hourly}/></article>}
      {settings.bi_show_weekdays_chart && <article className="bi-chart-card-v2 wide"><div className="bi-card-heading-v2"><BarChart3/><div><h2>Dias mais fortes</h2><p>Comparativo por dia da semana.</p></div></div><SimpleBarChart data={data.weekdays}/></article>}
    </div>

    <div className="bi-ranking-grid-v2">
      {settings.bi_show_products_ranking && <article><h2>Produtos mais vendidos</h2><Ranking data={data.topProducts}/></article>}
      {settings.bi_show_flavors_ranking && <article><h2>Sabores mais escolhidos</h2><Ranking data={data.topFlavors}/></article>}
      {settings.bi_show_customers_ranking && <article><h2>Clientes que mais compraram</h2><Ranking data={data.topCustomers} revenue/></article>}
    </div>

    <section className="bi-goals-v2"><div className="bi-card-heading-v2"><Target/><div><h2>Metas do período</h2><p>Configure os objetivos diretamente pelo painel.</p></div></div><div className="bi-goal-grid-v2"><article><div><span>Meta de faturamento</span><strong>{currency(data.revenue)} / {currency(goalRevenue)}</strong></div><div className="bi-progress-v2"><i style={{ width: `${revenueProgress}%` }}/></div><small>{revenueProgress.toFixed(0)}% concluído</small></article><article><div><span>Meta de pedidos</span><strong>{data.orderCount} / {goalOrders}</strong></div><div className="bi-progress-v2"><i style={{ width: `${orderProgress}%` }}/></div><small>{orderProgress.toFixed(0)}% concluído</small></article></div></section>

    <form className="bi-config-v2" onSubmit={async (event) => { event.preventDefault(); await onSave(); }}><div className="bi-card-heading-v2"><Save/><div><h2>Configurar Business Intelligence</h2><p>Escolha o que será exibido e defina suas metas.</p></div></div><div className="bi-config-fields-v2"><label>Meta de faturamento<input className="input-pipoka" type="number" min="0" step="0.01" value={settings.bi_revenue_goal} onChange={(event) => onSettingsChange({ ...settings, bi_revenue_goal: Number(event.target.value || 0) })}/></label><label>Meta de pedidos<input className="input-pipoka" type="number" min="0" step="1" value={settings.bi_orders_goal} onChange={(event) => onSettingsChange({ ...settings, bi_orders_goal: Number(event.target.value || 0) })}/></label></div><div className="bi-check-grid-v2">{[
      ["bi_show_insights", "Insights automáticos"], ["bi_show_revenue_chart", "Gráfico de faturamento"], ["bi_show_orders_chart", "Gráfico de pedidos"], ["bi_show_payments_chart", "Formas de pagamento"], ["bi_show_fulfillment_chart", "Entrega × retirada"], ["bi_show_peak_chart", "Horários de pico"], ["bi_show_weekdays_chart", "Dias mais fortes"], ["bi_show_products_ranking", "Produtos mais vendidos"], ["bi_show_flavors_ranking", "Sabores mais escolhidos"], ["bi_show_customers_ranking", "Clientes que mais compraram"],
    ].map(([key, label]) => <label key={key}><input type="checkbox" checked={Boolean(settings[key as keyof StoreSettings])} onChange={(event) => onSettingsChange({ ...settings, [key]: event.target.checked })}/>{label}</label>)}</div><button className="admin-gold-button" disabled={busy}><Save/> Salvar configurações do BI</button></form>
  </section>;
}
