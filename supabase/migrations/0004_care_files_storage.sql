-- DearMama — Storage for Care test results & scans (images + PDFs).
-- The Test results logger uploads files here; the care_logs row (log_type='test_result')
-- stores only the object path. Reuses the existing care_logs table — no table migration.
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.

-- Private bucket — objects are only reachable via the owner's session or a signed URL.
insert into storage.buckets (id, name, public)
values ('care-files', 'care-files', false)
on conflict (id) do nothing;

-- Owner-scoped Row Level Security: a user may only touch objects under their own
-- "<uid>/…" folder. The first path segment is the owner's auth uid (the app uploads
-- to `${userId}/<unique>.<ext>`).
drop policy if exists care_files_select on storage.objects;
create policy care_files_select on storage.objects
  for select
  using (bucket_id = 'care-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists care_files_insert on storage.objects;
create policy care_files_insert on storage.objects
  for insert
  with check (bucket_id = 'care-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists care_files_delete on storage.objects;
create policy care_files_delete on storage.objects
  for delete
  using (bucket_id = 'care-files' and (storage.foldername(name))[1] = auth.uid()::text);
