-- מוסך טארק: כל עבודה / חילוץ / הזמנת חלק חדשה שולחת התראה פעם אחת לכל המנהלים
create table if not exists public.notify_sent (k text primary key, at timestamptz default now());
alter table public.notify_sent enable row level security;   -- written only by the server function
