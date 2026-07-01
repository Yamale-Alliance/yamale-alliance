-- Admin panel security settings: configurable MFA step-up idle timeout.
-- Single-row table (id = 'main'), managed server-side via the service role.

create table if not exists public.admin_security_settings (
  id text primary key default 'main',
  -- Idle timeout in seconds before the admin MFA step-up expires.
  -- NULL means "never expire on inactivity" (explicit opt-in; shows a security warning in the UI).
  mfa_idle_timeout_sec integer,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint admin_security_settings_singleton check (id = 'main')
);

-- Seed the single row with the secure default (30 minutes) if it does not exist yet.
insert into public.admin_security_settings (id, mfa_idle_timeout_sec)
values ('main', 1800)
on conflict (id) do nothing;
