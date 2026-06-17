-- DearMama — "Rest & sleep" logging (Physical care).
-- Reuses the existing care_logs table; only the log_type check constraint needs the new
-- 'rest' type. The rest payload lives in the `data` jsonb column (kind='rest'): hours
-- slept, a sleep-quality rating, and an optional note.
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.

alter table public.care_logs drop constraint if exists care_logs_log_type_check;

alter table public.care_logs
  add constraint care_logs_log_type_check
  check (log_type in ('vital', 'symptom', 'actionable', 'test_result', 'mood', 'baby_note', 'rest'));
