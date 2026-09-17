// Opt-in: two real API requests. Uses the local server's key, never reads or logs it.
const base = process.argv.find((arg) => /^https?:/.test(arg)) || 'http://127.0.0.1:3107';
if (!process.argv.includes('--live')) {
  console.log('Opt-in only (billable Gemini calls): node scripts/smoke-generation.mjs --live [base URL]');
  process.exit(0);
}
const profile = { servings: 2, dietaryRestrictions: [], excludedIngredients: [], allergies: [], assumeSeasoningsAvailable: true };
for (const entry of [
  { name: 'single', path: '/api/recipes', payload: { mode: 'free', mealStyle: 'single', instruction: '鶏肉と野菜のフライパン料理', servings: 2, userProfile: profile, language: 'ja' } },
  { name: 'weekly-lunch', path: '/api/recipes/weekly-plan', payload: { mode: 'free', slots: [{ date: new Date().toISOString().slice(0, 10), mealSlot: 'lunch' }], ingredients: [], userProfile: profile, language: 'ja' } },
]) {
  const start = Date.now();
  const response = await fetch(new URL(entry.path, base), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry.payload), signal: AbortSignal.timeout(315_000) });
  const body = await response.json();
  const count = (body.recipes || body.plan || []).length;
  console.log(JSON.stringify({ case: entry.name, status: response.status, durationMs: Date.now() - start, serverTiming: response.headers.get('server-timing'), validationAttempts: response.headers.get('x-sikurepi-validation-attempts'), model: response.headers.get('x-sikurepi-ai-model'), count }));
  if (!response.ok || !count) process.exitCode = 1;
}
