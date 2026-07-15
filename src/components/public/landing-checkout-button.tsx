'use client';

import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { PlanKey } from '@/lib/billing/types';

type CheckoutPlan = Exclude<PlanKey, 'business'>;

export function LandingCheckoutButton({
  plan,
  label,
  featured,
}: {
  plan: CheckoutPlan;
  label: string;
  featured: boolean;
}) {
  void plan;

  return (
    <Button
      type="button"
      onClick={() => document.querySelector('#teste-gratis')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      className="mt-6 h-11 w-full rounded-xl"
      variant={featured ? 'default' : 'outline'}
    >
      {label}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Button>
  );
}
