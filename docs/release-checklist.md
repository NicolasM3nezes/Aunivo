# Checklist de release da Aunivo V1

## Antes do deploy

- [ ] Confirmar backup do banco e do código.
- [ ] Aplicar migrations até `039_v1_signup_atomicity.sql` em staging, na ordem.
- [ ] Configurar URL, anon key e URLs canônicas; manter segredos futuros vazios.
- [ ] Confirmar HTTPS, URLs de callback do Supabase e remetente de e-mail.
- [ ] Executar `npm test`, `npm run lint`, `npm run typecheck` e `npm run build`.
- [ ] Revisar os avisos do lint e não aceitar erros.

## Testes funcionais em staging

- [ ] Criar conta, confirmar e-mail, entrar, sair e recuperar senha.
- [ ] Confirmar criação automática de conta, perfil, funil e seis etapas.
- [ ] Criar duas organizações e provar que uma não lê nem altera dados da outra.
- [ ] Criar, editar, buscar, filtrar e excluir contato; validar telefone e CSV.
- [ ] Criar etiquetas e notas; definir, alterar e remover follow-up.
- [ ] Criar oportunidade, mover entre etapas e marcar como ganha/perdida.
- [ ] Conferir dashboard e relatórios com banco vazio e com dados.
- [ ] Conferir configurações, tema, planos e estado de billing sem Stripe.
- [ ] Se Stripe estiver ativo, testar checkout, portal e webhook em modo de teste.
- [ ] Abrir rotas e APIs desabilitadas como visitante e como usuário autenticado.
- [ ] Validar landing, cadastro e dashboard em celular, tablet e desktop.
- [ ] Verificar teclado, foco visível, labels, contraste e mensagens em pt-BR.

## Produção e pós-deploy

- [ ] Aplicar migrations uma única vez e registrar o resultado.
- [ ] Fazer smoke test de landing, login, dashboard, contatos, funil e relatórios.
- [ ] Confirmar que nenhuma chamada a Meta, IA ou automações ocorre na V1.
- [ ] Monitorar erros de autenticação, RLS, banco e billing.
- [ ] Manter plano de rollback do app e restauração do banco disponível.

