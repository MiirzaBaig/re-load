import { NextRequest } from "next/server";
import { isOpaque, ZID_COOKIE } from "@/lib/zid/oauth-contract";
import { digest, statusPage, zidAdmin, zidConfig } from "@/lib/zid/oauth-server";
export const runtime="nodejs";
export async function GET(request:NextRequest){
  try{
    const config=zidConfig();
    const browser=request.cookies.get(ZID_COOKIE)?.value;
    if(request.nextUrl.origin!==config.origin||!isOpaque(browser))return statusPage("ابدأ اختبار الربط", "Start the connection test from this browser.",401);
    const {data,error}=await zidAdmin().rpc("get_zid_dev_oauth_result",{p_browser_hash:digest(browser)});
    if(error||!data?.[0])return statusPage("الربط لم يكتمل بعد", "No completed development connection is available in this browser. Retry if you cancelled authorization.",409);
    const result=data[0];
    const payment=result.payment_link_available===true ? "رابط الدفع متاح ضمن طرق الدفع. لم ننشئ رابط دفع بعد.\nPayment-link method is available. No payment link has been created." : result.payment_link_available===false ? "لم نجد طريقة دفع مفعّلة لرابط الدفع.\nNo enabled payment-link method was found." : "تعذر التحقق من طرق الدفع. نحتاج مراجعة الصلاحيات.\nPayment methods could not be verified. Check the granted permissions.";
    return statusPage("نجح اختبار ربط متجر التطوير",`${result.store_name}\nDevelopment-store authorization verified.\n\n${payment}\n\nهذه خطوة ربط تجريبية فقط؛ لم تغيّر ربط متجرك الحالي ولم تنشئ طلبًا أو عملية دفع.\nThis authorization step leaves your existing Reload connection unchanged and does not create an order or charge.`,200,process.env.ZID_DEV_CHECKOUT_ENABLED === "true" && result.payment_link_available === true);
  }catch{return statusPage("الاختبار غير متاح الآن", "The development connection is unavailable. Please retry later.",503);}
}
