import { answerStoreQuestion } from "../_shared/customer-assistant.ts";
import { encrypt } from "../_shared/crypto.ts";
import { encode } from "npm:@toon-format/toon@4.4.0";
Deno.env.set("SUPABASE_URL", "https://example.invalid");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-key");
Deno.env.set("OLLAMA_API_KEY", "test-key");
Deno.env.set("INTEGRATION_ENCRYPTION_KEY", btoa("x".repeat(32)));
function assert(v: unknown): asserts v { if (!v) throw new Error("Assertion failed"); }
async function run(mode: "found" | "empty" | "outage") {
  const original = globalThis.fetch;
  const ciphertext = await encrypt("https://zam-mcp-server.zid.sa/mcp/test-only-link-123456");
  const requests: string[] = [];
  let sourceText = "";
  let modelCalls = 0;
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("ollama.com")) {
      modelCalls++;
      if (modelCalls === 1) return json({ message: { content: JSON.stringify({ intent: "PRODUCT", search: "shoes" }) } });
      const body = JSON.parse(String(init?.body));
      sourceText = body.messages.at(-1).content;
      return json({ message: { content: JSON.stringify({ answer: "Running Shoes: SAR 70. https://shop.example/shoes", sourceIds: ["product:p1"], needsReview: false }) } });
    }
    if (url.includes("/store_knowledge")) return json([]);
    if (url.includes("/commerce_connections")) return json({ platform: "zid", status: "CONNECTED", scopes: [] });
    if (url.includes("/rpc/get_zid_credential")) {
      assert(JSON.parse(String(init?.body)).p_store_id === "store-a");
      return json([{ link_ciphertext: ciphertext }]);
    }
    if (url.includes("/zid_catalog_sync")) return json({ synced_at: new Date().toISOString() });
    if (url.includes("/zid_catalog_products")) {
      assert(url.includes("store_id=eq.store-a"));
      return json(mode === "empty" ? [] : [{ product_id: "p1", name_en: "Running Shoes", search_text: "running shoes", thumbnail_url: null }]);
    }
    if (url.includes("zam-mcp-server.zid.sa")) {
      const request = JSON.parse(String(init?.body));
      if (mode === "outage") return json({}, 503);
      if (request.method !== "tools/call") return json({ result: {} });
      assert(request.params.name === "Products" && request.params.arguments.action === "get");
      return json({ result: { content: [{ type: "text", text: encode({ id: "p1", name: { en: "Running Shoes" }, is_published: true, is_draft: false, price: 100, sale_price: 70, quantity: 5, cost: 30, store_id: 99, html_url: "https://shop.example/shoes" }) }] } });
    }
    throw new Error(`Unexpected test request ${url}`);
  };
  try { return { answer: await answerStoreQuestion("store-a", "Nova", "Do you have shoes?", "en"), source: () => sourceText, requests, modelCalls: () => modelCalls }; }
  finally { globalThis.fetch = original; }
}
Deno.test("Zid assistant uses store-scoped live facts and excludes internal product data", async () => {
  const r = await run("found");
  assert(r.answer.text?.includes("SAR 70"));
  assert(r.source().includes('"salePrice":70') && !r.source().includes('"cost"') && !r.source().includes('"store_id"'));
  assert(!r.requests.some(url => url.includes("salla.dev")));
});
Deno.test("a genuine Zid no-match never calls the answer model", async () => {
  const r = await run("empty");
  assert(r.answer.text === null && r.answer.unavailable === false && r.modelCalls() === 1);
});
Deno.test("Zid outage cannot become an invented stock or price answer", async () => {
  const r = await run("outage");
  assert(r.answer.text === null && r.answer.unavailable === true && r.modelCalls() === 1);
});
