import "server-only";
import { createCipheriv, createDecipheriv, timingSafeEqual } from "node:crypto";
import { randomBytes } from "node:crypto";
import { digest, zidAdmin, zidConfig } from "./oauth-server";
import { isOpaque, storeIdentity, type ZidTokens } from "./oauth-contract";
import {
  checkoutInput,
  developmentOrder,
  safePaymentUrl,
  zidValidationCode,
} from "./checkout-contract";
export const TEST_STORE = "3258532";
type Job = {
  state: "READY" | "CREATING" | "CREATED" | "FAILED" | "UNKNOWN";
  revision: string;
  summary: Record<string, string | number>;
  request_ciphertext: string;
  result_ciphertext: string | null;
  order_id: string | null;
  expires_at: string;
};
export type Session = {
  session_hash: string;
  external_store_id: string;
  store_name: string;
  token_ciphertext: string;
  checkout: Job | null;
};
export class CheckoutError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export function checkoutConfig() {
  const config = zidConfig();
  if (
    process.env.ZID_DEV_CHECKOUT_ENABLED !== "true" ||
    !config.allowed.includes(TEST_STORE)
  )
    throw new CheckoutError("disabled", 503);
  return config;
}
export function sealCheckout(value: unknown, session: string, key: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "base64"), iv);
  cipher.setAAD(Buffer.from(session));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    "zid-checkout-v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    data.toString("base64"),
  ].join(".");
}
export function openPrivate<T>(
  ciphertext: string,
  session: string,
  key: string,
  version = "zid-checkout-v1",
): T {
  const parts = ciphertext.split(".");
  if (parts.length !== 4 || parts[0] !== version)
    throw new CheckoutError("session_expired", 401);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(key, "base64"),
    Buffer.from(parts[1], "base64"),
  );
  decipher.setAAD(Buffer.from(session));
  decipher.setAuthTag(Buffer.from(parts[2], "base64"));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(parts[3], "base64")),
      decipher.final(),
    ]).toString("utf8"),
  );
}
export const csrfFor = (browser: string) =>
  digest("reload-development-checkout:" + browser);
export function verifyCheckoutPost(
  origin: string | null,
  browser: string,
  csrf: unknown,
  configuredOrigin: string,
) {
  if (
    origin !== configuredOrigin ||
    typeof csrf !== "string" ||
    !isOpaque(browser) ||
    !/^[a-f0-9]{64}$/.test(csrf) ||
    !timingSafeEqual(Buffer.from(csrf), Buffer.from(csrfFor(browser)))
  )
    throw new CheckoutError("invalid_request", 403);
}
export async function checkoutSession(browser: string) {
  if (!isOpaque(browser)) throw new CheckoutError("session_expired", 401);
  const config = checkoutConfig(),
    admin = zidAdmin();
  const { data, error } = await admin.rpc("get_zid_dev_checkout_session", {
    p_browser_hash: digest(browser),
  });
  if (error) throw new CheckoutError("storage_unavailable", 503);
  const session = data as Session;
  if (!session || session.external_store_id !== TEST_STORE)
    throw new CheckoutError("session_expired", 401);
  const tokens = openPrivate<ZidTokens>(
    session.token_ciphertext,
    session.session_hash,
    config.key,
    "zid-dev-v1",
  );
  if (
    !Number.isFinite(Date.parse(tokens.expires_at)) ||
    Date.parse(tokens.expires_at) <= Date.now()
  )
    throw new CheckoutError("session_expired", 401);
  return { config, admin, session, tokens, browserHash: digest(browser) };
}
export type CheckoutSession = Awaited<ReturnType<typeof checkoutSession>>;
export async function zidRequest(
  ctx: CheckoutSession,
  path: string,
  body?: unknown,
) {
  // Paths are fixed by this module. No caller-supplied origin, headers or auth scope.
  if (
    !/^\/(managers\/(account\/store|store\/(payment-methods|delivery-options|drafts(?:\/validate)?|orders\/\d+\/view))|products\/(?:[a-zA-Z0-9-]+\/)?)(?:\?page_size=20|\?payload_type=simple)?$/.test(
      path,
    )
  )
    throw new CheckoutError("invalid_request", 400);
  let response: Response;
  try {
    response = await fetch("https://api.zid.sa/v1" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${ctx.tokens.authorization}`,
        "X-Manager-Token": ctx.tokens.access_token,
        Role: "Manager",
        "Store-Id": TEST_STORE,
        Accept: "application/json",
        "Accept-Language": "en",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
      redirect: "error",
      cache: "no-store",
    });
  } catch {
    throw new CheckoutError("provider_unknown", 502);
  }
  const text = await response.text();
  if (text.length > 2_000_000) throw new CheckoutError("provider_unknown", 502);
  if (!response.ok) {
    let validationCode = "validation_failed";
    if (response.status === 422) {
      try {
        validationCode = zidValidationCode(JSON.parse(text));
      } catch {
        /* Keep the safe generic message. */
      }
    }
    throw new CheckoutError(
      response.status === 401 || response.status === 403
        ? "permission_required"
        : response.status === 422
          ? validationCode
          : "provider_unknown",
      response.status === 422 ? 422 : 502,
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new CheckoutError("provider_unknown", 502);
  }
}
export async function checkoutIdentity(ctx: CheckoutSession) {
  const value = await zidRequest(ctx, "/managers/account/store");
  storeIdentity(value, [TEST_STORE]);
  const storeUrl = String(value.store.url ?? "");
  try {
    if (new URL(storeUrl).protocol !== "https:") throw new Error();
  } catch {
    throw new CheckoutError("store_unavailable", 502);
  }
  return { name: ctx.session.store_name, url: storeUrl };
}
function productInfo(raw: Record<string, any>) {
  const price = raw.sale_price ?? raw.price;
  if (
    String(raw.store_id) !== TEST_STORE ||
    raw.has_options === true ||
    raw.has_fields === true ||
    raw.is_published !== true ||
    raw.is_draft === true ||
    !raw.sku ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isSafeInteger(Math.round(price * 100)) ||
    raw.currency !== "SAR" ||
    raw.parent_id ||
    raw.variants?.length ||
    raw.options?.length ||
    raw.custom_fields?.length ||
    raw.custom_input_fields?.length ||
    raw.custom_options?.length ||
    raw.group_products?.length
  )
    return null;
  if (
    raw.is_infinite !== true &&
    !(Number.isInteger(raw.quantity) && raw.quantity > 0)
  )
    return null;
  const restrictions = raw.purchase_restrictions ?? {};
  const min =
    Number.isInteger(restrictions.min_quantity_per_cart) &&
    restrictions.min_quantity_per_cart > 0
      ? restrictions.min_quantity_per_cart
      : 1;
  const max =
    Number.isInteger(restrictions.max_quantity_per_cart) &&
    restrictions.max_quantity_per_cart > 0
      ? Math.min(restrictions.max_quantity_per_cart, 20)
      : 20;
  return {
    min,
    nameAr: String(raw.name?.ar || raw.name?.en || raw.name || "منتج").slice(
      0,
      120,
    ),
    id: String(raw.id),
    sku: String(raw.sku),
    name: String(raw.name?.en || raw.name?.ar || raw.name || "Product").slice(
      0,
      120,
    ),
    price: Number(price),
    quantity: raw.is_infinite === true ? max : Math.min(raw.quantity, max),
  };
}
export async function checkoutOptions(ctx: CheckoutSession) {
  const identity = await checkoutIdentity(ctx);
  const [products, payments, delivery] = await Promise.all([
    zidRequest(ctx, "/products/?page_size=20"),
    zidRequest(ctx, "/managers/store/payment-methods"),
    zidRequest(ctx, "/managers/store/delivery-options?payload_type=simple"),
  ]);
  const payment = Array.isArray(payments.payload)
    ? payments.payload.find(
        (p: any) =>
          p.enabled === true &&
          p.code === "payment_link.zidpay" &&
          /^\d+$/.test(String(p.id)),
      )
    : null;
  if (!payment) throw new CheckoutError("payment_unavailable", 409);
  const shipping = (delivery.delivery_options ?? [])
    .filter(
      (s: any) =>
        /^\d+$/.test(String(s.id)) && s.shipping_method_status === "active",
    )
    .map((s: any) => ({
      id: String(s.id),
      name: String(s.name).slice(0, 100),
    }));
  return {
    identity,
    paymentId: payment.id,
    shipping,
    products: (products.results ?? [])
      .map(productInfo)
      .filter(Boolean) as NonNullable<ReturnType<typeof productInfo>>[],
  };
}
export async function prepareCheckout(ctx: CheckoutSession, form: FormData) {
  const input = checkoutInput(form),
    options = await checkoutOptions(ctx);
  if (!options.shipping.some((s: any) => s.id === input.shipping))
    throw new CheckoutError("shipping_unavailable", 409);
  const listed = options.products.find((p) => p.id === input.product);
  if (!listed) throw new CheckoutError("product_unavailable", 409);
  const fresh = productInfo(
    await zidRequest(ctx, `/products/${input.product}/`),
  );
  if (
    !fresh ||
    fresh.id !== input.product ||
    fresh.sku !== listed.sku ||
    input.quantity > fresh.quantity ||
    input.quantity < fresh.min
  )
    throw new CheckoutError("product_unavailable", 409);
  const customer = {
    full_name: input.name,
    email: input.email,
    mobile_country_code: "966",
    mobile_number: input.phone,
  };
  const payload = {
    currency_code: "SAR",
    coupon_code: null,
    customer,
    consignee: {
      contact: customer,
      address: {
        line_1: input.address,
        line_2: input.addressExtra,
        city_name: input.city,
        country_code: "SA",
      },
    },
    is_gift: false,
    is_gifted_consignee_notifiable: false,
    products: [{ sku: fresh.sku, quantity: input.quantity }],
    shipping_method: { type: "delivery", id: Number(input.shipping) },
    payment_method: {
      id: options.paymentId,
      payment_link_configs: {
        expiryDateTime: new Date(Date.now() + 30 * 60_000).toISOString(),
      },
    },
    customer_comment: null,
  };
  const validation = await zidRequest(
    ctx,
    "/managers/store/drafts/validate",
    payload,
  );
  if (validation.code !== "SUCCESS_WITHOUT_PAYLOAD")
    throw new CheckoutError("validation_failed", 422);
  const envelope = {
    payload,
    productId: input.product,
    unitPrice: fresh.price,
    storeUrl: options.identity.url,
  };
  const saved = await ctx.admin.rpc("prepare_zid_dev_checkout", {
    p_browser_hash: ctx.browserHash,
    p_request_ciphertext: sealCheckout(
      envelope,
      ctx.session.session_hash,
      ctx.config.key,
    ),
    p_summary: {
      product: fresh.name,
      productAr: fresh.nameAr,
      quantity: input.quantity,
      itemsTotal: fresh.price * input.quantity,
      shipping: options.shipping.find(
        (s: { id: string; name: string }) => s.id === input.shipping,
      )!.name,
      phoneEnding: input.phone.slice(-2),
    },
  });
  if (saved.error || saved.data !== true)
    throw new CheckoutError("already_started", 409);
}
export async function createCheckout(ctx: CheckoutSession, revision: string) {
  const job = ctx.session.checkout;
  if (
    !job ||
    job.state !== "READY" ||
    job.revision !== revision ||
    Date.parse(job.expires_at) <= Date.now()
  )
    throw new CheckoutError("review_expired", 409);
  const claimed = await ctx.admin.rpc("claim_zid_dev_checkout", {
    p_browser_hash: ctx.browserHash,
    p_revision: revision,
  });
  if (claimed.error || claimed.data !== true)
    throw new CheckoutError("already_started", 409);
  let creationStarted = false;
  try {
    const envelope = openPrivate<any>(
      job.request_ciphertext,
      ctx.session.session_hash,
      ctx.config.key,
    );
    await checkoutIdentity(ctx);
    const fresh = productInfo(
      await zidRequest(ctx, `/products/${envelope.productId}/`),
    );
    const quantity = envelope.payload.products[0].quantity;
    if (
      !fresh ||
      fresh.sku !== envelope.payload.products[0].sku ||
      fresh.price !== envelope.unitPrice ||
      quantity > fresh.quantity ||
      quantity < fresh.min
    )
      throw new CheckoutError("selection_changed", 409);
    if (
      Date.parse(
        envelope.payload.payment_method.payment_link_configs.expiryDateTime,
      ) <=
      Date.now() + 60_000
    )
      throw new CheckoutError("review_expired", 409);
    const methods = await zidRequest(ctx, "/managers/store/payment-methods");
    if (
      !Array.isArray(methods.payload) ||
      !methods.payload.some(
        (method: any) =>
          method.enabled === true &&
          method.code === "payment_link.zidpay" &&
          String(method.id) === String(envelope.payload.payment_method.id),
      )
    )
      throw new CheckoutError("payment_unavailable", 409);
    const delivery = await zidRequest(
      ctx,
      "/managers/store/delivery-options?payload_type=simple",
    );
    if (
      !Array.isArray(delivery.delivery_options) ||
      !delivery.delivery_options.some(
        (method: any) =>
          method.shipping_method_status === "active" &&
          String(method.id) === String(envelope.payload.shipping_method.id),
      )
    )
      throw new CheckoutError("shipping_unavailable", 409);
    const valid = await zidRequest(
      ctx,
      "/managers/store/drafts/validate",
      envelope.payload,
    );
    if (valid.code !== "SUCCESS_WITHOUT_PAYLOAD")
      throw new CheckoutError("validation_failed", 422);
    creationStarted = true;
    const reply = await zidRequest(
      ctx,
      "/managers/store/drafts",
      envelope.payload,
    );
    const order = developmentOrder(reply, TEST_STORE);
    const safe = {
      ...order,
      link: safePaymentUrl(
        order.link,
        envelope.storeUrl,
        (process.env.ZID_DEV_PAYMENT_HOSTS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      ),
      storeUrl: envelope.storeUrl,
      linkExpires:
        envelope.payload.payment_method.payment_link_configs.expiryDateTime,
    };
    const saved = await ctx.admin.rpc("finish_zid_dev_checkout", {
      p_browser_hash: ctx.browserHash,
      p_state: "CREATED",
      p_order_id: order.id,
      p_result_ciphertext: sealCheckout(
        safe,
        ctx.session.session_hash,
        ctx.config.key,
      ),
    });
    if (saved.error || saved.data !== true)
      throw new CheckoutError("provider_unknown", 502);
  } catch (error) {
    // After any creation call, a missing/malformed response or save failure is uncertain. Never resend automatically.
    const code =
      error instanceof CheckoutError ? error.code : "provider_unknown";
    const state =
      creationStarted &&
      !["validation_failed", "address_details_required", "permission_required"].includes(code)
        ? "UNKNOWN"
        : "FAILED";
    try {
      await ctx.admin.rpc("finish_zid_dev_checkout", {
        p_browser_hash: ctx.browserHash,
        p_state: state,
      });
    } catch {
      /* Leave CREATING locked when storage is unavailable. */
    }
    throw error;
  }
}
export async function readCheckoutResult(
  ctx: CheckoutSession,
  refresh = false,
) {
  const job = ctx.session.checkout;
  if (job?.state !== "CREATED" || !job.result_ciphertext || !job.order_id)
    return null;
  const result = openPrivate<any>(
    job.result_ciphertext,
    ctx.session.session_hash,
    ctx.config.key,
  );
  if (refresh) {
    await checkoutIdentity(ctx);
    const fresh = developmentOrder(
      await zidRequest(ctx, `/managers/store/orders/${job.order_id}/view`),
      TEST_STORE,
      job.order_id,
    );
    result.payment = fresh.payment;
    result.total = fresh.total;
    if (fresh.link !== null)
      result.link = safePaymentUrl(
        fresh.link,
        result.storeUrl,
        (process.env.ZID_DEV_PAYMENT_HOSTS ?? "")
          .split(",")
          .map((host) => host.trim())
          .filter(Boolean),
      );
  }
  const expired = Date.parse(result.linkExpires) <= Date.now();
  return {
    total: result.total,
    payment: result.payment,
    link:
      !expired && result.payment === "pending"
        ? safePaymentUrl(
            result.link,
            result.storeUrl,
            (process.env.ZID_DEV_PAYMENT_HOSTS ?? "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        : null,
    expired,
  };
}

/** Restore only this browser's encrypted draft when editing; consent is always asked again. */
export function checkoutDraft(ctx: CheckoutSession): FormData | undefined {
  const job = ctx.session.checkout;
  if (job?.state !== "READY" || !job.request_ciphertext) return;
  const draft = openPrivate<any>(
    job.request_ciphertext,
    ctx.session.session_hash,
    ctx.config.key,
  );
  const payload = draft.payload;
  const form = new FormData();
  const values = {
    product: draft.productId,
    quantity: String(payload.products[0].quantity),
    shipping: String(payload.shipping_method.id),
    name: payload.customer.full_name,
    email: payload.customer.email,
    phone: `0${payload.customer.mobile_number}`,
    city: payload.consignee.address.city_name,
    address: payload.consignee.address.line_1,
    addressExtra: payload.consignee.address.line_2 ?? "",
  };
  for (const [name, value] of Object.entries(values))
    form.set(name, String(value));
  return form;
}
