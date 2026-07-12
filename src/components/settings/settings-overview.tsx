'use client';

import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { THEMES } from '@/lib/themes';
import { CURRENCIES } from '@/lib/currency';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SECTION_META, V1_SETTINGS_SECTIONS, type SettingsSection } from './settings-sections';
import { SettingsChip } from './settings-chip';
import { ROLE_META } from './role-meta';

const OVERVIEW_SECTIONS = V1_SETTINGS_SECTIONS.filter((section) => section !== 'overview');

export function SettingsOverview({ onSelect }: { onSelect: (section: SettingsSection) => void }) {
  const { profile, accountRole, defaultCurrency } = useAuth();
  const { mode, theme } = useTheme();
  const t = useTranslations('Settings.overview');
  const tRoles = useTranslations('Settings.roles');
  const tSections = useTranslations('Settings.sections');
  const displayName = profile?.full_name || profile?.email || t('yourAccount');
  const initial = displayName.charAt(0).toUpperCase();
  const roleMeta = accountRole ? ROLE_META[accountRole] : null;
  const RoleIcon = roleMeta?.icon;
  const currencyLabel = defaultCurrency === 'BRL'
    ? 'Real brasileiro'
    : CURRENCIES.find((currency) => currency.code === defaultCurrency)?.label ?? defaultCurrency;
  const themeName = THEMES.find((item) => item.id === theme)?.name ?? theme;
  const subtitles: Partial<Record<SettingsSection, string>> = {
    profile: 'Atualize seus dados pessoais',
    security: 'Senha e segurança da conta',
    appearance: `${mode === 'light' ? 'Claro' : 'Escuro'} · ${themeName}`,
    fields: 'Organize campos e etiquetas',
    deals: `${defaultCurrency} — ${currencyLabel}`,
    billing: 'Consulte seu plano atual',
  };

  return <section className="animate-in fade-in-50 duration-200">
    <Card className="flex-row items-center gap-4 px-5 py-5">
      <Avatar size="lg" className="size-14">{profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={displayName} /> : null}<AvatarFallback className="bg-primary/10 text-xl text-primary">{initial}</AvatarFallback></Avatar>
      <div className="min-w-0 flex-1"><div className="truncate text-base font-semibold">{displayName}</div>{profile?.email ? <div className="truncate text-sm text-muted-foreground">{profile.email}</div> : null}</div>
      {roleMeta && RoleIcon && accountRole ? <SettingsChip variant={roleMeta.variant}><RoleIcon />{tRoles(accountRole)}</SettingsChip> : null}
    </Card>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {OVERVIEW_SECTIONS.map((section) => { const meta=SECTION_META[section]; const Icon=meta.icon; return <button key={section} type="button" onClick={()=>onSelect(section)} className={cn('group flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 text-left transition-colors','hover:border-primary-soft-2 hover:bg-card-2')}><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{tSections(section)}</span><span className="mt-0.5 block text-xs text-muted-foreground">{subtitles[section]}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></button>; })}
    </div>
  </section>;
}
