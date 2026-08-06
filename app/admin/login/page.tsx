"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { hasSession, isSupabaseConfigured, signIn } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { hasSession().then(ok => ok && router.replace("/admin")); }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured) return setError("Supabase não configurado. Confira as variáveis da Vercel.");
    setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      await signIn(String(data.get("email")), String(data.get("password")));
    } catch (error) {
      setLoading(false);
      const message = error instanceof Error ? error.message : "Não foi possível entrar no painel.";
      return setError(message);
    }
    setLoading(false);
    router.replace("/admin"); router.refresh();
  }

  return <section className="container-pipoka grid min-h-[70vh] place-items-center py-14"><form onSubmit={submit} className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-soft"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-wine-700 text-white"><LockKeyhole/></div><h1 className="mt-5 text-center font-serif text-4xl font-bold text-wine-900">Painel PIPOKÁ</h1><p className="mt-2 text-center text-wine-900/60">Entre com o usuário criado no Supabase.</p><div className="mt-7 grid gap-4"><input required type="email" name="email" placeholder="E-mail" className="rounded-xl border p-3 outline-none focus:border-gold-500"/><input required type="password" name="password" placeholder="Senha" className="rounded-xl border p-3 outline-none focus:border-gold-500"/></div>{error&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={loading} className="btn-primary mt-6 w-full">{loading?"Entrando...":"Entrar no painel"}</button></form></section>;
}
