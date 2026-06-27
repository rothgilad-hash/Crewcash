-- CrewCash - Supabase Schema
-- הרץ את הקוד הזה ב-SQL Editor של Supabase

create extension if not exists "pgcrypto";

-- Trips
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year integer not null,
  destination text,
  start_date date,
  end_date date,
  invite_token text unique default encode(gen_random_bytes(4), 'hex'),
  admin_token text unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz default now()
);

-- Participants
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete cascade not null,
  name text not null,
  is_gil boolean default false,
  created_at timestamptz default now()
);

-- Expenses
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete cascade not null,
  description text not null,
  amount numeric(10,2) not null,
  currency text default 'EUR',
  category text not null default 'other',
  paid_by uuid references public.participants(id) on delete set null,
  is_yacht_cost boolean default false,
  is_cash boolean default false,
  notes text,
  created_at timestamptz default now()
);

-- Shopping items
create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete cascade not null,
  name text not null,
  quantity text,
  category text default 'other',
  checked boolean default false,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.trips enable row level security;
alter table public.participants enable row level security;
alter table public.expenses enable row level security;
alter table public.shopping_items enable row level security;

-- Allow all operations (access controlled via tokens in app)
create policy "Public access" on public.trips for all using (true) with check (true);
create policy "Public access" on public.participants for all using (true) with check (true);
create policy "Public access" on public.expenses for all using (true) with check (true);
create policy "Public access" on public.shopping_items for all using (true) with check (true);

-- Enable realtime
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.shopping_items;
