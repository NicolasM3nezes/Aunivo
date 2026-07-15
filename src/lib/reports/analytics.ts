import {
  getContactSourceLabel,
  normalizeContactSourceKey,
  UNINFORMED_CONTACT_SOURCE_KEY,
  UNINFORMED_CONTACT_SOURCE_LABEL,
} from '@/lib/contacts/source';

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
  pipeline_id: string;
  created_at: string;
  updated_at: string | null;
  contact_id?: string;
};

export type ReportStage = {
  id: string;
  name: string;
  position: number;
  pipeline_id: string;
  pipeline_name: string;
  is_won?: boolean;
  is_lost?: boolean;
};

export type ReportPipeline = {
  id: string;
  name: string;
};

export type ReportData = {
  totalContacts: number;
  newContacts: number;
  open: number;
  won: number;
  lost: number;
  pipelineValue: number;
  conversion: number;
  average: number;

  contactsTimeline: {
    key: string;
    label: string;
    value: number;
  }[];

  stages: {
    key: string;
    name: string;
    label: string;
    pipelineId: string;
    pipelineName: string;
    count: number;
    value: number;
  }[];

  results: {
    name: 'Ganhos' | 'Perdas';
    value: number;
  }[];

  sources: {
    name: string;
    value: number;
  }[];

  sourceSummary: {
    total: number;
    informed: number;
    uninformed: number;
    coverage: number;
    topName: string | null;
    topValue: number;
  };

  pipelineSummary: {
    id: string;
    name: string;
    open: number;
    won: number;
    lost: number;
    value: number;
  }[];
};

const DAY = 86_400_000;
export function normalizeSourceKey(source: string | null | undefined) {
  return normalizeContactSourceKey(source);
}

export function sourceDisplayName(source: string | null | undefined) {
  return getContactSourceLabel(source);
}

export function getPeriodStart(
  period: ReportPeriod,
  now = new Date(),
): Date | null {
  if (period === 'all') return null;

  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const days = Number(period);
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  start.setDate(start.getDate() - days + 1);
  return start;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}`;
}

function isValidDate(date: Date) {
  return Number.isFinite(date.getTime());
}

function isInsidePeriod(
  value: string,
  start: Date | null,
  now: Date,
) {
  const date = new Date(value);

  if (!isValidDate(date)) return false;

  return (
    (!start || date.getTime() >= start.getTime()) &&
    date.getTime() <= now.getTime()
  );
}

function getDealReferenceDate(deal: ReportDeal) {
  if (deal.status === 'won' || deal.status === 'lost') {
    return deal.updated_at ?? deal.created_at;
  }

  return deal.created_at;
}

function createTimeline(
  contacts: ReportContact[],
  period: ReportPeriod,
  now: Date,
) {
  const dates = contacts
    .map((contact) => new Date(contact.created_at))
    .filter(
      (date) =>
        isValidDate(date) && date.getTime() <= now.getTime(),
    );

  const requestedStart = getPeriodStart(period, now);

  const firstDate = dates.length
    ? new Date(Math.min(...dates.map((date) => date.getTime())))
    : now;

  const start =
    requestedStart ??
    new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);

  if (period === 'all') {
    const counts = new Map<string, number>();

    for (const date of dates) {
      const key = monthKey(date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const output: {
      key: string;
      label: string;
      value: number;
    }[] = [];

    const cursor = new Date(
      start.getFullYear(),
      start.getMonth(),
      1,
    );

    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    );

    while (cursor <= end) {
      const key = monthKey(cursor);

      output.push({
        key,
        label: cursor.toLocaleDateString('pt-BR', {
          month: 'short',
          year: '2-digit',
        }),
        value: counts.get(key) ?? 0,
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    return output;
  }

  if (period === '90') {
    const weeks = Math.max(
      1,
      Math.ceil(
        (now.getTime() - start.getTime() + DAY) / (7 * DAY),
      ),
    );

    const output = Array.from(
      { length: weeks },
      (_, index) => {
        const date = new Date(
          start.getTime() + index * 7 * DAY,
        );

        return {
          key: dateKey(date),
          label: date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
          }),
          value: 0,
        };
      },
    );

    for (const date of dates) {
      const index = Math.floor(
        (date.getTime() - start.getTime()) / (7 * DAY),
      );

      if (output[index]) {
        output[index].value += 1;
      }
    }

    return output;
  }

  const counts = new Map<string, number>();

  for (const date of dates) {
    const key = dateKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const output: {
    key: string;
    label: string;
    value: number;
  }[] = [];

  for (
    const cursor = new Date(start);
    cursor <= now;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const key = dateKey(cursor);

    output.push({
      key,
      label: cursor.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }),
      value: counts.get(key) ?? 0,
    });
  }

  return output;
}

export function buildReport(
  contacts: ReportContact[],
  deals: ReportDeal[],
  stages: ReportStage[],
  pipelines: ReportPipeline[],
  period: ReportPeriod,
  now = new Date(),
): ReportData {
  const activeContacts = contacts.filter(
    (contact) => contact.is_active,
  );

  const periodStart = getPeriodStart(period, now);

  const periodContacts = activeContacts.filter((contact) =>
    isInsidePeriod(contact.created_at, periodStart, now),
  );

  const outcomeByStage = new Map(
    stages.map((stage) => [
      stage.id,
      stage.is_won
        ? 'won'
        : stage.is_lost
          ? 'lost'
          : null,
    ]),
  );

  const normalizedDeals = deals.map((deal) => ({
    ...deal,
    status:
      outcomeByStage.get(deal.stage_id) ??
      deal.status?.toLowerCase?.() ??
      'open',
  }));

  const periodDeals = normalizedDeals.filter((deal) =>
    isInsidePeriod(
      getDealReferenceDate(deal),
      periodStart,
      now,
    ),
  );

  const currentOpenDeals = normalizedDeals.filter(
    (deal) => deal.status === 'open',
  );

  const wonDeals = periodDeals.filter(
    (deal) => deal.status === 'won',
  );

  const lostDeals = periodDeals.filter(
    (deal) => deal.status === 'lost',
  );

  const closedCount = wonDeals.length + lostDeals.length;

  const wonValue = wonDeals.reduce(
    (total, deal) => total + Number(deal.value ?? 0),
    0,
  );

  const sourceGroups = new Map<string, { name: string; value: number }>();

  for (const contact of periodContacts) {
    const key = normalizeSourceKey(contact.lead_source);
    const current = sourceGroups.get(key);
    sourceGroups.set(key, {
      name: current?.name ?? sourceDisplayName(contact.lead_source),
      value: (current?.value ?? 0) + 1,
    });
  }

  const sources = [...sourceGroups.values()]
    .sort((first, second) => second.value - first.value);

  const uninformed =
    sourceGroups.get(UNINFORMED_CONTACT_SOURCE_KEY)?.value ?? 0;

  const informed = Math.max(
    0,
    periodContacts.length - uninformed,
  );

  const topSource =
    sources.find((source) => source.name !== UNINFORMED_CONTACT_SOURCE_LABEL) ??
    null;

  const hasMultiplePipelines =
    new Set(stages.map((stage) => stage.pipeline_id)).size > 1;

  const sortedStages = [...stages].sort((first, second) => {
    const pipelineCompare = first.pipeline_name.localeCompare(
      second.pipeline_name,
      'pt-BR',
    );

    if (pipelineCompare !== 0) {
      return pipelineCompare;
    }

    return first.position - second.position;
  });

  const pipelineSummary = pipelines.map((pipeline) => {
    const pipelineDeals = normalizedDeals.filter(
      (deal) => deal.pipeline_id === pipeline.id,
    );

    const pipelinePeriodDeals = periodDeals.filter(
      (deal) => deal.pipeline_id === pipeline.id,
    );

    return {
      id: pipeline.id,
      name: pipeline.name,
      open: pipelineDeals.filter((deal) => deal.status === 'open')
        .length,
      won: pipelinePeriodDeals.filter(
        (deal) => deal.status === 'won',
      ).length,
      lost: pipelinePeriodDeals.filter(
        (deal) => deal.status === 'lost',
      ).length,
      value: pipelineDeals
        .filter((deal) => deal.status === 'open')
        .reduce(
          (total, deal) =>
            total + Number(deal.value ?? 0),
          0,
        ),
    };
  });

  return {
    totalContacts: activeContacts.length,
    newContacts: periodContacts.length,
    open: currentOpenDeals.length,
    won: wonDeals.length,
    lost: lostDeals.length,
    pipelineValue: currentOpenDeals.reduce(
      (total, deal) => total + Number(deal.value ?? 0),
      0,
    ),
    conversion: closedCount
      ? wonDeals.length / closedCount
      : 0,
    average: wonDeals.length
      ? wonValue / wonDeals.length
      : 0,

    contactsTimeline: createTimeline(
      periodContacts,
      period,
      now,
    ),

    stages: sortedStages.map((stage) => {
      const stageDeals = normalizedDeals.filter(
        (deal) => deal.stage_id === stage.id,
      );

      return {
        key: `${stage.pipeline_id}:${stage.id}`,
        name: stage.name,
        label: hasMultiplePipelines
          ? `${stage.pipeline_name} · ${stage.name}`
          : stage.name,
        pipelineId: stage.pipeline_id,
        pipelineName: stage.pipeline_name,
        count: stageDeals.length,
        value: stageDeals.reduce(
          (total, deal) =>
            total + Number(deal.value ?? 0),
          0,
        ),
      };
    }),

    results: [
      {
        name: 'Ganhos',
        value: wonDeals.length,
      },
      {
        name: 'Perdas',
        value: lostDeals.length,
      },
    ],

    sources,

    sourceSummary: {
      total: periodContacts.length,
      informed,
      uninformed,
      coverage: periodContacts.length
        ? informed / periodContacts.length
        : 0,
      topName: topSource?.name ?? null,
      topValue: topSource?.value ?? 0,
    },

    pipelineSummary,
  };
}
