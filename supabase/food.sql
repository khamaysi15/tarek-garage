-- מוסך טארק: הזמנת אוכל יומית (עד 12:00 שעון ישראל) ותזכורות לטלפון
create table if not exists public.meals (k text primary key, data jsonb not null, plate text, updated_at timestamptz default now());
alter table public.meals enable row level security;

create or replace function public.il_today() returns text language sql stable
  as $$ select to_char(now() at time zone 'Asia/Jerusalem', 'YYYY-MM-DD') $$;
create or replace function public.food_open() returns boolean language sql stable
  as $$ select (now() at time zone 'Asia/Jerusalem')::time < time '12:00' $$;

drop policy if exists f_read on public.meals;
create policy f_read on public.meals for select to authenticated using (public.is_active_user());
-- a worker orders only for himself, only for today, only before 12:00; admins any time
drop policy if exists f_ins on public.meals;
create policy f_ins on public.meals for insert to authenticated with check (public.is_admin() or (public.is_active_user()
  and data->>'workerId' = public.my_employee_id() and data->>'date' = public.il_today() and public.food_open()));
drop policy if exists f_upd on public.meals;
create policy f_upd on public.meals for update to authenticated
  using (public.is_admin() or (data->>'workerId' = public.my_employee_id() and data->>'date' = public.il_today() and public.food_open()))
  with check (public.is_admin() or (data->>'workerId' = public.my_employee_id() and data->>'date' = public.il_today() and public.food_open()));
drop policy if exists f_del on public.meals;
create policy f_del on public.meals for delete to authenticated
  using (public.is_admin() or (data->>'workerId' = public.my_employee_id() and data->>'date' = public.il_today() and public.food_open()));

-- phones that agreed to receive reminders
create table if not exists public.push_subs (endpoint text primary key, user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sub jsonb not null, created_at timestamptz default now());
alter table public.push_subs enable row level security;
drop policy if exists p_own on public.push_subs;
create policy p_own on public.push_subs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
