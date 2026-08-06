"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, GripVertical, Images, Save, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultSettings } from "@/lib/store";
import { getSettings, hasSession, uploadProductImage, upsertSettings } from "@/lib/supabase";

export default function BannerAdminPage() {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    document.body.classList.add("admin-page-dark");
    (async () => {
      if (!(await hasSession())) return router.replace("/admin/login");
      const settings = await getSettings();
      setImages((settings?.banner_images || defaultSettings.banner_images || []).slice(0, 10));
    })();
    return () => document.body.classList.remove("admin-page-dark");
  }, [router]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files: File[] = Array.from(event.target.files || []);
    const available = 10 - images.length;
    if (!available) return setMessage("O limite de 10 fotos já foi atingido.");
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of files.slice(0, available)) uploaded.push(await uploadProductImage(file));
      setImages((current) => [...current, ...uploaded].slice(0, 10));
      setMessage("Fotos enviadas. Clique em salvar para publicar.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar as fotos.");
    } finally { setBusy(false); event.target.value = ""; }
  }

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    setImages((current) => {
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  async function save() {
    setBusy(true);
    try {
      const current = await getSettings();
      await upsertSettings({ ...defaultSettings, ...(current || {}), banner_images: images.slice(0, 10) });
      setMessage("Banners salvos e publicados na tela inicial.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar banners.");
    } finally { setBusy(false); }
  }

  return <main className="admin-dark min-h-screen p-4 md:p-8">
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/admin" className="inline-flex items-center gap-2 text-sm text-gold-600"><ArrowLeft size={17}/> Voltar ao painel</Link><h1 className="mt-3 font-serif text-3xl font-bold">Banners da tela inicial</h1><p className="mt-2">Adicione até 10 fotos reais. A ordem abaixo será a ordem do carrossel.</p></div>
        <button onClick={save} disabled={busy} className="btn-primary"><Save size={18}/>{busy ? " Salvando..." : " Salvar banners"}</button>
      </div>
      {message && <div className="mb-5 rounded-xl border border-gold-500/25 bg-gold-500/10 p-3 text-sm">{message}</div>}
      <section className="rose-panel rounded-3xl p-5 md:p-7">
        <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-white/[.03] text-center">
          <Upload className="text-gold-600"/><strong className="mt-3">Adicionar fotos ao banner</strong><span className="mt-1 text-sm">JPG, PNG ou WebP · até {10 - images.length} vaga(s)</span>
          <input type="file" accept="image/*" multiple hidden onChange={upload} disabled={busy || images.length >= 10}/>
        </label>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{images.map((src, index) => <article key={`${src}-${index}`} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20"><div className="relative aspect-video"><Image src={src} alt={`Banner ${index + 1}`} fill className="object-cover" unoptimized={src.startsWith("http")}/><span className="absolute left-3 top-3 rounded-full bg-wine-700 px-3 py-1 text-xs font-bold">{index + 1}</span></div><div className="flex items-center gap-2 p-3"><GripVertical size={18} className="text-white/40"/><button onClick={() => move(index,-1)} disabled={index===0} className="btn-secondary px-3 py-2 text-xs">←</button><button onClick={() => move(index,1)} disabled={index===images.length-1} className="btn-secondary px-3 py-2 text-xs">→</button><button onClick={() => setImages((current) => current.filter((_, i) => i !== index))} className="ml-auto rounded-lg p-2 text-red-300 hover:bg-red-500/10"><Trash2 size={18}/></button></div></article>)}</div>
        {!images.length && <div className="mt-8 text-center text-white/45"><Images className="mx-auto"/><p className="mt-2">Nenhuma foto cadastrada.</p></div>}
      </section>
    </div>
  </main>;
}
