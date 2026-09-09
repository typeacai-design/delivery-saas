<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Local infrastructure access

For authorized Supabase/Vercel operations, read [docs/ACESSO_API_LOCAL.md](docs/ACESSO_API_LOCAL.md). Supabase credentials are DPAPI protected under the main repository .credentials directory, ignored by Git and Vercel; use the loader instead of printing or copying secrets.
