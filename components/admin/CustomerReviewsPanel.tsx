"use client";
import { useEffect, useState } from "react";
import { Eye, EyeOff, MessageCircle, Star } from "lucide-react";
import { getCustomerReviews, updateCustomerReview, type CustomerReviewRecord } from "@/lib/supabase";

export default function CustomerReviewsPanel() {
  const [reviews, setReviews] = useState<CustomerReviewRecord[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function load() { try { setReviews(await getCustomerReviews()); } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar avaliações."); } }
  useEffect(() => { void load(); }, []);
  async function save(review: CustomerReviewRecord, changes: Partial<CustomerReviewRecord>) {
    setBusy(review.id); setError("");
    try { await updateCustomerReview(review.id, changes); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Erro ao salvar."); } finally { setBusy(""); }
  }
  return <section className="admin-simple-module-v5"><div className="admin-section-title-v4"><div><h2>Avaliações de pedidos</h2><p>Responda ou oculte avaliações enviadas por clientes após pedidos concluídos.</p></div></div>{error&&<p className="admin-error-v4">{error}</p>}<div className="grid gap-4">{reviews.length===0?<div className="admin-empty-v4">Ainda não existem avaliações de pedidos.</div>:reviews.map(review=><article key={review.id} className="rounded-2xl border border-wine-900/10 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{review.customer_profiles?.full_name || review.customer_profiles?.email || "Cliente"}</strong><p className="text-sm opacity-60">Pedido #{review.orders?.order_code || "—"} · {new Date(review.created_at).toLocaleString("pt-BR")}</p></div><span className="inline-flex text-gold-500">{Array.from({length:review.rating}).map((_,i)=><Star key={i} size={17} fill="currentColor"/>)}</span></div><p className="mt-3">{review.comment || "Sem comentário."}</p><textarea className="input-pipoka mt-4 w-full" rows={2} defaultValue={review.admin_reply || ""} placeholder="Resposta da loja" onBlur={(e)=>{if(e.target.value!==String(review.admin_reply||"")) void save(review,{admin_reply:e.target.value});}}/><div className="mt-3 flex gap-2"><button disabled={busy===review.id} onClick={()=>void save(review,{visible:!review.visible})} className="admin-secondary-button">{review.visible?<><EyeOff size={16}/> Ocultar</>:<><Eye size={16}/> Mostrar</>}</button><span className="inline-flex items-center gap-1 text-sm opacity-60"><MessageCircle size={15}/> Resposta salva ao sair do campo</span></div></article>)}</div></section>;
}
