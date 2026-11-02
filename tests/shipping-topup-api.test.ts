import test from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../src/app/api/shipping/wallet/route";
import { shippingTestContext } from "./fixtures/shipping-billing-server";
const id = (n: number) =>
  `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;
const original = fetch;
const member = {
  storeId: id(1),
  role: "owner",
  user: { id: id(2), email: "test@example.com" },
  client: {
    rpc: async () => ({
      data: {
        environment: "sandbox",
        currency: "SAR",
        onHold: false,
        availableHalalas: 0,
        reservedHalalas: 0,
        spentHalalas: 0,
        entries: [],
        attempts: [],
      },
      error: null,
    }),
  },
};
function request(body: unknown, origin = "https://reload.example") {
  return new Request("https://reload.example/api/shipping/wallet", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function harness(
  work: (h: any) => Promise<void>,
  options: Record<string, any> = {},
) {
  const h: any = {
    state: options.initialState || "CREATING",
    calls: [],
    productCalls: 0,
    linkCalls: 0,
  };
  const before = {
    gate: process.env.SHIPPING_SANDBOX_TOPUPS_ENABLED,
    key: process.env.STREAM_SANDBOX_X_API_KEY,
    allowed: process.env.STREAM_SANDBOX_ALLOWED_EMAILS,
    email: process.env.STREAM_SANDBOX_CUSTOMER_EMAIL,
  };
  Object.assign(process.env, {
    SHIPPING_SANDBOX_TOPUPS_ENABLED: "true",
    STREAM_SANDBOX_X_API_KEY: "test",
    STREAM_SANDBOX_ALLOWED_EMAILS: "test@example.com",
    STREAM_SANDBOX_CUSTOMER_EMAIL: "test@example.com",
  });
  const admin = {
    rpc: async (name: string) => {
      h.calls.push(name);
      if (name === "shipping_topup_start")
        return {
          data: {
            id: id(3),
            state: h.state,
            amount_halalas: 10000,
            expires_at: new Date(Date.now() + 1800000).toISOString(),
            checkout_url: "https://pay.streampay.sa/test",
          },
          error: null,
        };
      if (name === "shipping_topup_claim") {
        const claim = h.state === "CREATING";
        if (claim) h.state = "PREPARING";
        return { data: claim, error: null };
      }
      if (name === "shipping_topup_ready") h.state = "READY";
      if (name === "shipping_topup_review") h.state = "REVIEW";
      if (name === "shipping_topup_pending")
        return {
          data: {
            id: id(3),
            state: h.state,
            amount_halalas: 10000,
            payment_link_id: id(6),
            consumer_id: id(4),
            product_id: id(5),
            expires_at: new Date(
              Date.now() + (options.notExpired ? 1800000 : -3600000),
            ).toISOString(),
          },
          error: null,
        };
      if (name === "shipping_topup_retire_expired") {
        h.state = "EXPIRED_UNPAID";
        return { data: true, error: null };
      }
      return { data: true, error: null };
    },
  };
  shippingTestContext(member, admin);
  globalThis.fetch = async (url, init) => {
    const path = new URL(String(url)).pathname;
    assert(
      String(url).startsWith("https://stream-app-service.streampay.sa/api/v2/"),
    );
    if (path.endsWith("/payment_links/" + id(6)))
      return Response.json({
        id: id(6),
        organization_consumer_id: options.foreignConsumer ? id(9) : id(4),
        currency: "SAR",
        amount: "100",
        max_number_of_payments: 1,
        status: options.activeLink ? "ACTIVE" : "COMPLETED",
        valid_until: new Date(Date.now() - 3600000).toISOString(),
        amount_collected: options.collected ? "100" : "0",
        items: [{ product_id: id(5), quantity: 1 }],
      });
    if (path.endsWith("/invoices"))
      return Response.json({
        data: options.hasInvoice ? [{ id: id(7), status: "PENDING" }] : [],
      });
    if (path.endsWith("/user"))
      return Response.json({
        organization: { sandbox: !options.liveAccount },
        email: "test@example.com",
        first_name: "Test",
      });
    if (path.endsWith("/consumers"))
      return Response.json({
        data: [{ id: id(4), email: "test@example.com" }],
      });
    if (path.endsWith("/products")) {
      h.productCalls++;
      return Response.json({ id: id(5) });
    }
    if (path.endsWith("/payment_links")) {
      h.linkCalls++;
      const body = JSON.parse(String(init?.body));
      assert.equal(body.payment_methods.installment, false);
      assert.equal(body.payment_methods.bank_transfer, false);
      assert.equal(body.max_number_of_payments, 1);
      assert.equal(body.items[0].allow_custom_quantity, false);
      if (options.timeout) throw Error("private network failure");
      return Response.json({
        id: id(6),
        amount: options.wrongAmount ? "101" : "100.000",
        currency: "SAR",
        organization_consumer_id: id(4),
        max_number_of_payments: 1,
        url: "https://pay.streampay.sa/test",
      });
    }
    throw Error("unexpected path");
  };
  try {
    await work(h);
  } finally {
    globalThis.fetch = original;
    shippingTestContext(null, null);
    for (const [k, v] of Object.entries({
      SHIPPING_SANDBOX_TOPUPS_ENABLED: before.gate,
      STREAM_SANDBOX_X_API_KEY: before.key,
      STREAM_SANDBOX_ALLOWED_EMAILS: before.allowed,
      STREAM_SANDBOX_CUSTOMER_EMAIL: before.email,
    })) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}
test("wallet API rejects missing write permission, foreign origin and extra provider fields", async () => {
  await harness(async (h) => {
    shippingTestContext(null, null);
    assert.equal(
      (
        await GET(
          new Request(
            "https://reload.example/api/shipping/wallet?store=" + id(1),
          ),
        )
      ).status,
      403,
    );
    shippingTestContext({ ...member, role: "member" }, null);
    assert.equal(
      (
        await POST(
          request({ storeId: id(1), action: "topup", amountHalalas: 10000 }),
        )
      ).status,
      403,
    );
    assert.equal((await POST(request({}, "https://evil.example"))).status, 403);
    assert.equal(
      (await POST(request({ action: "topup", token: "PRIVATE" }))).status,
      400,
    );
    assert.equal(h.productCalls, 0);
  });
});
test("a sandbox top-up creates one fixed one-off checkout and reuses its saved link", async () => {
  await harness(async (h) => {
    const body = { storeId: id(1), action: "topup", amountHalalas: 10000 };
    const first = await POST(request(body));
    assert.equal(first.status, 200);
    assert.equal((await first.json()).url, "https://pay.streampay.sa/test");
    assert.equal((await POST(request(body))).status, 200);
    assert.equal(h.productCalls, 1);
    assert.equal(h.linkCalls, 1);
    assert(!h.calls.includes("shipping_topup_complete"));
  });
});
test("provider live mode is rejected before any product or payment creation", async () => {
  await harness(
    async (h) => {
      const r = await POST(
        request({ storeId: id(1), action: "topup", amountHalalas: 10000 }),
      );
      assert.equal(r.status, 403);
      assert.equal(h.productCalls, 0);
    },
    { liveAccount: true },
  );
});
test("timeouts and amount mismatches keep a review lock and never grant credit or create another link", async () => {
  for (const options of [{ timeout: true }, { wrongAmount: true }])
    await harness(async (h) => {
      const body = { storeId: id(1), action: "topup", amountHalalas: 10000 };
      let r = await POST(request(body));
      assert.equal(r.status, 409);
      assert.equal(h.state, "REVIEW");
      r = await POST(request(body));
      assert.equal(r.status, 409);
      assert.equal(h.linkCalls, 1);
      assert(!h.calls.includes("shipping_topup_complete"));
      assert(!(await r.text().then((s) => s.includes("private network"))));
    }, options);
});

test("expired sandbox checkout can be retired without credit or new provider creation", async () => {
  await harness(
    async (h) => {
      const response = await POST(
        request({ storeId: id(1), action: "recover" }),
      );
      assert.equal(response.status, 200);
      assert.equal((await response.json()).recovered, true);
      assert.equal(h.state, "EXPIRED_UNPAID");
      assert.equal(h.linkCalls, 0);
      assert.equal(h.productCalls, 0);
      assert(!h.calls.includes("shipping_topup_complete"));
    },
    { initialState: "READY" },
  );
});
test("recovery refuses active, recent, mismatched, paid, in-progress and uncertain checkouts", async () => {
  for (const options of [
    { activeLink: true },
    { notExpired: true },
    { collected: true },
    { foreignConsumer: true },
    { hasInvoice: true },
    { initialState: "REVIEW" },
    { liveAccount: true },
  ])
    await harness(
      async (h) => {
        const response = await POST(
          request({ storeId: id(1), action: "recover" }),
        );
        assert([403, 409].includes(response.status));
        assert(!h.calls.includes("shipping_topup_retire_expired"));
        assert.equal(h.linkCalls, 0);
      },
      { initialState: "READY", ...options },
    );
});
