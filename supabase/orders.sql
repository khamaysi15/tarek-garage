-- מוסך טארק: הזמנות חלקים
create table if not exists public.orders (k text primary key, data jsonb not null, plate text, updated_at timestamptz default now());
alter table public.orders enable row level security;

-- everyone active sees all orders
drop policy if exists o_read on public.orders;
create policy o_read on public.orders for select to authenticated using (public.is_active_user());
-- a worker opens orders only in his own name; admins for anyone
drop policy if exists o_ins on public.orders;
create policy o_ins on public.orders for insert to authenticated
  with check (public.is_admin() or (public.is_active_user() and data->>'workerId' = public.my_employee_id()));
-- a worker may change his own order while it is still open (and may not change its owner or status);
-- admins change anything (status: open → ordered → received / cancelled)
drop policy if exists o_upd on public.orders;
create policy o_upd on public.orders for update to authenticated
  using (public.is_admin() or (public.is_active_user() and data->>'workerId' = public.my_employee_id() and data->>'status' = 'open'))
  with check (public.is_admin() or (data->>'workerId' = public.my_employee_id() and data->>'status' in ('open', 'cancelled')));
drop policy if exists o_del on public.orders;
create policy o_del on public.orders for delete to authenticated using (public.is_admin());
