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
    const token = authorization.slice(7).split(".")[1];
    let assurance = "";
    try { assurance = JSON.parse(atob(token.replace(/-/g, "+").replace(/_/g, "/"))).aal; } catch { /* invalid claim */ }
    const { data: staff } = await client.from("platform_admins").select("role").eq("user_id", user.id).maybeSingle();
    if (staff?.role !== "owner" || assurance !== "aal2") return json({ error: "platform_owner_required" }, 403);

    const admin = adminClient();
    if (action === "disconnect") {
      const { error } = await admin.from("whatsapp_connections").update({ status: "DISCONNECTED", updated_at: new Date().toISOString() })
        .eq("store_id", storeId);
      if (error) throw error;
      return json({ connected: false });
    }
    if (action !== "connect") return json({ error: "invalid_action" }, 400);
    const { data: store } = await admin.from("stores").select("id").eq("id", storeId).maybeSingle();
    if (!store) return json({ error: "store_not_found" }, 404);
    const { data: commerce } = await admin.from("commerce_connections").select("id").eq("store_id", storeId).eq("status", "CONNECTED").maybeSingle();
    const { data: policy } = await admin.from("policy_versions").select("id").eq("store_id", storeId).limit(1).maybeSingle();
    if (!commerce || !policy) return json({ error: "store_setup_incomplete" }, 409);
    const phoneNumberId = env("WHATSAPP_PHONE_NUMBER_ID");
    const { data: assigned } = await admin.from("whatsapp_connections").select("store_id").eq("phone_number_id", phoneNumberId).maybeSingle();
    if (assigned && assigned.store_id !== storeId) return json({ error: "number_assigned_to_another_store" }, 409);
    const version = Deno.env.get("WHATSAPP_GRAPH_VERSION")?.trim() || "v25.0";
    const response = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name,status`, {
      headers: { Authorization: `Bearer ${env("WHATSAPP_ACCESS_TOKEN")}` },
    });
    if (!response.ok) return json({ error: "meta_number_unavailable" }, 502);
    const meta = await response.json() as { display_phone_number?: string; verified_name?: string; status?: string };
    if (meta.status !== "CONNECTED") return json({ error: "meta_number_not_ready" }, 409);
    const { data, error } = await admin.from("whatsapp_connections").upsert({
      store_id: storeId,
      business_account_id: env("WHATSAPP_WABA_ID"),
      phone_number_id: phoneNumberId,
      display_phone_number: meta.display_phone_number ?? Deno.env.get("WHATSAPP_DISPLAY_PHONE_NUMBER") ?? null,
      verified_name: meta.verified_name ?? "Reload",
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
