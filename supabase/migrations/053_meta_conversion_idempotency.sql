-- Provider-neutral conversion delivery ledger. Stripe webhook claims remain in
-- billing_webhook_events; this table deduplicates each analytics event by its
-- own external business reference.
CREATE TABLE IF NOT EXISTS public.analytics_conversion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('meta')),
  event_name TEXT NOT NULL,
  event_id TEXT NOT NULL,
  external_reference TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'processing'
    CHECK (processing_status IN ('processing','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS analytics_conversion_reference_unique
  ON public.analytics_conversion_events(provider, event_name, external_reference);
CREATE UNIQUE INDEX IF NOT EXISTS analytics_conversion_event_id_unique
  ON public.analytics_conversion_events(provider, event_id);

ALTER TABLE public.analytics_conversion_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.analytics_conversion_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.analytics_conversion_events TO service_role;
