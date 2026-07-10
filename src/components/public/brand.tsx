import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AunivoBrand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        'inline-flex items-center gap-2.5 font-semibold tracking-tight',
        className
      )}
      aria-label="Aunivo — início"
    >
      <span className="from-primary text-primary-foreground shadow-primary/20 grid size-9 place-items-center rounded-xl bg-gradient-to-br to-emerald-400 shadow-lg">
        <Sparkles className="size-4.5" aria-hidden />
      </span>
      <span className="text-xl">Aunivo</span>
    </Link>
  );
}
