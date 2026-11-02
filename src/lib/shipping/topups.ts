import "server-only";
import { billingAdmin } from "@/lib/billing-server";
import { StreamProvider } from "../../../supabase/functions/_shared/stream-provider";
import {
  safeStreamUrl,
  halalas,
} from "../../../supabase/functions/_shared/billing-contract";
import {
  topupAmount,
  shippingUuid,
} from "../../../supabase/functions/_shared/shipping-topup-contract";
import { reconcileShippingTopup } from "../../../supabase/functions/_shared/shipping-topup-reconcile";

export class ShippingTopupError extends Error {
  constructor(
    public code: string,
    public status = 409,
  ) {
    super(code);
  }
}
export function shippingTopupProvider(email?: string) {
  if (process.env.SHIPPING_SANDBOX_TOPUPS_ENABLED !== "true")
    throw new ShippingTopupError("disabled", 503);
  if (
    email !== undefined &&
    !(process.env.STREAM_SANDBOX_ALLOWED_EMAILS || "mirzaa@reload.sa")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .includes(email.toLowerCase())
  )
    throw new ShippingTopupError("sandbox_account_required", 403);
  return new StreamProvider(process.env.STREAM_SANDBOX_X_API_KEY || "");
}
async function rpc(
  admin: ReturnType<typeof billingAdmin>,
  name: string,
  args: Record<string, unknown>,
) {
  const result = await admin.rpc(name, args);
  if (result.error) throw new ShippingTopupError("records_unavailable", 503);
  return result.data;
}
export async function startShippingTopup(
  storeId: string,
  user: { id: string; email?: string },
  amount: unknown,
  origin: string,
) {
  const provider = shippingTopupProvider(user.email || "");
  const value = topupAmount(amount);
  // Verify account mode before any write, even when credentials were misconfigured.
  const account = await provider.request("/user");
  const expectedEmail = (
    process.env.STREAM_SANDBOX_CUSTOMER_EMAIL || "mirzaa@reload.sa"
  ).toLowerCase();
  if (
    account.organization?.sandbox !== true ||
    account.email?.toLowerCase() !== expectedEmail
  )
    throw new ShippingTopupError("sandbox_account_required", 403);
  const admin = billingAdmin();
  const started = await admin.rpc("shipping_topup_start", {
    p_store: storeId,
    p_user: user.id,
    p_amount: value,
  });
  if (started.error) throw new ShippingTopupError("topup_unavailable");
  const checkout = started.data;
  if (!checkout || !shippingUuid(checkout.id))
    throw new ShippingTopupError("records_unavailable", 503);
  if (
    checkout.state === "READY" &&
    Date.parse(checkout.expires_at) > Date.now()
  )
    return { url: safeShippingUrl(checkout.checkout_url) };
  if (
    !(await rpc(admin, "shipping_topup_claim", {
      p_id: checkout.id,
      p_store: storeId,
    }))
  )
    throw new ShippingTopupError("topup_pending");
  try {
    const consumers = await provider.request(
      `/consumers?search_term=${encodeURIComponent(expectedEmail)}&limit=100`,
    );
    let consumer = Array.isArray(consumers.data)
      ? consumers.data.find(
          (c: Record<string, unknown>) =>
            typeof c.email === "string" &&
            c.email.toLowerCase() === expectedEmail,
        )
      : null;
    if (!consumer)
      consumer = await provider.request("/consumers", "POST", {
        name:
          [account.first_name, account.last_name].filter(Boolean).join(" ") ||
          "Reload test merchant",
        email: account.email,
        external_id: user.id,
        communication_methods: ["EMAIL"],
      });
    if (!shippingUuid(consumer?.id)) throw new Error("consumer_unavailable");
    const product = await provider.request("/products", "POST", {
      name: "Reload sandbox shipping balance",
      type: "ONE_OFF",
      is_one_time: true,
      prices: [
        {
          currency: "SAR",
          amount: (value / 100).toFixed(2),
          is_price_exempt_from_vat: false,
        },
      ],
      external_metadata: {
        reload_shipping_topup: checkout.id,
        environment: "sandbox",
      },
    });
    if (!shippingUuid(product.id)) throw new Error("product_unavailable");
    await rpc(admin, "shipping_topup_bind", {
      p_id: checkout.id,
      p_store: storeId,
      p_consumer: consumer.id,
      p_product: product.id,
    });
    const link = await provider.request("/payment_links", "POST", {
      name: "Reload sandbox shipping top-up",
      description: `Test shipping balance: SAR ${(value / 100).toFixed(2)}. One payment, no subscription. Not available for live shipping.`,
      currency: "SAR",
      items: [
        { product_id: product.id, quantity: 1, allow_custom_quantity: false },
      ],
      coupons: [],
      max_number_of_payments: 1,
      valid_until: checkout.expires_at,
      organization_consumer_id: consumer.id,
      contact_information_type: "EMAIL",
      payment_methods: {
        visa: true,
        mastercard: true,
        amex: true,
        bank_transfer: false,
        installment: false,
        bnpl: false,
      },
      success_redirect_url: `${origin}/app/shipping?store=${storeId}&result=return`,
      failure_redirect_url: `${origin}/app/shipping?store=${storeId}&result=failed`,
      custom_metadata: {
        reload_shipping_topup: checkout.id,
        environment: "sandbox",
      },
    });
    if (!shippingUuid(link.id)) throw new Error("link_unavailable");
    await rpc(admin, "shipping_topup_note_link", {
      p_id: checkout.id,
      p_store: storeId,
      p_link: link.id,
    });
    if (
      link.currency !== "SAR" ||
      halalas(link.amount) !== value ||
      link.organization_consumer_id !== consumer.id ||
      link.max_number_of_payments !== 1
    )
      throw new Error("checkout_mismatch");
    const url = safeShippingUrl(link.url);
    await rpc(admin, "shipping_topup_ready", {
      p_id: checkout.id,
      p_store: storeId,
      p_link: link.id,
      p_url: url,
    });
    return { url };
  } catch {
    try {
      await rpc(admin, "shipping_topup_review", {
        p_id: checkout.id,
        p_store: storeId,
        p_code: "creation_unknown",
      });
    } catch {
      /* Keep PREPARING locked. */
    }
    throw new ShippingTopupError("topup_pending");
  }
}
export function safeShippingUrl(value: unknown) {
  const url = new URL(safeStreamUrl(value));
  if (url.port || url.hash) throw new Error("invalid_checkout_url");
  return url.href;
}
export async function syncShippingTopup(storeId: string, email: string) {
  const provider = shippingTopupProvider(email),
    admin = billingAdmin();
  const account = await provider.request("/user");
  if (account.organization?.sandbox !== true)
    throw new ShippingTopupError("sandbox_account_required", 403);
  const pending = await rpc(admin, "shipping_topup_pending", {
    p_store: storeId,
  });
  if (!pending?.payment_link_id) return { checked: false };
  if (!shippingUuid(pending.payment_link_id))
    throw new ShippingTopupError("records_unavailable", 503);
  const invoices = await provider.request(
    `/invoices?payment_link_id=${pending.payment_link_id}&include_payments=true&limit=10`,
  );
  let checked = false;
  for (const row of Array.isArray(invoices.data) ? invoices.data : []) {
    if (
      !shippingUuid(row.id) ||
      row.payment_link_id !== pending.payment_link_id
    )
      continue;
    const invoice = await provider.request(`/invoices/${row.id}`);
    if (invoice.status === "COMPLETED")
      checked =
        (await reconcileShippingTopup(admin, provider, "sandbox", invoice)) ||
        checked;
  }
  return { checked };
}
export async function shippingWalletData(
  storeId: string,
  client: any,
  canManage: boolean,
) {
  const result = await client.rpc("shipping_wallet_snapshot", {
    p_store: storeId,
    p_environment: "sandbox",
  });
  if (result.error || !result.data)
    throw new ShippingTopupError("records_unavailable", 503);
  const pending = await rpc(billingAdmin(), "shipping_topup_pending", {
    p_store: storeId,
  });
  return {
    ...result.data,
    canManage,
    pendingTopup: pending
      ? {
          status: pending.state,
          amountHalalas: pending.amount_halalas,
          createdAt: pending.created_at,
          expiresAt: pending.expires_at,
        }
      : null,
  };
}

export async function resumeShippingTopup(storeId: string, email: string) {
  shippingTopupProvider(email);
  const admin = billingAdmin();
  const billing = await admin
    .from("store_billing")
    .select("plan,status,period_start,period_end")
    .eq("store_id", storeId)
    .eq("environment", "sandbox")
    .maybeSingle();
  if (
    billing.error ||
    billing.data?.plan !== "premium" ||
    billing.data.status !== "ACTIVE" ||
    !Number.isFinite(Date.parse(billing.data.period_start)) ||
    !Number.isFinite(Date.parse(billing.data.period_end)) ||
    Date.parse(billing.data.period_start) > Date.now() ||
    Date.parse(billing.data.period_end) <= Date.now()
  )
    throw new ShippingTopupError("topup_unavailable");
  const pending = await rpc(admin, "shipping_topup_pending", {
    p_store: storeId,
  });
  if (
    pending?.state !== "READY" ||
    !Number.isFinite(Date.parse(pending.expires_at)) ||
    Date.parse(pending.expires_at) <= Date.now()
  )
    throw new ShippingTopupError("topup_pending");
  return { url: safeShippingUrl(pending.checkout_url) };
}

/** Sandbox-only recovery: keep the old resource available for delayed payment reconciliation. */
export async function retireExpiredShippingTopup(
  storeId: string,
  user: { id: string; email?: string },
) {
  const provider = shippingTopupProvider(user.email || "");
  const account = await provider.request("/user");
  if (
    account.organization?.sandbox !== true ||
    account.email?.toLowerCase() !==
      (
        process.env.STREAM_SANDBOX_CUSTOMER_EMAIL || "mirzaa@reload.sa"
      ).toLowerCase()
  )
    throw new ShippingTopupError("sandbox_account_required", 403);
  const admin = billingAdmin();
  const pending = await rpc(admin, "shipping_topup_pending", {
    p_store: storeId,
  });
  if (
    !pending ||
    pending.state === "EXPIRED_UNPAID" ||
    pending.state === "PAID"
  )
    return { recovered: false };
  const expiredAt = Date.parse(pending.expires_at);
  if (
    pending.state !== "READY" ||
    !Number.isFinite(expiredAt) ||
    expiredAt > Date.now() - 300000 ||
    !shippingUuid(pending.payment_link_id)
  )
    throw new ShippingTopupError("topup_pending");
  const link = await provider.request(
    `/payment_links/${pending.payment_link_id}`,
  );
  if (
    link.id !== pending.payment_link_id ||
    link.organization_consumer_id !== pending.consumer_id ||
    link.currency !== "SAR" ||
    halalas(link.amount) !== pending.amount_halalas ||
    link.max_number_of_payments !== 1 ||
    !["COMPLETED", "INACTIVE"].includes(link.status) ||
    !Number.isFinite(Date.parse(link.valid_until)) ||
    Date.parse(link.valid_until) > Date.now() - 300000 ||
    halalas(link.amount_collected) !== 0 ||
    !Array.isArray(link.items) ||
    link.items.length !== 1 ||
    link.items[0].product_id !== pending.product_id ||
    Number(link.items[0].quantity) !== 1
  )
    throw new ShippingTopupError("topup_pending");
  const invoices = await provider.request(
    `/invoices?payment_link_id=${pending.payment_link_id}&include_payments=true&limit=1`,
  );
  if (!Array.isArray(invoices.data) || invoices.data.length !== 0)
    throw new ShippingTopupError("topup_pending");
  await rpc(admin, "shipping_topup_retire_expired", {
    p_store: storeId,
    p_id: pending.id,
    p_user: user.id,
    p_link: pending.payment_link_id,
  });
  return { recovered: true };
}
