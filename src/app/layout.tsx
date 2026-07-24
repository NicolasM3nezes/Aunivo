import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Suspense } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';

import './globals.css';

import { ThemeProvider } from '@/hooks/use-theme';
import { ThemedToaster } from '@/components/themed-toaster';
import { MetaPixel } from '@/components/analytics/meta-pixel';

import {
  DEFAULT_MODE,
  DEFAULT_THEME,
  MODE_STORAGE_KEY,
  MODES,
  STORAGE_KEY,
  THEME_IDS,
} from '@/lib/themes';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.aunivo.com.br'),

  title: 'Aunivo — CRM simples para pequenas empresas',

  description:
    'Organize seus clientes, acompanhe negociações e mantenha cada próximo passo sob controle.',

  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: '/',
    siteName: 'Aunivo',
    title: 'Aunivo — CRM simples para pequenas empresas',
    description:
      'Organize seus clientes, acompanhe negociações e mantenha cada próximo passo sob controle.',
  },

  twitter: {
    card: 'summary',
    title: 'Aunivo — CRM simples para pequenas empresas',
    description:
      'Organize seus clientes, acompanhe negociações e mantenha cada próximo passo sob controle.',
  },
};

export const viewport: Viewport = {
  themeColor: '#fcfcfd',
  colorScheme: 'light',
};

// Executado antes da hidratação do React para aplicar o tema e o modo
// salvos no localStorage antes da primeira renderização visual.
const THEME_BOOT_SCRIPT = `
(function(){
  var d = document.documentElement;

  try {
    var THEME_KEY = ${JSON.stringify(STORAGE_KEY)};
    var THEME_DEFAULT = ${JSON.stringify(DEFAULT_THEME)};
    var THEMES = ${JSON.stringify(THEME_IDS)};
    var savedTheme = localStorage.getItem(THEME_KEY);

    d.dataset.theme =
      THEMES.indexOf(savedTheme) !== -1
        ? savedTheme
        : THEME_DEFAULT;

    var MODE_KEY = ${JSON.stringify(MODE_STORAGE_KEY)};
    var MODE_DEFAULT = ${JSON.stringify(DEFAULT_MODE)};
    var MODES = ${JSON.stringify(MODES)};
    var savedMode = localStorage.getItem(MODE_KEY);

    if (!savedMode || savedMode === 'system') {
      savedMode = MODE_DEFAULT;
      localStorage.setItem(MODE_KEY, savedMode);
    }

    var mode =
      MODES.indexOf(savedMode) !== -1
        ? savedMode
        : MODE_DEFAULT;

    d.dataset.mode = mode;
    d.classList.toggle('dark', mode === 'dark');
  } catch (_e) {
    d.dataset.theme = ${JSON.stringify(DEFAULT_THEME)};
    d.dataset.mode = ${JSON.stringify(DEFAULT_MODE)};
    d.classList.remove('dark');
  }
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      data-theme={DEFAULT_THEME}
      data-mode={DEFAULT_MODE}
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: THEME_BOOT_SCRIPT,
          }}
        />
      </head>

      <body className="bg-background text-foreground min-h-full font-sans">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider>
            {children}

            <Suspense fallback={null}>
              <MetaPixel />
            </Suspense>

            <ThemedToaster />
          </ThemeProvider>
        </NextIntlClientProvider>

        <SpeedInsights />
      </body>
    </html>
  );
}