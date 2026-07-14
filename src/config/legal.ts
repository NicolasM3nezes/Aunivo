export const LEGAL_CONTACT = {
  projectName: 'Aunivo',
  responsibleName: 'Nicolas Gustavo Seabra Menezes',
  location: 'Guarulhos/SP',
  supportEmail: 'zaplead00@gmail.com',
  privacyEmail: 'zaplead00@gmail.com',
  whatsappDisplay: '+55 (11) 99465-0604',
  whatsappNumber: '5511994650604',
  pilotCapacity: 10,
  pilotDurationDays: 30,
  effectiveDate: '14 de julho de 2026',
} as const;

export const LEGAL_DOCUMENTS = {
  termsOfUse: { version: '1.0-piloto', route: '/termos-de-uso' },
  privacyPolicy: { version: '1.0-piloto', route: '/politica-de-privacidade' },
  cookiePolicy: { version: '1.0-piloto', route: '/politica-de-cookies' },
  pilotProgram: { version: '1.0-piloto', route: '/programa-piloto' },
} as const;

export const LEGAL_ROUTES = {
  ...LEGAL_DOCUMENTS,
  contact: { route: '/contato' },
} as const;

export const PILOT_APPLICATION_LIMITS = {
  fullName: 120, companyName: 160, email: 254, phone: 30,
  businessSegment: 120, approximateContacts: 60, mainChallenge: 1500,
} as const;
