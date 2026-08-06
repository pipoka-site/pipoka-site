"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useStoreData } from "@/hooks/useStoreData";

export default function IntroSplash() {
  const { settings } = useStoreData();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!settings.show_intro || sessionStorage.getItem("pipoka-intro")) return;
    setVisible(true);
    const timer = window.setTimeout(() => { setVisible(false); sessionStorage.setItem("pipoka-intro", "1"); }, 1350);
    return () => window.clearTimeout(timer);
  }, [settings.show_intro]);
  if (!visible) return null;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-rose-50 text-center animate-fade-out"><div><Image src="/logo.jpeg" alt="PIPOKÁ" width={150} height={150} className="mx-auto rounded-full shadow-2xl ring-8 ring-gold-400/20 animate-soft-pop"/><p className="mt-5 font-serif text-3xl font-bold text-wine-900">PIPOKÁ</p><p className="mt-1 text-sm uppercase tracking-[.3em] text-gold-700">Pipoca Gourmet</p><span className="mt-5 block text-2xl text-wine-700 animate-heart">♥</span></div></div>;
}
