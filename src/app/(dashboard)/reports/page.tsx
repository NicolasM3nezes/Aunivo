'use client';

import { useCallback, useEffect, useState } from 'react';
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
  Target,
  TrendingDown,
  Trophy,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { normalizeError } from '@/lib/errors/normalize-error';
import { formatCurrencyDetailed } from '@/lib/currency';
import { MetricCard } from '@/components/dashboard/metric-card';
import { Skeleton, SkeletonCard } from '@/components/dashboard/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  buildReport,
  type ReportContact,
  type ReportData,
  type ReportDeal,
  type ReportPeriod,
  type ReportStage,
} from '@/lib/reports/analytics';

const integer = new Intl.NumberFormat('pt-BR');
const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

const tooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
  color: 'var(--popover-foreground)',
  boxShadow: 'var(--shadow-md)',
};

export default function ReportsPage() {
  const { accountId, profileLoading, defaultCurrency } = useAuth();
  const [period, setPeriod] = useState<ReportPeriod>('30');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(false);
    try {
      const db = createClient();
      const pipelineResult = await db
        .from('pipelines')
        .select('id')
        .eq('account_id', accountId)
        .order('created_at')
        .limit(1)
        .maybeSingle();
      if (pipelineResult.error) throw pipelineResult.error;

      const pipelineId = pipelineResult.data?.id;
      const contactsQuery = db
        .from('contacts')
        .select('created_at,lead_source,is_active')
        .eq('account_id', accountId);
      const dealsQuery = pipelineId
        ? db.from('deals').select('status,value,stage_id,created_at,updated_at').eq('account_id', accountId).eq('pipeline_id', pipelineId)
        : Promise.resolve({ data: [], error: null });
      const stagesQuery = pipelineId
        ? db.from('pipeline_stages').select('id,name,position').eq('pipeline_id', pipelineId).order('position')
        : Promise.resolve({ data: [], error: null });
      const [contactsResult, dealsResult, stagesResult] = await Promise.all([contactsQuery, dealsQuery, stagesQuery]);
      if (contactsResult.error || dealsResult.error || stagesResult.error) {
        throw contactsResult.error ?? dealsResult.error ?? stagesResult.error;
      }
      setReport(buildReport(
        (contactsResult.data ?? []) as ReportContact[],
        (dealsResult.data ?? []) as ReportDeal[],
        (stagesResult.data ?? []) as ReportStage[],
        period,
      ));
    } catch (caught) {
      const normalized = normalizeError(caught);
      console.error('[reports] Falha ao carregar', { message: normalized.message, code: normalized.code });
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [accountId, period]);

  useEffect(() => {
    if (profileLoading) return;
    if (!accountId) {
      setLoading(false);
      setError(true);
      return;
    }
    void load();
  }, [profileLoading, accountId, load]);

  const cards = report ? [
    ['Total de contatos', integer.format(report.totalContacts), Users, 'Contatos ativos na sua base'],
    ['Novos no período', integer.format(report.newContacts), ContactRound, 'Cadastros no intervalo selecionado'],
    ['Oportunidades abertas', integer.format(report.open), BriefcaseBusiness, 'Negociações iniciadas no período'],
    ['Valor em negociação', formatCurrencyDetailed(report.pipelineValue, defaultCurrency), CircleDollarSign, 'Soma das oportunidades abertas'],
    ['Negócios ganhos', integer.format(report.won), Trophy, 'Finalizados como ganhos'],
    ['Negócios perdidos', integer.format(report.lost), TrendingDown, 'Finalizados como perdidos'],
    ['Taxa de conversão', percent.format(report.conversion), Target, 'Ganhos entre negócios finalizados'],
    ['Ticket médio', formatCurrencyDetailed(report.average, defaultCurrency), BarChart3, 'Valor médio dos negócios ganhos'],
  ] as const : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Desempenho comercial</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="mt-1 text-muted-foreground">Acompanhe o desempenho comercial da sua empresa.</p>
        </div>
        <div className="w-full sm:w-56">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="report-period">Período</label>
          <Select value={period} onValueChange={(value) => setPeriod(value as ReportPeriod)}>
            <SelectTrigger id="report-period"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="90">Últimos 3 meses</SelectItem>
              <SelectItem value="all">Todo o período</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {error ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5">
          <p>Não foi possível carregar os relatórios.</p>
          <Button className="mt-3" variant="outline" onClick={() => void load()}>Tentar novamente</Button>
        </div>
      ) : null}

      {loading ? <ReportsSkeleton /> : null}

      {!loading && !error && report ? (
        <>
          <section aria-label="Indicadores comerciais" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([title, value, Icon, subtitle]) => (
              <MetricCard key={title} title={title} value={value} icon={Icon} subtitle={subtitle} />
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-5">
            <ChartCard className="xl:col-span-3" title="Evolução de contatos" description="Novos contatos cadastrados no período selecionado.">
              {report.contactsTimeline.some((point) => point.value > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={report.contactsTimeline} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                    <defs><linearGradient id="contacts-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3}/><stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [integer.format(Number(value)), 'Novos contatos']} />
                    <Area type="monotone" dataKey="value" name="Novos contatos" stroke="var(--chart-1)" strokeWidth={2} fill="url(#contacts-fill)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard className="xl:col-span-2" title="Resultados das negociações" description="Negócios ganhos e perdidos no período.">
              {report.results.some((item) => item.value > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={report.results} dataKey="value" nameKey="name" innerRadius={66} outerRadius={100} paddingAngle={3}>
                      {report.results.map((item, index) => <Cell key={item.name} fill={`var(--chart-${index + 1})`} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => integer.format(Number(value))} />
                    <Legend formatter={(value) => <span className="text-sm text-foreground">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart message="Ainda não há negociações finalizadas." />}
            </ChartCard>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Contatos por etapa" description="Quantidade de oportunidades em cada etapa do funil principal.">
              {report.stages.some((stage) => stage.count > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={report.stages} margin={{ top: 8, right: 8, left: -18, bottom: 24 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" interval={0} angle={-18} textAnchor="end" height={64} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [integer.format(Number(value)), 'Oportunidades']} />
                    <Bar dataKey="count" name="Oportunidades" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Valor por etapa" description="Valor total das oportunidades por etapa do funil.">
              {report.stages.some((stage) => stage.value > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={report.stages} layout="vertical" margin={{ top: 8, right: 18, left: 18, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(value) => integer.format(Number(value))} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={112} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [formatCurrencyDetailed(Number(value), defaultCurrency), 'Valor']} />
                    <Bar dataKey="value" name="Valor" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>

            <ChartCard title="Origem dos contatos" description="Como os novos contatos chegaram à sua empresa.">
              {report.sources.length && report.sources.some((source) => source.value > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={report.sources.slice(0, 8)} layout="vertical" margin={{ top: 8, right: 18, left: 18, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" width={112} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [integer.format(Number(value)), 'Contatos']} />
                    <Bar dataKey="value" name="Contatos" fill="var(--chart-3)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>
          </section>
        </>
      ) : null}
    </div>
  );
}

function ChartCard({ title, description, children, className = '' }: { title: string; description: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`min-w-0 rounded-2xl shadow-sm ${className}`}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">{children}</CardContent>
    </Card>
  );
}

function EmptyChart({ message = 'Ainda não há dados suficientes para este relatório.' }: { message?: string }) {
  return <div className="grid h-[300px] place-items-center rounded-xl border border-dashed px-6 text-center text-sm text-muted-foreground">{message}</div>;
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4" aria-label="Carregando relatórios">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <SkeletonCard key={index} />)}</div>
      <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-[380px] rounded-2xl" /><Skeleton className="h-[380px] rounded-2xl" /></div>
    </div>
  );
}
