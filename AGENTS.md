<!-- BEGIN:project-agent-rules -->
# Sikurepi — 開発者/AIエージェント向けガイド

レシートOCRで食材を自動抽出し、在庫を管理しながらAIがレシピ提案・週間献立・料理相談を行うPWA。

## 技術スタック（実装の実態）

- **Next.js 16**（App Router、`src/app` 配下）+ React 19。TypeScript。
- `package.json` の `dev`/`build` スクリプトは明示的に `--webpack` を指定している。Next 16はデフォルトでTurbopackを使うため、**このリポジトリはTurbopackではなくWebpackを使う設定**になっている点に注意（`next dev` / `next build` を素で叩くとデフォルト挙動と変わる）。
- `next.config.mjs` で `typescript.ignoreBuildErrors: true` を設定済み。**`next build` は型エラーで失敗しない**。型チェックはビルドに依存せず `npx tsc --noEmit` 等で別途行うこと。
- PWA化には `@serwist/next`（`src/app/sw.ts` → `public/sw.js` を生成）を使用。
- モバイルアプリ化は **Capacitor**（`android/`, `ios/`, `capacitor.config.ts`）。Webビューを両OSにパッケージしているだけで、独自のネイティブフレームワークではない。
- AI呼び出しは **Google Gemini**（`@google/genai`、`src/lib/ai.ts` および `src/app/api/**` のサーバー側ルート）。APIキー等が絡む処理は必ずAPI Route（サーバー）側で行い、クライアントに漏らさない。
- 決済は RevenueCat（`@revenuecat/purchases-*`）。

## データの持ち方（重要）

- **アプリの本体データ（在庫・献立・買い物リスト・自炊記録・保存レシピ等）は端末の `localStorage` が正。** 実装は `src/lib/storage.ts` に集約されている。新しいデータ種別を追加する場合もまずここに型とCRUDを足す。
- **Supabase**（`src/lib/supabase.ts`, `src/lib/auth/AuthContext.tsx`, `src/components/SyncManager.tsx`）はログイン時のみ有効になる**任意のクラウド同期/バックアップ層**。`user_data` テーブルへ `storage.ts` のスナップショットをまとめてupsert/pullするだけで、個別テーブル設計ではない。未ログイン（ゲスト利用）でもアプリは全機能がlocalStorageのみで動く。
- `@vercel/postgres`（`src/lib/db.ts`, `setup.sql`, `src/app/api/debug/migrate/route.ts`）は初期構想の名残で、通常のユーザーフローからは呼ばれていないレガシーコード。新機能でこちらを使う必要は基本的にない。
- 食材アイコンの解決は `src/lib/ingredientIcons.ts`（+ `src/components/IngredientIcon.tsx`）。単純な部分文字列一致は「米」「米油」「米酢」のように誤爆するため、正規化・分類ロジックを変更する際は既存の判定順序（完全一致→カテゴリ別キーワード→フォールバック等）を壊さないよう既存実装を必ず確認すること。

## ディレクトリ構成の実態

- `src/app/<page>/page.tsx` + 同ディレクトリの `<Page>.module.css`：ページごとにCSS Modulesでスタイルを閉じる。グローバルCSSは `src/app/globals.css` のみに留める。
- `src/app/api/**/route.ts`：サーバー専用処理（Gemini呼び出し、OCR、レシートAPI等）。APIキーを使う処理はここに置く。
- `src/lib/**`：ドメインロジック（storage, ai, ingredientIcons, climate, purchases, i18n等）。UIを持たない。
- `src/components/**`：再利用可能なUIコンポーネント。対応する `.module.css` を同ディレクトリに置く。

## 開発コマンド

```bash
npm install
npm run dev     # next dev --webpack
npm run build   # next build --webpack
npm run lint     # eslint
```

型チェックは `npm run build` では保証されない（上記の `ignoreBuildErrors` 参照）。挙動を変える変更をしたら `npx tsc --noEmit` を実行すること。

## 多言語対応

UI文言は `src/lib/i18n` を経由する。日本語決め打ちの文字列を新規に増やさず、既存の仕組みに合わせて英語/日本語両対応にする。
<!-- END:project-agent-rules -->
