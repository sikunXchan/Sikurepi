# Release readiness — 2026-09-18

## Follow-up verification — 2026-09-19

- Fixed English meat detection so `minced garlic` and `slivered almonds` are not treated as raw meat. Added regression cases for vegetables and real mince/offal; actual ground meat still requires cooking and safe-doneness cues.
- Repeated the English vegan/nut-exclusion live generation case that failed in the final audit: HTTP 200 in approximately 4.3 seconds on the updated local production build. This is one successful sample, not a success-rate or latency guarantee.
- All 13 test scripts, explicit TypeScript checking and the production build passed; ESLint reported no errors and 12 existing image-element warnings.
- This focused fix does not complete the distributed spending controls or physical-device RevenueCat tests listed below. Production deployment and the submission license must be verified separately.

## Current verdict

Automated web checks pass, but acceptance of the native hackathon build remains pending a fresh IPA install and launch on a physical device. It is not yet appropriate to describe the public service as independently security-audited or App Store release-complete. Store purchases, the production Supabase migration and distributed abuse controls must be verified in the real deployment.

## Verified in this repository

- TypeScript, ESLint, production build and the project test suites run without live AI requests.
- `npm audit --omit=dev` reports zero known production dependency vulnerabilities.
- Server-only AI secrets are not exposed through `NEXT_PUBLIC_` variables.
- Retired unauthenticated database endpoints return 404 at the proxy boundary.
- API mutations have origin checks, request-size limits and bounded process-local request budgets.
- Receipt uploads accept only the supported image formats, at most five files and at most 6 MB per file.
- API responses are network-only in the service worker and use `Cache-Control: no-store`.
- Plus access is based on RevenueCat entitlements. The optional local password preview has been removed, and its legacy localStorage flag is retired at startup. Next Gen does not require a judge-access promo code; this is separate from the RevenueCat integration requirement.
- Native purchase entry points reject Test Store, missing and wrong-platform keys before calling the SDK. Mock-SDK integration tests cover launch, purchase, restore, listeners and paywall analytics; they do not replace physical-device testing.
- The iOS icon is packaged from the approved Sikurepi logo as a 1024px opaque PNG. Codemagic regenerates it before building the IPA.
- Community seed recipes have Japanese and English data. Published recipes missing the selected language are translated from the canonical stored recipe, validated for structure and numeric quantities, cached locally, and fall back to the original without hiding the recipe.
- The loading component no longer renders the unintended steam layer.

## Before a public store release

1. Apply and inspect `supabase/migrations/202609160001_community_recipes.sql` in the production project. Confirm every account-owned table has RLS enabled and test cross-account reads and writes with two real accounts.
2. Put a distributed quota/WAF in front of AI, OCR and anonymous community endpoints. The in-process limiter is defense in depth and resets when a serverless instance is replaced.
3. Decide whether anonymous community posting is acceptable. Device IDs prevent ordinary duplicate actions but are not authentication; a hostile client can replace them. Require Supabase Auth or a server-only publication credential before describing the community feature as abuse-resistant.
4. Run RevenueCat sandbox purchase, restore and cancellation tests on physical iOS and Android devices. For a Next Gen-only demo, use the dedicated `Sikurepi iOS Test Store Build` Codemagic workflow after setting `NEXT_PUBLIC_REVENUECAT_TEST_API_KEY` on Vercel. The code and build split are configured, but the resulting IPA still requires physical-device verification. Never enable Test Store keys in the Release IPA.
5. Run Japanese and English device tests for receipt camera permissions, offline/reconnect sync, recipe completion, community publication, account restore and accessibility text scaling.
6. Complete privacy disclosures for receipt images, recipe feedback, account sync and AI processing. Rotate any credential ever pasted into a chat or log, even if it was restricted.

## Accurate hackathon security wording

Use: “Sikurepi keeps AI credentials server-side, validates and size-limits uploads, retires legacy data endpoints at the request boundary, avoids caching private API responses, preserves recipe quantities during translation, and uses database RLS for account-owned data. Automated dependency audit currently reports zero known production vulnerabilities.”

Do not use: “unhackable”, “fully secure”, “formally audited”, or “production certified”.
