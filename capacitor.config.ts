import type { CapacitorConfig } from '@capacitor/cli';

// AI生成・レシートOCRなどはNext.jsのAPIルート（サーバー）に依存しているため、
// アプリ本体を静的ビルドで同梱するのではなく、デプロイ済みの本番URLをネイティブの
// WebViewで読み込む「remote URL」構成にしている。
// デプロイ後、下記のURLを実際のVercel本番URL（またはカスタムドメイン）に差し替えること。
const PRODUCTION_URL = 'https://lily-cooking.vercel.app';

const config: CapacitorConfig = {
  appId: 'com.lilycooking.app',
  appName: 'Sikurepi',
  webDir: 'www',
  server: {
    url: PRODUCTION_URL,
    cleartext: false,
  },
};

export default config;
