"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Clock3, Expand, Heart, LockKeyhole, Minus, Plus, ShoppingCart, Star, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Product, ProductOptionGroup, SelectedOption } from "@/lib/products";
import { formatPrice, getProductStartingPrice, isOptionAvailable, isProductPurchasable } from "@/lib/products";
import { useCart } from "./CartProvider";
import { getCustomerSession, getCustomerFavorites, toggleCustomerFavorite } from "@/lib/customerAuth";

const optionKey = (groupId: string, optionId: string) => `${groupId}:${optionId}`;

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const gallery = useMemo(() => Array.from(new Set((product.images?.length ? product.images : [product.image]).filter(Boolean))), [product.image, product.images]);
  const groups = (product.option_groups || []).filter((group) => group.options?.some(isOptionAvailable));
  const available = isProductPurchasable(product);
  const [current, setCurrent] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const activeImage = gallery[current] || product.image;
  const imagePosition = product.image_positions?.[activeImage] || { x: 50, y: 50, zoom: 1 };

  useEffect(() => {
    if (!getCustomerSession()) return;
    getCustomerFavorites().then((ids) => setFavorite(ids.includes(product.id))).catch(() => null);
  }, [product.id]);

  useEffect(() => {
    if (!galleryOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setGalleryOpen(false);
        return;
      }

      if (gallery.length < 2) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrent((value) => (value - 1 + gallery.length) % gallery.length);
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setCurrent((value) => (value + 1) % gallery.length);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [gallery.length, galleryOpen]);

  async function toggleFavorite() {
    if (!getCustomerSession()) { window.location.href = "/conta"; return; }
    if (favoriteBusy) return;
    setFavoriteBusy(true);
    const next = !favorite;
    try { await toggleCustomerFavorite(product.id, next); setFavorite(next); } finally { setFavoriteBusy(false); }
  }

  useEffect(() => {
    if (gallery.length < 2 || carouselPaused || galleryOpen || configureOpen) return;
    const timer = window.setInterval(() => setCurrent((value) => (value + 1) % gallery.length), 4500);
    return () => window.clearInterval(timer);
  }, [gallery.length, carouselPaused, galleryOpen, configureOpen]);
  const displayPrice = Number(product.price || 0);

  const unitPrice = Number(product.price || 0) + Object.entries(selected).reduce((sum, [key, amount]) => {
    const [groupId, optionId] = key.split(":");
    const option = groups.find((group) => group.id === groupId)?.options.find((item) => item.id === optionId);
    return sum + Number(option?.price || 0) * Number(amount);
  }, 0);

  const countFor = (values: Record<string, number>, group: ProductOptionGroup) => group.options.reduce((sum, option) => sum + (values[optionKey(group.id, option.id)] || 0), 0);

  function changeOption(group: ProductOptionGroup, optionId: string, delta: number) {
    setError("");
    setSelected((currentSelected) => {
      const next = { ...currentSelected };
      const key = optionKey(group.id, optionId);
      const currentAmount = next[key] || 0;
      const total = countFor(currentSelected, group);
      if (group.max === 1 && delta > 0) {
        group.options.forEach((option) => delete next[optionKey(group.id, option.id)]);
        next[key] = 1;
        return next;
      }
      if (delta > 0 && total >= group.max) return currentSelected;
      const amount = Math.max(0, currentAmount + delta);
      if (!amount) delete next[key]; else next[key] = group.allow_repeated ? amount : 1;
      return next;
    });
  }

  function addConfigured() {
    for (const group of groups) {
      const count = countFor(selected, group);
      if (count < group.min) return setError(`Escolha no mínimo ${group.min} opção(ões) em “${group.name}”.`);
      if (count > group.max) return setError(`Escolha no máximo ${group.max} opção(ões) em “${group.name}”.`);
    }
    const selectedOptions: SelectedOption[] = [];
    groups.forEach((group) => group.options.forEach((option) => {
      const amount = selected[optionKey(group.id, option.id)] || 0;
      if (amount) selectedOptions.push({ groupId: group.id, groupName: group.name, optionId: option.id, optionName: option.name, price: Number(option.price || 0), quantity: amount });
    }));
    const signature = selectedOptions.map((option) => `${option.groupId}:${option.optionId}:${option.quantity}`).sort().join("|");
    addItem({ ...product, cartId: `${product.id}::${signature}::${notes.trim()}`, unitPrice, selectedOptions, itemNotes: notes.trim() }, quantity);
    setConfigureOpen(false); setSelected({}); setNotes(""); setError(""); setQuantity(1);
    window.setTimeout(() => { window.location.href = "/checkout"; }, 150);
  }

  return <>
    <article className="group flex h-full min-h-[610px] flex-col overflow-hidden rounded-[1.6rem] border border-wine-700/10 bg-white shadow-soft" onMouseEnter={() => setCarouselPaused(true)} onMouseLeave={() => setCarouselPaused(false)} onTouchStart={() => setCarouselPaused(true)}>
      <div className="relative aspect-[4/3] overflow-hidden bg-cream">
        <button type="button" onClick={() => setGalleryOpen(true)} className="absolute inset-0 z-10" aria-label={`Ampliar ${product.name}`}/>
        <Image src={activeImage} alt={product.name} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-700" style={{ objectPosition: `${imagePosition.x}% ${imagePosition.y}%`, transform: `scale(${imagePosition.zoom})`, transformOrigin: `${imagePosition.x}% ${imagePosition.y}%` }} unoptimized={activeImage?.startsWith("http")}/>
        <button type="button" onClick={(event) => { event.stopPropagation(); void toggleFavorite(); }} className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full bg-white text-wine-700 shadow disabled:opacity-60" disabled={favoriteBusy}><Heart size={19} fill={favorite ? "currentColor" : "none"}/></button>
        <span className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-full bg-wine-900/80 px-3 py-1.5 text-xs text-white"><Expand size={14}/> Ampliar</span>
        {!available && <span className="absolute left-3 top-3 z-20 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white">EM FALTA</span>}
        {gallery.length > 1 && <div className="absolute bottom-3 left-3 z-20 flex gap-1.5">{gallery.map((_, index) => <button key={index} type="button" aria-label={`Foto ${index + 1}`} onClick={(event) => { event.stopPropagation(); setCurrent(index); }} className={`h-2 rounded-full transition-all ${index === current ? "w-6 bg-gold-400" : "w-2 bg-white/75"}`}/>)}</div>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-gold-700">{product.category}</p>
        <h3 className="mt-1 font-serif text-2xl font-bold text-wine-900">{product.name}</h3>
        <div className="mt-2 flex items-center gap-2 text-sm"><span className="flex text-gold-500"><Star size={15} fill="currentColor"/><Star size={15} fill="currentColor"/><Star size={15} fill="currentColor"/><Star size={15} fill="currentColor"/><Star size={15} fill="currentColor"/></span><span className="text-wine-900/55">Novo</span></div>
        {product.description ? <p className="mt-3 min-h-[3rem] text-sm leading-6 text-wine-900/65">{product.description}</p> : <div className="min-h-[3rem]"/>}
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-wine-700"><Clock3 size={17}/> Preparo médio: {product.preparation_time || 30} min</p>
        <div className="mt-4 flex min-h-[3.5rem] items-end justify-between"><strong className="text-2xl text-wine-700">{formatPrice(displayPrice)}</strong><span className="flex items-center gap-1 pb-1 text-xs font-semibold text-wine-700"><LockKeyhole size={15}/> Compra segura</span></div>
        <button disabled={!available} onClick={() => setConfigureOpen(true)} className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-full bg-wine-700 px-4 py-3.5 font-bold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"><ShoppingCart size={18}/>{available ? "Adicionar" : "Produto em falta"}</button>
      </div>
    </article>

    {configureOpen && <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/70 p-3" role="dialog" aria-modal="true"><div className="mx-auto my-4 product-config-dialog-v5 w-full max-w-xl overflow-hidden rounded-[2rem] bg-wine-950 text-white shadow-2xl"><div className="relative aspect-[16/8]"><Image src={activeImage} alt={product.name} fill className="object-cover" unoptimized={activeImage?.startsWith("http")}/><button onClick={()=>setConfigureOpen(false)} className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white text-wine-900 shadow"><X/></button></div><div className="p-5"><h2 className="font-serif text-3xl font-bold text-wine-900">{product.name}</h2><p className="mt-2 text-sm text-wine-900/60">Complete as escolhas obrigatórias para adicionar ao carrinho.</p>
      <div className="mt-6 grid gap-4">{groups.map((group) => <section key={group.id} className="rounded-2xl border border-gold-500/35 bg-wine-800 p-4 shadow-sm"><div className="flex justify-between gap-3"><div><h3 className="font-serif text-xl font-bold text-white">{group.name}</h3><p className="text-xs text-gold-200">Mínimo {group.min} · Máximo {group.max}{group.required ? " · obrigatório" : " · opcional"}</p></div><span className="rounded-full bg-gold-400 px-3 py-1 text-xs font-bold text-wine-950">{countFor(selected, group)}/{group.max}</span></div><div className="mt-3 grid gap-2">{group.options.filter((option) => (option.status || (option.active === false ? "hidden" : "active")) !== "hidden").map((option) => { const key=optionKey(group.id, option.id); const amount=selected[key]||0; const optionAvailable=isOptionAvailable(option); return <div key={option.id} className={`flex items-center justify-between rounded-xl border p-3 ${amount ? "border-gold-500 bg-gold-50" : "border-wine-900/10"} ${!optionAvailable ? "opacity-55" : ""}`}><button disabled={!optionAvailable} type="button" onClick={()=>changeOption(group,option.id,amount ? -amount : 1)} className="flex flex-1 items-center gap-3 text-left"><span className={`grid h-5 w-5 place-items-center ${group.max===1?"rounded-full":"rounded-md"} border ${amount?"border-wine-700 bg-wine-700 text-white":"border-wine-900/25"}`}>{amount ? "✓" : ""}</span><span><strong className="block text-wine-900">{option.name}</strong>{!optionAvailable ? <small className="text-red-700">Em falta</small> : option.price!==0 && <small className="text-wine-700">+ {formatPrice(option.price)}</small>}</span></button>{group.allow_repeated && optionAvailable && <div className="flex items-center gap-2"><button onClick={()=>changeOption(group,option.id,-1)} className="grid h-8 w-8 place-items-center rounded-full border"><Minus size={14}/></button><span className="w-5 text-center font-semibold">{amount}</span><button onClick={()=>changeOption(group,option.id,1)} className="grid h-8 w-8 place-items-center rounded-full border"><Plus size={14}/></button></div>}</div>})}</div></section>)}</div>
      <div className="mt-5 flex items-center justify-between rounded-2xl bg-white p-4"><div><strong className="text-wine-900">Quantidade</strong><p className="text-xs text-gold-200">Unidades deste produto</p></div><div className="flex items-center gap-3"><button onClick={()=>setQuantity((q)=>Math.max(1,q-1))} className="grid h-10 w-10 place-items-center rounded-full border"><Minus size={16}/></button><strong>{quantity}</strong><button onClick={()=>setQuantity((q)=>q+1)} className="grid h-10 w-10 place-items-center rounded-full border"><Plus size={16}/></button></div></div>
      {product.notes_enabled !== false && <label className="mt-5 block text-sm font-semibold text-wine-900">Observações <span className="font-normal text-wine-900/50">(opcional)</span><textarea value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Ex.: embalagem para presente..." maxLength={250} className="input-pipoka mt-2 min-h-20 w-full font-normal"/></label>}
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="sticky bottom-0 mt-6 flex items-center justify-between gap-4 rounded-2xl bg-wine-900 p-4 text-white"><div><span className="block text-xs text-white/65">Total</span><strong className="text-2xl">{formatPrice(unitPrice * quantity)}</strong></div><button onClick={addConfigured} className="rounded-full bg-gold-400 px-5 py-3 font-bold text-wine-900">Adicionar ao carrinho</button></div></div></div></div>}

    {galleryOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" role="presentation"><button type="button" aria-label="Fechar galeria" onClick={()=>setGalleryOpen(false)} className="absolute inset-0 cursor-default bg-black/40"/><div className="relative z-10 w-full max-w-5xl outline-none" role="dialog" aria-modal="true" aria-label={`${product.name} - galeria de fotos`}><div className="relative overflow-hidden rounded-[1.75rem] border border-gold-500/45 bg-wine-950 p-3 shadow-2xl sm:p-4"><button ref={closeButtonRef} type="button" onClick={()=>setGalleryOpen(false)} aria-label="Fechar galeria" className="absolute right-3 top-3 z-20 grid h-11 w-11 place-items-center rounded-full bg-wine-700 text-gold-300 shadow-lg transition hover:scale-105 hover:bg-wine-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-wine-950"><X size={20}/></button>{gallery.length > 1 && <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-gold-500/35 bg-wine-900/85 px-3 py-1 text-xs font-semibold text-gold-300 backdrop-blur">{current + 1} / {gallery.length}</div>}<div className="relative flex min-h-[55vh] items-center justify-center overflow-hidden rounded-[1.25rem] border border-gold-500/35 bg-wine-900/95 sm:min-h-[65vh]"><Image src={activeImage} alt={product.name} fill className="object-contain p-2 sm:p-3" unoptimized={activeImage?.startsWith("http")}/>{gallery.length > 1 && <><button type="button" onClick={()=>setCurrent((value)=>(value-1+gallery.length)%gallery.length)} aria-label="Foto anterior" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-wine-700 text-gold-300 shadow-lg transition hover:scale-105 hover:bg-wine-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-wine-950"><ChevronLeft size={20}/></button><button type="button" onClick={()=>setCurrent((value)=>(value+1)%gallery.length)} aria-label="Próxima foto" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-wine-700 text-gold-300 shadow-lg transition hover:scale-105 hover:bg-wine-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-wine-950"><ChevronRight size={20}/></button></>}</div><div className="mt-3 flex items-center justify-between gap-3 px-1 text-sm text-white/75"><p className="truncate font-medium">{product.name}</p>{gallery.length > 1 && <p className="whitespace-nowrap">{current + 1} / {gallery.length}</p>}</div></div></div></div>}
  </>;
}

