import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import ts from 'typescript';
import * as schema from '../src/lib/communityRecipeSchema.ts';
import * as translation from '../src/lib/communityTranslation.ts';
import { parseAiJson } from '../src/lib/aiJson.ts';

const id = '0e690896-3842-4ccd-b861-2e929aeab95e';
const source = {
  title: 'あさりと新じゃがのスープ', time: '15分', genre: '和食', dish_badge: '時短料理',
  ingredients: [{ name: 'バター', amount: '10g' }, { name: 'しょうゆ', amount: '小さじ1/8' }],
  steps: ['直径20cmの鍋にバター10gを入れ、中火で1分加熱する。', '8割ほど色が変わったら1分半炒め、75°Cで1分以上加熱する。'],
  tips: 'しょうゆ小さじ1/8で調整。', servings: 2,
};
const english = {
  title: 'Clam and New Potato Soup', time: '15 minutes', dish_badge: 'Quick cooking',
  ingredients: [{ name: 'Butter', amount: '10 g' }, { name: 'Soy sauce', amount: '0.125 tsp' }],
  steps: ['Place butter (10g) in a 20cm pot and heat over medium heat for 1 minute.', 'When 80% has changed color, stir-fry for 1.5 minutes and cook at 75°C for at least 1 minute.'],
  tips: 'Adjust with 1/8 tsp of soy sauce.', components: [], creator_comment: null,
};
const validated = translation.validateCommunityTranslation(source, english, 'en');
assert.ok(validated, 'natural word order, fractions, percentages and half minutes are equivalent');
assert.ok(translation.validateCommunityTranslation(source, {
  ...english, steps: english.steps.map((step, i) => `${i + 1}. ${step}`),
}, 'en'), 'display step numbering is not a cooking quantity');
assert.equal(translation.validateCommunityTranslation(source, {
  ...english, steps: [english.steps[0], english.steps[1].replace('75°C', '1°C').replace('at least 1 minute', 'at least 75 minutes')],
}, 'en'), null, 'temperature/time swaps must fail even with the same numeric tokens');
assert.equal(translation.validateCommunityTranslation(source, {
  ...english, ingredients: [english.ingredients[0], { name: 'Soy sauce', amount: '0.125 tbsp' }],
}, 'en'), null, 'tablespoons and teaspoons must not be interchanged');
assert.equal(translation.validateCommunityTranslation(source, {
  ...english, steps: [english.steps[0], english.steps[1].replace('75°C', '75°F')],
}, 'en'), null, 'temperature units remain protected');
assert.equal(translation.validateCommunityTranslation(source, {
  ...english, steps: [english.steps[0], english.steps[1].replace('80%', '8%')],
}, 'en'), null, 'percentage normalization must not hide changed values');
assert.equal(translation.validateCommunityTranslation(source, {
  ...english, steps: [...english.steps, 'Serve.'],
}, 'en'), null, 'step count stays unchanged');
for (const mixed of [
  { ...english, tips: '焦がさないように。' },
  { ...english, dish_badge: '時短料理' },
  { ...english, time: '15分' },
  { ...english, ingredients: [{ name: 'バター', amount: '10g' }, english.ingredients[1]] },
  { ...english, ingredients: [english.ingredients[0], { name: 'Soy sauce', amount: '小さじ1/8' }] },
  { ...english, components: [{ course: 'main', title: 'あさりスープ' }] },
]) {
  assert.equal(translation.needsCommunityTranslation(mixed, 'en'), true, 'all visible fields need translation');
  assert.equal(translation.validateCommunityTranslation(source, mixed, 'en'), null);
}
assert.equal(translation.needsCommunityTranslation({ ...english, dish_badge: '時短料理' }, 'ja'), true,
  'one Japanese badge must not make an English recipe count as Japanese');
assert.equal(translation.needsCommunityTranslation({ ...english, genre: '和食' }, 'en'), false,
  'canonical genre identifiers are localized by the UI dictionary');
assert.equal(translation.needsCommunityTranslation({ ...source, translations: { en: validated } }, 'en'), false);

function compile(path) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
const hookCode = compile('../src/lib/useCommunityTranslation.ts');
const storageKey = 'sikurepi_community_translations_v1';
function client(fetch, values = new Map()) {
  const exports = {};
  let slots, cursor;
  vm.runInNewContext(hookCode, {
    exports, fetch, AbortController, localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
    setTimeout: (fn, delay) => delay <= 10000 ? (queueMicrotask(fn), 0) : setTimeout(fn, delay),
    clearTimeout,
    require: name => {
      if (name === './communityTranslation') return translation;
      if (name === 'react') return {
        useEffect: fn => fn(), useCallback: fn => fn,
        useRef: initial => { const i = cursor++; return slots[i] ||= { current: initial }; },
        useState: initial => {
          const i = cursor++;
          if (!(i in slots)) slots[i] = initial;
          const currentSlots = slots;
          return [slots[i], value => { currentSlots[i] = value; }];
        },
      };
      throw new Error(name);
    },
  });
  return () => {
    const state = [];
    return (language = 'en') => {
      slots = state; cursor = 0;
      return exports.useCommunityTranslation(id, source, language);
    };
  };
}

let requests = 0;
const poisonedCache = new Map([[storageKey, JSON.stringify([null, {}, {
  key: `${id}:en`, source: translation.translationSourceKey(source),
  translation: { ...english, time: '999 minutes' },
}])]]);
const repaired = client(async () => { requests++; return Response.json({ translation: english }); }, poisonedCache)();
assert.ok((await repaired().ensureTranslation()).translations.en);
assert.equal(requests, 1, 'invalid local cache is fetched again rather than permanently failing');
assert.equal(repaired().missing, false);
assert.equal(repaired().busy, false);
assert.equal(JSON.parse(poisonedCache.get(storageKey)).at(-1).translation.title, english.title);
requests = 0;
const cached = client(async () => { requests++; throw new Error('cache should avoid network'); }, poisonedCache)();
await cached().ensureTranslation();
assert.equal(requests, 0);

for (const retryAfter of ['10', '600']) {
  requests = 0;
  const busy = client(async () => ++requests === 1
    ? Response.json({}, { status: 429, headers: { 'Retry-After': retryAfter } })
    : Response.json({ translation: english }))();
  await busy().ensureTranslation();
  assert.equal(requests, retryAfter === '10' ? 2 : 1, 'retry short concurrency pressure, not a long rate limit');
  assert.equal(busy().failed, retryAfter === '600');
}

let release;
requests = 0;
const shared = client(async () => { requests++; return new Promise(resolve => { release = () => resolve(Response.json({ translation: english })); }); });
const first = shared();
const second = shared();
const firstRequest = first().ensureTranslation();
const secondRequest = second().ensureTranslation();
assert.equal(requests, 1, 'home and full list share an in-flight request');
first('ja');
release();
await Promise.all([firstRequest, secondRequest]);
assert.equal(first('ja').recipe.title, source.title, 'late English response cannot overwrite Japanese selection');
assert.equal(second().missing, false);

// Exercise the real route with a fake AI provider and published recipe lookup.
const routeCode = compile('../src/app/api/community-recipes/[id]/translate/route.ts');
function route(outputs) {
  const exports = {};
  const calls = [];
  vm.runInNewContext(routeCode, {
    exports, process: { env: { GEMINI_API_KEY: 'test-only' } },
    require: name => {
      if (name === 'node:crypto') return crypto;
      if (name === 'next/server') return { NextResponse: Response };
      if (name === '@/lib/communityRecipeSchema') return schema;
      if (name === '@/lib/communityTranslation') return translation;
      if (name === '@/lib/aiJson') return { parseAiJson };
      if (name === '@/lib/communityRecipeSeeds') return { COMMUNITY_RECIPE_SEEDS: [] };
      if (name === '@/lib/supabase') return { supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { recipe: source } }) }) }) }) } };
      if (name === '@/lib/ai') return { ai: {}, FAST_AI_MODEL: 'test-model', generateWithRetry: async (...args) => {
        calls.push(args);
        const output = outputs[Math.min(calls.length - 1, outputs.length - 1)];
        return { text: typeof output === 'string' ? output : JSON.stringify(output) };
      } };
      throw new Error(name);
    },
  });
  return { calls, post: (language = 'en', recipeId = id) => exports.POST(new Request('https://example.test', {
    method: 'POST', body: JSON.stringify({ language, recipe: { title: 'Do not translate this untrusted request payload' } }),
  }), { params: Promise.resolve({ id: recipeId }) }) };
}
const api = route(['{invalid', english]);
let response = await api.post();
assert.equal(response.status, 200);
assert.equal((await response.json()).translation.title, english.title);
assert.equal(api.calls.length, 2);
assert.equal(api.calls[0][4].deadlineAt, api.calls[1][4].deadlineAt, 'correction does not extend deadline');
assert.ok(api.calls[0][1].config.responseJsonSchema, 'request structurally constrained output');
assert.equal(JSON.parse(api.calls[0][1].contents).title, source.title, 'translate only the published recipe');
await api.post();
assert.equal(api.calls.length, 2, 'successful output is cached');
assert.equal((await api.post('fr')).status, 400);
assert.equal((await api.post('en', 'local-pending')).status, 400);
const unsafe = route([{ ...english, time: '900 minutes' }]);
response = await unsafe.post();
assert.equal(response.status, 503, 'unsafe output is never returned as translated');
assert.equal(unsafe.calls.length, 2, 'failed correction is bounded');
assert.deepEqual(await response.json(), { error: 'Translation unavailable' });

const mirrorExports = {};
vm.runInNewContext(compile('../src/lib/communityRecipes.ts'), {
  exports: mirrorExports,
  window: { localStorage: { getItem: () => JSON.stringify([{ queueId: 'test', createdAt: '2026-09-21T00:00:00Z', syncStatus: 'pending', recipe: source }]) } },
  require: name => {
    if (name === './communityRecipeSchema') return schema;
    if (name === './storage' || name === './communityFeedbackQueue') return {};
    throw new Error(name);
  },
});
const merged = mirrorExports.mergeCommunityRecipesWithLocal([{ id, likes_count: 1, recipe: source }]);
assert.equal(merged.length, 1);
assert.equal(merged[0].sync_status, 'synced', 'confirmed publication enables translation despite a stale local pending flag');
console.log('Community translation passed: natural grammar, equivalent quantities, units, mixed-language fields, cache recovery, busy retries, language races, bounded API correction and published local mirrors.');
