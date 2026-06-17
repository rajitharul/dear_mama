-- DearMama — Visits (antenatal appointments) logging.
-- Reuses the existing care_logs table; only the log_type check constraint needs the new
-- 'visit' type. A visit is a single self-contained record: date/time (logged_at), place,
-- doctor, doctor's notes, prerequisites for the next visit, and free-text prescription
-- (medicine & supplements), tests/scans ordered, and routines. A future-dated visit is an
-- upcoming appointment (status derived from logged_at, not stored). The payload lives in the
-- `data` jsonb column (kind='visit').
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.

alter table public.care_logs drop constraint if exists care_logs_log_type_check;

alter table public.care_logs
  add constraint care_logs_log_type_check
  check (log_type in ('vital', 'symptom', 'actionable', 'test_result', 'mood', 'baby_note', 'rest', 'kick', 'movement', 'visit'));
