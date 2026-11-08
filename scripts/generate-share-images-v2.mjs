// Share images in the "Riyadh print" style (theme-v2, 2026-10-31): a dark card
// on the dithered Kingdom Centre print, with the homepage headline and its
// blue "on WhatsApp". Renders with the Chrome already on the machine via the
// DevTools protocol, so no extra dependency is needed.
// The previous plain design is kept as public/brand/reload-share-*-v1.png and
// its generator as scripts/generate-share-images.mjs.
// usage: node scripts/generate-share-images-v2.mjs   (CHROME=/path/to/chrome to override)
// Then shrink each file (~400 KB -> ~50 KB, safe for WhatsApp link previews)
// with Pillow, keeping the blue gradient smooth:
//   Image.open(p).convert("RGB").quantize(colors=256, method=Image.Quantize.FASTOCTREE,
//     dither=Image.Dither.FLOYDSTEINBERG).save(p, optimize=True)
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9650;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const print = (await readFile("public/brand/hero-riyadh-kingdom.png")).toString("base64");
const arabicFont = (await readFile("public/fonts/thmanyah/sans/woff2/thmanyah-sans-Bold.woff2")).toString("base64");
const mark = (await readFile("public/brand/reload-icon.svg", "utf8")).replace('fill="currentColor"', 'fill="#f5f7ff" style="width:46px;height:46px"');
const arLockup = (await readFile("public/brand/reload-ar.svg", "utf8")).replace(/fill="[^"]*"/g, 'fill="#f5f7ff"').replace("<svg", '<svg style="height:52px;width:auto"');

const COPY = {
  en: {
    badge: "For online stores in Saudi Arabia",
    lead: "The smart platform for customer support and returns",
    accent: "on WhatsApp",
    sub: "Answers from your store’s information. Returns settled by your policy.",
  },
  ar: {
    badge: "للمتاجر الإلكترونية في السعودية",
    lead: "المنصة الذكية لخدمة العملاء والمرتجعات",
    accent: "على واتساب",
    sub: "ردود من معلومات متجرك، وطلبات إرجاع تُحسم حسب سياستك.",
  },
};

function html(locale) {
  const c = COPY[locale];
  const ar = locale === "ar";
  // The tower sits on the side away from the text; the shade is solid on the
  // reading side, which also hides the print's edge.
  const imgLeft = ar ? -219 : 341;
  const logo = ar
    ? arLockup
    : `<span style="display:flex;align-items:center;gap:12px">${mark}<span style="font:600 50px Manrope,sans-serif;letter-spacing:-1px;line-height:1;color:#f5f7ff">Reload</span></span>`;
  return `<!doctype html><meta charset="utf-8"><style>
@import url(https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700&display=block);
@font-face{font-family:arabic;src:url(data:font/woff2;base64,${arabicFont})}
*{box-sizing:border-box}body{margin:0;background:#080f20}
.card{position:relative;width:1200px;height:630px;overflow:hidden;background:#080f20;color:#f5f7ff;font-family:${ar ? "arabic" : "Manrope"},sans-serif;padding:58px 72px}
.print{position:absolute;top:-60px;left:${imgLeft}px;width:1100px;image-rendering:pixelated;filter:grayscale(1) sepia(1) saturate(2.8) hue-rotate(185deg)}
.shade{position:absolute;inset:0;background:linear-gradient(${ar ? 270 : 90}deg,#080f20 0%,#080f20 30%,rgba(8,15,32,.82) 50%,rgba(8,15,32,.3) 100%)}
.content{position:relative;display:flex;flex-direction:column;height:100%}
.top{display:flex;justify-content:space-between;align-items:center}
.domain{font:500 21px Manrope,sans-serif;color:rgba(245,247,255,.7)}
.badge{display:inline-flex;align-items:center;gap:10px;align-self:flex-start;margin-top:64px;padding:7px 16px 7px 8px;border:1px solid rgba(245,247,255,.16);border-radius:999px;background:rgba(0,0,0,.25);font-size:19px;color:rgba(245,247,255,.85)}
.dot{display:grid;place-items:center;width:22px;height:22px;border-radius:999px;background:rgba(174,186,255,.16)}.dot:after{content:"";width:8px;height:8px;border-radius:999px;background:#aebaff}
h1{margin:26px 0 0;max-width:${ar ? 760 : 720}px;font-size:${ar ? 60 : 58}px;line-height:${ar ? 1.35 : 1.08};letter-spacing:${ar ? 0 : -1.6}px;font-weight:700}
.accent{display:inline-block;position:relative;white-space:nowrap;background:linear-gradient(${ar ? 260 : 100}deg,#ffffff 0%,#d7dfff 55%,#aebaff 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.accent:after{content:"";position:absolute;inset-inline:2px;bottom:${ar ? 2 : -6}px;height:5px;border-radius:5px;background:linear-gradient(${ar ? 270 : 90}deg,rgba(174,186,255,.35),#aebaff)}
p{margin:${ar ? 18 : 26}px 0 0;max-width:640px;font-size:24px;line-height:1.5;color:rgba(245,247,255,.72)}
</style><div class="card" dir="${ar ? "rtl" : "ltr"}"><img class="print" src="data:image/png;base64,${print}"><div class="shade"></div>
<div class="content"><div class="top"><div>${logo}</div><span class="domain" dir="ltr">www.reload.sa</span></div>
<span class="badge"><span class="dot"></span>${c.badge}</span>
<h1>${c.lead} <span class="accent">${c.accent}</span></h1><p>${c.sub}</p></div></div>`;
}

const profile = await mkdtemp(join(tmpdir(), "reload-share-"));
const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
try {
  let tabs;
  for (let i = 0; i < 60; i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.find((t) => t.type === "page")) break; } catch {}
    await sleep(200);
  }
  const ws = new WebSocket(tabs.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = {};
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  for (const locale of ["ar", "en"]) {
    const file = join(profile, `${locale}.html`);
    await writeFile(file, html(locale));
    await send("Page.navigate", { url: `file://${file}` });
    await sleep(2500);
    await send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } });
    await writeFile(`public/brand/reload-share-${locale}.png`, Buffer.from(shot.result.data, "base64"));
  }
  ws.close();
} finally {
  chrome.kill();
  // Chrome may still be closing its profile; cleanup is best-effort.
  await sleep(800);
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
console.log("Created Arabic and English 1200 × 630 share images (print style).");
