import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PIPOKÁ | Pipoca Gourmet",
    short_name: "PIPOKÁ",
    description: "Pipocas gourmet feitas com amor. Escolha seus sabores e finalize o pedido pelo WhatsApp.",
    start_url: "/",
    display: "standalone",
    background_color: "#2b030b",
    theme_color: "#6d0d1c",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/logo.jpeg",
        sizes: "512x512",
        type: "image/jpeg",
        purpose: "any",
      },
    ],
  };
}
