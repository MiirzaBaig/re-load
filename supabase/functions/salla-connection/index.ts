import { sallaAccessToken } from "../_shared/salla.ts";
import { corsHeaders, json } from "../_shared/http.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }
  try {
    const authorization = request.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) {
      return json({ error: "authentication_required" }, 401);
    }
    const client = userClient(authorization);
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: "authentication_required" }, 401);
    const { storeId, action } = await request.json();
    if (!storeId || !["test", "disconnect"].includes(action)) {
      return json({ error: "invalid_request" }, 400);
    }
    const { data: membership } = await client.from("memberships").select("role")
      .eq("store_id", storeId).eq("user_id", user.id).in("role", [
        "owner",
        "admin",
      ]).maybeSingle();
    if (!membership) return json({ error: "insufficient_permission" }, 403);

    const admin = adminClient();
    if (action === "disconnect") {
      const { error } = await admin.rpc("disconnect_salla_connection", {
        p_store_id: storeId,
      });
      if (error) throw error;
      return json({ disconnected: true });
    }

    const { data: credentials, error: credentialError } = await admin.rpc(
      "get_salla_credential",
      { p_store_id: storeId },
    );
    if (credentialError || !credentials?.[0]) {
      return json({ error: "connection_not_found" }, 404);
    }
    const response = await fetch("https://accounts.salla.sa/oauth2/user/info", {
      headers: {
        Authorization: `Bearer ${await sallaAccessToken(storeId)}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (!response.ok) {
      await admin.from("commerce_connections").update({
        status: response.status === 401 ? "EXPIRED" : "ERROR",
        last_error_code: `SALLA_${response.status}`,
        updated_at: new Date().toISOString(),
      }).eq("id", credentials[0].connection_id).eq("status", "CONNECTED");
      return json({ error: "connection_test_failed" }, 502);
    }
    const identity = await response.json();
    const data = identity.data ?? identity;
    const merchant = data.merchant ?? data.store;
    const { data: connection } = await admin.from("commerce_connections")
      .select("external_store_id")
      .eq("id", credentials[0].connection_id).single();
    if (
      !merchant?.id || String(merchant.id) !== connection?.external_store_id
    ) {
      return json({ error: "connection_identity_mismatch" }, 409);
    }
    const { data: checked, error: checkError } = await admin.from(
      "commerce_connections",
    ).update({
      last_synced_at: new Date().toISOString(),
      last_error_code: null,
      updated_at: new Date().toISOString(),
    }).eq("id", credentials[0].connection_id).eq("status", "CONNECTED").select(
      "id",
    ).maybeSingle();
    if (checkError || !checked) {
      return json({ error: "connection_changed" }, 409);
    }
    return json({ connected: true });
  } catch (error) {
    console.error(
      "salla_connection_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return json({ error: "salla_connection_failed" }, 500);
  }
});
