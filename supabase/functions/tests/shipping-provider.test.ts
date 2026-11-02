import { shippingProvider } from "../_shared/shipping-provider.ts";
function assert(v: unknown, msg = "assertion failed"): asserts v {
  if (!v) throw Error(msg);
}
const ref = "RLDTEST-44444444444444448444444444444444";
Deno.test("staging label follows only a verified OTO print URL and never forwards its bearer token", async () => {
  const original = fetch;
  Deno.env.set("WHATSAPP_SHIPPING_BOOKING_SANDBOX_ENABLED", "true");
  Deno.env.set("OTO_SANDBOX_REFRESH_TOKEN", "test-refresh");
  const paths: string[] = [];
  globalThis.fetch = async (raw, init) => {
    const u = new URL(String(raw));
    paths.push(u.pathname);
    assert(u.origin === "https://staging-api.tryoto.com");
    assert(init?.redirect === "error");
    if (u.pathname.endsWith("refreshToken")) {
      return Response.json({ success: true, access_token: "test-token" });
    }
    if (u.pathname.startsWith("/rest/v2/print/")) {
      return Response.json({
        success: true,
        trackingNumber: "12345",
        printAWBURL: "https://staging-api.tryoto.com/print/awb?enc=opaque",
      });
    }
    if (u.pathname === "/print/awb") {
      assert(!(init?.headers as Record<string, string>)?.Authorization);
      return new Response(new TextEncoder().encode("%PDF-test"), {
        headers: { "Content-Type": "application/pdf" },
      });
    }
    throw Error("unexpected");
  };
  try {
    const p = await shippingProvider();
    const b = await p.pdf(ref, "12345");
    assert(new TextDecoder().decode(b) === "%PDF-test" && paths.length === 3);
    let refused = false;
    try {
      await p.request("https://evil.example/private");
    } catch {
      refused = true;
    }
    assert(refused);
  } finally {
    globalThis.fetch = original;
  }
});
Deno.test("foreign label URL, wrong shipment and non-PDF output are rejected without exposing a label", async () => {
  const original = fetch;
  try {
    for (const mode of ["foreign", "mismatch", "notpdf"]) {
      let external = false;
      globalThis.fetch = async (raw) => {
        const u = new URL(String(raw));
        if (u.pathname.endsWith("refreshToken")) {
          return Response.json({ success: true, access_token: "test-token" });
        }
        if (u.pathname.startsWith("/rest/v2/print/")) {
          return Response.json({
            success: true,
            trackingNumber: mode === "mismatch" ? "OTHER" : "12345",
            printAWBURL: mode === "foreign"
              ? "https://evil.example/print/awb?enc=opaque"
              : "https://staging-api.tryoto.com/print/awb?enc=opaque",
          });
        }
        external = true;
        return new Response("not a pdf");
      };
      const p = await shippingProvider();
      let refused = false;
      try {
        await p.pdf(ref, "12345");
      } catch {
        refused = true;
      }
      assert(refused);
      if (mode !== "notpdf") assert(!external);
    }
  } finally {
    globalThis.fetch = original;
  }
});
