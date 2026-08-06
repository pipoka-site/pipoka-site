"use client";
import Link from "next/link";
import { useStoreData } from "@/hooks/useStoreData";
import { formatOpeningHours } from "@/lib/schedule";

export default function Footer() {
  const { settings } = useStoreData();
  return (
    <footer className="mt-20 bg-wine-900 text-white">
      <div className="container-pipoka grid gap-10 py-14 md:grid-cols-3">
        <div><p className="font-serif text-3xl font-bold">PIPOKÁ</p><p className="mt-3 max-w-sm text-white/70">{settings.footer_description}</p></div>
        <div><p className="font-semibold text-gold-400">Navegação</p><div className="mt-4 grid gap-2 text-white/75"><Link href="/cardapio">Cardápio</Link><Link href="/sobre">Sobre nós</Link><Link href="/contato">Contato</Link></div></div>
        <div><p className="font-semibold text-gold-400">Atendimento</p><div className="mt-4 grid gap-1 text-sm text-white/75">{formatOpeningHours(settings.opening_hours).map((line)=><p key={line}>{line}</p>)}</div><p className="mt-3 text-white/75">Pedidos pelo WhatsApp</p></div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-sm text-white/55">© 2026 PIPOKÁ — Feito com amor para você.</div>
    </footer>
  );
}
