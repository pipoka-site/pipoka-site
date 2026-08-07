"use client";
import { useEffect, useState } from "react";
import { Check, MessageCircle, Star, X } from "lucide-react";
import { getCustomerReviews, updateCustomerReview, type CustomerReviewRecord } from "@/lib/supabase";

export default function CustomerReviewsPanel() {
  const [reviews, setReviews] = useState<CustomerReviewRecord[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [publicNameDrafts, setPublicNameDrafts] = useState<Record<string, string>>({});
  const [featuredDrafts, setFeaturedDrafts] = useState<Record<string, boolean>>({});
  const [displayOrderDrafts, setDisplayOrderDrafts] = useState<Record<string, string>>({});

  function reviewStatus(review: CustomerReviewRecord) {
    if (review.status === "approved" || review.status === "pending" || review.status === "rejected") {
      return review.status;
    }
    return "pending";
  }

  function profileName(review: CustomerReviewRecord) {
    const fullName = review.customer_profiles?.full_name?.trim();
    if (fullName) return fullName;
    const email = review.customer_profiles?.email?.trim();
    if (!email) return "Cliente";
    return email;
  }

  function displayName(review: CustomerReviewRecord) {
    const publicName = review.public_name?.trim();
    if (publicName) return publicName;
    return profileName(review);
  }

  function draftFeatured(review: CustomerReviewRecord) {
    return featuredDrafts[review.id] ?? Boolean(review.featured);
  }

  function draftDisplayOrder(review: CustomerReviewRecord) {
    return displayOrderDrafts[review.id] ?? (review.display_order ? String(review.display_order) : "");
  }

  function normalizeDisplayOrder(value: string) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 4) return null;
    return parsed;
  }

  function countFeaturedWithDraft(currentId?: string, nextFeaturedForCurrent?: boolean) {
    return reviews.reduce((count, item) => {
      const isCurrent = currentId && item.id === currentId;
      const enabled = isCurrent ? Boolean(nextFeaturedForCurrent) : draftFeatured(item);
      return count + (enabled ? 1 : 0);
    }, 0);
  }

  function firstAvailableOrder(reviewId: string) {
    for (let slot = 1; slot <= 4; slot += 1) {
      const taken = reviews.some((item) => {
        if (item.id === reviewId) return false;
        if (!draftFeatured(item)) return false;
        const order = normalizeDisplayOrder(draftDisplayOrder(item));
        return order === slot;
      });
      if (!taken) return String(slot);
    }
    return "1";
  }

  function resolvedPublicName(review: CustomerReviewRecord, draftValue?: string) {
    const fromDraft = (draftValue ?? "").trim();
    if (fromDraft) return fromDraft;
    const fromSaved = review.public_name?.trim();
    if (fromSaved) return fromSaved;
    const fromProfile = review.customer_profiles?.full_name?.trim();
    if (fromProfile) return fromProfile;
    return null;
  }

  async function load() { try { setReviews(await getCustomerReviews()); } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar avaliações."); } }
  useEffect(() => { void load(); }, []);
  async function save(review: CustomerReviewRecord, changes: Partial<CustomerReviewRecord>) {
    setBusy(review.id); setError("");
    try { await updateCustomerReview(review.id, changes); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Erro ao salvar."); } finally { setBusy(""); }
  }

  async function approve(review: CustomerReviewRecord) {
    await save(review, {
      status: "approved",
      visible: true,
      public_name: resolvedPublicName(review),
    });
  }

  async function reject(review: CustomerReviewRecord) {
    await save(review, {
      status: "rejected",
      visible: false,
      public_name: resolvedPublicName(review),
    });
  }

  async function markPending(review: CustomerReviewRecord) {
    await save(review, {
      status: "pending",
      visible: false,
      public_name: resolvedPublicName(review),
    });
  }

  async function saveAdminText(
    review: CustomerReviewRecord,
    publicNameDraft: string,
    replyDraft: string,
    featuredDraft: boolean,
    displayOrderDraft: string,
  ) {
    const featuredTotal = countFeaturedWithDraft(review.id, featuredDraft);
    if (featuredTotal > 4) {
      setError("No máximo 4 avaliações podem ficar destacadas na Home.");
      return;
    }

    const parsedOrder = normalizeDisplayOrder(displayOrderDraft);
    if (featuredDraft && parsedOrder === null) {
      setError("Defina a ordem de destaque entre 1 e 4.");
      return;
    }

    if (featuredDraft && parsedOrder !== null) {
      const orderInUse = reviews.some((item) => {
        if (item.id === review.id) return false;
        if (!draftFeatured(item)) return false;
        return normalizeDisplayOrder(draftDisplayOrder(item)) === parsedOrder;
      });
      if (orderInUse) {
        setError(`A ordem ${parsedOrder} já está em uso por outra avaliação destacada.`);
        return;
      }
    }

    const currentStatus = reviewStatus(review);
    const currentVisible = currentStatus === "approved";
    await save(review, {
      status: currentStatus,
      visible: currentVisible,
      public_name: resolvedPublicName(review, publicNameDraft),
      admin_reply: replyDraft.trim() || null,
      featured: featuredDraft,
      display_order: featuredDraft ? parsedOrder : null,
    });
  }

  return (
    <section className="admin-simple-module-v5 customer-reviews-admin">
      <div className="admin-section-title-v4">
        <div>
          <h2>Avaliações de pedidos</h2>
          <p>Aprove, rejeite e responda avaliações enviadas por clientes após pedidos concluídos.</p>
        </div>
      </div>

      {error && <p className="admin-error-v4">{error}</p>}

      <div className="grid gap-4">
        {reviews.length === 0 ? (
          <div className="admin-empty-v4">Ainda não existem avaliações de pedidos.</div>
        ) : (
          reviews.map((review) => {
            const status = reviewStatus(review);
            const replyDraft = replyDrafts[review.id] ?? String(review.admin_reply || "");
            const publicNameDraft = publicNameDrafts[review.id] ?? String(review.public_name || "");
            const featuredDraft = draftFeatured(review);
            const displayOrderDraft = draftDisplayOrder(review);
            const disabledHighlight = !featuredDraft && countFeaturedWithDraft(review.id, true) > 4;
            const canSave =
              replyDraft !== String(review.admin_reply || "") ||
              publicNameDraft !== String(review.public_name || "") ||
              featuredDraft !== Boolean(review.featured) ||
              displayOrderDraft !== (review.display_order ? String(review.display_order) : "");

            return (
              <article key={review.id} className="customer-review-card rounded-2xl border border-wine-900/15 bg-white p-5 text-wine-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <strong className="block text-base text-wine-900">{displayName(review)}</strong>
                    <p className="text-xs text-wine-900/65">Perfil: {profileName(review)}</p>
                    <p className="text-sm text-wine-900/65">Pedido #{review.orders?.order_code || "—"} · {new Date(review.created_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex text-gold-500">
                      {Array.from({ length: review.rating }).map((_, i) => <Star key={i} size={17} fill="currentColor" />)}
                    </span>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-wine-700">
                      {status === "approved" ? "Aprovada" : status === "rejected" ? "Rejeitada" : "Pendente"}
                    </p>
                  </div>
                </div>

                <p className="mt-3 rounded-xl bg-cream p-3 text-sm text-wine-900/85">{review.comment || "Sem comentário."}</p>

                <div className="mt-4 grid gap-3">
                  <label className="grid gap-1 text-sm font-semibold text-wine-900">
                    Nome público exibido
                    <input
                      className="input-pipoka w-full text-wine-900"
                      value={publicNameDraft}
                      maxLength={80}
                      placeholder="Usar nome do perfil"
                      onChange={(event) => setPublicNameDrafts((current) => ({ ...current, [review.id]: event.target.value }))}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-wine-900">
                    Resposta da PIPOKÁ
                    <textarea
                      className="input-pipoka w-full text-wine-900"
                      rows={3}
                      value={replyDraft}
                      placeholder="Escreva uma resposta para o cliente"
                      onChange={(event) => setReplyDrafts((current) => ({ ...current, [review.id]: event.target.value }))}
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-wine-900">
                    <input
                      type="checkbox"
                      checked={featuredDraft}
                      disabled={disabledHighlight}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        if (checked && countFeaturedWithDraft(review.id, true) > 4) {
                          setError("No máximo 4 avaliações podem ficar destacadas na Home.");
                          return;
                        }
                        setFeaturedDrafts((current) => ({ ...current, [review.id]: checked }));
                        if (checked) {
                          setDisplayOrderDrafts((current) => ({
                            ...current,
                            [review.id]: normalizeDisplayOrder(displayOrderDraft) ? displayOrderDraft : firstAvailableOrder(review.id),
                          }));
                        } else {
                          setDisplayOrderDrafts((current) => ({ ...current, [review.id]: "" }));
                        }
                      }}
                    />
                    Destacar na Home
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-wine-900">
                    Ordem do destaque (1 a 4)
                    <input
                      type="number"
                      min={1}
                      max={4}
                      className="input-pipoka w-full text-wine-900"
                      value={displayOrderDraft}
                      disabled={!featuredDraft}
                      onChange={(event) => setDisplayOrderDrafts((current) => ({ ...current, [review.id]: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button disabled={busy === review.id} onClick={() => void approve(review)} className="admin-secondary-button inline-flex items-center gap-1"><Check size={16} /> Aprovar</button>
                  <button disabled={busy === review.id} onClick={() => void reject(review)} className="admin-secondary-button inline-flex items-center gap-1"><X size={16} /> Rejeitar</button>
                  <button disabled={busy === review.id} onClick={() => void markPending(review)} className="admin-secondary-button inline-flex items-center gap-1"><X size={16} /> Marcar pendente</button>
                  <button disabled={busy === review.id || !canSave} onClick={() => void saveAdminText(review, publicNameDraft, replyDraft, featuredDraft, displayOrderDraft)} className="admin-secondary-button inline-flex items-center gap-1"><MessageCircle size={15} /> Salvar</button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
