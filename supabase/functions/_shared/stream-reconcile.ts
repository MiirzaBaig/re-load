import { adminClient } from "./supabase.ts";
import {
  BILLING_PLANS,
  type BillingEnvironment,
  billingPrice,
  halalas,
  isBillingPlan,
  paidInvoice,
  providerInterval,
} from "./billing-contract.ts";
import { scheduleStreamChange } from "./stream-schedule.ts";
import { StreamProvider } from "./stream-provider.ts";

export async function reconcileStreamInvoice(
  environment: BillingEnvironment,
  invoiceId: string,
) {
  const admin = adminClient();
  const key = Deno.env.get(
    environment === "sandbox" ? "STREAM_SANDBOX_X_API_KEY" : "STREAM_X_API_KEY",
  ) || "";
  if (
    environment === "live" &&
    Deno.env.get("STREAM_LIVE_BILLING_ENABLED") !== "true"
  ) return false;
  const provider = new StreamProvider(key);
  const invoice = await provider.request(`/invoices/${invoiceId}`);
  const subscriptionId = invoice.subscription?.id;
  let checkout: Record<string, any> | null = null;
  if (invoice.payment_link_id) {
    const result = await admin.from("billing_checkouts").select("*").eq(
      "environment",
      environment,
    ).eq("payment_link_id", invoice.payment_link_id).maybeSingle();
    if (result.error) throw result.error;
    checkout = result.data;
  }
  if (!checkout && subscriptionId) {
    const { data: account } = await admin.from("store_billing").select(
      "store_id",
    ).eq("environment", environment).eq("subscription_id", subscriptionId)
      .maybeSingle();
    if (account) {
      const result = await admin.from("billing_checkouts").select("*").eq(
        "environment",
        environment,
      ).eq("store_id", account.store_id).eq("kind", "SUBSCRIPTION").eq(
        "status",
        "PAID",
      ).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (result.error) throw result.error;
      checkout = result.data;
    }
  }
  // A notification cannot select a store by supplying metadata or a redirect query string.
  if (!checkout) return false;
  if (
    !isBillingPlan(checkout.plan) ||
    invoice.organization_consumer_id !== checkout.consumer_id
  ) throw new Error("invoice_customer_mismatch");
  const { data: first } = await admin.from("billing_payments").select(
    "invoice_id",
  ).eq("environment", environment).eq("store_id", checkout.store_id).eq(
    "kind",
    "SUBSCRIPTION",
  ).order("paid_at").limit(1).maybeSingle();
  const { data: account, error: accountError } = await admin.from(
    "store_billing",
  ).select("plan,subscription_id,period_start,period_end").eq(
    "environment",
    environment,
  ).eq("store_id", checkout.store_id).maybeSingle();
  if (accountError) throw accountError;
  const renewalPlan =
    checkout.status === "PAID" && account && isBillingPlan(account.plan)
      ? account.plan
      : checkout.plan;
  let renewalInterval = checkout.billing_interval || "monthly";
  let expected = checkout.kind !== "SUBSCRIPTION"
    ? checkout.amount_halalas
    : (checkout.status !== "PAID" || !first || first.invoice_id === invoice.id)
    ? checkout.amount_halalas
    : billingPrice(renewalPlan, renewalInterval);
  let verifiedSubscription: Record<string, any> | null = null;
  if (
    checkout.kind === "SUBSCRIPTION" && checkout.status === "PAID" &&
    subscriptionId && first?.invoice_id !== invoice.id
  ) {
    verifiedSubscription = await provider.request(
      `/subscriptions/${subscriptionId}`,
    );
    const item = verifiedSubscription.items?.[0];
    const { data: catalog, error } = await admin.from("billing_catalog").select(
      "plan,billing_interval,product_id",
    ).eq("environment", environment).eq("product_id", item?.product_id || "")
      .single();
    if (error || !catalog || !isBillingPlan(catalog.plan)) {
      throw new Error("unapproved_subscription_product");
    }
    renewalInterval = catalog.billing_interval;
    expected = billingPrice(catalog.plan, renewalInterval);
    checkout = { ...checkout, plan: catalog.plan };
  }
  const { data: recorded, error: recordedError } = await admin.from(
    "billing_payments",
  ).select("period_start,period_end,amount_halalas,refunded_halalas,store_id")
    .eq(
      "environment",
      environment,
    ).eq("invoice_id", invoiceId).maybeSingle();
  if (recordedError) throw recordedError;
  if (recorded && recorded.store_id !== checkout.store_id) {
    throw new Error("invoice_store_mismatch");
  }
  if (!paidInvoice(invoice, recorded?.amount_halalas ?? expected)) {
    throw new Error("invoice_not_settled_or_amount_mismatch");
  }
  if (recorded) {
    const refunded = halalas(invoice.total_refunded || "0");
    if (refunded === recorded.refunded_halalas) return true;
    const replay = await admin.rpc("billing_apply_invoice", {
      p_checkout: checkout.id,
      p_invoice: invoice.id,
      p_subscription: subscriptionId || null,
      p_start: recorded.period_start,
      p_end: recorded.period_end,
      p_refunded: refunded,
      p_amount: recorded.amount_halalas,
      p_plan: checkout.plan,
      p_interval: checkout.billing_interval || "monthly",
    });
    if (replay.error) throw replay.error;
    return true;
  }
  let subscription: Record<string, any> | null = null;
  if (checkout.kind === "UPGRADE") {
    if (
      !checkout.upgrade_subscription_id || !checkout.target_product_id ||
      Date.parse(checkout.upgrade_period_end) <= Date.now()
    ) throw new Error("upgrade_requires_review");
    if (
      !account ||
      account.subscription_id !== checkout.upgrade_subscription_id ||
      Date.parse(account.period_start) !==
        Date.parse(checkout.upgrade_period_start)
    ) throw new Error("upgrade_period_changed");
    const { data: snap, error: snapError } = await admin.rpc(
      "billing_snapshot",
      { p_store: checkout.store_id, p_environment: environment },
    );
    if (
      snapError ||
      Date.parse(snap.allowanceStart) !==
        Date.parse(checkout.upgrade_allowance_start)
    ) throw new Error("upgrade_allowance_changed");
    const current = await provider.request(
      `/subscriptions/${checkout.upgrade_subscription_id}`,
    );
    if (
      current.organization_consumer_id !== checkout.consumer_id ||
      Date.parse(current.current_period_start) !==
        Date.parse(checkout.upgrade_period_start)
    ) throw new Error("upgrade_period_changed");
    // Replacing a same-plan coupon-removal change is safe; other merchant changes need review.
    const pending = current.pending_change;
    const benign = Boolean(
      pending && pending.target_items?.length === 1 &&
        pending.target_items[0].product_id === current.items?.[0]?.product_id &&
        pending.target_recurring_interval === current.recurring_interval &&
        pending.target_subscription_coupon_ids?.length === 0,
    );
    await scheduleStreamChange(
      provider,
      checkout.upgrade_subscription_id,
      checkout.target_product_id,
      renewalInterval,
      benign,
      current,
    );
  }
  if (checkout.kind === "SUBSCRIPTION") {
    if (!subscriptionId) throw new Error("invoice_subscription_missing");
    subscription = verifiedSubscription ||
      await provider.request(`/subscriptions/${subscriptionId}`);
    if (
      subscription.organization_consumer_id !== checkout.consumer_id ||
      subscription.currency !== "SAR"
    ) throw new Error("subscription_customer_mismatch");
    let expectedProduct = checkout.product_id;
    if (
      checkout.status === "PAID" && first && first.invoice_id !== invoice.id
    ) {
      const { data: catalog, error } = await admin.from("billing_catalog")
        .select("product_id").eq("environment", environment).eq(
          "plan",
          checkout.plan,
        ).eq("billing_interval", renewalInterval).single();
      if (error) throw error;
      expectedProduct = catalog.product_id;
    }
    if (
      !Array.isArray(subscription.items) || subscription.items.length !== 1 ||
      subscription.items[0].product_id !== expectedProduct ||
      subscription.items[0].quantity !== 1
    ) throw new Error("subscription_product_mismatch");
    if (
      checkout.status === "PAID" && first && first.invoice_id !== invoice.id
    ) {
      checkout = { ...checkout, billing_interval: renewalInterval };
    }
    if (
      subscription.recurring_interval !== providerInterval(renewalInterval) ||
      subscription.recurring_interval_count !== 1
    ) throw new Error("subscription_interval_mismatch");
    // A coupon on initial checkout must not silently discount every renewal.
    if (checkout.launch_offer && !first) {
      await scheduleStreamChange(
        provider,
        subscriptionId,
        checkout.product_id,
        renewalInterval,
        false,
        subscription,
      );
    }
    // Never grant a new cycle using an old paid invoice with a newer unpaid subscription period.
    const scheduled = Date.parse(
      String(invoice.payments?.[0]?.scheduled_on || invoice.created_at),
    );
    const start = Date.parse(subscription.current_period_start);
    if (
      !recorded &&
      (!Number.isFinite(scheduled) || !Number.isFinite(start) ||
        scheduled < start - 86400000 || scheduled > start + 86400000)
    ) throw new Error("invoice_period_requires_review");
  }
  const result = await admin.rpc("billing_apply_invoice", {
    p_checkout: checkout.id,
    p_invoice: invoice.id,
    p_subscription: subscriptionId || null,
    p_start: subscription?.current_period_start ||
      null,
    p_end: subscription?.current_period_end || null,
    p_refunded: halalas(invoice.total_refunded || "0"),
    p_amount: expected,
    p_plan: checkout.kind === "SUBSCRIPTION" ? checkout.plan : null,
    p_interval: renewalInterval,
  });
  if (result.error) throw result.error;
  return true;
}

export async function reconcileStreamSubscription(
  environment: BillingEnvironment,
  id: string,
) {
  if (
    environment === "live" &&
    Deno.env.get("STREAM_LIVE_BILLING_ENABLED") !== "true"
  ) return;
  const admin = adminClient();
  const provider = new StreamProvider(
    Deno.env.get(
      environment === "sandbox"
        ? "STREAM_SANDBOX_X_API_KEY"
        : "STREAM_X_API_KEY",
    ) || "",
  );
  const subscription = await provider.request(`/subscriptions/${id}`);
  const status = subscription.status === "FROZEN"
    ? "FROZEN"
    : subscription.status === "CANCELED"
    ? "CANCELED"
    : subscription.status === "ACTIVE"
    ? "ACTIVE"
    : "PAST_DUE";
  // Only an invoice grants time/allowance. Current provider status can restrict an existing subscription.
  const { data: account, error: accountError } = await admin.from(
    "store_billing",
  ).select("last_invoice_id,billing_interval,pending_interval,updated_at").eq(
    "environment",
    environment,
  ).eq(
    "subscription_id",
    id,
  ).maybeSingle();
  if (accountError) throw accountError;
  const { data: payment, error: paymentError } = account?.last_invoice_id
    ? await admin.from("billing_payments").select(
      "amount_halalas,refunded_halalas",
    ).eq("environment", environment).eq("invoice_id", account.last_invoice_id)
      .maybeSingle()
    : { data: null, error: null };
  if (paymentError) throw paymentError;
  const refunded = payment &&
    payment.refunded_halalas >= payment.amount_halalas;
  let pendingInterval = account?.pending_interval || null;
  if (subscription.pending_change) {
    const target = subscription.pending_change.target_recurring_interval;
    pendingInterval =
      target === "YEAR" && account?.billing_interval !== "annual"
        ? "annual"
        : target === "MONTH" && account?.billing_interval !== "monthly"
        ? "monthly"
        : null;
  } else if (
    account?.updated_at && Date.parse(account.updated_at) < Date.now() - 300000
  ) pendingInterval = null;
  const result = await admin.from("store_billing").update({
    pending_interval: pendingInterval,
    status: refunded ? "FROZEN" : status,
    cancel_at_period_end: subscription.cancel_at_period_end === true,
    updated_at: new Date().toISOString(),
  }).eq("environment", environment).eq("subscription_id", id);
  if (result.error) throw result.error;
}
