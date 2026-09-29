import { corsHeaders, env, json } from "../_shared/http.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const authorization = request.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401);
    const client = userClient(authorization);
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: "authentication_required" }, 401);
    const { storeId, action = "connect" } = await request.json();
    if (typeof storeId !== "string") return json({ error: "invalid_request" }, 400);
    const { data: membership } = await client.from("memberships").select("role")
      .eq("store_id", storeId).eq("user_id", user.id).maybeSingle();
    if (!membership || !["owner", "admin"].includes(membership.role)) return json({ error: "insufficient_permission" }, 403);

    const admin = adminClient();
    if (action === "disconnect") {
      await admin.from("whatsapp_connections").update({ status: "DISCONNECTED", updated_at: new Date().toISOString() })
        .eq("store_id", storeId);
      return json({ connected: false });
    }
    const phoneNumberId = env("WHATSAPP_PHONE_NUMBER_ID");
    const { data, error } = await admin.from("whatsapp_connections").upsert({
      store_id: storeId,
      business_account_id: env("WHATSAPP_WABA_ID"),
      phone_number_id: phoneNumberId,
      display_phone_number: Deno.env.get("WHATSAPP_DISPLAY_PHONE_NUMBER") ?? null,
      verified_name: "Reload Test",
      status: "CONNECTED",
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "store_id" }).select("status, display_phone_number, connected_at, last_webhook_at").single();
    if (error) throw error;
    return json({ connected: true, connection: data });
  } catch (error) {
    console.error("whatsapp_connection_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "whatsapp_connection_failed" }, 500);
  }
});
