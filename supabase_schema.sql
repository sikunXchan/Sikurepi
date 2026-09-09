-- Sikurepi: アカウント同期(複数端末で同じデータを見る)用のスキーマ。
-- Supabaseプロジェクトの SQL Editor でこのファイルの内容を実行してください。
--
-- 設計方針: 在庫・買い物リスト・保存レシピ・統計・設定などをまとめて
-- 1ユーザー1行のJSONBスナップショットとして保存する(単純な全量同期)。
-- 個々の食材やレシピを行単位で管理する設計ではないため、同じアカウントで
-- 複数端末を「ほぼ同時に」操作した場合は後勝ち(最後に同期した端末の内容)に
-- なる点に注意。個人〜家族利用のデータ量・利用シーンでは十分な設計として
-- 採用している。

create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

-- 本人の行だけ読み書きできるようにする(他ユーザーのデータには一切アクセスできない)
drop policy if exists "user_data_select_own" on public.user_data;
create policy "user_data_select_own"
  on public.user_data for select
  using (auth.uid() = user_id);

drop policy if exists "user_data_insert_own" on public.user_data;
create policy "user_data_insert_own"
  on public.user_data for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_data_update_own" on public.user_data;
create policy "user_data_update_own"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ホームタブ「今日のおすすめ」用: 1日1件、AIが生成したレシピをキャッシュする。
-- 全ユーザー共通の公開データ(ユーザーごとの行ではない)なので、匿名(anon)キーで
-- 読み書きできるようにする。日付ごとに1行しか存在しない(1日目に最初にアクセスした
-- クライアントがAPI Route経由で生成・書き込みし、以降は同じ行を読むだけになる)。
create table if not exists public.daily_picks (
  pick_date date primary key,
  recipe jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.daily_picks enable row level security;

drop policy if exists "daily_picks_select_all" on public.daily_picks;
create policy "daily_picks_select_all"
  on public.daily_picks for select
  using (true);

-- 生成は1日1回だけで十分なため、書き込みは「まだ無ければ挿入」のみを許可する
-- (更新・削除は許可しない。同日に複数クライアントが同時生成しても
-- unique制約(pick_date)により最初の1件だけが残る)。
drop policy if exists "daily_picks_insert_all" on public.daily_picks;
create policy "daily_picks_insert_all"
  on public.daily_picks for insert
  with check (true);

-- ホームタブ「みんなのレシピ」用: ユーザーが良かったレシピを共有し、
-- 他のユーザーが「いいね」できる公開の掲示板的テーブル。
create table if not exists public.community_recipes (
  id uuid primary key default gen_random_uuid(),
  recipe jsonb not null,
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);

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

-- いいねが増えたら community_recipes.likes_count を自動で+1する
-- (クライアント側からのカウント更新は許可せず、トリガーで一貫性を保つ)。
create or replace function public.increment_community_recipe_likes()
returns trigger as $$
begin
  update public.community_recipes
    set likes_count = likes_count + 1
    where id = new.recipe_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_community_recipe_like_insert on public.community_recipe_likes;
create trigger on_community_recipe_like_insert
  after insert on public.community_recipe_likes
  for each row execute function public.increment_community_recipe_likes();
