import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/public-site";

// Private areas stay out of every crawler. Authentication is the real access
// boundary; this only keeps them out of search results.
const PRIVATE = ["/api/", "/app/", "/admin/", "/return/", "/onboarding"];

// Decision (2026-10-18, Mirza): Reload should be known to AI assistants, so
// AI search, user-fetch and training crawlers are explicitly welcome on the
// public site. Named groups replace "*" for that bot, so each repeats PRIVATE.
const AI_CRAWLERS = [
  // OpenAI: ChatGPT search, ChatGPT browsing, model training
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  // Anthropic: Claude search, Claude browsing, model training
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  // Perplexity
  "PerplexityBot",
  "Perplexity-User",
  // Google Gemini / Apple Intelligence training controls
  "Google-Extended",
  "Applebot-Extended",
  // Others that power assistants and open datasets
  "Meta-ExternalAgent",
  "DuckAssistBot",
  "MistralAI-User",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
