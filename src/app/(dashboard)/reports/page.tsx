'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  BarChart3,
  BriefcaseBusiness,
  CircleDollarSign,
  ContactRound,
  Filter,
  GitBranch,
  Megaphone,
  RefreshCw,
  Target,
  TrendingDown,
  Trophy,
  Users,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { normalizeError } from '@/lib/errors/normalize-error';
import { formatCurrencyDetailed } from '@/lib/currency';
import { getSourceColor } from '@/lib/reports/source-colors';

import { MetricCard } from '@/components/dashboard/metric-card';
import {
  Skeleton,
  SkeletonCard,
} from '@/components/dashboard/skeleton';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

import { Button } from '@/components/ui/button';

import {
  buildReport,
  type ReportContact,
  type ReportData,
  type ReportDeal,
  type ReportPeriod,
  type ReportPipeline,
  type ReportStage,
} from '@/lib/reports/analytics';

const ALL_PIPELINES = 'all';

const integer = new Intl.NumberFormat('pt-BR');

const percent = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  '7': 'Últimos 7 dias',
  '30': 'Últimos 30 dias',
  month: 'Este mês',
  '90': 'Últimos 3 meses',
  all: 'Todo o período',
};

const tooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
  color: 'var(--popover-foreground)',
  boxShadow: 'var(--shadow-md)',
};

type PipelineRow = {
  id: string;
  name: string;
};

type StageRow = {
  id: string;
  name: string;
  position: number;
  pipeline_id: string;
};

type StageOutcomeRow = {
  id: string;
  is_won: boolean | null;
  is_lost: boolean | null;
};

type SourceChartItem = {
  name: string;
  value: number;
  color: string;
};

interface SourceTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: SourceChartItem }>;
}

function formatContactCount(value: number) {
  return `${integer.format(value)} ${value === 1 ? 'contato' : 'contatos'}`;
}

function SourceTooltip({ active, payload }: SourceTooltipProps) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: item.color }}
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-popover-foreground">
          {item.name}
        </p>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {formatContactCount(item.value)}
      </p>
    </div>
  );
}

export default function ReportsPage() {
  const {
    accountId,
    profileLoading,
    defaultCurrency,
  } = useAuth();

  const [period, setPeriod] =
    useState<ReportPeriod>('30');

  const [pipelineFilter, setPipelineFilter] =
    useState<string>(ALL_PIPELINES);

  const [pipelines, setPipelines] =
    useState<PipelineRow[]>([]);

  const [report, setReport] =
    useState<ReportData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  const load = useCallback(async () => {
    if (!accountId) return;

    setLoading(true);
    setError(false);

    try {
      const db = createClient();

      const pipelinesResult = await db
        .from('pipelines')
        .select('id,name')
        .eq('account_id', accountId)
        .order('created_at', {
          ascending: true,
        });

      if (pipelinesResult.error) {
        throw pipelinesResult.error;
      }

      const availablePipelines =
        (pipelinesResult.data ?? []) as PipelineRow[];

      setPipelines(availablePipelines);

      const validSelectedPipeline =
        pipelineFilter !== ALL_PIPELINES &&
        availablePipelines.some(
          (pipeline) => pipeline.id === pipelineFilter,
        );

      const selectedPipelineId =
        validSelectedPipeline
          ? pipelineFilter
          : null;

      const selectedPipelines =
        selectedPipelineId
          ? availablePipelines.filter(
              (pipeline) =>
                pipeline.id === selectedPipelineId,
            )
          : availablePipelines;

      if (
        pipelineFilter !== ALL_PIPELINES &&
        !validSelectedPipeline
      ) {
        setPipelineFilter(ALL_PIPELINES);
      }

      const contactsQuery = db
        .from('contacts')
        .select('id,created_at')
        .eq('account_id', accountId);

      const contactCrmQuery = db
        .from('contacts')
        .select('id,lead_source,is_active')
        .eq('account_id', accountId);

      let dealsQuery = db
        .from('deals')
        .select(
          'status,value,stage_id,pipeline_id,contact_id,created_at,updated_at',
        )
        .eq('account_id', accountId);

      if (selectedPipelineId) {
        dealsQuery = dealsQuery.eq(
          'pipeline_id',
          selectedPipelineId,
        );
      }

      const pipelineIds = selectedPipelines.map(
        (pipeline) => pipeline.id,
      );

      const stagesQuery =
        pipelineIds.length > 0
          ? db
              .from('pipeline_stages')
              .select(
                'id,name,position,pipeline_id',
              )
              .in('pipeline_id', pipelineIds)
              .order('pipeline_id', {
                ascending: true,
              })
              .order('position', {
                ascending: true,
              })
          : Promise.resolve({
              data: [],
              error: null,
            });

      const stageOutcomeQuery =
        pipelineIds.length > 0
          ? db
              .from('pipeline_stages')
              .select('id,is_won,is_lost')
              .in('pipeline_id', pipelineIds)
          : Promise.resolve({
              data: [],
              error: null,
            });

      const [
        contactsResult,
        contactCrmResult,
        dealsResult,
        stagesResult,
        stageOutcomeResult,
      ] = await Promise.all([
        contactsQuery,
        contactCrmQuery,
        dealsQuery,
        stagesQuery,
        stageOutcomeQuery,
      ]);

      if (
        contactsResult.error ||
        dealsResult.error ||
        stagesResult.error
      ) {
        throw (
          contactsResult.error ??
          dealsResult.error ??
          stagesResult.error
        );
      }

      if (contactCrmResult.error) {
        const optionalError = normalizeError(
          contactCrmResult.error,
        );

        console.warn(
          '[reports] Campos CRM opcionais indisponíveis.',
          {
            code: optionalError.code,
            message: optionalError.message,
          },
        );
      }

      if (stageOutcomeResult.error) {
        const optionalError = normalizeError(
          stageOutcomeResult.error,
        );

        console.warn(
          '[reports] Classificação de etapas indisponível.',
          {
            code: optionalError.code,
            message: optionalError.message,
          },
        );
      }

      const crmById = new Map(
        (contactCrmResult.data ?? []).map((row) => [
          row.id,
          row,
        ]),
      );

      const contacts = (
        contactsResult.data ?? []
      ).map((row) => ({
        id: row.id,
        created_at: row.created_at,
        lead_source:
          crmById.get(row.id)?.lead_source ?? null,
        is_active:
          crmById.get(row.id)?.is_active ?? true,
      }));

      const outcomes = new Map(
        (
          (stageOutcomeResult.data ??
            []) as StageOutcomeRow[]
        ).map((row) => [row.id, row]),
      );

      const pipelineNameById = new Map(
        availablePipelines.map((pipeline) => [
          pipeline.id,
          pipeline.name,
        ]),
      );

      const reportStages = (
        (stagesResult.data ?? []) as StageRow[]
      ).map((stage) => {
        const outcome = outcomes.get(stage.id);

        return {
          id: stage.id,
          name: stage.name,
          position: stage.position,
          pipeline_id: stage.pipeline_id,
          pipeline_name:
            pipelineNameById.get(stage.pipeline_id) ??
            'Funil',
          is_won: outcome?.is_won ?? false,
          is_lost: outcome?.is_lost ?? false,
        };
      });

      const reportDeals = (dealsResult.data ?? []) as ReportDeal[];
      const selectedContactIds = selectedPipelineId
        ? new Set(reportDeals.map((deal) => deal.contact_id).filter(Boolean))
        : null;
      const reportContacts = selectedContactIds
        ? contacts.filter((contact) => selectedContactIds.has(contact.id))
        : contacts;

      setReport(
        buildReport(
          reportContacts as ReportContact[],
          reportDeals,
          reportStages as ReportStage[],
          selectedPipelines as ReportPipeline[],
          period,
        ),
      );
    } catch (caught) {
      const normalized =
        normalizeError(caught);

      console.error(
        '[reports] Falha ao carregar',
        {
          message: normalized.message,
          code: normalized.code,
          details: normalized.details,
          hint: normalized.hint,
        },
      );

      setError(true);
    } finally {
      setLoading(false);
    }
  }, [
    accountId,
    period,
    pipelineFilter,
  ]);

  useEffect(() => {
    if (profileLoading) return;

    if (!accountId) {
      setLoading(false);
      setError(true);
      return;
    }

    void load();
  }, [
    profileLoading,
    accountId,
    load,
  ]);

  const selectedPipelineLabel =
    pipelineFilter === ALL_PIPELINES
      ? 'Todos os funis'
      : pipelines.find(
          (pipeline) =>
            pipeline.id === pipelineFilter,
        )?.name ?? 'Todos os funis';

  const sourcePieData = useMemo(() => {
    if (!report) return [];

    const topSources = report.sources.slice(0, 5);
    const otherValue = report.sources
      .slice(5)
      .reduce(
        (total, source) =>
          total + source.value,
        0,
      );

    const groupedSources = otherValue > 0
      ? [
          ...topSources,
          {
            name: 'Outras',
            value: otherValue,
          },
        ]
      : topSources;

    return groupedSources.map((source) => ({
      ...source,
      color: getSourceColor(source.name),
    }));
  }, [report]);

  const sourceBarData = useMemo(
    () =>
      (report?.sources.slice(0, 8) ?? []).map((source) => ({
        ...source,
        color: getSourceColor(source.name),
      })),
    [report],
  );

  const cards = report
    ? [
        [
          'Total de contatos',
          integer.format(report.totalContacts),
          Users,
          'Contatos ativos na sua base',
        ],
        [
          'Novos no período',
          integer.format(report.newContacts),
          ContactRound,
          'Cadastros no intervalo selecionado',
        ],
        [
          'Oportunidades abertas',
          integer.format(report.open),
          BriefcaseBusiness,
          selectedPipelineLabel,
        ],
        [
          'Valor em negociação',
          formatCurrencyDetailed(
            report.pipelineValue,
            defaultCurrency,
          ),
          CircleDollarSign,
          'Soma das oportunidades abertas',
        ],
        [
          'Negócios ganhos',
          integer.format(report.won),
          Trophy,
          'Finalizados como ganhos no período',
        ],
        [
          'Negócios perdidos',
          integer.format(report.lost),
          TrendingDown,
          'Finalizados como perdidos no período',
        ],
        [
          'Taxa de conversão',
          percent.format(report.conversion),
          Target,
          'Ganhos entre negócios finalizados',
        ],
        [
          'Ticket médio',
          formatCurrencyDetailed(
            report.average,
            defaultCurrency,
          ),
          BarChart3,
          'Valor médio dos negócios ganhos',
        ],
      ] as const
    : [];

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="text-sm font-medium text-primary">
            Desempenho comercial
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Relatórios
          </h1>

          <p className="mt-1 text-muted-foreground">
            Analise os resultados por período, funil e
            origem dos contatos.
          </p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:min-w-[520px]">
          <div>
            <label
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
              htmlFor="report-pipeline"
            >
              Funil
            </label>

            <Select
  value={pipelineFilter}
  onValueChange={(value) => value && setPipelineFilter(value)}
>
  <SelectTrigger id="report-pipeline">
    <GitBranch className="size-4 shrink-0 text-muted-foreground" />

    <span className="min-w-0 flex-1 truncate text-left">
      {selectedPipelineLabel}
    </span>
  </SelectTrigger>

  <SelectContent>
    <SelectItem value={ALL_PIPELINES}>
      Todos os funis
    </SelectItem>

    {pipelines.map((pipeline) => (
      <SelectItem
        key={pipeline.id}
        value={pipeline.id}
      >
        {pipeline.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
          </div>

          <div>
            <label
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
              htmlFor="report-period"
            >
              Período
            </label>

            <div className="flex gap-2">
              <Select
  value={period}
  onValueChange={(value) =>
    setPeriod(value as ReportPeriod)
  }
>
  <SelectTrigger
    id="report-period"
    className="flex-1"
  >
    <Filter className="size-4 shrink-0 text-muted-foreground" />

    <span className="min-w-0 flex-1 truncate text-left">
      {PERIOD_LABELS[period]}
    </span>
  </SelectTrigger>

  <SelectContent>
    <SelectItem value="7">
      Últimos 7 dias
    </SelectItem>

    <SelectItem value="30">
      Últimos 30 dias
    </SelectItem>

    <SelectItem value="month">
      Este mês
    </SelectItem>

    <SelectItem value="90">
      Últimos 3 meses
    </SelectItem>

    <SelectItem value="all">
      Todo o período
    </SelectItem>
  </SelectContent>
</Select>

              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Atualizar relatórios"
                disabled={loading}
                onClick={() => void load()}
              >
                <RefreshCw
                  className={
                    loading
                      ? 'size-4 animate-spin'
                      : 'size-4'
                  }
                />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <strong className="font-medium text-foreground">
          Filtro atual:
        </strong>{' '}
        {selectedPipelineLabel} ·{' '}
        {PERIOD_LABELS[period]}. Os indicadores de
        contatos e origem consideram toda a conta; os
        indicadores de negociações respeitam o funil
        selecionado.
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5"
        >
          <p className="font-medium">
            Não foi possível carregar os relatórios.
          </p>

          <Button
            className="mt-3"
            variant="outline"
            onClick={() => void load()}
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {loading ? <ReportsSkeleton /> : null}

      {!loading && !error && report ? (
        <>
          <section
            aria-label="Indicadores comerciais"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {cards.map(
              ([title, value, Icon, subtitle]) => (
                <MetricCard
                  key={title}
                  title={title}
                  value={value}
                  icon={Icon}
                  subtitle={subtitle}
                />
              ),
            )}
          </section>

          <section className="grid gap-4 xl:grid-cols-5">
            <ChartCard
              className="xl:col-span-3"
              title="Evolução de contatos"
              description="Novos contatos cadastrados no período selecionado."
            >
              {report.contactsTimeline.some(
                (point) => point.value > 0,
              ) ? (
                <ResponsiveContainer
                  width="100%"
                  height={300}
                >
                  <AreaChart
                    data={report.contactsTimeline}
                    margin={{
                      top: 12,
                      right: 12,
                      left: -18,
                      bottom: 0,
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="contacts-fill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="var(--chart-1)"
                          stopOpacity={0.3}
                        />

                        <stop
                          offset="95%"
                          stopColor="var(--chart-1)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>

                    <CartesianGrid
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="label"
                      tick={{
                        fill:
                          'var(--muted-foreground)',
                        fontSize: 11,
                      }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={24}
                    />

                    <YAxis
                      allowDecimals={false}
                      tick={{
                        fill:
                          'var(--muted-foreground)',
                        fontSize: 11,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />

                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => [
                        integer.format(Number(value)),
                        'Novos contatos',
                      ]}
                    />

                    <Area
                      type="monotone"
                      dataKey="value"
                      name="Novos contatos"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      fill="url(#contacts-fill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="Ainda não existem novos contatos neste período." />
              )}
            </ChartCard>

            <ChartCard
              className="xl:col-span-2"
              title="Resultados das negociações"
              description={`Ganhos e perdas em ${selectedPipelineLabel.toLowerCase()}.`}
            >
              {report.results.some(
                (item) => item.value > 0,
              ) ? (
                <ResponsiveContainer
                  width="100%"
                  height={300}
                >
                  <PieChart>
                    <Pie
                      data={report.results}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={66}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {report.results.map(
                        (item, index) => (
                          <Cell
                            key={item.name}
                            fill={`var(--chart-${
                              index + 1
                            })`}
                          />
                        ),
                      )}
                    </Pie>

                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) =>
                        integer.format(Number(value))
                      }
                    />

                    <Legend
                      formatter={(value) => (
                        <span className="text-sm text-foreground">
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart message="Ainda não há negociações finalizadas neste filtro." />
              )}
            </ChartCard>
          </section>

          <section className="space-y-4">
            <SectionHeading
              icon={Megaphone}
              title="Origem dos leads"
              description={`Aquisição de contatos em ${PERIOD_LABELS[
                period
              ].toLowerCase()}.`}
            />

            <div className="grid gap-4 xl:grid-cols-5">
              <ChartCard
                className="xl:col-span-3"
                title="Contatos por origem"
                description="Canais que mais trouxeram contatos para a sua empresa."
              >
                {report.sources.some(
                  (source) => source.value > 0,
                ) ? (
                  <ResponsiveContainer
                    width="100%"
                    height={330}
                  >
                    <BarChart
                      data={sourceBarData}
                      layout="vertical"
                      margin={{
                        top: 8,
                        right: 18,
                        left: 18,
                        bottom: 0,
                      }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        horizontal={false}
                      />

                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{
                          fill:
                            'var(--muted-foreground)',
                          fontSize: 11,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        type="category"
                        dataKey="name"
                        width={125}
                        tick={{
                          fill:
                            'var(--muted-foreground)',
                          fontSize: 11,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <Tooltip
                        contentStyle={tooltipStyle}
                        cursor={{
                          fill: 'var(--muted)',
                          opacity: 0.15,
                        }}
                        formatter={(value) => [
                          integer.format(
                            Number(value),
                          ),
                          'Contatos',
                        ]}
                      />

                      <Bar
                        dataKey="value"
                        name="Contatos"
                        radius={[0, 7, 7, 0]}
                        maxBarSize={36}
                      >
                        {sourceBarData.map((source) => (
                          <Cell
                            key={source.name}
                            fill={source.color}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart message="Cadastre a origem dos contatos para preencher este relatório." />
                )}
              </ChartCard>

              <ChartCard
                className="xl:col-span-2"
                title="Distribuição das origens"
                description="Participação de cada canal na aquisição de contatos."
              >
                <SourceDistribution
                  data={sourcePieData}
                  report={report}
                />
              </ChartCard>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeading
              icon={GitBranch}
              title="Desempenho do funil"
              description={`Dados de ${selectedPipelineLabel.toLowerCase()}.`}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Oportunidades por etapa"
                description="Quantidade atual de negociações em cada etapa."
              >
                {report.stages.some(
                  (stage) => stage.count > 0,
                ) ? (
                  <ResponsiveContainer
                    width="100%"
                    height={330}
                  >
                    <BarChart
                      data={report.stages}
                      layout="vertical"
                      margin={{
                        top: 8,
                        right: 18,
                        left: 18,
                        bottom: 0,
                      }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        horizontal={false}
                      />

                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{
                          fill:
                            'var(--muted-foreground)',
                          fontSize: 11,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        type="category"
                        dataKey="label"
                        width={160}
                        tick={{
                          fill:
                            'var(--muted-foreground)',
                          fontSize: 11,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [
                          integer.format(
                            Number(value),
                          ),
                          'Oportunidades',
                        ]}
                      />

                      <Bar
                        dataKey="count"
                        name="Oportunidades"
                        fill="var(--chart-1)"
                        radius={[0, 7, 7, 0]}
                        maxBarSize={32}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart message="Ainda não existem oportunidades nas etapas deste filtro." />
                )}
              </ChartCard>

              <ChartCard
                title="Valor por etapa"
                description="Valor acumulado das oportunidades em cada etapa."
              >
                {report.stages.some(
                  (stage) => stage.value > 0,
                ) ? (
                  <ResponsiveContainer
                    width="100%"
                    height={330}
                  >
                    <BarChart
                      data={report.stages}
                      layout="vertical"
                      margin={{
                        top: 8,
                        right: 18,
                        left: 18,
                        bottom: 0,
                      }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        horizontal={false}
                      />

                      <XAxis
                        type="number"
                        tickFormatter={(value) =>
                          integer.format(
                            Number(value),
                          )
                        }
                        tick={{
                          fill:
                            'var(--muted-foreground)',
                          fontSize: 11,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        type="category"
                        dataKey="label"
                        width={160}
                        tick={{
                          fill:
                            'var(--muted-foreground)',
                          fontSize: 11,
                        }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [
                          formatCurrencyDetailed(
                            Number(value),
                            defaultCurrency,
                          ),
                          'Valor',
                        ]}
                      />

                      <Bar
                        dataKey="value"
                        name="Valor"
                        fill="var(--chart-2)"
                        radius={[0, 7, 7, 0]}
                        maxBarSize={32}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart message="Adicione valores às oportunidades para preencher este relatório." />
                )}
              </ChartCard>
            </div>
          </section>

          {pipelineFilter === ALL_PIPELINES &&
          report.pipelineSummary.length > 1 ? (
            <section className="space-y-4">
              <SectionHeading
                icon={GitBranch}
                title="Comparativo entre funis"
                description="Resumo das oportunidades de todos os funis."
              />

              <PipelineComparison
                items={report.pipelineSummary}
                currency={defaultCurrency}
              />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof GitBranch;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>

      <div>
        <h2 className="font-semibold tracking-tight">
          {title}
        </h2>

        <p className="mt-0.5 text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={`min-w-0 rounded-2xl shadow-sm ${className}`}
    >
      <CardHeader>
        <CardTitle className="text-base">
          {title}
        </CardTitle>

        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent className="min-w-0">
        {children}
      </CardContent>
    </Card>
  );
}

function SourceDistribution({
  data,
  report,
}: {
  data: SourceChartItem[];
  report: ReportData;
}) {
  if (!data.some((item) => item.value > 0)) {
    return (
      <EmptyChart message="Nenhuma origem foi informada para os contatos deste período." />
    );
  }

  return (
    <div>
      <ResponsiveContainer
        width="100%"
        height={220}
      >
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={54}
            outerRadius={82}
            paddingAngle={3}
            strokeWidth={2}
            stroke="var(--background)"
            aria-label="Distribuição de contatos por origem"
          >
            {data.map((item) => (
              <Cell
                key={item.name}
                fill={item.color}
              />
            ))}
          </Pie>

          <Tooltip
            content={<SourceTooltip />}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-3">
        <SourceStat
          label="Principal origem"
          value={
            report.sourceSummary.topName ??
            'Não informado'
          }
          subtitle={
            report.sourceSummary.topName
              ? formatContactCount(report.sourceSummary.topValue)
              : 'Sem dados'
          }
        />

        <SourceStat
          label="Cobertura"
          value={percent.format(
            report.sourceSummary.coverage,
          )}
          subtitle="Com origem preenchida"
        />

        <SourceStat
          label="Com origem"
          value={integer.format(
            report.sourceSummary.informed,
          )}
          subtitle="Contatos identificados"
        />

        <SourceStat
          label="Sem origem"
          value={integer.format(
            report.sourceSummary.uninformed,
          )}
          subtitle="Precisam ser atualizados"
        />
      </div>
    </div>
  );
}

function SourceStat({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="mt-1 truncate font-semibold">
        {value}
      </p>

      <p className="mt-0.5 text-xs text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}

function PipelineComparison({
  items,
  currency,
}: {
  items: ReportData['pipelineSummary'];
  currency: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <Card
          key={item.id}
          className="rounded-2xl shadow-sm"
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="size-4 text-primary" />
              {item.name}
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-center">
              <PipelineStat
                label="Abertas"
                value={integer.format(item.open)}
              />

              <PipelineStat
                label="Ganhos"
                value={integer.format(item.won)}
              />

              <PipelineStat
                label="Perdidos"
                value={integer.format(item.lost)}
              />
            </div>

            <div className="mt-4 rounded-xl bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">
                Valor em negociação
              </p>

              <p className="mt-1 font-semibold tabular-nums">
                {formatCurrencyDetailed(
                  item.value,
                  currency,
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PipelineStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-3">
      <p className="text-lg font-semibold tabular-nums">
        {value}
      </p>

      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function EmptyChart({
  message = 'Ainda não há dados suficientes para este relatório.',
}: {
  message?: string;
}) {
  return (
    <div className="grid h-[300px] place-items-center rounded-xl border border-dashed px-6 text-center">
      <div className="max-w-xs">
        <BarChart3 className="mx-auto size-6 text-muted-foreground" />

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {message}
        </p>
      </div>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div
      className="space-y-4"
      aria-label="Carregando relatórios"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from(
          { length: 8 },
          (_, index) => (
            <SkeletonCard key={index} />
          ),
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[380px] rounded-2xl" />
        <Skeleton className="h-[380px] rounded-2xl" />
      </div>
    </div>
  );
}
