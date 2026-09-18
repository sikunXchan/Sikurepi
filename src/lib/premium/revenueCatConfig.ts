type StoreKeys = { ios?: string; android?: string };

/** The remote web bundle cannot determine whether its native host is Debug or Release.
 * Only platform keys are safe for both. A test_ key can terminate a Release app
 * inside the native SDK before JavaScript can catch the error.
 */
export function selectRevenueCatApiKey(platform: string, keys: StoreKeys): string | null {
  const key = (platform === "ios" ? keys.ios : platform === "android" ? keys.android : "")?.trim();
  const prefix = platform === "ios" ? "appl_" : platform === "android" ? "goog_" : null;
  if (!key || !prefix || !key.startsWith(prefix) || key.length <= prefix.length
    || key.includes("XXXXX") || /\s/.test(key)) return null;
  return key;
}
