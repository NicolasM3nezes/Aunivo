'use client';

import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import type { PlanKey } from '@/lib/billing/types';

type CheckoutPlan = Exclude<PlanKey, 'business'>;

interface CheckoutResponse {
  url?: string;
  error?: string;
  code?: string;
  details?: unknown;
  hint?: string;
}

function checkoutErrorMessage(status: number, payload: CheckoutResponse | null) {
  if (status === 401) return 'Faça login para continuar com a assinatura.';
  if (status === 400) return 'Este plano não está disponível no momento.';
  if (status === 403 || status === 404) return 'Não foi possível identificar sua conta.';
  if (payload?.error?.includes('PRICE_ID')) return 'Este plano não está disponível no momento.';
  return 'Não foi possível iniciar o checkout. Tente novamente.';
}

export function LandingCheckoutButton({
  plan,
  label,
  featured,
}: {
  plan: CheckoutPlan;
  label: string;
  featured: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    if (loading) return;
    setLoading(true);

    try {
      const { data, error: authError } = await createClient().auth.getUser();

      if (authError || !data.user) {
        window.location.assign(`/cadastro?plan=${plan}`);
        return;
      }

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planKey: plan, interval: 'monthly' }),
      });
      const payload = (await response.json().catch(() => null)) as CheckoutResponse | null;

      if (!response.ok || !payload?.url) {
        console.error('[landing-checkout] checkout failed', {
          status: response.status,
          message: payload?.error,
          code: payload?.code,
          details: payload?.details,
          hint: payload?.hint,
        });
        toast.error(checkoutErrorMessage(response.status, payload));
        setLoading(false);
        return;
      }

      window.location.assign(payload.url);
    } catch (error) {
      console.error('[landing-checkout] request failed', {
        message: error instanceof Error ? error.message : 'Unknown checkout error',
      });
      toast.error('Não foi possível iniciar o checkout. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      onClick={() => void startCheckout()}
      disabled={loading}
      className="mt-6 h-11 w-full rounded-xl"
      variant={featured ? 'default' : 'outline'}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : label}
      {!loading ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
    </Button>
  );
}
