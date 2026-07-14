alter table public.contacts
add column if not exists lead_source text;

create index if not exists contacts_account_lead_source_idx
on public.contacts (account_id, lead_source);

comment on column public.contacts.lead_source is
'Origem comercial do contato, como WhatsApp, Instagram, Google ou indicação.';