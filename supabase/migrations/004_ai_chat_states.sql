-- Store AI chat history per user as a single JSON blob
create table if not exists public.ai_chat_states (
  user_id text primary key,
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.ai_chat_states is 'Per-user AI chat history for AI Legal Research';
comment on column public.ai_chat_states.data is 'Array of chat sessions (id, title, messages, updatedAt)';

create index if not exists idx_ai_chat_states_updated_at
  on public.ai_chat_states (updated_at desc);

