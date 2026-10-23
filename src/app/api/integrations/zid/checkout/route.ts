import { NextRequest, NextResponse } from "next/server";
import {
  ZID_COOKIE,
  ZID_PATH,
  escapeHtml as e,
} from "@/lib/zid/oauth-contract";
import { privateHeaders } from "@/lib/zid/oauth-server";
import { checkoutMessages, checkoutPage } from "@/lib/zid/checkout-page";
import {
  CheckoutError,
  checkoutSession,
  checkoutOptions,
  checkoutDraft,
  csrfFor,
  createCheckout,
  prepareCheckout,
  readCheckoutResult,
  verifyCheckoutPost,
} from "@/lib/zid/checkout-server";
export const runtime = "nodejs";
const path = `${ZID_PATH}/checkout`;
export async function GET(request: NextRequest) {
  return renderCheckout(request);
}
async function renderCheckout(request: NextRequest, submitted?: FormData) {
  const language =
      request.nextUrl.searchParams.get("lang") === "en" ? "en" : "ar",
    ar = language === "ar";
  const t = (arabic: string, english: string) => (ar ? arabic : english);
  let hasCreatedOrder = false;
  try {
    const browser = request.cookies.get(ZID_COOKIE)?.value ?? "",
      ctx = await checkoutSession(browser);
    if (request.nextUrl.origin !== ctx.config.origin)
      throw new CheckoutError("invalid_request", 403);
    const error = request.nextUrl.searchParams.get("error");
    const warning =
      error && checkoutMessages[error]
        ? `<p role="alert" class="note error">${e(checkoutMessages[error][ar ? 0 : 1])}</p>`
        : "";
    const fields = (action: string) =>
      `<input type="hidden" name="csrf" value="${csrfFor(browser)}"><input type="hidden" name="lang" value="${language}"><input type="hidden" name="action" value="${action}">`;
    const job = ctx.session.checkout;
    hasCreatedOrder = job?.state === "CREATED";
    const intro = `<p>${e(ctx.session.store_name)}</p><ol class="steps"><li>${t("1 · اختر وأضف التفاصيل", "1 · Choose and add details")}</li><li>${t("2 · راجع وأكّد", "2 · Review and confirm")}</li><li>${t("3 · راجع الدفع", "3 · Check payment")}</li></ol>${warning}`;
    if (job && ["CREATING", "UNKNOWN"].includes(job.state))
      return checkoutPage(
        language,
        t("نتحقق من نتيجة المحاولة", "Checking this attempt"),
        intro +
          `<p class="note waiting">${t("قد يكون الطلب وصل إلى زد. لا تنشئ محاولة أخرى. راجع طلبات متجر التطوير مع فريق ريلود قبل المتابعة.", "Zid may have received this order. Don’t start another attempt. Check the development-store orders with Reload before continuing.")}</p><a href="?lang=${language}">${t("تحديث الحالة", "Refresh status")}</a>`,
      );
    if (job?.state === "CREATED") {
      const result = await readCheckoutResult(ctx, true);
      return checkoutPage(
        language,
        t("تم إنشاء طلب الاختبار", "Test order created"),
        intro +
          `<p class="note done">${t("تم إنشاء الطلب فقط. إنشاء الرابط أو فتحه لا يعني أن الدفع تم.", "The order has been created. Creating or opening a link does not mean payment is complete.")}</p><dl><dt>${t("إجمالي زد", "Zid total")}</dt><dd>${e(String(result?.total))} SAR</dd><dt>${t("حالة الدفع", "Payment status")}</dt><dd>${result?.payment === "paid" ? t("مدفوع — حسب زد", "Paid — reported by Zid") : result?.payment === "pending" ? t("بانتظار الدفع", "Waiting for payment") : t("لم يتم التأكد", "Not confirmed")}</dd></dl><p class="hint">${t("راجع تفصيل الضريبة والتوصيل في صفحة الدفع. لا تستخدم بطاقة حقيقية قبل تأكيد وسائل الاختبار مع زد.", "Review the tax and delivery breakdown on the payment page. Don’t use a real card until Zid confirms the supported test payment method.")}</p><div class="actions">${result?.payment === "paid" ? `<p class="note done">${t("زد يؤكد أن الطلب مدفوع. لم يحجز ريلود أي شحنة.", "Zid reports this order as paid. Reload hasn’t booked a shipment.")}</p>` : result?.link ? `<a class="action" href="${e(result.link)}" rel="noreferrer">${t("افتح صفحة الدفع الآمنة", "Open secure payment page")}</a>` : `<p class="note waiting">${result?.expired ? t("انتهت صلاحية الرابط. لن ننشئ طلبًا جديدًا تلقائيًا.", "The link has expired. We won’t automatically create another order.") : t("الرابط غير متاح هنا. راجع الطلب في زد مع فريق ريلود.", "The link isn’t available here. Check the order in Zid with Reload.")}</p>`}<a class="action secondary" href="?lang=${language}&refresh=1">${t("تحقق من حالة الدفع في زد", "Check payment status with Zid")}</a></div>`,
      );
    }
    if (
      job?.state === "READY" &&
      Date.parse(job.expires_at) > Date.now() &&
      request.nextUrl.searchParams.get("edit") !== "1"
    ) {
      const summary = job.summary;
      return checkoutPage(
        language,
        t("راجع اختيارك قبل الإنشاء", "Review before creating"),
        intro +
          `<p class="note waiting">${t("زد قبل تفاصيل الطلب. ما أنشأنا طلبًا أو رابطًا بعد.", "Zid accepted the order details. No order or payment link has been created yet.")}</p><dl><dt>${t("المنتج", "Product")}</dt><dd>${e(String(ar ? (summary.productAr ?? summary.product) : summary.product))}</dd><dt>${t("الكمية", "Quantity")}</dt><dd>${e(String(summary.quantity))}</dd><dt>${t("قيمة المنتجات", "Item subtotal")}</dt><dd>${e(String(summary.itemsTotal))} SAR</dd><dt>${t("التوصيل", "Delivery")}</dt><dd>${e(String(summary.shipping))}</dd><dt>${t("جوال ينتهي بـ", "Phone ending in")}</dt><dd>••${e(String(summary.phoneEnding))}</dd></dl><p class="hint">${t("قيمة المنتجات ليست الإجمالي النهائي. زد يحسب الضريبة والتوصيل؛ راجع الإجمالي في صفحة الدفع قبل أي دفع.", "The item subtotal is not the final total. Zid calculates tax and delivery; review the final total on its payment page before paying.")}</p><form method="post" action="${path}">${fields("create")}<input type="hidden" name="revision" value="${e(job.revision)}"><label class="check"><input type="checkbox" name="confirm" value="yes" required><span>${t("أوافق على إنشاء طلب غير مدفوع في متجر التطوير. قد يرسل زد إشعارات لبيانات الاختبار التي أدخلتها.", "I confirm creation of an unpaid order in the development store. Zid may notify the test contact details I entered.")}</span></label><button><span class="spinner" aria-hidden="true"></span>${t("أنشئ طلب الاختبار ورابطه", "Create test order and link")}</button><span class="live" role="status" aria-live="polite"></span></form><a href="?lang=${language}&edit=1">${t("تعديل التفاصيل", "Edit details")}</a>`,
      );
    }
    const expiredReview =
      job?.state === "READY" && Date.parse(job.expires_at) <= Date.now()
        ? `<p class="note waiting">${t("انتهت صلاحية المراجعة. أدخل التفاصيل للتحقق مجددًا؛ لم ننشئ طلبًا.", "The review expired. Enter the details to validate again; no order was created.")}</p>`
        : "";
    const options = await checkoutOptions(ctx);
    if (!options.products.length || !options.shipping.length)
      throw new CheckoutError(
        !options.products.length
          ? "product_unavailable"
          : "shipping_unavailable",
        409,
      );
    submitted ??= checkoutDraft(ctx);
    const remembered = (name: string) =>
      e(String(submitted?.get(name) ?? "").slice(0, 200));
    const input = (
      name: string,
      label: string,
      type = "text",
      max = 100,
      help = "",
    ) =>
      `<label>${e(label)}<input name="${name}" type="${type}" value="${remembered(name)}" maxlength="${max}" required ${["email", "phone"].includes(name) ? 'dir="ltr"' : ""}>${help ? `<small>${e(help)}</small>` : ""}</label>`;
    return checkoutPage(
      language,
      t("جرّب إنشاء رابط دفع", "Test a payment link"),
      intro +
        expiredReview +
        `<p class="note">${t("هذا اختبار داخلي لمتجر testing-z فقط. لن نفعّل شراء العملاء أو الشحن. استخدم بيانات تملكها؛ قد يرسل زد إشعارات.", "This is an internal testing-z check. Customer purchasing and shipping stay disabled. Use contact details you control; Zid may send notifications.")}</p><form method="post" action="${path}">${fields("validate")}<label>${t("اختر منتجًا متوفرًا", "Choose an available product")}<select name="product" required><option value="">${t("اختر المنتج", "Choose a product")}</option>${options.products.map((p) => `<option value="${e(p.id)}" ${submitted?.get("product") === p.id ? "selected" : ""}>${e(ar ? p.nameAr : p.name)} · ${p.price.toFixed(2)} SAR</option>`).join("")}</select><small>${t("نعرض منتجات بسيطة ومتوفرة من أول صفحة. المنتجات ذات الخيارات تحتاج اختبارًا منفصلًا.", "Shows available simple products from the first page. Products with options need separate testing.")}</small></label><div class="grid"><label>${t("الكمية", "Quantity")}<input name="quantity" type="number" min="1" max="20" value="${remembered("quantity") || "1"}" required></label><label>${t("خدمة التوصيل", "Delivery service")}<select name="shipping" required>${options.shipping.map((s: any) => `<option value="${e(s.id)}" ${submitted?.get("shipping") === s.id ? "selected" : ""}>${e(s.name)}</option>`).join("")}</select></label></div>${input("name", t("اسم مستلم الاختبار", "Test recipient name"))}<div class="grid">${input("email", t("بريد الاختبار", "Test email"), "email", 160)}${input("phone", t("جوال الاختبار السعودي", "Saudi test phone"), "tel", 18, t("مثال التنسيق: 05xxxxxxxx", "Format: 05xxxxxxxx"))}</div>${input("city", t("المدينة", "City"), "text", 80)}${input("address", t("عنوان الاختبار", "Test address"), "text", 200)}<label class="check"><input name="consent" type="checkbox" value="yes" required><span>${t("أملك بيانات التواصل هذه أو لدي إذن باستخدامها، وأوافق على إشعارات الاختبار.", "I control these contact details or have permission to use them, and agree to test notifications.")}</span></label><button><span class="spinner" aria-hidden="true"></span>${t("تحقق من التفاصيل", "Validate details")}</button><span class="live" role="status" aria-live="polite"></span><small>${t("هذه الخطوة لا تنشئ طلبًا ولا تأخذ دفعة.", "This step doesn’t create an order or take payment.")}</small></form>`,
    );
  } catch (error) {
    const code =
      error instanceof CheckoutError ? error.code : "provider_unknown";
    return checkoutPage(
      language,
      t("نحتاج خطوة قبل المتابعة", "One step before continuing"),
      `<p class="note ${code === "disabled" || code === "session_expired" ? "waiting" : "error"}">${e((checkoutMessages[code] ?? checkoutMessages.provider_unknown)[ar ? 0 : 1])}</p>${hasCreatedOrder ? `<p>${t("طلب الاختبار محفوظ. لا تنشئ طلبًا آخر؛ أعد التحقق من حالته أو راجعه في زد.", "Your test order is saved. Don’t create another order; check its status again or review it in Zid.")}</p><a href="?lang=${language}">${t("أعد التحقق من الحالة", "Check status again")}</a>` : `<a href="${ZID_PATH}/connect">${t("أعد ربط متجر التطوير", "Reconnect development store")}</a>`}`,
      error instanceof CheckoutError ? error.status : 502,
    );
  }
}
export async function POST(request: NextRequest) {
  let lang = "ar",
    submitted: FormData | undefined,
    verified = false;
  try {
    const browser = request.cookies.get(ZID_COOKIE)?.value ?? "",
      ctx = await checkoutSession(browser);
    if (
      !request.headers
        .get("content-type")
        ?.startsWith("application/x-www-form-urlencoded")
    )
      throw new CheckoutError("invalid_request", 403);
    const raw = await request.text();
    if (raw.length > 8192) throw new CheckoutError("invalid_request", 413);
    const form = new FormData();
    new URLSearchParams(raw).forEach((v, k) => form.append(k, v));
    lang = form.get("lang") === "en" ? "en" : "ar";
    verifyCheckoutPost(
      request.headers.get("origin"),
      browser,
      form.get("csrf"),
      ctx.config.origin,
    );
    verified = true;
    submitted = form;
    if (form.get("action") === "validate") await prepareCheckout(ctx, form);
    else if (form.get("action") === "create" && form.get("confirm") === "yes")
      await createCheckout(ctx, String(form.get("revision") ?? ""));
    else throw new CheckoutError("invalid_request", 403);
    return NextResponse.redirect(
      new URL(`${path}?lang=${lang}`, ctx.config.origin),
      { status: 303, headers: privateHeaders },
    );
  } catch (error) {
    const code =
      error instanceof CheckoutError
        ? error.code
        : error instanceof Error && error.message.startsWith("invalid_")
          ? "invalid_details"
          : "provider_unknown";
    const target = new URL(
      `${path}?lang=${lang}&error=${encodeURIComponent(code)}`,
      request.url,
    );
    if (verified && submitted?.get("action") === "validate") {
      const response = await renderCheckout(
        new NextRequest(target, { headers: request.headers }),
        submitted,
      );
      return new Response(response.body, {
        status: 422,
        headers: response.headers,
      });
    }
    return NextResponse.redirect(target, {
      status: 303,
      headers: privateHeaders,
    });
  }
}
