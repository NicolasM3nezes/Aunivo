import type { ReactNode } from 'react';
import { PublicHeader } from './public-header';
import { PublicFooter } from './public-footer';

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground min-h-screen overflow-x-hidden">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
