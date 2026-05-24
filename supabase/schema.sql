-- ZepRasso Supabase schema
-- À exécuter dans Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'open' check (status in ('draft', 'open', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  owner_name text not null,
  category text default '',
  plate text,
  image_url text,
  description text,
  is_contestant boolean not null default true,
  is_disqualified boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  voter_pseudo text not null,
  aesthetics int not null check (aesthetics between 0 and 10),
  coherence int not null check (coherence between 0 and 10),
  originality int not null check (originality between 0 and 10),
  details int not null check (details between 0 and 10),
  rp_presentation int not null check (rp_presentation between 0 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, vehicle_id, voter_pseudo)
);

alter table events enable row level security;
alter table vehicles enable row level security;
alter table votes enable row level security;

create policy "Public can read events" on events for select using (true);
create policy "Public can read vehicles" on vehicles for select using (true);
create policy "Public can read votes" on votes for select using (true);

-- MVP volontairement permissif pour un outil RP léger.
-- À durcir plus tard avec auth Discord ou auth Supabase.
create policy "Public can insert vehicles" on vehicles for insert with check (true);
create policy "Public can update vehicles" on vehicles for update using (true) with check (true);
create policy "Public can delete vehicles" on vehicles for delete using (true);

create policy "Public can insert votes" on votes for insert with check (true);
create policy "Public can update own pseudo votes" on votes for update using (true) with check (true);
create policy "Public can delete votes" on votes for delete using (true);

insert into events (id, name, status)
values ('00000000-0000-0000-0000-000000000001', 'ZepRasso - Car Meet RP', 'open')
on conflict (id) do nothing;
