// Deterministic brand artwork. Uses an existing Playwright installation supplied by the caller.
// Example: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/generate-share-images.mjs
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const modulePath = process.env.PLAYWRIGHT_MODULE;
if (!modulePath)
  throw new Error("Set PLAYWRIGHT_MODULE to an existing Playwright module.");
const { chromium } = await import(pathToFileURL(modulePath).href);
const browser = await chromium.launch();
try {
  for (const locale of ["ar", "en"]) {
    // English: the mark plus the word "Reload" in Manrope 600, exactly like the
    // site header. (public/brand/reload-en.svg is an old wordmark that reads
    // "Relod"; do not use it.) Arabic keeps the official lockup.
    const logo =
      locale === "ar"
        ? await readFile("public/brand/reload-ar.svg", "utf8")
        : `<span style="display:flex;align-items:center;gap:14px">${(await readFile("public/brand/reload-icon.svg", "utf8")).replace('fill="currentColor"', 'fill="#0f0f12" style="width:52px;height:52px"')}<span style="font:600 58px Manrope,sans-serif;letter-spacing:-1.2px;line-height:1">Reload</span></span>`;
    const font = await readFile(
      "public/fonts/thmanyah/sans/woff2/thmanyah-sans-Bold.woff2",
    );
    const html = `<!doctype html><meta charset="utf-8"><style>@import url(https://fonts.googleapis.com/css2?family=Manrope:wght@600&display=block);@font-face{font-family:arabic;src:url(data:font/woff2;base64,${font.toString("base64")})}*{box-sizing:border-box}body{margin:0;background:#f8f7f4;color:#0f0f12;font-family:arabic,Arial,sans-serif}.card{width:1200px;height:630px;padding:65px 76px;position:relative;overflow:hidden}.top{display:flex;justify-content:space-between;align-items:center}.logo svg{width:205px;height:65px}.domain{font-size:22px;color:#60636a}.rule{width:50px;height:5px;background:#4557c7;margin:55px 0 25px;border-radius:5px}h1{font-size:${locale === "ar" ? 62 : 65}px;line-height:1.3;letter-spacing:-1.5px;max-width:1000px;margin:0;font-weight:700}p{font-size:26px;color:#60636a;margin:20px 0 0}.bottom{position:absolute;bottom:47px;left:76px;right:76px;border-top:1px solid #dddde3;padding-top:22px;display:flex;justify-content:space-between;font-size:19px;color:#60636a}.shape{position:absolute;bottom:-175px;right:-120px;width:470px;height:470px;border:70px solid #4557c707;border-radius:50%;z-index:-1}</style><div class="card" dir="${locale === "ar" ? "rtl" : "ltr"}"><div class="top"><div class="logo">${logo}</div><span class="domain" dir="ltr">www.reload.sa</span></div><div class="rule"></div><h1>${locale === "ar" ? "الإرجاع وخدمة العملاء.<br>على واتساب." : "Returns and customer support.<br>Right on WhatsApp."}</h1><p>${locale === "ar" ? "بسياسات متجرك. وبموافقتك." : "Your store’s information. Your approved policies."}</p><div class="bottom"><span>${locale === "ar" ? "للمتاجر الإلكترونية السعودية" : "Built for Saudi online stores"}</span><span>${locale === "ar" ? "ريلود" : "reload"}</span></div></div>`;
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
    });
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `public/brand/reload-share-${locale}.png` });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log("Created Arabic and English 1200 × 630 share images.");
