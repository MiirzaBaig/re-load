import { ZidMcp } from "../_shared/zid-mcp.ts";
function assert(v: unknown): asserts v {
  if (!v) throw new Error("Assertion failed");
}
Deno.test("unverified checkout/order/cart writes stay blocked before a network request", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error("Unexpected network action");
  };
  try {
    const client = new ZidMcp(
      "https://zam-mcp-server.zid.sa/mcp/test-only-link-123456",
    );
    for (
      const [tool, action] of [
        ["Orders", "create"],
        ["Carts", "create"],
        ["Payments", "create"],
        ["Products", "update"],
        ["Orders", "update"],
      ]
    ) {
      let code;
      try {
        await client.call(tool, { action });
      } catch (e) {
        code = (e as Error).message;
      }
      assert(code === "zid_tool_not_allowed");
    }
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("capability discovery requests tool metadata without executing a tool", async () => {
  const original = globalThis.fetch;
  const methods: string[] = [];
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    methods.push(request.method);
    assert(request.method !== "tools/call");
    return new Response(
      JSON.stringify({ result: { tools: [{ name: "Products" }] } }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  try {
    const tools = await new ZidMcp(
      "https://zam-mcp-server.zid.sa/mcp/test-only-link-123456",
    ).listTools();
    assert(
      tools[0].name === "Products" &&
        methods.join(",") === "initialize,notifications/initialized,tools/list",
    );
  } finally {
    globalThis.fetch = original;
  }
});
