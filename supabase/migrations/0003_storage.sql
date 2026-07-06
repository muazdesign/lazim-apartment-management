-- ============================================================
-- Migration 0003: Storage bucket + access policies
-- Bucket 'documents' is PRIVATE — files are served only via
-- signed URLs created server-side (see src/lib/documents.ts).
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false,
  20 * 1024 * 1024,   -- 20 MB per file
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- All staff can read files (viewer / signed downloads).
create policy "docs bucket: staff read"
  on storage.objects for select
  using (bucket_id = 'documents' and public.is_staff());

-- All staff can upload (secretary uploads contracts/IDs).
create policy "docs bucket: staff upload"
  on storage.objects for insert
  with check (bucket_id = 'documents' and public.is_staff());

-- Only managers+ can replace or delete stored files.
create policy "docs bucket: manager update"
  on storage.objects for update
  using (bucket_id = 'documents' and public.is_manager_or_admin());

create policy "docs bucket: manager delete"
  on storage.objects for delete
  using (bucket_id = 'documents' and public.is_manager_or_admin());
