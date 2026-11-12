-- מוסך טארק: הגדרת מסד הנתונים המשותף (Supabase)
-- Each table keeps whole app objects in "data" (jsonb), keyed by "k".
create table if not exists public.reports (k text primary key, data jsonb not null, plate text, updated_at timestamptz default now());
create index if not exists reports_plate_idx on public.reports (plate);
create table if not exists public.vehicles (k text primary key, data jsonb not null, plate text, updated_at timestamptz default now());
create table if not exists public.employees (k text primary key, data jsonb not null, plate text, updated_at timestamptz default now());
create table if not exists public.settings (k text primary key, data jsonb not null, plate text, updated_at timestamptz default now());

-- Only signed-in garage accounts may read or write. Anonymous visitors get nothing.
alter table public.reports enable row level security;
alter table public.vehicles enable row level security;
alter table public.employees enable row level security;
alter table public.settings enable row level security;
create policy staff_all on public.reports for all to authenticated using (true) with check (true);
create policy staff_all on public.vehicles for all to authenticated using (true) with check (true);
create policy staff_all on public.employees for all to authenticated using (true) with check (true);
create policy staff_all on public.settings for all to authenticated using (true) with check (true);

-- Server-side safety net: every previous version of a report is kept, even if overwritten or deleted.
create table if not exists public.reports_history (id bigserial primary key, k text, data jsonb, op text, at timestamptz default now(), by_user uuid default auth.uid());
alter table public.reports_history enable row level security;
create policy staff_read on public.reports_history for select to authenticated using (true);
create or replace function public.log_report() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.reports_history (k, data, op) values (old.k, old.data, tg_op); return null; end $$;
create trigger reports_log after update or delete on public.reports for each row execute function public.log_report();

-- Private file storage for recordings and photos.
insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict (id) do nothing;
create policy staff_media on storage.objects for all to authenticated using (bucket_id = 'media') with check (bucket_id = 'media');
