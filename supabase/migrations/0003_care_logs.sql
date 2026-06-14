-- DearMama — generic Care logging table (time-series).
-- Backs the Care tab's loggers, starting with Vitals; reused later for symptoms,
-- actionables, and test results — payload variants live in the `data` jsonb column.
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.

create table if not exists public.care_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_type text not null check (log_type in ('vital', 'symptom', 'actionable', 'test_result')),
  logged_at timestamptz not null default now(),
  logged_date date not null default current_date,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security — each user can only touch their own logs.
alter table public.care_logs enable row level security;

drop policy if exists care_logs_owner on public.care_logs;
create policy care_logs_owner on public.care_logs
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists care_logs_user_time on public.care_logs (user_id, logged_at desc);
