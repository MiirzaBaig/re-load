import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/admin/shipping/sandbox/route";
import { setAdminAccess } from "./fixtures/admin-access";
import {
  quoteInput,
  courierRates,
  sampleParcel,
  type QuoteInput,
} from "../src/lib/oto/contracts";
import {
  sandboxConnection,
  sandboxQuotes,
} from "../src/lib/oto/sandbox-server";
const input: QuoteInput = {
  originCity: "Riyadh",
  destinationCity: "Riyadh",
  ...sampleParcel,
};
const rates = {
  success: true,
  deliveryCompany: [
    {
      deliveryOptionId: 2828,
      deliveryOptionName: "SMSA Express",
      price: 68.42,
      returnFee: 34.21,
      currency: "SAR",
      pickupDropoff: "freePickupDropoff",
      token: "PRIVATE",
      logo: "http://internal.local",
      customer: "PRIVATE",
    },
    {
      deliveryOptionId: 2241,
      deliveryOptionName: "Test rate",
      price: 31.03,
      returnFee: "31.03",
      currency: "SAR",
    },
  ],
};
const original = globalThis.fetch;
async function mock(
  work: (calls: Array<{ url: string; body: any }>) => Promise<void>,
  options: Record<string, any> = {},
) {
  const old = {
    token: process.env.OTO_SANDBOX_REFRESH_TOKEN,
    gate: process.env.OTO_SANDBOX_ENABLED,
  };
  process.env.OTO_SANDBOX_REFRESH_TOKEN = "test-private-refresh";
  process.env.OTO_SANDBOX_ENABLED = "true";
  const calls: Array<{ url: string; body: any }> = [];
  globalThis.fetch = async (raw, init) => {
    const url = String(raw);
    calls.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    assert(url.startsWith("https://staging-api.tryoto.com/rest/v2/"));
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    if (options.networkFailure) throw new Error("PRIVATE provider details");
    const json = url.endsWith("refreshToken")
      ? {
          success: true,
          access_token: "test-private-access",
          expires_in: "3600",
        }
      : url.endsWith("healthCheck")
        ? { status: "OK" }
        : url.endsWith("accountInfo")
          ? {
              packageName: "FreePackage",
              email: "PRIVATE",
              mobileNumber: "PRIVATE",
              remainingCredit: 0,
            }
          : rates;
    return new Response(
      options.invalidJson
        ? "PRIVATE malformed"
        : JSON.stringify(options.providerBody ?? json),
      { status: options.httpStatus ?? 200 },
    );
  };
  try {
    await work(calls);
  } finally {
    globalThis.fetch = original;
    if (old.token === undefined) delete process.env.OTO_SANDBOX_REFRESH_TOKEN;
    else process.env.OTO_SANDBOX_REFRESH_TOKEN = old.token;
    if (old.gate === undefined) delete process.env.OTO_SANDBOX_ENABLED;
    else process.env.OTO_SANDBOX_ENABLED = old.gate;
    setAdminAccess(null);
  }
}
function request(
  body: unknown,
  origin: string | null = "https://reload.example",
) {
  return new Request("https://reload.example/api/admin/shipping/sandbox", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify(body),
  });
}
test("parcel contract rejects contacts, arbitrary cities and invalid numeric inputs", () => {
  assert.deepEqual(quoteInput(input), input);
  for (const bad of [
    { ...input, email: "PRIVATE" },
    { ...input, originCity: "unknown" },
    { ...input, weight: "1" },
    { ...input, weight: 0 },
    { ...input, weight: 31 },
    { ...input, height: 151 },
    { ...input, width: NaN },
    { ...input, length: 1.234 },
  ])
    assert.throws(() => quoteInput(bad));
});
test("quote projection distinguishes delivery and return prices and excludes provider payload fields", () => {
  const result = courierRates(rates);
  assert.equal(result[1].returnFee, 34.21);
  assert.equal(result[1].price, 68.42);
  assert.equal(result[1].sandboxBookable, true);
  assert.equal(result[0].sandboxBookable, false);
  assert(!JSON.stringify(result).includes("PRIVATE"));
  assert(!JSON.stringify(result).includes("internal.local"));
  assert.throws(() => courierRates({ success: false, deliveryCompany: [] }));
  assert.equal(
    courierRates({
      success: true,
      deliveryCompany: [
        {
          deliveryOptionId: 1,
          deliveryOptionName: "x",
          price: "",
          returnFee: -1,
        },
        {
          deliveryOptionId: 2,
          deliveryOptionName: "x",
          price: 1,
          currency: "USD",
        },
      ],
    }).length,
    0,
  );
});
test("sandbox stays disabled without the explicit gate and never falls back to a production credential", async () => {
  await mock(async (calls) => {
    delete process.env.OTO_SANDBOX_ENABLED;
    await assert.rejects(sandboxConnection(), /disabled/);
    assert.equal(calls.length, 0);
    process.env.OTO_SANDBOX_ENABLED = "true";
    delete process.env.OTO_SANDBOX_REFRESH_TOKEN;
    await assert.rejects(sandboxConnection(), /configuration/);
    assert.equal(calls.length, 0);
  });
});
test("authenticated staging reads strip account contacts and support missing success fields", async () => {
  await mock(async (calls) => {
    const result = await sandboxConnection();
    assert.equal(result.healthy, true);
    assert.equal(result.plan, "FreePackage");
    assert(!JSON.stringify(result).includes("PRIVATE"));
    assert.equal(calls.length, 3);
  });
});
test("quotes use only rate endpoints and fixed SA/SAR non-COD fields", async () => {
  await mock(async (calls) => {
    const result = await sandboxQuotes(input);
    assert.equal(result.rates.length, 2);
    assert.equal(calls.length, 2);
    assert(calls[1].url.endsWith("checkOTODeliveryFee"));
    assert.deepEqual(calls[1].body, {
      ...input,
      originCountry: "SA",
      destinationCountry: "SA",
      currency: "SAR",
      packageCount: 1,
      totalDue: 0,
    });
  });
});
test("API refuses anonymous, sales and viewer access, foreign origins and booking actions before provider requests", async () => {
  await mock(async (calls) => {
    for (const role of [null, "sales", "viewer", "merchant"]) {
      setAdminAccess(role ? { role } : null);
      assert.equal(
        (await POST(request({ action: "quote", input }))).status,
        403,
      );
    }
    setAdminAccess({ role: "owner" });
    for (const origin of [null, "https://foreign.example"])
      assert.equal(
        (await POST(request({ action: "connection" }, origin))).status,
        403,
      );
    for (const body of [
      { action: "book" },
      { action: "connection", token: "PRIVATE" },
      {
        action: "quote",
        input: { ...input, origin: "https://api.tryoto.com" },
      },
      null,
      [],
    ])
      assert.equal((await POST(request(body))).status, 400);
    assert.equal(calls.length, 0);
  });
});
test("API audit failure stops provider access and provider failures never disclose raw data", async () => {
  await mock(async (calls) => {
    setAdminAccess({ role: "owner", auditFailure: true });
    const response = await POST(request({ action: "connection" }));
    assert.equal(response.status, 503);
    assert.equal(calls.length, 0);
    assert(!(await response.text().then((s) => s.includes("PRIVATE"))));
  });
  for (const options of [
    { httpStatus: 401 },
    { httpStatus: 500 },
    { networkFailure: true },
    { invalidJson: true },
  ])
    await mock(async () => {
      setAdminAccess({ role: "owner" });
      const response = await POST(request({ action: "connection" }));
      assert.equal(response.status, 503);
      assert(!(await response.text().then((s) => s.includes("PRIVATE"))));
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    }, options);
});
test("owner quote requests return only the safe projection", async () => {
  await mock(async (calls) => {
    setAdminAccess({ role: "owner" });
    const response = await POST(request({ action: "quote", input }));
    assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
    assert(!JSON.stringify(await response.json()).includes("PRIVATE"));
  });
});
