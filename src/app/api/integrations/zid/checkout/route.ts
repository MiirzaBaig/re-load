import { NextRequest, NextResponse } from "next/server";
import {
  ZID_COOKIE,
  ZID_PATH,
  escapeHtml as e,
} from "@/lib/zid/oauth-contract";
import { privateHeaders } from "@/lib/zid/oauth-server";
import {
  checkoutMessages,
  checkoutPage,
  checkoutEvidence,
  checkoutIcon,
  checkoutNotice,
  checkoutSteps,
} from "@/lib/zid/checkout-page";
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
    request.nextUrl.searchParams.get("lang") === "en" ? "en" : "ar";
  const ar = language === "ar";
  const t = (arabic: string, english: string) => (ar ? arabic : english);
  const money = (amount: number) =>
    new Intl.NumberFormat(ar ? "ar-SA" : "en-SA", {
      style: "currency",
      currency: "SAR",
    }).format(amount);
  let hasCreatedOrder = false;
  let hasUnresolvedAttempt = false;
  try {
    const browser = request.cookies.get(ZID_COOKIE)?.value ?? "";
    const ctx = await checkoutSession(browser);
    if (request.nextUrl.origin !== ctx.config.origin)
      throw new CheckoutError("invalid_request", 403);
    const error = request.nextUrl.searchParams.get("error");
    const warning =
      error && checkoutMessages[error]
        ? checkoutNotice(
            ["review_expired", "selection_changed", "already_started"].includes(
              error,
            )
              ? "waiting"
              : "error",
            t("نحتاج مراجعة بعض التفاصيل", "A detail needs attention"),
            checkoutMessages[error][ar ? 0 : 1],
            true,
          )
        : "";
    const fields = (action: string) =>
      `<input type="hidden" name="csrf" value="${csrfFor(browser)}"><input type="hidden" name="lang" value="${language}"><input type="hidden" name="action" value="${action}">`;
    const busy = `<span class="live" role="status" aria-live="polite"></span>`;
    const feedback = `<div class="form-feedback" role="alert" hidden></div>`;
    const submit = (label: string) =>
      `<button type="submit"><span class="spinner" aria-hidden="true"></span><span>${e(label)}</span></button>${busy}`;
    const checkbox = (name: string, title: string, help: string) =>
      `<div class="field"><label class="check" for="${name}"><input id="${name}" name="${name}" type="checkbox" value="yes" required aria-describedby="${name}-help ${name}-error"><span><strong>${e(title)}</strong><small id="${name}-help">${e(help)}</small></span></label><span class="field-error" id="${name}-error" hidden></span></div>`;
    const job = ctx.session.checkout;
    hasCreatedOrder = job?.state === "CREATED";
    hasUnresolvedAttempt = !!job && ["CREATING", "UNKNOWN"].includes(job.state);
    if (
      !hasCreatedOrder &&
      !hasUnresolvedAttempt &&
      (ctx.session.creation_blocked === true || error === "already_started")
    ) {
      return checkoutPage(
        language,
        t("اختبار الدفع متوقف مؤقتًا", "Checkout testing is paused"),
        `<p class="subtitle">${t("هناك محاولة سابقة تحتاج مراجعة قبل إنشاء طلب آخر.", "An earlier attempt needs checking before another order can be created.")}</p><p class="store">${checkoutIcon("store")}<span>${t("متجر التطوير", "Development store")} <strong>${e(ctx.session.store_name)}</strong></span></p>${checkoutNotice("waiting", t("محاولة سابقة لم تُحسم بعد", "An earlier attempt is unresolved"), t("قد يكون زد استلم طلبًا سابقًا، لكن نتيجته لم تتأكد. لن نُنشئ طلبًا جديدًا حتى تُراجع تلك المحاولة.", "Zid may have received an earlier order request, but its outcome is unconfirmed. New orders stay paused until that attempt is checked."))}<p class="side-note">${t("هذا الاختيار لم يُرسل كطلب جديد من هذه المحاولة. إعادة الربط أو تغيير المنتج لا يزيل قفل الأمان.", "This selection was not sent as a new order from this attempt. Reconnecting or choosing another product does not remove the safety lock.")}</p><div class="actions"><a class="action secondary" href="?lang=${language}">${t("أعد تحميل السجل المحفوظ", "Reload saved status")}</a></div><p class="side-note">${t("إعادة التحميل تعرض سجل ريلود المحفوظ فقط؛ لا تبحث تلقائيًا عن الطلب في زد.", "Reloading only shows Reload’s saved record; it does not automatically search Zid for the order.")}</p>`,
      );
    }
    const currentStep =
      hasCreatedOrder || hasUnresolvedAttempt
        ? 3
        : job?.state === "READY" &&
            Date.parse(job.expires_at) > Date.now() &&
            request.nextUrl.searchParams.get("edit") !== "1"
          ? 2
          : 1;
    const intro = `<p class="store">${checkoutIcon("store")}<span>${t("متجر التطوير", "Development store")} <strong>${e(ctx.session.store_name)}</strong></span></p>${checkoutSteps(language, currentStep)}`;
    if (hasUnresolvedAttempt)
      return checkoutPage(
        language,
        t("نتيجة الطلب غير مؤكدة", "Order result not confirmed"),
        `<p class="subtitle">${t("محاولتك محفوظة. نحتاج مراجعة نتيجتها قبل المتابعة.", "Your attempt is saved. Its outcome needs checking before you continue.")}</p>${intro}${checkoutNotice("waiting", t("لا تُنشئ طلبًا آخر الآن", "Please don’t create another order"), t("قد يكون زد استلم طلبك، لكننا لم نتمكن من تأكيد النتيجة. المحاولة مقفلة مؤقتًا لتجنب التكرار.", "Zid may have received your request, but we couldn’t confirm the result. This attempt is locked to prevent a duplicate."))}<h2>${t("الخطوة التالية", "What to do next")}</h2><p class="side-note">${t("راجع طلبات متجر التطوير مع فريق ريلود. تحديث هذه الصفحة يعرض سجل ريلود المحفوظ فقط؛ ولا يبحث تلقائيًا عن الطلب في زد.", "Check the development-store orders with the Reload team. Reloading this page only shows Reload’s saved record; it does not automatically search Zid for the order.")}</p><div class="actions"><a class="action secondary" href="?lang=${language}">${t("أعد تحميل السجل المحفوظ", "Reload saved status")}</a></div>`,
      );
    if (job?.state === "CREATED") {
      const result = await readCheckoutResult(ctx, true);
      if (!result) throw new CheckoutError("provider_unknown", 502);
      const resultNotice = result.closed
        ? checkoutNotice(
            "waiting",
            t("الطلب مغلق", "This order is closed"),
            t(
              "الطلب ملغى أو في مسار إرجاع حسب زد. لن نعرض رابط دفع أو ننشئ طلبًا آخر تلقائيًا.",
              "Zid reports this order as cancelled or in a return process. We won’t offer payment or create another order automatically.",
            ),
          )
        : !result.totalsMatch
          ? checkoutNotice(
              "waiting",
              t("المبالغ تحتاج مراجعة", "The amounts need checking"),
              t(
                "إجمالي الفاتورة لا يطابق إجمالي الطلب حسب زد. رابط الدفع مخفي حتى تُراجع المبالغ في زد. لا تنشئ طلبًا آخر.",
                "Zid’s invoice total differs from its order total. Payment stays hidden until the amounts are checked in Zid. Don’t create another order.",
              ),
            )
          : result.selection !== "matched"
            ? checkoutNotice(
                "waiting",
                t("الاختيار يحتاج مراجعة", "The selection needs checking"),
                t(
                  "تعذر مطابقة منتجات الطلب وكمياتها مع اختيارك. رابط الدفع مخفي حتى تُراجع التفاصيل في زد. لا تنشئ طلبًا آخر.",
                  "We couldn’t match the order’s items and quantities to your selection. Payment stays hidden until the details are checked in Zid. Don’t create another order.",
                ),
              )
            : "";
      const paid = result.payment === "paid";
      return checkoutPage(
        language,
        paid
          ? t("تم تأكيد الدفع", "Payment confirmed")
          : t("تم إنشاء طلب الاختبار", "Test order created"),
        `<p class="subtitle">${paid ? t("أكد زد الدفع لهذا الطلب.", "Zid has confirmed payment for this order.") : t("طلبك محفوظ في زد. فتح الرابط وحده لا يؤكد الدفع.", "Your order is saved in Zid. Opening the link alone does not confirm payment.")}</p>${intro}${warning}${resultNotice}<div class="total-row"><span>${t("إجمالي زد", "Zid total")}</span><strong class="money"><bdi>${e(money(result.total))}</bdi></strong></div><dl><dt>${t("حالة الدفع", "Payment status")}</dt><dd>${paid ? t("مدفوع — حسب زد", "Paid — reported by Zid") : result.payment === "pending" ? t("بانتظار الدفع", "Waiting for payment") : t("لم يتم التأكد", "Not confirmed")}</dd></dl>${paid ? checkoutNotice("done", t("الدفع مؤكد", "Payment verified"), t("زد يؤكد أن الطلب مدفوع. لم يحجز ريلود أي شحنة.", "Zid reports this order as paid. Reload hasn’t booked a shipment.")) : resultNotice ? "" : !result.link ? checkoutNotice("waiting", t("رابط الدفع غير متاح", "Payment link unavailable"), result.expired ? t("انتهى موعد الدفع المطلوب. راجع الطلب نفسه في زد؛ لن ننشئ بديلًا تلقائيًا.", "The requested payment deadline has passed. Check this same order in Zid; we won’t create a replacement automatically.") : t("راجع هذا الطلب في زد مع فريق ريلود. لا تنشئ طلبًا آخر لاستعادة الرابط.", "Check this order in Zid with the Reload team. Don’t create another order to recover the link.")) : ""}<div class="actions"><a class="action secondary" href="?lang=${language}&refresh=1">${t("تحقق من حالة الدفع في زد", "Check payment status with Zid")}</a>${result.link && !paid ? `<a class="action" href="${e(result.link)}" rel="noreferrer">${t("افتح صفحة الدفع الآمنة", "Open secure payment page")}</a>` : ""}</div>${!paid ? `<p class="side-note">${t("راجع الضريبة والتوصيل في صفحة الدفع. لا تستخدم بطاقة حقيقية قبل أن يؤكد زد طريقة الدفع التجريبي.", "Review tax and delivery charges on the payment page. Don’t use a real card until Zid confirms the test payment method.")}</p>` : ""}${checkoutEvidence(language, result)}`,
      );
    }
    if (currentStep === 2 && job) {
      const summary = job.summary;
      return checkoutPage(
        language,
        t("راجع طلبك", "Review your order"),
        `<p class="subtitle">${t("تأكد من اختيارك قبل إنشاء طلب الاختبار.", "Check your selection before creating the test order.")}</p>${intro}${warning}${checkoutNotice("done", t("التفاصيل مقبولة", "Details accepted"), t("قبل زد التفاصيل. لم ننشئ طلبًا أو رابط دفع بعد.", "Zid accepted the order details. No order or payment link has been created yet."))}<div class="review-product"><span class="product-icon">${checkoutIcon("bag")}</span><div><h2>${e(String(ar ? (summary.productAr ?? summary.product) : summary.product))}</h2><p>${t("منتج واحد في هذه المحاولة", "One product in this attempt")}</p></div></div><dl><dt>${t("الكمية", "Quantity")}</dt><dd>${e(String(summary.quantity))}</dd><dt>${t("خدمة التوصيل", "Delivery service")}</dt><dd>${e(String(summary.shipping))}</dd><dt>${t("رقم الجوال", "Mobile number")}</dt><dd><bdi>••${e(String(summary.phoneEnding))}</bdi></dd></dl><div class="total-row"><span>${t("قيمة المنتجات", "Item subtotal")}</span><strong class="money"><bdi>${e(money(Number(summary.itemsTotal)))}</bdi></strong></div><p class="hint review-note">${t("هذه قيمة المنتجات فقط. راجع إجمالي الضريبة والتوصيل في صفحة دفع زد قبل الدفع.", "This is the item subtotal only. Review the final tax and delivery charges on Zid’s payment page before paying.")}</p><form method="post" action="${path}">${fields("create")}<input type="hidden" name="revision" value="${e(job.revision)}">${feedback}<div class="form-end">${checkbox("confirm", t("أوافق على إنشاء طلب اختبار غير مدفوع", "I confirm creation of one unpaid test order"), t("قد يرسل زد إشعارات إلى بيانات التواصل التي أدخلتها. لا تُؤخذ دفعة في هذه الخطوة.", "Zid may send notifications to the contact details you entered. This step does not take payment."))}${submit(t("أنشئ طلب الاختبار ورابطه", "Create test order and link"))}</div></form><div class="actions"><a class="action secondary" href="?lang=${language}&edit=1">${t("تعديل التفاصيل", "Edit details")}</a></div>`,
      );
    }
    const expiredReview =
      job?.state === "READY" && Date.parse(job.expires_at) <= Date.now()
        ? checkoutNotice(
            "waiting",
            t("انتهت صلاحية المراجعة", "This review has expired"),
            t(
              "راجع التفاصيل وتحقق منها مجددًا. لم ننشئ طلبًا.",
              "Review your details and validate them again. No order was created.",
            ),
          )
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
    const fieldError = (name: string) =>
      error === "address_details_required" && name === "addressExtra"
        ? t(
            "أضف رقم المبنى أو الحي أو الشقة للمتابعة.",
            "Add your building, district or apartment to continue.",
          )
        : "";
    const input = (
      name: string,
      label: string,
      type = "text",
      max = 100,
      help = "",
      autocomplete = "off",
      value?: string,
    ) => {
      const invalid = fieldError(name);
      return `<div class="field"><label id="${name}-label" for="${name}">${e(label)}</label><input class="control" id="${name}" name="${name}" type="${type}" value="${value === undefined ? remembered(name) : e(value)}" maxlength="${max}" required autocomplete="${autocomplete}" ${["email", "phone", "quantity"].includes(name) ? 'dir="ltr"' : 'dir="auto"'} ${name === "quantity" ? 'inputmode="numeric"' : ""} aria-describedby="${name}-help ${name}-error" ${invalid ? 'aria-invalid="true"' : ""}><small id="${name}-help" ${help ? "" : "hidden"}>${e(help)}</small><span class="field-error" id="${name}-error" ${invalid ? "" : "hidden"}>${e(invalid)}</span></div>`;
    };
    const select = (
      name: string,
      label: string,
      entries: { value: string; label: string }[],
      help: string,
      placeholder = "",
    ) =>
      `<div class="field"><label id="${name}-label" for="${name}">${e(label)}</label><select class="control" data-select id="${name}" name="${name}" required aria-describedby="${name}-help ${name}-error">${placeholder ? `<option value="">${e(placeholder)}</option>` : ""}${entries.map((entry) => `<option value="${e(entry.value)}" ${submitted?.get(name) === entry.value ? "selected" : ""}>${e(entry.label)}</option>`).join("")}</select><small id="${name}-help">${e(help)}</small><span class="field-error" id="${name}-error" hidden></span></div>`;
    return checkoutPage(
      language,
      t("جهّز طلب الاختبار", "Prepare your test order"),
      `<p class="subtitle">${t("اختر المنتج وأضف بيانات المستلم. ستراجع التفاصيل قبل إنشاء الطلب.", "Choose a product and add the recipient’s details. You’ll review everything before creating an order.")}</p>${intro}${warning}${expiredReview}<form id="checkout-details" data-details method="post" action="${path}">${fields("validate")}${feedback}<fieldset><legend>${t("اختيار المنتج", "Product selection")}</legend>${select(
        "product",
        t("المنتج", "Product"),
        options.products.map((p) => ({
          value: p.id,
          label: `${ar ? p.nameAr : p.name} · ${money(p.price)}`,
        })),
        t(
          "نعرض المنتجات البسيطة المتوفرة من أول صفحة. الخيارات والمقاسات تحتاج اختبارًا منفصلًا.",
          "Available simple products from the first page. Products with options need separate testing.",
        ),
        t("اختر منتجًا", "Choose a product"),
      )}<div class="grid">${input("quantity", t("الكمية", "Quantity"), "text", 2, t("من ١ إلى ٢٠، حسب المخزون وحدود المنتج.", "1 to 20, subject to stock and product limits."), "off", String(submitted?.get("quantity") ?? "1"))}${select(
        "shipping",
        t("خدمة التوصيل", "Delivery service"),
        options.shipping.map((service: { id: string; name: string }) => ({
          value: service.id,
          label: service.name,
        })),
        t(
          "من خدمات التوصيل المفعّلة في هذا المتجر.",
          "An active delivery service in this store.",
        ),
      )}</div></fieldset><fieldset><legend>${t("بيانات المستلم", "Recipient details")}</legend><p class="section-hint">${t("استخدم بيانات تملكها أو لديك إذن باستخدامها؛ قد يرسل زد إشعارات.", "Use contact details you control or have permission to use. Zid may send notifications.")}</p>${input("name", t("اسم المستلم", "Recipient name"), "text", 100, "", "name")}<div class="grid">${input("email", t("البريد الإلكتروني", "Email address"), "email", 160, "", "email")}${input("phone", t("رقم الجوال السعودي", "Saudi mobile number"), "tel", 18, t("يبدأ بـ 05 أو ‎+966.", "Starts with 05 or +966."), "tel")}</div></fieldset><fieldset><legend>${t("عنوان التوصيل", "Delivery address")}</legend>${input("city", t("المدينة", "City"), "text", 80, "", "address-level2")}${input("address", t("عنوان الشارع", "Street address"), "text", 200, "", "address-line1")}${input("addressExtra", t("تفاصيل العنوان", "Address details"), "text", 200, t("رقم المبنى أو الحي أو الشقة. هذا الحقل مطلوب لدى زد.", "Building, district or apartment. Zid requires this second address line."), "address-line2")}</fieldset><div class="form-end">${checkbox("consent", t("لدي إذن باستخدام بيانات التواصل هذه", "I have permission to use these contact details"), t("أوافق على استقبال إشعارات الاختبار من زد.", "I agree to receive test notifications from Zid."))}${submit(t("تحقق من التفاصيل", "Validate details"))}<p class="hint">${t("ستراجع اختيارك في الخطوة التالية. هذه الخطوة لا تنشئ طلبًا ولا تأخذ دفعة.", "You’ll review your selection next. This step doesn’t create an order or take payment.")}</p></div></form>`,
    );
  } catch (error) {
    const code =
      error instanceof CheckoutError ? error.code : "provider_unknown";
    const waiting = ["disabled", "session_expired", "review_expired"].includes(
      code,
    );
    const message = (checkoutMessages[code] ??
      checkoutMessages.provider_unknown)[ar ? 0 : 1];
    const recovery = hasCreatedOrder
      ? `<p class="side-note">${t("طلب الاختبار محفوظ. لا تنشئ طلبًا آخر؛ أعد التحقق من حالته أو راجعه في زد.", "Your test order is saved. Don’t create another order; check its status again or review it in Zid.")}</p><div class="actions"><a class="action secondary" href="?lang=${language}">${t("أعد التحقق من الحالة", "Check status again")}</a></div>`
      : ["disabled", "session_expired", "permission_required"].includes(code)
        ? `<div class="actions"><a class="action secondary" href="${ZID_PATH}/connect">${t("أعد ربط متجر التطوير", "Reconnect development store")}</a></div>`
        : `<p class="side-note">${t("لم نؤكد إنشاء طلب. إذا سبق أن أكدت الإنشاء، راجع المحاولة قبل البدء من جديد.", "No order creation has been confirmed. If you already confirmed creation, check that attempt before starting again.")}</p><div class="actions"><a class="action secondary" href="?lang=${language}">${t("أعد تحميل الصفحة", "Reload this page")}</a></div>`;
    return checkoutPage(
      language,
      t("خطوة بسيطة قبل المتابعة", "One step before continuing"),
      `<p class="subtitle">${t("احتفظ بهذه الصفحة حتى تتضح الخطوة التالية.", "Keep this page open while you check the next step.")}</p>${checkoutNotice(waiting ? "waiting" : "error", t("قبل المتابعة", "Before you continue"), message, true)}${recovery}`,
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
    if (form.get("action") === "language") {
      // Re-render submitted details privately; language changes never validate/create an order.
      return renderCheckout(
        new NextRequest(
          new URL(`${path}?lang=${lang}&edit=1`, ctx.config.origin),
          { headers: request.headers },
        ),
        submitted,
      );
    }
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
