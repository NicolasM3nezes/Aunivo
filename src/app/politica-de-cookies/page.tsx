import type { Metadata } from 'next';
import { LegalPage, type LegalSectionItem } from '@/components/legal/legal-page';
import { PublicShell } from '@/components/public/public-shell';
import { LEGAL_CONTACT, LEGAL_DOCUMENTS } from '@/config/legal';
export const metadata:Metadata={title:'Política de Cookies | Aunivo',description:'Entenda como o Aunivo utiliza cookies necessários e tecnologias semelhantes.',alternates:{canonical:LEGAL_DOCUMENTS.cookiePolicy.route}};
const sections:LegalSectionItem[]=[
  {id:'conceito',title:'O que são cookies',content:<p>Cookies são pequenos registros armazenados pelo navegador para manter sessões e preferências.</p>},
  {id:'uso',title:'Como o Aunivo utiliza cookies',content:<p>Usamos tecnologias estritamente necessárias à operação, segurança e preferências da aplicação.</p>},
  {id:'necessarios',title:'Cookies estritamente necessários',content:<p>Esses cookies viabilizam funções essenciais e não podem ser desativados sem comprometer o funcionamento.</p>},
  {id:'sessao',title:'Cookies de autenticação e sessão',content:<p>O Supabase utiliza cookies para manter o login, renovar sessões e reconhecer o usuário autenticado.</p>},
  {id:'seguranca',title:'Cookies de segurança',content:<p>Registros necessários ajudam a prevenir abuso e proteger a sessão.</p>},
  {id:'preferencias',title:'Preferências',content:<p>Idioma e tema visual podem ser mantidos no navegador para respeitar escolhas do usuário.</p>},
  {id:'analytics',title:'Analytics',content:<p>Atualmente o Aunivo não utiliza Google Analytics ou outra ferramenta de analytics não essencial.</p>},
  {id:'marketing',title:'Marketing',content:<p>Atualmente não utilizamos Meta Pixel nem cookies de publicidade ou marketing.</p>},
  {id:'terceiros',title:'Serviços de terceiros',content:<p>Supabase e a infraestrutura de hospedagem podem processar dados técnicos necessários à entrega e segurança do serviço.</p>},
  {id:'gerenciar',title:'Como gerenciar cookies',content:<p>Você pode remover cookies nas configurações do navegador. A remoção dos necessários pode encerrar a sessão ou impedir recursos essenciais.</p>},
  {id:'atualizacoes',title:'Atualizações',content:<p>Se forem adicionadas tecnologias não essenciais, esta política e os controles de consentimento serão atualizados antes da ativação.</p>},
  {id:'contato',title:'Contato',content:<p>Dúvidas: {LEGAL_CONTACT.privacyEmail}.</p>},
];
export default function CookiePolicyPage(){return <PublicShell><LegalPage title="Política de Cookies do Aunivo" description="Informações sobre cookies necessários, sessão, segurança e preferências." version={LEGAL_DOCUMENTS.cookiePolicy.version} sections={sections}/></PublicShell>}
