-- מוסך טארק: משתמשים, מנהלים והרשאות
-- Run once in Supabase → SQL Editor. Safe to run again.

-- 1. One profile per login: who it is and what they may do
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text not null default '',
  role text not null default 'worker' check (role in ('admin', 'worker')),
  employee_id text,
  active boolean not null default true,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_active_user() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.profiles where user_id = auth.uid() and active) $$;
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists (select 1 from public.profiles where user_id = auth.uid() and active and role = 'admin') $$;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
-- profiles are written only by the server function (service role), never directly from phones

-- 2. Replace "any login may do anything" with role-based rules
drop policy if exists staff_all on public.reports;
drop policy if exists staff_all on public.vehicles;
drop policy if exists staff_all on public.employees;
drop policy if exists staff_all on public.settings;
drop policy if exists staff_read on public.reports_history;
drop policy if exists staff_media on storage.objects;

-- jobs and vehicles: every active worker reads, adds and corrects; only admins delete
drop policy if exists r_read on public.reports;   create policy r_read  on public.reports  for select to authenticated using (public.is_active_user());
drop policy if exists r_ins  on public.reports;   create policy r_ins   on public.reports  for insert to authenticated with check (public.is_active_user());
drop policy if exists r_upd  on public.reports;   create policy r_upd   on public.reports  for update to authenticated using (public.is_active_user()) with check (public.is_active_user());
drop policy if exists r_del  on public.reports;   create policy r_del   on public.reports  for delete to authenticated using (public.is_admin());
drop policy if exists v_read on public.vehicles;  create policy v_read  on public.vehicles for select to authenticated using (public.is_active_user());
drop policy if exists v_ins  on public.vehicles;  create policy v_ins   on public.vehicles for insert to authenticated with check (public.is_active_user());
drop policy if exists v_upd  on public.vehicles;  create policy v_upd   on public.vehicles for update to authenticated using (public.is_active_user()) with check (public.is_active_user());
drop policy if exists v_del  on public.vehicles;  create policy v_del   on public.vehicles for delete to authenticated using (public.is_admin());
-- worker list and settings: everyone reads, only admins change
drop policy if exists e_read on public.employees; create policy e_read  on public.employees for select to authenticated using (public.is_active_user());
drop policy if exists e_admin on public.employees; create policy e_admin on public.employees for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists s_read on public.settings;  create policy s_read  on public.settings for select to authenticated using (public.is_active_user());
drop policy if exists s_admin on public.settings; create policy s_admin on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- server-side version history: admins only
drop policy if exists h_read on public.reports_history; create policy h_read on public.reports_history for select to authenticated using (public.is_admin());
-- recordings and photos: active workers upload and view, only admins delete
drop policy if exists m_read on storage.objects; create policy m_read on storage.objects for select to authenticated using (bucket_id = 'media' and public.is_active_user());
drop policy if exists m_ins  on storage.objects; create policy m_ins  on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_active_user());
drop policy if exists m_upd  on storage.objects; create policy m_upd  on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_active_user()) with check (bucket_id = 'media' and public.is_active_user());
drop policy if exists m_del  on storage.objects; create policy m_del  on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- 3. Every login that already exists becomes an admin (today that is only the owner)
insert into public.profiles (user_id, email, name, role, employee_id)
  select id, email, 'מנהל', 'admin', 'u-' || id from auth.users
  on conflict (user_id) do nothing;
insert into public.employees (k, data)
  select 'u-' || id, jsonb_build_object('id', 'u-' || id, 'name', 'מנהל', 'active', true, 'userId', id)
  from auth.users
  on conflict (k) do nothing;
