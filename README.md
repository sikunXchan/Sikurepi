# AI Cooking App (PWA)

レシートから食材を自動抽出し、在庫を管理・AIがレシピ提案や料理相談を行うアプリケーションです。

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
2. プロジェクトの「SQL Editor」を開き、このリポジトリの `supabase_schema.sql` の内容をコピーして実行します（`user_data`テーブルとRow Level Securityポリシーが作成されます）。
3. 「Authentication」>「Providers」で「Email」プロバイダーが有効になっていることを確認します。
4. **「Authentication」>「Email Templates」>「Magic Link」を開き、本文に`{{ .Token }}`を含めるよう編集します**（例: `確認コード: {{ .Token }}`）。これをしないと、メールにはリンクしか入らず、アプリ側で入力してもらう6桁のコードが届きません（デフォルトのテンプレートは`{{ .ConfirmationURL }}`のみでコードが含まれていません）。
   - ログイン方式に6桁の確認コード入力を採用しているのは、CapacitorのネイティブアプリではSafari側でリンクが開いてしまいアプリ本体のログイン状態に反映されない問題があるため（Universal Linksには有料のApple Developer Programが必要）。
5. 「Authentication」>「URL Configuration」の「Site URL」を、デプロイ先の本番URL（例: `https://your-app.vercel.app`）に変更しておきます（コード方式では必須ではありませんが、他のメール内リンクにも影響するため）。
6. プロジェクトの「Settings」>「API Keys」(または「Connect」ボタン)から `Project URL` と `anon public`（または`publishable`）キーを控えます。
7. Vercelの「Settings」>「Environment Variables」に以下を追加し、再デプロイします。
   - `NEXT_PUBLIC_SUPABASE_URL`: 控えた`Project URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 控えた`anon public`(`publishable`)キー

### 5. PWAアイコンの設定
あなたが提供した「犬のBBQ画像」ファイルを、`public/icon.png` (512x512推奨) として保存してコミットしてからプッシュしてください。PWAのアイコンとして反映されます。

### 6. RevenueCatのセットアップ（ネイティブアプリ課金）

週間献立の無料枠は毎週3回で、`premium` Entitlementが有効な利用者は回数制限なしになります。食事制限・アレルギーなどの安全機能は課金状態に関係なく利用できます。

1. RevenueCatでプロジェクトを作成し、Product catalogに商品を追加します。ストア契約前の動作確認にはRevenueCat Test Storeを利用できます。
2. `premium` という識別子のEntitlementを作り、商品を紐づけます。
3. Offeringを作成してPackageを追加し、Current Offeringに設定します。
4. Vercelの環境変数に公開SDKキーを設定して再デプロイします。
   - Test Store: `NEXT_PUBLIC_REVENUECAT_TEST_API_KEY`
   - iOS: `NEXT_PUBLIC_REVENUECAT_IOS_API_KEY`
   - Android: `NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY`
5. `npm run build` の後に `npx cap sync` を実行し、iOSまたはAndroidの実機で購入・復元を確認します。

公開SDKキーはクライアントに含まれる前提のキーです。RevenueCatのSecret APIキーは`NEXT_PUBLIC_`変数やリポジトリには絶対に保存しないでください。
