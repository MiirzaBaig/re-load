import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { callbackAddress, escapeHtml, parseTokens, paymentCapability, storeIdentity, type ZidTokens, ZID_PATH } from "./oauth-contract";

export const opaque = () => randomBytes(32).toString("base64url");
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function zidConfig() {
  if (process.env.ZID_DEV_OAUTH_ENABLED !== "true") throw new Error("zid_dev_disabled");
  const clientId = process.env.ZID_CLIENT_ID?.trim();
  const secret = process.env.ZID_CLIENT_SECRET?.trim();
  const origin = process.env.ZID_OAUTH_ORIGIN?.trim();
  const allowed = (process.env.ZID_DEV_STORE_IDS || "").split(",").map(s=>s.trim()).filter(Boolean);
  const key = process.env.ZID_DEV_ENCRYPTION_KEY || "";
  if (!clientId || !secret || !origin || !/^\d+$/.test(clientId) || !allowed.length || allowed.some(id=>!/^\d+$/.test(id)) || !/^[A-Za-z0-9+/]{43}=$/.test(key) || Buffer.from(key,"base64").length!==32) throw new Error("zid_dev_not_configured");
  return { clientId, secret, origin: new URL(origin).origin, callback: callbackAddress(origin), allowed, key };
}
export function zidAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) throw new Error("zid_storage_unavailable");
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export function sealTokens(tokens: ZidTokens, sessionHash: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm",Buffer.from(key,"base64"),iv);
  cipher.setAAD(Buffer.from(sessionHash));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(tokens),"utf8"),cipher.final()]);
  return ["zid-dev-v1",iv.toString("base64"),cipher.getAuthTag().toString("base64"),ciphertext.toString("base64")].join(".");
}
async function safeJson(response: Response) {
  if (!response.ok) throw new Error(`zid_provider_${response.status}`);
  const text = await response.text();
  if (text.length > 1_000_000) throw new Error("zid_reply_too_large");
  return JSON.parse(text);
}
export async function exchangeZidCode(code: string, config: ReturnType<typeof zidConfig>) {
  return parseTokens(await safeJson(await fetch("https://oauth.zid.sa/oauth/token", {
    method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"},
    body:new URLSearchParams({grant_type:"authorization_code",client_id:config.clientId,client_secret:config.secret,redirect_uri:config.callback,code}),
    signal:AbortSignal.timeout(15000),redirect:"error",cache:"no-store",
  })));
}
export async function inspectZidStore(tokens: ZidTokens, allowed: string[]) {
  const headers = {Authorization:`Bearer ${tokens.authorization}`,"X-Manager-Token":tokens.access_token,Accept:"application/json","Accept-Language":"en"};
  const identity = storeIdentity(await safeJson(await fetch("https://api.zid.sa/v1/managers/account/store",{headers,signal:AbortSignal.timeout(15000),redirect:"error",cache:"no-store"})),allowed);
  // Identity is verified against the explicit development allowlist before any further lookup.
  let paymentLinkAvailable: boolean | null = null;
  try { paymentLinkAvailable=paymentCapability(await safeJson(await fetch("https://api.zid.sa/v1/managers/store/payment-methods",{headers,signal:AbortSignal.timeout(15000),redirect:"error",cache:"no-store"}))); } catch { /* unknown does not mean disabled */ }
  return {...identity,paymentLinkAvailable};
}
export const privateHeaders = {
  "Cache-Control":"private, no-store, max-age=0",
  "Referrer-Policy":"no-referrer",
  "X-Robots-Tag":"noindex, nofollow, noarchive",
  "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "X-Content-Type-Options":"nosniff",
};
export function statusPage(title: string, explanation: string, status = 200) {
  // Route response avoids the marketing layout, analytics and third-party scripts.
  return new Response(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reload · اختبار الربط</title><style>:root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:light-dark(#f8f7f4,#0f0f12);color:light-dark(#0f0f12,#f8f7f4);font-family:system-ui,sans-serif;padding:24px}main{width:min(100%,560px);padding:32px;border:1px solid light-dark(#e7e9ef,#38383e);border-radius:24px}img{width:48px;height:48px;border-radius:12px}h1{font-size:24px;line-height:1.5}p{line-height:1.8;white-space:pre-line;overflow-wrap:anywhere}a{display:inline-block;color:inherit;padding:12px 16px;border:1px solid;border-radius:12px;text-decoration:none}a:active{transform:scale(.98)}@media(prefers-reduced-motion:no-preference){main{animation:enter .25s ease-out}@keyframes enter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}}</style><main><img src="/brand/reload-icon-192.png" alt="Reload"><h1>${escapeHtml(title)}</h1><p dir="auto">${escapeHtml(explanation)}</p><a href="${ZID_PATH}/connect">إعادة الاختبار · Retry</a></main></html>`,{status,headers:{...privateHeaders,"Content-Type":"text/html; charset=utf-8"}});
}
