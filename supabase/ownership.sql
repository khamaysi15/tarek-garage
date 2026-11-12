-- מוסך טארק: עובד משנה רק את העבודה שלו; מנהל משנה ומוחק הכול
-- Run once (safe to run again).

create or replace function public.my_employee_id() returns text
  language sql stable security definer set search_path = public
  as $$ select employee_id from public.profiles where user_id = auth.uid() $$;

-- a worker may open a new job only under his own name; admins may open for anyone
drop policy if exists r_ins on public.reports;
create policy r_ins on public.reports for insert to authenticated
  with check (public.is_admin() or (public.is_active_user() and data->>'createdBy' = public.my_employee_id()));

-- every change a worker makes to a job is checked here:
--   * vehicle details (plate, customer, model, km): only the worker who opened the job
--   * existing work entries: only the worker who wrote that entry; nothing may be removed or reordered
--   * new work entries: only under the worker's own name (anyone may ADD work to any job)
--   * the change history may only grow, never be rewritten
create or replace function public.guard_report_update() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  my text; n_old int; n_new int; l_old int; i int; o jsonb; nn jsonb;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  my := public.my_employee_id();
  if new.k is distinct from old.k then raise exception 'not_allowed' using errcode = '42501'; end if;
  if (new.data - 'entries' - 'log' - 'updatedAt') is distinct from (old.data - 'entries' - 'log' - 'updatedAt')
     and (old.data->>'createdBy') is distinct from my then
    raise exception 'not_your_report' using errcode = '42501';
  end if;
  n_old := coalesce(jsonb_array_length(old.data->'entries'), 0);
  n_new := coalesce(jsonb_array_length(new.data->'entries'), 0);
  if n_new < n_old then raise exception 'cannot_delete_work' using errcode = '42501'; end if;
  for i in 0 .. n_old - 1 loop
    o := old.data->'entries'->i; nn := new.data->'entries'->i;
    if (nn->>'id') is distinct from (o->>'id') then raise exception 'cannot_delete_work' using errcode = '42501'; end if;
    if (nn->>'workerId') is distinct from (o->>'workerId') then raise exception 'not_your_work' using errcode = '42501'; end if;
    if nn is distinct from o and (o->>'workerId') is distinct from my then
      raise exception 'not_your_work' using errcode = '42501';
    end if;
  end loop;
  for i in n_old .. n_new - 1 loop
    if (new.data->'entries'->i->>'workerId') is distinct from my then raise exception 'not_your_work' using errcode = '42501'; end if;
  end loop;
  l_old := coalesce(jsonb_array_length(old.data->'log'), 0);
  if coalesce(jsonb_array_length(new.data->'log'), 0) < l_old then raise exception 'cannot_change_history' using errcode = '42501'; end if;
  for i in 0 .. l_old - 1 loop
    if (new.data->'log'->i) is distinct from (old.data->'log'->i) then raise exception 'cannot_change_history' using errcode = '42501'; end if;
  end loop;
  return new;
end $$;
drop trigger if exists reports_guard on public.reports;
create trigger reports_guard before update on public.reports for each row execute function public.guard_report_update();

-- users added directly in the Supabase dashboard (Authentication → Users) get a profile automatically:
-- role "worker", name = the part before "@". Change role/name in the app or in Table Editor → profiles.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare nm text := split_part(new.email, '@', 1);
begin
  insert into public.profiles (user_id, email, name, role, employee_id, active)
    values (new.id, new.email, nm, 'worker', 'u-' || new.id, true) on conflict (user_id) do nothing;
  insert into public.employees (k, data)
    values ('u-' || new.id, jsonb_build_object('id', 'u-' || new.id, 'name', nm, 'active', true, 'userId', new.id))
    on conflict (k) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
