"use client";
import { MessageCircle } from "lucide-react";
import { useStoreData } from "@/hooks/useStoreData";

export default function FloatingWhatsApp() {
  const { settings } = useStoreData();
  const number = settings.whatsapp_number || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "";
  if (!number) return null;
  return <a href={`https://wa.me/${number}?text=${encodeURIComponent("Olá! Gostaria de saber mais sobre as pipocas da PIPOKÁ 🍿❤️")}`} target="_blank" rel="noreferrer" className="fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-wine-700 text-white shadow-2xl transition hover:-translate-y-1 hover:bg-wine-900 md:bottom-6 md:right-6" aria-label="Falar com a PIPOKÁ pelo WhatsApp"><MessageCircle size={27}/></a>;
}
