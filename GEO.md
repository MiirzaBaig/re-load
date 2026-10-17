# Reload GEO / AI-search tracker

Updated: 2026-10-18. Released to main on 2026-10-18. Maintain alongside SEO.md whenever public claims, answer content, schema, language behavior or crawler policy change. This file documents decisions; it does not cause AI engines to index or recommend Reload.

## Objective and limits

Help search/AI systems find accurate public facts about Reload and direct relevant merchants to useful pages. Optimize for accurate understanding and qualified visits, not unprovable ranking/citation promises. No model training, automatic self-learning or private workspace crawling is involved.

## Decisions

- Arabic-first Saudi/GCC content with stable equivalent English pages; no cookie-only public language variants.
- Consistent entity: Reload / ريلود, www.reload.sa, WhatsApp returns and customer support, merchant-approved knowledge/policies. No invented legal entity name, address, reviews, customer counts or operational capabilities.
- Concise visible answers, prices and practical customer/merchant flow. FAQ, journey and pricing details are accessible in server HTML. Structured data must agree with visible copy.
- Preserve existing Salla copy at Mirza's explicit request during Make.com research; do not amplify this unresolved claim in new structured data. Track it for later owner review.
- Do not imply automated lending, shipping bookings or refund payouts. Distinguish sandbox/payment rollout from live availability. Do not publish private offers.
- `/llms.txt` added on 2026-10-17 at Mirza's request (`src/app/llms.txt/route.ts`). It is generated from `PUBLIC_COPY`, `PUBLIC_FAQS`, `PUBLIC_STEPS` and `BILLING_PLANS`, so it can never disagree with the visible pages or schema. Arabic section first, then English. Google ignores llms.txt for search; it is a low-cost convenience for tools that read it, not a ranking lever. No private offers, no hand-written claims.
- No special “AI schema,” hidden prompts, bot-only keyword pages, fabricated testimonials or mass-generated articles.
- 2026-10-18, owner decision (Mirza): Reload should be recognised by AI assistants. `src/app/robots.ts` explicitly welcomes AI search, user-fetch and training crawlers (OpenAI OAI-SearchBot/ChatGPT-User/GPTBot, Anthropic Claude-SearchBot/Claude-User/ClaudeBot, PerplexityBot/Perplexity-User, Google-Extended, Applebot-Extended, Meta-ExternalAgent, DuckAssistBot, MistralAI-User, CCBot). Private paths stay disallowed for all of them. To opt out of training later, remove GPTBot, ClaudeBot, Google-Extended, Applebot-Extended, Meta-ExternalAgent and CCBot only; search bots keep visibility.
- 2026-10-18 live check: every crawler user agent above, plus Googlebot, bingbot and Applebot, received HTTP 200 with the full homepage from https://www.reload.sa, so no Vercel firewall rule is blocking AI bots. Recheck after any firewall/bot-protection change.
- IndexNow: key file in `public/` and `node scripts/indexnow.mjs` submits every sitemap URL to Bing/IndexNow. Run it after each production deploy that changes public pages. ChatGPT search and Copilot rely heavily on Bing's index.

## What exists in this update

| Work | Benefit | Actual status |
| --- | --- | --- |
| ar/en canonical pages and reciprocal language links | Stable URLs to retrieve/cite in each language | Local implementation |
| Clear FAQ and how-it-works content | Direct answers about plans, verification, approval, limits and cancellation | Local implementation |
| Shared pricing facts and visible yearly table | Consistent costs and message limits across UI and schema | Local implementation |
| Organization/WebSite/WebPage/Breadcrumb and software offers | Explicit public facts, without fake ratings | Local implementation |
| Public robots + sitemap | Crawl guidance; no indexing guarantee | Local implementation |
| Arabic/English share images | Better link presentation, not a ranking trick | Local artwork |
| `/llms.txt` plain-text summary (ar + en) | One clean file with what Reload is, plans, steps and FAQ for AI tools that read it | Local implementation, generated from shared facts |
| FAQPage schema on `/faq` | Bing and AI assistants can read questions and answers directly; Google no longer shows FAQ results for most sites | Local implementation |
| Merchant guides (3, ar + en) and free return-policy template | Citable, useful answers to merchant questions; a reason for other sites to link to Reload | Local implementation, Article/WebApplication schema |
| Anonymous pricing/signup/contact intent events | Start measuring whether visits have useful outcomes | dataLayer only; analytics tags/account acceptance pending |

## Measurement plan

1. Establish Search Console/Bing access. Bing AI Performance can report supported citations when available; do not equate Google Search Console totals with a separate AI-only attribution report.
2. Record a small repeatable list of Arabic/English merchant questions and their dates: what is Reload; pricing; WhatsApp returns; Saudi merchant support. Record source citations and factual errors. Model answers vary and this is not an objective ranking score.
3. Track organic visits and eligible AI referral traffic separately where referrers exist. Some AI/direct traffic cannot be attributed reliably. Never label every direct visit “AI.”
4. Measure visitor → pricing → signup → connected store → paid store, keeping intent distinct from completed conversion and excluding internal/test traffic where configured.
5. Once real merchants consent, publish useful case studies with real figures, context, measurement dates and clear limitations. Seek legitimate mentions from relevant partners/publications; no backlink buying or fake directories.

## How each assistant finds Reload (for planning, not guarantees)

- ChatGPT search: OpenAI's own crawler plus partner search indexes (largely Bing). Needs: OAI-SearchBot allowed, Bing Webmaster Tools + IndexNow.
- Claude: web search results plus its own fetchers. Needs: Claude-SearchBot/Claude-User allowed, a strong presence in general web search.
- Perplexity: its own crawler and index. Needs: PerplexityBot allowed, clear factual pages, third-party mentions.
- Gemini / Google AI Overviews: Google Search index. Needs: Search Console, sitemap, normal Google SEO.
- Copilot: Bing. Needs: Bing Webmaster Tools + IndexNow.
- Model knowledge without search (what a model "just knows"): comes only from training data collected before its cutoff. Allowing GPTBot/ClaudeBot/CCBot helps future models; it cannot change models already released.
- Codex and coding agents are not a discovery channel for a merchant product; they fetch pages only when someone asks.

## Off-site entity work (owner/team)

Assistants trust a company more when several independent sources describe it the same way: name Reload / ريلود, domain www.reload.sa, one-line description "WhatsApp returns and customer support for Saudi online stores".
1. LinkedIn company page, X and Instagram with that exact description and the website link; then add their URLs to Organization `sameAs`.
2. Zid App Market listing (and Salla once approved) linking to www.reload.sa.
3. Crunchbase and a Google Business Profile, if the company has a registered address.
4. Genuine mentions: launch posts, Saudi e-commerce communities, partner pages, interviews. No paid link schemes or fake reviews.
5. Wikipedia/Wikidata only once independent press coverage exists (notability rules).

## External / pending work

- Owner-approved Arabic wording and exact public company/contact facts.
- Deployment and share cache refresh; live indexing/citation observation.
- Search Console, Bing Webmaster and published GTM/GA4 access/configuration.
- Actual search-volume research and field performance data. Candidate keywords remain hypotheses, not verified demand.
- Support-platform/partner approval or status changes, especially Salla/Make.com, must update both trackers and all public representations together.

## Sources

- https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- https://developers.openai.com/api/docs/bots
- https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c
- https://developers.google.com/search/docs/fundamentals/using-gen-ai-content

Community helper evaluation from planning: coreyhaines31/marketingskills seo-audit and ai-seo were inspected as candidates (roughly 230k/145k directory installs, 55k repository stars at audit time). None installed; popularity is not accuracy. Official docs and observed product behavior take precedence.
