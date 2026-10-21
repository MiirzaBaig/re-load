import { NextRequest, NextResponse } from "next/server";
import { digest, opaque, privateHeaders, statusPage, zidAdmin, zidConfig } from "@/lib/zid/oauth-server";
import { ZID_COOKIE, ZID_PATH } from "@/lib/zid/oauth-contract";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const config = zidConfig();
    if (request.nextUrl.origin !== config.origin) return statusPage("افتح رابط الاختبار الصحيح", "Please use the configured Reload development connection address.",400);
    if (request.headers.get("sec-fetch-site")==="cross-site" && request.headers.get("sec-fetch-mode")!=="navigate") return statusPage("تعذر بدء الاختبار", "Open the connection link directly in your browser.",403);
    const state=opaque(),browser=opaque();
    const {error}=await zidAdmin().rpc("create_zid_dev_oauth_attempt",{p_state_hash:digest(state),p_browser_hash:digest(browser)});
    if(error)throw new Error("zid_storage_unavailable");
    const url=new URL("https://oauth.zid.sa/oauth/authorize");
    url.search=new URLSearchParams({client_id:config.clientId,response_type:"code",redirect_uri:config.callback,state}).toString();
    const response=NextResponse.redirect(url,302);
    for(const [key,value] of Object.entries(privateHeaders))response.headers.set(key,value);
    response.cookies.set(ZID_COOKIE,browser,{httpOnly:true,secure:config.origin.startsWith("https:"),sameSite:"lax",path:ZID_PATH,maxAge:1800});
    return response;
  } catch { return statusPage("اختبار الربط غير جاهز بعد", "Development connection is not configured yet. No store has been connected or charged.",503); }
}
