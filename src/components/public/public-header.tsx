'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

const links = [
  ['Início', '/'],
  ['Recursos', '/#recursos'],
  ['Como funciona', '/#como-funciona'],
  ['Planos', '/#planos'],
  ['Perguntas frequentes', '/#faq'],
] as const;

export function PublicHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:h-[72px] lg:px-8">
          <Link
            href="/"
            aria-label="Aunivo — Página inicial"
            className="inline-flex shrink-0 items-center rounded-xl transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            <Image
              src="/brand/aunivo-logo.png"
              alt="Aunivo"
              width={220}
              height={72}
              priority
              className="h-9 w-auto object-contain sm:h-10"
            />
          </Link>

          <nav
            aria-label="Navegação principal"
            className="hidden items-center gap-1 lg:flex"
          >
            {links.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-xl px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Button
              render={<Link href="/login" />}
              variant="ghost"
              className="h-10 rounded-xl px-4"
            >
              Entrar
            </Button>

            <Button
              render={<Link href="/cadastro" />}
              className="h-10 rounded-xl px-5 shadow-lg shadow-primary/15"
            >
              Começar agora
              <ArrowRight className="size-4" />
            </Button>
          </div>

          <button
            type="button"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen((current) => !current)}
            className="grid size-10 place-items-center rounded-xl border border-border/70 bg-background text-foreground transition-colors hover:bg-muted lg:hidden"
          >
            {open ? (
              <X className="size-5" />
            ) : (
              <Menu className="size-5" />
            )}
          </button>
        </div>
      </header>

      <button
        type="button"
        aria-label="Fechar menu"
        onClick={closeMenu}
        className={`fixed inset-0 z-40 bg-background/70 backdrop-blur-sm transition-opacity lg:hidden ${
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      />

      <div
        id="mobile-navigation"
        className={`fixed inset-x-4 top-20 z-50 overflow-hidden rounded-3xl border border-border/70 bg-background/95 shadow-2xl shadow-black/10 backdrop-blur-xl transition-all duration-200 lg:hidden ${
          open
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-3 opacity-0'
        }`}
      >
        <div className="p-3">
          <nav
            aria-label="Navegação mobile"
            className="flex flex-col gap-1"
          >
            {links.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                onClick={closeMenu}
                className="rounded-2xl px-4 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="my-3 h-px bg-border/70" />

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              render={<Link href="/login" onClick={closeMenu} />}
              variant="outline"
              className="h-11 w-full rounded-xl"
            >
              Entrar
            </Button>

            <Button
              render={<Link href="/cadastro" onClick={closeMenu} />}
              className="h-11 w-full rounded-xl"
            >
              Começar agora
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}