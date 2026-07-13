import {
  ArrowDown,
  ArrowUp,
  Minus,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';

export type MetricCardTone =
  | 'primary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'info';

export interface MetricCardProps {
  title: string;
  value: string;
  icon: ComponentType<{
    className?: string;
  }>;

  delta?: {
    sign: number;
    label: string;
  };

  subtitle?: string;
  tone?: MetricCardTone;
  emphasized?: boolean;
}

const toneStyles: Record<
  MetricCardTone,
  {
    icon: string;
    glow: string;
  }
> = {
  primary: {
    icon:
      'bg-primary/10 text-primary ring-primary/10',
    glow: 'bg-primary/10',
  },
  success: {
    icon:
      'bg-emerald-500/10 text-emerald-600 ring-emerald-500/10 dark:text-emerald-400',
    glow: 'bg-emerald-500/10',
  },
  danger: {
    icon:
      'bg-red-500/10 text-red-600 ring-red-500/10 dark:text-red-400',
    glow: 'bg-red-500/10',
  },
  warning: {
    icon:
      'bg-amber-500/10 text-amber-600 ring-amber-500/10 dark:text-amber-400',
    glow: 'bg-amber-500/10',
  },
  info: {
    icon:
      'bg-sky-500/10 text-sky-600 ring-sky-500/10 dark:text-sky-400',
    glow: 'bg-sky-500/10',
  },
};

export function MetricCard({
  title,
  value,
  icon: Icon,
  delta,
  subtitle,
  tone = 'primary',
  emphasized = false,
}: MetricCardProps) {
  const styles = toneStyles[tone];

  return (
    <div
      className={cn(
        'group relative h-full overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-md',
        emphasized
          ? 'border-primary/20'
          : 'border-border/70',
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute -top-16 -right-16 size-32 rounded-full blur-3xl transition-opacity',
          styles.glow,
          emphasized
            ? 'opacity-80'
            : 'opacity-0 group-hover:opacity-70',
        )}
      />

      <div className="relative flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-muted-foreground">
          {title}
        </p>

        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl ring-1',
            styles.icon,
          )}
        >
          <Icon
            className="size-5"
            aria-hidden
          />
        </div>
      </div>

      <p className="relative mt-3 break-words text-3xl leading-tight font-semibold tracking-tight tabular-nums text-card-foreground">
        {value}
      </p>

      {subtitle ? (
        <p className="relative mt-2 min-h-10 text-sm leading-5 text-muted-foreground">
          {subtitle}
        </p>
      ) : null}

      {delta ? (
        <DeltaRow
          sign={delta.sign}
          label={delta.label}
        />
      ) : null}
    </div>
  );
}

function DeltaRow({
  sign,
  label,
}: {
  sign: number;
  label: string;
}) {
  const Arrow =
    sign > 0
      ? ArrowUp
      : sign < 0
        ? ArrowDown
        : Minus;

  const tone =
    sign > 0
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
      : sign < 0
        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
        : 'bg-muted text-muted-foreground';

  return (
    <div
      className={cn(
        'relative mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        tone,
      )}
    >
      <Arrow
        className="size-3.5 shrink-0"
        aria-hidden
      />

      <span className="truncate tabular-nums">
        {label}
      </span>
    </div>
  );
}