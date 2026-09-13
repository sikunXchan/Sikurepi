function canonicalizeCacheValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeCacheValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalizeCacheValue(entry)])
    );
  }
  return value;
}

// 完全な入力条件をキーにする。短いハッシュだけにすると極めて低確率でも衝突し、
// 別の食事制限のレシピを返す可能性があるため、安全性を優先して正規化JSONを使う。
export function createRecipeGenerationRequestKey(payload: unknown): string {
  return `recipe-cache-v2:${JSON.stringify(canonicalizeCacheValue(payload))}`;
}
