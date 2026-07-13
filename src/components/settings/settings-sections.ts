import {
  Coins,
  Bell,
  FileText,
  KeyRound,
  CreditCard,
  LayoutGrid,
  Palette,
  PlugZap,
  Bot,
  BookOpen,
  Shield,
  Tags,
  User,
  UsersRound,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Settings information architecture for the redesigned page.
 *
 * The flat tab strip became a grouped left rail with a new Overview
 * landing. The URL query param stays `?tab=` (deep-linkable, and it
 * keeps the existing links in sidebar.tsx / header.tsx working) — we
 * just map the old values onto the new sections.
 */
export const SETTINGS_SECTIONS = [
  'overview',
  'profile',
  'security',
  'appearance',
  'notifications',
  'whatsapp',
  'ai',
  'knowledge',
  'templates',
  'quick-replies',
  'fields',
  'deals',
  'members',
  'api',
  'billing',
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const DEFAULT_SECTION: SettingsSection = 'overview';
export const V1_SETTINGS_SECTIONS: readonly SettingsSection[] = ['overview','profile','security','appearance','notifications','fields','deals','billing'];

/** Rail grouping. `adminOnly` items are hidden for non-admins. */
export interface SectionMeta {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  group: 'top' | 'account' | 'service' | 'team' | 'integrations' | 'billing';
}

export const SECTION_META: Record<SettingsSection, SectionMeta> = {
  overview: { id: 'overview', label: 'Overview', icon: LayoutGrid, group: 'top' },
  profile: { id: 'profile', label: 'Your profile', icon: User, group: 'account' },
  security: { id: 'security', label: 'Login & security', icon: Shield, group: 'account' },
  appearance: { id: 'appearance', label: 'Appearance', icon: Palette, group: 'account' },
  notifications: { id: 'notifications', label: 'Notifications', icon: Bell, group: 'account' },
  whatsapp: { id: 'whatsapp', label: 'WhatsApp', icon: PlugZap, group: 'service' },
  templates: { id: 'templates', label: 'Templates', icon: FileText, group: 'service' },
  'quick-replies': { id: 'quick-replies', label: 'Quick replies', icon: Zap, group: 'service' },
  ai: { id: 'ai', label: 'AI agents', icon: Bot, group: 'service' },
  knowledge: { id: 'knowledge', label: 'Knowledge base', icon: BookOpen, group: 'service' },
  fields: { id: 'fields', label: 'Fields & tags', icon: Tags, group: 'account' },
  deals: { id: 'deals', label: 'Deals & currency', icon: Coins, group: 'account' },
  members: { id: 'members', label: 'Team members', icon: UsersRound, group: 'team' },
  api: { id: 'api', label: 'API keys', icon: KeyRound, group: 'integrations' },
  billing: { id: 'billing', label: 'Plan & billing', icon: CreditCard, group: 'billing' },
};

export const RAIL_GROUPS: { label: string | null; group: SectionMeta['group'] }[] = [
  { label: null, group: 'top' },
  { label: 'Account', group: 'account' },
  { label: 'Service', group: 'service' },
  { label: 'Team', group: 'team' },
  { label: 'Integrations', group: 'integrations' },
  { label: 'Billing', group: 'billing' },
];

function isSection(value: string | null): value is SettingsSection {
  return !!value && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

/**
 * Resolve a raw `?tab=` value to a section. Legacy tabs from the old
 * flat layout collapse onto their new home (Tags + Custom fields → the
 * merged "Fields & tags" section). Anything unknown falls back to the
 * Overview landing.
 */
export function resolveSection(raw: string | null): SettingsSection {
  if (raw === 'tags' || raw === 'custom-fields') return 'fields';
  if (raw === 'ai-config' || raw === 'agents') return 'ai';
  if (raw === 'knowledge-base') return 'knowledge';
  if (isSection(raw) && V1_SETTINGS_SECTIONS.includes(raw)) return raw;
  return DEFAULT_SECTION;
}
