-- DearMama — "Note to the baby" (Emotional care).
-- A small note to the baby, day by day — a keepsake to look back on. Reuses the
-- existing care_logs table; only the log_type check constraint needs the new
-- 'baby_note' type. The note text lives in the `data` jsonb column (kind='baby_note').
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.

alter table public.care_logs drop constraint if exists care_logs_log_type_check;

alter table public.care_logs
  add constraint care_logs_log_type_check
  check (log_type in ('vital', 'symptom', 'actionable', 'test_result', 'mood', 'baby_note'));
