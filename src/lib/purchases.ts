import { Capacitor } from '@capacitor/core';
import { Purchases, ErrorCode, PurchasesError } from '@revenuecat/purchases-js';
import { getOrCreateClientUserId } from '@/lib/user';

// RevenueCatダッシュボード(Project settings > Web Billing)で発行されるAPIキー。
// StoreKit/Play Billingを経由しないWeb Billing(ブラウザ内課金)を使うことで、
// App Store Connect / Google Play Console / Xcodeが一切不要になる構成にしている。
// ネイティブアプリのStoreKit課金を使う場合は @revenuecat/purchases-capacitor に切り替えること。
const REVENUECAT_WEB_BILLING_API_KEY = 'rcb_XXXXXXXXXXXXXXXXXXXXXXXXXXX';

// RevenueCatダッシュボードで作成するEntitlement識別子。プレミアムプラン加入者に付与する想定。
export const PREMIUM_ENTITLEMENT_ID = 'premium';

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

function getPurchasesInstance(): Purchases {
  if (Purchases.isConfigured()) return Purchases.getSharedInstance();
  return Purchases.configure(REVENUECAT_WEB_BILLING_API_KEY, getOrCreateClientUserId());
}

export async function hasPremiumEntitlement(): Promise<boolean> {
  if (typeof window === 'undefined' || !isNativeApp()) return false;
  try {
    const customerInfo = await getPurchasesInstance().getCustomerInfo();
    return !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];
  } catch (e) {
    console.error('Failed to check premium entitlement:', e);
    return false;
  }
}

export async function purchasePremium(): Promise<{ success: boolean; error?: string }> {
  if (typeof window === 'undefined' || !isNativeApp()) {
    return { success: false, error: 'アプリ版でのみ購入できます' };
  }
  try {
    const purchases = getPurchasesInstance();
    const offerings = await purchases.getOfferings();
    const rcPackage = offerings.current?.availablePackages?.[0];
    if (!rcPackage) {
      return { success: false, error: '購入可能なプランが見つかりませんでした。RevenueCatダッシュボードでOfferingの設定を確認してください' };
    }
    const { customerInfo } = await purchases.purchase({ rcPackage });
    return { success: !!customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] };
  } catch (e) {
    if (e instanceof PurchasesError && e.errorCode === ErrorCode.UserCancelledError) {
      return { success: false };
    }
    const message = e instanceof Error ? e.message : '購入に失敗しました';
    return { success: false, error: message };
  }
}
