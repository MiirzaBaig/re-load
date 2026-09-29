import { env } from "./http.ts";

const POLICY_HINT = /(return|refund|exchange|إرجاع|استرجاع|استبدال)/i;
const categories = ["window", "reasons", "conditions", "exclusions", "order_status", "quantity", "fallback"] as const;
const allowedCategories = new Set<string>(categories);

type ProposedRule = { category: typeof categories[number]; name: string; description: string; value: string; sourceExcerpt: string };

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
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) throw new Error("html_required");
    return { html: (await response.text()).slice(0, 500_000), url: current };
  }
  throw new Error("too_many_redirects");
}

export function textFromHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/\s+/g, " ").trim().slice(0, 30_000);
}

function policyLinks(html: string, base: URL) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap((match) => {
    if (!POLICY_HINT.test(`${textFromHtml(match[2])} ${match[1]}`)) return [];
    try { const url = new URL(match[1], base); return url.hostname === base.hostname ? [url] : []; } catch { return []; }
  }).slice(0, 8);
}

export async function fetchPolicyUrl(value: string) {
  const page = await fetchHtml(safeUrl(value));
  const sourceText = textFromHtml(page.html);
  if (sourceText.length < 40) throw new Error("policy_text_not_found");
  return { url: page.url.toString(), sourceText };
}

export async function discoverPolicy(value: string) {
  const home = await fetchHtml(safeUrl(value));
  const links = policyLinks(home.html, home.url);
  if (!links.length) return null;
  return fetchPolicyUrl(links[0].toString());
}

function parseContent(content: string) {
  return JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")) as { rules?: ProposedRule[]; warnings?: string[] };
}

function validate(sourceText: string, value: ReturnType<typeof parseContent>) {
  if (!Array.isArray(value.rules) || !value.rules.length || value.rules.length > 20) throw new Error("invalid_rules");
  const seen = new Set<string>();
  const rules = value.rules.map((rule, index) => {
    if (!rule || !allowedCategories.has(rule.category) || seen.has(rule.category)) throw new Error("invalid_category");
    seen.add(rule.category);
    for (const field of [rule.name, rule.description, rule.value, rule.sourceExcerpt]) if (typeof field !== "string" || !field.trim()) throw new Error("invalid_rule");
    const start = sourceText.indexOf(rule.sourceExcerpt);
    if (start < 0) throw new Error("source_excerpt_not_found");
    if (rule.category === "window" && !/^\d{1,3}$/.test(rule.value)) throw new Error("invalid_window");
    if (rule.category === "quantity" && !/^\d{1,4}$/.test(rule.value)) throw new Error("invalid_quantity");
    if (rule.category === "fallback" && rule.value !== "manual_review") throw new Error("invalid_fallback");
    return { id: crypto.randomUUID(), category: rule.category, name: rule.name.trim(), description: rule.description.trim(), value: rule.value.trim(), creator: "ai", approvalState: "pending", sourceExcerpt: rule.sourceExcerpt, sourceRange: { start, end: start + rule.sourceExcerpt.length }, extractionOrder: index };
  });
  return { rules, warnings: Array.isArray(value.warnings) ? value.warnings.filter((item) => typeof item === "string").slice(0, 10) : [] };
}

function prompt(sourceText: string, retry = false) {
  return `You extract a merchant return policy into proposed deterministic rules. The policy may be Arabic or English. Return JSON only: {"rules":[{"category":"window|reasons|conditions|exclusions|order_status|quantity|fallback","name":"short merchant-friendly label in the policy language","description":"plain-language meaning in the policy language","value":"engine value","sourceExcerpt":"exact verbatim substring from the policy"}],"warnings":["ambiguity or missing fact in the policy language"]}. Never invent a rule. Every rule must cite an exact sourceExcerpt. Use only engine codes: reasons defective,wrong_item,not_as_described,changed_mind,damaged_in_transit; conditions new_unopened,opened_unused,used; statuses delivered,shipped,processing,cancelled; fallback manual_review. window and quantity are integers. At most one rule per category. AI only proposes; a merchant approves every rule.${retry ? " Previous output failed validation; check exact excerpts and JSON." : ""}\n\nPOLICY:\n${sourceText}`;
}

export async function extractPolicy(sourceText: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("https://ollama.com/api/chat", { method: "POST", headers: { Authorization: `Bearer ${env("OLLAMA_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "deepseek-v4.1-flash", messages: [{ role: "user", content: prompt(sourceText, attempt > 0) }], stream: false, options: { temperature: 0 } }) });
      if (!response.ok) throw new Error(`ollama_${response.status}`);
      const body = await response.json();
      if (typeof body?.message?.content !== "string") throw new Error("ollama_response_invalid");
      return validate(sourceText, parseContent(body.message.content));
    } catch (error) { lastError = error; }
  }
  throw lastError ?? new Error("extraction_failed");
}
