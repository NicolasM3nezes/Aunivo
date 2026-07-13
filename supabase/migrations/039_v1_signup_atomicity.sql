-- Make V1 signup atomic. The previous trigger swallowed bootstrap failures,
-- leaving authenticated users without a profile/account.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_account_id UUID;
BEGIN
  SELECT account_id INTO v_account_id FROM public.profiles WHERE user_id = NEW.id;
  IF v_account_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_account_id FROM public.accounts WHERE owner_user_id = NEW.id ORDER BY created_at LIMIT 1;
  IF v_account_id IS NULL THEN
    INSERT INTO public.accounts (name, owner_user_id, default_currency, timezone)
    VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'Minha empresa'), NEW.id, 'BRL', 'America/Sao_Paulo')
    RETURNING id INTO v_account_id;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner')
  ON CONFLICT (user_id) DO UPDATE SET
    account_id = COALESCE(public.profiles.account_id, EXCLUDED.account_id),
    account_role = COALESCE(public.profiles.account_role, 'owner');

  PERFORM public.ensure_v1_account_defaults(v_account_id);
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Repair only authenticated users that have no profile. Existing accounts and
-- memberships are never reassigned.
DO $$
DECLARE
  auth_user RECORD;
  v_account_id UUID;
BEGIN
  FOR auth_user IN
    SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', '') AS full_name
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE p.user_id IS NULL
  LOOP
    SELECT id INTO v_account_id FROM public.accounts WHERE owner_user_id = auth_user.id ORDER BY created_at LIMIT 1;
    IF v_account_id IS NULL THEN
      INSERT INTO public.accounts (name, owner_user_id, default_currency, timezone)
      VALUES (COALESCE(NULLIF(auth_user.full_name, ''), auth_user.email, 'Minha empresa'), auth_user.id, 'BRL', 'America/Sao_Paulo')
      RETURNING id INTO v_account_id;
    END IF;

    INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
    VALUES (auth_user.id, auth_user.full_name, auth_user.email, v_account_id, 'owner')
    ON CONFLICT (user_id) DO NOTHING;
    PERFORM public.ensure_v1_account_defaults(v_account_id);
  END LOOP;
END;
$$;
