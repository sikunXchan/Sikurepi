import { Capacitor } from "@capacitor/core";
import {
  ENTITLEMENT_VERIFICATION_MODE,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  Purchases,
  VERIFICATION_RESULT,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
} from "@revenuecat/purchases-capacitor";
import { getOrCreateClientUserId } from "@/lib/user";
import { selectRevenueCatApiKey } from "@/lib/premium/revenueCatConfig";

export const PREMIUM_ENTITLEMENT_ID = "premium";
const CUSTOM_PAYWALL_ID = "sikurepi-plus-v1";

export type PremiumAvailability = "ready" | "web" | "unconfigured" | "error";

export type PremiumPlan = {
  id: string;
  packageType: PACKAGE_TYPE;
  productId: string;
  title: string;
  description: string;
  price: number;
  priceString: string;
  pricePerMonthString: string | null;
  subscriptionPeriod: string | null;
};

export type PremiumSnapshot = {
  availability: PremiumAvailability;
  isPremium: boolean;
  offeringId: string | null;
  plans: PremiumPlan[];
};

export type PurchaseActionResult =
  | { status: "success"; isPremium: true }
  | { status: "cancelled"; isPremium: false }
  | { status: "pending"; isPremium: false }
  | { status: "not-entitled"; isPremium: false }
  | { status: "unavailable"; isPremium: false }
  | { status: "error"; isPremium: false; message?: string };

let configurationPromise: Promise<void> | null = null;
let cachedOffering: PurchasesOffering | null = null;

export function isNativeApp(): boolean {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

function getRevenueCatApiKey(): string | null {
  return selectRevenueCatApiKey(Capacitor.getPlatform(), {
    ios: process.env.NEXT_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    test: process.env.NEXT_PUBLIC_REVENUECAT_TEST_API_KEY,
  }, Capacitor.DEBUG === true);
}

function isTestStoreBuild(): boolean {
  return Capacitor.DEBUG === true && getRevenueCatApiKey()?.startsWith("test_") === true;
}

export function isRevenueCatTestStoreBuild(): boolean {
  return isNativeApp() && isTestStoreBuild();
}

export function hasRevenueCatConfiguration(): boolean {
  return isNativeApp() && getRevenueCatApiKey() !== null;
}

async function ensurePurchasesConfigured(): Promise<void> {
  if (!isNativeApp()) throw new Error("RevenueCat is only available in the native app");
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) throw new Error("RevenueCat public API key is not configured");

  if (!configurationPromise) {
    configurationPromise = (async () => {
      const { isConfigured } = await Purchases.isConfigured();
      if (isConfigured) return;
      await Purchases.configure({
        apiKey,
        appUserID: getOrCreateClientUserId(),
        entitlementVerificationMode: ENTITLEMENT_VERIFICATION_MODE.INFORMATIONAL,
        diagnosticsEnabled: process.env.NODE_ENV !== "production",
      });
    })().catch((error) => {
      configurationPromise = null;
      throw error;
    });
  }

  await configurationPromise;
}

function isPremiumCustomer(customerInfo: CustomerInfo, purchasedProductIdentifier?: string): boolean {
  // 本番では契約した entitlement ID を厳密に見る。Test StoreのDebug IPAでは、
  // RevenueCatが自動作成した別名のentitlementでも購入シミュレーション直後に
  // Plus表示を確認できるよう、検証済みのactive entitlementを1件だけ許容する。
  const activeEntitlements = customerInfo.entitlements.active;
  const entitlement = activeEntitlements[PREMIUM_ENTITLEMENT_ID]
    ?? (isTestStoreBuild() ? Object.values(activeEntitlements).find((entry) => entry.isActive) : undefined);
  // 改ざんが検知されたCustomerInfoでは有料機能を解放しない。
  const verificationFailed = entitlement?.verification === VERIFICATION_RESULT.FAILED
    || customerInfo.entitlements.verification === VERIFICATION_RESULT.FAILED;
  if (verificationFailed) return false;
  if (entitlement?.isActive) return true;

  // Test Storeは商品をEntitlementへ紐づけ忘れていても購入自体は成功する。
  // 動画・審査用Debug IPAに限り、SDKが返した購入商品またはCustomerInfo内の
  // テスト購入履歴をPlusとして扱う。本番キーではこのフォールバックを使わない。
  return isTestStoreBuild() && Boolean(
    purchasedProductIdentifier
    || customerInfo.activeSubscriptions?.length
    || customerInfo.allPurchasedProductIdentifiers?.length
    || customerInfo.nonSubscriptionTransactions?.length,
  );
}

function planRank(aPackage: PurchasesPackage): number {
  switch (aPackage.packageType) {
    case PACKAGE_TYPE.ANNUAL:
      return 0;
    case PACKAGE_TYPE.MONTHLY:
      return 1;
    case PACKAGE_TYPE.LIFETIME:
      return 2;
    default:
      return 3;
  }
}

function toPremiumPlan(aPackage: PurchasesPackage): PremiumPlan {
  return {
    id: aPackage.identifier,
    packageType: aPackage.packageType,
    productId: aPackage.product.identifier,
    title: aPackage.product.title,
    description: aPackage.product.description,
    price: aPackage.product.price,
    priceString: aPackage.product.priceString,
    pricePerMonthString: aPackage.product.pricePerMonthString,
    subscriptionPeriod: aPackage.product.subscriptionPeriod,
  };
}

async function loadOffering(): Promise<PurchasesOffering | null> {
  await ensurePurchasesConfigured();
  const offerings = await Purchases.getOfferings();
  // current指定を忘れていても、Test Store/開発中に作成済みのOfferingが1つなら
  // 購入導線を止めない。本番でも選ぶのはRevenueCatから返ったOfferingだけ。
  cachedOffering = offerings.current ?? Object.values(offerings.all || {})[0] ?? null;
  return cachedOffering;
}

export async function getPremiumSnapshot(): Promise<PremiumSnapshot> {
  if (!isNativeApp()) {
    return { availability: "web", isPremium: false, offeringId: null, plans: [] };
  }
  if (!getRevenueCatApiKey()) {
    return { availability: "unconfigured", isPremium: false, offeringId: null, plans: [] };
  }

  try {
    await ensurePurchasesConfigured();
    const [{ customerInfo }, offering] = await Promise.all([
      Purchases.getCustomerInfo(),
      loadOffering(),
    ]);
    const packages = [...(offering?.availablePackages ?? [])].sort(
      (a, b) => planRank(a) - planRank(b),
    );
    return {
      availability: "ready",
      isPremium: isPremiumCustomer(customerInfo),
      offeringId: offering?.identifier ?? null,
      plans: packages.map(toPremiumPlan),
    };
  } catch (error) {
    console.error("Failed to load RevenueCat state", error);
    return { availability: "error", isPremium: false, offeringId: null, plans: [] };
  }
}

function findPackage(offering: PurchasesOffering, packageIdentifier?: string): PurchasesPackage | null {
  if (packageIdentifier) {
    const selected = offering.availablePackages.find(
      (aPackage) => aPackage.identifier === packageIdentifier,
    );
    if (selected) return selected;
  }
  return [...offering.availablePackages].sort((a, b) => planRank(a) - planRank(b))[0] ?? null;
}

function parsePurchaseError(error: unknown): PurchaseActionResult {
  const purchasesError = error as Partial<PurchasesError>;
  if (
    purchasesError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
    || purchasesError.userCancelled === true
  ) {
    return { status: "cancelled", isPremium: false };
  }
  if (purchasesError.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
    return { status: "pending", isPremium: false };
  }
  const message = error instanceof Error ? error.message : purchasesError.message;
  return { status: "error", isPremium: false, message };
}

export async function purchasePremium(packageIdentifier?: string): Promise<PurchaseActionResult> {
  if (!hasRevenueCatConfiguration()) return { status: "unavailable", isPremium: false };
  try {
    const offering = cachedOffering ?? await loadOffering();
    if (!offering) return { status: "unavailable", isPremium: false };
    const aPackage = findPackage(offering, packageIdentifier);
    if (!aPackage) return { status: "unavailable", isPremium: false };

    const { customerInfo, productIdentifier } = await Purchases.purchasePackage({ aPackage });
    return isPremiumCustomer(customerInfo, productIdentifier)
      ? { status: "success", isPremium: true }
      : { status: "not-entitled", isPremium: false };
  } catch (error) {
    return parsePurchaseError(error);
  }
}

export async function restorePremiumPurchases(): Promise<PurchaseActionResult> {
  if (!hasRevenueCatConfiguration()) return { status: "unavailable", isPremium: false };
  try {
    await ensurePurchasesConfigured();
    const { customerInfo } = await Purchases.restorePurchases();
    return isPremiumCustomer(customerInfo)
      ? { status: "success", isPremium: true }
      : { status: "not-entitled", isPremium: false };
  } catch (error) {
    return parsePurchaseError(error);
  }
}

export async function subscribeToPremiumStatus(
  listener: (isPremium: boolean) => void,
): Promise<() => void> {
  if (!hasRevenueCatConfiguration()) return () => undefined;
  try {
    await ensurePurchasesConfigured();
    const listenerId = await Purchases.addCustomerInfoUpdateListener((customerInfo) => {
      listener(isPremiumCustomer(customerInfo));
    });
    return () => {
      void Purchases.removeCustomerInfoUpdateListener({ listenerToRemove: listenerId });
    };
  } catch (error) {
    console.error("Failed to subscribe to RevenueCat updates", error);
    return () => undefined;
  }
}

export async function trackPremiumPaywallImpression(): Promise<void> {
  if (!hasRevenueCatConfiguration()) return;
  try {
    const offering = cachedOffering ?? await loadOffering();
    await Purchases.trackCustomPaywallImpression({
      paywallId: CUSTOM_PAYWALL_ID,
      offering,
    });
  } catch (error) {
    // 分析イベントの失敗で購入導線そのものを止めない。
    console.warn("Failed to track paywall impression", error);
  }
}
