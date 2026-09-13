import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  isCommunityRecipe,
  sanitizeCommunityRecipe,
  serializeCommunityRecipeIdentity,
} from '@/lib/communityRecipeSchema';
import type { CommunityRecipe } from '@/lib/communityRecipeSchema';
import { COMMUNITY_RECIPE_SEEDS } from '@/lib/communityRecipeSeeds';

// ホームタブ「みんなのレシピ」用API。
// ユーザーが気に入ったレシピをSupabaseの公開テーブル(community_recipes)に共有し、
// 他のユーザーが一覧を見たり「いいね」できるようにする(ログイン不要)。
// Supabase未設定の環境では、この機能自体を使わない(空一覧を返す)。

export type { CommunityRecipe } from '@/lib/communityRecipeSchema';

function getRecipeKey(recipe: CommunityRecipe): string {
  return createHash('sha256').update(serializeCommunityRecipeIdentity(recipe)).digest('hex');
}

async function findLegacyRecipe(recipe: CommunityRecipe): Promise<string | null> {
  if (!supabase) return null;
  const target = serializeCommunityRecipeIdentity(recipe);
  const result = await supabase
    .from('community_recipes')
    .select('id, recipe')
    .order('created_at', { ascending: false })
    .limit(200);
  if (result.error) return null;
  const match = (result.data as CommunityRecipeListRow[] | null)?.find((row) =>
    isCommunityRecipe(row.recipe) && serializeCommunityRecipeIdentity(row.recipe) === target
  );
  return match?.id || null;
}

type CommunityRecipeListRow = {
  id: string;
  recipe: CommunityRecipe;
  likes_count?: number;
  positive_ratings_count?: number;
  negative_ratings_count?: number;
  ranking_score?: number;
  created_at?: string;
};

function mergeSeedRecipes(rows: CommunityRecipeListRow[], limit: number): CommunityRecipeListRow[] {
  const seedById = new Map(COMMUNITY_RECIPE_SEEDS.map((seed) => [seed.id, seed]));
  const merged = rows.map((row) => {
    const seed = seedById.get(row.id);
    return seed ? { ...row, recipe: seed.recipe, created_at: row.created_at || seed.createdAt } : row;
  });
  const existingIds = new Set(merged.map((row) => row.id));
  for (const seed of COMMUNITY_RECIPE_SEEDS) {
    if (existingIds.has(seed.id)) continue;
    merged.push({
      id: seed.id,
      recipe: seed.recipe,
      likes_count: 0,
      positive_ratings_count: 0,
      negative_ratings_count: 0,
      ranking_score: 0,
      created_at: seed.createdAt,
    });
  }
  return merged
    .sort((a, b) =>
      (b.ranking_score ?? b.likes_count ?? 0) - (a.ranking_score ?? a.likes_count ?? 0)
      || (b.likes_count ?? 0) - (a.likes_count ?? 0)
      || Date.parse(b.created_at || '') - Date.parse(a.created_at || '')
    )
    .slice(0, limit);
}

async function ensureCommunityRecipeSeeds(): Promise<void> {
  if (!supabase) return;
  const ids = COMMUNITY_RECIPE_SEEDS.map((seed) => seed.id);
  const existing = await supabase.from('community_recipes').select('id').in('id', ids);
  if (existing.error) return;
  const existingIds = new Set((existing.data || []).map((row) => row.id));

  for (const seed of COMMUNITY_RECIPE_SEEDS) {
    if (existingIds.has(seed.id)) continue;
    const recipeKey = getRecipeKey(seed.recipe);
    const inserted = await supabase.from('community_recipes').insert({
      id: seed.id,
      recipe: seed.recipe,
      recipe_key: recipeKey,
      created_at: seed.createdAt,
    });
    if (!inserted.error) continue;
    // 評価用スキーマ適用前でも、従来カラムだけで初期レシピを投入する。
    const legacy = await supabase.from('community_recipes').insert({
      id: seed.id,
      recipe: seed.recipe,
      created_at: seed.createdAt,
    });
    if (legacy.error && legacy.error.code !== '23505') {
      console.warn('Community Recipe Seed Error:', legacy.error.message);
    }
  }
}

export async function GET(req: Request) {
  if (!isSupabaseConfigured || !supabase) {
    const requestedLimit = Number(new URL(req.url).searchParams.get('limit'));
    const limit = Number.isFinite(requestedLimit) ? Math.min(20, Math.max(1, Math.floor(requestedLimit))) : 10;
    return NextResponse.json({ recipes: mergeSeedRecipes([], limit) });
  }

  const requestedLimit = Number(new URL(req.url).searchParams.get('limit'));
  const limit = Number.isFinite(requestedLimit) ? Math.min(20, Math.max(1, Math.floor(requestedLimit))) : 10;
  await ensureCommunityRecipeSeeds();
  const ranked = await supabase
    .from('community_recipes')
    .select('id, recipe, likes_count, positive_ratings_count, negative_ratings_count, ranking_score, created_at')
    .order('ranking_score', { ascending: false })
    .order('likes_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!ranked.error) {
    return NextResponse.json({ recipes: mergeSeedRecipes((ranked.data || []) as CommunityRecipeListRow[], limit) });
  }

  // 新しい評価用カラムのSQLがまだ適用されていない環境でも、従来の一覧は表示する。
  const legacy = await supabase
    .from('community_recipes')
    .select('id, recipe, likes_count, created_at')
    .order('likes_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (legacy.error) {
    console.error('Community Recipes List Error:', legacy.error);
    return NextResponse.json({ recipes: mergeSeedRecipes([], limit) });
  }
  return NextResponse.json({ recipes: mergeSeedRecipes((legacy.data || []) as CommunityRecipeListRow[], limit) });
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: 'Community recipes are not available in this deployment' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const candidates: unknown[] = Array.isArray(body?.recipes) ? body.recipes : [body?.recipe];
    const recipes = candidates.filter(isCommunityRecipe).slice(0, 14).map(sanitizeCommunityRecipe);
    if (recipes.length === 0) {
      return NextResponse.json({ error: 'invalid recipe payload' }, { status: 400 });
    }

    const ids: string[] = [];
    for (const recipe of recipes) {
      const recipeKey = getRecipeKey(recipe);
      const existing = await supabase
        .from('community_recipes')
        .select('id')
        .eq('recipe_key', recipeKey)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const existingId = !existing.error && existing.data?.id
        ? existing.data.id
        : await findLegacyRecipe(recipe);
      if (existingId) {
        ids.push(existingId);
        continue;
      }

      const insertWithKey = await supabase
        .from('community_recipes')
        .insert({ recipe, recipe_key: recipeKey })
        .select('id')
        .single();
      if (!insertWithKey.error && insertWithKey.data?.id) {
        ids.push(insertWithKey.data.id);
        continue;
      }

      // スキーマ更新前の環境ではrecipe_keyなしの従来形式で共有を継続する。
      const legacyInsert = await supabase
        .from('community_recipes')
        .insert({ recipe })
        .select('id')
        .single();
      if (legacyInsert.error) throw legacyInsert.error;
      if (legacyInsert.data?.id) ids.push(legacyInsert.data.id);
    }
    return NextResponse.json({ ids });
  } catch (error: unknown) {
    console.error('Community Recipes Share Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to share community recipes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
