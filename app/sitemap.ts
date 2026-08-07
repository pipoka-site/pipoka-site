import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://pipoka-gourmet.vercel.app";
  const now = new Date();

  return [
    "",
    "/cardapio",
    "/contato",
    "/sobre",
    "/conta",
    "/checkout",
    "/acompanhar",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.8,
  }));
}
