// Defense in depth only: process-local limits are NOT a distributed quota.
const RETIRED_API = /^\/api\/(?:debug(?:\/|$)|inventory(?:\/|$)|shopping(?:\/|$)|saved-recipes(?:\/|$)|stats$|recipes\/consume$)/;
const AI_API = /^\/api\/(?:recipes(?:\/|$)|ocr$|daily-pick$|classify-ingredient$|community-recipes\/[^/]+\/translate$)/;
const buckets = new Map<string, { count: number; until: number }>();

export function isAiApi(path: string): boolean { return AI_API.test(path); }

export function isRetiredApi(path: string): boolean {
  return RETIRED_API.test(path);
}

export function requestBodyLimit(path: string): number {
  return path === '/api/ocr' ? 8 * 1024 * 1024 : 192 * 1024;
}

export function consumeRequestBudget(path: string, client: string, now = Date.now()): boolean {
  for (const [key, entry] of buckets) if (entry.until <= now) buckets.delete(key);
  const ai = AI_API.test(path);
  const key = `${ai ? 'ai' : 'write'}:${client}`;
  const entry = buckets.get(key);
  if (!entry) {
    // Bound memory even when a proxy supplies a large number of unique addresses.
    if (buckets.size >= 10000) return false;
    buckets.set(key, { count: 1, until: now + 10 * 60 * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= (ai ? 30 : 120);
}

export function isAllowedOrigin(origin: string | null, requestOrigin: string): boolean {
  if (!origin) return true; // Native clients may not send Origin. This is not authentication.
  return origin === requestOrigin || origin === 'capacitor://localhost' || origin === 'http://localhost' || origin === 'https://localhost';
}

export async function bodyWithinLimit(stream: ReadableStream<Uint8Array> | null, limit: number): Promise<boolean> {
  if (!stream) return true;
  const reader = stream.getReader();
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) return true;
      size += next.value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => undefined);
        return false;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
