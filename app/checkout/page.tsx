"use client";

import Link from "next/link";
import { Banknote, Bike, CreditCard, MapPin, MessageSquare, Minus, Plus, ShoppingBag, Store, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { formatPrice } from "@/lib/products";
import { useStoreData } from "@/hooks/useStoreData";
import { isStoreCurrentlyOpen } from "@/lib/schedule";
import {
  createCustomerOrder,
  ensureCustomerAccount,
  getCustomerAddresses,
  getCustomerProfile,
  getCustomerSession,
  getFriendlyAuthErrorMessage,
  linkOrderToCustomer,
  type CustomerAddress,
  type CustomerProfile,
} from "@/lib/customerAuth";

type Fulfillment = "Entrega" | "Retirada";
type SessionStatus = "checking" | "guest" | "authenticated";

function parseMoneyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeNotes(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export default function CheckoutPage() {
  const { items, total, changeQuantity, removeItem, clear } = useCart();
  const { settings } = useStoreData();
  const openNow = isStoreCurrentlyOpen(settings);
  const [error, setError] = useState("");
  const [delivery, setDelivery] = useState<Fulfillment>(settings.delivery_enabled ? "Entrega" : "Retirada");
  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [session, setSession] = useState(() => getCustomerSession());
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(() => (getCustomerSession() ? "checking" : "guest"));
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [loadingAccount, setLoadingAccount] = useState(Boolean(getCustomerSession()));
  const [paymentMethod, setPaymentMethod] = useState("");
  const [changeValue, setChangeValue] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const selectedAddress = addresses.find((address) => address.id === selectedAddressId) || addresses.find((address) => address.is_default) || addresses[0] || null;
  const fee = delivery === "Entrega" && !(couponApplied && settings.coupon_free_delivery) ? Number(settings.delivery_fee || 0) : 0;
  const discount = couponApplied ? Number((total * (settings.coupon_discount_percent / 100)).toFixed(2)) : 0;
  const grandTotal = Math.max(0, Number((total + fee - discount).toFixed(2)));
  const modes = useMemo(() => [
    settings.delivery_enabled && { value: "Entrega" as const, icon: Bike, title: "Receber em casa", description: `Taxa de ${formatPrice(settings.delivery_fee)}` },
    settings.pickup_enabled && { value: "Retirada" as const, icon: Store, title: "Retirar pessoalmente", description: "Retirada grátis" },
  ].filter(Boolean) as { value: Fulfillment; icon: typeof Bike; title: string; description: string }[], [settings.delivery_enabled, settings.pickup_enabled, settings.delivery_fee]);
  const paymentOptions = useMemo(() => {
    const configured = (settings.payment_options || [])
      .filter((option) => option.active && (delivery === "Entrega" ? option.delivery : option.pickup))
      .sort((a, b) => a.sort_order - b.sort_order);
    if (configured.length) return configured;
    return (settings.payment_methods || []).map((name) => ({ id: name.toLowerCase().replace(/\s+/g, "-"), name, active: true, delivery: true, pickup: true, sort_order: 0 }));
  }, [delivery, settings.payment_options, settings.payment_methods]);
  const selectedPaymentOption = paymentOptions.find((option) => option.name === paymentMethod) || paymentOptions[0] || null;
  const isCashPayment = selectedPaymentOption?.id === "dinheiro" || /dinheiro/i.test(selectedPaymentOption?.name || "");
  const profileComplete = Boolean(customerProfile?.full_name?.trim() && customerProfile?.phone?.trim());
  const canSubmit = !submitting && openNow && items.length > 0 && modes.length > 0 && profileComplete && (!loadingAccount && sessionStatus === "authenticated") && Boolean(paymentMethod) && (!isCashPayment || !Number.isNaN(parseMoneyInput(changeValue)) && parseMoneyInput(changeValue) >= grandTotal) && (delivery !== "Entrega" || Boolean(selectedAddress));

  useEffect(() => {
    if (sessionStorage.getItem("pipoka-checkout-submitted") === "1") {
      setSubmitted(true);
    }

    const current = getCustomerSession();
    setSession(current);
    if (!current) {
      setSessionStatus("guest");
      setLoadingAccount(false);
      setCustomerProfile(null);
      setAddresses([]);
      setSelectedAddressId("");
      setPaymentMethod("");
      setChangeValue("");
      return;
    }
    setSessionStatus("checking");
    setLoadingAccount(true);
    ensureCustomerAccount().then((ensuredProfile) => Promise.all([getCustomerProfile(), getCustomerAddresses(), Promise.resolve(ensuredProfile)])).then(([loadedProfile, nextAddresses, ensuredProfile]) => {
      const profile = loadedProfile || ensuredProfile;
      setCustomerProfile(profile);
      setAddresses(nextAddresses);
      setSessionStatus("authenticated");
      const preferred = nextAddresses.find((address) => address.is_default) || nextAddresses[0];
      setSelectedAddressId(preferred?.id || "");
      if (!profile?.full_name?.trim() || !profile?.phone?.trim()) {
        setError("Complete seu nome e celular em Minha conta para finalizar o pedido.");
      } else {
        setError("");
      }
    }).catch((err) => {
      setSessionStatus("guest");
      setError(err instanceof Error ? err.message : "Não foi possível carregar sua conta.");
    }).finally(() => setLoadingAccount(false));
  }, []);

  useEffect(() => {
    if (delivery === "Entrega" && !settings.delivery_enabled && settings.pickup_enabled) setDelivery("Retirada");
    if (delivery === "Retirada" && !settings.pickup_enabled && settings.delivery_enabled) setDelivery("Entrega");
  }, [delivery, settings.delivery_enabled, settings.pickup_enabled]);

  useEffect(() => {
    if (!paymentOptions.length) {
      setPaymentMethod("");
      return;
    }

    if (!paymentOptions.some((option) => option.name === paymentMethod)) {
      setPaymentMethod(paymentOptions[0].name);
      setChangeValue("");
    }
  }, [paymentMethod, paymentOptions]);

  useEffect(() => {
    if (!isCashPayment) setChangeValue("");
  }, [isCashPayment]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || submitted) return;
    setError("");

    if (!session || sessionStatus !== "authenticated") return setError("Entre na sua conta para finalizar o pedido.");
    if (!customerProfile?.full_name?.trim() || !customerProfile.phone?.trim()) return setError("Complete seu nome e celular em Minha conta antes de finalizar o pedido.");
    if (!openNow) return setError(settings.closed_message || "Estamos fechados no momento.");
    if (!items.length) return setError("Adicione pelo menos um produto ao carrinho.");
    if (delivery === "Entrega" && !settings.delivery_enabled) return setError("A entrega está indisponível no momento.");
    if (delivery === "Retirada" && !settings.pickup_enabled) return setError("A retirada está indisponível no momento.");
    if (delivery === "Entrega" && !selectedAddress) return setError("Selecione ou cadastre um endereço para receber o pedido.");
    if (!paymentMethod) return setError("Selecione uma forma de pagamento.");

    const selectedPayment = paymentOptions.find((option) => option.name === paymentMethod);
    if (!selectedPayment) return setError("Selecione uma forma de pagamento disponível.");

    if (isCashPayment) {
      const parsed = parseMoneyInput(changeValue);
      if (Number.isNaN(parsed)) return setError("Informe o valor do troco para pagamento em dinheiro.");
      if (parsed < grandTotal) return setError(`O troco precisa ser igual ou maior que ${formatPrice(grandTotal)}.`);
    }

    const notesValue = normalizeNotes(notes);
    if (notesValue.length > 300) return setError("A observação pode ter no máximo 300 caracteres.");

    setSubmitting(true);

    const data = new FormData(event.currentTarget);
    const whatsappNumber = settings.whatsapp_number || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5500000000000";
    const now = new Date();
    let orderCode = now.getTime().toString().slice(-6);
    let trackingToken = crypto.randomUUID().replace(/-/g, "");
    let trackingUrl = `${window.location.origin}/acompanhar?pedido=${encodeURIComponent(orderCode)}&codigo=${encodeURIComponent(trackingToken)}`;
    const orderDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(now);
    const orderTime = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(now);
    const preparationTime = Math.max(...items.map((item) => Number(item.preparation_time || 30)));
    const itemLines = items.flatMap((item, index) => [
      `${index + 1}. *${item.name}*`,
      `   Quantidade: ${item.quantity}`,
      `   Valor unitário: ${formatPrice(item.unitPrice)}`,
      ...item.selectedOptions.map((option) => `   ${option.groupName}: ${option.optionName}${option.quantity > 1 ? ` x${option.quantity}` : ""}${option.price ? ` (+${formatPrice(option.price * option.quantity)})` : ""}`),
      item.itemNotes ? `   Observação do item: ${item.itemNotes}` : "",
      `   Total do item: ${formatPrice(item.unitPrice * item.quantity)}`,
      "",
    ]);
    const destinationLines = delivery === "Entrega" && selectedAddress ? [
      "🚚 *DELIVERY*", "", "📍 *ENDEREÇO*",
      `${selectedAddress.label}: ${selectedAddress.street}, nº ${selectedAddress.number}`,
      `Bairro: ${selectedAddress.neighborhood} — ${selectedAddress.city}`,
      selectedAddress.complement ? `Complemento: ${selectedAddress.complement}` : "",
      selectedAddress.reference ? `Referência: ${selectedAddress.reference}` : "",
    ] : [
      "🏪 *RETIRADA NO LOCAL*",
      settings.pickup_address ? `Local: ${settings.pickup_address}` : "",
      settings.pickup_instructions ? `Orientações: ${settings.pickup_instructions}` : "",
    ];
    const payment = String(data.get("payment") || paymentMethod);
    const change = isCashPayment ? String(changeValue.trim()) : "";
    let message = [
      "🍿 *PIPOKÁ • NOVO PEDIDO*", "━━━━━━━━━━━━━━━━━━", `🆔 *Pedido #${orderCode}*`, `📅 ${orderDate}  •  🕒 ${orderTime}`, "🟡 Status: Pedido recebido", "",
      "👤 *CLIENTE*", `Nome: ${customerProfile.full_name}`, `Telefone: ${customerProfile.phone}`, "",
      "🛒 *ITENS DO PEDIDO*", "", ...itemLines, "━━━━━━━━━━━━━━━━━━", "📦 *RECEBIMENTO*", ...destinationLines, "",
      `⏱️ Preparo estimado: *${preparationTime} minutos*`, "", "💳 *PAGAMENTO*", `Forma: ${payment}`,
      isCashPayment ? `Troco: ${change || "Não precisa"}` : "", "", "📝 *OBSERVAÇÕES*", notesValue || "Nenhuma observação.", "",
      "━━━━━━━━━━━━━━━━━━", "💰 *RESUMO DO PEDIDO*", `Subtotal: ${formatPrice(total)}`,
      couponApplied ? `Desconto (${settings.coupon_code}): -${formatPrice(discount)}` : "",
      delivery === "Entrega" ? `Entrega: ${formatPrice(fee)}` : "Retirada grátis", `⭐ *TOTAL: ${formatPrice(grandTotal)}*`, "━━━━━━━━━━━━━━━━━━",
      "🔎 *ACOMPANHE SEU PEDIDO*", `Pedido #${orderCode}: ${trackingUrl}`, "", "❤️ Pedido enviado pelo site da PIPOKÁ.",
    ].filter(Boolean).join("\n");

    const orderPayload = {
      order_code: orderCode,
      customer_name: customerProfile.full_name.trim(),
      customer_phone: customerProfile.phone.trim(),
      fulfillment: delivery,
      address: delivery === "Entrega" && selectedAddress ? `${selectedAddress.street}, nº ${selectedAddress.number}` : null,
      neighborhood: delivery === "Entrega" ? selectedAddress?.neighborhood || null : null,
      complement: delivery === "Entrega" ? selectedAddress?.complement || null : null,
      payment_method: payment,
      change_for: change || null,
      notes: notesValue || null,
      items: items.map((item) => ({ product_id: item.id, name: item.name, quantity: item.quantity, unit_price: item.unitPrice, image: item.image || item.images?.[0] || "", selected_options: item.selectedOptions, notes: item.itemNotes || null })),
      subtotal: Number(total.toFixed(2)), delivery_fee: Number(fee.toFixed(2)), discount: Number(discount.toFixed(2)), total: Number(grandTotal.toFixed(2)), status: "new", tracking_token: trackingToken,
      coupon_code: couponApplied ? settings.coupon_code : "",
    };

    try {
      const draftOrderCode = orderCode;
      const draftTrackingUrl = trackingUrl;
      const createdOrder = await createCustomerOrder(orderPayload);
      orderCode = createdOrder.order_code;
      trackingToken = createdOrder.tracking_token;
      trackingUrl = `${window.location.origin}/acompanhar?pedido=${encodeURIComponent(orderCode)}&codigo=${encodeURIComponent(trackingToken)}`;
      message = message.replaceAll(`#${draftOrderCode}`, `#${orderCode}`).replace(draftTrackingUrl, trackingUrl)
        .replace(`Subtotal: ${formatPrice(total)}`, `Subtotal: ${formatPrice(Number(createdOrder.subtotal))}`)
        .replace(`Entrega: ${formatPrice(fee)}`, `Entrega: ${formatPrice(Number(createdOrder.delivery_fee))}`)
        .replace(`⭐ *TOTAL: ${formatPrice(grandTotal)}*`, `⭐ *TOTAL: ${formatPrice(Number(createdOrder.total))}*`);
      await linkOrderToCustomer(orderCode, trackingToken).catch(() => false);
      if (couponApplied) message = message.replace(`Desconto (${settings.coupon_code}): -${formatPrice(discount)}`, `Desconto (${settings.coupon_code}): -${formatPrice(Number(createdOrder.discount))}`);

      const whatsappWindow = window.open("about:blank", "_blank");
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
      if (whatsappWindow) whatsappWindow.location.href = whatsappUrl; else window.location.href = whatsappUrl;
      try { localStorage.setItem("pipoka-last-order", JSON.stringify({ orderCode, trackingToken })); } catch {}
      sessionStorage.setItem("pipoka-checkout-submitted", "1");
      setSubmitted(true);
      clear();
      window.setTimeout(() => { window.location.href = trackingUrl; }, 350);
    } catch (orderError) {
      const friendlyMessage = getFriendlyAuthErrorMessage(orderError, "Não foi possível registrar o pedido no momento. Tente novamente.");
      if (/entre na sua conta|sessão expirada|sessão/i.test(friendlyMessage)) {
        setSession(null);
        setSessionStatus("guest");
        setCustomerProfile(null);
        setAddresses([]);
        setSelectedAddressId("");
        setError("Sua sessão expirou. Entre novamente para concluir o pedido.");
      } else {
        setError(friendlyMessage);
      }
      setSubmitting(false);
      return;
    }
  }

  return (
    <section className="container-pipoka px-4 py-10 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6 md:py-16">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <div className="flex items-center justify-between gap-3"><div><p className="section-kicker">Seu carrinho</p><h1 className="section-title mt-2">Revise o pedido</h1></div><span className="rounded-full bg-white px-3 py-1 text-sm shadow-soft">{items.reduce((sum, item) => sum + item.quantity, 0)} item(ns)</span></div>
          {items.length === 0 ? <div className="mt-6 rounded-3xl bg-white p-8 text-center shadow-soft"><ShoppingBag className="mx-auto text-gold-600" size={42}/><p className="mt-4">Seu carrinho está vazio.</p><Link href="/cardapio" className="btn-primary mt-5">Ver cardápio</Link></div> : <div className="mt-6 grid gap-4">{items.map((item) => <div key={item.cartId} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-soft"><div className="min-w-0"><h3 className="font-semibold text-wine-900">{item.name}</h3><p className="text-sm text-wine-900/60">{formatPrice(item.unitPrice)} cada</p>{item.selectedOptions.length > 0 && <div className="mt-1 text-xs text-wine-900/55">{item.selectedOptions.map((option) => <p key={`${option.groupId}-${option.optionId}`}>{option.groupName}: {option.optionName}{option.quantity > 1 ? ` x${option.quantity}` : ""}</p>)}</div>}{item.itemNotes && <p className="mt-1 text-xs italic text-wine-900/50">Obs.: {item.itemNotes}</p>}</div><div className="flex items-center gap-2"><button type="button" onClick={() => changeQuantity(item.cartId, item.quantity - 1)} className="rounded-full border p-2" aria-label="Diminuir"><Minus size={16}/></button><span className="w-6 text-center font-semibold">{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.cartId, item.quantity + 1)} className="rounded-full border p-2" aria-label="Aumentar"><Plus size={16}/></button><button type="button" onClick={() => removeItem(item.cartId)} className="ml-2 rounded-full p-2 text-red-700" aria-label="Remover"><Trash2 size={18}/></button></div></div>)}</div>}
        </div>

        {sessionStatus === "guest" ? <div className="h-fit rounded-[2rem] bg-white p-6 text-center shadow-soft md:p-8"><h2 className="font-serif text-3xl font-bold text-wine-900">Entre para finalizar</h2><p className="mt-3 text-wine-900/65">Seu carrinho está salvo. Entre ou crie uma conta para usar seus dados e endereços cadastrados.</p><Link href="/conta?next=/checkout" className="btn-primary mt-6 w-full">Entrar ou criar conta</Link></div> : loadingAccount || sessionStatus === "checking" ? <div className="h-fit rounded-[2rem] bg-white p-8 text-center shadow-soft">Carregando seus dados...</div> : <form onSubmit={submit} className="w-full rounded-[2rem] bg-white p-5 shadow-soft sm:p-6 md:p-8">
          <div className="mb-5 rounded-2xl bg-cream p-4"><p className="text-sm text-wine-900/60">Pedido de</p><strong className="text-lg text-wine-900">{customerProfile?.full_name || "Cliente"}</strong><p className="text-sm text-wine-900/60">{customerProfile?.phone || "Complete seu perfil"}</p></div>
          {!profileComplete && <div className="mb-4 rounded-2xl bg-gold-50 p-3 text-sm font-semibold text-wine-800">Complete seu nome e telefone em Minha conta para liberar o pedido.</div>}
          <h2 className="font-serif text-3xl font-bold text-wine-900">Como deseja receber?</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{modes.map(({ value, icon: Icon, title, description }) => <button key={value} type="button" onClick={() => setDelivery(value)} className={`rounded-2xl border-2 p-4 text-left transition ${delivery === value ? "border-gold-500 bg-gold-50 shadow-soft" : "border-wine-900/10 hover:border-gold-400"}`}><Icon className={delivery === value ? "text-wine-700" : "text-gold-600"}/><strong className="mt-3 block text-wine-900">{title}</strong><span className="text-sm text-wine-900/60">{description}</span></button>)}</div>

          {delivery === "Entrega" && <div className="mt-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-wine-900">Entregar em</h3><Link href="/conta?next=/checkout" className="text-sm font-semibold text-wine-700">Gerenciar endereços</Link></div>{addresses.length === 0 ? <div className="mt-3 rounded-2xl border border-dashed p-4 text-sm"><p>Nenhum endereço cadastrado.</p><Link href="/conta?next=/checkout" className="mt-2 inline-block font-semibold text-wine-700">Cadastrar endereço</Link></div> : <div className="mt-3 grid gap-3">{addresses.map((address) => <button key={address.id} type="button" onClick={() => setSelectedAddressId(address.id)} className={`rounded-2xl border-2 p-4 text-left ${selectedAddress?.id === address.id ? "border-gold-500 bg-gold-50" : "border-wine-900/10"}`}><strong className="block">{address.label}{address.is_default ? " • Padrão" : ""}</strong><span className="mt-1 block text-sm text-wine-900/65">{address.street}, {address.number} — {address.neighborhood}, {address.city}</span></button>)}</div>}</div>}

          {delivery === "Retirada" && <div className="mt-4 overflow-hidden rounded-2xl bg-cream text-sm text-wine-900/75"><div className="p-4"><div className="flex gap-3"><MapPin className="mt-0.5 shrink-0 text-gold-600" size={19}/><div>{settings.pickup_address && <strong className="block text-wine-900">{settings.pickup_address}</strong>}<p>{settings.pickup_instructions}</p></div></div></div></div>}

          <div className="mt-6 grid gap-4"><label className="checkout-field-wrap"><CreditCard className="checkout-icon" size={20} aria-hidden="true"/><select name="payment" value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); setChangeValue(""); }} className="checkout-field checkout-select">{paymentOptions.map((option) => <option key={option.name} value={option.name}>{option.name}</option>)}</select></label>{isCashPayment && <label className="checkout-field-wrap"><Banknote className="checkout-icon" size={20} aria-hidden="true"/><input name="change" value={changeValue} onChange={(event) => setChangeValue(event.target.value)} placeholder="Troco para quanto?" className="checkout-field"/></label>}<label className="checkout-field-wrap checkout-field-wrap-textarea"><MessageSquare className="checkout-icon checkout-icon-textarea" size={20} aria-hidden="true"/><textarea name="notes" value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 300))} maxLength={300} placeholder="Observações do pedido" className="checkout-field min-h-28 resize-y"/></label></div>

          {settings.coupon_enabled && <div className="mt-6 rounded-2xl border border-gold-500/25 bg-gold-50/60 p-4"><label className="text-sm font-semibold text-wine-900">Tem um cupom?</label><div className="mt-2 flex flex-col gap-2 sm:flex-row"><input value={couponInput} onChange={(event) => { setCouponInput(event.target.value.toUpperCase()); setCouponApplied(false); }} placeholder="Digite o código" className="input-pipoka flex-1 uppercase"/><button type="button" onClick={() => { const codeMatches = couponInput.trim().toUpperCase() === settings.coupon_code.trim().toUpperCase(); const minimumMet = total >= Number(settings.coupon_minimum_value || 0); const valid = codeMatches && minimumMet; setCouponApplied(valid); setError(valid ? `Cupom aplicado: ${settings.coupon_discount_percent}% de desconto${settings.coupon_free_delivery ? " e entrega grátis" : ""}!` : codeMatches ? `Este cupom exige pedido mínimo de ${formatPrice(Number(settings.coupon_minimum_value || 0))}.` : "Cupom inválido."); }} className="btn-secondary !px-4">Aplicar</button></div>{couponApplied && <p className="mt-2 text-sm font-semibold text-green-700">Desconto aplicado com sucesso.</p>}</div>}
          <div className="mt-6 space-y-2 border-t pt-5 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{formatPrice(total)}</span></div>{couponApplied && <div className="flex justify-between font-semibold text-green-700"><span>Desconto ({settings.coupon_code})</span><span>-{formatPrice(discount)}</span></div>}<div className="flex justify-between"><span>{delivery === "Entrega" ? "Taxa de entrega" : "Retirada grátis"}</span><span>{fee ? formatPrice(fee) : "Grátis"}</span></div><div className="flex items-center justify-between pt-2 text-base"><span className="font-semibold">Total</span><strong className="text-2xl text-wine-700">{formatPrice(grandTotal)}</strong></div></div>
          {!openNow && <p className="mt-3 rounded-xl bg-gold-50 p-3 text-sm text-wine-800">{settings.closed_message}</p>}{error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={!canSubmit || submitted} className="btn-primary mt-6 min-h-12 w-full disabled:cursor-not-allowed disabled:opacity-50" type="submit">{submitting ? "Enviando..." : submitted ? "Pedido em andamento" : "Confirmar e enviar pelo WhatsApp"}</button>
          <p className="mt-3 text-center text-xs text-wine-900/50">Seus dados são carregados da sua conta e não precisam ser digitados novamente.</p>
        </form>}
      </div>
    </section>
  );
}
