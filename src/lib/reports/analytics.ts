export type ReportPeriod = '7' | '30' | 'month' | '90' | 'all';

export type ReportContact = {
  created_at: string;
  lead_source: string | null;
  is_active: boolean;
};

export type ReportDeal = {
  status: string;
  value: number | null;
  stage_id: string;
  created_at: string;
  updated_at: string | null;
};

export type ReportStage = { id: string; name: string; position: number };

export type ReportData = {
  totalContacts: number;
  newContacts: number;
  open: number;
  won: number;
  lost: number;
  pipelineValue: number;
  conversion: number;
  average: number;
  contactsTimeline: { key: string; label: string; value: number }[];
  stages: { name: string; count: number; value: number }[];
  results: { name: 'Ganhos' | 'Perdas'; value: number }[];
  sources: { name: string; value: number }[];
};

const DAY = 86_400_000;

export function getPeriodStart(period: ReportPeriod, now = new Date()): Date | null {
  if (period === 'all') return null;
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  const days = Number(period);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - days + 1);
  return start;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function createTimeline(contacts: ReportContact[], period: ReportPeriod, now: Date) {
  const activeDates = contacts.map((contact) => new Date(contact.created_at));
  const requestedStart = getPeriodStart(period, now);
  const first = activeDates.length
    ? new Date(Math.min(...activeDates.map((date) => date.getTime())))
    : now;
  const start = requestedStart ?? new Date(first.getFullYear(), first.getMonth(), 1);

  if (period === 'all') {
    const counts = new Map<string, number>();
    for (const date of activeDates) counts.set(monthKey(date), (counts.get(monthKey(date)) ?? 0) + 1);
    const output: { key: string; label: string; value: number }[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cursor <= end) {
      const key = monthKey(cursor);
      output.push({ key, label: cursor.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }), value: counts.get(key) ?? 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return output;
  }

  if (period === '90') {
    const weeks = Math.max(1, Math.ceil((now.getTime() - start.getTime() + DAY) / (7 * DAY)));
    const output = Array.from({ length: weeks }, (_, index) => {
      const date = new Date(start.getTime() + index * 7 * DAY);
      return { key: dateKey(date), label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value: 0 };
    });
    for (const date of activeDates) {
      const index = Math.floor((date.getTime() - start.getTime()) / (7 * DAY));
      if (output[index]) output[index].value += 1;
    }
    return output;
  }

  const counts = new Map<string, number>();
  for (const date of activeDates) counts.set(dateKey(date), (counts.get(dateKey(date)) ?? 0) + 1);
  const output: { key: string; label: string; value: number }[] = [];
  for (const cursor = new Date(start); cursor <= now; cursor.setDate(cursor.getDate() + 1)) {
    const key = dateKey(cursor);
    output.push({ key, label: cursor.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value: counts.get(key) ?? 0 });
  }
  return output;
}

export function buildReport(
  contacts: ReportContact[],
  deals: ReportDeal[],
  stages: ReportStage[],
  period: ReportPeriod,
  now = new Date(),
): ReportData {
  const activeContacts = contacts.filter((contact) => contact.is_active);
  const start = getPeriodStart(period, now);
  const inPeriod = (value: string) => !start || new Date(value) >= start;
  const periodContacts = activeContacts.filter((contact) => inPeriod(contact.created_at));
  const periodDeals = deals.filter((deal) => inPeriod(deal.status === 'won' || deal.status === 'lost' ? deal.updated_at ?? deal.created_at : deal.created_at));
  const won = periodDeals.filter((deal) => deal.status === 'won');
  const lost = periodDeals.filter((deal) => deal.status === 'lost');
  const open = periodDeals.filter((deal) => deal.status === 'open');
  const closed = won.length + lost.length;
  const wonValue = won.reduce((sum, deal) => sum + Number(deal.value ?? 0), 0);

  const sourceCounts = new Map<string, number>();
  for (const contact of periodContacts) {
    const source = contact.lead_source?.trim() || 'Não informado';
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }

  return {
    totalContacts: activeContacts.length,
    newContacts: periodContacts.length,
    open: open.length,
    won: won.length,
    lost: lost.length,
    pipelineValue: open.reduce((sum, deal) => sum + Number(deal.value ?? 0), 0),
    conversion: closed ? won.length / closed : 0,
    average: won.length ? wonValue / won.length : 0,
    contactsTimeline: createTimeline(periodContacts, period, now),
    stages: [...stages].sort((a, b) => a.position - b.position).map((stage) => {
      const rows = periodDeals.filter((deal) => deal.stage_id === stage.id);
      return { name: stage.name, count: rows.length, value: rows.reduce((sum, deal) => sum + Number(deal.value ?? 0), 0) };
    }),
    results: [{ name: 'Ganhos', value: won.length }, { name: 'Perdas', value: lost.length }],
    sources: [...sourceCounts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
  };
}

