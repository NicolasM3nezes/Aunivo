'use client';
import * as React from 'react';
import { Input } from '@/components/ui/input';
import { formatBrazilianPhone } from '@/lib/phone';

export const PhoneInput = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<typeof Input>, 'type'>>(
  function PhoneInput({ value, onChange, ...props }, ref) {
    return <Input ref={ref} type="tel" inputMode="tel" autoComplete="tel" value={typeof value === 'string' ? formatBrazilianPhone(value) : value} onChange={(event) => {
      const formatted = formatBrazilianPhone(event.target.value);
      event.target.value = formatted;
      onChange?.(event);
    }} {...props} />;
  },
);
