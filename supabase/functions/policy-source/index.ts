import { corsHeaders, json } from "../_shared/http.ts";
import { userClient } from "../_shared/supabase.ts";

const POLICY_HINT = /(return|refund|exchange|إرجاع|استرجاع|استبدال)/i;

function safeUrl(value: string) {
  const input = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  const url = new URL(input);
  if (url.protocol !== "https:") throw new Error("https_required");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) throw new Error("unsafe_host");
  return url;
}

async function fetchHtml(input: URL) {
  let current = input;
  for (let redirects = 0; redirects < 4; redirects += 1) {
    const response = await fetch(current, { redirect: "manual", headers: { "User-Agent": "Reload-Policy-Discovery/1.0", Accept: "text/html" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("redirect_missing");
      current = safeUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`source_${response.status}`);
    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("text/html")) throw new Error("html_required");
    return { html: (await response.text()).slice(0, 500_000), url: current };
  }
  throw new Error("too_many_redirects");
}

function textFromHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim().slice(0, 30_000);
}

function policyLinks(html: string, base: URL) {
  const matches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  return matches.flatMap((match) => {
    const label = textFromHtml(match[2]);
    if (!POLICY_HINT.test(`${label} ${match[1]}`)) return [];
    try { const url = new URL(match[1], base); return url.hostname === base.hostname ? [url] : []; } catch { return []; }
  }).slice(0, 8);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const authorization = request.headers.get("Authorization") ?? "";
    const client = userClient(authorization);
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: "authentication_required" }, 401);
    const { storeId, url, action = "fetch" } = await request.json();
    const { data: membership } = await client.from("memberships").select("role").eq("store_id", storeId).eq("user_id", user.id).maybeSingle();
    if (!membership) return json({ error: "insufficient_permission" }, 403);
    let sourceUrl = typeof url === "string" && url.trim() ? url : "";
    if (action === "discover" && !sourceUrl) {
      const { data: connection } = await client.from("commerce_connections").select("public_store_url").eq("store_id", storeId).eq("platform", "salla").maybeSingle();
      sourceUrl = connection?.public_store_url ?? "";
    }
    if (!sourceUrl) return json({ found: false, error: "store_url_unavailable" }, 200);
    const home = await fetchHtml(safeUrl(sourceUrl));
    if (action === "discover") {
      const links = policyLinks(home.html, home.url);
      if (!links.length) return json({ found: false, storeUrl: home.url.toString() });
      const policy = await fetchHtml(links[0]);
      const sourceText = textFromHtml(policy.html);
      return sourceText.length >= 40 ? json({ found: true, url: policy.url.toString(), sourceText }) : json({ found: false, storeUrl: home.url.toString() });
    }
    const sourceText = textFromHtml(home.html);
    if (sourceText.length < 40) return json({ error: "policy_text_not_found" }, 422);
    return json({ found: true, url: home.url.toString(), sourceText });
  } catch (error) {
    console.error("policy_source_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "policy_source_failed" }, 422);
  }
});
