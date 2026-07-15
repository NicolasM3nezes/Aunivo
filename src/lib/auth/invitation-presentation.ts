export const INVITE_EXPIRATION_OPTIONS = [
  { value: 1, labelKey: 'days1' },
  { value: 3, labelKey: 'days3' },
  { value: 7, labelKey: 'days7' },
  { value: 14, labelKey: 'days14' },
  { value: 30, labelKey: 'days30' },
] as const;

export function formatInvitationExpiryDate(value: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(typeof value === 'string' ? new Date(value) : value);
}

