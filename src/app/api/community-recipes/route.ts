import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  isCommunityRecipe,
  sanitizeCommunityRecipe,
  serializeCommunityRecipeIdentity,
} from '@/lib/communityRecipeSchema';
import type { CommunityRecipe } from '@/lib/communityRecipeSchema';

// ホームタブ「みんなのレシピ」用API。
// ユーザーが気に入ったレシピをSupabaseの公開テーブル(community_recipes)に共有し、
// 他のユーザーが一覧を見たり「いいね」できるようにする(ログイン不要)。
// Supabase未設定の環境では、この機能自体を使わない(空一覧を返す)。

export type { CommunityRecipe } from '@/lib/communityRecipeSchema';

function getRecipeKey(recipe: CommunityRecipe): string {
  return createHash('sha256').update(serializeCommunityRecipeIdentity(recipe)).digest('hex');
}

export async function GET(req: Request) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ recipes: [] });
  }

  const requestedLimit = Number(new URL(req.url).searchParams.get('limit'));
  const limit = Number.isFinite(requestedLimit) ? Math.min(20, Math.max(1, Math.floor(requestedLimit))) : 10;
  const ranked = await supabase
    .from('community_recipes')
    .select('id, recipe, likes_count, positive_ratings_count, negative_ratings_count, ranking_score, created_at')
    .order('ranking_score', { ascending: false })
    .order('likes_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!ranked.error) {
    return NextResponse.json({ recipes: ranked.data || [] });
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
    return NextResponse.json({ error: legacy.error.message }, { status: 500 });
  }
  return NextResponse.json({ recipes: legacy.data || [] });
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
      if (!existing.error && existing.data?.id) {
        ids.push(existing.data.id);
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
