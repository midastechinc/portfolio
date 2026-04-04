-- ─────────────────────────────────────────────────────────────
--  MIDAS PORTFOLIO — Supabase Database Schema
--  Run this entire file in your Supabase SQL Editor
--  (Project → SQL Editor → New query → paste → Run)
-- ─────────────────────────────────────────────────────────────

-- Holdings table
create table if not exists public.holdings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  ticker      text not null,
  name        text not null default '',
  shares      numeric(18,6) not null check (shares > 0),
  cost        numeric(18,6) not null check (cost > 0),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Index for fast per-user queries
create index if not exists holdings_user_id_idx on public.holdings(user_id);

-- Unique: one entry per ticker per user
create unique index if not exists holdings_user_ticker_idx on public.holdings(user_id, ticker);

-- Auto-update updated_at on row change
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger holdings_updated_at
  before update on public.holdings
  for each row execute procedure update_updated_at();

-- ─── Row Level Security (RLS) ─────────────────────────────────
-- Users can ONLY see and modify their own holdings

alter table public.holdings enable row level security;

-- Allow users to read their own rows
create policy "Users can read own holdings"
  on public.holdings for select
  using (auth.uid() = user_id);

-- Allow users to insert their own rows
create policy "Users can insert own holdings"
  on public.holdings for insert
  with check (auth.uid() = user_id);

-- Allow users to update their own rows
create policy "Users can update own holdings"
  on public.holdings for update
  using (auth.uid() = user_id);

-- Allow users to delete their own rows
create policy "Users can delete own holdings"
  on public.holdings for delete
  using (auth.uid() = user_id);
