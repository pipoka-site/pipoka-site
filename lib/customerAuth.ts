import { createClientUuid } from "@/lib/clientUuid";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "") || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "";
const tokenKey = "pipoka-customer-session";
const pendingSignupKey = "pipoka-customer-pending-signup";

export type CustomerSession = {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user?: { id?: string; email?: string; phone?: string; user_metadata?: Record<string, unknown> };
};

export type CustomerProfile = {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  birth_date?: string | null;
  avatar_url?: string | null;
  marketing_opt_in: boolean;
  active?: boolean;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string | null;
};

export type CustomerAddress = {
  id: string;
  user_id: string;
  label: string;
  postal_code: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  reference?: string | null;
  is_default: boolean;
  created_at?: string;
};


export type PendingCustomerSignup = {
  fullName: string;
  phone: string;
  postalCode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  reference?: string;
};

function getPendingSignup(): PendingCustomerSignup | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(pendingSignupKey);
  if (!raw) return null;
  try { return JSON.parse(raw) as PendingCustomerSignup; } catch { return null; }
}

function savePendingSignup(value: PendingCustomerSignup | null) {
  if (typeof window === "undefined") return;
  if (value) localStorage.setItem(pendingSignupKey, JSON.stringify(value));
  else localStorage.removeItem(pendingSignupKey);
}

function parse(text: string) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function sanitizeMessage(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  const lowered = normalized.toLowerCase();
  if (lowered.includes("access_token") || lowered.includes("refresh_token") || lowered.includes("grant_type") || lowered.includes("jwt") || lowered.includes("token") || lowered.includes("authorization") || lowered.includes("unexpected") || lowered.includes("request body")) return "";
  return normalized;
}

function message(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    const value = p.msg || p.message || p.error_description || p.error;
    if (typeof value === "string") {
      const sanitized = sanitizeMessage(value);
      if (sanitized) return sanitized;
    }
  }
  return fallback;
}

export function getFriendlyAuthErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    const value = error.message.trim();
    if (!value) return fallback;
    const lowered = value.toLowerCase();
    if (lowered.includes("entre na sua conta") || lowered.includes("sessão expirada") || lowered.includes("e-mail, celular ou senha") || lowered.includes("desativada") || lowered.includes("não foi possível iniciar") || lowered.includes("não foi possível salvar") || lowered.includes("não foi possível remover") || lowered.includes("link inválido") || lowered.includes("link expirado") || lowered.includes("já foi utilizado")) return value;
    if (lowered.includes("access_token") || lowered.includes("refresh_token") || lowered.includes("grant_type") || lowered.includes("jwt") || lowered.includes("token") || lowered.includes("authorization") || lowered.includes("unexpected") || lowered.includes("request body")) return fallback;
    if (lowered.includes("email") && lowered.includes("confirm")) return "Confirme seu e-mail antes de entrar na sua conta.";
  }

  return fallback;
}

export function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits ? `+${digits}` : "";
}

function safeReadStoredSession() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(tokenKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CustomerSession;
    if (!parsed?.access_token) {
      localStorage.removeItem(tokenKey);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(tokenKey);
    return null;
  }
}

export function getCustomerSession(): CustomerSession | null {
  return safeReadStoredSession();
}

function save(session: CustomerSession | null) {
  if (typeof window === "undefined") return;
  if (session) {
    const safeSession = {
      ...session,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: session.user ? { id: session.user.id, email: session.user.email, phone: session.user.phone, user_metadata: session.user.user_metadata } : undefined,
    } as CustomerSession;
    localStorage.setItem(tokenKey, JSON.stringify(safeSession));
  } else {
    localStorage.removeItem(tokenKey);
  }
}

async function validCustomerSession(): Promise<CustomerSession | null> {
  const session = getCustomerSession();
  if (!session?.access_token) return null;
  if (!session.expires_at || session.expires_at * 1000 > Date.now() + 60_000) return session;
  if (!session.refresh_token) { save(null); return null; }
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST", headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  const payload = parse(await response.text());
  if (!response.ok || !payload || typeof payload !== "object") { save(null); return null; }
  save(payload as CustomerSession);
  return payload as CustomerSession;
}

async function authFetch(path: string, init: RequestInit = {}, authenticated = false) {
  if (!url || !key) throw new Error("Supabase não configurado.");
  const session = authenticated ? await validCustomerSession() : null;
  if (authenticated && !session?.access_token) throw new Error("Entre na sua conta para continuar.");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Content-Type", "application/json");
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  const response = await fetch(`${url}${path}`, { ...init, headers });
  const payload = parse(await response.text());
  if (!response.ok) {
    const friendly = message(payload, `Erro ${response.status}`);
    throw new Error(friendly || "Não foi possível completar a solicitação.");
  }
  return payload;
}
export type SecureCustomerOrderResult = {
  order_code: string;
  tracking_token: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
};

export async function createCustomerOrder(order: unknown): Promise<SecureCustomerOrderResult> {
  const payload = await authFetch("/rest/v1/rpc/create_order_secure", {
    method: "POST",
    body: JSON.stringify({ p_order: order }),
  }, true);

  if (!payload || typeof payload !== "object") {
    throw new Error("Não foi possível confirmar o pedido. Tente novamente.");
  }

  const result = payload as Record<string, unknown>;
  const orderCode = typeof result.order_code === "string" ? result.order_code.trim() : "";
  const trackingToken = typeof result.tracking_token === "string" ? result.tracking_token.trim() : "";
  const subtotal = Number(result.subtotal ?? 0);
  const deliveryFee = Number(result.delivery_fee ?? 0);
  const discount = Number(result.discount ?? 0);
  const total = Number(result.total ?? 0);

  if (!orderCode || !trackingToken || !Number.isFinite(total)) {
    throw new Error("Não foi possível confirmar o pedido. Tente novamente.");
  }

  return { order_code: orderCode, tracking_token: trackingToken, subtotal, delivery_fee: deliveryFee, discount, total };
}

export async function customerSignUp(input: { email: string; password: string; fullName: string; phone: string; postalCode: string; street: string; number: string; complement?: string; neighborhood: string; city: string; reference?: string }) {
  const normalizedPhone = normalizePhone(input.phone);
  savePendingSignup({
    fullName: input.fullName.trim(), phone: normalizedPhone, postalCode: input.postalCode.trim(),
    street: input.street.trim(), number: input.number.trim(), complement: input.complement?.trim() || "",
    neighborhood: input.neighborhood.trim(), city: input.city.trim(), reference: input.reference?.trim() || "",
  });
  const payload = await authFetch("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      data: {
        full_name: input.fullName.trim(),
        phone: normalizedPhone,
        postal_code: input.postalCode.trim(),
        street: input.street.trim(),
        number: input.number.trim(),
        complement: input.complement?.trim() || "",
        neighborhood: input.neighborhood.trim(),
        city: input.city.trim(),
        reference: input.reference?.trim() || "",
      },
    }),
  });
  if (payload && typeof payload === "object") {
    const session = payload as CustomerSession;
    if (session.access_token) {
      save(session);
      try {
        await ensureCustomerAccount();
      } catch {
        // keep the signup flow resilient while the backend profile sync runs
      }
    }
  }
  return payload;
}

async function resolveEmail(identifier: string) {
  if (identifier.includes("@")) return identifier.trim().toLowerCase();
  const payload = await authFetch("/rest/v1/rpc/customer_login_email", {
    method: "POST",
    body: JSON.stringify({ p_phone: normalizePhone(identifier) }),
  });
  if (typeof payload !== "string" || !payload) throw new Error("E-mail, celular ou senha incorretos.");
  return payload;
}

export async function customerSignIn(identifier: string, password: string) {
  const email = await resolveEmail(identifier);
  const payload = await authFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!payload || typeof payload !== "object" || !(payload as CustomerSession).access_token) {
    throw new Error("Não foi possível iniciar a sessão.");
  }
  save(payload as CustomerSession);
  try {
    const profile = await ensureCustomerAccount();
    if (profile?.active === false) {
      await customerSignOut().catch(() => null);
      throw new Error("Esta conta está desativada. Entre em contato com a loja.");
    }
  } catch (error) {
    save(null);
    throw error;
  }
  await authFetch("/rest/v1/rpc/touch_customer_login", { method: "POST", body: "{}" }, true).catch(() => null);
  await authFetch("/rest/v1/rpc/link_previous_customer_orders", { method: "POST", body: "{}" }, true).catch(() => null);
  return payload as CustomerSession;
}

export async function customerSignOut(allDevices = false) {
  const session = getCustomerSession();
  try {
    if (session?.access_token) {
      await authFetch(`/auth/v1/logout${allDevices ? "?scope=global" : ""}`, { method: "POST" }, true);
    }
  } catch {
    // ignore logout errors and clear client-side session state
  } finally {
    save(null);
    if (typeof window !== "undefined") {
      try { localStorage.removeItem(pendingSignupKey); } catch {}
    }
  }
}

export async function sendPasswordReset(email: string) {
  const redirectTo = "https://pipoka-site.vercel.app/conta/redefinir-senha";
  const recoverPath = `/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`;

  await authFetch(recoverPath, {
    method: "POST",
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}

export async function updateCustomerPassword(accessToken: string, password: string) {
  if (!accessToken) throw new Error("Link inválido ou expirado. Solicite uma nova recuperação de senha.");
  if (!url || !key) throw new Error("Supabase não configurado.");

  const response = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });

  const payload = parse(await response.text());
  if (!response.ok) {
    throw new Error(message(payload, "Não foi possível alterar a senha."));
  }
}


export async function ensureCustomerAccount() {
  const session = getCustomerSession();
  if (!session?.access_token) return null;
  const pending = getPendingSignup();
  const payload = await authFetch("/rest/v1/rpc/ensure_current_customer_account", {
    method: "POST",
    body: JSON.stringify({
      p_full_name: pending?.fullName || null,
      p_phone: pending?.phone || null,
      p_postal_code: pending?.postalCode || null,
      p_street: pending?.street || null,
      p_number: pending?.number || null,
      p_complement: pending?.complement || null,
      p_neighborhood: pending?.neighborhood || null,
      p_city: pending?.city || null,
      p_reference: pending?.reference || null,
    }),
  }, true);
  if (payload) savePendingSignup(null);
  return payload as CustomerProfile | null;
}

export async function ensureSignupAddress() {
  return Boolean(await ensureCustomerAccount());
}

export async function getCustomerProfile(): Promise<CustomerProfile | null> {
  const session = await validCustomerSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Sessão inválida. Entre novamente.");
  const payload = await authFetch(`/rest/v1/customer_profiles?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`, {}, true);
  return Array.isArray(payload) ? (payload[0] as CustomerProfile | undefined) || null : null;
}

export async function updateCustomerProfile(changes: Partial<CustomerProfile>) {
  const session = await validCustomerSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Sessão inválida. Entre novamente na sua conta.");

  const body: Partial<CustomerProfile> = {};
  if (typeof changes.full_name === "string") body.full_name = changes.full_name.trim();
  if (typeof changes.phone === "string") body.phone = normalizePhone(changes.phone);
  if (typeof changes.birth_date === "string" || changes.birth_date === null) body.birth_date = changes.birth_date;
  if (typeof changes.avatar_url === "string" || changes.avatar_url === null) body.avatar_url = changes.avatar_url;
  if (typeof changes.marketing_opt_in === "boolean") body.marketing_opt_in = changes.marketing_opt_in;
  if (Object.keys(body).length === 0) throw new Error("Nenhuma alteração válida foi informada.");

  const payload = await authFetch(
    `/rest/v1/customer_profiles?user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body),
    },
    true,
  );

  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error("Não foi possível localizar seu perfil para salvar as alterações.");
  }

  const updated = payload[0] as CustomerProfile | undefined;
  if (!updated?.user_id) {
    throw new Error("Não foi possível salvar seu perfil.");
  }

  return updated;
}

export async function getCustomerAddresses(): Promise<CustomerAddress[]> {
  const session = await validCustomerSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Sessão inválida. Entre novamente.");
  const payload = await authFetch(`/rest/v1/customer_addresses?select=*&user_id=eq.${encodeURIComponent(userId)}&order=is_default.desc,created_at.asc`, {}, true);
  return Array.isArray(payload) ? payload as CustomerAddress[] : [];
}

export async function saveCustomerAddress(address: Partial<CustomerAddress>) {
  const session = await validCustomerSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Sessão inválida. Entre novamente.");

  const isDefault = Boolean(address.is_default);
  const body = { ...address, user_id: userId, id: address.id || createClientUuid(), is_default: isDefault };
  const payload = await authFetch(`/rest/v1/customer_addresses?user_id=eq.${encodeURIComponent(userId)}&on_conflict=id`, {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(body),
  }, true);
  return Array.isArray(payload) ? payload[0] || null : payload;
}

export async function deleteCustomerAddress(id: string) {
  const session = await validCustomerSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Sessão inválida. Entre novamente.");
  await authFetch(`/rest/v1/customer_addresses?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" }, true);
}

export async function getCustomerOrders() {
  const session = await validCustomerSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Sessão inválida. Entre novamente.");
  const payload = await authFetch(`/rest/v1/orders?select=*&customer_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&deleted_at=is.null`, {}, true);
  return Array.isArray(payload) ? payload : [];
}

export async function getCustomerFavorites(): Promise<string[]> {
  const session = await validCustomerSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Sessão inválida. Entre novamente.");
  const payload = await authFetch(`/rest/v1/customer_favorites?select=product_id&user_id=eq.${encodeURIComponent(userId)}`, {}, true);
  return Array.isArray(payload) ? payload.map((row: any) => String(row.product_id)) : [];
}

export async function toggleCustomerFavorite(productId: string, active: boolean) {
  const session = await validCustomerSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("Sessão inválida. Entre novamente.");
  if (active) {
    await authFetch(`/rest/v1/customer_favorites?user_id=eq.${encodeURIComponent(userId)}&on_conflict=user_id,product_id`, {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: userId, product_id: productId }),
    }, true);
  } else {
    await authFetch(`/rest/v1/customer_favorites?user_id=eq.${encodeURIComponent(userId)}&product_id=eq.${encodeURIComponent(productId)}`, { method: "DELETE" }, true);
  }
}

export async function submitOrderReview(orderId: string, rating: number, comment: string) {
  return authFetch("/rest/v1/customer_reviews?on_conflict=order_id", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ order_id: orderId, rating, comment: comment.trim() || null }),
  }, true);
}

export async function linkOrderToCustomer(orderCode: string, trackingToken: string) {
  if (!getCustomerSession()) return false;
  const payload = await authFetch("/rest/v1/rpc/link_order_to_current_customer", {
    method: "POST", body: JSON.stringify({ p_order_code: orderCode, p_tracking_token: trackingToken }),
  }, true);
  return payload === true;
}


