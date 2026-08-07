"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";

const links = [
  ["/", "Início"],
  ["/cardapio", "Cardápio"],
  ["/sobre", "Sobre"],
  ["/contato", "Contato"],
  ["/acompanhar", "Acompanhar pedido"]
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { count } = useCart();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="mobile-main-header sticky top-0 z-50 border-b border-wine-700/10 bg-cream/95 backdrop-blur">
      <div className="mobile-header-inner container-pipoka flex h-20 items-center justify-between">
        <Link href="/" className="mobile-brand flex items-center gap-3">
          <Image src="/logo.jpeg" alt="Logo PIPOKÁ" width={62} height={62} className="mobile-header-logo h-14 w-14 rounded-full object-cover shadow" priority />
          <div>
            <p className="mobile-header-title font-serif text-2xl font-bold tracking-wide text-wine-700">PIPOKÁ</p>
            <p className="mobile-header-subtitle text-[10px] uppercase tracking-[.28em] text-gold-600">Pipoca Gourmet</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map(([href, label]) => <Link key={href} href={href} className="font-medium text-wine-900/80 hover:text-wine-700">{label}</Link>)}
        </nav>

        <div className="mobile-header-actions flex items-center gap-2">
          <Link href="/conta" className="mobile-header-action rounded-full p-3 text-wine-700 hover:bg-wine-50" aria-label="Minha conta"><UserRound size={23}/></Link>
          <Link href="/checkout" className="mobile-header-action relative rounded-full p-3 text-wine-700 hover:bg-wine-50" aria-label="Abrir carrinho">
            <ShoppingBag size={23} />
            {count > 0 && <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold-500 px-1 text-[11px] font-bold text-wine-900">{count}</span>}
          </Link>
          <button onClick={() => setOpen(!open)} className="mobile-header-action mobile-header-toggle rounded-full p-3 text-wine-700 md:hidden" aria-label="Abrir menu">{open ? <X /> : <Menu />}</button>
        </div>
      </div>
      {open && (
        <div className="mobile-menu-overlay md:hidden">
          <button type="button" className="mobile-menu-backdrop" aria-label="Fechar menu" onClick={() => setOpen(false)} />
          <div className="mobile-header-menu-layer">
            <nav className="mobile-header-menu mobile-header-menu-panel container-pipoka flex flex-col gap-1 border-t border-wine-700/10 py-0">
              {links.map(([href, label]) => <Link key={href} href={href} onClick={() => setOpen(false)} className="mobile-header-menu-link rounded-xl px-4 py-3 font-medium hover:bg-white">{label}</Link>)}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
