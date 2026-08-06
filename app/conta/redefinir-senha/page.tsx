"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { updateCustomerPassword } from "@/lib/customerAuth";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingLink, setLoadingLink] = useState(true);

  useEffect(() => {
    try {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const linkError = query.get("error_description") || hash.get("error_description");
      if (linkError) {
        setError("Este link não está mais disponível. Solicite uma nova recuperação de senha.");
        return;
      }

      const accessToken = hash.get("access_token") || query.get("access_token") || "";
      const type = hash.get("type") || query.get("type") || "";
      const tokenFromQuery = query.get("token") || "";
      const recoveryToken = accessToken || tokenFromQuery;
      setToken(recoveryToken);
      if (!recoveryToken) {
        setError("Link inválido ou expirado. Solicite uma nova recuperação de senha.");
      } else if (type && type !== "recovery") {
        setError("Link inválido ou expirado. Solicite uma nova recuperação de senha.");
      }
    } catch {
      setError("Não foi possível validar o link de recuperação. Solicite um novo e-mail.");
    } finally {
      setLoadingLink(false);
    }
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setMessage("");
    if (!token) return setError("Link inválido ou expirado. Solicite uma nova recuperação de senha.");
    const data = new FormData(e.currentTarget);
    const password = String(data.get("password") || "");
    const confirm = String(data.get("confirm") || "");
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return setError("Use pelo menos 8 caracteres, com uma letra e um número.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    try {
      await updateCustomerPassword(token, password);
      setMessage("Senha alterada com sucesso. Você já pode entrar na sua conta.");
      window.setTimeout(() => {
        window.location.href = "/conta";
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
    }
  }

  return <main className="container-pipoka py-12"><div className="mx-auto max-w-lg rounded-[2rem] bg-white p-7 shadow-soft"><h1 className="font-serif text-3xl font-bold text-wine-900">Criar nova senha</h1>{loadingLink&&<p className="mt-4 rounded-xl bg-cream p-3 text-wine-800">Validando o link...</p>}<form onSubmit={submit} className="mt-6 grid gap-4"><input name="password" type="password" placeholder="Nova senha" className="w-full rounded-2xl border border-wine-900/15 px-4 py-3 outline-none focus:border-gold-500" required/><input name="confirm" type="password" placeholder="Confirmar nova senha" className="w-full rounded-2xl border border-wine-900/15 px-4 py-3 outline-none focus:border-gold-500" required/><button className="btn-primary" disabled={!token || loadingLink}>Salvar nova senha</button></form>{error&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}{message&&<p className="mt-4 rounded-xl bg-green-50 p-3 text-green-700">{message}</p>}<Link href="/conta" className="mt-5 inline-block font-semibold text-wine-700">Voltar ao login</Link></div></main>;
}
