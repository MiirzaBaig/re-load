import { processFlow } from "../_shared/whatsapp-journey.ts";
import { adminClient } from "../_shared/supabase.ts";
import { encrypt } from "../_shared/crypto.ts";
import { encode } from "npm:@toon-format/toon@4.4.0";
Deno.env.set("SUPABASE_URL", "https://example.invalid");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
Deno.env.set("INTEGRATION_ENCRYPTION_KEY", btoa("x".repeat(32)));
function assert(v: unknown): asserts v {
  if (!v) throw new Error("Assertion failed");
}
Deno.test("paid Standard product help finds live products without Ollama and saves a scoped selection", async () => {
  const original = globalThis.fetch;
  const link = await encrypt(
    "https://zam-mcp-server.zid.sa/mcp/test-only-link-123456",
  );
  let state: { step: string; context: Record<string, any> } = {
    step: "MENU",
    context: { serviceMode: "PRODUCT" },
  };
  const json = (data: unknown) =>
    new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    assert(!url.includes("ollama.com"));
    if (url.includes("billing_snapshot")) {
      return json({
        enforcementEnabled: true,
        plan: "standard",
        status: "ACTIVE",
        periodStart: new Date(Date.now() - 1000).toISOString(),
        periodEnd: new Date(Date.now() + 60_000).toISOString(),
      });
    }
    if (url.includes("get_whatsapp_flow_state")) return json([state]);
    if (url.includes("set_whatsapp_flow_state")) {
      state = { step: body.p_step, context: body.p_context };
      return json(null);
    }
    if (url.includes("get_zid_credential")) {
      assert(body.p_store_id === "store-a");
      return json([{ link_ciphertext: link }]);
    }
    if (url.includes("zid_catalog_sync")) {
      return json({ synced_at: new Date().toISOString() });
    }
    if (url.includes("zid_catalog_products")) {
      assert(url.includes("store_id=eq.store-a"));
      return json([{
        product_id: "p1",
        name_en: "Running shoes",
        search_text: "running shoes",
      }]);
    }
    if (url.includes("zam-mcp-server.zid.sa")) {
      if (body.method !== "tools/call") return json({ result: {} });
      assert(
        body.params.name === "Products" &&
          body.params.arguments.action === "get",
      );
      return json({
        result: {
          content: [{
            type: "text",
            text: encode({
              id: "p1",
              name: { en: "Running shoes" },
              price: 100,
              quantity: 5,
              is_published: true,
              is_draft: false,
              cost: 5,
              html_url: "https://shop.example/shoes",
            }),
          }],
        },
      });
    }
    throw new Error("Unexpected test route");
  };
  try {
    const reply = await processFlow(
      adminClient(),
      { id: "store-a", name: "Nova", return_code: "demo" },
      {
        id: "conversation-a",
        contact_id: "contact-a",
        language: "en",
        return_case_id: null,
      },
      "966500000000",
      "running shoes",
    );
    assert(
      reply.result.kind === "list" &&
        reply.result.rows[0].description?.includes("100.00 SAR"),
    );
    assert(
      state.context.shopping.storeId === "store-a" &&
        state.context.shopping.conversationId === "conversation-a",
    );
    assert(
      state.context.shopping.stage === "PRODUCT" &&
        !JSON.stringify(state).includes('"cost"'),
    );
    assert(!reply.body.includes("payment link"));
  } finally {
    globalThis.fetch = original;
  }
});
