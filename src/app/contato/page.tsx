import type { Metadata } from 'next';
import { Mail, MapPin, MessageCircle, Shield, User } from 'lucide-react';
import { PublicShell } from '@/components/public/public-shell';
import { LEGAL_CONTACT } from '@/config/legal';
export const metadata:Metadata={title:'Contato | Aunivo',description:'Entre em contato com o suporte, privacidade ou programa piloto do Aunivo.',alternates:{canonical:'/contato'}};
export default function ContactPage(){
  const cards=[
    {Icon:Mail,title:'Suporte',body:<a href={`mailto:${LEGAL_CONTACT.supportEmail}`}>{LEGAL_CONTACT.supportEmail}</a>},
    {Icon:Shield,title:'Privacidade e LGPD',body:<a href={`mailto:${LEGAL_CONTACT.privacyEmail}`}>{LEGAL_CONTACT.privacyEmail}</a>},
    {Icon:MessageCircle,title:'Programa Piloto',body:<a aria-label={`Falar com o Aunivo pelo WhatsApp ${LEGAL_CONTACT.whatsappDisplay}`} href={`https://wa.me/${LEGAL_CONTACT.whatsappNumber}`} target="_blank" rel="noopener noreferrer">{LEGAL_CONTACT.whatsappDisplay}</a>},
  ];
  return <PublicShell><main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24"><header><h1 className="text-4xl font-bold sm:text-5xl">Contato Aunivo</h1><p className="text-muted-foreground mt-4 text-lg">Fale com o canal adequado para sua necessidade.</p></header><div className="mt-10 grid gap-5 md:grid-cols-3">{cards.map(({Icon,title,body})=><section className="border-border bg-card rounded-3xl border p-6" key={title}><Icon className="text-primary size-6"/><h2 className="mt-4 text-lg font-semibold">{title}</h2><div className="text-primary mt-3 break-words underline">{body}</div></section>)}</div><dl className="border-border bg-muted/30 mt-8 rounded-3xl border p-7"><div className="flex gap-3"><User className="size-5"/><div><dt className="font-semibold">Responsável pelo projeto</dt><dd className="text-muted-foreground">{LEGAL_CONTACT.responsibleName}</dd></div></div><div className="mt-6 flex gap-3"><MapPin className="size-5"/><div><dt className="font-semibold">Localidade</dt><dd className="text-muted-foreground">{LEGAL_CONTACT.location}</dd></div></div></dl></main></PublicShell>;
}
