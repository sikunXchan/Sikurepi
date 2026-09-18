import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// 「みんなのレシピ」への いいね。ログイン不要のため、クライアントが生成して
// localStorageに保存しているdeviceIdを使い、同じ端末からの多重いいねを
// community_recipe_likes の複合主キー(recipe_id, device_id)で防ぐ。
// likes_countの加算自体はDBトリガー(increment_community_recipe_likes)で行う。
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: 'Community recipes are not available in this deployment' }, { status: 503 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.trim() : '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
      || !deviceId || deviceId.length > 120) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // 既にいいね済みなら重複エラーを無視する(unique制約違反=すでにいいね済み、と
    // みなして冪等に成功扱いにする)
    const { error: insertError } = await supabase
      .from('community_recipe_likes')
      .insert({ recipe_id: id, device_id: deviceId });
    if (insertError && insertError.code !== '23505') throw insertError;

    const { data, error } = await supabase
      .from('community_recipes')
      .select('likes_count')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({ likes_count: data?.likes_count ?? 0, alreadyLiked: Boolean(insertError) });
  } catch {
    console.error('Community recipe like request failed');
    return NextResponse.json({ error: 'Unable to save like' }, { status: 500 });
  }
}
