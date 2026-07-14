-- Public pilot applications and immutable, versioned legal acceptances.
CREATE TABLE public.pilot_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  company_name TEXT CHECK (char_length(company_name) <= 160), email TEXT NOT NULL CHECK (char_length(email) <= 254),
  phone TEXT CHECK (char_length(phone) <= 30), business_segment TEXT NOT NULL CHECK (char_length(business_segment) <= 120),
  approximate_contacts TEXT NOT NULL CHECK (char_length(approximate_contacts) <= 60),
  main_challenge TEXT NOT NULL CHECK (char_length(main_challenge) BETWEEN 10 AND 1500),
  privacy_accepted BOOLEAN NOT NULL CHECK (privacy_accepted), pilot_terms_accepted BOOLEAN NOT NULL CHECK (pilot_terms_accepted),
  legal_document_version TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','contacted','converted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pilot_applications_email_version_unique ON public.pilot_applications (lower(email), legal_document_version);
CREATE INDEX pilot_applications_status_created_idx ON public.pilot_applications(status, created_at DESC);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pilot_applications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.pilot_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pilot_applications FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.pilot_applications TO service_role;

CREATE TABLE public.legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL, document_type TEXT NOT NULL CHECK (document_type IN ('terms_of_use','privacy_policy','pilot_program_terms')),
  document_version TEXT NOT NULL, accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(), source TEXT NOT NULL DEFAULT 'signup',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, document_type, document_version)
);
CREATE INDEX legal_acceptances_user_idx ON public.legal_acceptances(user_id, accepted_at DESC);
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY legal_acceptances_own_read ON public.legal_acceptances FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.legal_acceptances FROM anon, authenticated;
GRANT SELECT ON public.legal_acceptances TO authenticated;
GRANT ALL ON public.legal_acceptances TO service_role;

-- Capture the explicit signup declarations atomically with account bootstrap.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_full_name TEXT := COALESCE(NEW.raw_user_meta_data->>'full_name',''); v_account_id UUID;
BEGIN
  SELECT account_id INTO v_account_id FROM public.profiles WHERE user_id=NEW.id;
  IF v_account_id IS NULL THEN
    SELECT id INTO v_account_id FROM public.accounts WHERE owner_user_id=NEW.id ORDER BY created_at LIMIT 1;
    IF v_account_id IS NULL THEN INSERT INTO public.accounts(name,owner_user_id,default_currency,timezone) VALUES(COALESCE(NULLIF(v_full_name,''),NEW.email,'Minha empresa'),NEW.id,'BRL','America/Sao_Paulo') RETURNING id INTO v_account_id; END IF;
    INSERT INTO public.profiles(user_id,full_name,email,account_id,account_role) VALUES(NEW.id,v_full_name,NEW.email,v_account_id,'owner') ON CONFLICT(user_id) DO UPDATE SET account_id=COALESCE(public.profiles.account_id,EXCLUDED.account_id),account_role=COALESCE(public.profiles.account_role,'owner');
    PERFORM public.ensure_v1_account_defaults(v_account_id);
  END IF;
  IF NEW.raw_user_meta_data->>'legal_terms_accepted'='true' AND NEW.raw_user_meta_data->>'legal_privacy_accepted'='true'
     AND NEW.raw_user_meta_data->>'terms_version'='1.0-piloto' AND NEW.raw_user_meta_data->>'privacy_version'='1.0-piloto' THEN
    INSERT INTO public.legal_acceptances(user_id,account_id,document_type,document_version,source) VALUES
      (NEW.id,v_account_id,'terms_of_use','1.0-piloto','signup'),
      (NEW.id,v_account_id,'privacy_policy','1.0-piloto','signup') ON CONFLICT DO NOTHING;
  ELSE RAISE EXCEPTION 'Required legal acceptances were not provided'; END IF;
  IF NEW.raw_user_meta_data->>'pilot_terms_accepted'='true' AND NEW.raw_user_meta_data->>'pilot_version'='1.0-piloto' THEN
    INSERT INTO public.legal_acceptances(user_id,account_id,document_type,document_version,source) VALUES(NEW.id,v_account_id,'pilot_program_terms','1.0-piloto','signup') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
