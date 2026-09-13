import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ホームタブ「みんなのレシピ」用API。
// ユーザーが気に入ったレシピをSupabaseの公開テーブル(community_recipes)に共有し、
// 他のユーザーが一覧を見たり「いいね」できるようにする(ログイン不要)。
// Supabase未設定の環境では、この機能自体を使わない(空一覧を返す)。

export type CommunityRecipe = {
  title: string;
  time: string;
  ingredients: { name: string; amount: string }[];
  steps: string[];
  tips: string;
  genre?: string | null;
  dish_badge?: string | null;
  nutrition?: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
  } | null;
};

function isCommunityRecipe(value: unknown): value is CommunityRecipe {
  if (!value || typeof value !== 'object') return false;
  const recipe = value as Partial<CommunityRecipe>;
  return typeof recipe.title === 'string'
    && typeof recipe.time === 'string'
    && Array.isArray(recipe.ingredients)
    && Array.isArray(recipe.steps)
    && typeof recipe.tips === 'string';
}

function sanitizeRecipe(recipe: CommunityRecipe): CommunityRecipe {
  return {
    title: recipe.title.trim().slice(0, 160),
    time: recipe.time.trim().slice(0, 40),
    ingredients: recipe.ingredients.slice(0, 40).map((item) => ({
      name: String(item?.name || '').trim().slice(0, 100),
      amount: String(item?.amount || '').trim().slice(0, 80),
    })).filter((item) => item.name),
    steps: recipe.steps.slice(0, 30).map((step) => String(step).trim().slice(0, 800)).filter(Boolean),
    tips: recipe.tips.trim().slice(0, 1200),
    genre: typeof recipe.genre === 'string' ? recipe.genre.trim().slice(0, 80) : null,
    dish_badge: typeof recipe.dish_badge === 'string' ? recipe.dish_badge.trim().slice(0, 120) : null,
    nutrition: recipe.nutrition || null,
  };
}

export async function GET(req: Request) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ recipes: [] });
  }

  const requestedLimit = Number(new URL(req.url).searchParams.get('limit'));
  const limit = Number.isFinite(requestedLimit) ? Math.min(20, Math.max(1, Math.floor(requestedLimit))) : 10;
  const { data, error } = await supabase
    .from('community_recipes')
    .select('id, recipe, likes_count, created_at')
    .order('likes_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Community Recipes List Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ recipes: data || [] });
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: 'Community recipes are not available in this deployment' }, { status: 503 });
  }

  try {
    const body = await req.json();
    const candidates: unknown[] = Array.isArray(body?.recipes) ? body.recipes : [body?.recipe];
    const recipes = candidates.filter(isCommunityRecipe).slice(0, 14).map(sanitizeRecipe);
    if (recipes.length === 0) {
      return NextResponse.json({ error: 'invalid recipe payload' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('community_recipes')
      .insert(recipes.map((recipe) => ({ recipe })))
      .select('id');

    if (error) throw error;
    return NextResponse.json({ ids: (data || []).map((row) => row.id) });
  } catch (error: unknown) {
    console.error('Community Recipes Share Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to share community recipes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
