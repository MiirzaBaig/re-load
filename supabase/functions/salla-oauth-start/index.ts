import { sha256 } from "../_shared/crypto.ts";
import { corsHeaders, env, json } from "../_shared/http.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    if (Deno.env.get("SALLA_PUBLIC_APP_READY") !== "true") return json({ error: "salla_public_app_pending" }, 409);
    const authorization = request.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "authentication_required" }, 401);

    const client = userClient(authorization);
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) return json({ error: "authentication_required" }, 401);

    const { storeId, redirectPath = "/app/integrations", onboardingToken } = await request.json();
    if (!storeId || typeof storeId !== "string") return json({ error: "store_required" }, 400);

    const { data: membership } = await client
      .from("memberships")
      .select("role")
      .eq("store_id", storeId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (!membership) return json({ error: "insufficient_permission" }, 403);
    if (typeof onboardingToken === "string" && onboardingToken) {
      const { data: onboarding } = await adminClient().rpc("get_whatsapp_onboarding_token", { p_token_hash: await sha256(onboardingToken) });
      if (!onboarding?.[0] || onboarding[0].store_id !== storeId || onboarding[0].stage !== "SALLA_PENDING") return json({ error: "onboarding_link_invalid" }, 409);
    }

    const state = crypto.randomUUID() + crypto.randomUUID();
    const stateHash = await sha256(state);
    const safePath = typeof redirectPath === "string" && redirectPath.startsWith("/") && !redirectPath.startsWith("//")
      ? redirectPath
      : "/app/integrations";
    const { error: stateError } = await adminClient().rpc("create_salla_oauth_state", {
      p_state_hash: stateHash,
      p_store_id: storeId,
      p_redirect_path: safePath,
      p_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (stateError) throw stateError;

    const url = new URL("https://accounts.salla.sa/oauth2/auth");
    url.searchParams.set("client_id", env("SALLA_CLIENT_ID"));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", env("SALLA_REDIRECT_URI"));
    url.searchParams.set("scope", "orders.read products.read offline_access");
    url.searchParams.set("state", state);

    return json({ authorizationUrl: url.toString() });
  } catch (error) {
    console.error("salla_oauth_start_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "salla_oauth_start_failed" }, 500);
  }
});
