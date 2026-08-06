"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock3, Flame, Gift, Search, Sparkles, Star, Truck, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { useStoreData } from "@/hooks/useStoreData";
import { isStoreCurrentlyOpen } from "@/lib/schedule";

const fallbackBanners = [
  "/banners/banner-01.jpeg", "/banners/banner-02.jpeg", "/banners/banner-03.jpeg",
  "/banners/banner-04.jpeg", "/banners/banner-05.jpeg", "/banners/banner-06.jpeg"
];

export default function Home() {
  const { products, settings, loading } = useStoreData();
  const openNow = isStoreCurrentlyOpen(settings);
  const banners = useMemo(() => {
    const custom = (settings as any).banner_images as string[] | undefined;
    return custom?.filter(Boolean).slice(0, 10).length ? custom!.filter(Boolean).slice(0, 10) : fallbackBanners;
  }, [settings]);
  const [slide, setSlide] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSent, setReviewSent] = useState(false);
  const [closedNoticeOpen, setClosedNoticeOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setSlide((value) => (value + 1) % banners.length), 5000);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  useEffect(() => {
    if (!loading && !openNow && settings.closed_banner_enabled) {
      setClosedNoticeOpen(true);
    } else if (openNow) {
      setClosedNoticeOpen(false);
    }
  }, [loading, openNow, settings.closed_banner_enabled]);

  function submitReview(event: FormEvent) {
    event.preventDefault();
    setReviewSent(true);
  }

  return <div className="mobile-storefront">
    <section className="mobile-status-row">
      <span className={openNow ? "status-open" : "status-closed"}><i />{openNow ? "Aberto agora" : "Fechado agora"}</span>
      <span><Truck size={15}/> Entrega: 25–35 min</span>
    </section>

    <section className="mobile-search-wrap">
      <Link href="/cardapio" className="mobile-search"><Search size={20}/><span>Buscar sabores, produtos...</span></Link>
    </section>

    <section className="mobile-hero" aria-label="Banners da PIPOKÁ">
      <div className="mobile-hero-photo">
        <Image src={banners[slide]} alt={`Banner PIPOKÁ ${slide + 1}`} fill priority className="object-cover"/>
        <div className="mobile-hero-overlay"/>
        <div className="mobile-hero-copy">
          <span><Sparkles size={14}/> LANÇAMENTO</span>
          <h1>Explosão<br/><em>de sabor!</em></h1>
          <p>Pipocas artesanais com fotos reais da PIPOKÁ.</p>
          <Link href="/cardapio">Peça agora</Link>
        </div>
        <button aria-label="Banner anterior" className="hero-arrow left" onClick={() => setSlide((slide - 1 + banners.length) % banners.length)}><ChevronLeft/></button>
        <button aria-label="Próximo banner" className="hero-arrow right" onClick={() => setSlide((slide + 1) % banners.length)}><ChevronRight/></button>
      </div>
      <div className="hero-dots">{banners.map((_, index) => <button key={index} onClick={() => setSlide(index)} className={index === slide ? "active" : ""} aria-label={`Abrir banner ${index + 1}`}/>)}</div>
    </section>

    {!openNow && settings.closed_banner_enabled && <section className="closed-store-banner"><div><strong>{settings.closed_banner_title}</strong><p>{settings.closed_banner_text || settings.closed_message}</p></div><Link href="/contato">Falar com a PIPOKÁ</Link></section>}

    <section className="mobile-builder-card">
      <div className="builder-icon">🍿</div>
      <div><strong>Monte sua pipoca</strong><p>Escolha tamanho, sabores e adicionais.</p></div>
      <Link href="/cardapio"><ChevronRight/></Link>
    </section>

    <section className="mobile-section">
      <div className="mobile-section-title"><div><Flame size={20}/><h2>Mais vendidos</h2></div><Link href="/cardapio">Ver todos</Link></div>
      <div className="mobile-product-scroller">{products.slice(0, 5).map((product) => <div className="mobile-product-item" key={product.id}><ProductCard product={product}/></div>)}</div>
    </section>

    {settings.promotion_enabled && <section className="mobile-section">
      <div className="mobile-section-title"><div><Gift size={20}/><h2>{settings.promotion_section_title || "Promoções"}</h2></div><Link href={settings.promotion_link || "/cardapio"}>Ver todas</Link></div>
      <div className="promo-mobile-card"><div><small>{settings.promotion_badge}</small><strong>{settings.promotion_title}</strong><p>{settings.promotion_text}</p><Link href={settings.promotion_link || "/cardapio"}>{settings.promotion_button}</Link></div><div className="promo-image"><Image src={settings.promotion_image || "/banners/banner-03.jpeg"} alt={settings.promotion_title} fill className="object-cover" style={{objectPosition:`${settings.promotion_image_position?.x ?? 50}% ${settings.promotion_image_position?.y ?? 50}%`,transform:`scale(${settings.promotion_image_position?.zoom ?? 1})`,transformOrigin:`${settings.promotion_image_position?.x ?? 50}% ${settings.promotion_image_position?.y ?? 50}%`}} unoptimized={(settings.promotion_image || "").startsWith("http")}/></div></div>
    </section>}

    <section className="trust-mobile-grid">
      <article><span>🌿</span><strong>Ingredientes selecionados</strong></article>
      <article><span>❤️</span><strong>Feita com amor</strong></article>
      <article><span>⏱️</span><strong>Feita na hora</strong></article>
      <article><span>✨</span><strong>Qualidade premium</strong></article>
    </section>

    <section className="mobile-section reviews-mobile">
      <div className="mobile-section-title"><div><Star size={20} fill="currentColor"/><h2>Avaliações</h2></div><button onClick={() => { setReviewOpen(true); setReviewSent(false); }}>Avaliar</button></div>
      <div className="review-summary"><strong>4,9</strong><div><div>★★★★★</div><span>Clientes que provaram e amaram</span></div></div>
      <div className="review-cards"><blockquote>“A pipoca chegou linda, crocante e muito saborosa!”<cite>— Cliente PIPOKÁ</cite></blockquote><blockquote>“Embalagem caprichada e sabores maravilhosos.”<cite>— Cliente PIPOKÁ</cite></blockquote></div>
    </section>

    {closedNoticeOpen && <div className="closed-notice-modal" role="dialog" aria-modal="true" aria-labelledby="closed-notice-title"><div className="closed-notice-dialog"><button className="closed-notice-close" onClick={() => setClosedNoticeOpen(false)} aria-label="Fechar aviso"><X/></button><div className="closed-notice-icon">🍿</div><span>LOJA FECHADA</span><h2 id="closed-notice-title">{settings.closed_banner_title || "Voltaremos em breve"}</h2><p>{settings.closed_banner_text || settings.closed_message}</p><div className="closed-notice-actions"><Link href="/contato">Falar com a PIPOKÁ</Link><button onClick={() => setClosedNoticeOpen(false)}>Continuar no site</button></div></div></div>}

    {reviewOpen && <div className="review-modal"><div className="review-dialog"><button className="review-close" onClick={() => setReviewOpen(false)}><X/></button>{reviewSent ? <div className="review-success"><Star size={46} fill="currentColor"/><h2>Obrigada pela avaliação!</h2><p>Sua mensagem será analisada antes de aparecer no site.</p><button onClick={() => setReviewOpen(false)}>Fechar</button></div> : <form onSubmit={submitReview}><UserRound size={34}/><h2>Deixe sua avaliação</h2><p>Faça um cadastro simples para enviar estrelas e uma mensagem.</p><input required placeholder="Seu nome"/><input required type="email" placeholder="Seu e-mail"/><input required type="password" minLength={6} placeholder="Crie uma senha"/><select required defaultValue=""><option value="" disabled>Escolha as estrelas</option><option value="5">★★★★★ — Excelente</option><option value="4">★★★★☆ — Muito bom</option><option value="3">★★★☆☆ — Bom</option><option value="2">★★☆☆☆ — Regular</option><option value="1">★☆☆☆☆ — Ruim</option></select><textarea required maxLength={300} placeholder="Conte como foi sua experiência..."/><button type="submit">Enviar avaliação</button></form>}</div></div>}
  </div>;
}
