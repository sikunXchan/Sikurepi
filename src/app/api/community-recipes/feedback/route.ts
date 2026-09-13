import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  isCommunityRecipe,
  sanitizeCommunityRecipe,
  serializeCommunityRecipeIdentity,
} from '@/lib/communityRecipeSchema';
import type { CommunityRecipe } from '@/lib/communityRecipeSchema';

type CommunityRecipeRow = {
  id: string;
  recipe: CommunityRecipe;
};

function getRecipeKey(recipe: CommunityRecipe): string {
  return createHash('sha256').update(serializeCommunityRecipeIdentity(recipe)).digest('hex');
}

async function findLegacyRecipe(recipe: CommunityRecipe): Promise<string | null> {
  if (!supabase) return null;
  const target = serializeCommunityRecipeIdentity(recipe);
  const { data, error } = await supabase
    .from('community_recipes')
    .select('id, recipe')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return null;
  const match = (data as CommunityRecipeRow[] | null)?.find((row) =>
    isCommunityRecipe(row.recipe) && serializeCommunityRecipeIdentity(row.recipe) === target
  );
  return match?.id || null;
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ accepted: true, rankingUpdated: false, reason: 'local-only' });
  }

  try {
    const body = await req.json();
    if (!isCommunityRecipe(body?.recipe)) {
      return NextResponse.json({ error: 'invalid recipe payload' }, { status: 400 });
    }
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim().slice(0, 120) : '';
    const rating = body?.rating === 1 ? 1 : body?.rating === -1 ? -1 : 0;
    const note = typeof body?.note === 'string' ? body.note.normalize('NFKC').trim().slice(0, 500) : '';
    const source = body?.source === 'completion' ? 'completion' : 'generation';
    const publish = body?.publish === true;
    if (!deviceId || rating === 0) {
      return NextResponse.json({ error: 'deviceId and rating are required' }, { status: 400 });
    }

    const recipe = sanitizeCommunityRecipe(body.recipe);
    const recipeKey = getRecipeKey(recipe);
    const keyedLookup = await supabase
      .from('community_recipes')
      .select('id')
      .eq('recipe_key', recipeKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let recipeId = !keyedLookup.error ? keyedLookup.data?.id || null : null;
    const supportsRecipeKey = !keyedLookup.error;
    if (!recipeId) recipeId = await findLegacyRecipe(recipe);

    // 高評価はユーザー自身による明示的な共有意思として扱う。自動共有をOFFにした
    // Plusユーザーでも、この操作をしたレシピだけはランキングへ参加できる。
    if (!recipeId && publish) {
      const inserted = supportsRecipeKey
        ? await supabase.from('community_recipes').insert({ recipe, recipe_key: recipeKey }).select('id').single()
        : await supabase.from('community_recipes').insert({ recipe }).select('id').single();
      if (inserted.error) throw inserted.error;
      recipeId = inserted.data?.id || null;
    }

    // 未共有レシピへの低評価は個人の好み学習には保存済み。公開ランキング側には
    // 対象行を新規作成せず、意図せぬ共有を防ぐ。
    if (!recipeId) {
      return NextResponse.json({ accepted: true, rankingUpdated: false });
    }

    const feedbackResult = await supabase
      .from('community_recipe_feedback')
      .upsert({
        recipe_id: recipeId,
        device_id: deviceId,
        rating,
        note: note || null,
        source,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'recipe_id,device_id' });

    if (!feedbackResult.error) {
      const counts = await supabase
        .from('community_recipes')
        .select('likes_count, positive_ratings_count, negative_ratings_count, ranking_score')
        .eq('id', recipeId)
        .maybeSingle();
      return NextResponse.json({
        accepted: true,
        rankingUpdated: true,
        recipeId,
        ...(counts.data || {}),
      });
    }

    // SQL更新前でも高評価だけは既存の「いいね」基盤へ接続し、順位に反映する。
    if (rating === 1) {
      const legacyLike = await supabase
        .from('community_recipe_likes')
        .insert({ recipe_id: recipeId, device_id: deviceId });
      if (legacyLike.error && legacyLike.error.code !== '23505') throw legacyLike.error;
      return NextResponse.json({ accepted: true, rankingUpdated: true, recipeId, legacy: true });
    }

    return NextResponse.json({ accepted: true, rankingUpdated: false, recipeId, legacy: true });
  } catch (error: unknown) {
    console.error('Community Recipe Feedback Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to save recipe feedback',
    }, { status: 500 });
  }
}
