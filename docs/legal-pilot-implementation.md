# Estrutura jurídica do programa piloto

As rotas públicas são `/termos-de-uso`, `/politica-de-privacidade`, `/politica-de-cookies`, `/programa-piloto` e `/contato`. Dados públicos, vigência e versões ficam exclusivamente em `src/config/legal.ts`.

Os quatro documentos estão na versão `1.0-piloto`. Para uma mudança material, crie nova versão na configuração, atualize o texto e solicite novo aceite; não altere registros antigos. A migration `046_legal_pilot.sql` cria `legal_acceptances` (imutável para usuários) e `pilot_applications` (acesso exclusivo por service role). Inscrições podem ser revisadas no Table Editor do Supabase ou por consulta administrativa com service role; nunca exponha essa tabela em uma API de leitura pública.

O cadastro envia as versões aceitas no metadata do Supabase Auth e o trigger `handle_new_user` registra os aceites junto ao bootstrap da conta. Novos documentos exigem novo tipo permitido, campo versionado e inserção server-side equivalente.

Não publicar CPF, endereço residencial, contrato piloto integral, dados de clientes, documentos privados ou detalhes internos de segurança. Para atualizar os dados públicos, edite somente `src/config/legal.ts`.

O checkout comercial foi bloqueado no Route Handler e os CTAs públicos apontam ao piloto. Para ativar planos pagos futuramente, conclua revisão jurídica, publique termos de assinatura/cancelamento, restaure os CTAs, remova o bloqueio inicial de `src/app/api/billing/checkout/route.ts` e reative a função preservada em `src/components/public/pricing-client.tsx`.

Quando o Aunivo abrir CNPJ, será necessário publicar uma nova versão dos documentos, substituir a identificação da pessoa física pela pessoa jurídica e solicitar novo aceite quando a mudança for material.
