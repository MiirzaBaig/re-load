import { encrypt } from "../_shared/crypto.ts";
import { sallaAccessToken } from "../_shared/salla.ts";
function assert(v: unknown, label = "assertion failed"): asserts v {
  if (!v) throw Error(label);
}
async function fixture(
  work: (
    s: { calls: string[]; mode: string; current: boolean },
  ) => Promise<void>,
) {
  const names = [
    "SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "INTEGRATION_ENCRYPTION_KEY",
    "SALLA_CLIENT_ID",
    "SALLA_CLIENT_SECRET",
  ];
  const saved = names.map((n) => Deno.env.get(n));
  Deno.env.set("SUPABASE_URL", "https://database.test");
  Deno.env.set("SUPABASE_SECRET_KEY", "service-test");
  Deno.env.set("SALLA_CLIENT_ID", "client-test");
  Deno.env.set("SALLA_CLIENT_SECRET", "secret-test");
  Deno.env.set("INTEGRATION_ENCRYPTION_KEY", btoa("x".repeat(32)));
  const access = await encrypt("old-access"),
    refresh = await encrypt("old-refresh");
  const s = { calls: [] as string[], mode: "success", current: true };
  const previous = fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const requestBody = input instanceof Request
      ? await input.clone().text()
      : String(init?.body || "{}");
    const body = JSON.parse(requestBody.startsWith("{") ? requestBody : "{}");
    s.calls.push(url.pathname);
    if (url.hostname === "accounts.salla.sa") {
      assert(
        init?.redirect === "error" && !!init.signal,
        "bounded provider request",
      );
      if (s.mode === "uncertain") throw Error("provider-private-message");
      return Response.json({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 1209600,
      });
    }
    if (url.pathname.endsWith("get_salla_credential")) {
      return Response.json([{
        connection_id: "connection-one",
        access_token_ciphertext: access,
        refresh_token_ciphertext: refresh,
        token_expires_at: new Date(Date.now() + 86400000).toISOString(),
        refresh_started_at: null,
      }]);
    }
    if (url.pathname.endsWith("claim_salla_refresh")) {
      return Response.json(s.mode !== "already-claimed");
    }
    if (url.pathname.endsWith("salla_refresh_complete")) {
      assert(
        body.p_expected_refresh === refresh,
        "commit bound to exact previous refresh credential",
      );
      if (s.mode === "uncertain") {
        assert(body.p_failed === true && body.p_access === null);
      } else {assert(
          body.p_access.startsWith("v1.") && body.p_refresh.startsWith("v1."),
        );}
      return Response.json(s.current);
    }
    throw Error("unexpected request");
  };
  try {
    await work(s);
  } finally {
    globalThis.fetch = previous;
    names.forEach((n, i) =>
      saved[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, saved[i]!)
    );
  }
}
Deno.test("Salla refresh rotates encrypted credentials only after a successful compare-and-swap", async () => {
  await fixture(async (s) => {
    assert(await sallaAccessToken("store") === "new-access");
    assert(s.calls.filter((p) => p === "/oauth2/token").length === 1);
  });
});
Deno.test("Salla in-flight refresh is not replayed by another caller", async () => {
  await fixture(async (s) => {
    s.mode = "already-claimed";
    assert(await sallaAccessToken("store") === "old-access");
    assert(!s.calls.includes("/oauth2/token"));
  });
});
Deno.test("Salla uncertain renewal requires reauthorization and hides provider errors", async () => {
  await fixture(async (s) => {
    s.mode = "uncertain";
    let error = "";
    try {
      await sallaAccessToken("store");
    } catch (e) {
      error = (e as Error).message;
    }
    assert(error === "salla_reauthorization_required");
    assert(s.calls.filter((p) => p === "/oauth2/token").length === 1);
  });
});
Deno.test("Salla stale refresh cannot publish its token after uninstall or a newer authorization", async () => {
  await fixture(async (s) => {
    s.current = false;
    let failed = false;
    try {
      await sallaAccessToken("store");
    } catch (e) {
      failed = (e as Error).message === "salla_refresh_superseded";
    }
    assert(failed);
  });
});
