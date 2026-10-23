import { escapeHtml as e } from "./oauth-contract";
import { privateHeaders } from "./oauth-server";
import { randomBytes } from "node:crypto";
export function checkoutPage(
  language: "ar" | "en",
  title: string,
  content: string,
  status = 200,
) {
  const ar = language === "ar",
    nonce = randomBytes(18).toString("base64");
  return new Response(
    `<!doctype html><html lang="${language}" dir="${ar ? "rtl" : "ltr"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(title)} · Reload</title><style>
:root{color-scheme:light dark;--bg:light-dark(#f8f7f4,#0f0f12);--card:light-dark(#fff,#19191d);--ink:light-dark(#0f0f12,#f8f7f4);--muted:light-dark(#5c5c65,#b7b7c1);--line:light-dark(#e7e9ef,#38383e)}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.7 system-ui,sans-serif;padding:24px}main{max-width:640px;margin:24px auto;padding:32px;background:var(--card);border:1px solid var(--line);border-radius:24px;min-width:0}header{display:flex;align-items:center;justify-content:space-between;gap:16px}header img{width:40px;height:40px}a{color:inherit;text-underline-offset:4px}h1{font-size:26px;line-height:1.4;margin:24px 0 12px}p{overflow-wrap:anywhere}small,.hint{display:block;color:var(--muted);font-size:13px}.badge{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:4px 12px;font-size:12px}.steps{display:flex;gap:8px;list-style:none;padding:0;flex-wrap:wrap;color:var(--muted);font-size:12px}.steps li{padding:4px 10px;border-radius:99px;background:var(--bg)}form{display:grid;gap:18px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;min-width:0}label{display:grid;gap:6px;min-width:0}input,select,button,.action{font:inherit;max-width:100%;min-width:0;border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:var(--ink);background:var(--card)}input,select{width:100%}input:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid #4557c7;outline-offset:3px}button,.action{cursor:pointer;background:var(--ink);color:var(--bg);text-align:center;text-decoration:none;display:block}.secondary{background:var(--card);color:var(--ink)}button:active,.action:active{transform:scale(.98)}button:disabled{opacity:.65;cursor:wait}.check{display:flex;align-items:flex-start;gap:10px}.check input{width:18px;flex-shrink:0;margin-top:5px}.note{padding:16px;border:1px solid var(--line);border-radius:16px;background:var(--bg)}.waiting{border-inline-start:3px solid #b07818}.error{border-inline-start:3px solid #d44949}.done{border-inline-start:3px solid #288455}dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}dt{color:var(--muted)}dd{margin:0;overflow-wrap:anywhere}.actions{display:grid;gap:12px;margin-top:24px}.live{font-size:13px;color:var(--muted);min-height:22px}.spinner{display:none;width:14px;height:14px;border:2px solid currentColor;border-inline-end-color:transparent;border-radius:50%;margin-inline-end:8px}form[aria-busy=true] .spinner{display:inline-block}@media(max-width:480px){body{padding:12px}main{padding:22px;margin:12px auto}.grid{grid-template-columns:minmax(0,1fr)}h1{font-size:23px}}@media(prefers-reduced-motion:no-preference){main{animation:enter .25s ease-out}button,.action{transition:transform .2s ease,opacity .2s ease}form[aria-busy=true] .spinner{animation:spin .8s linear infinite}@keyframes enter{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}@keyframes spin{to{transform:rotate(360deg)}}}</style>
<main><header><img src="/brand/reload-icon-192.png" alt="Reload"><a href="?lang=${ar ? "en" : "ar"}">${ar ? "English" : "العربية"}</a></header><p class="badge">${ar ? "اختبار متجر التطوير فقط" : "Development store test only"}</p><h1>${e(title)}</h1>${content}</main>
<script nonce="${nonce}">document.querySelectorAll('form').forEach(function(form){form.addEventListener('submit',function(event){if(form.getAttribute('aria-busy')==='true'){event.preventDefault();return;}form.setAttribute('aria-busy','true');var button=event.submitter;if(button){setTimeout(function(){button.disabled=true;},0);}var live=form.querySelector('[role=status]');if(live)live.textContent=${JSON.stringify(ar ? "جاري التحقق، خلك معنا…" : "Checking the details—one moment…")};});});window.addEventListener('pageshow',function(){document.querySelectorAll('form').forEach(function(f){f.removeAttribute('aria-busy');f.querySelectorAll('button').forEach(function(b){b.disabled=false;});});});</script></html>`,
    {
      status,
      headers: {
        ...privateHeaders,
        // Native form POSTs need a non-opaque Origin for our strict CSRF check.
        // Same-origin retains it locally while withholding referrers from other sites.
        "Referrer-Policy": "same-origin",
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          privateHeaders["Content-Security-Policy"] +
          `; script-src 'nonce-${nonce}'`,
      },
    },
  );
}
export const checkoutMessages: Record<string, [string, string]> = {
  disabled: [
    "اختبار الدفع غير مفعّل بعد. فريق ريلود يجهّز الخطوة التالية.",
    "Checkout testing is not enabled yet. Reload is preparing the next step.",
  ],
  session_expired: [
    "انتهت جلسة الاختبار. أعد ربط متجر التطوير للمتابعة.",
    "This test session has expired. Reconnect your development store to continue.",
  ],
  invalid_request: [
    "تعذر تأكيد هذا الطلب. افتح صفحة الاختبار من نفس المتصفح وحاول مجددًا.",
    "We couldn’t verify this request. Open the test page in the same browser and try again.",
  ],
  validation_failed: [
    "زد لم يقبل التفاصيل. راجع بيانات التواصل والعنوان وخدمة التوصيل قبل إعادة التحقق.",
    "Zid didn’t accept these details. Check the contact information, address and delivery service before validating again.",
  ],
  permission_required: [
    "نحتاج مراجعة صلاحيات التطبيق في زد. ما راح نعيد إنشاء الطلب تلقائيًا.",
    "The Zid app permissions need checking. We won’t automatically repeat order creation.",
  ],
  product_unavailable: [
    "المنتج أو الكمية غير متاح الآن. اختر منتجًا آخر أو قلّل الكمية.",
    "This product or quantity isn’t available now. Choose another product or reduce the quantity.",
  ],
  shipping_unavailable: [
    "خدمة التوصيل غير متاحة. راجع إعداداتها في متجر التطوير.",
    "The delivery service isn’t available. Check its development-store settings.",
  ],
  selection_changed: [
    "تغيّر السعر أو المخزون. راجع اختيارك وتحقق منه مرة ثانية.",
    "The price or stock changed. Review your selection and validate it again.",
  ],
  review_expired: [
    "انتهت صلاحية المراجعة. تحقق من التفاصيل مرة ثانية قبل الإنشاء.",
    "This review has expired. Validate the details again before creating an order.",
  ],
  already_started: [
    "هذه المحاولة بدأت بالفعل. راجع حالتها هنا قبل أي محاولة جديدة.",
    "This attempt has already started. Check its status here before trying again.",
  ],
  payment_unavailable: [
    "طريقة رابط الدفع غير متاحة في هذا المتجر.",
    "The payment-link method isn’t available for this store.",
  ],
  provider_unknown: [
    "تعذر التواصل مع زد الآن. إذا أكدت إنشاء طلب، راجع حالته قبل بدء محاولة أخرى.",
    "We couldn’t reach Zid just now. If you already confirmed an order, check its status before starting another attempt.",
  ],
  storage_unavailable: [
    "تعذر حفظ التقدم الآن. ما راح نكرر إنشاء الطلب تلقائيًا.",
    "We couldn’t save progress right now. We won’t automatically repeat order creation.",
  ],
  invalid_details: [
    "راجع الحقول وأدخل رقم جوال سعودي وبريدًا تملكهما أو لديك إذن باستخدامهما، ثم وافق على تنبيهات الاختبار.",
    "Check the fields, enter a Saudi phone number and email you control or have permission to use, and confirm test notifications.",
  ],
};
