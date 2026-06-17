-- DearMama — Emotional care logging (mood check-ins).
-- Reuses the existing care_logs table; only the log_type check constraint needs to
-- learn the new 'mood' type. The mood payload lives in the `data` jsonb column
-- (kind='mood'): a 1–5 rating, optional feeling tags, and an optional note.
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.

alter table public.care_logs drop constraint if exists care_logs_log_type_check;

alter table public.care_logs
  add constraint care_logs_log_type_check
  check (log_type in ('vital', 'symptom', 'actionable', 'test_result', 'mood'));
