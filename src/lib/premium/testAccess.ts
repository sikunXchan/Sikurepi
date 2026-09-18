const PREMIUM_TEST_ACCESS_KEY = "sikurepi_premium_test_access_v1";
// Never enable on the public production deployment. Opt in only on a test build.
export const PREMIUM_TEST_ACCESS_ENABLED = process.env.NODE_ENV === 'development'
  || process.env.NEXT_PUBLIC_ENABLE_PREMIUM_TEST_ACCESS === 'true';
const PREMIUM_TEST_PASSWORD_SHA256 = "b1bca771e233b6c216af5c341d125edc468de6d78fcdac47b795758d189adeaa";

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// 端末上のPlus表示・制限解除を確認するためだけのローカルテスト導線。
// RevenueCatの購入状態やサーバー側の権限を変更するものではない。
export async function verifyPremiumTestPassword(password: string): Promise<boolean> {
  if (!PREMIUM_TEST_ACCESS_ENABLED) return false;
  if (typeof crypto === "undefined" || !crypto.subtle) return false;
  const normalized = password.normalize("NFKC");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return bytesToHex(new Uint8Array(digest)) === PREMIUM_TEST_PASSWORD_SHA256;
}

export function hasPremiumTestAccess(): boolean {
  if (!PREMIUM_TEST_ACCESS_ENABLED) return false;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PREMIUM_TEST_ACCESS_KEY) === "enabled";
  } catch {
    return false;
  }
}

export function setPremiumTestAccess(enabled: boolean): void {
  if (enabled && !PREMIUM_TEST_ACCESS_ENABLED) return;
  if (typeof window === "undefined") return;
  try {
    if (enabled) window.localStorage.setItem(PREMIUM_TEST_ACCESS_KEY, "enabled");
    else window.localStorage.removeItem(PREMIUM_TEST_ACCESS_KEY);
    window.dispatchEvent(new Event("premium-test-access-updated"));
  } catch {
    // ストレージが利用できない環境では、そのセッションのReact stateだけを使う。
  }
}
