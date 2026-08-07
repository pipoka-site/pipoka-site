"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Clock3, Flame, Gift, Search, Sparkles, Star, Truck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { useStoreData } from "@/hooks/useStoreData";
import { isStoreCurrentlyOpen } from "@/lib/schedule";
import { getPublicApprovedCustomerReviews, type PublicApprovedReview } from "@/lib/supabase";

const fallbackBanners = [
  "/banners/banner-01.jpeg", "/banners/banner-02.jpeg", "/banners/banner-03.jpeg",
  "/banners/banner-04.jpeg", "/banners/banner-05.jpeg", "/banners/banner-06.jpeg"
];

export default function Home() {
  const { products, settings, loading } = useStoreData();
  const [openNow, setOpenNow] = useState(false);
  const banners = useMemo(() => {
    const custom = (settings as any).banner_images as string[] | undefined;
    return custom?.filter(Boolean).slice(0, 10).length ? custom!.filter(Boolean).slice(0, 10) : fallbackBanners;
  }, [settings]);
  const [slide, setSlide] = useState(0);
  const [approvedReviews, setApprovedReviews] = useState<PublicApprovedReview[]>([]);
  const [closedNoticeOpen, setClosedNoticeOpen] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const bannerTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  function nextSlide() {
    setSlide((value) => (value + 1) % banners.length);
  }

  function prevSlide() {
    setSlide((value) => (value - 1 + banners.length) % banners.length);
  }

  useEffect(() => {
    const syncStoreStatus = () => setOpenNow(isStoreCurrentlyOpen(settings));
    syncStoreStatus();
    const timer = window.setInterval(syncStoreStatus, 60000);
    return () => window.clearInterval(timer);
  }, [settings]);

  useEffect(() => {
    const timer = window.setInterval(nextSlide, 5000);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  function onBannerTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (!event.touches.length) return;
    bannerTouchStartRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }

  function onBannerTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (!bannerTouchStartRef.current || !event.changedTouches.length) return;
    const start = bannerTouchStartRef.current;
    const end = event.changedTouches[0];
    const deltaX = end.clientX - start.x;
    const deltaY = end.clientY - start.y;
    bannerTouchStartRef.current = null;
    if (Math.abs(deltaX) < 45 || Math.abs(deltaY) > 40) return;
    if (deltaX < 0) nextSlide(); else prevSlide();
  }

  useEffect(() => {
    if (!loading && !openNow && settings.closed_banner_enabled) {
      setClosedNoticeOpen(true);
    } else if (openNow) {
      setClosedNoticeOpen(false);
    }
  }, [loading, openNow, settings.closed_banner_enabled]);

  useEffect(() => {
    let mounted = true;
    setLoadingReviews(true);
    getPublicApprovedCustomerReviews(0)
      .then((list) => {
        if (mounted) setApprovedReviews(list);
      })
      .catch((error) => {
        console.error("[Home Reviews] Falha ao carregar avaliações aprovadas:", error);
        if (mounted) setApprovedReviews([]);
      })
      .finally(() => {
        if (mounted) setLoadingReviews(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const approvedCount = approvedReviews.length;
  const ratingTotal = approvedReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
  const ratingAverage = approvedCount ? ratingTotal / approvedCount : 0;
  const approvedCountLabel = `${approvedCount} ${approvedCount === 1 ? "avaliação" : "avaliações"}`;
  const distribution = approvedReviews.reduce((map, review) => {
    const rating = Math.max(1, Math.min(5, Math.trunc(Number(review.rating) || 0)));
    map[rating] += 1;
    return map;
  }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>);

  const featuredReviews = [...approvedReviews]
    .filter((review) => review.featured === true)
    .sort((a, b) => {
      const orderA = Number.isFinite(Number(a.display_order)) ? Number(a.display_order) : 999;
      const orderB = Number.isFinite(Number(b.display_order)) ? Number(b.display_order) : 999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, 4);

  const visibleReviews = featuredReviews.length > 0
    ? featuredReviews
    : approvedReviews.slice(0, 4);

  function reviewDisplayName(review: PublicApprovedReview) {
    const publicName = review.public_name?.trim();
    if (publicName) return publicName;
    return "Cliente";
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
      <div className="mobile-hero-photo" onTouchStart={onBannerTouchStart} onTouchEnd={onBannerTouchEnd}>
        <Image src={banners[slide]} alt={`Banner PIPOKÁ ${slide + 1}`} fill priority className="object-cover"/>
        <div className="mobile-hero-overlay"/>
        <div className="mobile-hero-copy">
          <span><Sparkles size={14}/> LANÇAMENTO</span>
          <h1>Explosão<br/><em>de sabor!</em></h1>
          <p>Pipocas artesanais com fotos reais da PIPOKÁ.</p>
          <Link href="/cardapio">Peça agora</Link>
        </div>
        <button aria-label="Banner anterior" className="hero-arrow left" onClick={prevSlide}><ChevronLeft/></button>
        <button aria-label="Próximo banner" className="hero-arrow right" onClick={nextSlide}><ChevronRight/></button>
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
      <div className="mobile-section-title"><div><Star size={20} fill="currentColor"/><h2>Avaliações</h2></div><Link href="/conta" className="inline-flex items-center justify-center rounded-full border border-wine-700 px-3 py-1.5 text-xs font-semibold text-wine-700">Avaliar</Link></div>
      <div className="review-summary">
        <strong>{ratingAverage.toFixed(1)}</strong>
        <div>
          <div>{"★".repeat(Math.max(1, Math.min(5, Math.round(ratingAverage) || 0)))}</div>
          <span>{approvedCountLabel} aprovadas</span>
        </div>
      </div>
      <div className="review-distribution" aria-label="Distribuição das avaliações">
        {[5, 4, 3, 2, 1].map((rating) => <p key={rating}><span>{rating} estrelas</span><b>{distribution[rating]}</b></p>)}
      </div>
      <div className="review-cards">{loadingReviews ? <p className="review-empty">Carregando avaliações...</p> : approvedReviews.length === 0 ? <p className="review-empty">Ainda não há avaliações aprovadas.</p> : visibleReviews.map((review) => <article className="review-approved-card" key={review.id}><div className="review-approved-head"><strong>{reviewDisplayName(review)}</strong><span>{new Date(review.created_at).toLocaleDateString("pt-BR")}</span></div><div className="review-approved-stars">{Array.from({ length: Math.max(1, Math.min(5, Math.trunc(Number(review.rating) || 0)) ) }).map((_, index) => <Star key={index} size={15} fill="currentColor"/>)}</div><p className="review-approved-comment">{review.comment || "Sem comentário."}</p>{review.admin_reply?.trim() && <div className="review-approved-reply"><small>Resposta da PIPOKÁ</small><p>{review.admin_reply.trim()}</p></div>}</article>)}</div>
    </section>

    {closedNoticeOpen && <div className="closed-notice-modal" role="dialog" aria-modal="true" aria-labelledby="closed-notice-title"><div className="closed-notice-dialog"><button className="closed-notice-close" onClick={() => setClosedNoticeOpen(false)} aria-label="Fechar aviso"><X/></button><div className="closed-notice-icon">🍿</div><span>LOJA FECHADA</span><h2 id="closed-notice-title">{settings.closed_banner_title || "Voltaremos em breve"}</h2><p>{settings.closed_banner_text || settings.closed_message}</p><div className="closed-notice-actions"><Link href="/contato">Falar com a PIPOKÁ</Link><button onClick={() => setClosedNoticeOpen(false)}>Continuar no site</button></div></div></div>}

    
  </div>;
}
