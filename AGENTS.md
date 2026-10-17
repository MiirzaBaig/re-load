<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Reload repository context

Read CONTEXT.md, MEMORY.md, FUTURE.md and DESIGN.md before implementation. Current feature contracts and operational limits live in docs/. The current app is Next.js/Supabase with production WhatsApp, not the September browser-only prototype. Keep merchant approval, tenant isolation and masked support access intact. Never commit private environment values. See docs/environment-configuration.md for the local inventory and provider-specific configuration boundaries.

SEO/GEO maintenance: public search-facing changes must update root SEO.md and GEO.md with decisions, verified checks and remaining external work. Arabic-first public URLs are approved. Preserve the existing Salla wording until Mirza supplies the Make.com decision.
