import type { Metadata } from 'next';
import { PublicShell } from '@/components/public/public-shell';
export const metadata: Metadata = { title: 'Política de privacidade' };
export default function PrivacyPage() {
  return (
    <PublicShell>
      <article className="text-muted-foreground mx-auto max-w-3xl space-y-6 px-4 py-20 leading-7 sm:px-6">
        <h1 className="text-foreground text-4xl font-bold">
          Política de privacidade
        </h1>
        <p className="text-lg">
          Esta é uma política inicial e deve ser revisada juridicamente,
          incluindo os dados reais do controlador, antes do lançamento
          comercial.
        </p>
        <h2 className="text-foreground text-2xl font-semibold">
          Dados tratados
        </h2>
        <p>
          A plataforma pode tratar dados de conta, membros, contatos comerciais,
          conversas, configurações e registros necessários ao funcionamento e à
          segurança do serviço.
        </p>
        <h2 className="text-foreground text-2xl font-semibold">Finalidades</h2>
        <p>
          Os dados são usados para autenticação, entrega dos recursos
          contratados, organização do atendimento, prevenção de abuso, suporte e
          cobrança.
        </p>
        <h2 className="text-foreground text-2xl font-semibold">
          Compartilhamento
        </h2>
        <p>
          Dados podem ser processados por fornecedores necessários à operação,
          como hospedagem, banco, WhatsApp, Stripe e provedores de inteligência
          artificial configurados pelo cliente.
        </p>
        <h2 className="text-foreground text-2xl font-semibold">
          Segurança e retenção
        </h2>
        <p>
          O Aunivo utiliza isolamento por conta, permissões e controles de
          acesso. Prazos de retenção e canais para titulares devem ser definidos
          antes da operação pública.
        </p>
        <h2 className="text-foreground text-2xl font-semibold">Contato</h2>
        <p>
          O canal de privacidade será publicado quando configurado pelo
          responsável legal pelo Aunivo.
        </p>
      </article>
    </PublicShell>
  );
}
