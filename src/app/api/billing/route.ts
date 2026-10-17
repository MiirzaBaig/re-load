import {
  billingAdmin,
  billingEnvironment,
  billingMember,
  billingOrigin,
  streamProvider,
} from "@/lib/billing-server";
import {
  BILLING_PLANS,
  isBillingPlan,
  safeStreamUrl,
  halalas,
  isBillingInterval,
  billingPrice,
} from "../../../../supabase/functions/_shared/billing-contract";

import { scheduleStreamChange } from "../../../../supabase/functions/_shared/stream-schedule";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const member = await billingMember(
    new URL(request.url).searchParams.get("store"),
  );
  if (!member)
    return Response.json(
      { error: "Sign in to this store to view billing." },
      { status: 403 },
    );
  const environment = billingEnvironment();
  const { data, error } = await member.client.rpc("billing_snapshot", {
    p_store: member.storeId,
    p_environment: environment,
  });
  if (error)
    return Response.json(
      { error: "Billing is temporarily unavailable. Please retry." },
      { status: 503 },
    );
  const admin = billingAdmin();
  const { data: payments } = await admin
    .from("billing_payments")
    .select(
      "amount_halalas,refunded_halalas,plan,kind,paid_at,billing_interval",
    )
    .eq("store_id", member.storeId)
    .eq("environment", environment)
    .order("paid_at", { ascending: false })
    .limit(12);
  const pending = await admin
    .from("billing_checkouts")
    .select(
      "id,status,kind,plan,billing_interval,amount_halalas,created_at,expires_at,payment_link_id",
    )
    .eq("store_id", member.storeId)
    .eq("environment", environment)
    .in("status", ["CREATING", "READY", "REVIEW"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pending.error)
    return Response.json(
      { error: "Could not check pending payments." },
      { status: 503 },
    );
  return Response.json(
    {
      ...data,
      storeName:
        (
          await admin
            .from("stores")
            .select("name")
            .eq("id", member.storeId)
            .single()
        ).data?.name || null,
      pendingCheckout: pending.data
        ? { ...pending.data, payment_link_id: undefined }
        : null,
      environment,
      canManage:
        ["owner", "admin"].includes(member.role) &&
        (environment === "live" ||
          (process.env.STREAM_SANDBOX_ALLOWED_EMAILS || "mirzaa@reload.sa")
            .split(",")
            .map((email) => email.trim().toLowerCase())
            .includes(member.user.email?.toLowerCase() || "")),
      payments: payments ?? [],
      bundlesAvailable:
        process.env.STREAM_BUNDLES_ENABLED === "true" &&
        data?.bundlePriceHalalas !== null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    billingOrigin(request);
    const body = await request.json();
    const member = await billingMember(body.storeId, true);
    if (!member)
      return Response.json(
        { error: "Only this store’s owner or admin can manage billing." },
        { status: 403 },
      );
    const admin = billingAdmin();
    const environment = billingEnvironment();
    if (
      environment === "sandbox" &&
      !(process.env.STREAM_SANDBOX_ALLOWED_EMAILS || "mirzaa@reload.sa")
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .includes(member.user.email?.toLowerCase() || "")
    )
      return Response.json(
        {
          error:
            "Sandbox billing is limited to authorized Reload test accounts.",
        },
        { status: 403 },
      );
    const provider = streamProvider();
    const { data: billing, error: billingError } = await admin
      .from("store_billing")
      .select("*")
      .eq("store_id", member.storeId)
      .eq("environment", environment)
      .maybeSingle();
    if (billingError) throw new Error("billing_unavailable");
    if (body.action === "verify") {
      if (
        typeof body.invoiceId !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(body.invoiceId)
      )
        return Response.json(
          { error: "Payment confirmation is pending." },
          { status: 400 },
        );
      const invoice = await provider.request(`/invoices/${body.invoiceId}`);
      const { data: checkout, error } = await admin
        .from("billing_checkouts")
        .select("id")
        .eq("environment", environment)
        .eq("store_id", member.storeId)
        .eq("payment_link_id", invoice.payment_link_id)
        .maybeSingle();
      if (error || !checkout)
        return Response.json(
          { error: "This payment could not be matched to your store." },
          { status: 403 },
        );
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const verified = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/billing-verify`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "x-billing-internal-token":
              process.env.STREAM_INTERNAL_VERIFY_TOKEN || "",
            apikey: key || "",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ environment, invoiceId: body.invoiceId }),
          signal: AbortSignal.timeout(30000),
        },
      );
      if (!verified.ok)
        return Response.json(
          {
            error: "Payment is awaiting confirmation. Please do not pay again.",
          },
          { status: 409 },
        );
      return Response.json({ checked: true });
    }
    if (body.action === "sync") {
      const pending = await admin
        .from("billing_checkouts")
        .select("payment_link_id")
        .eq("store_id", member.storeId)
        .eq("environment", environment)
        .in("status", ["READY", "REVIEW"])
        .not("payment_link_id", "is", null)
        .limit(1)
        .maybeSingle();
      if (pending.error) throw new Error("billing_unavailable");
      if (pending.data) {
        const invoices = await provider.request(
          `/invoices?payment_link_id=${pending.data.payment_link_id}&include_payments=true&limit=10`,
        );
        for (const invoice of invoices.data || []) {
          if (invoice.status !== "COMPLETED") continue;
          const r = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/billing-verify`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-billing-internal-token":
                  process.env.STREAM_INTERNAL_VERIFY_TOKEN || "",
              },
              body: JSON.stringify({ environment, invoiceId: invoice.id }),
              signal: AbortSignal.timeout(30000),
            },
          );
          if (!r.ok)
            return Response.json(
              { error: "Payment is being checked. Please do not pay again." },
              { status: 409 },
            );
        }
      }
      if (billing?.subscription_id) {
        const r = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/billing-verify`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-billing-internal-token":
                process.env.STREAM_INTERNAL_VERIFY_TOKEN || "",
            },
            body: JSON.stringify({
              environment,
              subscriptionId: billing.subscription_id,
            }),
            signal: AbortSignal.timeout(30000),
          },
        );
        if (!r.ok)
          return Response.json(
            { error: "Subscription update is waiting for confirmation." },
            { status: 409 },
          );
      }
      return Response.json({ checked: true });
    }
    if (body.action === "schedule_interval") {
      if (
        !isBillingInterval(body.interval) ||
        !billing?.subscription_id ||
        billing.status !== "ACTIVE" ||
        Date.parse(billing.period_end) <= Date.now() ||
        billing.cancel_at_period_end
      )
        return Response.json(
          { error: "An active renewing subscription is required." },
          { status: 409 },
        );
      const open = await admin
        .from("billing_checkouts")
        .select("id")
        .eq("store_id", member.storeId)
        .eq("environment", environment)
        .in("status", ["CREATING", "READY", "REVIEW"])
        .limit(1);
      if (open.error || open.data?.length)
        return Response.json(
          { error: "Finish your pending checkout before changing billing." },
          { status: 409 },
        );
      const catalog = await admin
        .from("billing_catalog")
        .select("product_id")
        .eq("environment", environment)
        .eq("plan", billing.plan)
        .eq("billing_interval", body.interval)
        .single();
      if (catalog.error) throw new Error("catalog_unavailable");
      const lock = await admin.rpc("billing_request_interval", {
        p_store: member.storeId,
        p_environment: environment,
        p_user: member.user.id,
        p_interval: body.interval,
      });
      if (lock.error)
        return Response.json(
          {
            error:
              "A billing change is already in progress. Refresh before trying again.",
          },
          { status: 409 },
        );
      await scheduleStreamChange(
        provider,
        billing.subscription_id,
        catalog.data.product_id,
        body.interval,
        true,
      );
      const saved = await admin
        .from("store_billing")
        .update({
          pending_interval: body.interval,
          updated_at: new Date().toISOString(),
        })
        .eq("store_id", member.storeId)
        .eq("environment", environment)
        .eq("subscription_id", billing.subscription_id);
      if (saved.error) throw new Error("billing_unavailable");
      return Response.json({ scheduled: true });
    }
    if (body.action === "portal") {
      if (!billing?.consumer_id)
        return Response.json(
          { error: "Subscribe before opening billing management." },
          { status: 409 },
        );
      // The hosted portal is consumer-wide, not a tenant-scoped subscription view.
      const related = await admin
        .from("store_billing")
        .select("store_id")
        .eq("environment", environment)
        .eq("consumer_id", billing.consumer_id);
      if (related.error) throw new Error("billing_unavailable");
      const ids = (related.data || []).map((row) => row.store_id);
      const memberships = await admin
        .from("memberships")
        .select("store_id")
        .eq("user_id", member.user.id)
        .in("store_id", ids)
        .in("role", ["owner", "admin"]);
      if (
        memberships.error ||
        new Set((memberships.data || []).map((row) => row.store_id)).size !==
          new Set(ids).size
      )
        return Response.json(
          {
            error:
              "Ask your billing account owner to manage this subscription. The billing account is shared with another workspace.",
          },
          { status: 403 },
        );
      return Response.json({ url: await provider.portal(billing.consumer_id) });
    }
    if (
      !["checkout", "quote"].includes(body.action) ||
      !isBillingPlan(body.plan)
    )
      return Response.json({ error: "Choose a plan." }, { status: 400 });
    const interval = body.interval === undefined ? "monthly" : body.interval;
    if (!isBillingInterval(interval))
      return Response.json(
        { error: "Choose monthly or annual billing." },
        { status: 400 },
      );
    const effectiveInterval =
      body.kind === "UPGRADE" || body.kind === "BUNDLE"
        ? billing?.billing_interval || "monthly"
        : interval;
    const planKey = body.plan as "standard" | "premium";
    const plan = BILLING_PLANS[planKey];
    const kind =
      body.kind === "UPGRADE"
        ? "UPGRADE"
        : body.kind === "BUNDLE"
          ? "BUNDLE"
          : "SUBSCRIPTION";
    const { data: catalog } = await admin
      .from("billing_catalog")
      .select("product_id,coupon_id")
      .eq("environment", environment)
      .eq("plan", body.plan)
      .eq("billing_interval", effectiveInterval)
      .maybeSingle();
    if (!catalog)
      return Response.json(
        {
          error:
            "Checkout is being prepared. Your setup is saved; please try again shortly.",
        },
        { status: 503 },
      );
    if (body.action === "quote") {
      if (
        kind !== "UPGRADE" ||
        billing?.plan !== "standard" ||
        billing.status !== "ACTIVE" ||
        billing.pending_interval ||
        Date.parse(billing.period_end) <= Date.now()
      )
        return Response.json(
          { error: "Upgrade is not available. Refresh billing." },
          { status: 409 },
        );
      const snapshot = await admin.rpc("billing_snapshot", {
        p_store: member.storeId,
        p_environment: environment,
      });
      if (snapshot.error) throw new Error("billing_unavailable");
      const now = Date.now();
      const start = Date.parse(billing.period_start);
      const end = Date.parse(billing.period_end);
      const monthStart = Date.parse(snapshot.data.allowanceStart),
        monthEnd = Date.parse(snapshot.data.allowanceEnd);
      const amount = Math.ceil(
        ((effectiveInterval === "annual" ? 144000 : 15000) * (end - now)) /
          (end - start),
      );
      if (amount < 100)
        return Response.json(
          { error: "Your renewal is close. Contact Reload to change plans." },
          { status: 409 },
        );
      return Response.json({
        amountHalalas: amount,
        messages: Math.floor(
          (1500 * (monthEnd - now)) / (monthEnd - monthStart),
        ),
        periodEnd: billing.period_end,
        allowanceEnd: snapshot.data.allowanceEnd,
        interval: effectiveInterval,
      });
    }
    const started = await admin.rpc("billing_start_checkout", {
      p_store: member.storeId,
      p_environment: environment,
      p_user: member.user.id,
      p_plan: body.plan,
      p_kind: kind,
      p_interval: effectiveInterval,
    });
    if (started.error)
      return Response.json(
        {
          error:
            "You already have a subscription or checkout in progress. Refresh billing or manage your existing subscription.",
        },
        { status: 409 },
      );
    const checkout = started.data;
    if (!checkout) throw new Error("checkout_unavailable");
    if (
      checkout.checkout_url &&
      checkout.status === "READY" &&
      Date.parse(checkout.expires_at) > Date.now()
    )
      return Response.json({ url: safeStreamUrl(checkout.checkout_url) });
    // A newly inserted checkout belongs to this request; competing requests wait.
    const lock = await admin
      .from("billing_checkouts")
      .update({ status: "REVIEW" })
      .eq("id", checkout.id)
      .eq("status", "CREATING")
      .select("id")
      .maybeSingle();
    if (lock.error || !lock.data)
      return Response.json(
        { error: "Checkout is being prepared. Please refresh in a moment." },
        { status: 409 },
      );
    try {
      if (
        environment === "sandbox" &&
        !(process.env.STREAM_SANDBOX_ALLOWED_EMAILS || "mirzaa@reload.sa")
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .includes(member.user.email?.toLowerCase() || "")
      )
        throw new Error("sandbox_customer_required");
      let consumerId = billing?.consumer_id;
      if (!consumerId) {
        // Consumers may be shared across stores owned by the same person; payments remain checkout/store-bound.
        const { data: old } = await admin
          .from("billing_checkouts")
          .select("consumer_id")
          .eq("environment", environment)
          .eq("user_id", member.user.id)
          .not("consumer_id", "is", null)
          .limit(1)
          .maybeSingle();
        consumerId = old?.consumer_id;
      }
      if (!consumerId) {
        const customers = await provider.request(
          `/consumers?search_term=${encodeURIComponent(environment === "sandbox" ? process.env.STREAM_SANDBOX_CUSTOMER_EMAIL || "mirzaa@reload.sa" : member.user.email || member.user.id)}&limit=100`,
        );
        const existing = Array.isArray(customers.data)
          ? customers.data.find(
              (c: Record<string, unknown>) =>
                (c.external_id === member.user.id &&
                  c.email === member.user.email) ||
                (environment === "sandbox" &&
                  c.email ===
                    (process.env.STREAM_SANDBOX_CUSTOMER_EMAIL ||
                      "mirzaa@reload.sa")),
            )
          : null;
        consumerId = existing?.id;
      }
      if (!consumerId) {
        const sandboxUser =
          environment === "sandbox" ? await provider.request("/user") : null;
        if (
          sandboxUser &&
          (sandboxUser.organization?.sandbox !== true ||
            sandboxUser.email?.toLowerCase() !==
              (
                process.env.STREAM_SANDBOX_CUSTOMER_EMAIL || "mirzaa@reload.sa"
              ).toLowerCase())
        )
          throw new Error("sandbox_customer_required");
        const customer = await provider.request("/consumers", "POST", {
          name: sandboxUser
            ? [sandboxUser.first_name, sandboxUser.last_name]
                .filter(Boolean)
                .join(" ")
            : member.user.user_metadata?.full_name || "Reload Merchant",
          email: sandboxUser?.email || member.user.email,
          external_id: member.user.id,
          communication_methods: ["EMAIL"],
        });
        consumerId = customer.id;
      }
      if (!consumerId) throw new Error("consumer_unavailable");
      if (checkout.launch_offer && !catalog.coupon_id)
        throw new Error("offer_not_configured");
      let productId = catalog.product_id;
      if (kind === "UPGRADE" || kind === "BUNDLE") {
        if (kind === "BUNDLE" && process.env.STREAM_BUNDLES_ENABLED !== "true")
          throw new Error("bundles_not_available");
        const product = await provider.request("/products", "POST", {
          name:
            kind === "UPGRADE"
              ? "Reload Premium upgrade"
              : "Reload extra 2,000 messages",
          type: "ONE_OFF",
          prices: [
            {
              currency: "SAR",
              amount: (checkout.amount_halalas / 100).toFixed(2),
              is_price_exempt_from_vat: false,
            },
          ],
          is_one_time: true,
        });
        productId = product.id;
      }
      const customerSaved = await admin
        .from("billing_checkouts")
        .update({
          consumer_id: consumerId,
          product_id: productId,
          target_product_id: kind === "UPGRADE" ? catalog.product_id : null,
        })
        .eq("id", checkout.id);
      if (customerSaved.error) throw new Error("checkout_save_failed");
      const origin =
        process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
      const result = await provider.request("/payment_links", "POST", {
        name: `Reload ${plan.name}${kind === "UPGRADE" ? " upgrade" : kind === "BUNDLE" ? " extra messages" : ""}`,
        description:
          kind === "UPGRADE"
            ? `One-time prorated upgrade: SAR ${checkout.amount_halalas / 100}. Adds ${checkout.upgrade_messages} messages to your current monthly allowance; subsequent months receive 2,000. Paid access lasts until ${checkout.upgrade_period_end}. Premium renews at SAR ${billingPrice("premium", effectiveInterval) / 100}/${effectiveInterval === "annual" ? "year" : "month"}, VAT included.`
            : kind === "BUNDLE"
              ? "2,000 extra messages. Unused purchased messages carry over. Premium subscription required."
              : checkout.launch_offer
                ? `First month SAR ${checkout.amount_halalas / 100}. Renews at SAR ${plan.price / 100}/month, VAT included.`
                : `SAR ${billingPrice(planKey, effectiveInterval) / 100}/${effectiveInterval === "annual" ? "year" : "month"}, VAT included. ${plan.messages} outgoing messages refresh monthly. One store.`,
        currency: "SAR",
        items: [{ product_id: productId, quantity: 1 }],
        coupons: checkout.launch_offer ? [catalog.coupon_id] : [],
        max_number_of_payments: 1,
        valid_until: checkout.expires_at,
        organization_consumer_id: consumerId,
        contact_information_type: "EMAIL",
        success_redirect_url: `${origin}/app/billing?checkout=return&store=${member.storeId}`,
        failure_redirect_url: `${origin}/app/billing?checkout=failed&store=${member.storeId}`,
        custom_metadata: { reload_checkout: checkout.id, environment },
      });
      if (
        halalas(result.amount) !== checkout.amount_halalas ||
        result.currency !== "SAR"
      )
        throw new Error("checkout_price_mismatch");
      const url = safeStreamUrl(result.url);
      const saved = await admin
        .from("billing_checkouts")
        .update({
          status: "READY",
          consumer_id: consumerId,
          product_id: productId,
          payment_link_id: result.id,
          checkout_url: url,
        })
        .eq("id", checkout.id);
      if (saved.error) throw new Error("checkout_save_failed");
      return Response.json({ url });
    } catch (error) {
      // An ambiguous provider timeout is kept for review, never blindly retried into a second subscription.
      const code = error instanceof Error ? error.message : "unknown";
      if (
        code === "sandbox_customer_required" ||
        code === "offer_not_configured" ||
        code === "bundles_not_available"
      )
        await admin
          .from("billing_checkouts")
          .update({ status: "FAILED" })
          .eq("id", checkout.id);
      console.error(
        "billing_checkout_failed",
        code.startsWith("stream_") ? code : "setup_or_provider_error",
      );
      return Response.json(
        {
          error:
            code === "sandbox_customer_required"
              ? "Sandbox checkout is limited to the registered Stream test user. No charge was made."
              : "We couldn’t prepare checkout. Please contact Reload before trying again; your setup is saved.",
        },
        { status: 503 },
      );
    }
  } catch {
    return Response.json(
      { error: "Could not open billing. Please refresh and try again." },
      { status: 400 },
    );
  }
}
