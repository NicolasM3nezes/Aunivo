'use client'

import type { ComponentProps } from 'react'
import { trackContact } from '@/lib/analytics/meta-pixel'

type Props = ComponentProps<'a'> & { contactMethod: 'whatsapp' | 'email' | 'sales' }

export function TrackedContactLink({ contactMethod, onClick, ...props }: Props) {
  return <a {...props} onClick={(event) => {
    trackContact(contactMethod)
    onClick?.(event)
  }} />
}
