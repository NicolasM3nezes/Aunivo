-- Short-lived, one-time proof that an authenticated session came from a
-- Supabase password recovery link rather than from an ordinary sign-in.
CREATE TABLE public.password_recovery_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX password_recovery_sessions_user_id_idx
  ON public.password_recovery_sessions (user_id);

ALTER TABLE public.password_recovery_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.password_recovery_sessions FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.password_recovery_sessions IS
  'Server-only, hashed and short-lived proofs for one-time password recovery.';
