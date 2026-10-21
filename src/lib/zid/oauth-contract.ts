// No secrets or provider writes in the contract helpers.
export const ZID_COOKIE = "reload_zid_dev_browser";
export const ZID_PATH = "/api/integrations/zid";
export const isOpaque = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export type ZidTokens = { authorization: string; access_token: string; refresh_token: string; expires_at: string };
export function parseTokens(value: unknown, now = Date.now()): ZidTokens {
  const row = value as Record<string, unknown> | null;
  if (!row || ![row.authorization, row.access_token, row.refresh_token].every(v => typeof v === "string" && v.length >= 8 && v.length <= 16384 && !/[\r\n]/.test(v))) throw new Error("zid_token_invalid");
  const expires = row.expires_in;
  if (typeof expires !== "number" || !Number.isSafeInteger(expires) || expires < 60 || expires > 315360000) throw new Error("zid_token_invalid");
  return { authorization: row.authorization as string, access_token: row.access_token as string, refresh_token: row.refresh_token as string, expires_at: new Date(now + expires * 1000).toISOString() };
}
export function storeIdentity(value: unknown, allowed: string[]) {
  const body = value as Record<string, unknown> | null;
  const store = body?.store as Record<string, unknown> | undefined;
  const id = typeof store?.id === "number" || typeof store?.id === "string" ? String(store.id) : "";
  if (!/^\d{1,20}$/.test(id) || !allowed.includes(id)) throw new Error("zid_development_store_required");
  const name = typeof store?.title === "string" ? store.title : typeof store?.name === "string" ? store.name : "Zid development store";
  return { id, name: name.replace(/[\u0000-\u001f]/g, " ").slice(0, 120) };
}
export function paymentCapability(value: unknown) {
  const body = value as Record<string, unknown> | null;
  if (!Array.isArray(body?.payload)) throw new Error("zid_payment_reply_invalid");
  return body.payload.some((method: unknown) => {
    const row = method as Record<string, unknown> | null;
    return row?.enabled === true && row.code === "payment_link.zidpay" &&
      ["string", "number"].includes(typeof row.id) && /^\d+$/.test(String(row.id));
  });
}
export function callbackAddress(origin: string) {
  const url = new URL(origin);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("zid_origin_invalid");
  return new URL(`${ZID_PATH}/callback`, url).href;
}
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
}
