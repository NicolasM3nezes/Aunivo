# Acesso piloto e interno

## Deploy

Aplique as migrations em ordem:

1. `044_internal_access_overrides.sql`
2. `045_account_access_grants.sql`

A migration 045 cria `public.account_access_grants`, RLS sem policies para o
browser, índices, constraints e as funções SQL usadas pelos limites e pelo
proxy. Ela não concede acesso a nenhuma conta.

## Localizar uma conta

```sql
SELECT a.id AS account_id, a.name, p.email AS owner_email
FROM public.accounts a
LEFT JOIN public.profiles p ON p.user_id = a.owner_user_id
WHERE p.email = 'cliente@exemplo.com';
```

## Conceder 30 dias de Pro piloto

```powershell
npm run billing:grant-pilot -- --account-id=UUID_DA_CONTA --days=30 --reason="Cliente piloto inicial"
```

O comando confirma a conta, recusa grant ou Stripe ativos, cria apenas o grant
Pro e marca `account_billing.trial_used_at`. Nenhum Customer ou Subscription é
criado no Stripe.

## Listar e revogar

```powershell
npm run billing:list-grants -- --account-id=UUID_DA_CONTA
npm run billing:revoke-grant -- --account-id=UUID_DA_CONTA
```

## Conta interna do fundador

Execute separadamente, depois da migration 045. Este SQL não faz parte da
migration e concede acesso somente ao account_id indicado:

```sql
DO $$
DECLARE
  target_account_id UUID := 'c2ae6e58-c129-44fc-8080-af4ea776e5fe';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.accounts WHERE id = target_account_id) THEN
    RAISE EXCEPTION 'account not found: %', target_account_id;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.account_access_grants
    WHERE account_id = target_account_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'account already has an active access grant';
  END IF;

  INSERT INTO public.account_access_grants (
    account_id, grant_type, plan_key, status, starts_at, expires_at, reason
  ) VALUES (
    target_account_id, 'internal', 'pro', 'active', NOW(), NULL,
    'Conta interna do fundador'
  );
END $$;
```
