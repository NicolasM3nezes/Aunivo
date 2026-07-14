import type { Metadata } from 'next';
/* eslint-disable react/jsx-key -- each JSX node is tuple content, not a rendered sibling list */
import { LegalPage, type LegalSectionItem } from '@/components/legal/legal-page';
import { PublicShell } from '@/components/public/public-shell';
import { LEGAL_CONTACT, LEGAL_DOCUMENTS } from '@/config/legal';
export const metadata: Metadata={title:'Política de Privacidade | Aunivo',description:'Saiba como o Aunivo coleta, utiliza e protege dados pessoais.',alternates:{canonical:LEGAL_DOCUMENTS.privacyPolicy.route}};
const s: LegalSectionItem[]=[
['objetivo','Objetivo',<p>Explicar de forma transparente como dados pessoais são tratados no Aunivo.</p>],
['responsavel','Quem é o responsável pelo tratamento',<p>O projeto é operado por {LEGAL_CONTACT.responsibleName}, em {LEGAL_CONTACT.location}. O contato indicado é o canal de privacidade e atendimento aos titulares.</p>],
['dados','Dados coletados',<p>Podemos tratar dados de identificação, contato, conta, uso, suporte, segurança e conteúdo inserido na plataforma.</p>],
['cadastro','Dados fornecidos no cadastro',<p>Nome, e-mail e informações necessárias à criação e administração da conta.</p>],
['autenticacao','Dados de autenticação',<p>Identificadores de sessão e dados necessários à autenticação segura são processados com apoio do Supabase.</p>],
['tecnicos','Dados técnicos e registros de acesso',<p>Podem ser tratados data, horário, eventos de segurança, dispositivo e informações técnicas necessárias à prevenção de abuso e diagnóstico.</p>],
['crm','Dados inseridos no CRM',<p>O cliente escolhe e controla as informações comerciais que cadastra no CRM.</p>],
['leads','Dados de contatos e leads cadastrados pelos clientes',<p>O cliente é responsável por possuir base legal adequada para cadastrar e utilizar esses dados.</p>],
['finalidades','Finalidades do tratamento',<p>Autenticar usuários, entregar funcionalidades, prestar suporte, proteger o serviço, melhorar a experiência e cumprir obrigações legais.</p>],
['bases','Bases legais utilizadas',<p>Conforme o contexto, execução de contrato e procedimentos preliminares, legítimo interesse, cumprimento legal, exercício de direitos e consentimento quando aplicável.</p>],
['papeis','Relação entre Aunivo, cliente e titulares',<p>O Aunivo pode ser controlador dos dados da conta do usuário. O cliente pode ser controlador dos dados de seus contatos, e o Aunivo pode atuar como operador ao processá-los conforme instruções do cliente.</p>],
['fornecedores','Compartilhamento com fornecedores',<p>Dados podem ser processados por fornecedores necessários à infraestrutura. O Aunivo não vende dados pessoais nem os compartilha com anunciantes.</p>],
['supabase','Supabase',<p>Utilizado para autenticação, banco de dados e recursos de infraestrutura associados ao serviço.</p>],
['vercel','Vercel',<p>Utilizada para hospedagem e entrega da aplicação, conforme a configuração de implantação.</p>],
['email','Provedor de e-mail utilizado',<p>Mensagens transacionais podem ser entregues pelo provedor configurado no Supabase e pelos serviços de e-mail adotados pelo projeto.</p>],
['stripe','Stripe como infraestrutura futura',<p>A integração técnica poderá apoiar pagamentos no lançamento comercial. O programa piloto não possui cobrança ativa, cartão obrigatório ou renovação automática.</p>],
['internacional','Transferências internacionais',<p>Fornecedores podem processar dados fora do Brasil, com medidas contratuais e técnicas adequadas à legislação aplicável.</p>],
['cookies','Cookies e tecnologias similares',<p>São usados cookies necessários de sessão, segurança, idioma e preferências. Consulte a Política de Cookies.</p>],
['seguranca','Segurança da informação',<p>Adotamos controles de acesso, isolamento por conta e outras medidas proporcionais. Nenhum ambiente é totalmente imune a riscos.</p>],
['retencao','Retenção e exclusão',<p>Os dados serão mantidos pelo período necessário para as finalidades informadas, para cumprimento de obrigações legais, exercício regular de direitos e operação segura do serviço.</p>],
['direitos','Direitos dos titulares',<p>Você pode solicitar confirmação, acesso, correção, anonimização, portabilidade, informação, oposição ou exclusão, conforme os requisitos da LGPD.</p>],
['solicitacao','Como realizar uma solicitação',<p>Envie a solicitação para {LEGAL_CONTACT.privacyEmail}. Poderemos pedir informações proporcionais para confirmar identidade e legitimidade.</p>],
['criancas','Dados de crianças e adolescentes',<p>O serviço é voltado a atividades empresariais e não é direcionado a crianças. Dados dessa natureza não devem ser cadastrados sem base legal e cuidados adequados.</p>],
['alteracoes','Alterações da política',<p>Atualizações materiais poderão ser comunicadas e identificadas por nova versão e vigência.</p>],
['contato','Contato',<p>Canal de privacidade e atendimento aos titulares: {LEGAL_CONTACT.privacyEmail}.</p>],
].map(([id,title,content])=>({id:id as string,title:title as string,content}));
export default function PrivacyPolicyPage(){return <PublicShell><LegalPage title="Política de Privacidade do Aunivo" description="Como tratamos dados pessoais durante o programa piloto." version={LEGAL_DOCUMENTS.privacyPolicy.version} sections={s}/></PublicShell>}
