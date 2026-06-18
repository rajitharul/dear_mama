-- DearMama — Partner access.
-- A mother can register a partner login (a separate auth user). The partner sees only the
-- mother's Care data and can view + add/edit Physical / Fetal / Visits entries. Access is
-- expressed by a row in partner_links; the broadened RLS below lets a linked partner act on
-- the mother's care_logs / profile / care-files as if they were the owner.
-- Run this in your Supabase project: Dashboard → SQL Editor → New query → paste → Run.
-- NOTE: also disable "Confirm email" under Authentication → Providers → Email so a freshly
-- provisioned partner can sign in immediately.

-- Who can act on whose data. One partner links to exactly one mother (unique partner_id).
create table if not exists public.partner_links (
  id uuid primary key default gen_random_uuid(),
  mother_id uuid not null references auth.users (id) on delete cascade,
  partner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (partner_id)
);

create index if not exists partner_links_mother on public.partner_links (mother_id);

alter table public.partner_links enable row level security;

-- The mother sees and manages her partners; a partner sees their own link.
drop policy if exists partner_links_select on public.partner_links;
create policy partner_links_select on public.partner_links
  for select
  using (mother_id = auth.uid() or partner_id = auth.uid());

drop policy if exists partner_links_insert on public.partner_links;
create policy partner_links_insert on public.partner_links
  for insert
  with check (mother_id = auth.uid());

drop policy if exists partner_links_delete on public.partner_links;
create policy partner_links_delete on public.partner_links
  for delete
  using (mother_id = auth.uid());

-- True when the current user is a partner linked to `owner`. SECURITY DEFINER so the lookup
-- isn't itself subject to (and recursive with) the policies that call it.
create or replace function public.is_linked_partner(owner uuid)
  returns boolean
  language sql
  security definer
  stable
  set search_path = public
as $$
  select exists (
    select 1 from public.partner_links
    where partner_id = auth.uid() and mother_id = owner
  );
$$;

-- Broaden the owner-only policies: a linked partner gets the same access as the owner.
drop policy if exists care_logs_owner on public.care_logs;
create policy care_logs_owner on public.care_logs
  for all
  using (user_id = auth.uid() or public.is_linked_partner(user_id))
  with check (user_id = auth.uid() or public.is_linked_partner(user_id));

drop policy if exists profiles_owner on public.profiles;
create policy profiles_owner on public.profiles
  for all
  using (user_id = auth.uid() or public.is_linked_partner(user_id))
  with check (user_id = auth.uid() or public.is_linked_partner(user_id));

-- Care-files storage: the app uploads to `${motherId}/…`, so a partner needs access to the
-- mother's folder. The first path segment is the owner's auth uid.
drop policy if exists care_files_select on storage.objects;
create policy care_files_select on storage.objects
  for select
  using (
    bucket_id = 'care-files'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_linked_partner(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists care_files_insert on storage.objects;
create policy care_files_insert on storage.objects
  for insert
  with check (
    bucket_id = 'care-files'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_linked_partner(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists care_files_delete on storage.objects;
create policy care_files_delete on storage.objects
  for delete
  using (
    bucket_id = 'care-files'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_linked_partner(((storage.foldername(name))[1])::uuid)
    )
  );
