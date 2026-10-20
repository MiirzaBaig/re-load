# Homepage v201 — review and implementation brief

Reviewed: 2026-10-20. Input: root `Reload Homepage v201.html`, provided by Abdulaziz. Status: reference reviewed; no production website or supplied HTML changed. This replaces the older `Reload Homepage Source.html` as the content reference for execution-plan phase 10. Retain existing application architecture/design and verified route contracts; do not deploy the exported HTML directly.

## Owner instruction

Remove the entire hero sentence shown in the screenshot:

> من 149 ريال شهريًا · يرتبط بسلة وزد وشوبيفاي

Do not remove legitimate plan prices from pricing cards. This instruction does not reverse the standing direction to preserve existing Salla wording elsewhere pending the Make.com decision. It also does not authorize new Salla or Shopify readiness claims.

## Review verdict

The newer reference better reflects customer support + returns + sales. It adds annual billing, explicit product-link versus checkout distinctions, a shorter WhatsApp demonstration invitation, controls on the illustrative demo, and dedicated feature-page link targets. Good content direction, not release-ready implementation.

Keep: Arabic-first plain language, clear policy/merchant control, both-plan product recommendations, 500/2,000 allowances, separate courier-charge disclosure, monthly allowance reset under annual billing, interest-registration CTA for financing.

Refine: repeated outcome claims across demo/benefits/solutions/integrations/trust; compress repeated explanations rather than add length. Use one purposeful demonstrator; reference mockups must remain clearly illustrative and cannot imply an accepted live checkout/shipping feature. Do not copy recurring typing or decorative motion into production; respect DESIGN.md and reduced motion.

## Required content corrections

| Topic | Reference finding | Implementation requirement |
| --- | --- | --- |
| Hero | Screenshot sentence remains present | Remove that entire sentence, preserving normal pricing information elsewhere. |
| Signup | Says mobile signup with OTP | Match actual email-based authentication; order email recovery OTP is a separate flow. |
| Integrations | Shopify logo and signup claim suggest Shopify is available; new Salla statements appear | Do not introduce unsupported platform availability. Shopify is not built. Preserve current deployed Salla wording pending owner decision; do not amplify new reference claims. |
| Sales | Payment-link demo and Premium cards describe checkout as working | Both-plan product lookup/links are foundations; advanced recommendation quality and Premium checkout remain unaccepted work. Mark planned checkout clearly until verified per platform. |
| Shipping | Says labels are issued automatically for approved returns | Match approved merchant-controlled quoting/booking. Premium only, courier costs separate; no automatic bookings at launch. Mark upcoming until accepted. |
| Outbound scope | Reference mostly describes reverse shipping | Once implemented, explain purchase shipping applies only to paid orders attributed to Reload-created WhatsApp checkouts, not all store orders. Keep return shipping distinct. |
| Funding | Says merchant/customer pays according to policy | Distinguish who funds booking from who ultimately bears return fees; funding mechanism/Reload fee still unresolved. No automatic refund deductions. |
| Labels | Customer printing requirement omitted | Explain printing before return collection at the relevant feature/booking step. Do not promise courier-provided labels. |
| Financing | Interest CTA improved, but faster refunds still sound operational | Describe interest/eligibility enquiry only. No live financing, accelerated refund, underwriting or payout promise. |
| Plan names | Uses البداية / النمو | Keep agreed Standard/Premium naming and consistent approved Arabic equivalents unless the team approves a rename. |
| Annual | Toggle present | Verify actual values SAR1,430.40 / SAR2,870.40, VAT inclusive, charged yearly, monthly allowance reset. Toggle presence alone is not verification. |
| Message rollover | Says unused messages do not carry forward | Apply this specifically to included monthly allowance; do not imply the same for purchased balances. Bundles remain disabled pending pricing approval. |
| FAQ placeholders | WhatsApp number and data access answers say team must confirm | Replace with verified answers below. No placeholders in released HTML. |
| Legal identity | Footer includes placeholder legal name/registration/tax numbers | Require verified team details or omit placeholder fields. Never invent legal identifiers. |
| Feature links | Points to local `Reload *.dc.html` files | Map to real localized Next.js routes; obtain missing references if needed, otherwise write factual pages. No dead local export links. |
| Contact/legal/resources | Prototype anchors and form are not acceptance evidence | Wire real contact submission, privacy/terms, guides/tools, signup and language routes. Preserve existing public URL behavior. |
| Reload WhatsApp demo | Promises agent answers Reload questions | Test the precise link/context and approved Reload knowledge. General greeting alone is not a successful demo. |
| Human reply | Says merchant can answer any conversation at any time | Check live takeover/resume and channel restrictions; do not promise free-form messages outside permitted service windows. |

## Proposed factual FAQ answers

### هل ريلود يشتغل على رقم واتساب متجري؟

حاليًا، يستخدم العملاء رقم واتساب موحّدًا لريلود. لكل متجر رابط خاص يحدّد المتجر داخل المحادثة. ربط رقم واتساب خاص بمتجرك ليس متاحًا حاليًا.

English: Customers currently contact a shared Reload WhatsApp number. Each store has its own link to identify the store in the conversation. Connecting your own WhatsApp number is not available yet.

### وش يشوف ريلود من بيانات متجري؟

تستخدم ريلود معلومات المنتجات والطلبات التي يتيحها ربط متجرك، والمعلومات والسياسات التي تعتمدها، للرد على العملاء ومعالجة طلباتهم. نتحقّق من ملكية الطلب قبل عرض تفاصيله الخاصة للعميل. تختلف البيانات والصلاحيات حسب منصة المتجر والربط المتاح.

English: Reload uses product and order information available through your connected store, along with the knowledge and policies you approve. We verify order ownership before sharing private order details with a customer. Available data and permissions depend on the store platform and connection.

These are proposed public answers grounded in the existing contract, not a claim that every platform provides the same scopes. Align with actual privacy policy before release.

## Updated execution sequence for phase 10

- [ ] Use v201 as the reference, remove requested hero sentence and inventory every public claim.
- [ ] Build an available / upcoming / external-blocker claim matrix against actual releases.
- [ ] Align shared ar/en pricing, plan entitlements, journey, FAQ and financing wording; do not silently override Salla exception.
- [ ] Tighten homepage: hero → one illustrative product/merchant demonstration → support/returns/sales → shipping availability → setup → pricing → FAQ/contact. Merge redundant trust/benefit content as appropriate.
- [ ] Implement only real localized feature routes with useful content and honest readiness states. Preserve existing guides/tools/legal/auth routes.
- [ ] Keep native pricing transitions and brief purposeful interactions; no imported prototype runtime or autoplay typing dependency.
- [ ] Update shared metadata, OG artwork/copy, visible schema and llms.txt facts together where changed; keep readiness qualifiers in all representations.
- [ ] Test desktop and 390px, Arabic RTL and English, monthly/annual calculations, keyboard navigation, reduced motion, forms, links and live WhatsApp invitation.
- [ ] Run appropriate type/build/SEO checks; record actual evidence. Owner review before commit/push/deploy.

## Review evidence and limits

2026-10-20: rendered supplied local file in headless Chrome at desktop width; inspected full-page screenshot and extracted rendered text/anchor targets. Screenshot sentence, local `.dc.html` links, mobile-auth wording, two unanswered FAQ fields and legal placeholder observed. No mobile/English interaction, pricing toggle, form submission, live WhatsApp reply or application integration acceptance was performed. No code changed or provider settings updated.

## Owner design correction and local implementation — 2026-10-20

Preserve the existing homepage design and animation system. A proposed replacement design was reverted in this session. Do not copy the exported reference's layout or substitute a new visual system. Import updated content and implement missing sections using existing ScrollReveal, heading accents, cards, buttons and page spacing. Original hero, walkthrough, benefits, calculator, outcomes, navigation and pricing animations remain.

Locally implemented: broader hero copy; additive solutions/connection/setup/contact sections; real ar/en solution routes; updated approved plan wording with planned-action qualifiers; factual shared-number/data-access FAQs; metadata/sitemap/llms alignment. No global CSS change. Existing demo wording no longer promises automatic refund initiation and makes photos optional. Prototype source files remain unmodified.

Not completed by this frontend work: backend entitlement alignment, sales checkout, OTO booking, authentic Reload WhatsApp product demo, live billing acceptance or deployment. Contact uses the existing /interest flow; no new lead-processing backend was introduced.

Final local verification (2026-10-20): TypeScript and production build passed. Public SEO check passed for 46 localized pages plus root, sitemap (48 URLs), robots, protected/noindex routes and preview PNGs. Browser checked Arabic/English at 1440px and 390px: one H1, no horizontal overflow, original hero/walkthrough present, annual totals correct; dark mode and normal-motion hero checked, zero page errors. All eight localized solution URLs returned 200. No live WhatsApp/API checkout/shipping or real form submission tested.

## Connection hub and section reconciliation — 2026-10-20

Owner requested the actual central connection diagram, not three substitute explanation cards. Replaced only that additive section with `src/components/connection-hub.tsx`: store platforms and courier examples flank the existing Reload mark on desktop; both lead into the central mark and customer services on mobile. ResizeObserver measures real node bounds so connector paths remain attached across language/layout changes. Connector strokes draw once (350ms); service tabs crossfade (280ms), support arrow/Home/End keys, and respect reduced motion. No loops, network status simulation, provider API requests or automatic shipping promises.

Logos are local PNG derivatives extracted from the owner-supplied v201 document, under `public/brand/connections/` (not fetched from external logo services). Platform labels distinguish Zid AI Connector, Salla connection under review and planned Shopify. This does not change existing Salla copy elsewhere. Courier logos are explicitly illustrative examples via planned OTO; availability/rates depend on provider, route and service. No direct partnership/coverage claim. The company names/logos are visual references, not evidence of completed integration.

### Section-by-section mapping

| v201 section | Local treatment |
| --- | --- |
| Hero and navigation | Existing design/motion retained; broader copy; rejected price/platform sentence absent. |
| Interactive demonstration | Existing customer/merchant return walkthrough retained, with optional-photo and merchant-follow-up corrections. No fake live purchase/payment demo introduced. |
| “We use Reload” WhatsApp strip | Existing contact/WhatsApp entry points retained; not promising an unverified autonomous Reload-product demo. Real bot acceptance remains external. |
| Benefits | Existing two-sided animated benefits retained; wording avoids faster-refund promise. |
| Support / returns / sales solutions | Added linked solution cards and real localized detail pages, with upcoming checkout distinction. |
| Return shipping / financing | Shipping described as planned Premium; existing return-cost/financing section retained with interest-only disclaimer/contact flow. |
| Integration hub | Now implemented as requested, with central Reload mark, courier/platform logos, measured animated paths and customer-service tabs. |
| Trust | Added approved knowledge, merchant control, verification and Arabic/official WhatsApp information in existing visual language. |
| Setup | Added accurate email-based four-step merchant setup. |
| Pricing | Existing animated monthly/annual cards retained; approved both-plan support copy and clearly upcoming Premium actions. Backend entitlement alignment still pending. |
| FAQ | Existing disclosure design retained, updated plan facts; own-number/data-access questions on full FAQ page. |
| Contact | Real existing /interest submission flow linked from home rather than introducing an untested duplicate form or changing database policies. |
| Footer / resources | Existing design and real routes retained; no copied legal placeholders or dead exported-file links. |

Hub browser checks: Arabic and English at 1440, 768 and 390px, images loaded, no horizontal overflow, service tabs and End-key focus passed, dark-mode screenshot inspected, zero page errors. No production deployment or real provider requests were made. Build/SEO final results recorded in root trackers.

Final hub checks: TypeScript/production build and extended public SEO assertions passed. Normal-motion connector draw and tab transition checked; reduced-motion disables service transitions. No browser page errors. No provider transactions or live form submissions tested; no commit/push/deploy.

## Hub visual simplification — 2026-10-20, latest owner direction

Supersedes earlier hub-label and container descriptions: removed outer provider/customer panels, nested icon boxes, account/connector/status labels, provider implementation text and long technical notes from this diagram. Keep it a conceptual journey illustration with neutral platform/provider names, not a live integration status dashboard. Specific readiness boundaries remain on feature pages and pricing; no backend capabilities were enabled. Existing Salla wording outside the diagram remains unchanged.

Added once-only logo entrances (280ms), line drawing (350ms), one short travelling connection point, and service selection with a sliding underline/crossfade. Customer-facing service descriptions replace backend explanations. Headset, open parcel and shopping bag icons are unboxed. Original hero/walkthrough/pricing mechanics remain unchanged. Source: src/components/connection-hub.tsx and scoped hub CSS.

Verified Arabic/English at 1440/768/390px: logos load, measured wires remain attached, no horizontal overflow, service selection and keyboard focus pass, dark mode inspected and no page errors. TypeScript and production build passed. No live form, checkout or shipping transaction tested. No commit/push/deploy.

## Homepage release review — 2026-10-20

Reviewed the combined frontend changes, including later hero, rotating illustrative conversation demo, contact form, currency symbol, mobile/RTL improvements and revised connection hub. Retained owner-approved motion refinements. Corrected shipping labels/FAQs/demo text so merchant-approved shipping is not advertised as an already-working automatic action. General WhatsApp invitation does not promise a verified autonomous Reload-product demonstration. Backend sales/OTO work remains separate.

Production build and TypeScript passed. Browser checks covered ar/en at 1440 and 390px: no overflow, one H1, one contact anchor, no copied placeholders, correct annual totals, and mocked contact success UI; zero page errors. Contact endpoint rejected null/array/malformed bodies, bad/cross-site origins and oversized requests. A synthetic contact was saved through the local API into the configured Supabase backend, then deleted successfully; this does not prove Vercel production environment settings. Extended public SEO checks passed. No paid checkout, OTO booking, real merchant/contact message or live billing change performed. Exported HTML references and unrelated pricing-research draft remain local, outside this release.
