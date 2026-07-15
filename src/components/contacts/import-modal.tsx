'use client';

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useAccountEntitlements } from '@/hooks/use-account-entitlements';
import { PLAN_DISPLAY_NAMES } from '@/lib/billing/plan-permissions';
import { dedupeByPhone, isUniqueViolation } from '@/lib/contacts/dedupe';
import {
  parseContactCsv,
  type ParsedContactRow,
} from '@/lib/contacts/parse-contact-csv';
import {
  assignImportedContactTags,
  resolveImportTagIds,
  type ContactTagAssignment,
} from '@/lib/contacts/resolve-import-tags';
import { normalizeError } from '@/lib/errors/normalize-error';
import { isValidBrazilianPhone, normalizePhone } from '@/lib/phone';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  Loader2,
  Tag,
  Upload,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

const DEFAULT_TAG_COLOR = '#3b82f6';
const PREVIEW_LIMIT = 5;
const INSERT_CHUNK_SIZE = 50;
const LOOKUP_CHUNK_SIZE = 200;

interface ImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  tagsAssigned: number;
}

interface PendingContact {
  source: ParsedContactRow;
  normalizedPhone: string;
}

interface InsertedContactRow {
  id: string;
  phone: string | null;
  phone_normalized: string | null;
}

function normalizeTagKey(value: string): string {
  return value.trim().toLowerCase();
}

function safeTagColor(value: string | null | undefined): string {
  if (value && /^#[0-9a-f]{6}$/i.test(value)) return value;
  return DEFAULT_TAG_COLOR;
}

function truncateFilename(name: string, max = 48): string {
  if (name.length <= max) return name;

  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
  const base = name.slice(0, name.length - ext.length);
  const keep = max - ext.length - 1;

  return `${base.slice(0, Math.max(keep, 12))}…${ext}`;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function PreviewCell({
  value,
  mono,
  maxWidth = 'max-w-[9rem]',
}: {
  value: string;
  mono?: boolean;
  maxWidth?: string;
}) {
  return (
    <span
      className={cn(
        'block truncate',
        maxWidth,
        mono && 'font-mono text-[11px]',
      )}
      title={value}
    >
      {value}
    </span>
  );
}

function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1 py-0.5 text-[11px] text-muted-foreground">
      {children}
    </code>
  );
}

function ImportPreviewTags({
  tagNames,
  tagColorByKey,
}: {
  tagNames: string[];
  tagColorByKey: Map<string, string>;
}) {
  const t = useTranslations('Contacts.importModal');

  const uniqueNames = useMemo(() => {
    const seen = new Set<string>();

    return tagNames.filter((name) => {
      const key = normalizeTagKey(name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [tagNames]);

  if (uniqueNames.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className="flex min-w-[4.5rem] flex-wrap gap-1">
      {uniqueNames.map((name) => {
        const key = normalizeTagKey(name);
        const knownColor = tagColorByKey.get(key);
        const color = safeTagColor(knownColor);
        const isKnown = Boolean(knownColor);

        return (
          <span
            key={key}
            className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] leading-none font-medium"
            style={{
              backgroundColor: `${color}18`,
              color,
              border: `1px solid ${color}${isKnown ? '55' : '30'}`,
            }}
            title={isKnown ? name : t('willBeCreated', { name })}
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="truncate">{name}</span>
          </span>
        );
      })}
    </div>
  );
}

export function ImportModal({
  open,
  onOpenChange,
  onImported,
}: ImportModalProps) {
  const t = useTranslations('Contacts.importModal');
  const supabase = useMemo(() => createClient(), []);
  const { accountId, canEditSettings } = useAuth();
  const { entitlements, loading: entitlementsLoading, refresh: refreshEntitlements } = useAccountEntitlements(accountId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileReadSequenceRef = useRef(0);

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedContactRow[]>([]);
  const [hasTagsColumn, setHasTagsColumn] = useState(false);
  const [hasCompanyColumn, setHasCompanyColumn] = useState(false);
  const [tagColorByKey, setTagColorByKey] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [parsingFile, setParsingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    fileReadSequenceRef.current += 1;
    setFile(null);
    setParsedRows([]);
    setHasTagsColumn(false);
    setHasCompanyColumn(false);
    setTagColorByKey(new Map());
    setParsingFile(false);
    setResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && importing) return;
    if (!next) reset();
    onOpenChange(next);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected || importing) return;

    const requestId = fileReadSequenceRef.current + 1;
    fileReadSequenceRef.current = requestId;

    setFile(selected);
    setParsedRows([]);
    setHasTagsColumn(false);
    setHasCompanyColumn(false);
    setTagColorByKey(new Map());
    setResult(null);
    setParsingFile(true);

    try {
      if (!selected.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Selecione um arquivo no formato CSV.');
      }

      const text = await selected.text();
      if (fileReadSequenceRef.current !== requestId) return;

      const {
        rows,
        hasTagsColumn: csvHasTags,
        hasCompanyColumn: csvHasCompany,
      } = parseContactCsv(text);

      if (fileReadSequenceRef.current !== requestId) return;

      if (rows.length === 0) {
        toast.error(t('toastNoValidRows'));
        return;
      }

      setParsedRows(rows);
      setHasTagsColumn(csvHasTags);
      setHasCompanyColumn(csvHasCompany);

      if (!csvHasTags || !accountId) return;

      const { data: tags, error } = await supabase
        .from('tags')
        .select('name, color')
        .eq('account_id', accountId)
        .order('name');

      if (fileReadSequenceRef.current !== requestId) return;

      if (error) {
        const normalized = normalizeError(error);
        console.error('[contacts:import:preview-tags]', {
          message: normalized.message,
          code: normalized.code,
          details: normalized.details,
          hint: normalized.hint,
        });
        return;
      }

      const colors = new Map<string, string>();

      for (const tag of tags ?? []) {
        const key = normalizeTagKey(tag.name);
        if (key && !colors.has(key)) {
          colors.set(key, safeTagColor(tag.color));
        }
      }

      setTagColorByKey(colors);
    } catch (error: unknown) {
      if (fileReadSequenceRef.current !== requestId) return;

      const normalized = normalizeError(error);
      console.error('[contacts:import:parse]', {
        message: normalized.message,
        code: normalized.code,
        details: normalized.details,
        hint: normalized.hint,
      });

      toast.error(normalized.message || t('toastError'));
      setParsedRows([]);
      setHasTagsColumn(false);
      setHasCompanyColumn(false);
      setTagColorByKey(new Map());
    } finally {
      if (fileReadSequenceRef.current === requestId) {
        setParsingFile(false);
      }
    }
  }

  async function loadExistingPhones(
    currentAccountId: string,
    phones: string[],
  ): Promise<Set<string>> {
    const existing = new Set<string>();

    for (const phoneChunk of chunkArray(phones, LOOKUP_CHUNK_SIZE)) {
      if (phoneChunk.length === 0) continue;

      const { data, error } = await supabase
        .from('contacts')
        .select('phone_normalized')
        .eq('account_id', currentAccountId)
        .in('phone_normalized', phoneChunk);

      if (error) throw error;

      for (const row of data ?? []) {
        const phone = (row as { phone_normalized: string | null })
          .phone_normalized;
        if (phone) existing.add(normalizePhone(phone));
      }
    }

    return existing;
  }

  async function insertContactIndividually(
    row: PendingContact,
    userId: string,
    currentAccountId: string,
  ): Promise<{ id: string | null; skipped: boolean }> {
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        user_id: userId,
        account_id: currentAccountId,
        phone: row.normalizedPhone,
        name: row.source.name?.trim() || null,
        email: row.source.email?.trim() || null,
        company: row.source.company?.trim() || null,
      })
      .select('id')
      .single();

    if (!error && data) {
      return { id: data.id, skipped: false };
    }

    if (isUniqueViolation(error)) {
      return { id: null, skipped: true };
    }

    if (error) {
      const normalized = normalizeError(error);
      console.error('[contacts:import:insert-row]', {
        phone: row.normalizedPhone,
        message: normalized.message,
        code: normalized.code,
        details: normalized.details,
        hint: normalized.hint,
      });
    }

    return { id: null, skipped: false };
  }

  async function handleImport() {
    if (
      parsedRows.length === 0 ||
      importing ||
      parsingFile ||
      !accountId
    ) {
      if (!accountId) toast.error(t('toastError'));
      return;
    }

    const sourceRows = [...parsedRows];
    const currentAccountId = accountId;

    setImporting(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error('Usuário não autenticado.');

      let imported = 0;
      let skipped = 0;
      let failed = 0;

      const { unique, duplicates: inFileDuplicates } =
        dedupeByPhone(sourceRows);
      skipped += inFileDuplicates;

      const validRows: PendingContact[] = [];

      for (const row of unique) {
        if (!isValidBrazilianPhone(row.phone)) {
          failed += 1;
          continue;
        }

        validRows.push({
          source: row,
          normalizedPhone: normalizePhone(row.phone),
        });
      }

      const candidatePhones = Array.from(
        new Set(validRows.map((row) => row.normalizedPhone)),
      );
      const existingPhones = await loadExistingPhones(
        currentAccountId,
        candidatePhones,
      );

      const contactsToInsert = validRows.filter((row) => {
        if (existingPhones.has(row.normalizedPhone)) {
          skipped += 1;
          return false;
        }
        return true;
      });

      const latestEntitlements = await refreshEntitlements();
      if (!latestEntitlements) {
        throw new Error('Não foi possível confirmar o limite de contatos da conta. Tente novamente.');
      }
      const contactLimit = latestEntitlements.limits.contacts;
      const { count: contactsUsed, error: countError } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', currentAccountId);
      if (countError) throw countError;
      const remaining = contactLimit === null
        ? null
        : Math.max(0, contactLimit - (contactsUsed ?? 0));
      if (contactLimit !== null && remaining !== null && contactsToInsert.length > remaining) {
        const planName = PLAN_DISPLAY_NAMES[latestEntitlements.effectivePlan];
        throw new Error(`Seu plano ${planName} permite até ${contactLimit.toLocaleString('pt-BR')} contatos. A importação possui ${contactsToInsert.length.toLocaleString('pt-BR')} contatos novos, mas restam ${remaining.toLocaleString('pt-BR')} vagas. Nenhum contato foi importado.`);
      }

      const tagAssignments: ContactTagAssignment[] = [];

      for (const contactChunk of chunkArray(
        contactsToInsert,
        INSERT_CHUNK_SIZE,
      )) {
        const insertRows = contactChunk.map((row) => ({
          user_id: user.id,
          account_id: currentAccountId,
          phone: row.normalizedPhone,
          name: row.source.name?.trim() || null,
          email: row.source.email?.trim() || null,
          company: row.source.company?.trim() || null,
        }));

        const { data, error } = await supabase
          .from('contacts')
          .insert(insertRows)
          .select('id, phone, phone_normalized');

        if (error) {
          if (error.message?.includes('billing_limit_reached:contacts:')) {
            const planName = PLAN_DISPLAY_NAMES[latestEntitlements.effectivePlan];
            throw new Error(`O limite de contatos do plano ${planName} foi atingido durante a importação. A operação foi interrompida após ${imported.toLocaleString('pt-BR')} contatos; revise o uso atual antes de tentar novamente.`);
          }
          for (const row of contactChunk) {
            const single = await insertContactIndividually(
              row,
              user.id,
              currentAccountId,
            );

            if (single.id) {
              imported += 1;
              if (row.source.tagNames.length > 0) {
                tagAssignments.push({
                  contactId: single.id,
                  tagNames: row.source.tagNames,
                });
              }
            } else if (single.skipped) {
              skipped += 1;
            } else {
              failed += 1;
            }
          }

          continue;
        }

        const insertedByPhone = new Map<string, InsertedContactRow>();

        for (const inserted of (data ?? []) as InsertedContactRow[]) {
          const returnedPhone =
            inserted.phone_normalized || inserted.phone || '';
          const normalized = normalizePhone(returnedPhone);
          if (normalized) insertedByPhone.set(normalized, inserted);
        }

        for (const row of contactChunk) {
          const inserted = insertedByPhone.get(row.normalizedPhone);

          if (!inserted) {
            failed += 1;
            continue;
          }

          imported += 1;

          if (row.source.tagNames.length > 0) {
            tagAssignments.push({
              contactId: inserted.id,
              tagNames: row.source.tagNames,
            });
          }
        }
      }

      let tagsAssigned = 0;
      let skippedNames: string[] = [];

      if (tagAssignments.length > 0) {
        try {
          const tagNames = tagAssignments.flatMap(
            (assignment) => assignment.tagNames,
          );

          const resolved = await resolveImportTagIds(supabase, {
            accountId: currentAccountId,
            userId: user.id,
            tagNames,
            canCreateTags: Boolean(canEditSettings),
          });

          skippedNames = resolved.skippedNames;
          tagsAssigned = await assignImportedContactTags(
            supabase,
            tagAssignments,
            resolved.tagIdByKey,
          );
        } catch (error: unknown) {
          const normalized = normalizeError(error);
          console.error('[contacts:import:tags]', {
            message: normalized.message,
            code: normalized.code,
            details: normalized.details,
            hint: normalized.hint,
          });
          toast.warning(t('toastTagsWarning'));
        }
      }

      setResult({ imported, skipped, failed, tagsAssigned });

      if (imported > 0) {
        toast.success(t('toastImported', { count: imported }));

        try {
          onImported();
        } catch (callbackError) {
          console.error('[contacts:import:onImported]', callbackError);
        }
      }

      if (tagsAssigned > 0) {
        toast.success(t('toastTagsAssigned', { count: tagsAssigned }));
      }

      if (skippedNames.length > 0) {
        const sample = skippedNames.slice(0, 3).join(', ');
        const more =
          skippedNames.length > 3 ? ` (+${skippedNames.length - 3})` : '';
        toast.info(t('toastTagsSkipped', { sample, more }));
      }

      if (skipped > 0) {
        toast.info(t('toastSkipped', { count: skipped }));
      }

      if (failed > 0) {
        toast.error(t('toastFailed', { count: failed }));
      }
    } catch (error: unknown) {
      const normalized = normalizeError(error);
      console.error('[contacts:import]', {
        message: normalized.message,
        code: normalized.code,
        details: normalized.details,
        hint: normalized.hint,
      });
      toast.error(normalized.message || t('toastError'));
    } finally {
      setImporting(false);
    }
  }

  const preview = parsedRows.slice(0, PREVIEW_LIMIT);
  const previewHasTags =
    hasTagsColumn || preview.some((row) => row.tagNames.length > 0);
  const previewHasCompany =
    hasCompanyColumn && preview.some((row) => row.company?.trim());

  const tagStats = useMemo(() => {
    const names = new Set<string>();
    let rowsWithTags = 0;

    for (const row of parsedRows) {
      if (row.tagNames.length === 0) continue;
      rowsWithTags += 1;

      for (const name of row.tagNames) {
        const key = normalizeTagKey(name);
        if (key) names.add(key);
      }
    }

    return { unique: names.size, rowsWithTags };
  }, [parsedRows]);

  const interactionDisabled = importing || parsingFile;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden border-border/80 bg-popover p-0 text-popover-foreground sm:max-w-2xl">
        <div className="shrink-0 space-y-4 border-b border-border/80 px-6 pt-6 pb-5">
          <DialogHeader className="gap-1.5">
            <DialogTitle className="text-lg text-popover-foreground">
              {t('title')}
            </DialogTitle>
            <DialogDescription className="leading-relaxed text-muted-foreground">
              {t.rich('desc', {
                phoneCode: (chunks) => <InlineCode>{chunks}</InlineCode>,
                nameCode: (chunks) => <InlineCode>{chunks}</InlineCode>,
                emailCode: (chunks) => <InlineCode>{chunks}</InlineCode>,
                companyCode: (chunks) => <InlineCode>{chunks}</InlineCode>,
                tagsCode: (chunks) => <InlineCode>{chunks}</InlineCode>,
              })}
            </DialogDescription>
          </DialogHeader>

          <div
            role="button"
            tabIndex={interactionDisabled ? -1 : 0}
            aria-disabled={interactionDisabled}
            onClick={() => {
              if (!interactionDisabled) fileInputRef.current?.click();
            }}
            onKeyDown={(event) => {
              if (interactionDisabled) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={cn(
              'group flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-5 transition-all',
              interactionDisabled
                ? 'cursor-not-allowed opacity-70'
                : 'cursor-pointer',
              file
                ? 'border-primary/35 bg-primary/[0.04]'
                : 'border-border/80 bg-background/40 hover:border-primary/40 hover:bg-background/70',
            )}
          >
            {file ? (
              <>
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/25">
                  {parsingFile ? (
                    <Loader2 className="size-5 animate-spin text-primary" />
                  ) : (
                    <FileText className="size-5 text-primary" />
                  )}
                </div>
                <p
                  className="max-w-full truncate px-2 text-sm font-medium text-popover-foreground"
                  title={file.name}
                >
                  {truncateFilename(file.name)}
                </p>
                {!parsingFile && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {t('rowsReady', { count: parsedRows.length })}
                  </span>
                )}
              </>
            ) : (
              <>
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted/80 ring-1 ring-border/80 transition-colors group-hover:bg-muted">
                  <Upload className="size-5 text-muted-foreground group-hover:text-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('uploadDropzone')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t('uploadHint')}
                </p>
              </>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            disabled={interactionDisabled}
            className="hidden"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {preview.length > 0 && !result && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  {t('preview', { count: preview.length })}
                </p>
                {tagStats.rowsWithTags > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/90 px-2 py-0.5 text-[11px] text-muted-foreground">
                    <Tag className="size-3 text-primary/80" />
                    {t('previewTags', {
                      tags: tagStats.unique,
                      contacts: tagStats.rowsWithTags,
                    })}
                  </span>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-border ring-1 ring-border/50">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[32rem] text-xs">
                    <thead>
                      <tr className="border-b border-border bg-background/60">
                        <th className="px-3 py-2 text-left font-medium whitespace-nowrap text-muted-foreground">
                          {t('columns.phone')}
                        </th>
                        <th className="px-3 py-2 text-left font-medium whitespace-nowrap text-muted-foreground">
                          {t('columns.name')}
                        </th>
                        <th className="px-3 py-2 text-left font-medium whitespace-nowrap text-muted-foreground">
                          {t('columns.email')}
                        </th>
                        {previewHasCompany && (
                          <th className="px-3 py-2 text-left font-medium whitespace-nowrap text-muted-foreground">
                            {t('columns.company')}
                          </th>
                        )}
                        {previewHasTags && (
                          <th className="px-3 py-2 text-left font-medium whitespace-nowrap text-muted-foreground">
                            {t('columns.tags')}
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {preview.map((row, index) => (
                        <tr
                          key={`${normalizePhone(row.phone)}-${index}`}
                          className="bg-popover/40 transition-colors hover:bg-muted/30"
                        >
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                            <PreviewCell
                              value={row.phone}
                              mono
                              maxWidth="max-w-[7.5rem]"
                            />
                          </td>
                          <td className="px-3 py-2 text-popover-foreground">
                            <PreviewCell
                              value={row.name || '—'}
                              maxWidth="max-w-[8.5rem]"
                            />
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            <PreviewCell
                              value={row.email || '—'}
                              maxWidth="max-w-[10rem]"
                            />
                          </td>
                          {previewHasCompany && (
                            <td className="px-3 py-2 text-muted-foreground">
                              <PreviewCell
                                value={row.company || '—'}
                                maxWidth="max-w-[7rem]"
                              />
                            </td>
                          )}
                          {previewHasTags && (
                            <td className="px-3 py-2 align-top">
                              <ImportPreviewTags
                                tagNames={row.tagNames}
                                tagColorByKey={tagColorByKey}
                              />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {parsedRows.length > PREVIEW_LIMIT && (
                <p className="text-center text-[11px] text-muted-foreground">
                  {t('moreRows', {
                    count: parsedRows.length - PREVIEW_LIMIT,
                  })}
                </p>
              )}
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-border bg-background/50 p-4">
              <p className="text-sm font-medium text-popover-foreground">
                {t('importComplete')}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                {result.imported > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-primary">
                    <CheckCircle className="size-4 shrink-0" />
                    {t('resultImported', { count: result.imported })}
                  </div>
                )}
                {result.tagsAssigned > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-cyan-400">
                    <CheckCircle className="size-4 shrink-0" />
                    {t('resultTags', { count: result.tagsAssigned })}
                  </div>
                )}
                {result.skipped > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-amber-400">
                    <AlertTriangle className="size-4 shrink-0" />
                    {t('resultSkipped', { count: result.skipped })}
                  </div>
                )}
                {result.failed > 0 && (
                  <div className="flex items-center gap-1.5 text-sm text-red-400">
                    <XCircle className="size-4 shrink-0" />
                    {t('resultFailed', { count: result.failed })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-0 shrink-0 gap-2 border-t border-border/80 bg-background/50 px-6 py-4 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={importing}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            {result ? t('close') : t('cancel')}
          </Button>

          {!result && (
            <Button
              type="button"
              disabled={
                parsedRows.length === 0 ||
                importing ||
                parsingFile ||
                entitlementsLoading ||
                !entitlements ||
                !accountId
              }
              onClick={handleImport}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {importing && <Loader2 className="size-4 animate-spin" />}
              {t('importBtn', { count: parsedRows.length })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
