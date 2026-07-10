import type { Metadata } from 'next';
import { PublicShell } from '@/components/public/public-shell';
export const metadata: Metadata = { title: 'Termos de uso' };
export default function TermsPage() {
  return (
    <PublicShell>
      <article className="text-muted-foreground mx-auto max-w-3xl space-y-6 px-4 py-20 leading-7 sm:px-6">
        <h1 className="text-foreground text-4xl font-bold">Termos de uso</h1>
        <p className="text-lg">
          Esta é uma versão inicial dos termos do Aunivo e deve ser revisada
          juridicamente antes do lançamento comercial.
        </p>
        <h2 className="text-foreground text-2xl font-semibold">
          Uso da plataforma
        </h2>
        <p>
          O Aunivo oferece ferramentas de organização comercial, atendimento e
          automação. Cada cliente é responsável pelas informações inseridas,
          pelos usuários convidados e pela utilização de integrações externas.
        </p>
        <h2 className="text-foreground text-2xl font-semibold">
          Conta e segurança
        </h2>
        <p>
          O usuário deve manter suas credenciais protegidas e informar acessos
          indevidos. O proprietário da conta administra membros, permissões e
          cobrança.
        </p>
        <h2 className="text-foreground text-2xl font-semibold">
          Serviços de terceiros
        </h2>
        <p>
          WhatsApp, Meta, Stripe, Supabase e provedores de inteligência
          artificial possuem termos próprios. A disponibilidade das integrações
          pode depender desses serviços.
        </p>
        <h2 className="text-foreground text-2xl font-semibold">
          Planos e cancelamento
        </h2>
        <p>
          Os limites aplicáveis são apresentados na página de planos.
          Assinaturas pagas podem ser gerenciadas pelo Portal de cobrança.
        </p>
        <h2 className="text-foreground text-2xl font-semibold">Contato</h2>
        <p>
          O canal comercial será apresentado quando configurado pelo responsável
          pela operação do Aunivo.
        </p>
      </article>
    </PublicShell>
  );
}
