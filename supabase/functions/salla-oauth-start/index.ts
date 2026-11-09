import { sha256 } from "../_shared/crypto.ts";
import { corsHeaders, env, json } from "../_shared/http.ts";
import { adminClient, userClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    if (Deno.env.get("SALLA_PUBLIC_APP_READY") !== "true") {
      return json({ error: "salla_public_app_pending" }, 409);
    }
    const authorization = request.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) {
      return json({ error: "authentication_required" }, 401);
    }

    const client = userClient(authorization);
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) {
      return json({ error: "authentication_required" }, 401);
    }

    const { storeId, redirectPath = "/app/integrations", onboardingToken } =
      await request.json();
    if (!storeId || typeof storeId !== "string") {
      return json({ error: "store_required" }, 400);
    }

    const { data: membership } = await client
      .from("memberships")
      .select("role")
      .eq("store_id", storeId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (!membership) return json({ error: "insufficient_permission" }, 403);
    if (Deno.env.get("SALLA_AUTH_MODE") !== "custom_test") {
      // Easy Mode authorizes at Salla. The private settings code binds that
      // signed installation to this authenticated owner/admin's workspace.
      const allowed = (Deno.env.get("SALLA_EASY_PILOT_STORE_IDS") ?? "").split(
        ",",
      ).map((v) => v.trim()).filter(Boolean);
      if (!allowed.includes(storeId)) {
        return json({ error: "salla_pilot_pending" }, 409);
      }
      const code = `RL-S-${
        crypto.randomUUID().replaceAll("-", "").toUpperCase()
      }`;
      const { error } = await adminClient().rpc("salla_easy_start", {
        p_store: storeId,
        p_actor: user.id,
        p_hash: await sha256(code),
      });
      if (error) {
        const reason = [
          "rate_limited",
          "other_platform_connected",
          "already_connected",
        ].find((c) => error.message.includes(c));
        return json(
          { error: reason ?? "connection_start_failed" },
          reason === "rate_limited" ? 429 : 409,
        );
      }
      const appId = env("SALLA_APP_ID");
      if (!/^\d+$/.test(appId)) throw Error("invalid_app_config");
      return json(
        {
          mode: "easy",
          code,
          expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
          installationUrl: `https://s.salla.sa/apps/install/${appId}`,
        },
        200,
        { "Cache-Control": "no-store" },
      );
    }
    // Custom OAuth remains explicitly restricted to development testing.
    if (Deno.env.get("SALLA_CUSTOM_TEST_ENABLED") !== "true") {
      return json({ error: "custom_test_disabled" }, 409);
    }
    if (typeof onboardingToken === "string" && onboardingToken) {
      const { data: onboarding } = await adminClient().rpc(
        "get_whatsapp_onboarding_token",
        { p_token_hash: await sha256(onboardingToken) },
      );
      if (
        !onboarding?.[0] || onboarding[0].store_id !== storeId ||
        onboarding[0].stage !== "SALLA_PENDING"
      ) return json({ error: "onboarding_link_invalid" }, 409);
    }

    const state = crypto.randomUUID() + crypto.randomUUID();
    const stateHash = await sha256(state);
    const safePath =
      typeof redirectPath === "string" && redirectPath.startsWith("/") &&
        !redirectPath.startsWith("//")
        ? redirectPath
        : "/app/integrations";
    const { error: stateError } = await adminClient().rpc(
      "create_salla_oauth_state",
      {
        p_state_hash: stateHash,
        p_store_id: storeId,
        p_redirect_path: safePath,
        p_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
    );
    if (stateError) throw stateError;

    const url = new URL("https://accounts.salla.sa/oauth2/auth");
    url.searchParams.set("client_id", env("SALLA_CLIENT_ID"));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", env("SALLA_REDIRECT_URI"));
    url.searchParams.set("scope", "orders.read products.read offline_access");
    url.searchParams.set("state", state);

    return json({ authorizationUrl: url.toString() });
  } catch (error) {
    console.error(
      "salla_oauth_start_failed",
      error instanceof Error ? error.message : "unknown",
    );
    return json({ error: "salla_oauth_start_failed" }, 500);
  }
});
