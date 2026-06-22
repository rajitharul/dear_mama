-- DearMama — Contractions logging (Physical care).
-- Reuses the existing care_logs table; only the log_type check constraint needs the new
-- 'contraction' type. Each timing session is one row: when it started (logged_at) plus, in the
-- `data` jsonb (kind='contraction'), every contraction's start + duration, the derived count,
-- average duration and average interval, an optional session type ('braxton_hicks' | 'labor'),
-- and an optional note. Regular vs irregular intervals tell true labor from Braxton Hicks.
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.

alter table public.care_logs drop constraint if exists care_logs_log_type_check;

alter table public.care_logs
  add constraint care_logs_log_type_check
  check (log_type in ('vital', 'symptom', 'actionable', 'test_result', 'mood', 'baby_note', 'rest', 'kick', 'movement', 'contraction', 'visit', 'journey'));
