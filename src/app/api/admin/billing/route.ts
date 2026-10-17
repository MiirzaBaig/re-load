import { getAdminAccess, logAdminEvent } from "@/lib/admin-access";
import {
  billingAdmin,
  billingOrigin,
  billingEnvironment,
} from "@/lib/billing-server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const access = await getAdminAccess();
  if (!access) return Response.json({ error: "Unauthorized" }, { status: 403 });
  const store = new URL(request.url).searchParams.get("store");
  if (!store) {
    const admin = billingAdmin();
    const environment = billingEnvironment();
    const [payments, checkouts, accounts, events] = await Promise.all([
      admin
        .from("billing_payments")
        .select(
          "invoice_id,store_id,plan,billing_interval,kind,amount_halalas,refunded_halalas,paid_at",
        )
        .eq("environment", environment)
        .order("paid_at", { ascending: false })
        .limit(200),
      admin
        .from("billing_checkouts")
        .select(
          "id,store_id,plan,billing_interval,status,amount_halalas,created_at,expires_at",
        )
        .eq("environment", environment)
        .in("status", ["CREATING", "READY", "REVIEW", "FAILED"])
        .order("created_at", { ascending: false })
        .limit(200),
      admin
        .from("store_billing")
        .select(
          "store_id,plan,billing_interval,pending_interval,status,period_end,cancel_at_period_end",
        )
        .eq("environment", environment)
        .order("updated_at", { ascending: false })
        .limit(1000),
      admin
        .from("streampay_webhook_events")
        .select(
          "id,event_type,received_at,processing_status,processing_attempts",
        )
        .eq("environment", environment)
        .in("processing_status", ["FAILED", "RECEIVED"])
        .order("received_at", { ascending: false })
        .limit(50),
    ]);
    if ([payments, checkouts, accounts, events].some((x) => x.error))
      return Response.json(
        { error: "Could not load payments." },
        { status: 503 },
      );
    const ids = [
      ...new Set(
        [
          ...(payments.data || []),
          ...(checkouts.data || []),
          ...(accounts.data || []),
        ].map((x) => x.store_id),
      ),
    ];
    const stores = ids.length
      ? await admin.from("stores").select("id,name").in("id", ids)
      : { data: [], error: null };
    if (stores.error)
      return Response.json(
        { error: "Could not load stores." },
        { status: 503 },
      );
    await logAdminEvent(access, "BILLING_OVERVIEW_VIEWED", "admin");
    return Response.json(
      {
        environment,
        payments: payments.data,
        checkouts: checkouts.data,
        accounts: accounts.data,
        events: events.data,
        stores: stores.data,
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!store || !/^[0-9a-f-]{36}$/i.test(store))
    return Response.json({ error: "Choose a store." }, { status: 400 });
  const admin = billingAdmin();
  const environment = billingEnvironment();
  const results = await Promise.all([
    admin.rpc("billing_snapshot", {
      p_store: store,
      p_environment: environment,
    }),
    admin
      .from("billing_cost_events")
      .select(
        "provider,operation,input_tokens,output_tokens,cost_sar,cost_basis,created_at",
      )
      .eq("store_id", store)
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1000),
    admin
      .from("billing_payments")
      .select(
        "amount_halalas,refunded_halalas,paid_at,plan,kind,billing_interval",
      )
      .eq("store_id", store)
      .eq("environment", environment)
      .order("paid_at", { ascending: false })
      .limit(50),
  ]);
  if (results.some((r) => r.error))
    return Response.json({ error: "Could not load billing." }, { status: 503 });
  const delivered = await admin
    .from("billing_message_usage")
    .select("id", { count: "exact", head: true })
    .eq("store_id", store)
    .eq("state", "DELIVERED")
    .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
  if (delivered.error)
    return Response.json({ error: "Could not load usage." }, { status: 503 });
  await logAdminEvent(access, "BILLING_VIEWED", "store", store);
  return Response.json(
    {
      snapshot: results[0].data,
      outgoingDelivered: delivered.count || 0,
      costs: results[1].data,
      payments: results[2].data,
      environment,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    billingOrigin(request);
    const access = await getAdminAccess();
    if (access?.role !== "owner")
      return Response.json(
        { error: "Only Reload owners can assign offers." },
        { status: 403 },
      );
    const body = await request.json();
    if (
      typeof body.storeId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(body.storeId) ||
      body.action !== "grant_offer"
    )
      return Response.json({ error: "Choose a store." }, { status: 400 });
    const result = await access.supabase.rpc("billing_grant_offer", {
      p_store: body.storeId,
      p_environment: billingEnvironment(),
    });
    if (result.error)
      return Response.json(
        {
          error:
            "Offer unavailable. It may already be used or the founding merchant limit has been reached.",
        },
        { status: 409 },
      );
    return Response.json({ saved: true });
  } catch {
    return Response.json(
      { error: "Could not update the offer." },
      { status: 400 },
    );
  }
}
