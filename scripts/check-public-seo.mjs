// Read-only release assertions against a local or deployed Reload website.
import assert from "node:assert/strict";
const origin = process.env.SEO_CHECK_ORIGIN || "http://localhost:3000";
const canonical = "https://www.reload.sa";
for (const locale of ["ar", "en"])
  for (const suffix of [
    "",
    "/solutions/customer-support",
    "/solutions/returns",
    "/solutions/sales",
    "/solutions/shipping",
    "/pricing",
    "/faq",
    "/how-it-works",
    "/guides",
    "/guides/return-policy",
    "/guides/whatsapp-returns",
    "/guides/reduce-returns",
    "/return-policy-template",
    "/return-policy-template/fashion",
    "/return-policy-template/abayas",
    "/return-policy-template/perfumes",
    "/return-policy-template/cosmetics",
    "/return-policy-template/electronics",
    "/return-policy-template/kids",
    "/tools",
    "/tools/policy-checker",
    "/tools/whatsapp-link",
    "/tools/returns-cost-calculator",
  ]) {
    const path = `/${locale}${suffix}`;
    const response = await fetch(origin + path, {
      headers: {
        cookie: `relod-language=${locale === "ar" ? "en" : "ar"}`,
        "Accept-Language": locale === "ar" ? "en" : "ar",
        "x-reload-public-locale": locale === "ar" ? "en" : "ar",
      },
      redirect: "manual",
    });
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.match(
      html,
      new RegExp(
        `<html[^>]+lang="${locale}"[^>]+dir="${locale === "ar" ? "rtl" : "ltr"}"`,
      ),
      path + " language must follow URL",
    );
    assert.ok(
      html.includes(`rel="canonical" href="${canonical + path}"`),
      path + " canonical",
    );
    assert.equal([...html.matchAll(/<h1[\s>]/g)].length, 1, path + " exactly one H1");
    if (suffix === "/faq") assert.ok(html.includes('"@type":"FAQPage"'), path + " FAQPage");
    assert.ok(
      html.includes(`hrefLang="ar"`) || html.includes(`hreflang="ar"`),
      path + " Arabic alternate",
    );
    assert.ok(
      html.includes(`hrefLang="en"`) || html.includes(`hreflang="en"`),
      path + " English alternate",
    );
    assert.ok(html.includes("x-default"), path + " default alternate");
    assert.ok(html.includes(`reload-share-${locale}.png`), path + " image");
    assert.match(
      html,
      /<meta name="robots" content="index, follow"/,
      path + " index",
    );
    const schemas = [
      ...html.matchAll(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
      ),
    ].map((m) => JSON.parse(m[1]));
    assert.equal(schemas.length, 1, path + " JSON-LD");
    if (suffix === "/pricing") {
      const app = schemas[0]["@graph"].find(
        (x) => x["@type"] === "SoftwareApplication",
      );
      assert.equal(app.offers.length, 4);
      assert.deepEqual(
        app.offers.map((x) => x.price),
        ["149.00", "1430.40", "299.00", "2870.40"],
      );
      for (const value of ["1,430.40", "2,870.40"])
        assert.ok(html.includes(value), "Annual table visible in server HTML");
    }
    if (suffix === "/faq")
      assert.ok(
        html.includes("details") &&
          html.includes("500") &&
          html.includes("2,000"),
        "FAQ answers in server HTML",
      );
    console.log("PASS", path);
  }
const root = await fetch(origin + "/");
const rootHtml = await root.text();
assert.match(rootHtml, /<html[^>]+lang="ar"/);
assert.ok(rootHtml.includes('rel="canonical" href="https://www.reload.sa/ar"'));
const robots = await fetch(origin + "/robots.txt");
assert.equal(robots.status, 200);
const rules = await robots.text();
assert.ok(rules.includes("Sitemap: https://www.reload.sa/sitemap.xml"));
assert.ok(rules.includes("Disallow: /api/"));
const sitemap = await fetch(origin + "/sitemap.xml");
assert.equal(sitemap.status, 200);
const xml = await sitemap.text();
assert.equal([...xml.matchAll(/<loc>/g)].length, 48);
assert.ok(
  !xml.includes("/app") && !xml.includes("/admin") && !/\/return[/<]/.test(xml),
);
for (const path of ["/auth", "/interest", "/return"]) {
  const r = await fetch(origin + path);
  const h = await r.text();
  assert.match(
    h,
    /<meta name="robots" content="noindex, nofollow"/,
    path + " noindex",
  );
}
const protectedRoute = await fetch(origin + "/app/billing", {
  redirect: "manual",
});
assert.equal(protectedRoute.status, 307);
assert.ok(protectedRoute.headers.get("location").includes("/auth"));
const api = await fetch(
  origin + "/api/billing?store=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
);
assert.equal(api.status, 403);
for (const path of ["/fr", "/ar/not-a-page"])
  assert.equal((await fetch(origin + path)).status, 404, path);
for (const locale of ["ar", "en"]) {
  const r = await fetch(origin + `/brand/reload-share-${locale}.png`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /image\/png/);
  const image = Buffer.from(await r.arrayBuffer());
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
}
console.log(
  "PASS root Arabic, sitemap, robots, private noindex/auth, invalid routes, PNG preview assets",
);
