-- テーブル：募集（ポスト）基本
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  region text not null default 'ASIA',
  platform text not null default 'PC',
  owner text,              -- 任意（連絡先）
  room_code text,          -- 簡易入室コード（A/B共通）
  created_at timestamptz default now()
);

-- 参加者（どの募集のどのサイドか）
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  side text check (side in ('A','B')) not null,
  display_name text,
  updated_at timestamptz default now()
);

-- マップドラフト状態（募集ごと）
-- rounds: [{index:0, mode:'Control', bansA:[], bansB:[], pick:''}, ...]
create table if not exists draft_states (
  post_id uuid primary key references posts(id) on delete cascade,
  rounds jsonb not null default '[]'::jsonb,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- ヒーローPick/BAN状態（募集ごと）
-- state: {queue:[{phase:'BAN'|'PICK', side:'A'|'B'}...], idx:0,
--         bansA:[], bansB:[], picksA:[], picksB:[], available:[...]}
create table if not exists hero_states (
  post_id uuid primary key references posts(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- 簡易RLS。ここではデモとして誰でもread/write可に設定（実運用は要設計）
alter table posts enable row level security;
alter table participants enable row level security;
alter table draft_states enable row level security;
alter table hero_states enable row level security;

do $$ begin
  create policy "public_read_write_posts"
  on posts for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public_read_write_participants"
  on participants for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public_read_write_draft_states"
  on draft_states for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "public_read_write_hero_states"
  on hero_states for all using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Realtime
alter publication supabase_realtime add table posts, participants, draft_states, hero_states;
