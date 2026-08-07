"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Heart, LogOut, MapPin, Package, RotateCcw, Save, Star, UserRound } from "lucide-react";
import { useCart } from "@/components/CartProvider";
import { getProducts } from "@/lib/supabase";
import type { Product } from "@/lib/products";
import { createClientUuid } from "@/lib/clientUuid";
import {
  customerSignIn,
  customerSignOut,
  customerSignUp,
  deleteCustomerAddress,
  ensureCustomerAccount,
  getCustomerAddresses,
  getCustomerFavorites,
  getCustomerOrders,
  getCustomerProfile,
  getCustomerSession,
  saveCustomerAddress,
  sendPasswordReset,
  submitOrderReview,
  toggleCustomerFavorite,
  updateCustomerProfile,
  type CustomerAddress,
  type CustomerProfile,
} from "@/lib/customerAuth";
import { orderStatusLabel, type Order } from "@/lib/orders";

const field = "w-full rounded-2xl border border-wine-900/15 bg-white px-4 py-3 outline-none transition focus:border-gold-500";
const card = "rounded-[1.75rem] bg-white p-5 shadow-soft";

type Tab = "orders" | "profile" | "addresses" | "favorites";

type AddressDraft = Partial<CustomerAddress> & {
  label?: string;
  postal_code?: string;
  street?: string;
  number?: string;
  complement?: string | null;
  neighborhood?: string;
  city?: string;
  reference?: string | null;
};

function firstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] || "cliente";
}

export default function CustomerAccountPage() {
  const router = useRouter();
  const { addItem } = useCart();
  const [session, setSession] = useState<ReturnType<typeof getCustomerSession>>(null);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [tab, setTab] = useState<Tab>("orders");
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState<Order | null>(null);

  function nextPath() {
    if (typeof window === "undefined") return "";
    const value = new URLSearchParams(window.location.search).get("next") || "";
    return value.startsWith("/") && !value.startsWith("//") ? value : "";
  }

  async function load() {
    if (!getCustomerSession()) return;
    const ensuredProfile = await ensureCustomerAccount().catch(() => null);
    const [loadedProfile, nextAddresses, nextOrders, nextProducts, nextFavorites] = await Promise.all([
      getCustomerProfile(),
      getCustomerAddresses(),
      getCustomerOrders(),
      getProducts(false),
      getCustomerFavorites(),
    ]);
    const nextProfile = loadedProfile || ensuredProfile;
    setProfile(nextProfile);
    setAddresses(nextAddresses);
    setOrders(nextOrders as Order[]);
    setProducts(nextProducts as Product[]);
    setFavorites(nextFavorites);
    if (nextProfile && (!nextProfile.full_name?.trim() || !nextProfile.phone?.trim())) setTab("profile");
  }

  useEffect(() => {
    if (session) load().catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar sua conta."));
  }, [session]);

  useEffect(() => {
    setSession(getCustomerSession());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("identifier") || params.has("password")) {
      router.replace("/conta");
    }
  }, [router]);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const data = new FormData(e.currentTarget);
    try {
      const next = await customerSignIn(String(data.get("identifier") || ""), String(data.get("password") || ""));
      setSession(next);
      const destination = nextPath();
      if (destination) window.setTimeout(() => { window.location.href = destination; }, 250);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally { setBusy(false); }
  }

  async function handleSignup(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(""); setMessage("");
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") || "");
    if (password.length < 8) { setBusy(false); return setError("A senha precisa ter pelo menos 8 caracteres."); }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) { setBusy(false); return setError("Use pelo menos uma letra e um número na senha."); }
    if (password !== String(data.get("confirm") || "")) { setBusy(false); return setError("As senhas não coincidem."); }
    try {
      const result: any = await customerSignUp({
        email: String(data.get("email") || ""), password,
        fullName: String(data.get("name") || ""), phone: String(data.get("phone") || ""),
        postalCode: String(data.get("postal_code") || ""), street: String(data.get("street") || ""),
        number: String(data.get("number") || ""), complement: String(data.get("complement") || ""),
        neighborhood: String(data.get("neighborhood") || ""), city: String(data.get("city") || ""),
        reference: String(data.get("reference") || ""),
      });
      if (result?.access_token) {
        setSession(result);
        await ensureCustomerAccount().catch(() => null);
        const destination = nextPath();
        if (destination) window.setTimeout(() => { window.location.href = destination; }, 250);
      } else {
        setMessage("Cadastro criado. Confirme seu e-mail e depois entre na conta. Seu endereço ficará salvo automaticamente.");
        setMode("login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    } finally { setBusy(false); }
  }

  async function handleForgot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await sendPasswordReset(String(new FormData(e.currentTarget).get("email") || ""));
      setMessage("Se o e-mail estiver cadastrado, enviaremos um link para criar uma nova senha.");
    } catch {
      setMessage("Se o e-mail estiver cadastrado, enviaremos um link para criar uma nova senha.");
    } finally { setBusy(false); }
  }

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    const data = new FormData(e.currentTarget);
    try {
      await updateCustomerProfile({
        full_name: String(data.get("name") || ""),
        phone: String(data.get("phone") || ""),
        marketing_opt_in: data.get("marketing") === "on",
      });
      await load();
      setMessage("Perfil atualizado e alteração registrada.");
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }

  async function saveAddress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const wasEditing = Boolean(editingAddress?.id);
    setBusy(true); setError(""); setMessage("");
    const d = new FormData(form);
    try {
      const draft: AddressDraft = {
        id: editingAddress?.id,
        label: String(d.get("label") || "Casa").trim(),
        postal_code: String(d.get("postal_code") || "").replace(/\D/g, ""),
        street: String(d.get("street") || "").trim(),
        number: String(d.get("number") || "").trim(),
        complement: String(d.get("complement") || "").trim(),
        neighborhood: String(d.get("neighborhood") || "").trim(),
        city: String(d.get("city") || "").trim(),
        reference: String(d.get("reference") || "").trim(),
        is_default: d.get("is_default") === "on" || addresses.length === 0,
      };
      if (!draft.street || !draft.number || !draft.neighborhood || !draft.city) {
        throw new Error("Preencha rua, número, bairro e cidade.");
      }
      await saveCustomerAddress(draft);
      form.reset();
      setEditingAddress(null);
      await load();
      setMessage(wasEditing ? "Endereço atualizado e alteração registrada." : "Endereço salvo com sucesso.");
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar o endereço."); }
    finally { setBusy(false); }
  }

  function reorder(order: Order) {
    let added = 0;
    for (const item of order.items || []) {
      const product = products.find((p) => p.id === item.product_id && p.status !== "hidden");
      if (!product) continue;
      addItem({ ...product, cartId: `${product.id}-${createClientUuid()}`, unitPrice: Number(item.unit_price || product.price), selectedOptions: item.selected_options || [], itemNotes: item.notes || "" }, item.quantity || 1);
      added++;
    }
    if (added) {
      setMessage("Itens disponíveis adicionados ao carrinho. Confira preços e opções antes de finalizar.");
      window.setTimeout(() => { window.location.href = "/checkout"; }, 500);
    } else setError("Nenhum item deste pedido está disponível no momento.");
  }

  const favoriteProducts = useMemo(() => products.filter((p) => favorites.includes(p.id)), [products, favorites]);
  const lastOrder = orders[0] || null;
  const initial = firstName(profile?.full_name).charAt(0).toUpperCase();

  if (!session) return (
    <main className="container-pipoka py-10 md:py-14">
      <div className="mx-auto max-w-xl rounded-[2rem] bg-white p-6 shadow-soft md:p-8">
        <div className="text-center"><UserRound className="mx-auto text-gold-600" size={44}/><h1 className="mt-3 font-serif text-4xl font-bold text-wine-900">Minha conta</h1><p className="mt-2 text-wine-900/60">Entre para finalizar pedidos e acessar seus dados salvos.</p></div>
        {message && <p className="mt-5 rounded-xl bg-green-50 p-3 text-green-800">{message}</p>}
        {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
        {mode === "login" && <form method="post" onSubmit={handleLogin} className="mt-6 grid gap-4"><input className={field} name="identifier" placeholder="E-mail ou celular" required/><input className={field} name="password" type="password" placeholder="Senha" required/><button type="submit" className="btn-primary" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</button><button type="button" onClick={() => setMode("forgot")} className="text-sm font-semibold text-wine-700">Esqueci minha senha</button><button type="button" onClick={() => setMode("signup")} className="rounded-2xl border border-wine-700 px-4 py-3 font-semibold text-wine-700">Criar conta</button></form>}
        {mode === "signup" && <form onSubmit={handleSignup} className="mt-6 grid gap-4"><input className={field} name="name" placeholder="Nome completo" required/><input className={field} name="email" type="email" placeholder="E-mail" required/><input className={field} name="phone" placeholder="Celular com DDD" required/><div className="grid gap-4 sm:grid-cols-2"><input className={field} name="postal_code" placeholder="CEP" required/><input className={field} name="city" placeholder="Cidade" required/></div><input className={field} name="street" placeholder="Rua ou avenida" required/><div className="grid gap-4 sm:grid-cols-2"><input className={field} name="number" placeholder="Número" required/><input className={field} name="complement" placeholder="Complemento"/></div><input className={field} name="neighborhood" placeholder="Bairro" required/><input className={field} name="reference" placeholder="Ponto de referência (opcional)"/><input className={field} name="password" type="password" placeholder="Senha (mínimo 8 caracteres, letra e número)" required/><input className={field} name="confirm" type="password" placeholder="Confirmar senha" required/><label className="flex gap-2 text-sm"><input type="checkbox" required/> Aceito os termos de uso e a política de privacidade.</label><button className="btn-primary" disabled={busy}>Criar conta</button><button type="button" onClick={() => setMode("login")} className="text-sm font-semibold text-wine-700">Já tenho uma conta</button></form>}
        {mode === "forgot" && <form onSubmit={handleForgot} className="mt-6 grid gap-4"><input className={field} name="email" type="email" placeholder="E-mail de cadastro" required/><button className="btn-primary" disabled={busy}>Enviar link de recuperação</button><button type="button" onClick={() => setMode("login")} className="text-sm font-semibold text-wine-700">Voltar ao login</button></form>}
      </div>
    </main>
  );

  return (
    <main className="container-pipoka py-8 md:py-12">
      <section className="rounded-[2rem] bg-white p-5 shadow-soft md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-wine-700 text-2xl font-bold text-white">{initial}</div>
            <div><p className="text-sm font-semibold uppercase tracking-wider text-gold-700">Área do cliente</p><h1 className="font-serif text-4xl font-bold text-wine-900">Olá, {firstName(profile?.full_name)}!</h1><p className="mt-1 text-sm text-wine-900/55">Último acesso: {profile?.last_sign_in_at ? new Date(profile.last_sign_in_at).toLocaleString("pt-BR") : "primeiro acesso"}</p></div>
          </div>
          <button onClick={async () => { await customerSignOut(); setSession(null); }} className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3"><LogOut size={18}/> Sair</button>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-cream p-3 text-center"><strong className="block text-xl text-wine-800">{orders.length}</strong><span className="text-xs text-wine-900/60">Pedidos</span></div>
          <div className="rounded-2xl bg-cream p-3 text-center"><strong className="block text-xl text-wine-800">{favorites.length}</strong><span className="text-xs text-wine-900/60">Favoritos</span></div>
          <div className="rounded-2xl bg-cream p-3 text-center"><strong className="block text-xl text-wine-800">{addresses.length}</strong><span className="text-xs text-wine-900/60">Endereços</span></div>
        </div>
        <p className="mt-4 text-sm text-wine-900/65">{lastOrder ? <>Último pedido: <strong>#{lastOrder.order_code}</strong> em {new Date(lastOrder.created_at).toLocaleDateString("pt-BR")}</> : "Você ainda não realizou seu primeiro pedido."}</p>
      </section>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">{([['orders','Meus pedidos',Package],['profile','Meu perfil',UserRound],['addresses','Endereços',MapPin],['favorites','Favoritos',Heart]] as const).map(([id,label,Icon]) => <button key={id} onClick={() => setTab(id)} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 font-semibold ${tab===id ? 'bg-wine-700 text-white' : 'bg-white text-wine-800 shadow-soft'}`}><Icon size={17}/>{label}</button>)}</div>
      {message && <p className="mt-5 rounded-xl bg-green-50 p-3 text-green-800">{message}</p>}
      {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {profile && (!profile.full_name?.trim() || !profile.phone?.trim()) && <p className="mt-5 rounded-xl bg-gold-50 p-3 text-sm font-semibold text-wine-800">Complete seu nome e celular em Meu perfil para liberar pedidos e manter sua conta vinculada corretamente.</p>}

      {tab === "orders" && <section className="mt-6 grid gap-4">{orders.length === 0 ? <div className={card}><p>Você ainda não possui pedidos vinculados a esta conta.</p></div> : orders.map((order) => <article key={order.id} className={card}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm text-wine-900/55">{new Date(order.created_at).toLocaleString("pt-BR")}</p><h2 className="font-serif text-2xl font-bold text-wine-900">Pedido #{order.order_code}</h2><p className="font-semibold text-wine-700">{order.status === 'completed' ? 'Entregue' : orderStatusLabel[order.status] || order.status}</p></div><strong className="text-xl text-wine-900">R$ {Number(order.total).toFixed(2).replace('.', ',')}</strong></div><div className="mt-4 grid gap-1 text-sm">{(order.items || []).map((item, i) => <p key={i}>{item.quantity}x {item.name}</p>)}</div><div className="mt-5 flex flex-wrap gap-2"><button onClick={() => reorder(order)} className="inline-flex items-center gap-2 rounded-xl bg-wine-700 px-4 py-2 font-semibold text-white"><RotateCcw size={17}/> Pedir novamente</button>{order.tracking_token && order.status !== "completed" && <Link href={`/acompanhar?pedido=${encodeURIComponent(order.order_code)}&codigo=${encodeURIComponent(order.tracking_token)}`} className="rounded-xl border px-4 py-2 font-semibold">Acompanhar</Link>}{order.status === 'completed' && <button onClick={() => setReviewing(order)} className="inline-flex items-center gap-2 rounded-xl border border-gold-500 px-4 py-2 font-semibold"><Star size={17}/> Avaliar</button>}</div></article>)}</section>}

      {tab === "profile" && profile && <form onSubmit={saveProfile} className={`${card} mt-6 grid gap-4`}><h2 className="font-serif text-2xl font-bold">Meu perfil</h2><label>Nome completo<input className={`${field} mt-1`} name="name" defaultValue={profile.full_name} required/></label><label>E-mail<input className={`${field} mt-1 bg-cream`} value={profile.email} readOnly/></label><label>Celular<input className={`${field} mt-1`} name="phone" defaultValue={profile.phone} required/></label><label className="flex gap-2"><input type="checkbox" name="marketing" defaultChecked={profile.marketing_opt_in}/> Quero receber novidades e promoções por e-mail.</label><button className="btn-primary inline-flex items-center justify-center gap-2" disabled={busy}><Save size={18}/> Salvar alterações</button><button type="button" onClick={() => customerSignOut(true).then(() => setSession(null))} className="rounded-xl border px-4 py-3 font-semibold">Sair de todos os dispositivos</button></form>}

      {tab === "addresses" && <section className="mt-6 grid gap-5"><form onSubmit={saveAddress} className={`${card} grid gap-4`}><h2 className="font-serif text-2xl font-bold">{editingAddress ? "Editar endereço" : "Adicionar endereço"}</h2><div className="grid gap-4 sm:grid-cols-2"><input className={field} name="label" placeholder="Nome: Casa, Trabalho..." defaultValue={editingAddress?.label || ""} required/><input className={field} name="postal_code" placeholder="CEP" defaultValue={editingAddress?.postal_code || ""} required/></div><input className={field} name="street" placeholder="Rua ou avenida" defaultValue={editingAddress?.street || ""} required/><div className="grid gap-4 sm:grid-cols-2"><input className={field} name="number" placeholder="Número" defaultValue={editingAddress?.number || ""} required/><input className={field} name="complement" placeholder="Complemento" defaultValue={editingAddress?.complement || ""}/></div><div className="grid gap-4 sm:grid-cols-2"><input className={field} name="neighborhood" placeholder="Bairro" defaultValue={editingAddress?.neighborhood || ""} required/><input className={field} name="city" placeholder="Cidade" defaultValue={editingAddress?.city || ""} required/></div><input className={field} name="reference" placeholder="Ponto de referência" defaultValue={editingAddress?.reference || ""}/><label className="flex gap-2"><input type="checkbox" name="is_default" defaultChecked={editingAddress?.is_default || addresses.length === 0}/> Usar como endereço padrão</label><div className="flex gap-2"><button className="btn-primary flex-1">{editingAddress ? "Salvar alterações" : "Salvar endereço"}</button>{editingAddress && <button type="button" onClick={() => setEditingAddress(null)} className="rounded-xl border px-4">Cancelar</button>}</div></form><div className="grid gap-3">{addresses.map((a) => <article key={a.id} className={card}><div className="flex flex-wrap justify-between gap-3"><div><strong>{a.label}{a.is_default ? ' • Padrão' : ''}</strong><p className="mt-1 text-sm text-wine-900/65">{a.street}, {a.number} — {a.neighborhood}, {a.city}</p></div><div className="flex gap-3"><button onClick={() => { setEditingAddress(a); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="font-semibold text-wine-700">Editar</button><button onClick={async () => { await deleteCustomerAddress(a.id); await load(); }} className="text-red-700">Excluir</button></div></div></article>)}</div></section>}

      {tab === "favorites" && <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{favoriteProducts.length === 0 ? <div className={card}><p>Você ainda não favoritou produtos.</p></div> : favoriteProducts.map((product) => <article key={product.id} className={card}><h2 className="font-serif text-2xl font-bold">{product.name}</h2><p className="mt-2 text-sm text-wine-900/60">{product.description}</p><button onClick={async () => { await toggleCustomerFavorite(product.id, false); await load(); }} className="mt-4 inline-flex items-center gap-2 text-wine-700"><Heart fill="currentColor" size={18}/> Remover dos favoritos</button></article>)}</section>}

      {reviewing && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/55 p-4"><form onSubmit={async (e) => { e.preventDefault(); const d = new FormData(e.currentTarget); await submitOrderReview(reviewing.id, Number(d.get('rating')), String(d.get('comment') || '')); setReviewing(null); setMessage('Obrigado pela sua avaliação!'); }} className="w-full max-w-md rounded-[2rem] bg-white p-6"><h2 className="font-serif text-3xl font-bold">Como foi sua experiência?</h2><select name="rating" className={`${field} mt-5`} defaultValue="5"><option value="5">★★★★★ Excelente</option><option value="4">★★★★ Muito boa</option><option value="3">★★★ Boa</option><option value="2">★★ Pode melhorar</option><option value="1">★ Ruim</option></select><textarea name="comment" className={`${field} mt-4 min-h-28`} placeholder="Conte como foi seu pedido (opcional)"/><div className="mt-5 flex gap-2"><button className="btn-primary flex-1">Enviar avaliação</button><button type="button" onClick={() => setReviewing(null)} className="rounded-xl border px-4">Agora não</button></div></form></div>}
    </main>
  );
}
