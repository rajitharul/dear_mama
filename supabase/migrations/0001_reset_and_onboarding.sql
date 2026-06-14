-- DearMama — reset old schema + create the onboarding `profiles` table.
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Clean up the old build's objects (data + tables).
-- ─────────────────────────────────────────────────────────────────────────
drop table if exists public.event_records cascade;
drop table if exists public.events cascade;
drop table if exists public.quick_logs cascade;
drop table if exists public.emergency_contacts cascade;
drop table if exists public.care_team cascade;
drop table if exists public.medical_info cascade;
drop table if exists public.pregnancies cascade;
drop table if exists public.profiles cascade;
drop function if exists public.owns_pregnancy(uuid) cascade;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. New normalized onboarding profile — one row per authenticated user.
-- ─────────────────────────────────────────────────────────────────────────
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- Profile
  display_name text not null default '',
  age int,

  -- Pregnancy
  date_mode text not null default 'edd' check (date_mode in ('edd', 'lmp')),
  due_or_lmp_date date,
  date_source text check (date_source in ('doctor', 'self')),
  due_date_doctor text,
  baby_count smallint not null default 1 check (baby_count between 1 and 4),

  -- Medical (optional)
  blood_type text,
  conditions text[] not null default '{}',
  allergies text[] not null default '{}',
  medications text[] not null default '{}',
  prior_pregnancies int,
  medical_notes text,

  -- Contacts & care team (optional)
  emergency_name text,
  emergency_phone text,
  emergency_relation text,
  care_role text not null default 'ob' check (care_role in ('ob', 'midwife', 'clinic', 'other')),
  care_name text,
  care_phone text,
  care_clinic text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Row Level Security — each user can only touch their own row.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
