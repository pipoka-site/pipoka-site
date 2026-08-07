"use client";
import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "./CartProvider";
import { formatPrice } from "@/lib/products";

export default function StickyCartBar() {
  const { count, total } = useCart();
  if (!count) return null;
  return <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gold-400/20 bg-wine-900/95 text-white shadow-[0_-12px_35px_rgba(80,5,15,.25)] backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
    <div className="container-pipoka flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-3"><span className="relative grid h-11 w-11 place-items-center rounded-full bg-white/10"><ShoppingBag size={21}/><b className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold-500 px-1 text-[11px] text-wine-900">{count}</b></span><div><p className="text-xs text-white/65">Ver carrinho</p><strong>{formatPrice(total)}</strong></div></div>
      <Link href="/checkout" className="inline-flex items-center gap-2 rounded-full bg-gold-500 px-5 py-3 font-semibold text-wine-900">Finalizar <ArrowRight size={17}/></Link>
    </div>
  </div>;
}
