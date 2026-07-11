import type { ReactNode } from 'react';

import { PublicFooter } from './public-footer';
import { PublicHeader } from './public-header';

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <PublicHeader />

      <main className="pt-16 lg:pt-[72px]">
        {children}
      </main>

      <PublicFooter />
    </div>
  );
}