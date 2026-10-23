import { escapeHtml as e } from "./oauth-contract";
import { privateHeaders } from "./oauth-server";
import { randomBytes } from "node:crypto";
import { checkoutStyle } from "./checkout-style";
import { checkoutScript } from "./checkout-interactions";
import type { readCheckoutResult } from "./checkout-server";

export function checkoutIcon(
  name:
    | "bag"
    | "check"
    | "info"
    | "clock"
    | "lock"
    | "chevron"
    | "store"
    | "globe" = "info",
) {
  const paths = {
    bag: '<path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    store:
      '<path d="M4 10v10h16V10M3 4h18l1 6a3 3 0 0 1-5 2 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5-2l1-6Z"/><path d="M9 20v-6h6v6"/>',
    globe:
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18Z"/>',
  };
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}
export function checkoutNotice(
  kind: "error" | "waiting" | "done" | "info",
  title: string,
  body: string,
  alert = false,
) {
  return `<div class="notice ${kind}" ${alert ? 'role="alert" tabindex="-1"' : ""}>${checkoutIcon(kind === "done" ? "check" : kind === "waiting" ? "clock" : "info")}<div><strong class="notice-title">${e(title)}</strong><p>${e(body)}</p></div></div>`;
}
export function checkoutSteps(language: "ar" | "en", current: number) {
  const labels =
    language === "ar"
      ? ["التفاصيل", "المراجعة", "الدفع"]
      : ["Details", "Review", "Payment"];
  return `<nav aria-label="${language === "ar" ? "خطوات الطلب" : "Order steps"}"><ol class="steps">${labels.map((label, index) => `<li ${current === index + 1 ? 'aria-current="step"' : ""} data-done="${current > index + 1}"><span class="step-number" aria-hidden="true">${current > index + 1 ? checkoutIcon("check") : index + 1}</span><span>${label}</span>${index < 2 ? '<span class="step-line" aria-hidden="true"></span>' : ""}</li>`).join("")}</ol></nav>`;
}

export function checkoutEvidence(
  language: "ar" | "en",
  result: NonNullable<Awaited<ReturnType<typeof readCheckoutResult>>>,
) {
  const ar = language === "ar";
  const t = (arabic: string, english: string) => (ar ? arabic : english);
  const number = (amount: number) =>
    new Intl.NumberFormat(ar ? "ar-SA" : "en-SA", {
      maximumFractionDigits: 2,
    }).format(amount);
  const rows = result.invoice
    .map((row: { kind: string; amount: number }) => {
      const label =
        row.kind === "vat"
          ? t("الضريبة حسب زد", "VAT reported by Zid")
          : row.kind === "subtotal"
            ? t(
                "القيمة قبل الضريبة حسب زد",
                "Subtotal before VAT reported by Zid",
              )
            : t("إجمالي الفاتورة حسب زد", "Invoice total reported by Zid");
      return `<dt>${label}</dt><dd>${e(number(row.amount))} ${t("ر.س", "SAR")}</dd>`;
    })
    .join("");
  const stock = (sample: typeof result.stockBefore) =>
    !sample
      ? t("غير متاح", "Not available")
      : sample.unlimited
        ? t("غير محدود", "Unlimited")
        : e(number(sample.quantity));
  const deadline = result.requestedExpiry
    ? new Intl.DateTimeFormat(ar ? "ar-SA-u-ca-gregory" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Riyadh",
      }).format(new Date(result.requestedExpiry))
    : t("غير متاح", "Not available");
  return `<details class="evidence"><summary>${t("تفاصيل التحقق", "Verification details")}${checkoutIcon("chevron")}</summary><dl>${rows}<dt>${t("موعد انتهاء الدفع المطلوب", "Requested payment deadline")}</dt><dd>${e(deadline)} ${t("بتوقيت السعودية", "Saudi time")}</dd><dt>${t("نوع الشراء حسب زد", "Customer type reported by Zid")}</dt><dd>${result.guest === true ? t("ضيف", "Guest") : result.guest === false ? t("عميل مسجّل", "Registered customer") : t("لم يُحدّد", "Not reported")}</dd><dt>${t("المخزون قبل إنشاء الطلب", "Stock before order creation")}</dt><dd>${stock(result.stockBefore)}</dd><dt>${t("المخزون عند آخر تحقق", "Stock at this check")}</dt><dd>${stock(result.stockAfter)}</dd></dl><p class="hint">${t("موعد الانتهاء هو الموعد الذي طلبناه من زد؛ يلزم التأكد من تطبيقه في صفحة الدفع. تغيّر المخزون وحده لا يثبت حجز المنتج لهذا الطلب. راجع رسوم التوصيل والتفاصيل الكاملة في صفحة الدفع.", "The deadline is what we requested from Zid; its behaviour still needs checking on the payment page. A stock change alone does not prove this order reserved the item. Review delivery charges and the full breakdown on the payment page.")}</p></details>`;
}
export function checkoutPage(
  language: "ar" | "en",
  title: string,
  content: string,
  status = 200,
) {
  const ar = language === "ar",
    nonce = randomBytes(18).toString("base64");
  return new Response(
    `<!doctype html><html lang="${language}" dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(title)} · Reload</title><style>${checkoutStyle}</style></head><body><main><header><div class="brand"><img src="/brand/reload-icon-192.png" alt="">Reload</div><a class="language" data-language="${ar ? "en" : "ar"}" href="?lang=${ar ? "en" : "ar"}">${checkoutIcon("globe")}${ar ? "English" : "العربية"}</a></header><article class="card"><p class="eyebrow">${ar ? "اختبار متجر التطوير فقط" : "Development store test only"}</p><h1>${e(title)}</h1>${content}</article><p class="privacy">${checkoutIcon("lock")}${ar ? "اختبار خاص · بيانات التواصل محمية" : "Private test · Contact details protected"}</p></main><script nonce="${nonce}">${checkoutScript(ar)}</script></body></html>`,
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
          `; font-src 'self'; script-src 'nonce-${nonce}'`,
      },
    },
  );
}
export const checkoutMessages: Record<string, [string, string]> = {
  address_details_required: [
    "زد يحتاج تفاصيل إضافية للعنوان. أضف رقم المبنى أو الحي أو الشقة في حقل «تفاصيل العنوان»، ثم تحقق مجددًا.",
    "Zid needs a second address line. Add your building, district or apartment in Address details, then validate again.",
  ],
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
    "تعذر تأكيد رد زد. إذا سبق أن أكدت إنشاء الطلب، لا تبدأ محاولة أخرى حتى تُراجع النتيجة.",
    "We couldn’t confirm Zid’s response. If you already confirmed order creation, don’t start another attempt until it is checked.",
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
