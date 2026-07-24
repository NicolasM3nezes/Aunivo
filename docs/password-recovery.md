# Recuperação de senha

## Configuração do Supabase

Em **Authentication → URL Configuration**:

- defina **Site URL** como a origem canônica do ambiente;
- adicione `http://localhost:3000/auth/callback` em desenvolvimento;
- adicione `http://localhost:3000/auth/redefinir-senha` em desenvolvimento;
- adicione `https://SEU_DOMINIO/auth/callback` em produção;
- adicione `https://SEU_DOMINIO/auth/redefinir-senha` em produção;
- repita a URL para cada ambiente de preview ou homologação que deve aceitar links.

`NEXT_PUBLIC_APP_URL` deve usar a mesma origem, sem barra no final. O callback é
usado por confirmação de cadastro; a rota `redefinir-senha` é o destino público
da recuperação.

Em **Authentication → Email Templates → Reset password**, mantenha o template de
recuperação separado do template **Confirm signup**. O botão do template deve usar
`{{ .ConfirmationURL }}`; não substitua por uma URL de cadastro ou confirmação.

Fluxo esperado:

1. `/forgot-password` chama exclusivamente `resetPasswordForEmail`.
2. O Supabase envia o template **Reset password**.
3. O link retorna a `/auth/redefinir-senha`; o proxy encaminha internamente o
   código PKCE ao callback permitido e volta para a página limpa.
4. O callback cria uma prova curta e de uso único vinculada ao usuário.
5. A nova senha é salva com `updateUser`, a prova é consumida e a sessão
   temporária é encerrada.

Execute a migration `054_password_recovery_sessions.sql` antes de publicar.
