# Release readiness — 2026-09-18

## Current verdict

The repository is feature-complete for the hackathon demo after the checks below pass. It is not yet appropriate to describe the public service as independently security-audited or App Store release-complete. Store purchases, the production Supabase migration and distributed abuse controls must be verified in the real deployment.

## Verified in this repository

- TypeScript, ESLint, production build and the project test suites run without live AI requests.
- `npm audit --omit=dev` reports zero known production dependency vulnerabilities.
- Server-only AI secrets are not exposed through `NEXT_PUBLIC_` variables.
- Retired unauthenticated database endpoints return 404 at the proxy boundary.
- API mutations have origin checks, request-size limits and bounded process-local request budgets.
- Receipt uploads accept only the supported image formats, at most five files and at most 6 MB per file.
- API responses are network-only in the service worker and use `Cache-Control: no-store`.
- The production Plus test-password UI is disabled unless a dedicated test-build flag is explicitly enabled.
- Community seed recipes have Japanese and English data. Published recipes missing the selected language are translated from the canonical stored recipe, validated for structure and numeric quantities, cached locally, and fall back to the original without hiding the recipe.
- The loading component no longer renders the unintended steam layer.

## Before a public store release

1. Apply and inspect `supabase/migrations/202609160001_community_recipes.sql` in the production project. Confirm every account-owned table has RLS enabled and test cross-account reads and writes with two real accounts.
2. Put a distributed quota/WAF in front of AI, OCR and anonymous community endpoints. The in-process limiter is defense in depth and resets when a serverless instance is replaced.
3. Decide whether anonymous community posting is acceptable. Device IDs prevent ordinary duplicate actions but are not authentication; a hostile client can replace them. Require Supabase Auth or a server-only publication credential before describing the community feature as abuse-resistant.
4. Run RevenueCat sandbox purchase, restore and cancellation tests on physical iOS and Android devices. Confirm the test-access flag is false in the public build.
5. Run Japanese and English device tests for receipt camera permissions, offline/reconnect sync, recipe completion, community publication, account restore and accessibility text scaling.
6. Complete privacy disclosures for receipt images, recipe feedback, account sync and AI processing. Rotate any credential ever pasted into a chat or log, even if it was restricted.

## Accurate hackathon security wording

Use: “Sikurepi keeps AI credentials server-side, validates and size-limits uploads, retires legacy data endpoints at the request boundary, avoids caching private API responses, preserves recipe quantities during translation, and uses database RLS for account-owned data. Automated dependency audit currently reports zero known production vulnerabilities.”

Do not use: “unhackable”, “fully secure”, “formally audited”, or “production certified”.
