// Tell Bing (and other IndexNow engines) about every public URL right after a
// deploy. ChatGPT search and Microsoft Copilot rely heavily on Bing's index.
// Usage: node scripts/indexnow.mjs   (run after production is live)
const host = "www.reload.sa";
const key = "6f16fc1cbef35cd5136c04e3a734977f"; // public by design; the file public/${key}.txt proves ownership
const sitemap = await (await fetch(`https://${host}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urlList.length) throw new Error("No URLs in the live sitemap. Is the deploy finished?");
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList }),
});
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URLs`);
