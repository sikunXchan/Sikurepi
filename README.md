# AI Cooking App (PWA)

レシートから食材を自動抽出し、在庫を管理・AIがレシピ提案や料理相談を行うアプリケーションです。

## はじめての利用と調理サポート

初回は「今日の一品」への短い案内を表示し、各タブの「使い方」とマイページのガイド一覧から必要な説明だけ読み返せます。案内の既読状態は端末に保存し、ログイン時のバックアップにも含まれます。未登録の在庫・買い物リストへサンプル食材は挿入しません（保存済みのデータは維持）。

クッキングモードの「困った」では、材料不足・味の濃さ・水っぽさ・焦げ・加熱不足・用語を確認できます。限定した代用候補を登録済みの食事制限と照合し、レシピや在庫は自動変更しません。このヘルプに追加のAI通信はありません。

生成の再試行はアプリ側で一元管理し、SDK内部の重複再試行を止めています。料理の安全・品質検証は維持し、任意の豆知識の形式不備だけでは料理全体を再生成しません。レシピは165秒、献立は285秒のサーバー予算内で処理し、タイムアウト時は回数を消費せず再試行を案内します。`Server-Timing` に全試行のAI待ち時間と合計時間を返し、献立も計測できます。

回帰テスト: `npm run test:cooking-help` / `npm run test:ai-transport`。実通信の小規模計測は開発サーバーを起動して `node scripts/smoke-generation.mjs --live`（レシピ1件・昼食1枠の2リクエスト。Geminiの利用料金が発生します）。

## デプロイ手順

### 1. GitHubへのプッシュ
1. このプロジェクトのディレクトリで以下のコマンドを実行し、GitHubリポジトリにプッシュします。
   ```bash
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <あなたのリポジトリURL>
   git push -u origin main
   ```

### 2. Vercelのセットアップ (データベース・現在は未使用)
> ⚠️ **注記**: 現在アプリのデータは端末のlocalStorageのみで管理しており、以下のPostgres/`setup.sql`はどの画面からも呼び出されない未使用のコードです。将来的に整理・削除するか、アカウント連携(下記5番)の実装に置き換える想定です。

1. [Vercel](https://vercel.com/)のダッシュボードにログインし、「Add New...」>「Project」を選択。
2. 先ほどプッシュしたGitHubリポジトリをインポートし、デプロイを開始します。
3. デプロイ設定画面の「Storage」タブから「Vercel Postgres」を作成し、プロジェクトにリンクします。
   - これにより、`POSTGRES_URL`等の環境変数が自動的にVercelに設定されます。
4. Postgresの「Data」タブから「Query」画面を開き、このプロジェクトの `setup.sql` の内容をコピーして実行し、テーブル（`ingredients`）を作成します。

### 3. Vercelのセットアップ (環境変数)
1. プロジェクトの「Settings」>「Environment Variables」に移動します。
2. キーを `GEMINI_API_KEY` とし、値としてあなたの取得したGemini APIキーを入力して保存します。
3. 新しい環境変数を反映させるため、再度「Deployments」から「Redeploy」を実行します。

### 4. Supabaseのセットアップ (アカウント連携・任意)
ログインして複数端末でデータを同期する機能はSupabaseを使っています。設定しなくてもアプリは今まで通りこの端末だけのゲスト利用として動作します。

1. [Supabase](https://supabase.com/)でプロジェクトを新規作成します。
2. プロジェクトの「SQL Editor」を開き、このリポジトリの `supabase_schema.sql` の内容をコピーして実行します（アカウント同期・共有レシピ・評価用のテーブル、権限、DB関数が作成されます）。
3. 「Authentication」>「Providers」で「Email」プロバイダーが有効になっていることを確認します。
4. **「Authentication」>「Email Templates」>「Magic Link」を開き、本文に`{{ .Token }}`を含めるよう編集します**（例: `確認コード: {{ .Token }}`）。これをしないと、メールにはリンクしか入らず、アプリ側で入力してもらう6桁のコードが届きません（デフォルトのテンプレートは`{{ .ConfirmationURL }}`のみでコードが含まれていません）。
   - ログイン方式に6桁の確認コード入力を採用しているのは、CapacitorのネイティブアプリではSafari側でリンクが開いてしまいアプリ本体のログイン状態に反映されない問題があるため（Universal Linksには有料のApple Developer Programが必要）。
5. 「Authentication」>「URL Configuration」の「Site URL」を、デプロイ先の本番URL（例: `https://your-app.vercel.app`）に変更しておきます（コード方式では必須ではありませんが、他のメール内リンクにも影響するため）。
6. プロジェクトの「Settings」>「API Keys」(または「Connect」ボタン)から `Project URL` と `anon public`（または`publishable`）キーを控えます。
7. Vercelの「Settings」>「Environment Variables」に以下を追加し、再デプロイします。
   - `NEXT_PUBLIC_SUPABASE_URL`: 控えた`Project URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 控えた`anon public`(`publishable`)キー

#### 「みんなのレシピ」が反映されない既存環境

GitHubへのpushやVercelの再デプロイだけでは、Supabaseのテーブルは作成されません。内蔵サンプルが一覧に出ていても、共有機能の接続確認にはなりません。

1. Vercelの `NEXT_PUBLIC_SUPABASE_URL` と同じSupabaseプロジェクトの「SQL Editor」で、新しいクエリを開きます。
2. `supabase/migrations/202609160001_community_recipes.sql` の全体を貼り付け、実行します。既存データを削除せず、再実行できます。
3. この変更を含むアプリをデプロイした後、アプリを開き直します。送信待ちの料理と、このバージョン以降に送信待ちへ保存された評価が再送されます。古いバージョンで失敗した評価は、対象料理で評価を押し直してください。

このSQLは共有用の3テーブルと評価保存関数を追加します。評価の自由記述を公開SELECTせず、DB関数が評価変更と順位集計を行います。成功通知はDBから保存結果を受け取った場合だけ表示します。

`/api/community-recipes` の `sharingAvailable: true` が共有一覧の接続確認です。`COMMUNITY_SCHEMA_MISSING` はSQL未適用、`COMMUNITY_NOT_CONFIGURED` は環境変数未設定、`COMMUNITY_ACCESS_DENIED` は権限設定の不備を示します。評価送信では `accepted: true`・`rankingUpdated: true`・`recipeId` を確認してください。共有していない料理の低評価は端末内だけに残ります。

再送処理の回帰テスト: `npm run test:community`

### 5. PWAアイコンの設定
あなたが提供した「犬のBBQ画像」ファイルを、`public/icon.png` (512x512推奨) として保存してコミットしてからプッシュしてください。PWAのアイコンとして反映されます。

### 6. RevenueCatのセットアップ（ネイティブアプリ課金）

無料版は、単品レシピを1日3回（定食は3枠を使って1日1回）、週間献立を週1回、画像解析を1日1回まで利用できます。履歴は最新3件、みんなのレシピは上位1件を表示します。`premium` Entitlementが有効な利用者は生成回数・履歴・みんなのレシピが無制限になり、料理のコツ、限定トレー、自動共有OFFを利用できます。食事制限・アレルギーなどの安全機能は課金状態に関係なく利用できます。

1. RevenueCatでプロジェクトを作成し、App Store / Google Playのアプリと商品を登録します。通常のCodemagic IPAはRelease構成のため、Test Storeの `test_` キーは使用できません（SDKがアプリを終了します）。PlusはRevenueCatのEntitlementから判定し、端末内パスワードによる解放はありません。
2. `premium` という識別子のEntitlementを作り、商品を紐づけます。
3. Offeringを作成してPackageを追加し、Current Offeringに設定します。
4. Vercelの環境変数に公開SDKキーを設定して再デプロイします。
   - iOS: `NEXT_PUBLIC_REVENUECAT_IOS_API_KEY`（`appl_` で始まる公開SDKキー）
   - Android: `NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY`（`goog_` で始まる公開SDKキー）
   - 動画・審査用Debug IPA: `NEXT_PUBLIC_REVENUECAT_TEST_API_KEY`（`test_` で始まるTest Store公開キー）
   - ストアのSandbox購入も各プラットフォーム用キーを使います。キー未設定・種類不一致の場合はSDKを起動せず、無料プランでアプリを継続利用できます。
5. `npm run build` の後に `npx cap sync` を実行し、iOSまたはAndroidの実機で購入・復元を確認します。

Next Gen向けに実購入なしでRevenueCatの購入完了まで撮影する場合は、Vercelへ
`NEXT_PUBLIC_REVENUECAT_TEST_API_KEY`を設定して再デプロイし、Codemagicの
`Sikurepi iOS Test Store Build`を実行します。このワークフローだけがDebug構成で
Test Storeを許可します。通常の`iOS Unsigned Build (for Sideloadly)`はReleaseのまま、
`test_`キーを受け付けません。

Test Store Buildでは、Plus画面でプランを選び購入ボタンを押し、RevenueCatの購入モーダルで`Success`を選ぶとPlusになります。プランが表示されない場合は、RevenueCatでTest Store商品を作成し、OfferingのPackageへ紐づけてください。

動画撮影用の英語アカウントデータは、既存の「バックアップを復元」から`public/demo/sikurepi-video-account.en.json`を読み込みます。専用の撮影データUIは設けていません。このバックアップ内のレシピは`npm run generate:video-backup`でSikurepiの`/api/recipes`を通して生成されます。

公開SDKキーはクライアントに含まれる前提のキーです。RevenueCatのSecret APIキーは`NEXT_PUBLIC_`変数やリポジトリには絶対に保存しないでください。

iOSアイコンは `public/icon.png` を元に `npm run prepare:ios-icon` で作成します。Codemagicもこの処理を実行し、1024px・不透明のアイコンをアセットカタログへ組み込みます。アイコン変更にはIPAの再ビルドとインストールが必要です。
