"use client";

import { Clock, Instagram, MapPin, MessageCircle } from "lucide-react";
import { useStoreData } from "@/hooks/useStoreData";

export default function ContatoPage() {
  const { settings } = useStoreData();
  const whatsappNumber = String(settings.whatsapp_number || "").replace(/\D/g, "");
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(settings.whatsapp_message || "Olá! Vim pelo site da PIPOKÁ Gourmet.")}`
    : undefined;
  const instagramUrl = settings.instagram_url || (settings.instagram_handle ? `https://instagram.com/${settings.instagram_handle.replace(/^@/, "")}` : undefined);

  const cards = [
    { icon: MessageCircle, title: "WhatsApp", text: settings.contact_whatsapp_text || settings.whatsapp_number, href: whatsappUrl },
    { icon: Instagram, title: "Instagram", text: settings.instagram_handle, href: instagramUrl },
    { icon: Clock, title: "Horário", text: settings.contact_hours_text },
    { icon: MapPin, title: "Retirada", text: settings.contact_pickup_text || settings.pickup_address, href: settings.pickup_google_maps_url || undefined },
  ];

  return (
    <section className="container-pipoka py-16">
      <div className="text-center">
        <p className="font-semibold uppercase tracking-[.2em] text-gold-600">{settings.contact_subtitle}</p>
        <h1 className="mt-2 font-serif text-5xl font-bold text-wine-900">{settings.contact_title}</h1>
      </div>
      <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-2">
        {cards.map(({ icon: Icon, title, text, href }) => {
          const body = <><Icon className="text-gold-600"/><h2 className="mt-4 font-serif text-2xl font-bold text-wine-900">{title}</h2><p className="mt-2 text-wine-900/65">{text}</p></>;
          return href ? (
            <a key={title} href={href} target="_blank" rel="noreferrer" className="rounded-3xl bg-white p-7 shadow-soft transition hover:-translate-y-1 hover:border-gold-500 hover:shadow-lg border border-transparent cursor-pointer">{body}</a>
          ) : (
            <div key={title} className="rounded-3xl bg-white p-7 shadow-soft">{body}</div>
          );
        })}
      </div>
    </section>
  );
}
