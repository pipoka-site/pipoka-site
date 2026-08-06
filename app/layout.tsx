import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyCartBar from "@/components/StickyCartBar";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import IntroSplash from "@/components/IntroSplash";

export const metadata: Metadata = {
  title: "PIPOKÁ | Pipoca Gourmet",
  description: "Pipocas gourmet feitas com amor. Escolha seus sabores e finalize o pedido pelo WhatsApp.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><CartProvider><IntroSplash/><Header /><main>{children}</main><Footer /><FloatingWhatsApp/><StickyCartBar/></CartProvider></body>
    </html>
  );
}
