import { decrypt, encrypt } from "./crypto.ts";
import { env } from "./http.ts";
import { sallaGet } from "./salla.ts";
import { ZidMcp, zidOrderForEmailVerification } from "./zid-mcp.ts";
import type { adminClient } from "./supabase.ts";
type Admin = ReturnType<typeof adminClient>;

export function normalizeOtp(value: string): string | null {
  const digits = value.trim().replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776));
  return /^\d{6}$/.test(digits) ? digits : null;
}
export function generateOtp(): string {
  const limit = Math.floor(0x100000000 / 1000000) * 1000000;
  let n: number;
  do { n = crypto.getRandomValues(new Uint32Array(1))[0]; } while (n >= limit);
  return String(n % 1000000).padStart(6, "0");
}
export async function otpHash(id: string, conversation: string, order: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env("OTP_HASH_SECRET")), {name:"HMAC",hash:"SHA-256"}, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(JSON.stringify([id,conversation,order,value])));
  return Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,"0")).join("");
}
export function validOrderEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email=value.trim().toLowerCase();
  return email.length<=254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : null;
}
export function maskOrderEmail(email: string) {
  const [local,domain]=email.split("@");
  // Don't expose custom domain names or a full email from an unverified order.
  return `${local[0]}•••@${domain[0]}•••.${domain.split(".").at(-1)}`;
}
function escape(value:string) { return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!)); }
export function otpEmail(code:string,storeName:string,language:"ar"|"en") {
  const ar=language === "ar";
  const subject=ar?"رمز التحقق لطلبك — ريلود":"Your order verification code — Reload";
  const text=ar?`رمز التحقق: ${code}\n\nطلبت التحقق من طلبك لدى ${storeName} عبر واتساب. أرسل هذا الرمز في محادثتك مع ريلود خلال 10 دقائق.\nلا تشاركه مع أي شخص. إذا ما طلبت الرمز، تجاهل الرسالة.`:`Your verification code: ${code}\n\nYou requested verification for your order with ${storeName} on WhatsApp. Enter this code in your Reload chat within 10 minutes.\nDon’t share it with anyone. If you didn’t request this code, ignore this email.`;
  const heading=ar?'رمز التحقق لطلبك':'Verify your order';
  const intro=ar?`طلبت التحقق من طلبك لدى ${escape(storeName)} عبر واتساب.`:`You requested verification for your order with ${escape(storeName)} on WhatsApp.`;
  const instruction=ar?'أرسل الرمز في محادثتك مع ريلود خلال 10 دقائق.':'Enter this code in your Reload WhatsApp chat within 10 minutes.';
  const safety=ar?'لا تشارك الرمز مع أي شخص. إذا ما طلبته، تجاهل هذه الرسالة.':'Keep this code private. If you didn’t request it, you can ignore this email.';
  const html=`<!doctype html>
<html lang="${language}" dir="${ar?'rtl':'ltr'}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${heading}</title>
<style>
:root { color-scheme:light dark; supported-color-schemes:light dark; }
@media (prefers-color-scheme:dark) {
.email-bg { background-color:#0F0F12 !important; }
.email-card { background-color:#19191E !important; border-color:#33343D !important; }
.email-title { color:#F8F7F4 !important; }
.email-copy { color:#A9AFBC !important; }
.email-code { background-color:#25262D !important; border-color:#3A3B44 !important; color:#F8F7F4 !important; }
}
@media only screen and (max-width:480px) {
.email-wrap { padding:24px 12px !important; }
.email-content { padding:28px 22px !important; }
.email-code { font-size:32px !important; letter-spacing:6px !important; }
}
</style></head>
<body class="email-bg" style="margin:0;padding:0;width:100%;background-color:#F8F7F4;font-family:Arial,Tahoma,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${ar?'رمز التحقق لطلبك، صالح لمدة 10 دقائق.':'Your order verification code. Valid for 10 minutes.'}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="email-wrap" align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;">
<tr><td class="email-card email-content" style="padding:36px;background-color:#FFFFFF;border:1px solid #E7E9EF;border-radius:20px;text-align:${ar?'right':'left'};" dir="${ar?'rtl':'ltr'}">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="vertical-align:middle;"><img src="https://www.reload.sa/brand/reload-salla-icon.png" width="44" height="44" alt="Reload" style="display:block;border:0;border-radius:12px;"></td><td class="email-title" style="padding:0 12px;color:#0F0F12;font-size:22px;line-height:28px;font-weight:700;">Reload</td></tr></table>
<h1 class="email-title" style="margin:32px 0 12px;color:#0F0F12;font-size:26px;line-height:1.4;font-weight:700;">${heading}</h1>
<p class="email-copy" style="margin:0 0 24px;color:#4B5363;font-size:15px;line-height:1.8;overflow-wrap:anywhere;">${intro}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td class="email-code" dir="ltr" align="center" style="padding:22px 12px;background-color:#F8F7F4;border:1px solid #E7E9EF;border-radius:12px;color:#0F0F12;font-family:Arial,sans-serif;font-size:36px;line-height:1.3;font-weight:700;letter-spacing:8px;">${escape(code)}</td></tr></table>
<p class="email-copy" style="margin:20px 0 0;color:#4B5363;font-size:15px;line-height:1.8;">${instruction}</p>
<p class="email-copy" style="margin:28px 0 0;padding-top:20px;border-top:1px solid #E7E9EF;color:#4B5363;font-size:13px;line-height:1.8;">${safety}</p>
</td></tr>
<tr><td class="email-copy" align="center" style="padding:20px 12px;color:#4B5363;font-size:12px;line-height:1.7;">${ar?'ريلود · خدمة عملاء أقرب لك':'Reload · Customer service, made simpler'}</td></tr>
</table></td></tr></table></body></html>`;
  return {subject,text,html};
}
export async function deliverOtpEmail(id:string,email:string,code:string,storeName:string,language:"ar"|"en") {
  const response=await fetch("https://api.resend.com/emails",{method:"POST",signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${env("RESEND_API_KEY")}`,"Content-Type":"application/json","Idempotency-Key":`order-otp/${id}`},body:JSON.stringify({from:Deno.env.get("OTP_EMAIL_FROM")||"Reload <no-reply@notify.reload.sa>",to:[email],...otpEmail(code,storeName,language)})});
  const receipt=await response.json().catch(()=>({}));
  return {ok:response.ok && typeof receipt.id === "string",id:receipt.id as string|undefined,retryable:response.status>=500 || response.status===429,status:response.status};
}

// Backend-only lookup. Never return these contacts to an unverified browser.
async function registeredEmail(admin:Admin,storeId:string,orderNumber:string) {
  const {data:zid,error}=await admin.rpc("get_zid_credential",{p_store_id:storeId});
  if(error)throw error;
  if(zid?.[0]) {
    const order=await zidOrderForEmailVerification(new ZidMcp(await decrypt(zid[0].link_ciphertext)),orderNumber);
    return validOrderEmail(order?.customer?.email);
  }
  const query=new URLSearchParams({reference_id:orderNumber,per_page:"1",page:"1"});
  const list=await sallaGet(storeId,`/orders?${query}`);
  const candidate=Array.isArray(list.data)?list.data[0]:null;
  if(!candidate?.id || String(candidate.reference_id??candidate.id)!==orderNumber.trim())return null;
  const detail=await sallaGet(storeId,`/orders/${encodeURIComponent(String(candidate.id))}?format=light`);
  return validOrderEmail(detail.data?.customer?.email);
}
export async function requestOrderOtp(admin:Admin,storeId:string,conversation:string,order:string,message:string,storeName:string,language:"ar"|"en") {
  if(!Deno.env.get("RESEND_API_KEY") || !Deno.env.get("OTP_HASH_SECRET"))return {status:"unavailable"};
  // Limit every attempt, including unknown orders, before hitting store APIs.
  const bucket=await otpHash("lookup",conversation,storeId,"email");
  const limit=await admin.rpc("consume_public_rate_limit",{p_bucket:bucket,p_limit:10,p_window_seconds:3600});
  if(limit.error)throw limit.error;
  if(!limit.data)return {status:"limited"};
  const email=await registeredEmail(admin,storeId,order);
  if(!email)return {status:"unavailable"};
  const id=crypto.randomUUID(),code=generateOtp();
  const prepared=await admin.rpc("prepare_order_email_otp",{p_id:id,p_conversation:conversation,p_order:order,p_message:message,
    p_recipient:await otpHash("recipient","", "",email),p_hash:await otpHash(id,conversation,order,code),
    p_delivery:await encrypt(JSON.stringify({email,code,storeName,language})),p_verifier:await encrypt(email)});
  if(prepared.error)throw prepared.error;
  const row=prepared.data;
  if(row.status === "SENT")return {status:"sent",id:row.id,masked:maskOrderEmail(email)};
  if(row.status !== "PREPARED")return {status:row.status === "cooldown" || row.status === "limited" ? row.status : "unavailable"};
  const delivery=JSON.parse(await decrypt(row.delivery));
  let receipt:Awaited<ReturnType<typeof deliverOtpEmail>>;
  try {
    receipt=await deliverOtpEmail(row.id,delivery.email,delivery.code,delivery.storeName,delivery.language);
  } catch {
    // Keep PREPARED so a replay retries the identical provider request safely.
    return {status:"unavailable"};
  }
  if(!receipt.ok) {
    if(!receipt.retryable)await admin.rpc("finish_order_email_otp",{p_id:row.id,p_conversation:conversation,p_sent:false});
    return {status:"unavailable"};
  }
  const finished=await admin.rpc("finish_order_email_otp",{p_id:row.id,p_conversation:conversation,p_sent:true,p_provider:receipt.id});
  if(finished.error)throw finished.error;
  if(!finished.data)return {status:"unavailable"};
  return {status:"sent",id:row.id,masked:maskOrderEmail(delivery.email)};
}
export async function verifyOrderOtp(admin:Admin,id:string,conversation:string,order:string,input:string,message:string) {
  const code=normalizeOtp(input);
  // Invalid formats count as an attempt too, avoiding unlimited guessing.
  const verified=await admin.rpc("verify_order_email_otp",{p_id:id,p_conversation:conversation,p_order:order,p_hash:await otpHash(id,conversation,order,code??"invalid"),p_message:message});
  if(verified.error)throw verified.error;
  return verified.data as {status:string;verifier?:string};
}
