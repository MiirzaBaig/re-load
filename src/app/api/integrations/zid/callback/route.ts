import { NextRequest, NextResponse } from "next/server";
import { isOpaque, ZID_COOKIE, ZID_PATH } from "@/lib/zid/oauth-contract";
import { digest, exchangeZidCode, inspectZidStore, privateHeaders, sealTokens, statusPage, zidAdmin, zidConfig } from "@/lib/zid/oauth-server";
export const runtime="nodejs";
export async function GET(request: NextRequest) {
  let stateHash:string|undefined,browserHash:string|undefined;
  try {
    const config=zidConfig();
    if(request.nextUrl.origin!==config.origin)return statusPage("تعذر تأكيد الربط", "Use the same browser and the configured connection address.",400);
    const state=request.nextUrl.searchParams.get("state"),browser=request.cookies.get(ZID_COOKIE)?.value;
    const code=request.nextUrl.searchParams.get("code");
    if(!isOpaque(state)||!isOpaque(browser)||!code||code.length>4096||/[\r\n]/.test(code)||request.nextUrl.searchParams.has("error"))return statusPage("لم يكتمل الربط", "No authorization was completed. Retry from the same browser. No purchase was made.",400);
    stateHash=digest(state);browserHash=digest(browser);
    const admin=zidAdmin();
    const claimed=await admin.rpc("claim_zid_dev_oauth_attempt",{p_state_hash:stateHash,p_browser_hash:browserHash});
    if(claimed.error||claimed.data!==true)return statusPage("انتهت صلاحية محاولة الربط", "This attempt expired or was already used. Start a fresh connection; no code will be reused.",409);
    // Exchange once synchronously; uncertain or failed exchanges require a fresh authorization.
    const tokens=await exchangeZidCode(code,config);
    const store=await inspectZidStore(tokens,config.allowed);
    const saved=await admin.rpc("finish_zid_dev_oauth_attempt",{p_state_hash:stateHash,p_browser_hash:browserHash,p_external_store_id:store.id,p_store_name:store.name,p_payment_link_available:store.paymentLinkAvailable,p_token_ciphertext:sealTokens(tokens,stateHash,config.key)});
    if(saved.error||saved.data!==true)throw new Error("zid_storage_unavailable");
    const response=NextResponse.redirect(new URL(`${ZID_PATH}/status`,config.origin),303);
    for(const [key,value] of Object.entries(privateHeaders))response.headers.set(key,value);
    return response;
  }catch{
    if(stateHash&&browserHash){try{await zidAdmin().rpc("fail_zid_dev_oauth_attempt",{p_state_hash:stateHash,p_browser_hash:browserHash});}catch{/* Preserve a sanitized failure response even if storage is down. */}}
    return statusPage("تعذر إكمال اختبار الربط", "The development connection could not be verified. Check app permissions and retry with the testing store. No purchase was made.",502);
  }
}
