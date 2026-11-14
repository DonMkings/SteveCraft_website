-- SteveCraft shop v1. Run in a NEW, separate Supabase project.
-- Public visitors can only read published products and their stock variants.
-- Only accounts explicitly listed in public.shop_admins can manage inventory.
create extension if not exists pgcrypto;

create table if not exists public.shop_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique,
  description text,
  category text,
  price_naira numeric(12,2) not null check (price_naira >= 0),
  image_url text,
  is_made_to_order boolean not null default true,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint image_url_is_web check (image_url is null or image_url ~ '^https://')
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null check (size ~ '^([3-4][0-9]|50)$'),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  unique(product_id,size)
);

create or replace function public.is_shop_admin()
returns boolean language sql stable security definer set search_path = ''
as $$select exists (select 1 from public.shop_admins a where a.user_id = (select auth.uid()))$$;

alter table public.shop_admins enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;

-- Only project administrator / SQL editor should maintain shop_admins.
revoke all on public.shop_admins from anon, authenticated;
grant select, insert, update, delete on public.products, public.product_variants to authenticated;
grant select on public.products, public.product_variants to anon;
grant execute on function public.is_shop_admin() to authenticated;

create policy "Read published products" on public.products for select to anon,authenticated
using (is_published or (select public.is_shop_admin()));

create policy "Admins insert products" on public.products for insert to authenticated
with check ((select public.is_shop_admin()));
create policy "Admins update products" on public.products for update to authenticated
using ((select public.is_shop_admin())) with check ((select public.is_shop_admin()));
create policy "Admins delete products" on public.products for delete to authenticated
using ((select public.is_shop_admin()));

create policy "Read variants of published products" on public.product_variants for select to anon,authenticated
using (exists (select 1 from public.products p where p.id=product_id and (p.is_published or (select public.is_shop_admin()))));

create policy "Admins insert variants" on public.product_variants for insert to authenticated
with check ((select public.is_shop_admin()));
create policy "Admins update variants" on public.product_variants for update to authenticated
using ((select public.is_shop_admin())) with check ((select public.is_shop_admin()));
create policy "Admins delete variants" on public.product_variants for delete to authenticated
using ((select public.is_shop_admin()));

-- Optional public bucket: upload from the Supabase dashboard only.
-- Never grant anonymous users permission to upload, update or delete images.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('footwear-images','footwear-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "Public can view footwear photos"
on storage.objects for select to anon,authenticated
using (bucket_id='footwear-images');

create policy "Admins upload footwear photos"
on storage.objects for insert to authenticated
with check (bucket_id='footwear-images' and (select public.is_shop_admin()));
create policy "Admins edit footwear photos"
on storage.objects for update to authenticated
using (bucket_id='footwear-images' and (select public.is_shop_admin()))
with check (bucket_id='footwear-images' and (select public.is_shop_admin()));
create policy "Admins delete footwear photos"
on storage.objects for delete to authenticated
using (bucket_id='footwear-images' and (select public.is_shop_admin()));

-- AFTER you invite/sign in the admin, find their UUID in Authentication > Users.
-- Run as the SQL Editor / database owner, replacing the placeholder UUID:
-- insert into public.shop_admins(user_id) values ('YOUR-AUTH-USER-UUID');
-- Do not seed fictional products or stock. Upload genuine SteveCraft items.
