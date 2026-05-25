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

-- Les visiteurs (clé anon) peuvent lire et voter, mais PAS gérer les véhicules
-- ni supprimer des votes : ces actions sont réservées à l'orga authentifié.
-- (drop d'abord pour rendre le script ré-exécutable)
drop policy if exists "Public can insert vehicles" on vehicles;
drop policy if exists "Public can update vehicles" on vehicles;
drop policy if exists "Public can delete vehicles" on vehicles;
drop policy if exists "Public can delete votes" on votes;

create policy "Auth can insert vehicles" on vehicles for insert to authenticated with check (true);
create policy "Auth can update vehicles" on vehicles for update to authenticated using (true) with check (true);
create policy "Auth can delete vehicles" on vehicles for delete to authenticated using (true);

create policy "Public can insert votes" on votes for insert with check (true);
create policy "Public can update own pseudo votes" on votes for update using (true) with check (true);
create policy "Auth can delete votes" on votes for delete to authenticated using (true);

insert into events (id, name, status)
values ('00000000-0000-0000-0000-000000000001', 'ZepRasso - Car Meet RP', 'open')
on conflict (id) do nothing;

-- Stockage des photos de véhicules.
insert into storage.buckets (id, name, public)
values ('vehicle-photos', 'vehicle-photos', true)
on conflict (id) do nothing;

-- Lecture publique des photos ; upload réservé à l'orga authentifié.
create policy "Public read vehicle photos"
  on storage.objects for select
  using (bucket_id = 'vehicle-photos');

create policy "Auth upload vehicle photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'vehicle-photos');

-- Configuration Auth (dashboard, une seule fois) :
-- 1. Authentication > Providers > Email : activé (par défaut).
-- 2. Authentication > Sign In / Providers (ou Settings) : DÉSACTIVER
--    "Allow new users to sign up" pour que seuls les comptes créés à la
--    main puissent gérer les véhicules.
-- 3. Authentication > Users > Add user : ajouter l'e-mail de l'orga.
-- 4. Authentication > Emails > Magic Link : ajouter le code {{ .Token }}
--    dans le template pour recevoir un code à 6 chiffres par e-mail.
