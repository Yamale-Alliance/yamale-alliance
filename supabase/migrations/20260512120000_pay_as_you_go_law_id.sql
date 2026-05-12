-- Link document (PDF) pay-as-you-go rows to a specific law so unlock state can be restored per user from the server.
alter table public.pay_as_you_go_purchases
  add column if not exists law_id text;

comment on column public.pay_as_you_go_purchases.law_id is
  'For item_type=document: library law id unlocked for export. Null for legacy rows or non-document purchases.';

create index if not exists pay_as_you_go_purchases_user_document_law_idx
  on public.pay_as_you_go_purchases (user_id, item_type, law_id)
  where item_type = 'document' and law_id is not null;
