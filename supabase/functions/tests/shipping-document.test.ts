import {
  sendWhatsAppDocument,
  uploadReturnLabel,
} from "../_shared/whatsapp.ts";
Deno.env.set("WHATSAPP_PHONE_NUMBER_ID", "1234567");
Deno.env.set("WHATSAPP_ACCESS_TOKEN", "test-only-meta-token");
function assert(v: unknown, msg = "assertion failed"): asserts v {
  if (!v) throw Error(msg);
}
Deno.test("a verified PDF uploads as media and sends by media ID without exposing an OTO bearer URL", async () => {
  const original = fetch,
    calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (raw, init) => {
    calls.push({ url: String(raw), init });
    if (String(raw).endsWith("/media")) {
      assert(init?.body instanceof FormData);
      assert(init.redirect === "error");
      return Response.json({ id: "7654321" });
    }
    const body = JSON.parse(String(init?.body));
    assert(
      body.type === "document" && body.document.id === "7654321" &&
        !JSON.stringify(body).includes("tryoto"),
    );
    return Response.json({ messages: [{ id: "wamid.test" }] });
  };
  try {
    const id = await uploadReturnLabel(
      new TextEncoder().encode("%PDF-test-only"),
    );
    assert(id === "7654321");
    await sendWhatsAppDocument(
      "966500000001",
      id,
      "Print and attach this return label.",
    );
    assert(
      calls.length === 2 &&
        calls.every((x) => x.url.startsWith("https://graph.facebook.com/")),
    );
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("invalid file and malformed media IDs cannot send a label", async () => {
  const original = fetch;
  let calls = 0;
  globalThis.fetch = () => {
    calls++;
    throw Error("must not call provider");
  };
  try {
    for (
      const run of [
        () => uploadReturnLabel(new TextEncoder().encode("not PDF")),
        () =>
          sendWhatsAppDocument("966500000001", "https://evil.example", "test"),
      ]
    ) {
      let refused = false;
      try {
        await run();
      } catch {
        refused = true;
      }
      assert(refused);
    }
    assert(calls === 0);
  } finally {
    globalThis.fetch = original;
  }
});
