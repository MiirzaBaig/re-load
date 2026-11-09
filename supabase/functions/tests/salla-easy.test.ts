import {
  type EasyEvent,
  handleSallaEasy,
  sallaEventTime,
  sallaPairingCode,
} from "../_shared/salla-easy.ts";
const secret = "salla-test-only";
function assert(v: unknown, message = "assertion failed"): asserts v {
  if (!v) throw Error(message);
}
const code = "RL-S-0123456789ABCDEF0123456789ABCDEF";
async function request(body: unknown, valid = true) {
  const raw = JSON.stringify(body);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(raw),
  );
  const signature = [...new Uint8Array(bytes)].map((n) =>
    n.toString(16).padStart(2, "0")
  ).join("");
  return new Request("https://reload.test/webhook", {
    method: "POST",
    headers: { "X-Salla-Signature": valid ? signature : "bad" },
    body: raw,
  });
}
function setup() {
  const events: EasyEvent[] = [];
  let reads = 0;
  return {
    events,
    get reads() {
      return reads;
    },
    deps: {
      secret,
      encrypt: async (v: string) => "v1.encrypted." + v,
      identity: async (_v: string) => {
        reads++;
        return { id: "123", name: "Test Store" };
      },
      apply: async (event: EasyEvent) => {
        events.push(event);
      },
    },
  };
}
function authorization() {
  return {
    event: "app.store.authorize",
    merchant: 123,
    created_at: new Date().toISOString(),
    data: {
      access_token: "access-test",
      refresh_token: "refresh-test",
      expires: Math.floor(Date.now() / 1000) + 86400,
      scope: "orders.read products.read offline_access",
    },
  };
}
Deno.test("Easy Mode rejects unsigned events before identity reads or credential writes", async () => {
  const s = setup();
  const r = await handleSallaEasy(
    await request(authorization(), false),
    s.deps,
  );
  assert(r?.status === 401 && s.reads === 0 && s.events.length === 0);
});
Deno.test("Easy Mode validates merchant and scopes, encrypts both tokens, treats expires as epoch seconds", async () => {
  const s = setup();
  const a = authorization();
  const r = await handleSallaEasy(await request(a), s.deps);
  assert(r?.status === 200 && s.events.length === 1 && s.reads === 1);
  const e = s.events[0];
  assert(
    e.merchant === "123" &&
      e.expiresAt === new Date(a.data.expires * 1000).toISOString(),
  );
  assert(
    e.access?.startsWith("v1.") && e.refresh?.startsWith("v1.") &&
      !JSON.stringify(await r.json()).includes("access-test"),
  );
});
Deno.test("mismatched merchant, missing scopes and malformed expiry never save credentials", async () => {
  const s = setup();
  const a = authorization();
  a.merchant = 456;
  assert((await handleSallaEasy(await request(a), s.deps))?.status === 400);
  a.merchant = 123;
  a.data.scope = "orders.read";
  assert((await handleSallaEasy(await request(a), s.deps))?.status === 400);
  a.data.scope = "orders.read products.read";
  a.data.expires = 14 * 86400;
  assert(
    (await handleSallaEasy(await request(a), s.deps))?.status === 400 &&
      s.events.length === 0,
  );
});
Deno.test("settings pairing accepts only the dedicated code and forwards a hash, never a workspace supplied by Salla", async () => {
  const s = setup();
  const a = {
    event: "app.settings.updated",
    merchant: "123",
    created_at: new Date().toISOString(),
    data: { settings: { reload_connection_code: code, store_id: "attacker" } },
  };
  assert((await handleSallaEasy(await request(a), s.deps))?.status === 200);
  assert(
    s.events.length === 1 &&
      /^[a-f0-9]{64}$/.test(s.events[0].codeHash || "") && s.reads === 0,
  );
  assert(
    !JSON.stringify(s.events).includes(code) &&
      !JSON.stringify(s.events).includes("attacker"),
  );
  a.data.settings.reload_connection_code = "not a code";
  assert(
    (await handleSallaEasy(await request(a), s.deps))?.status === 200 &&
      s.events.length === 1,
  );
});
Deno.test("uninstall goes through durable processing; resource events fall through to existing handler", async () => {
  const s = setup();
  const a = {
    event: "app.uninstalled",
    merchant: 123,
    created_at: new Date().toISOString(),
    data: {},
  };
  assert(
    (await handleSallaEasy(await request(a), s.deps))?.status === 200 &&
      s.events[0].event === "app.uninstalled",
  );
  a.event = "order.updated";
  assert(await handleSallaEasy(await request(a), s.deps) === null);
});
Deno.test("provider and storage failures are retryable and never disclose secrets", async () => {
  const s = setup();
  s.deps.identity = async () => {
    throw Error("private-provider-response");
  };
  const r = await handleSallaEasy(await request(authorization()), s.deps);
  assert(
    r?.status === 503 &&
      !JSON.stringify(await r.json()).includes("private-provider-response") &&
      s.events.length === 0,
  );
});
Deno.test("timestamps, code format, malformed JSON and payload size fail closed", async () => {
  assert(
    sallaPairingCode(code.toLowerCase()) === code &&
      sallaPairingCode(code + "extra") === null,
  );
  assert(sallaEventTime("2026-01-01 12:00:00") === "2026-01-01T09:00:00.000Z");
  let failed = false;
  try {
    sallaEventTime("2099-01-01");
  } catch {
    failed = true;
  }
  assert(failed);
  const s = setup();
  assert((await handleSallaEasy(await request([]), s.deps))?.status === 400);
  const large = new Request("https://reload.test", {
    method: "POST",
    body: "a".repeat(131073),
  });
  assert(
    (await handleSallaEasy(large, s.deps))?.status === 413 &&
      s.events.length === 0,
  );
});
