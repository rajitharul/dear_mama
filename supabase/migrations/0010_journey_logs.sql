-- DearMama — Journey (pregnancy milestone timeline) logging.
-- Reuses the existing care_logs table; only the log_type check constraint needs the new
-- 'journey' type. Each recorded milestone is one row: when it happened (logged_at), which
-- catalog milestone it is (data.milestoneId — null for a custom event), a copied title, a
-- category, an optional note, and optional photos. Photos reuse the existing 'care-files'
-- private storage bucket (migration 0004) — only the object path is stored in the payload.
-- The milestone catalog itself lives in app code (src/care/journey/milestones.ts); the
-- timeline merges the catalog with these recorded rows. Payload lives in `data` jsonb
-- (kind='journey').
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.

alter table public.care_logs drop constraint if exists care_logs_log_type_check;

alter table public.care_logs
  add constraint care_logs_log_type_check
  check (log_type in ('vital', 'symptom', 'actionable', 'test_result', 'mood', 'baby_note', 'rest', 'kick', 'movement', 'visit', 'journey'));
