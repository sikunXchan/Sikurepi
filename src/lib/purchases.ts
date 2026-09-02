import { Capacitor } from '@capacitor/core';
import { Purchases, type PurchasesError } from '@revenuecat/purchases-capacitor';

// RevenueCatダッシュボード(Project settings > API keys)で発行されるプラットフォーム別のAPIキー。
// ネイティブ配布前に実際の値へ差し替えること。Web(通常のブラウザ)ではこのモジュールは一切動作しない。
const REVENUECAT_API_KEY_IOS = 'appl_XXXXXXXXXXXXXXXXXXXXXXXXXXX';
const REVENUECAT_API_KEY_ANDROID = 'goog_XXXXXXXXXXXXXXXXXXXXXXXXXXX';

// RevenueCatダッシュボードで作成するEntitlement識別子。プレミアムプラン加入者に付与する想定。
export const PREMIUM_ENTITLEMENT_ID = 'premium';

let configured = false;

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export async function initPurchases(): Promise<void> {
  if (!isNativeApp() || configured) return;
  const apiKey = Capacitor.getPlatform() === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  await Purchases.configure({ apiKey });
  configured = true;
}

export async function hasPremiumEntitlement(): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    await initPurchases();
    const { customerInfo } = await Purchases.getCustomerInfo();
    return !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
  } catch (e) {
    console.error('Failed to check premium entitlement:', e);
    return false;
  }
}

export async function purchasePremium(): Promise<{ success: boolean; error?: string }> {
  if (!isNativeApp()) {
    return { success: false, error: 'アプリ版でのみ購入できます' };
  }
  try {
    await initPurchases();
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages?.[0];
    if (!pkg) {
      return { success: false, error: '購入可能なプランが見つかりませんでした。RevenueCatダッシュボードでOfferingの設定を確認してください' };
    }
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return { success: !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] };
  } catch (e) {
    const err = e as Partial<PurchasesError>;
    if (err?.userCancelled) return { success: false };
    return { success: false, error: err?.message || '購入に失敗しました' };
  }
}
