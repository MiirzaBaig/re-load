import { decrypt, encrypt, sha256 } from "../_shared/crypto.ts";
import { corsHeaders, json } from "../_shared/http.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";
import { isZidMcpLink, ZidMcp, ZidMcpError, zidStoreIdentity } from "../_shared/zid-mcp.ts";

/*
 * Connect, check or disconnect a Zid store (AI Connector link).
 *   { storeId, action: "connect", link }  → verifies the link, saves it encrypted
 *   { storeId, action: "test" }           → checks the saved link still works
 *   { storeId, action: "disconnect" }     → deletes the link
 * Only the store's owner/admin may call it. The link is never returned.
 */

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "unknown";
  if (message === "zid_link_invalid") return json({ error: "zid_link_invalid" }, 400);
  return json({ error: "zid_unreachable" }, 502);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const authorization = request.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401);
    const client = userClient(authorization);
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: "authentication_required" }, 401);

    const { storeId, action, link } = await request.json();
    if (typeof storeId !== "string" || !["connect", "test", "disconnect"].includes(action)) return json({ error: "invalid_request" }, 400);
    const { data: membership } = await client.from("memberships").select("role")
      .eq("store_id", storeId).eq("user_id", user.id).in("role", ["owner", "admin"]).maybeSingle();
    if (!membership) return json({ error: "insufficient_permission" }, 403);
    const admin = adminClient();

    if (action === "disconnect") {
      const { error } = await admin.rpc("disconnect_zid_connection", { p_store_id: storeId });
      if (error) throw error;
      return json({ disconnected: true });
    }

    if (action === "connect") {
      if (!isZidMcpLink(link)) return json({ error: "zid_link_invalid" }, 400);
      let identity;
      try {
        identity = await zidStoreIdentity(new ZidMcp(link));
      } catch (error) {
        console.error("zid_connect_check_failed", error instanceof Error ? error.message : "unknown");
        return failure(error);
      }
      // A Zid store can only be linked to one Reload workspace.
      const externalId = identity.storeId ?? `mcp:${(await sha256(link.trim())).slice(0, 24)}`;
      const { data: taken } = await admin.from("commerce_connections").select("store_id")
        .eq("platform", "zid").eq("external_store_id", externalId).neq("store_id", storeId).eq("status", "CONNECTED").maybeSingle();
      if (taken) return json({ error: "zid_store_already_connected" }, 409);

      const { error } = await admin.rpc("save_zid_connection", {
        p_store_id: storeId,
        p_external_store_id: externalId,
        p_external_store_name: identity.storeName,
        p_link_ciphertext: await encrypt(link.trim()),
      });
      if (error) throw error;
      return json({ connected: true, storeName: identity.storeName, latestOrderAt: identity.latestOrderAt });
    }

    // test
    const { data: credentials } = await admin.rpc("get_zid_credential", { p_store_id: storeId });
    if (!credentials?.[0]) return json({ error: "connection_not_found" }, 404);
    try {
      const identity = await zidStoreIdentity(new ZidMcp(await decrypt(credentials[0].link_ciphertext)));
      await admin.from("commerce_connections").update({
        status: "CONNECTED", last_synced_at: new Date().toISOString(), last_error_code: null, updated_at: new Date().toISOString(),
        ...(identity.storeName ? { external_store_name: identity.storeName } : {}),
      }).eq("id", credentials[0].connection_id);
      return json({ connected: true, storeName: identity.storeName, latestOrderAt: identity.latestOrderAt });
    } catch (error) {
      const code = error instanceof ZidMcpError && error.message === "zid_link_invalid" ? "ZID_LINK_INVALID" : "ZID_UNREACHABLE";
      await admin.from("commerce_connections").update({
        status: code === "ZID_LINK_INVALID" ? "EXPIRED" : "ERROR", last_error_code: code, updated_at: new Date().toISOString(),
      }).eq("id", credentials[0].connection_id);
      return failure(error);
    }
  } catch (error) {
    console.error("zid_connection_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "zid_connection_failed" }, 500);
  }
});
