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
};

export async function GET() {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ recipes: [] });
  }

  const { data, error } = await supabase
    .from('community_recipes')
    .select('id, recipe, likes_count, created_at')
    .order('likes_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(10);

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
    const recipe: CommunityRecipe | undefined = body?.recipe;
    if (!recipe || typeof recipe.title !== 'string' || !Array.isArray(recipe.ingredients) || !Array.isArray(recipe.steps)) {
      return NextResponse.json({ error: 'invalid recipe payload' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('community_recipes')
      .insert({ recipe })
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ id: data.id });
  } catch (error: any) {
    console.error('Community Recipes Share Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
