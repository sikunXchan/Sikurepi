import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.argv[2] || process.env.SIKUREPI_BENCHMARK_URL || 'http://localhost:3000';

const standardProfile = {
  servings: 2,
  tastePreferences: [],
  excludedIngredients: [],
  allergies: [],
  cookingStyles: [],
  dietaryRestrictions: [],
  preferredGenres: [],
  flavorFeedback: [],
  assumeSeasoningsAvailable: true,
};

const cases = [
  {
    name: 'pork-cabbage',
    expected: 'accepted',
    payload: { ingredients: ['豚バラ肉', 'キャベツ', 'トマト', '卵'], mode: 'inventory' },
  },
  {
    name: 'salmon-vegetables',
    expected: 'accepted',
    payload: { ingredients: ['鮭', 'じゃがいも', '玉ねぎ', 'アスパラガス'], mode: 'inventory' },
  },
  {
    name: 'vegetarian',
    expected: 'accepted',
    payload: {
      ingredients: ['豆腐', 'キャベツ', 'しめじ', 'トマト'],
      mode: 'inventory',
      userProfile: { dietaryRestrictions: ['ベジタリアン'] },
    },
  },
  {
    name: 'vegan',
    expected: 'accepted',
    payload: {
      ingredients: ['ひよこ豆', 'トマト', '玉ねぎ', 'ほうれん草'],
      mode: 'inventory',
      userProfile: { dietaryRestrictions: ['ヴィーガン'] },
    },
  },
  {
    name: 'gluten-free',
    expected: 'accepted',
    payload: {
      ingredients: ['鶏むね肉', '米', 'ブロッコリー', 'にんじん'],
      mode: 'inventory',
      userProfile: { dietaryRestrictions: ['グルテンフリー'] },
    },
  },
  {
    name: 'halal',
    expected: 'accepted',
    payload: {
      ingredients: ['ハラール認証済み鶏むね肉', '米', 'トマト', '玉ねぎ'],
      mode: 'inventory',
      userProfile: { dietaryRestrictions: ['ハラール（イスラム教）'] },
    },
  },
  {
    name: 'soup-template',
    expected: 'accepted',
    payload: {
      ingredients: ['じゃがいも', '玉ねぎ', 'にんじん', '牛乳'],
      mode: 'inventory',
      templateKey: 'soup',
      instruction: '鍋かスープにして',
    },
  },
  {
    name: 'sweets-template',
    expected: 'accepted',
    payload: {
      ingredients: ['ホットケーキミックス', '卵', '牛乳', 'バナナ'],
      mode: 'inventory',
      templateKey: 'sweets',
      instruction: '簡単なデザートにして',
    },
  },
  {
    name: 'easy-clean',
    expected: 'accepted',
    payload: {
      ingredients: ['鶏むね肉', 'キャベツ', 'しめじ'],
      mode: 'inventory',
      templateKey: 'easyClean',
    },
  },
  {
    name: 'free-mexican',
    expected: 'accepted',
    payload: {
      ingredients: [],
      mode: 'free',
      instruction: '野菜が多く、家庭で作りやすいメキシコ料理',
    },
  },
  {
    name: 'english-inventory',
    expected: 'accepted',
    payload: {
      ingredients: ['chicken breast', 'tomato', 'onion', 'rice'],
      mode: 'inventory',
      language: 'en',
    },
  },
  {
    name: 'set-meal',
    expected: 'accepted',
    payload: {
      ingredients: ['鮭', '豆腐', 'キャベツ', 'にんじん', 'しめじ', '米'],
      mode: 'inventory',
      mealStyle: 'set',
    },
  },
  {
    name: 'seasonings-only',
    expected: 'infeasible',
    payload: { ingredients: ['塩', 'こしょう', '醤油'], mode: 'inventory' },
  },
  {
    name: 'incompatible-sweets',
    expected: 'infeasible',
    payload: {
      ingredients: ['鮭', 'キャベツ'],
      mode: 'inventory',
      templateKey: 'sweets',
      instruction: 'デザートを作りたい',
    },
  },
];

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

function serverDuration(serverTiming, metric) {
  if (!serverTiming) return null;
  const match = serverTiming.match(new RegExp(`(?:^|,\\s*)${metric};dur=([0-9.]+)`));
  return match ? Math.round(Number(match[1])) : null;
}

const results = [];
for (let index = 0; index < cases.length; index++) {
  const benchmarkCase = cases[index];
  const startedAt = performance.now();
  try {
    const response = await fetch(`${baseUrl}/api/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pinnedIngredients: [],
        conditions: [],
        servings: 2,
        language: 'ja',
        mealStyle: 'single',
        userProfile: standardProfile,
        ...benchmarkCase.payload,
        userProfile: {
          ...standardProfile,
          ...(benchmarkCase.payload.userProfile || {}),
        },
      }),
      signal: AbortSignal.timeout(180_000),
    });
    const data = await response.json();
    const durationMs = Math.round(performance.now() - startedAt);
    const outcome = data?.feasibility?.feasible === false
      ? 'infeasible'
      : response.ok && Array.isArray(data?.recipes) && data.recipes.length > 0
        ? 'accepted'
        : 'failed';
    const serverTiming = response.headers.get('server-timing');
    const result = {
      name: benchmarkCase.name,
      expected: benchmarkCase.expected,
      matchedExpectation: outcome === benchmarkCase.expected,
      outcome,
      status: response.status,
      durationMs,
      serverTiming,
      serverDurationMs: serverDuration(serverTiming, 'total'),
      aiDurationMs: serverDuration(serverTiming, 'ai'),
      model: response.headers.get('x-sikurepi-ai-model'),
      usedFlashRescue: response.headers.get('x-sikurepi-ai-rescue') === 'true',
      validationAttempts: Number(response.headers.get('x-sikurepi-validation-attempts') || 0),
      title: data?.recipes?.[0]?.title || null,
      error: typeof data?.error === 'string' ? data.error : null,
      feasibilityReason: data?.feasibility?.reason || null,
    };
    results.push(result);
    console.log(`[${index + 1}/${cases.length}] ${result.name}: ${result.outcome} ${result.durationMs}ms ${result.model || '-'} rescue=${result.usedFlashRescue}`);
  } catch (error) {
    const result = {
      name: benchmarkCase.name,
      expected: benchmarkCase.expected,
      matchedExpectation: false,
      outcome: 'request-error',
      status: 0,
      durationMs: Math.round(performance.now() - startedAt),
      serverDurationMs: null,
      aiDurationMs: null,
      model: null,
      usedFlashRescue: false,
      validationAttempts: 0,
      title: null,
      error: error instanceof Error ? error.message : String(error),
    };
    results.push(result);
    console.log(`[${index + 1}/${cases.length}] ${result.name}: request-error ${result.durationMs}ms`);
  }
}

const generated = results.filter((result) => result.expected === 'accepted');
const accepted = generated.filter((result) => result.outcome === 'accepted');
const durations = accepted.map((result) => result.durationMs);
const serverDurations = accepted.map((result) => result.serverDurationMs).filter(Number.isFinite);
const aiDurations = accepted.map((result) => result.aiDurationMs).filter(Number.isFinite);
const summary = {
  baseUrl,
  measuredAt: new Date().toISOString(),
  totalCases: results.length,
  expectationPassRate: results.filter((result) => result.matchedExpectation).length / results.length,
  recipeValidationPassRate: accepted.length / generated.length,
  flashLiteFirstPassRate: generated.filter((result) =>
    result.outcome === 'accepted'
    && result.model?.includes('flash-lite')
    && result.validationAttempts === 1
  ).length / generated.length,
  flashRescueRate: generated.filter((result) => result.usedFlashRescue).length / generated.length,
  medianAcceptedDurationMs: percentile(durations, 0.5),
  p90AcceptedDurationMs: percentile(durations, 0.9),
  medianAcceptedServerDurationMs: percentile(serverDurations, 0.5),
  p90AcceptedServerDurationMs: percentile(serverDurations, 0.9),
  medianAcceptedAiDurationMs: percentile(aiDurations, 0.5),
  results,
};

await mkdir(path.resolve('.tmp'), { recursive: true });
const outputPath = path.resolve('.tmp', `recipe-benchmark-${Date.now()}.json`);
await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  outputPath,
  totalCases: summary.totalCases,
  expectationPassRate: summary.expectationPassRate,
  recipeValidationPassRate: summary.recipeValidationPassRate,
  flashLiteFirstPassRate: summary.flashLiteFirstPassRate,
  flashRescueRate: summary.flashRescueRate,
  medianAcceptedDurationMs: summary.medianAcceptedDurationMs,
  p90AcceptedDurationMs: summary.p90AcceptedDurationMs,
  medianAcceptedServerDurationMs: summary.medianAcceptedServerDurationMs,
  p90AcceptedServerDurationMs: summary.p90AcceptedServerDurationMs,
  medianAcceptedAiDurationMs: summary.medianAcceptedAiDurationMs,
}, null, 2));
