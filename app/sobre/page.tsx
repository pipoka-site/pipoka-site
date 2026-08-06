import Image from "next/image";
import { Heart, Leaf, Star } from "lucide-react";

export default function SobrePage() {
  return <section className="container-pipoka py-16">
    <div className="grid items-center gap-12 md:grid-cols-2"><Image src="/capa.jpeg" alt="Identidade visual PIPOKÁ" width={900} height={600} className="rounded-[2rem] shadow-soft"/><div><p className="font-semibold uppercase tracking-[.2em] text-gold-600">Nossa história</p><h1 className="mt-3 font-serif text-5xl font-bold text-wine-900">Sabor que nasce do cuidado.</h1><p className="mt-6 leading-8 text-wine-900/70">A PIPOKÁ nasceu para transformar uma paixão simples em uma experiência especial. Cada sabor é pensado para unir crocância, beleza e aquele toque artesanal que faz toda diferença.</p><p className="mt-4 leading-8 text-wine-900/70">Nossa missão é levar alegria em forma de pipoca — seja em um presente, em uma comemoração ou em um momento só seu.</p></div></div>
    <div className="mt-16 grid gap-6 md:grid-cols-3">{[[Heart,"Feito com amor"],[Leaf,"Ingredientes selecionados"],[Star,"Experiência premium"]].map(([Icon,title])=>{const C=Icon as typeof Heart; return <div key={String(title)} className="rounded-3xl bg-white p-7 text-center shadow-soft"><C className="mx-auto text-gold-600"/><h2 className="mt-4 font-serif text-2xl font-bold text-wine-900">{String(title)}</h2></div>})}</div>
  </section>
}
