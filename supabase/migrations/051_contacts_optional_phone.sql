-- Contacts can exist before a phone number is known. NULL also avoids
-- collisions in the existing per-account normalized-phone unique index.
ALTER TABLE public.contacts
  ALTER COLUMN phone DROP NOT NULL;
