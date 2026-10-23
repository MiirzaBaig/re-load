import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { checkoutPage } from "../src/lib/zid/checkout-page";
import { csrfFor, verifyCheckoutPost } from "../src/lib/zid/checkout-server";

// Install Playwright outside the repository or resolve an existing installation.
const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require(process.env.RELOAD_PLAYWRIGHT_MODULE || "playwright");
const origin = "https://reload-browser.example";
const browserToken = "b".repeat(43);

test("native checkout POST retains a verifiable origin; external payment navigation sends no referrer", async () => {
  const browser = await chromium.launch();
  try {
    for (const lang of ["ar", "en"] as const) {
      const page = await browser.newPage();
      let submission: { accepted: boolean; origin?: string } | undefined;
      let externalReferrer: string | undefined = "not visited";
      await page.route("https://reload-browser.example/**", async (route: any) => {
        const request = route.request();
        if (request.method() === "POST") {
          const fields = new URLSearchParams(request.postData());
          const receivedOrigin = request.headers().origin;
          try {
            verifyCheckoutPost(receivedOrigin ?? null, browserToken, fields.get("csrf"), origin);
            submission = { accepted: true, origin: receivedOrigin };
          } catch {
            submission = { accepted: false, origin: receivedOrigin };
          }
          return route.fulfill({ status: submission.accepted ? 200 : 403, body: "Checked" });
        }
        const response = checkoutPage(lang, "Browser test", `<form method="post"><input type="hidden" name="csrf" value="${csrfFor(browserToken)}"><button>Validate</button></form><a id="payment" href="https://payment-browser.example/pay" rel="noreferrer">Payment page</a>`);
        assert.equal(response.headers.get("Referrer-Policy"), "same-origin");
        return route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
      });
      await page.route("https://payment-browser.example/**", async (route: any) => {
        externalReferrer = route.request().headers().referer;
        await route.fulfill({ body: "Payment page" });
      });
      await page.goto(origin + "/checkout");
      await page.locator("button").click();
      await page.waitForFunction(() => document.body.textContent === "Checked");
      assert.deepEqual(submission, { accepted: true, origin });
      await page.goto(origin + "/checkout");
      await page.locator("#payment").click();
      await page.waitForURL("https://payment-browser.example/pay");
      assert.equal(externalReferrer, undefined);
      await page.close();
    }
    for (const untrustedOrigin of [null, "null", "https://untrusted.example"]) {
      assert.throws(() => verifyCheckoutPost(untrustedOrigin, browserToken, csrfFor(browserToken), origin));
    }
    assert.throws(() => verifyCheckoutPost(origin, browserToken, "wrong-token", origin));
  } finally {
    await browser.close();
  }
});
