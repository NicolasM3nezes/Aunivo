export const FEATURES = {
  dashboard: true,
  contacts: true,
  pipeline: true,
  multiplePipelines: true,
  followUp: true,
  customerHistory: true,
  tags: true,
  basicReports: true,
  settings: true,
  billing: true,
  support: true,
  whatsapp: false,
  inbox: false,
  conversations: false,
  notifications: true,
  tasks: true,
  ai: false,
  aiAgents: false,
  knowledgeBase: false,
  automations: false,
  campaigns: false,
  broadcasts: false,
  flows: false,
  integrations: false,
  webhooks: false,
  publicApi: false,
  apiKeys: false,
  team: true,
  invitations: true,
  advancedReports: true,
} as const;

const DISABLED_PAGES = ['/inbox','/broadcasts','/automations','/flows','/agents','/conversations','/chats','/whatsapp','/channels','/ai','/knowledge-base','/integrations','/webhooks','/api-keys','/analytics'] as const;
const DISABLED_APIS = ['/api/automations','/api/flows','/api/ai','/api/account/api-keys','/api/account/transfer-ownership','/api/quick-replies','/api/v1','/api/whatsapp'] as const;

const matches = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
export const isV1DisabledPage = (pathname: string) => DISABLED_PAGES.some((prefix) => matches(pathname, prefix));
export const isV1DisabledApi = (pathname: string) => DISABLED_APIS.some((prefix) => matches(pathname, prefix));
export { DISABLED_PAGES, DISABLED_APIS };
