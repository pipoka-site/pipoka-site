import { validateProductImage } from "@/lib/uploadValidation";
import { createClientUuid } from "@/lib/clientUuid";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "") || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "";
const tokenKey = "pipoka-admin-token";

export const isSupabaseConfigured = Boolean(url && key);

type AuthSession = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  user?: unknown;
};

function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(tokenKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(tokenKey);
    return null;
  }
}

function saveSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;

  if (!session) {
    localStorage.removeItem(tokenKey);
  } else {
    localStorage.setItem(tokenKey, JSON.stringify(session));
  }
}

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    const message =
      value.msg ||
      value.message ||
      value.error_description ||
      value.error;

    if (typeof message === "string" && message) return message;
  }

  return fallback;
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function refreshSession(session: AuthSession): Promise<AuthSession | null> {
  if (!session.refresh_token) return null;

  const response = await fetch(
    `${url}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    },
  );

  const payload = await parseResponse(response);

  if (!response.ok || !payload || typeof payload !== "object") {
    saveSession(null);
    return null;
  }

  const next = payload as AuthSession;
  saveSession(next);
  return next;
}

async function validSession() {
  const session = getStoredSession();
  if (!session?.access_token) return null;

  const expiry = session.expires_at ?? 0;
  if (expiry && expiry * 1000 <= Date.now() + 60_000) {
    return refreshSession(session);
  }

  return session;
}

async function request(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean; contentType?: boolean } = {},
) {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase não configurado. Confira as variáveis da Vercel.",
    );
  }

  const session = options.auth ? await validSession() : null;

  if (options.auth && !session) {
    throw new Error("Sessão expirada. Entre novamente no painel.");
  }

  const headers = new Headers(init.headers);
  headers.set("apikey", key);

  // A chave sb_publishable_... não é um JWT e não deve ser usada como Bearer.
  // Authorization só é enviado quando existe uma sessão administrativa válida.
  if (options.auth && session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  } else {
    headers.delete("Authorization");
  }

  if (options.contentType !== false && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${url}${path}`, {
    ...init,
    headers,
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new Error(errorMessage(payload, `Erro ${response.status}`));
  }

  return payload;
}

export async function signIn(email: string, password: string) {
  const payload = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({
      email: email.trim(),
      password,
    }),
  });

  if (!payload || typeof payload !== "object") {
    throw new Error("Resposta inválida do Supabase.");
  }

  const session = payload as AuthSession;

  if (!session.access_token) {
    throw new Error("O Supabase não criou uma sessão para este usuário.");
  }

  saveSession(session);
  return session;
}

export async function signOut() {
  const session = await validSession();

  try {
    if (session) {
      await request(
        "/auth/v1/logout",
        { method: "POST" },
        { auth: true },
      );
    }
  } finally {
    saveSession(null);
  }
}

export async function hasSession() {
  if (!isSupabaseConfigured) return false;

  try {
    const session = await validSession();
    if (!session) return false;

    await request("/auth/v1/user", {}, { auth: true });
    return true;
  } catch {
    saveSession(null);
    return false;
  }
}

export async function getProducts(includeInactive = false) {
  const filter = includeInactive ? "" : "&active=eq.true";

  const payload = await request(
    `/rest/v1/products?select=*&order=sort_order.asc.nullslast,created_at.asc${filter}`,
  );

  return Array.isArray(payload) ? payload : [];
}

export async function getSettings() {
  const payload = await request(
    "/rest/v1/store_settings?select=*&id=eq.1&limit=1",
  );

  return Array.isArray(payload) ? payload[0] || null : null;
}

export async function upsertProduct(product: unknown) {
  return request(
    "/rest/v1/products?on_conflict=id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(product),
    },
    { auth: true },
  );
}

export async function deleteProduct(id: string) {
  await request(
    `/rest/v1/products?id=eq.${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    },
    { auth: true },
  );
}

export async function upsertSettings(settings: unknown) {
  return request(
    "/rest/v1/store_settings?on_conflict=id",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(settings),
    },
    { auth: true },
  );
}

export async function uploadProductImage(file: File) {
  validateProductImage(file);

  if (!isSupabaseConfigured) {
    throw new Error("Supabase não configurado.");
  }

  const session = await validSession();

  if (!session) {
    throw new Error("Sessão expirada. Entre novamente no painel.");
  }

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") || "jpg";

  const safeName = `${createClientUuid()}.${extension}`;

  const response = await fetch(
    `${url}/storage/v1/object/product-images/${safeName}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: file,
    },
  );

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new Error(
      errorMessage(payload, "Não foi possível enviar a imagem."),
    );
  }

  return `${url}/storage/v1/object/public/product-images/${safeName}`;
}

export type SecureOrderResult = {
  order_code: string;
  tracking_token: string;
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
};

export async function createOrder(order: unknown): Promise<SecureOrderResult> {
  const payload = await request("/rest/v1/rpc/create_order_secure", {
    method: "POST",
    body: JSON.stringify({ p_order: order }),
  });

  if (!payload || typeof payload !== "object") {
    throw new Error("O Supabase não retornou os dados do pedido criado.");
  }

  return payload as SecureOrderResult;
}

export async function getOrders(limit = 100) {
  const safeLimit = Math.max(1, Math.min(500, limit));

  const payload = await request(
    `/rest/v1/orders?select=*&order=created_at.desc&limit=${safeLimit}`,
    {},
    { auth: true },
  );

  return Array.isArray(payload) ? payload : [];
}

export async function updateOrder(id: string, changes: unknown) {
  const payload = await request(
    `/rest/v1/orders?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(changes),
    },
    { auth: true },
  );

  return Array.isArray(payload) ? payload[0] || null : payload;
}
export async function getTrackedOrder(orderCode: string, trackingToken: string) {
  const payload = await request("/rest/v1/rpc/track_order", {
    method: "POST",
    body: JSON.stringify({
      p_order_code: orderCode.trim(),
      p_tracking_token: trackingToken.trim(),
    }),
  });

  return Array.isArray(payload) ? payload[0] || null : payload;
}


export type AdminUserRecord = {
  user_id: string;
  email: string;
  active: boolean;
  created_at: string;
};

export type AuditLogRecord = {
  id: string;
  user_id?: string | null;
  action: string;
  table_name: string;
  record_id?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
};

export async function listAdminUsers(): Promise<AdminUserRecord[]> {
  const payload = await request("/rest/v1/rpc/list_admin_users", {
    method: "POST",
    body: JSON.stringify({}),
  }, { auth: true });
  return Array.isArray(payload) ? payload as AdminUserRecord[] : [];
}

export async function addAdminByEmail(email: string): Promise<boolean> {
  const payload = await request("/rest/v1/rpc/add_admin_by_email", {
    method: "POST",
    body: JSON.stringify({ p_email: email.trim().toLowerCase() }),
  }, { auth: true });
  return payload === true;
}

export async function setAdminActive(userId: string, active: boolean): Promise<boolean> {
  const payload = await request("/rest/v1/rpc/set_admin_active", {
    method: "POST",
    body: JSON.stringify({ p_user_id: userId, p_active: active }),
  }, { auth: true });
  return payload === true;
}

export async function getAuditLogs(limit = 200): Promise<AuditLogRecord[]> {
  const safeLimit = Math.max(1, Math.min(500, limit));
  const payload = await request(
    `/rest/v1/audit_logs?select=*&order=created_at.desc&limit=${safeLimit}`,
    {},
    { auth: true },
  );
  return Array.isArray(payload) ? payload as AuditLogRecord[] : [];
}


export type CustomerFlagRecord = {
  phone: string;
  deleted: boolean;
  favorite: boolean;
  blocked: boolean;
  updated_at: string;
};

export async function getCustomerFlags(): Promise<CustomerFlagRecord[]> {
  const payload = await request("/rest/v1/customer_flags?select=*&order=updated_at.desc", {}, { auth: true });
  return Array.isArray(payload) ? payload as CustomerFlagRecord[] : [];
}

export async function upsertCustomerFlag(flag: Omit<CustomerFlagRecord, "updated_at">) {
  return request("/rest/v1/customer_flags?on_conflict=phone", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(flag),
  }, { auth: true });
}


export type CustomerAccountRecord = {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  created_at: string;
  last_sign_in_at?: string | null;
  active: boolean;
  address_count: number;
  addresses: Array<{ id: string; label: string; postal_code?: string; street: string; number: string; complement?: string | null; neighborhood: string; city: string; reference?: string | null; is_default: boolean }>;
};

export async function listCustomerAccounts(): Promise<CustomerAccountRecord[]> {
  const payload = await request("/rest/v1/rpc/list_customer_accounts", { method: "POST", body: "{}" }, { auth: true });
  return Array.isArray(payload) ? payload.map((item: CustomerAccountRecord) => ({
    ...item,
    address_count: Number(item.address_count || 0),
    addresses: Array.isArray(item.addresses) ? item.addresses : [],
  })) : [];
}

export async function adminUpdateCustomerProfile(userId: string, changes: { full_name?: string; phone?: string }) {
  return request("/rest/v1/rpc/admin_update_customer_profile", {
    method: "POST",
    body: JSON.stringify({ p_user_id: userId, p_full_name: changes.full_name ?? null, p_phone: changes.phone ?? null }),
  }, { auth: true });
}

export async function adminSetCustomerActive(userId: string, active: boolean) {
  return request("/rest/v1/rpc/admin_set_customer_active", {
    method: "POST",
    body: JSON.stringify({ p_user_id: userId, p_active: active }),
  }, { auth: true });
}

export async function adminUpsertCustomerAddress(userId: string, address: CustomerAccountRecord["addresses"][number]) {
  return request("/rest/v1/rpc/admin_upsert_customer_address", {
    method: "POST",
    body: JSON.stringify({
      p_user_id: userId, p_address_id: address.id || null, p_label: address.label,
      p_postal_code: address.postal_code || "", p_street: address.street, p_number: address.number,
      p_complement: address.complement || null, p_neighborhood: address.neighborhood, p_city: address.city,
      p_reference: address.reference || null, p_is_default: address.is_default,
    }),
  }, { auth: true });
}

export type CustomerReviewRecord = {
  id: string;
  user_id: string;
  order_id: string;
  rating: number;
  comment?: string | null;
  admin_reply?: string | null;
  visible: boolean;
  created_at: string;
  customer_profiles?: { full_name?: string; email?: string } | null;
  orders?: { order_code?: string } | null;
};

export async function getCustomerReviews(limit = 200): Promise<CustomerReviewRecord[]> {
  const safeLimit = Math.max(1, Math.min(500, limit));
  const payload = await request(`/rest/v1/customer_reviews?select=*,customer_profiles(full_name,email),orders(order_code)&order=created_at.desc&limit=${safeLimit}`, {}, { auth: true });
  return Array.isArray(payload) ? payload as CustomerReviewRecord[] : [];
}

export async function updateCustomerReview(id: string, changes: Partial<Pick<CustomerReviewRecord, "admin_reply" | "visible">>) {
  const payload = await request(`/rest/v1/customer_reviews?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(changes),
  }, { auth: true });
  return Array.isArray(payload) ? payload[0] || null : payload;
}


