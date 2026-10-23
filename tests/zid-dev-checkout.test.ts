import test from "node:test";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET, POST } from "../src/app/api/integrations/zid/checkout/route";
import {
  checkoutInput,
  developmentOrder,
  safePaymentUrl,
  stockSample,
  matchesSelection,
} from "../src/lib/zid/checkout-contract";
import {
  checkoutSession,
  createCheckout,
  csrfFor,
  openPrivate,
  prepareCheckout,
  readCheckoutResult,
  sealCheckout,
  verifyCheckoutPost,
} from "../src/lib/zid/checkout-server";
import { sealTokens } from "../src/lib/zid/oauth-server";
import { ZID_COOKIE } from "../src/lib/zid/oauth-contract";
const origin = "https://reload-test.example",
  key = Buffer.alloc(32, 5).toString("base64"),
  browser = "b".repeat(43),
  sessionHash = "c".repeat(64);
Object.assign(process.env, {
  ZID_DEV_CHECKOUT_ENABLED: "true",
  ZID_DEV_OAUTH_ENABLED: "true",
  ZID_CLIENT_ID: "8022",
  ZID_CLIENT_SECRET: "test-secret",
  ZID_OAUTH_ORIGIN: origin,
  ZID_DEV_STORE_IDS: "3258532",
  ZID_DEV_ENCRYPTION_KEY: key,
  NEXT_PUBLIC_SUPABASE_URL: "https://database.invalid",
  SUPABASE_SECRET_KEY: "test-server-key",
});
const rawProduct = {
  store_id: 3258532,
  id: "shoe-1",
  sku: "TEST-SHOE",
  name: { en: "Test shoes", ar: "حذاء تجريبي" },
  is_published: true,
  is_draft: false,
  currency: "SAR",
  price: 100,
  quantity: 10,
  is_infinite: false,
};
const form = () => {
  const f = new FormData();
  Object.entries({
    product: "shoe-1",
    quantity: "2",
    shipping: "12",
    name: "Test User",
    email: "test@example.com",
    phone: "0500000000",
    city: "Riyadh",
    address: "Test address",
    addressExtra: "Test building",
    consent: "yes",
  }).forEach(([k, v]) => f.set(k, v));
  return f;
};
const json = (v: unknown, status = 200) =>
  new Response(JSON.stringify(v), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const original = globalThis.fetch;
async function harness(
  work: (h: any) => Promise<void>,
  options: Record<string, any> = {},
) {
  const h: any = { calls: [], job: null, createCalls: 0 };
  const token = sealTokens(
    {
      authorization: "test-authorization",
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    },
    sessionHash,
    key,
  );
  globalThis.fetch = async (input, init) => {
    const url = String(input),
      body = init?.body ? JSON.parse(String(init.body)) : null;
    h.calls.push({ url, body });
    if (url.includes("/rest/v1/rpc/get_zid_dev_checkout_session"))
      return json({
        session_hash: sessionHash,
        external_store_id: options.store ?? "3258532",
        store_name: "testing-z",
        token_ciphertext: token,
        checkout: h.job,
      });
    if (url.includes("/prepare_zid_dev_checkout")) {
      if (h.job && ["CREATING", "CREATED", "UNKNOWN"].includes(h.job.state))
        return json(false);
      h.job = {
        state: "READY",
        revision: "11111111-1111-4111-8111-111111111111",
        summary: body.p_summary,
        request_ciphertext: body.p_request_ciphertext,
        order_id: null,
        result_ciphertext: null,
        expires_at: new Date(Date.now() + 600000).toISOString(),
      };
      return json(true);
    }
    if (url.includes("/claim_zid_dev_checkout")) {
      if (h.job?.state !== "READY" || body.p_revision !== h.job.revision)
        return json(false);
      h.job.state = "CREATING";
      return json(true);
    }
    if (url.includes("/finish_zid_dev_checkout")) {
      if (options.saveFailure && body.p_state === "CREATED")
        return json({ message: "failed" }, 500);
      h.job.state = body.p_state;
      h.job.order_id = body.p_order_id;
      h.job.result_ciphertext = body.p_result_ciphertext;
      return json(true);
    }
    assert(url.startsWith("https://api.zid.sa/v1/"), "Unexpected origin");
    if (url.endsWith("/account/store"))
      return json({
        store: {
          id: options.identity ?? 3258532,
          title: "testing-z",
          url: "https://testing.zid.store",
        },
      });
    if (url.includes("/products/?"))
      return json({
        results: [
          rawProduct,
          { ...rawProduct, id: "hidden", is_published: false },
        ],
      });
    if (url.endsWith("/products/shoe-1/")) {
      if (options.stockFailure && h.createCalls) return json({}, 503);
      return json({ ...rawProduct, ...(options.product ?? {}) });
    }
    if (url.endsWith("/payment-methods"))
      return json({
        payload: [
          {
            id: 7,
            code: "payment_link.zidpay",
            enabled: options.payment !== false,
          },
        ],
      });
    if (url.includes("/delivery-options"))
      return json({
        delivery_options: [
          { id: 12, name: "Test courier", shipping_method_status: "active" },
        ],
      });
    if (url.endsWith("/drafts/validate"))
      return options.invalid
        ? json({}, 422)
        : json({ code: "SUCCESS_WITHOUT_PAYLOAD" });
    if (url.endsWith("/drafts")) {
      h.createCalls++;
      if (options.timeout) throw new TypeError("test network loss");
      if (options.createStatus) return json({}, options.createStatus);
      return json({
        order: {
          id: 123,
          store_id: 3258532,
          currency_code: "SAR",
          order_total: "230.00",
          payment_status: "pending",
          products: [{ sku: "TEST-SHOE", quantity: 2 }],
          payment_link: "https://testing.zid.store/pay/test-private",
        },
      });
    }
    if (url.endsWith("/orders/123/view"))
      return json({
        order: {
          id: options.orderId ?? 123,
          store_id: options.orderStore ?? 3258532,
          currency_code: "SAR",
          order_total: "230.00",
          payment_status: options.paid ? "paid" : "pending",
          order_status: { code: options.orderStatus ?? "new" },
          products:
            options.orderItems === undefined
              ? [{ sku: "TEST-SHOE", quantity: 2 }]
              : options.orderItems,
          is_guest_customer: options.guest,
          payment: options.invoice ? { invoice: options.invoice } : undefined,
          payment_link: Object.hasOwn(options, "refreshedLink")
            ? options.refreshedLink
            : "https://testing.zid.store/pay/test-private",
        },
      });
    throw new Error("Unexpected test path");
  };
  try {
    await work(h);
  } finally {
    globalThis.fetch = original;
  }
}
test("contact input requires consent, Saudi phone, bounded quantities and exact choices", () => {
  const input = checkoutInput(form());
  assert.equal(input.phone, "500000000");
  assert.equal(input.quantity, 2);
  for (const [field, value] of [
    ["quantity", "0"],
    ["quantity", "21"],
    ["quantity", "2.5"],
    ["phone", "123"],
    ["email", "bad"],
    ["consent", "no"],
    ["product", "../other"],
    ["address", "x\nInjected"],
  ]) {
    const f = form();
    f.set(field, value);
    assert.throws(() => checkoutInput(f));
  }
});
test("private envelopes reject tampering, a different session and a wrong key", () => {
  const encrypted = sealCheckout({ secret: "private" }, sessionHash, key);
  assert.deepEqual(openPrivate(encrypted, sessionHash, key), {
    secret: "private",
  });
  assert.throws(() => openPrivate(encrypted, "different", key));
  assert.throws(() =>
    openPrivate(encrypted, sessionHash, Buffer.alloc(32, 3).toString("base64")),
  );
});
test("checkout posts require browser possession, exact Origin and constant-time CSRF match", () => {
  verifyCheckoutPost(origin, browser, csrfFor(browser), origin);
  assert.throws(() =>
    verifyCheckoutPost(
      "https://evil.example",
      browser,
      csrfFor(browser),
      origin,
    ),
  );
  assert.throws(() => verifyCheckoutPost(origin, browser, "wrong", origin));
  assert.throws(() =>
    verifyCheckoutPost(null, browser, csrfFor(browser), origin),
  );
});
test("payment links are HTTPS and exact-host only; order identity and total are authoritative", () => {
  for (const url of [
    "http://testing.zid.store/pay",
    "https://testing.zid.store.evil/pay",
    "https://evil.example/pay",
    "https://user:password@testing.zid.store/pay",
    "javascript:alert(1)",
    "https://testing.zid.store:444/pay",
  ])
    assert.equal(safePaymentUrl(url, "https://testing.zid.store"), null);
  assert(
    safePaymentUrl(
      "https://testing.zid.store/pay",
      "https://testing.zid.store",
    ),
  );
  assert.throws(() =>
    developmentOrder(
      {
        order: { id: 1, store_id: 999, currency_code: "SAR", order_total: 12 },
      },
      "3258532",
    ),
  );
  assert.throws(() =>
    developmentOrder(
      {
        order: {
          id: 1,
          store_id: 3258532,
          currency_code: "USD",
          order_total: 12,
        },
      },
      "3258532",
    ),
  );
  assert.equal(
    developmentOrder(
      {
        order: {
          id: 1,
          store_id: 3258532,
          currency_code: "SAR",
          order_total: 12,
          payment_status: "unknown",
        },
      },
      "3258532",
    ).payment,
    "unknown",
  );
});
test("preparation reads live stock, validates and saves encrypted contacts without creating an order", async () => {
  await harness(async (h) => {
    const ctx = await checkoutSession(browser);
    await prepareCheckout(ctx, form());
    assert.equal(
      h.calls.find((c: any) => c.url.endsWith("/drafts/validate")).body
        .consignee.address.line_2,
      "Test building",
    );
    assert.equal(h.createCalls, 0);
    assert.equal(h.job.state, "READY");
    assert(!JSON.stringify(h.job.summary).includes("test@example.com"));
    assert(!h.job.request_ciphertext.includes("Test address"));
  });
});
test("creation is claimed once and an uncertain timeout permanently blocks this attempt", async () => {
  await harness(
    async (h) => {
      let ctx = await checkoutSession(browser);
      await prepareCheckout(ctx, form());
      ctx = await checkoutSession(browser);
      await assert.rejects(createCheckout(ctx, h.job.revision));
      assert.equal(h.job.state, "UNKNOWN");
      ctx = await checkoutSession(browser);
      await assert.rejects(createCheckout(ctx, h.job.revision));
      await assert.rejects(prepareCheckout(ctx, form()));
      assert.equal(h.createCalls, 1);
    },
    { timeout: true },
  );
});
test("successful creation stores attribution and refresh reads only that exact order", async () => {
  await harness(
    async (h) => {
      let ctx = await checkoutSession(browser);
      await prepareCheckout(ctx, form());
      ctx = await checkoutSession(browser);
      await createCheckout(ctx, h.job.revision);
      assert.equal(h.job.state, "CREATED");
      assert.equal(h.job.order_id, "123");
      ctx = await checkoutSession(browser);
      const result = await readCheckoutResult(ctx, true);
      assert.equal(result?.payment, "paid");
      assert.equal(result?.link, null);
      assert.equal(h.createCalls, 1);
      await assert.rejects(createCheckout(ctx, h.job.revision));
    },
    { paid: true },
  );
});
test("changed stock before creation requires a new review and never submits the order", async () => {
  await harness(async (h) => {
    let ctx = await checkoutSession(browser);
    await prepareCheckout(ctx, form());
    const envelope = openPrivate<any>(
      h.job.request_ciphertext,
      sessionHash,
      key,
    );
    envelope.unitPrice = 99;
    h.job.request_ciphertext = sealCheckout(envelope, sessionHash, key);
    ctx = await checkoutSession(browser);
    await assert.rejects(createCheckout(ctx, h.job.revision));
    assert.equal(h.createCalls, 0);
    assert.equal(h.job.state, "FAILED");
  });
});
test("missing payment method, wrong store and invalid validation cannot reach creation", async () => {
  for (const options of [
    { payment: false },
    { identity: 999 },
    { store: "999" },
    { invalid: true },
    { product: { quantity: 0 } },
    { product: { store_id: 999 } },
    { product: { has_options: true } },
    { product: { purchase_restrictions: { max_quantity_per_cart: 1 } } },
  ])
    await harness(async (h) => {
      await assert.rejects(async () =>
        prepareCheckout(await checkoutSession(browser), form()),
      );
      assert.equal(h.createCalls, 0);
    }, options);
});
test("failed result persistence after provider acceptance is uncertain and never automatically retried", async () => {
  await harness(
    async (h) => {
      let ctx = await checkoutSession(browser);
      await prepareCheckout(ctx, form());
      ctx = await checkoutSession(browser);
      await assert.rejects(createCheckout(ctx, h.job.revision));
      assert.equal(h.job.state, "UNKNOWN");
      assert.equal(h.createCalls, 1);
    },
    { saveFailure: true },
  );
});
test("private test page is localized, contains no tokens or contact details, and has no third-party scripts", async () => {
  await harness(async () => {
    for (const lang of ["ar", "en"]) {
      const response = await GET(
        new NextRequest(
          origin + "/api/integrations/zid/checkout?lang=" + lang,
          { headers: { cookie: `${ZID_COOKIE}=${browser}` } },
        ),
      );
      assert.equal(response.status, 200);
      const html = await response.text();
      assert(html.includes(`lang="${lang}"`));
      assert(!html.includes("test-access-token"));
      assert(!html.includes("test@example.com"));
      assert(!html.includes("hidden</option>"));
      assert(
        response.headers
          .get("Content-Security-Policy")
          ?.includes("script-src 'nonce-"),
      );
    }
  });
});
test("forged post cannot validate or create; disabled gate fails closed", async () => {
  await harness(async (h) => {
    const response = await POST(
      new NextRequest(origin + "/api/integrations/zid/checkout", {
        method: "POST",
        headers: {
          cookie: `${ZID_COOKIE}=${browser}`,
          origin: "https://evil.example",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "action=create&csrf=invalid&confirm=yes",
      }),
    );
    assert.equal(response.status, 303);
    assert(response.headers.get("location")?.includes("invalid_request"));
    assert.equal(h.createCalls, 0);
  });
  process.env.ZID_DEV_CHECKOUT_ENABLED = "false";
  try {
    await assert.rejects(checkoutSession(browser));
  } finally {
    process.env.ZID_DEV_CHECKOUT_ENABLED = "true";
  }
});

test("checkout UI snapshots cover review, waiting, created and failed states without real provider traffic", async () => {
  if (!process.env.RELOAD_CHECKOUT_UI_DIR) return;
  await harness(async (h) => {
    const capture = async (stage: string) => {
      for (const lang of ["ar", "en"]) {
        const response = await GET(
          new NextRequest(
            origin + "/api/integrations/zid/checkout?lang=" + lang,
            { headers: { cookie: `${ZID_COOKIE}=${browser}` } },
          ),
        );
        writeFileSync(
          `${process.env.RELOAD_CHECKOUT_UI_DIR}/${stage}-${lang}.html`,
          await response.text(),
        );
      }
    };
    await capture("details");
    for (const lang of ["ar", "en"]) {
      const response = await GET(
        new NextRequest(
          origin +
            "/api/integrations/zid/checkout?lang=" +
            lang +
            "&error=address_details_required",
          { headers: { cookie: `${ZID_COOKIE}=${browser}` } },
        ),
      );
      writeFileSync(
        `${process.env.RELOAD_CHECKOUT_UI_DIR}/error-${lang}.html`,
        await response.text(),
      );
    }
    let ctx = await checkoutSession(browser);
    await prepareCheckout(ctx, form());
    await capture("review");
    ctx = await checkoutSession(browser);
    await createCheckout(ctx, h.job.revision);
    await capture("created");
    h.job.state = "UNKNOWN";
    await capture("waiting");
    h.job = null;
    process.env.ZID_DEV_CHECKOUT_ENABLED = "false";
    try {
      await capture("disabled");
    } finally {
      process.env.ZID_DEV_CHECKOUT_ENABLED = "true";
    }
  });
});

test("validation errors keep safe field values for correction without creating an order", async () => {
  await harness(async (h) => {
    const f = form();
    f.set("quantity", "0");
    f.set("csrf", csrfFor(browser));
    f.set("action", "validate");
    f.set("lang", "en");
    const response = await POST(
      new NextRequest(origin + "/api/integrations/zid/checkout", {
        method: "POST",
        headers: {
          cookie: `${ZID_COOKIE}=${browser}`,
          origin,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams([...f.entries()] as [
          string,
          string,
        ][]).toString(),
      }),
    );
    assert.equal(response.status, 422);
    const html = await response.text();
    assert(html.includes('value="Test User"'));
    assert(html.includes('role="alert"'));
    assert.equal(h.createCalls, 0);
  });
});

test("payment status refresh rejects a different store or order without reporting payment", async () => {
  for (const options of [
    { orderStore: 999, paid: true },
    { orderId: 999, paid: true },
  ]) {
    await harness(async (h) => {
      let ctx = await checkoutSession(browser);
      await prepareCheckout(ctx, form());
      ctx = await checkoutSession(browser);
      await createCheckout(ctx, h.job.revision);
      ctx = await checkoutSession(browser);
      await assert.rejects(readCheckoutResult(ctx, true));
      const response = await GET(
        new NextRequest(origin + "/api/integrations/zid/checkout?lang=en", {
          headers: { cookie: `${ZID_COOKIE}=${browser}` },
        }),
      );
      const html = await response.text();
      assert(html.includes("Your test order is saved"));
      assert(!html.includes("Paid — reported by Zid"));
      assert(!html.includes("Reconnect development store"));
      assert.equal(h.createCalls, 1);
    }, options);
  }
});

test("a disabled payment-link method after review prevents creation", async () => {
  const options: Record<string, any> = {};
  await harness(async (h) => {
    let ctx = await checkoutSession(browser);
    await prepareCheckout(ctx, form());
    options.payment = false;
    ctx = await checkoutSession(browser);
    await assert.rejects(createCheckout(ctx, h.job.revision));
    assert.equal(h.createCalls, 0);
    assert.equal(h.job.state, "FAILED");
  }, options);
});

test("an existing order can recover its link after the returned payment host is explicitly verified", async () => {
  await harness(
    async (h) => {
      let ctx = await checkoutSession(browser);
      await prepareCheckout(ctx, form());
      ctx = await checkoutSession(browser);
      await createCheckout(ctx, h.job.revision);
      const saved = openPrivate<any>(h.job.result_ciphertext, sessionHash, key);
      saved.link = null;
      h.job.result_ciphertext = sealCheckout(saved, sessionHash, key);
      ctx = await checkoutSession(browser);
      assert.equal((await readCheckoutResult(ctx, true))?.link, null);
      const previous = process.env.ZID_DEV_PAYMENT_HOSTS;
      process.env.ZID_DEV_PAYMENT_HOSTS = "pay.example.com";
      try {
        assert.equal(
          (await readCheckoutResult(ctx, true))?.link,
          "https://pay.example.com/existing-order",
        );
        assert.equal(h.createCalls, 1);
      } finally {
        if (previous === undefined) delete process.env.ZID_DEV_PAYMENT_HOSTS;
        else process.env.ZID_DEV_PAYMENT_HOSTS = previous;
      }
    },
    { refreshedLink: "https://pay.example.com/existing-order" },
  );
});

test("editing a review restores this browser's details and still asks for consent again", async () => {
  await harness(async (h) => {
    const ctx = await checkoutSession(browser);
    await prepareCheckout(ctx, form());
    const response = await GET(
      new NextRequest(
        origin + "/api/integrations/zid/checkout?lang=en&edit=1",
        { headers: { cookie: `${ZID_COOKIE}=${browser}` } },
      ),
    );
    assert.equal(response.status, 200);
    const html = await response.text();
    assert(html.includes('value="Test User"'));
    assert(html.includes('value="test@example.com"'));
    assert(html.includes('value="Test address"'));
    assert(html.includes('value="Test building"'));
    assert(!/name="consent"[^>]*checked/.test(html));
    assert.equal(h.createCalls, 0);
  });
});

test("uncertain creation shows one honest waiting message, no automatic-check claim or create action", async () => {
  await harness(
    async (h) => {
      let ctx = await checkoutSession(browser);
      await prepareCheckout(ctx, form());
      ctx = await checkoutSession(browser);
      await assert.rejects(createCheckout(ctx, h.job.revision));
      const response = await GET(
        new NextRequest(
          origin +
            "/api/integrations/zid/checkout?lang=en&error=provider_unknown",
          {
            headers: { cookie: `${ZID_COOKIE}=${browser}` },
          },
        ),
      );
      const html = await response.text();
      assert(html.includes("Order result not confirmed"));
      assert(html.includes("does not automatically search Zid"));
      assert(!html.includes("Checking this attempt"));
      assert(!html.includes("We couldn’t reach Zid"));
      assert(!html.includes('name="action" value="create"'));
      assert.equal((html.match(/class="notice waiting"/g) ?? []).length, 1);
      assert.equal(h.createCalls, 1);
    },
    { timeout: true },
  );
});

test("Arabic and Persian digits are accepted without accepting malformed contact or decimal quantities", () => {
  for (const [phone, quantity] of [
    ["٠٥٠٠٠٠٠٠٠٠", "٢"],
    ["+۹۶۶۵۰۰۰۰۰۰۰۰", "۲"],
  ]) {
    const f = form();
    f.set("phone", phone);
    f.set("quantity", quantity);
    assert.equal(checkoutInput(f).phone, "500000000");
    assert.equal(checkoutInput(f).quantity, 2);
  }
  const f = form();
  f.set("quantity", "٢٫٥");
  assert.throws(() => checkoutInput(f));
});

test("order observations allowlist invoice numbers, explicit guest flags and the exact product stock", () => {
  const order = developmentOrder(
    {
      order: {
        id: 123,
        store_id: 3258532,
        currency_code: "SAR",
        order_total: "230.00",
        is_guest_customer: "1",
        products: null,
        payment: {
          invoice: [
            {
              code: "vat",
              value: "30",
              title: "<script>private title</script>",
            },
            { code: "total", value: "230" },
            { code: "unknown_internal_field", value: "100" },
            { code: "sub_totals_before_vat", value: null },
          ],
        },
      },
    },
    "3258532",
  );
  assert.deepEqual(order.invoice, [
    { kind: "vat", amount: 30 },
    { kind: "total", amount: 230 },
  ]);
  assert.equal(order.guest, null);
  assert.equal(matchesSelection(order.items, "TEST-SHOE", 2), "unknown");
  assert.equal(
    stockSample(
      { ...rawProduct, store_id: 999 },
      "shoe-1",
      "3258532",
      "TEST-SHOE",
    ),
    null,
  );
  assert.equal(
    stockSample(
      { ...rawProduct, sku: "different" },
      "shoe-1",
      "3258532",
      "TEST-SHOE",
    ),
    null,
  );
  assert.deepEqual(
    stockSample(
      { ...rawProduct, quantity: 0 },
      "shoe-1",
      "3258532",
      "TEST-SHOE",
    ),
    { unlimited: false, quantity: 0 },
  );
  assert.deepEqual(
    stockSample(
      { ...rawProduct, is_infinite: true },
      "shoe-1",
      "3258532",
      "TEST-SHOE",
    ),
    { unlimited: true, quantity: null },
  );
});

test("cancelled, changed or missing order items and removed links never offer stale payment", async () => {
  for (const options of [
    { orderStatus: "cancelled" },
    { orderStatus: "reversed" },
    { orderItems: [{ sku: "DIFFERENT", quantity: 2 }] },
    { orderItems: [{ sku: "TEST-SHOE", quantity: 3 }] },
    { orderItems: null },
    { refreshedLink: null },
  ])
    await harness(async (h) => {
      let ctx = await checkoutSession(browser);
      await prepareCheckout(ctx, form());
      ctx = await checkoutSession(browser);
      await createCheckout(ctx, h.job.revision);
      ctx = await checkoutSession(browser);
      assert.equal((await readCheckoutResult(ctx, true))?.link, null);
      const response = await GET(
        new NextRequest(origin + "/api/integrations/zid/checkout?lang=en", {
          headers: { cookie: `${ZID_COOKIE}=${browser}` },
        }),
      );
      assert(!(await response.text()).includes("Open secure payment page"));
      assert.equal(h.createCalls, 1);
    }, options);
});

test("expired or malformed requested deadlines block payment without creating replacement orders", async () => {
  for (const deadline of [
    "invalid",
    new Date(Date.now() - 10000).toISOString(),
  ])
    await harness(async (h) => {
      let ctx = await checkoutSession(browser);
      await prepareCheckout(ctx, form());
      ctx = await checkoutSession(browser);
      await createCheckout(ctx, h.job.revision);
      const saved = openPrivate<any>(h.job.result_ciphertext, sessionHash, key);
      saved.linkExpires = deadline;
      h.job.result_ciphertext = sealCheckout(saved, sessionHash, key);
      ctx = await checkoutSession(browser);
      const result = await readCheckoutResult(ctx, true);
      assert.equal(result?.expired, true);
      assert.equal(result?.link, null);
      assert.equal(h.createCalls, 1);
    });
});

test("stock observations are independent of payment confirmation and make no reservation claim", async () => {
  const options: Record<string, any> = {
    paid: true,
    guest: 1,
    invoice: [
      { code: "vat", value: "30.00" },
      { code: "total", value: "230.00" },
    ],
  };
  await harness(async (h) => {
    let ctx = await checkoutSession(browser);
    await prepareCheckout(ctx, form());
    ctx = await checkoutSession(browser);
    await createCheckout(ctx, h.job.revision);
    options.product = { quantity: 8 };
    ctx = await checkoutSession(browser);
    const result = await readCheckoutResult(ctx, true);
    assert.equal(result?.payment, "paid");
    assert.deepEqual(result?.stockBefore, { unlimited: false, quantity: 10 });
    assert.deepEqual(result?.stockAfter, { unlimited: false, quantity: 8 });
    assert.equal(result?.guest, true);
    options.stockFailure = true;
    assert.equal((await readCheckoutResult(ctx, true))?.payment, "paid");
    const response = await GET(
      new NextRequest(origin + "/api/integrations/zid/checkout?lang=en", {
        headers: { cookie: `${ZID_COOKIE}=${browser}` },
      }),
    );
    const html = await response.text();
    assert(html.includes("VAT reported by Zid"));
    assert(html.includes("does not prove this order reserved the item"));
    assert(!html.includes("test@example.com"));
  }, options);
});

test("switching language preserves an unfinished form without provider validation or order creation", async () => {
  await harness(async (h) => {
    const f = form();
    f.set("quantity", "");
    f.set("csrf", csrfFor(browser));
    f.set("action", "language");
    f.set("lang", "ar");
    const response = await POST(
      new NextRequest(origin + "/api/integrations/zid/checkout", {
        method: "POST",
        headers: {
          cookie: `${ZID_COOKIE}=${browser}`,
          origin,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams([...f.entries()] as [
          string,
          string,
        ][]).toString(),
      }),
    );
    assert.equal(response.status, 200);
    const html = await response.text();
    assert(html.includes('lang="ar"'));
    assert(html.includes('value="Test User"'));
    assert(html.includes('value="test@example.com"'));
    assert(!/name="consent"[^>]*checked/.test(html));
    assert(!h.calls.some((c: any) => c.url.endsWith("/drafts/validate")));
    assert.equal(h.createCalls, 0);
    assert.equal(h.job, null);
  });
});

test("conflicting provider totals hide payment and do not create a replacement order", async () => {
  await harness(
    async (h) => {
      let ctx = await checkoutSession(browser);
      await prepareCheckout(ctx, form());
      ctx = await checkoutSession(browser);
      await createCheckout(ctx, h.job.revision);
      ctx = await checkoutSession(browser);
      const result = await readCheckoutResult(ctx, true);
      assert.equal(result?.totalsMatch, false);
      assert.equal(result?.link, null);
      const response = await GET(
        new NextRequest(origin + "/api/integrations/zid/checkout?lang=en", {
          headers: { cookie: `${ZID_COOKIE}=${browser}` },
        }),
      );
      const html = await response.text();
      assert(html.includes("invoice total differs"));
      assert(!html.includes("Open secure payment page"));
      assert.equal(h.createCalls, 1);
    },
    { invoice: [{ code: "total", value: "999.00" }] },
  );
});
