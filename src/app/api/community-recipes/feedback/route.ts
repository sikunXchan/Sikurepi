import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  isCommunityRecipe,
  sanitizeCommunityRecipe,
  serializeCommunityRecipeIdentity,
} from '@/lib/communityRecipeSchema';
import type { CommunityRecipe } from '@/lib/communityRecipeSchema';
import { communityServiceError, isMissingCommunityColumn } from '@/lib/communityRecipeErrors';

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
  if (error) throw error;
  const match = (data as CommunityRecipeRow[] | null)?.find((row) =>
    isCommunityRecipe(row.recipe) && serializeCommunityRecipeIdentity(row.recipe) === target
  );
  return match?.id || null;
}

export async function POST(req: Request) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json(communityServiceError({ code: 'COMMUNITY_NOT_CONFIGURED' }), { status: 503 });
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

    if (keyedLookup.error && !isMissingCommunityColumn(keyedLookup.error)) throw keyedLookup.error;

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

    // privateな評価本文にSELECT権限を足さず、DB関数内で評価変更と集計を完了する。
    // 古いlikesへ逃がすと低評価への変更が反映されないため、失敗時は再送対象にする。
    const feedbackResult = await supabase.rpc('submit_community_recipe_feedback', {
      p_recipe_id: recipeId,
      p_device_id: deviceId,
      p_rating: rating,
      p_note: note || null,
      p_source: source,
    });
    if (feedbackResult.error) throw feedbackResult.error;
    const counts = feedbackResult.data?.[0];
    if (!counts) throw new Error('Feedback save returned no receipt');
    return NextResponse.json({ accepted: true, rankingUpdated: true, recipeId, ...counts });
  } catch (error: unknown) {
    console.error('Community Recipe Feedback Error:', error);
    return NextResponse.json(communityServiceError(error), { status: 503 });
  }
}
