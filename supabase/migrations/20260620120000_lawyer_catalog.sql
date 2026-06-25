-- Lawyer directory catalog: admin-managed practice areas and languages.

create table if not exists public.lawyer_practice_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint lawyer_practice_areas_name_unique unique (name)
);

create table if not exists public.lawyer_language_options (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint lawyer_language_options_name_unique unique (name)
);

create index if not exists lawyer_practice_areas_sort_order_idx
  on public.lawyer_practice_areas (sort_order, name);

create index if not exists lawyer_language_options_sort_order_idx
  on public.lawyer_language_options (sort_order, name);

-- Seed defaults (idempotent).
insert into public.lawyer_practice_areas (name, sort_order)
values
  ('AfCFTA', 10),
  ('Arbitration', 20),
  ('Banking', 30),
  ('Civil And Tort Law', 40),
  ('Civil Litigation', 50),
  ('Commercial Litigation', 60),
  ('Corporate Law', 70),
  ('Dispute Resolution', 80),
  ('Employment Law', 90),
  ('Finance', 100),
  ('Immigration & Refugee Law', 110),
  ('Infrastructure And Projects', 120),
  ('Intellectual Property Law', 130),
  ('International Trade Law', 140),
  ('Land And Property Law', 150),
  ('Mergers and Acquisitions', 160),
  ('Public Private Partnerships', 170),
  ('Tax Law', 180)
on conflict (name) do nothing;

insert into public.lawyer_language_options (name, sort_order)
values
  ('English', 10),
  ('French', 20),
  ('Arabic', 30),
  ('Portuguese', 40),
  ('Swahili', 50),
  ('Kinyarwanda', 60),
  ('Yoruba', 70),
  ('Wolof', 80),
  ('Twi', 90)
on conflict (name) do nothing;
