import Link from 'next/link';
import type { ReactNode } from 'react';
import { LEGAL_CONTACT } from '@/config/legal';

export interface LegalSectionItem { id: string; title: string; content: ReactNode }

export function LegalPage({ title, description, version, sections, children }: {
  title: string; description: string; version: string; sections?: LegalSectionItem[]; children?: ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
      <header className="border-border/70 bg-card rounded-3xl border p-6 shadow-sm sm:p-10">
        <p className="text-primary text-sm font-semibold uppercase tracking-[.16em]">Documentos Aunivo</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        <p className="text-muted-foreground mt-4 max-w-3xl text-lg leading-8">{description}</p>
        <dl className="text-muted-foreground mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div><dt className="sr-only">Versão</dt><dd>Versão {version}</dd></div>
          <div><dt className="sr-only">Vigência</dt><dd>Vigência: {LEGAL_CONTACT.effectiveDate}</dd></div>
        </dl>
      </header>
      {sections?.length ? (
        <nav aria-label="Sumário" className="border-border/70 bg-muted/30 mt-8 rounded-2xl border p-6">
          <h2 className="font-semibold">Nesta página</h2>
          <ol className="text-muted-foreground mt-4 grid gap-2 text-sm sm:grid-cols-2">
            {sections.map((section, index) => <li key={section.id}><a className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" href={`#${section.id}`}>{index + 1}. {section.title}</a></li>)}
          </ol>
        </nav>
      ) : null}
      <div className="mt-10 space-y-10">
        {sections?.map((section, index) => (
          <section id={section.id} key={section.id} className="scroll-mt-28">
            <h2 className="text-2xl font-semibold tracking-tight">{index + 1}. {section.title}</h2>
            <div className="text-muted-foreground mt-3 space-y-4 leading-7">{section.content}</div>
          </section>
        ))}
        {children}
      </div>
      <footer className="border-border mt-12 border-t pt-6 text-sm text-muted-foreground">
        <p>Versão: {version} – Programa Piloto</p><p>Vigência: {LEGAL_CONTACT.effectiveDate}</p>
        <p className="mt-3">Consulte também a <Link className="text-primary underline" href="/politica-de-privacidade">Política de Privacidade</Link>, a <Link className="text-primary underline" href="/politica-de-cookies">Política de Cookies</Link> e o <Link className="text-primary underline" href="/programa-piloto">Programa Piloto</Link>.</p>
      </footer>
    </article>
  );
}
