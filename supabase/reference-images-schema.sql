-- Run in SteveCraft Supabase SQL Editor ONCE.
-- Private image references for optional Design Studio quote attachments.
-- The public browser CANNOT list, read or upload these files directly.
-- Only the protected Edge Function writes files using service_role after Turnstile.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('design-references','design-references',false,3145728,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
 public=false,file_size_limit=3145728,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
-- Authenticated shop admins can read files when signing in through the Supabase API.
-- The Supabase dashboard project owner can access files through Storage directly.
create policy "Shop admins can read private references"
on storage.objects for select to authenticated
using (bucket_id = 'design-references' and (select public.is_shop_admin()));
-- No anon or authenticated INSERT/UPDATE/DELETE policies are granted for this bucket.
-- Do NOT make the bucket public or add anonymous upload/read policies.
