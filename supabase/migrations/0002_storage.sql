-- ============================================================
-- TABLE FOR 2 -- Storage bucket for profile photos
-- ============================================================
-- Apply this after 0001_init.sql. Files live at userId/avatar-TIMESTAMP.ext
-- (see lib/uploadAvatar.ts); the policies below scope writes to the
-- userId folder via storage.foldername().

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Public read for avatars so Image tags can load the URL directly.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars: public read'
  ) then
    create policy "avatars: public read"
      on storage.objects for select
      using (bucket_id = 'avatars');
  end if;
end $$;

-- Owners can upload, update, and delete files inside their own folder.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars: user upload'
  ) then
    create policy "avatars: user upload"
      on storage.objects for insert
      with check (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars: user update own'
  ) then
    create policy "avatars: user update own"
      on storage.objects for update
      using (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars: user delete own'
  ) then
    create policy "avatars: user delete own"
      on storage.objects for delete
      using (
        bucket_id = 'avatars'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;
