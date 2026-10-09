import { decrypt, sha256 } from "../_shared/crypto.ts";
import { ZidMcp, zidOrderFacts } from "../_shared/zid-mcp.ts";
import { corsHeaders, json } from "../_shared/http.ts";
import { signReturnFacts } from "../_shared/return-token.ts";
import { sallaGet } from "../_shared/salla.ts";
import { adminClient } from "../_shared/supabase.ts";

function normalizeVerifier(value: string) {
  const clean = value.trim().toLowerCase();
  if (clean.includes("@")) return clean;
  const digits = clean.replace(/\D/g, "");
  return digits.length > 9 ? digits.slice(-9) : digits;
}

function statusOf(order: Record<string, any>) {
  const raw = String(order.status?.slug ?? order.status?.name ?? order.status ?? "").toLowerCase();
  if (raw.includes("deliver") || raw.includes("complete")) return "delivered";
  if (raw.includes("ship")) return "shipped";
  if (raw.includes("cancel")) return "cancelled";
  return "processing";
}

function isoDate(value: unknown): string | null {
  const raw = typeof value === "string" ? value : value && typeof value === "object" && "date" in value ? String((value as { date: unknown }).date) : "";
  if (!raw) return null;
  const parsed = new Date(raw.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function customerVerifier(order: Record<string, any>) {
  const customer = order.customer ?? {};
  const receiver = order.shipping?.receiver ?? order.receiver ?? {};
  return [customer.email, customer.mobile, customer.phone, receiver.email, receiver.phone, receiver.mobile]
    .filter((item) => item !== null && item !== undefined).map((item) => normalizeVerifier(String(item)));
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const { returnCode, orderNumber, verifier } = await request.json();
    if (![returnCode, orderNumber, verifier].every((value) => typeof value === "string" && value.trim())) {
      return json({ error: "invalid_request" }, 400);
    }
    const admin = adminClient();
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const bucket = await sha256(`${returnCode}:${forwarded}`);
    const { data: allowed } = await admin.rpc("consume_public_rate_limit", { p_bucket: bucket, p_limit: 10, p_window_seconds: 600 });
    if (!allowed) return json({ error: "try_again_later" }, 429);

    const { data: store } = await admin.from("stores").select("id").eq("return_code", returnCode).maybeSingle();
    if (!store) return json({ error: "order_not_verified" }, 404);

    // Despite this function's name it serves every store platform: callers
    // (web return page, WhatsApp) don't need to know where a store sells. A
    // store connected through Zid's AI Connector is looked up live in Zid.
    const { data: zid } = await admin.rpc("get_zid_credential", { p_store_id: store.id });
    if (zid?.[0]) {
      const facts = await zidOrderFacts(new ZidMcp(await decrypt(zid[0].link_ciphertext)), store.id, orderNumber, verifier);
      void admin.from("audit_events").insert({
        store_id: store.id, event_type: "ZID_ORDER_LOOKUP", entity_type: "order",
        metadata: { platform: "zid", verified: Boolean(facts) },
      });
      if (!facts) return json({ error: "order_not_verified" }, 404);
      if (facts.items.length === 0) return json({ error: "order_items_unavailable" }, 422);
      return json({ order: facts, verificationToken: await signReturnFacts(facts) });
    }

    const query = new URLSearchParams({ reference_id: orderNumber.trim(), per_page: "1", page: "1" });
    const list = await sallaGet(store.id, `/orders?${query.toString()}`);
    const candidate = Array.isArray(list?.data) ? list.data[0] : null;
    if (!candidate?.id) return json({ error: "order_not_verified" }, 404);

    const [orderResponse, itemsResponse] = await Promise.all([
      sallaGet(store.id, `/orders/${encodeURIComponent(String(candidate.id))}?format=light`),
      sallaGet(store.id, `/orders/items?order_id=${encodeURIComponent(String(candidate.id))}`),
    ]);
    const order = (orderResponse?.data ?? candidate) as Record<string, any>;
    const supplied = normalizeVerifier(verifier);
    if (!supplied || !customerVerifier(order).includes(supplied)) return json({ error: "order_not_verified" }, 404);

    const rawItems = Array.isArray(itemsResponse?.data) ? itemsResponse.data : [];
    const facts = {
      storeId: store.id,
      orderId: String(order.reference_id ?? order.id),
      externalOrderId: String(order.id),
      orderDate: isoDate(order.date) ?? new Date().toISOString(),
      deliveryDate: isoDate(order.delivered_at ?? order.delivery_date ?? order.shipping?.delivered_at),
      orderStatus: statusOf(order),
      customerEmail: String(order.customer?.email ?? order.receiver?.email ?? ""),
      customerName: String(order.customer?.first_name ? `${order.customer.first_name} ${order.customer.last_name ?? ""}`.trim() : order.customer?.name ?? order.receiver?.name ?? "Customer"),
      items: rawItems.map((item: Record<string, any>) => ({
        id: String(item.id), name: String(item.name ?? item.product?.name ?? "Item"),
        sku: String(item.sku ?? item.product?.sku ?? ""), quantity: Math.max(1, Number(item.quantity ?? 1)),
        price: Number(item.amounts?.price_without_tax?.amount ?? item.amounts?.total?.amount ?? item.price?.amount ?? 0),
        imageUrl: item.product?.thumbnail ?? item.product?.image?.url ?? undefined,
      })),
      currency: String(order.currency ?? rawItems[0]?.currency ?? "SAR"),
    };
    if (facts.items.length === 0) return json({ error: "order_items_unavailable" }, 422);
    return json({ order: facts, verificationToken: await signReturnFacts(facts) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("salla_order_lookup_failed", message);
    if (message === "salla_reauthorization_required") return json({ error: message }, 503);
    return json({ error: "order_lookup_unavailable" }, 503);
  }
});
