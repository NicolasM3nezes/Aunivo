import type { Metadata } from 'next';
import { LegalPage, type LegalSectionItem } from '@/components/legal/legal-page';
import { PublicShell } from '@/components/public/public-shell';
import { LEGAL_CONTACT, LEGAL_DOCUMENTS } from '@/config/legal';

export const metadata: Metadata = { title: 'Termos de Uso | Aunivo', description: 'Consulte as regras de uso do Aunivo durante o programa piloto.', alternates: { canonical: LEGAL_DOCUMENTS.termsOfUse.route } };
const sections: LegalSectionItem[] = [
  { id:'apresentacao', title:'Apresentação e identificação do Aunivo', content:<p>O Aunivo é um projeto de software em fase de validação, desenvolvido e operado por {LEGAL_CONTACT.responsibleName}, com base em {LEGAL_CONTACT.location}.</p> },
  { id:'aceitacao', title:'Aceitação dos Termos', content:<p>Ao criar uma conta ou usar o serviço, você declara que leu e concorda com estes Termos e com os documentos relacionados.</p> },
  { id:'elegibilidade', title:'Elegibilidade e criação da conta', content:<p>O usuário deve possuir capacidade legal e fornecer informações verdadeiras, completas e atualizadas.</p> },
  { id:'credenciais', title:'Responsabilidade pelas credenciais', content:<p>Credenciais são pessoais. O usuário deve protegê-las e comunicar suspeitas de acesso indevido.</p> },
  { id:'servico', title:'Descrição do serviço', content:<p>O Aunivo reúne recursos de CRM, atendimento, organização comercial e automação, conforme disponibilidade durante a validação.</p> },
  { id:'fase-piloto', title:'Fase piloto do produto', content:<p>O piloto dura {LEGAL_CONTACT.pilotDurationDays} dias. Funcionalidades podem ser alteradas, corrigidas, removidas ou ficar temporariamente indisponíveis.</p> },
  { id:'gratuidade', title:'Gratuidade e ausência de cobrança automática', content:<p>O piloto é gratuito, não exige cartão, não gera cobrança nem renovação automática. A continuidade dependerá de nova contratação expressa.</p> },
  { id:'recursos', title:'Recursos disponibilizados', content:<p>Participantes aprovados recebem acesso ao plano Pro ou acesso interno equivalente, sujeito aos limites operacionais informados.</p> },
  { id:'responsabilidades', title:'Responsabilidades do usuário', content:<p>O usuário deve utilizar o serviço de boa-fé, manter dados corretos e cumprir a legislação e as regras das integrações utilizadas.</p> },
  { id:'dados-inseridos', title:'Dados inseridos pelo usuário', content:<p>O usuário responde pela origem lícita e pela base legal dos dados cadastrados, inclusive dados de contatos e leads.</p> },
  { id:'uso-permitido', title:'Uso permitido', content:<p>O serviço pode ser usado para atividades comerciais legítimas, atendimento e organização do relacionamento com clientes.</p> },
  { id:'proibicoes', title:'Condutas proibidas', content:<p>É proibido usar a plataforma para fraude, spam, abuso, violação de direitos, exploração de vulnerabilidades ou qualquer atividade ilícita.</p> },
  { id:'seguranca', title:'Segurança da conta', content:<p>O usuário deve controlar membros e permissões e adotar senhas seguras. Incidentes suspeitos devem ser comunicados ao suporte.</p> },
  { id:'alteracoes-servico', title:'Alterações e atualizações do serviço', content:<p>Durante a validação, o produto pode receber ajustes de interface, limites, integrações e comportamento.</p> },
  { id:'disponibilidade', title:'Disponibilidade e possíveis interrupções', content:<p>Não há garantia de operação ininterrupta. Manutenções, falhas e dependências de terceiros podem causar indisponibilidades.</p> },
  { id:'suporte', title:'Suporte', content:<p>O suporte do piloto é prestado pelo e-mail {LEGAL_CONTACT.supportEmail} e pelos canais indicados na página de contato.</p> },
  { id:'propriedade', title:'Propriedade intelectual', content:<p>Software, marca, interfaces e materiais do Aunivo permanecem protegidos pela legislação aplicável.</p> },
  { id:'conteudos', title:'Conteúdos e dados dos clientes', content:<p>O Aunivo não se torna proprietário dos dados cadastrados pelo cliente. O cliente mantém seus direitos e responsabilidades sobre eles.</p> },
  { id:'terceiros', title:'Integrações e serviços de terceiros', content:<p>Integrações dependem de fornecedores e de seus próprios termos, políticas e disponibilidade.</p> },
  { id:'privacidade', title:'Privacidade e proteção de dados', content:<p>O tratamento de dados pessoais segue a Política de Privacidade e a legislação aplicável, incluindo a LGPD.</p> },
  { id:'encerramento', title:'Suspensão e encerramento de conta', content:<p>O participante pode sair a qualquer momento. O Aunivo pode suspender ou encerrar o piloto por abuso, risco, descumprimento ou decisão operacional, mediante comunicação quando cabível.</p> },
  { id:'limitacoes', title:'Limitações compatíveis com a legislação', content:<p>Responsabilidades serão avaliadas conforme a legislação. Estes Termos não afastam direitos obrigatórios nem responsabilidade que não possa ser legalmente excluída.</p> },
  { id:'alteracao-termos', title:'Alteração dos Termos', content:<p>Mudanças materiais serão comunicadas e poderão exigir novo aceite. A versão e a vigência identificam o texto aplicável.</p> },
  { id:'comunicacoes', title:'Comunicações', content:<p>Comunicações poderão ocorrer pelos dados fornecidos na conta ou pelos canais públicos oficiais.</p> },
  { id:'legislacao', title:'Legislação aplicável', content:<p>Aplicam-se as leis da República Federativa do Brasil, preservados os direitos legais de foro.</p> },
  { id:'contato', title:'Canal de contato', content:<p>Dúvidas podem ser enviadas para {LEGAL_CONTACT.supportEmail}.</p> },
];
export default function TermsOfUsePage(){ return <PublicShell><LegalPage title="Termos de Uso do Aunivo" description="Regras para utilização do Aunivo durante sua fase de validação." version={LEGAL_DOCUMENTS.termsOfUse.version} sections={sections}/></PublicShell> }
