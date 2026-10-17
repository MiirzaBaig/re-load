import { streamWebhookHandler, type StreamEventReceipt } from "../_shared/streampay-webhook.ts";

const secret = "test-only-stream-webhook-secret";
const now = 1800000000000;
const body = JSON.stringify({ event_type: "PAYMENT_SUCCEEDED", entity_type: "PAYMENT", entity_id: "test-payment", status: "SUCCEEDED", data: { email: "private@example.com" } });
function assert(value: unknown) { if (!value) throw new Error("Assertion failed"); }
async function signed(raw = body, timestamp = now / 1000, signingSecret = secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(signingSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const result = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${raw}`)));
  const hex = Array.from(result, byte => byte.toString(16).padStart(2, "0")).join("");
  return new Request("https://example.com", { method: "POST", body: raw, headers: { "content-type": "application/json", "x-webhook-signature": `t=${timestamp},v1=${hex}` } });
}
function setup() {
  const saved = new Map<string, StreamEventReceipt>();
  const handler = streamWebhookHandler({ secret: () => secret, now: () => now, save: async receipt => { if (!saved.has(receipt.payload_digest)) saved.set(receipt.payload_digest, receipt); } });
  return { saved, handler };
}
Deno.test("signed events are recorded without customer data; repeated delivery has the same dedupe key", async () => {
  const { saved, handler } = setup();
  assert((await handler(await signed())).status === 200);
  assert((await handler(await signed(body, now / 1000 + 1))).status === 200);
  assert(saved.size === 1);
  assert(!JSON.stringify([...saved.values()]).includes("private@example.com"));
});
Deno.test("missing, wrong, stale and future signatures never reach storage", async () => {
  const { saved, handler } = setup();
  assert((await handler(new Request("https://example.com", { method: "POST", body, headers: { "content-type": "application/json" } }))).status === 401);
  for (const request of [await signed(body, now / 1000, "wrong"), await signed(body, now / 1000 - 301), await signed(body, now / 1000 + 301)]) assert((await handler(request)).status === 401);
  assert(saved.size === 0);
});
Deno.test("tampering with the signed body is rejected", async () => {
  const request = await signed();
  const { handler, saved } = setup();
  assert((await handler(new Request(request.url, { method: "POST", headers: request.headers, body: body.replace("SUCCEEDED", "FAILED") }))).status === 401);
  assert(saved.size === 0);
});
Deno.test("invalid JSON and malformed events return 400 without storage", async () => {
  const { saved, handler } = setup();
  for (const value of ["{", "null", "[]", "{}", '{"event_type":"PAYMENT_SUCCEEDED","entity_type":"PAYMENT","entity_id":""}']) assert((await handler(await signed(value))).status === 400);
  assert(saved.size === 0);
});
Deno.test("method, media type, oversized requests and missing configuration are refused", async () => {
  const { handler } = setup();
  assert((await handler(new Request("https://example.com"))).status === 405);
  assert((await handler(new Request("https://example.com", { method: "POST", body: "hello" }))).status === 415);
  assert((await handler(await signed("x".repeat(262145)))).status === 413);
  const unconfigured = streamWebhookHandler({ secret: () => undefined, save: async () => { throw new Error(); } });
  assert((await unconfigured(await signed())).status === 503);
});
Deno.test("storage failures return non-2xx so Stream can retry", async () => {
  const handler = streamWebhookHandler({ secret: () => secret, now: () => now, save: async () => { throw new Error("database unavailable"); } });
  assert((await handler(await signed())).status === 500);
});
