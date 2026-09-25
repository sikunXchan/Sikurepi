# Sikurepi

Sikurepi is an AI-powered cooking app for everyday home cooking. It connects
pantry management and recipe generation with weekly meal planning, shopping,
cooking assistance, and cooking records. The app supports Japanese and English.

[View the Shipaton project](https://devpost.com/software/sikurepi)
[Open the web preview](https://sikurepi.vercel.app)

![Your pantry becomes tonight's dinner](public/devpost/gallery/05-pantry-to-dinner.png)

## Why Sikurepi exists

I want to make it easier to decide what to cook and use ingredients before they
are forgotten. My goal is to help people around the world enjoy cooking at home
more often, improving their health while reducing food waste.

I built Sikurepi to follow what happens before and after a recipe is chosen,
from buying ingredients through cooking and recording the result. That record
then helps shape the next suggestion.

## What it does

- **Pantry-aware AI recipes** — generate a single dish or a complete set meal
  from available ingredients, preferences, and a free-form request.
- **Weekly meal planning** — create a balanced seven-day plan, regenerate one
  meal at a time, and add every missing ingredient to the shopping list.
- **Guided cooking mode** — keep ingredients and steps visible, use timers, and
  ask the AI chef short cooking questions without leaving the recipe.
- **Receipt scanning** — extract likely food items from a receipt, review the
  result, and add only confirmed items to the pantry.
- **Adaptive recipes** — change serving counts, preserve ingredient-specific
  units, and add missing items directly to the shopping list.
- **Dietary clarity** — show visible badges for relevant allergies, dietary
  restrictions, and religious considerations.
- **History and community** — revisit recent and saved recipes, track ingredient
  coverage, and share cooked recipes. Personal cooking feedback informs future
  suggestions; free-text notes are not included in public recipe queries.
- **Food-rescue collection** — discover more than 380 original ingredient and
  dish illustrations while recording ingredients that were used before waste.
- **Progression** — cooking activity advances a ten-rank chef journey designed
  to make home cooking feel rewarding.
- **Japanese and English** — the interface, generated content, and community
  experience support both languages.
- **Learn as you go** — explore a first recipe before setting up the pantry,
  use contextual guides, and revisit instructions whenever needed.

## Monetization with RevenueCat

Store purchases for Sikurepi Plus are managed through RevenueCat. The free plan
includes the core cooking experience and the same dietary checks as Plus.
Plus expands generation limits and access to history and Community Recipes,
along with customization options for people who use Sikurepi regularly.

- A custom paywall loads the current RevenueCat Offering and packages.
- Purchases use RevenueCat through its Capacitor SDK. For store-backed
  purchases, Plus access is determined by the active `premium` entitlement in
  `CustomerInfo`. A failed entitlement-verification result does not grant access.
- The Restore Purchases action calls the RevenueCat SDK's restore method.
- Entitlement updates refresh Plus access.
- Custom paywall impressions are reported to RevenueCat.
- Free limits and Plus access are enforced by shared domain logic.
- A dedicated Debug build supports RevenueCat Test Store purchases for the
  Next Gen judging path, while Release builds reject Test Store keys and use
  platform-specific keys only.

A reviewer password is provided privately in the Devpost submission so reviewers
can try Plus features without completing a store purchase. This review access
is separate from the RevenueCat purchase flow.

Purchase-to-Plus activation has been verified on an iOS device using RevenueCat
Test Store.

## How I validate AI-generated recipes

Safety-sensitive preferences are not left to prompt wording alone. Sikurepi
combines profile-aware generation with deterministic validation of ingredients
and recipe output. A detected conflict is rejected instead of being presented
as safe. The same profile is used for substitutions and cooking assistance.

Sikurepi cannot verify product labels, manufacturing cross-contact, religious
certification, or the user's cooking environment. For serious allergies and
religious requirements, the app asks users to perform a final check themselves.

## Privacy and security

- Gemini credentials remain server-side and are never exposed through a
  `NEXT_PUBLIC_` variable.
- Receipt uploads are restricted by file type, file count, and payload size.
- Mutating API routes validate request origin and apply bounded request budgets.
- Private API responses use `Cache-Control: no-store` and are excluded from the
  service-worker cache.
- Supabase Row Level Security protects account-owned synchronized data.
- RevenueCat secret keys are never shipped to the client; only public SDK keys
  are used by the Capacitor build.
- Store entitlement-verification failures do not grant purchased Plus access.
- Production dependency checks can be reproduced with `npm audit --omit=dev`.

## Design decisions

To build Sikurepi, I studied UI/UX design, human-computer interaction (HCI), and
behavioral economics, then applied what I learned to the app. The introduction
is short, with guides available in individual tabs when people need them.
Cooking ranks and the ingredient collection let people see their progress and
get a small sense of achievement from cooking another meal or using an
ingredient that might otherwise go to waste.

## How it is built

Sikurepi is built as a web app, with Capacitor used to package it for iOS and
Android. I tested the iOS build by installing it directly on an iPhone.

```text
PWA / iOS device build (Capacitor)
          |
          v
Next.js + React interface
    |          |          |
    v          v          v
Gemini AI   Supabase   RevenueCat
recipes     sync/RLS   purchases
    |
    v
Validated recipe, pantry, history, and meal-plan domain logic
```

Core technologies include Next.js 16, React 19, TypeScript, Capacitor 8,
RevenueCat Purchases, Google Gemini, Supabase, Vercel, Serwist, and Framer
Motion.

## Run the project

### Requirements

- Node.js 24
- npm
- A Gemini API key for live recipe and receipt generation
- Optional Supabase and RevenueCat projects for account sync and iOS purchase
  testing

### Web development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Add `GEMINI_API_KEY` to `.env.local`. The optional public configuration values
are documented in [`.env.example`](.env.example). Never commit secret API keys.

### iOS build for device testing

The Capacitor shell loads the deployed Sikurepi web application so server-side
AI routes remain available:

```bash
npm ci
npx cap sync ios
```

Open `ios/App/App.xcodeproj` in Xcode. For RevenueCat Test Store testing, use a
Debug build and a Test Store public key. Configure Test Store products,
attach them to an Offering, and attach the products to the `premium`
entitlement. Production builds must use the Apple-specific public SDK key and
must never contain a `test_` key.

RevenueCat Test Store simulates purchases without charging real money. It does
not support `restorePurchases` or `syncPurchases`. To test restoration of Apple
purchases, use Apple Sandbox with an Apple-specific public SDK key. See the
[RevenueCat Test Store restore guidance](https://community.revenuecat.com/sdks-51/are-syncpurchases-and-restorepurchases-sdk-calls-meant-to-work-on-the-revenuecat-test-store-7779?sort=oldestFirst).

## Verification

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run test:purchases
npm run test:paywall
npm run test:release-safety
npm run test:dietary
npm run test:premium
npm run test:community
npm run test:recipe-quality
```

Additional focused regression commands are available in [`package.json`](package.json).

## Shipaton judging path

Sikurepi is submitted for the **RevenueCat Shipaton 2026 Next Gen Award**. Under
the official Next Gen route, evaluation is based on the public source repository
and demonstration video instead of an App Store listing. No public IPA download
is required. The repository contains the source, assets, build configuration,
and verification scripts for reviewing the app and its RevenueCat integration.

## License

The source code and software documentation are available under the
[MIT License](LICENSE). The Sikurepi name, logo, chef-bear mascot, app icons,
original illustrations, and promotional artwork remain reserved; see the
[Sikurepi Asset License Notice](ASSETS_LICENSE.md).
