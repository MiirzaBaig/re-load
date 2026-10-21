import test from "node:test";
import assert from "node:assert/strict";
import { createDecipheriv } from "node:crypto";
import { NextRequest } from "next/server";
import { GET as connect } from "../src/app/api/integrations/zid/connect/route";
import { GET as callback } from "../src/app/api/integrations/zid/callback/route";
import { GET as status } from "../src/app/api/integrations/zid/status/route";
import { callbackAddress, escapeHtml, parseTokens, paymentCapability, storeIdentity, ZID_COOKIE } from "../src/lib/zid/oauth-contract";
import { digest, sealTokens } from "../src/lib/zid/oauth-server";
const origin="https://reload-test.example";
const key=Buffer.alloc(32,7).toString("base64");
Object.assign(process.env,{ZID_DEV_OAUTH_ENABLED:"true",ZID_CLIENT_ID:"8022",ZID_CLIENT_SECRET:"test-client-secret",ZID_OAUTH_ORIGIN:origin,ZID_DEV_STORE_IDS:"3258532",ZID_DEV_ENCRYPTION_KEY:key,NEXT_PUBLIC_SUPABASE_URL:"https://database.invalid",SUPABASE_SECRET_KEY:"test-server-key"});
const tokens={authorization:"provider-authorization",access_token:"store-manager-token",refresh_token:"refresh-token",expires_in:3600};
const state="a".repeat(43),browser="b".repeat(43);
function request(path:string,withCookie=true){return new NextRequest(origin+path,{headers:withCookie?{cookie:`${ZID_COOKIE}=${browser}`}:{}});}
const cb=()=>request(`/api/integrations/zid/callback?code=one-use-code&state=${state}`);
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const realFetch=globalThis.fetch;
async function runMock(work:()=>Promise<void>,options:{claim?:boolean;store?:string;payment?:number;finish?:boolean;exchange?:number}={}){
 const requests:Array<{url:string;body:Record<string,unknown>}>=[];
 globalThis.fetch=async(input,init)=>{
  const url=String(input);const body=String(init?.body||"");
  requests.push({url,body:body.startsWith("{")?JSON.parse(body):Object.fromEntries(new URLSearchParams(body))});
  if(url.includes("create_zid_dev_oauth_attempt"))return json(null);
  if(url.includes("claim_zid_dev_oauth_attempt"))return json(options.claim??true);
  if(url.includes("finish_zid_dev_oauth_attempt"))return json(options.finish??true);
  if(url.includes("fail_zid_dev_oauth_attempt"))return json(null);
  if(url.includes("get_zid_dev_oauth_result"))return json([{store_name:"testing-z",payment_link_available:true}]);
  if(url==="https://oauth.zid.sa/oauth/token")return json(tokens,options.exchange??200);
  if(url.endsWith("/account/store"))return json({store:{id:options.store||3258532,title:"testing-z",email:"private@example.com"}});
  if(url.endsWith("/payment-methods"))return json({payload:[{enabled:true,code:"payment_link.zidpay",id:12}]},options.payment??200);
  throw new Error("Unexpected network request");
 };
 try{await work();return requests;}finally{globalThis.fetch=realFetch;}
}
test("connect redirects straight to OAuth with a private browser cookie and registered callback",async()=>{
 await runMock(async()=>{
  const res=await connect(request("/api/integrations/zid/connect"));assert.equal(res.status,302);
  const target=new URL(res.headers.get("location")!);assert.equal(target.origin,"https://oauth.zid.sa");
  assert.equal(target.searchParams.get("client_id"),"8022");assert.equal(target.searchParams.get("redirect_uri"),origin+"/api/integrations/zid/callback");
  assert.match(target.searchParams.get("state")!,/^[A-Za-z0-9_-]{43}$/);assert.equal(target.searchParams.has("client_secret"),false);
  const cookie=res.headers.get("set-cookie")!;assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=lax/i);
  assert.equal(res.headers.get("referrer-policy"),"no-referrer");
 });
});
test("callback claims once before exchange, checks store, encrypts credentials and cleans the browser URL",async()=>{
 const calls=await runMock(async()=>{const res=await callback(cb());assert.equal(res.status,303);assert.equal(res.headers.get("location"),origin+"/api/integrations/zid/status");});
 assert.match(calls[0].url,/claim_zid/);assert.equal(calls.filter(c=>c.url.includes("oauth/token")).length,1);
 const exchange=calls.find(c=>c.url.includes("oauth/token"))!;assert.equal(exchange.body.code,"one-use-code");
 const finish=calls.find(c=>c.url.includes("finish_zid"))!;assert.equal(finish.body.p_external_store_id,"3258532");
 assert.equal(finish.body.p_payment_link_available,true);assert(!JSON.stringify(finish.body).includes(tokens.refresh_token));
 assert(calls.every(c=>!c.url.includes("/drafts")&&!c.url.includes("commerce_connections")));
});
test("missing browser proof and invalid state never reach database or token exchange",async()=>{
 const calls=await runMock(async()=>{
  assert.equal((await callback(request(`/api/integrations/zid/callback?code=x&state=${state}`,false))).status,400);
  assert.equal((await callback(request("/api/integrations/zid/callback?code=x&state=bad"))).status,400);
 });assert.equal(calls.length,0);
});
test("replayed/expired state does not exchange a code",async()=>{
 const calls=await runMock(async()=>{assert.equal((await callback(cb())).status,409);},{claim:false});assert.equal(calls.length,1);
});
test("wrong store is rejected before payment lookup and never persisted",async()=>{
 const calls=await runMock(async()=>{assert.equal((await callback(cb())).status,502);},{store:"999"});
 assert(!calls.some(c=>c.url.includes("payment-methods")||c.url.includes("finish_zid")));
 assert(calls.some(c=>c.url.includes("fail_zid")));
});
test("unreadable payment methods remain unknown and do not become a false capability",async()=>{
 const calls=await runMock(async()=>{assert.equal((await callback(cb())).status,303);},{payment:403});
 assert.equal(calls.find(c=>c.url.includes("finish_zid"))!.body.p_payment_link_available,null);
});
test("token exchange failure is not retried and no provider error leaks to the page",async()=>{
 const calls=await runMock(async()=>{const res=await callback(cb());assert.equal(res.status,502);assert(!(await res.text()).includes(tokens.authorization));},{exchange:503});
 assert.equal(calls.filter(c=>c.url.includes("oauth/token")).length,1);assert(!calls.some(c=>c.url.includes("finish_zid")));
});
test("failed persistence does not show success",async()=>{
 await runMock(async()=>{assert.equal((await callback(cb())).status,502);},{finish:false});
});
test("status never exposes token fields, has no analytics, and requires browser possession",async()=>{
 const calls=await runMock(async()=>{
  const res=await status(request("/api/integrations/zid/status"));const html=await res.text();
  assert.equal(res.status,200);assert(html.includes("testing-z"));assert(!html.includes("<script")&&!html.includes(tokens.access_token));
  assert.equal(res.headers.get("cache-control"),"private, no-store, max-age=0");assert.match(res.headers.get("x-robots-tag")!,/noindex/);
  assert.equal((await status(request("/api/integrations/zid/status",false))).status,401);
 });assert.equal(calls.length,1);assert.equal(calls[0].body.p_browser_hash,digest(browser));
});
test("disabled development mode and wrong host never contact provider",async()=>{
 const calls=await runMock(async()=>{
  process.env.ZID_DEV_OAUTH_ENABLED="false";assert.equal((await connect(request("/api/integrations/zid/connect"))).status,503);process.env.ZID_DEV_OAUTH_ENABLED="true";
  assert.equal((await connect(new NextRequest("https://evil.example/api/integrations/zid/connect"))).status,400);
 });assert.equal(calls.length,0);
});
test("encryption binds the token record to its own attempt",()=>{
 const parsed=parseTokens(tokens);const sealed=sealTokens(parsed,"attempt-a",key);
 const [,iv,tag,content]=sealed.split(".");
 function open(aad:string){const decipher=createDecipheriv("aes-256-gcm",Buffer.from(key,"base64"),Buffer.from(iv,"base64"));decipher.setAAD(Buffer.from(aad));decipher.setAuthTag(Buffer.from(tag,"base64"));return Buffer.concat([decipher.update(Buffer.from(content,"base64")),decipher.final()]).toString();}
 assert.deepEqual(JSON.parse(open("attempt-a")),parsed);assert.throws(()=>open("attempt-b"));assert(!sealed.includes(tokens.authorization));
});
test("provider contracts fail closed on guessed identity, wrong types, invalid expiry and payment flags",()=>{
 for(const row of [{},null,{...tokens,expires_in:"3600"},{...tokens,expires_in:0},{...tokens,access_token:"bad\nheader"}])assert.throws(()=>parseTokens(row));
 assert.throws(()=>storeIdentity({id:3258532},["3258532"]));assert.throws(()=>storeIdentity({store:{id:999}},["3258532"]));
 assert.equal(paymentCapability({payload:[{enabled:"true",code:"payment_link.zidpay",id:1}]}),false);
 assert.equal(paymentCapability({payload:[]}),false);assert.throws(()=>paymentCapability({}));
 for(const origin of ["http://evil.example","https://user:pass@shop.example","https://shop.example/redirect","https://shop.example/?next=x"])assert.throws(()=>callbackAddress(origin));
 assert.equal(escapeHtml('<script>"x"</script>'),"&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
});
