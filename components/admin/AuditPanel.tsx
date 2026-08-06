"use client";

import { Filter, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import type { AuditLogRecord } from "@/lib/supabase";

export default function AuditPanel({ logs, onRefresh }: { logs: AuditLogRecord[]; onRefresh: () => void }) {
  const [action, setAction] = useState("all");
  const [table, setTable] = useState("all");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => logs.filter(log => {
    const text = `${log.action} ${log.table_name} ${log.record_id || ""} ${log.user_id || ""}`.toLowerCase();
    return (action === "all" || log.action === action) && (table === "all" || log.table_name === table) && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [logs, action, table, query]);
  const tables = Array.from(new Set(logs.map(log => log.table_name))).sort();
  const actions = Array.from(new Set(logs.map(log => log.action))).sort();

  return <section className="admin-simple-module-v5">
    <div className="admin-section-title-v4"><div><h1>Auditoria</h1><p>Histórico filtrável das alterações administrativas.</p></div><button className="admin-secondary-button-v9" onClick={onRefresh}>Atualizar</button></div>
    <div className="audit-filters-v3"><Filter/><input className="input-pipoka" placeholder="Buscar registro, usuário ou ação" value={query} onChange={event => setQuery(event.target.value)}/><select className="input-pipoka" value={action} onChange={event => setAction(event.target.value)}><option value="all">Todas as ações</option>{actions.map(item => <option key={item} value={item}>{item}</option>)}</select><select className="input-pipoka" value={table} onChange={event => setTable(event.target.value)}><option value="all">Todas as áreas</option>{tables.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
    <div className="audit-list-v14">{filtered.map(log => <article key={log.id}><ScrollText/><div><strong>{log.action}</strong><span>{log.table_name}{log.record_id ? ` · ${log.record_id}` : ""}{log.user_id ? ` · usuário ${log.user_id.slice(0, 8)}` : ""}</span></div><time>{new Date(log.created_at).toLocaleString("pt-BR")}</time></article>)}{!filtered.length && <div className="admin-empty-v4">Nenhum registro corresponde aos filtros.</div>}</div>
  </section>;
}
