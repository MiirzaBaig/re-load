import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const require = createRequire(process.cwd() + "/package.json");
const { chromium } = require(
  process.env.RELOAD_PLAYWRIGHT_MODULE || "playwright",
);
const fixtureDir = process.env.RELOAD_CHECKOUT_UI_DIR;
const origin = "https://reload-test.example";

test("checkout screens, styled selects, field validation and language preservation work in both directions", async () => {
  assert(
    fixtureDir,
    "Set RELOAD_CHECKOUT_UI_DIR to provider-mocked HTML fixtures.",
  );
  const browser = await chromium.launch();
  let screens = 0;
  try {
    for (const language of ["ar", "en"])
      for (const width of [390, 1440])
        for (const colorScheme of ["light", "dark"])
          for (const reducedMotion of ["reduce", "no-preference"]) {
            const page = await browser.newPage({
              viewport: { width, height: 1000 },
              colorScheme,
              reducedMotion,
            });
            const errors: string[] = [];
            let submission: URLSearchParams | null = null;
            page.on("pageerror", (error: Error) => errors.push(error.message));
            page.on("console", (message: any) => {
              if (message.type() === "error") errors.push(message.text());
            });
            await page.route(origin + "/**", async (route: any) => {
              const request = route.request();
              const url = new URL(request.url());
              if (request.method() === "POST") {
                submission = new URLSearchParams(request.postData());
                assert.equal(request.headers().origin, origin);
                return route.fulfill({
                  contentType: "text/html",
                  body: "<html><body>Captured mock submission</body></html>",
                });
              }
              if (url.pathname.startsWith("/fonts/"))
                return route.fulfill({
                  contentType: "font/woff2",
                  body: readFileSync(join("public", url.pathname)),
                });
              if (url.pathname === "/brand/reload-icon-192.png")
                return route.fulfill({
                  contentType: "image/png",
                  body: readFileSync("public/brand/reload-icon-192.png"),
                });
              const html = readFileSync(
                join(fixtureDir!, url.pathname.slice(1)),
                "utf8",
              );
              const nonce = /<script nonce="([^"]+)"/.exec(html)?.[1];
              return route.fulfill({
                contentType: "text/html",
                headers: {
                  "Referrer-Policy": "same-origin",
                  "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; script-src 'nonce-${nonce}'`,
                },
                body: html,
              });
            });
            const go = (stage: string) =>
              page.goto(`${origin}/${stage}-${language}.html`);
            for (const stage of [
              "details",
              "review",
              "created",
              "waiting",
              "disabled",
              "error",
            ]) {
              await go(stage);
              await page.evaluate(() => document.fonts.ready);
              await page.waitForTimeout(reducedMotion === "reduce" ? 10 : 280);
              const shape = await page.evaluate(() => ({
                fits: document.documentElement.scrollWidth <= innerWidth,
                dir: document.documentElement.dir,
                current: document.querySelectorAll('[aria-current="step"]')
                  .length,
                unlabelled: Array.from(
                  document.querySelectorAll<HTMLInputElement>(
                    "input:not([type=hidden]),select:not([aria-hidden=true])",
                  ),
                ).filter((input) => !input.labels?.length).length,
                motion: getComputedStyle(document.querySelector(".card")!)
                  .animationName,
              }));
              assert(
                shape.fits,
                `${stage} overflows ${language}/${width}/${colorScheme}`,
              );
              assert.equal(shape.dir, language === "ar" ? "rtl" : "ltr");
              assert.equal(shape.current, stage === "disabled" ? 0 : 1);
              assert.equal(shape.unlabelled, 0);
              if (reducedMotion === "reduce")
                assert.equal(shape.motion, "none");
              if (stage === "details") {
                // Both controls align even when only the phone has a help line.
                if (width === 1440) {
                  const [email, phone] = await Promise.all([
                    page.locator("#email").boundingBox(),
                    page.locator("#phone").boundingBox(),
                  ]);
                  assert.equal(email.y, phone.y);
                  assert.equal(email.height, phone.height);
                }
                const trigger = page.locator("#product-trigger");
                assert.equal(await trigger.getAttribute("role"), "combobox");
                await trigger.focus();
                await page.keyboard.press("ArrowDown");
                assert.equal(
                  await trigger.getAttribute("aria-expanded"),
                  "true",
                );
                assert(await page.locator("#product-menu").isVisible());
                const menu = await page.locator("#product-menu").boundingBox();
                assert(menu.x >= 0 && menu.x + menu.width <= width);
                await page.keyboard.press("Enter");
                assert.equal(
                  await page.locator("#product").inputValue(),
                  "shoe-1",
                );
                await trigger.click();
                await page.keyboard.press("Escape");
                assert.equal(
                  await trigger.getAttribute("aria-expanded"),
                  "false",
                );
                await trigger.click();
                await page.locator("h1").click();
                assert.equal(
                  await trigger.getAttribute("aria-expanded"),
                  "false",
                );
                await trigger.focus();
                await page.keyboard.press("ArrowDown");
                await page.keyboard.press("Home");
                await page.keyboard.press("End");
                assert(await trigger.getAttribute("aria-activedescendant"));
                await page.keyboard.press("Tab");
                assert.equal(
                  await trigger.getAttribute("aria-expanded"),
                  "false",
                );
                await page.locator('button[type="submit"]').click();
                assert(await page.locator(".form-feedback").isVisible());
                assert.equal(submission, null);
                await page.locator("#name").fill("Browser test");
                await page.locator("#email").fill("bad-email");
                await page.locator("#phone").fill("123");
                await page.locator("#quantity").fill("٢١");
                await page.locator('button[type="submit"]').click();
                for (const name of ["email", "phone", "quantity"])
                  assert.equal(
                    await page.locator("#" + name).getAttribute("aria-invalid"),
                    "true",
                  );
                assert.equal(submission, null);
                // Language change works even when the unfinished fields are invalid.
                await page.locator("[data-language]").click();
                await page.waitForURL(
                  origin + "/api/integrations/zid/checkout",
                );
                assert(submission);
                const languageSubmission = submission as URLSearchParams;
                assert.equal(languageSubmission.get("action"), "language");
                assert.equal(languageSubmission.get("name"), "Browser test");
                assert.equal(languageSubmission.get("quantity"), "٢١");
                assert.equal(
                  languageSubmission.get("lang"),
                  language === "ar" ? "en" : "ar",
                );
                submission = null;
                await go("details");
                await page.locator("#product-trigger").click();
                await page
                  .locator('#product-menu [role="option"]')
                  .first()
                  .click();
                for (const [name, value] of Object.entries({
                  name: "Browser test",
                  email: "test@example.com",
                  phone: "٠٥٠٠٠٠٠٠٠٠",
                  quantity: "٢",
                  city: "Riyadh",
                  address: "Test street",
                  addressExtra: "Building 12",
                }))
                  await page.locator("#" + name).fill(value);
                await page.locator("#consent").check();
                await page
                  .locator("form")
                  .evaluate((form: HTMLFormElement) =>
                    form.addEventListener("submit", (event) =>
                      event.preventDefault(),
                    ),
                  );
                await page.locator('button[type="submit"]').click();
                await page.waitForTimeout(20);
                assert.equal(
                  await page.locator("form").getAttribute("aria-busy"),
                  "true",
                );
                assert(
                  await page.locator('button[type="submit"]').isDisabled(),
                );
                await page.evaluate(() =>
                  window.dispatchEvent(
                    new PageTransitionEvent("pageshow", { persisted: true }),
                  ),
                );
                assert(
                  !(await page.locator('button[type="submit"]').isDisabled()),
                );
                assert.equal(
                  await page.locator('[name="action"]').inputValue(),
                  "validate",
                );
                assert.equal(
                  await page.locator("form").getAttribute("aria-busy"),
                  null,
                );
              }
              if (stage === "review") {
                await page.locator('button[type="submit"]').click();
                assert.equal(
                  await page.locator("#confirm").getAttribute("aria-invalid"),
                  "true",
                );
                assert.equal(submission, null);
              }
              if (stage === "waiting") {
                assert.equal(await page.locator("form").count(), 0);
                assert.equal(await page.locator(".notice.waiting").count(), 1);
              }
              if (stage === "error") {
                assert.equal(
                  await page
                    .locator("#addressExtra")
                    .getAttribute("aria-invalid"),
                  "true",
                );
                assert(await page.locator("#addressExtra-error").isVisible());
              }
              if (width === 390 && reducedMotion === "no-preference")
                await page.screenshot({
                  path: `/tmp/reload-checkout-${stage}-${language}-${colorScheme}.png`,
                  fullPage: true,
                });
              screens++;
            }
            assert.deepEqual(errors, []);
            await page.close();
          }
    console.log(
      `${screens} localized/theme/viewport/motion screen checks passed, including keyboard dropdown and form interactions.`,
    );
  } finally {
    await browser.close();
  }
});

test("native controls and required fields remain usable when JavaScript is disabled", async () => {
  assert(fixtureDir);
  const browser = await chromium.launch();
  try {
    for (const language of ["ar", "en"]) {
      const page = await browser.newPage({
        javaScriptEnabled: false,
        viewport: { width: 390, height: 900 },
      });
      let posts = 0;
      await page.route(origin + "/**", async (route: any) => {
        if (route.request().method() === "POST") {
          posts++;
          return route.fulfill({ body: "Unexpected submit" });
        }
        const path = new URL(route.request().url()).pathname;
        if (path.startsWith("/fonts/"))
          return route.fulfill({
            contentType: "font/woff2",
            body: readFileSync(join("public", path)),
          });
        if (path.startsWith("/brand/"))
          return route.fulfill({
            contentType: "image/png",
            body: readFileSync(join("public", path)),
          });
        return route.fulfill({
          contentType: "text/html",
          body: readFileSync(
            join(fixtureDir!, `details-${language}.html`),
            "utf8",
          ),
        });
      });
      await page.goto(origin + "/details");
      assert(await page.locator("#product").isVisible());
      assert.equal(await page.locator(".pick-trigger").count(), 0);
      await page.locator("#product").selectOption("shoe-1");
      await page.locator('button[type="submit"]').click();
      assert.equal(posts, 0);
      assert.equal(await page.locator("form").getAttribute("novalidate"), null);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});
