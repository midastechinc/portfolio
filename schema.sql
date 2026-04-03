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

-- ─────────────────────────────────────────────────────────────
--  LINKEDIN LEAD TRACKER TABLES
--  These are populated by the GitHub Actions scraper.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.linkedin_received_invites (
  id                  bigint generated always as identity primary key,
  name                text not null default '',
  title               text not null default '',
  sent_at             text not null default '',
  note                text not null default '',
  mutual_connections  text not null default '',
  profile_url         text not null default '',
  status              text not null default 'pending',
  pulled_at           timestamptz not null default now()
);

create table if not exists public.linkedin_message_replies (
  id            bigint generated always as identity primary key,
  name          text not null default '',
  last_message  text not null default '',
  message_date  text not null default '',
  direction     text not null default 'inbound',
  is_unread     boolean not null default false,
  thread_url    text not null default '',
  pulled_at     timestamptz not null default now()
);

create table if not exists public.linkedin_sent_invites (
  id            bigint generated always as identity primary key,
  name          text not null default '',
  title         text not null default '',
  sent_at       text not null default '',
  profile_url   text not null default '',
  status        text not null default 'pending',
  pulled_at     timestamptz not null default now()
);

create index if not exists linkedin_received_invites_pulled_at_idx
  on public.linkedin_received_invites(pulled_at desc);

create index if not exists linkedin_message_replies_pulled_at_idx
  on public.linkedin_message_replies(pulled_at desc);

create index if not exists linkedin_sent_invites_pulled_at_idx
  on public.linkedin_sent_invites(pulled_at desc);

alter table public.linkedin_received_invites enable row level security;
alter table public.linkedin_message_replies enable row level security;
alter table public.linkedin_sent_invites enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'linkedin_received_invites'
      and policyname = 'Public read linkedin received invites'
  ) then
    create policy "Public read linkedin received invites"
      on public.linkedin_received_invites for select
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'linkedin_message_replies'
      and policyname = 'Public read linkedin message replies'
  ) then
    create policy "Public read linkedin message replies"
      on public.linkedin_message_replies for select
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'linkedin_sent_invites'
      and policyname = 'Public read linkedin sent invites'
  ) then
    create policy "Public read linkedin sent invites"
      on public.linkedin_sent_invites for select
      using (true);
  end if;
end $$;
