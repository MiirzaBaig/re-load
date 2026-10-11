import { corsHeaders, json } from "../_shared/http.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";
import { zidOrderTracking, zidProductDetails, zidProductSearch, zidProductsFor } from "../_shared/zid-catalog.ts";

/*
 * HTTP door to the Zid customer-service tools, for other server functions
 * (the WhatsApp worker) and for a store's owner or admin to test their own
 * catalog. Never public: a server key or a signed-in member of that store.
 *
 *   { storeId, action: "search",   query, limit?, language? }
 *   { storeId, action: "details",  productId, language? }
 *   { storeId, action: "answer",   query, limit?, language? }   search + details
 *   { storeId, action: "tracking", orderNumber, verifier }      server key only
 */

const STATUS: Record<string, number> = { not_connected: 409, connection_expired: 409, lookup_failed: 502, not_found: 404, unavailable: 404 };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await request.json().catch(() => null);
    const storeId = body?.storeId;
    if (typeof storeId !== "string" || !/^[0-9a-f-]{36}$/i.test(storeId)) return json({ error: "invalid_request" }, 400);

    const authorization = request.headers.get("authorization") ?? "";
    const serverKey = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const server = Boolean(serverKey) && authorization === `Bearer ${serverKey}`;
    if (!server) {
      const client = userClient(authorization);
      const { data: { user } } = await client.auth.getUser();
      if (!user) return json({ error: "authentication_required" }, 401);
      const { data: member } = await client.from("memberships").select("role").eq("user_id", user.id).eq("store_id", storeId).in("role", ["owner", "admin"]).maybeSingle();
      if (!member) return json({ error: "insufficient_permission" }, 403);
    }

    const admin = adminClient();
    const language = body.language === "en" ? "en" : "ar";
    const text = (value: unknown, max: number) => (typeof value === "string" && value.trim() && value.length <= max ? value.trim() : null);

    let result;
    if (body.action === "search" || body.action === "answer") {
      const query = text(body.query, 200);
      if (!query) return json({ error: "invalid_request" }, 400);
      const options = { limit: typeof body.limit === "number" ? body.limit : undefined, language } as const;
      result = body.action === "search" ? await zidProductSearch(admin, storeId, query, options) : await zidProductsFor(admin, storeId, query, options);
    } else if (body.action === "details") {
      const productId = text(body.productId, 64);
      if (!productId) return json({ error: "invalid_request" }, 400);
      result = await zidProductDetails(admin, storeId, productId, language);
    } else if (body.action === "tracking") {
      // Private order data: only the WhatsApp worker, which has verified the customer.
      if (!server) return json({ error: "insufficient_permission" }, 403);
      const orderNumber = text(body.orderNumber, 40);
      const verifier = text(body.verifier, 160);
      if (!orderNumber || !verifier) return json({ error: "invalid_request" }, 400);
      result = await zidOrderTracking(admin, storeId, orderNumber, verifier);
    } else {
      return json({ error: "invalid_action" }, 400);
    }
    return result.ok ? json(result) : json(result, STATUS[result.error] ?? 500);
  } catch (error) {
    console.error("zid_catalog_failed", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "lookup_failed" }, 502);
  }
});
