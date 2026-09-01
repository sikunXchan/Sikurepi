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

### 2. Vercelのセットアップ (データベース)
1. [Vercel](https://vercel.com/)のダッシュボードにログインし、「Add New...」>「Project」を選択。
2. 先ほどプッシュしたGitHubリポジトリをインポートし、デプロイを開始します。
3. デプロイ設定画面の「Storage」タブから「Vercel Postgres」を作成し、プロジェクトにリンクします。
   - これにより、`POSTGRES_URL`等の環境変数が自動的にVercelに設定されます。
4. Postgresの「Data」タブから「Query」画面を開き、このプロジェクトの `setup.sql` の内容をコピーして実行し、テーブル（`ingredients`）を作成します。

### 3. Vercelのセットアップ (環境変数)
1. プロジェクトの「Settings」>「Environment Variables」に移動します。
2. キーを `GEMINI_API_KEY` とし、値としてあなたの取得したGemini APIキーを入力して保存します。
3. 新しい環境変数を反映させるため、再度「Deployments」から「Redeploy」を実行します。

### 4. PWAアイコンの設定
あなたが提供した「犬のBBQ画像」ファイルを、`public/icon.png` (512x512推奨) として保存してコミットしてからプッシュしてください。PWAのアイコンとして反映されます。
