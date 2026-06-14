-- DearMama — extend `profiles` with the richer physical baseline captured in the
-- Care tab's "Initial medical information" (pre-pregnancy weight/height, Rh factor,
-- obstetric history, lifestyle flags).
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.

alter table public.profiles
  add column if not exists rh_factor text check (rh_factor in ('positive', 'negative')),
  add column if not exists pre_pregnancy_weight text,
  add column if not exists height text,
  add column if not exists obstetric_history text[] not null default '{}',
  add column if not exists lifestyle_flags text[] not null default '{}';
