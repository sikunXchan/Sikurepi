type StoreKeys = { ios?: string; android?: string; test?: string };

/** Test Store is allowed only when the native host explicitly reports a Debug build.
 * A test_ key can terminate a Release app inside the native SDK before JavaScript
 * can catch the error, so Release always falls back to platform keys only.
 */
export function selectRevenueCatApiKey(
  platform: string,
  keys: StoreKeys,
  allowTestStore = false,
): string | null {
  const testKey = keys.test?.trim();
  if (allowTestStore && testKey?.startsWith("test_") && testKey.length > "test_".length
    && !testKey.includes("XXXXX") && !/\s/.test(testKey)) return testKey;

  const key = (platform === "ios" ? keys.ios : platform === "android" ? keys.android : "")?.trim();
  const prefix = platform === "ios" ? "appl_" : platform === "android" ? "goog_" : null;
  if (!key || !prefix || !key.startsWith(prefix) || key.length <= prefix.length
    || key.includes("XXXXX") || /\s/.test(key)) return null;
  return key;
}
