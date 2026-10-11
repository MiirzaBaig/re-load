import { generateOtp, normalizeOtp, otpHash, maskOrderEmail, validOrderEmail, otpEmail } from "../_shared/email-otp.ts";
function assert(value: unknown): asserts value { if (!value) throw new Error("Assertion failed"); }
Deno.test("OTP accepts six digits including Arabic numerals but no surrounding prose",()=>{
 assert(normalizeOtp(" ٠١٢٣٤٥ ") === "012345"); assert(normalizeOtp("۰۱۲۳۴۵") === "012345");
 for(const invalid of ["12345","1234567","code 123456","1e0000",""])assert(normalizeOtp(invalid) === null);
 for(let i=0;i<100;i++)assert(/^\d{6}$/.test(generateOtp()));
});
Deno.test("OTP hashes are bound to challenge, conversation and order",async()=>{
 const before=Deno.env.get("OTP_HASH_SECRET"); Deno.env.set("OTP_HASH_SECRET","test-only-otp-secret");
 try {
 const hash=await otpHash("a","b","c","012345");
 assert(hash === await otpHash("a","b","c","012345"));
 for(const args of [["x","b","c","012345"],["a","x","c","012345"],["a","b","x","012345"],["a","b","c","999999"]])assert(hash !== await otpHash(...args as [string,string,string,string]));
 }finally{if(before)Deno.env.set("OTP_HASH_SECRET",before);else Deno.env.delete("OTP_HASH_SECRET");}
});
Deno.test("OTP email validates contacts, masks address and escapes merchant content",()=>{
 assert(validOrderEmail(" Ahmed@Example.com ") === "ahmed@example.com");
 for(const bad of [null,"","no-email","a@b.com\r\nBcc: x@example.com","<a@b.com>"])assert(validOrderEmail(bad) === null);
 assert(maskOrderEmail("ahmed@example.com") === "a•••@e•••.com");
 for(const lang of ["ar","en"] as const){const mail=otpEmail("012345","<script>alert(1)</script>",lang);assert(mail.text.includes("012345"));assert(!mail.html.includes("<script>"));assert(mail.html.includes("&lt;script&gt;"));assert(mail.html.includes(`dir="${lang==='ar'?'rtl':'ltr'}"`));}
});

Deno.test("provider rejection cannot be treated as a sent code and retries use idempotency",async()=>{
 const {deliverOtpEmail}=await import("../_shared/email-otp.ts");
 const original=globalThis.fetch;const key=Deno.env.get("RESEND_API_KEY");Deno.env.set("RESEND_API_KEY","test-key");
 let requests=0;
 globalThis.fetch=async(_url,init)=>{
   const headers=new Headers(init?.headers);assert(headers.get("Idempotency-Key") === "order-otp/challenge");
   const body=JSON.parse(String(init?.body));assert(body.to[0] === "ahmed@example.com");assert(body.from === "Reload <no-reply@notify.reload.sa>");
   requests++;return requests===1?new Response(JSON.stringify({message:"rejected"}),{status:403}):new Response(JSON.stringify({id:"receipt"}),{status:200});
 };
 try {assert(!(await deliverOtpEmail("challenge","ahmed@example.com","012345","Nova","en")).ok);assert((await deliverOtpEmail("challenge","ahmed@example.com","012345","Nova","en")).ok);}
 finally{globalThis.fetch=original;if(key)Deno.env.set("RESEND_API_KEY",key);else Deno.env.delete("RESEND_API_KEY");}
});
