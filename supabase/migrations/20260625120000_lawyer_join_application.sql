-- Extended lawyer directory applications: profile fields + verification documents.

alter table public.lawyers
  add column if not exists professional_title text,
  add column if not exists firm_name text,
  add column if not exists office_address text,
  add column if not exists practice_country text,
  add column if not exists practice_city text,
  add column if not exists years_experience integer,
  add column if not exists bar_admission_date text,
  add column if not exists jurisdiction text,
  add column if not exists primary_degree text,
  add column if not exists law_school text,
  add column if not exists additional_degree text,
  add column if not exists additional_institution text,
  add column if not exists declaration_accepted_at timestamptz;

create table if not exists public.lawyer_directory_documents (
  id uuid primary key default gen_random_uuid(),
  lawyer_id uuid not null references public.lawyers(id) on delete cascade,
  document_type text not null,
  storage_path text not null,
  file_name text not null,
  content_type text not null,
  created_at timestamptz not null default now(),
  constraint lawyer_directory_documents_lawyer_type_unique unique (lawyer_id, document_type)
);

create index if not exists lawyer_directory_documents_lawyer_id_idx
  on public.lawyer_directory_documents (lawyer_id);
