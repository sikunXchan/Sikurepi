-- 本番で未作成だった共有テーブルを追加します。既存のレシピ・評価は削除しません。
-- Supabase SQL Editorで全体を実行してください。再実行できます。
begin;

-- ホームタブ「みんなのレシピ」用: ユーザーが良かったレシピを共有し、
-- 他のユーザーが「いいね」できる公開の掲示板的テーブル。
create table if not exists public.community_recipes (
  id uuid primary key default gen_random_uuid(),
  recipe jsonb not null,
  recipe_key text,
  likes_count integer not null default 0,
  positive_ratings_count integer not null default 0,
  negative_ratings_count integer not null default 0,
  ranking_score integer not null default 0,
  created_at timestamptz not null default now()
);

-- 既存環境へこのSQLを再実行しても安全に評価機能を追加できるようにする。
alter table public.community_recipes add column if not exists recipe_key text;
alter table public.community_recipes add column if not exists positive_ratings_count integer not null default 0;
alter table public.community_recipes add column if not exists negative_ratings_count integer not null default 0;
alter table public.community_recipes add column if not exists ranking_score integer not null default 0;
create index if not exists community_recipes_recipe_key_idx on public.community_recipes(recipe_key);
create index if not exists community_recipes_ranking_idx on public.community_recipes(ranking_score desc, likes_count desc, created_at desc);

alter table public.community_recipes enable row level security;

drop policy if exists "community_recipes_select_all" on public.community_recipes;
create policy "community_recipes_select_all"
  on public.community_recipes for select
  using (true);

drop policy if exists "community_recipes_insert_all" on public.community_recipes;
create policy "community_recipes_insert_all"
  on public.community_recipes for insert
  with check (true);

-- 「いいね」した端末を記録する(同じ端末からの多重いいねを防ぐ)。
-- device_idはサーバーが発行するものではなく、クライアント側で生成して
-- localStorageに保存したランダムIDをそのまま送ってもらう簡易的な仕組み
-- (ログイン必須にはしない)。
create table if not exists public.community_recipe_likes (
  recipe_id uuid not null references public.community_recipes(id) on delete cascade,
  device_id text not null,
  created_at timestamptz not null default now(),
  primary key (recipe_id, device_id)
);

alter table public.community_recipe_likes enable row level security;

drop policy if exists "community_recipe_likes_select_all" on public.community_recipe_likes;
create policy "community_recipe_likes_select_all"
  on public.community_recipe_likes for select
  using (true);

drop policy if exists "community_recipe_likes_insert_all" on public.community_recipe_likes;
create policy "community_recipe_likes_insert_all"
  on public.community_recipe_likes for insert
  with check (true);

-- 生成直後・料理完了時の評価。自由記述はランキング一覧には返さず、
-- レシピ改善用の非表示データとしてだけ保持する。
create table if not exists public.community_recipe_feedback (
  recipe_id uuid not null references public.community_recipes(id) on delete cascade,
  device_id text not null,
  rating smallint not null check (rating in (-1, 1)),
  note text,
  source text not null default 'generation' check (source in ('generation', 'completion')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (recipe_id, device_id)
);

alter table public.community_recipe_feedback enable row level security;

drop policy if exists "community_recipe_feedback_insert_all" on public.community_recipe_feedback;
create policy "community_recipe_feedback_insert_all"
  on public.community_recipe_feedback for insert
  with check (true);

drop policy if exists "community_recipe_feedback_update_all" on public.community_recipe_feedback;
create policy "community_recipe_feedback_update_all"
  on public.community_recipe_feedback for update
  using (true)
  with check (true);

create or replace function public.refresh_community_recipe_rating()
returns trigger as $$
declare
  target_recipe_id uuid;
  positive_count integer;
  negative_count integer;
begin
  if TG_OP = 'DELETE' then
    target_recipe_id := old.recipe_id;
  else
    target_recipe_id := new.recipe_id;
  end if;
  select
    count(*) filter (where rating = 1),
    count(*) filter (where rating = -1)
  into positive_count, negative_count
  from public.community_recipe_feedback
  where recipe_id = target_recipe_id;

  update public.community_recipes
    set positive_ratings_count = positive_count,
        negative_ratings_count = negative_count,
        ranking_score = likes_count + positive_count * 2 - negative_count * 2
    where id = target_recipe_id;
  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

drop trigger if exists on_community_recipe_feedback_change on public.community_recipe_feedback;
create trigger on_community_recipe_feedback_change
  after insert or update or delete on public.community_recipe_feedback
  for each row execute function public.refresh_community_recipe_rating();

-- いいねが増えたら community_recipes.likes_count を自動で+1する
-- (クライアント側からのカウント更新は許可せず、トリガーで一貫性を保つ)。
create or replace function public.increment_community_recipe_likes()
returns trigger as $$
begin
  update public.community_recipes
    set likes_count = likes_count + 1,
        ranking_score = ranking_score + 1
    where id = new.recipe_id;
  return new;
end;
$$ language plpgsql security definer set search_path = '';

drop trigger if exists on_community_recipe_like_insert on public.community_recipe_likes;
create trigger on_community_recipe_like_insert
  after insert on public.community_recipe_likes
  for each row execute function public.increment_community_recipe_likes();

-- 評価本文を公開SELECTせずに、新規評価と評価変更を同じ処理で保存する。
-- 匿名端末の識別方式は既存のdevice_idを維持する。
grant select, insert on public.community_recipes to anon, authenticated;
grant select, insert on public.community_recipe_likes to anon, authenticated;
revoke all on public.community_recipe_feedback from anon, authenticated;

create or replace function public.submit_community_recipe_feedback(
  p_recipe_id uuid,
  p_device_id text,
  p_rating smallint,
  p_note text default null,
  p_source text default 'completion'
)
returns table (
  likes_count integer,
  positive_ratings_count integer,
  negative_ratings_count integer,
  ranking_score integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_device_id is null or length(trim(p_device_id)) = 0 or length(p_device_id) > 120
    or p_rating is null or p_rating not in (-1, 1)
    or p_source is null or p_source not in ('generation', 'completion')
    or length(coalesce(p_note, '')) > 500 then
    raise exception 'Invalid feedback' using errcode = '22023';
  end if;

  -- 同じ料理への並行評価も直列化し、集計値の取りこぼしを防ぐ。
  perform 1 from public.community_recipes where id = p_recipe_id for update;
  if not found then
    raise exception 'Recipe not found' using errcode = '23503';
  end if;

  insert into public.community_recipe_feedback
    (recipe_id, device_id, rating, note, source, updated_at)
  values
    (p_recipe_id, p_device_id, p_rating, nullif(trim(p_note), ''), p_source, now())
  on conflict (recipe_id, device_id) do update
    set rating = excluded.rating, note = excluded.note,
        source = excluded.source, updated_at = excluded.updated_at;

  return query
    select r.likes_count, r.positive_ratings_count, r.negative_ratings_count, r.ranking_score
    from public.community_recipes r where r.id = p_recipe_id;
end;
$$;

revoke all on function public.submit_community_recipe_feedback(uuid, text, smallint, text, text) from public;
grant execute on function public.submit_community_recipe_feedback(uuid, text, smallint, text, text) to anon, authenticated;
notify pgrst, 'reload schema';

commit;
