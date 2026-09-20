export const FILMING_ACCESS_STORAGE_KEY = 'sikurepi_filming_plus_v1';

// This is a convenience gate for a Debug/Test Store build, not an account or
// production authentication secret. Keep the clear text out of the bundle so it
// is not accidentally surfaced by a simple string search in filming builds.
function hashPassword(value: string): number {
  let hash = 2166136261;
  for (const character of value.normalize('NFKC')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const FILMING_PASSWORD_HASH = 671327899;

export function verifyFilmingPassword(value: string): boolean {
  return hashPassword(value.trim()) === FILMING_PASSWORD_HASH;
}
