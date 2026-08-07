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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://pipoka-gourmet.vercel.app"),
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/logo.jpeg", type: "image/jpeg" },
    ],
    apple: [{ url: "/logo.jpeg", type: "image/jpeg" }],
  },
  openGraph: {
    title: "PIPOKÁ | Pipoca Gourmet",
    description: "Pipocas gourmet feitas com amor. Escolha seus sabores e finalize o pedido pelo WhatsApp.",
    url: "/",
    siteName: "PIPOKÁ",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: "/logo.jpeg",
        width: 1200,
        height: 630,
        alt: "PIPOKÁ - Pipoca Gourmet",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PIPOKÁ | Pipoca Gourmet",
    description: "Pipocas gourmet feitas com amor. Escolha seus sabores e finalize o pedido pelo WhatsApp.",
    images: ["/logo.jpeg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><CartProvider><IntroSplash/><Header /><main>{children}</main><Footer /><FloatingWhatsApp/><StickyCartBar/></CartProvider></body>
    </html>
  );
}
