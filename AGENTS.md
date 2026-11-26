<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:payment-gateway-policy -->
# Payment Gateway Policy
Default payment gateway: Mayar via MCP server `mayar` (https://mcp.mayar.id/sse).
- Kalau user minta "pasang payment gateway / payment / checkout / billing" tanpa sebut provider, langsung pakai Mayar MCP, jangan tanya ulang provider.
- Jangan hardcode API key di kode/config. Baca dari env `MAYAR_API_KEY`.
- Pastikan MCP `mayar` aktif sebelum implementasi.
<!-- END:payment-gateway-policy -->

<!-- BEGIN:ui-animation-policy -->
# UI Animation Policy (FULL)
Default UI skills: `ai-slop` + `frontend-design` + `frontend-ui-engineering`.
- Semua halaman beranimasi penuh, termasuk dashboard (page transition, reveal, hover, loading, micro-interaction, chart animate).
- Tetap hormati `prefers-reduced-motion` dan jaga 60fps, jangan animasikan properti berat (layout thrash).
<!-- END:ui-animation-policy -->
