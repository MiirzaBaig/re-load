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
  const html=`<!doctype html><html lang="${language}" dir="${ar?'rtl':'ltr'}"><body style="margin:0;background:#F8F7F4;font-family:Arial,sans-serif;color:#0F0F12"><div style="max-width:480px;margin:32px auto;padding:32px;background:#fff;border:1px solid #E7E9EF;border-radius:16px"><p style="font-size:20px;font-weight:bold">Reload</p><h1 style="font-size:22px">${ar?'رمز التحقق لطلبك':'Verify your order'}</h1><p>${ar?'متجرك:':'Your store:'} ${escape(storeName)}</p><p dir="ltr" style="font-size:36px;font-weight:bold;letter-spacing:8px;text-align:center">${code}</p><p style="line-height:1.8">${escape(text.split('\n\n')[1]).replace(/\n/g,'<br>')}</p></div></body></html>`;
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
