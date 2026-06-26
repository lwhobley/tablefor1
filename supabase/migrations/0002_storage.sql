-- ============================================================
-- TABLE FOR ONE — Storage bucket for profile photos
-- ============================================================
-- Mirrors the commented-out block at the bottom of 0001_init.sql, in a
-- runnable form. Apply this after 0001_init.sql.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Public read for avatars (so <Image> tags can load the URL directly).
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Owners can upload, update, and delete files inside their own folder
-- (objects are stored as `{userId}/avatar-{ts}.{ext}` — see lib/uploadAvatar.ts).
create policy "avatars: user upload"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: user update own"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: user delete own"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
