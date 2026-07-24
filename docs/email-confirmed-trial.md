# Ativação do trial após confirmação de e-mail

O cadastro de autosserviço cria somente um usuário pendente no Supabase Auth.
Conta, perfil, vínculo de proprietário e grant Pro de 14 dias são criados pela
RPC `activate_confirmed_self_service_trial` depois que `/auth/callback` valida
uma sessão cujo usuário possui `email_confirmed_at`.

## Configuração manual do Supabase

1. Em Authentication > Providers > Email, habilite **Confirm email**.
2. Defina a Site URL com a origem canônica do Aunivo.
3. Adicione às Redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://SEU-DOMINIO/auth/callback`
4. Aplique `supabase/migrations/052_confirmed_trial_activation.sql`.
5. Configure `NEXT_PUBLIC_APP_URL` em desenvolvimento, preview e produção.

O template deve usar `{{ .ConfirmationURL }}`. Assunto recomendado:
`Confirme seu acesso ao Aunivo`; botão: `Confirmar e acessar o Aunivo`.
Informe que os 14 dias começam somente após a confirmação.

O fluxo não cria Customer, Checkout ou Subscription no Stripe. A expiração é
avaliada em tempo real pelo grant, independentemente de cron.
