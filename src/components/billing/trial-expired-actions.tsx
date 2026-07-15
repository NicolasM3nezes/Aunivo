'use client'

import Link from 'next/link'
import { LogOut, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { LEGAL_CONTACT } from '@/config/legal'

export function TrialExpiredActions() {
  const supportUrl = `https://wa.me/${LEGAL_CONTACT.whatsappNumber}`
  return <div className="grid gap-3 sm:grid-cols-2">
    <Button render={<Link href="/checkout?plan=free" />} size="lg">Assinar Basic</Button>
    <Button render={<Link href="/checkout?plan=pro" />} size="lg">Assinar Pro</Button>
    <Button render={<a href={supportUrl} target="_blank" rel="noreferrer" />} variant="outline"><MessageCircle />Falar com suporte</Button>
    <Button type="button" variant="ghost" onClick={async () => { await createClient().auth.signOut(); window.location.assign('/login') }}><LogOut />Sair</Button>
  </div>
}
