'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useAccountEntitlements } from '@/hooks/use-account-entitlements';
import { PLAN_DISPLAY_NAMES } from '@/lib/billing/plan-permissions';
import { toast } from 'sonner';
import type { Contact, ContactTag, Tag } from '@/types';
import {
  findExistingContact,
  isExactMatch,
  isUniqueViolation,
  type ExistingContact,
} from '@/lib/contacts/dedupe';
import {
  isValidOptionalBrazilianPhone,
  normalizeOptionalPhone,
} from '@/lib/phone';
import {
  CONTACT_SOURCE_EMPTY_VALUE,
  CONTACT_SOURCE_OPTIONS,
  getContactSourceLabel,
  normalizeContactSourceForDatabase,
} from '@/lib/contacts/source';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  contactTags?: ContactTag[];
  onSaved: () => void | Promise<void>;
  onViewExisting?: (contactId: string) => void;
}

type DuplicateMatch = {
  contact: ExistingContact;
  exact: boolean;
};

type ContactWithLeadSource = Contact & {
  lead_source?: string | null;
};

function isValidEmail(value: string): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function ContactForm({
  open,
  onOpenChange,
  contact = null,
  contactTags = [],
  onSaved,
  onViewExisting,
}: ContactFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const { accountId } = useAuth();
  const { entitlements, loading: entitlementsLoading } = useAccountEntitlements(accountId);

  const isEdit = Boolean(contact?.id);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [leadSource, setLeadSource] = useState('');

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [tagsError, setTagsError] = useState(false);

  const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [saving, setSaving] = useState(false);

  const sourceOptions = useMemo(() => {
    const normalizedCurrentSource = leadSource.trim();
    const defaultSources = CONTACT_SOURCE_OPTIONS.map((option) => option.value) as string[];

    if (
      normalizedCurrentSource &&
      !defaultSources.some((source) => source.toLocaleLowerCase('pt-BR') === normalizedCurrentSource.toLocaleLowerCase('pt-BR'))
    ) {
      return [normalizedCurrentSource, ...defaultSources];
    }

    return defaultSources;
  }, [leadSource]);

  const resetForm = useCallback(() => {
    const currentContact = contact as ContactWithLeadSource | null;

    setName(contact?.name ?? '');
    setPhone(contact?.phone ?? '');
    setEmail(contact?.email ?? '');
    setCompany(contact?.company ?? '');
    const normalizedSource = normalizeContactSourceForDatabase(currentContact?.lead_source);
    setLeadSource(normalizedSource ? getContactSourceLabel(normalizedSource) : '');
    setSelectedTagIds(contactTags.map((item) => item.tag_id));
    setDuplicate(null);
    setTagsError(false);
  }, [contact, contactTags]);

  const loadTags = useCallback(async () => {
    if (!accountId) {
      setTags([]);
      return;
    }

    setLoadingTags(true);
    setTagsError(false);

    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('account_id', accountId)
      .order('name', { ascending: true });

    if (error) {
      setTags([]);
      setTagsError(true);
      console.warn('[contacts:tags:load]', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    } else {
      setTags((data ?? []) as Tag[]);
    }

    setLoadingTags(false);
  }, [accountId, supabase]);

  useEffect(() => {
    if (!open) return;

    resetForm();
    void loadTags();
  }, [open, resetForm, loadTags]);

  function handleDialogChange(nextOpen: boolean) {
    if (saving) return;
    onOpenChange(nextOpen);
  }

  async function checkDuplicatePhone() {
    if (!accountId || !phone.trim()) {
      setDuplicate(null);
      return;
    }

    setCheckingDuplicate(true);

    try {
      const existing = await findExistingContact(
        supabase,
        accountId,
        phone.trim(),
      );

      if (!existing || existing.id === contact?.id) {
        setDuplicate(null);
        return;
      }

      setDuplicate({
        contact: existing,
        exact: isExactMatch(existing, phone.trim()),
      });
    } catch (error) {
      console.warn('[contacts:duplicate:check]', error);
      setDuplicate(null);
    } finally {
      setCheckingDuplicate(false);
    }
  }

  function toggleTag(tagId: string) {
    if (saving) return;

    setSelectedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((id) => id !== tagId)
        : [...current, tagId],
    );
  }

  async function syncTags(contactId: string) {
    if (!accountId) return;

    const { data: existingRows, error: existingError } = await supabase
      .from('contact_tags')
      .select('tag_id')
      .eq('contact_id', contactId);

    if (existingError) throw existingError;

    const existingIds = new Set(
      (existingRows ?? []).map((row) => row.tag_id as string),
    );
    const selectedIds = new Set(selectedTagIds);

    const idsToRemove = [...existingIds].filter((id) => !selectedIds.has(id));
    const idsToAdd = [...selectedIds].filter((id) => !existingIds.has(id));

    if (idsToRemove.length > 0) {
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .in('tag_id', idsToRemove);

      if (error) throw error;
    }

    if (idsToAdd.length > 0) {
      const rows = idsToAdd.map((tagId) => ({
        contact_id: contactId,
        tag_id: tagId,
      }));

      const { error } = await supabase.from('contact_tags').insert(rows);
      if (error) throw error;
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();
    const cleanCompany = company.trim();
    const cleanLeadSource = normalizeContactSourceForDatabase(leadSource);

    if (!accountId) {
      toast.error('Sua conta ainda não foi carregada. Atualize a página.');
      return;
    }

    if (!cleanName) {
      toast.error('Informe o nome do contato.');
      return;
    }

    if (!isValidOptionalBrazilianPhone(cleanPhone)) {
      toast.error('Informe um telefone válido com DDD.');
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      toast.error('Informe um e-mail válido.');
      return;
    }

    if (duplicate?.exact) {
      toast.error('Já existe um contato com esse telefone.');
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw authError ?? new Error('Usuário não autenticado.');
      }

      const payload = {
        name: cleanName,
        phone: normalizeOptionalPhone(cleanPhone),
        email: cleanEmail || null,
        company: cleanCompany || null,
        lead_source: cleanLeadSource,
      };

      let savedContactId: string;

      if (isEdit && contact?.id) {
        const { data, error } = await supabase
          .from('contacts')
          .update(payload)
          .eq('id', contact.id)
          .eq('account_id', accountId)
          .select('id')
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          throw new Error('Contato não encontrado nesta conta.');
        }

        savedContactId = data.id;
      } else {
        const { data, error } = await supabase
          .from('contacts')
          .insert({
            ...payload,
            user_id: user.id,
            account_id: accountId,
          })
          .select('id')
          .single();

        if (error) throw error;
        savedContactId = data.id;
      }

      try {
        await syncTags(savedContactId);
      } catch (tagError) {
        console.warn('[contacts:tags:save]', tagError);
        toast.warning(
          'O contato foi salvo, mas não foi possível atualizar as etiquetas.',
        );
      }

      toast.success(isEdit ? 'Contato atualizado.' : 'Contato adicionado.');
      onOpenChange(false);

      try {
        await onSaved();
      } catch (refreshError) {
        console.warn('[contacts:refresh]', refreshError);
      }
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        toast.error('Já existe um contato com esse telefone.');

        if (!isEdit && accountId) {
          try {
            const existing = await findExistingContact(
              supabase,
              accountId,
              cleanPhone,
            );

            if (existing) {
              setDuplicate({
                contact: existing,
                exact: true,
              });
            }
          } catch {
            // A mensagem de duplicidade já foi exibida.
          }
        }

        return;
      }

      const databaseError = error as {
        message?: string;
        code?: string;
        details?: string;
        hint?: string;
      };

      console.warn('[contacts:save]', {
        message: databaseError?.message,
        code: databaseError?.code,
        details: databaseError?.details,
        hint: databaseError?.hint,
      });

      const message = databaseError?.message ?? '';

      if (message.includes('row-level security')) {
        toast.error(
          'Você não tem permissão para salvar contatos nesta conta.',
        );
      } else if (message.includes('billing_limit_reached:contacts:')) {
        const limit = Number(message.match(/billing_limit_reached:contacts:(\d+)/)?.[1] ?? entitlements?.limits.contacts ?? 0);
        const planName = entitlements ? PLAN_DISPLAY_NAMES[entitlements.effectivePlan] : 'atual';
        toast.error(`Seu plano ${planName} permite até ${limit.toLocaleString('pt-BR')} contatos. Exclua um contato que não utiliza ou aumente sua capacidade.`);
      } else if (
        message.includes('schema cache') ||
        message.includes('lead_source')
      ) {
        toast.error(
          'O campo de origem ainda não existe no banco de dados. Aplique a migration da coluna lead_source.',
        );
      } else {
        toast.error('Não foi possível salvar o contato.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-popover text-popover-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar contato' : 'Adicionar contato'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Atualize os dados principais deste contato.'
              : 'Cadastre um novo contato na sua conta.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contact-name">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome do contato"
                autoComplete="name"
                disabled={saving}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contact-phone">Telefone</Label>
              <PhoneInput
                id="contact-phone"
                value={phone}
                onChange={(event) => {
                  setPhone(event.target.value);
                  setDuplicate(null);
                }}
                onBlur={() => void checkDuplicatePhone()}
                placeholder="(11) 99999-9999"
                disabled={saving}
              />

              {checkingDuplicate && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Verificando telefone...
                </p>
              )}

              {duplicate && (
                <div
                  className={
                    duplicate.exact
                      ? 'flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive'
                      : 'flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300'
                  }
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <div className="space-y-1">
                    <p>
                      {duplicate.exact
                        ? 'Esse telefone já pertence a outro contato.'
                        : 'Encontramos um contato com telefone semelhante.'}
                    </p>

                    {onViewExisting && (
                      <button
                        type="button"
                        className="font-medium underline underline-offset-2"
                        onClick={() => onViewExisting(duplicate.contact.id)}
                      >
                        Abrir contato existente
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-email">E-mail</Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="contato@empresa.com"
                autoComplete="email"
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact-company">Empresa</Label>
              <Input
                id="contact-company"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="Nome da empresa"
                autoComplete="organization"
                disabled={saving}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="contact-lead-source">Origem do contato</Label>

              <Select
                value={leadSource || CONTACT_SOURCE_EMPTY_VALUE}
                onValueChange={(value) =>
                  setLeadSource(normalizeContactSourceForDatabase(value) ?? '')
                }
                disabled={saving}
              >
                <SelectTrigger id="contact-lead-source" className="w-full">
                  <SelectValue placeholder="Selecione a origem do contato" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value={CONTACT_SOURCE_EMPTY_VALUE}>
                    Não informado
                  </SelectItem>

                  {sourceOptions.map((source) => (
                    <SelectItem key={source} value={source}>
                      {getContactSourceLabel(source)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <p className="text-xs text-muted-foreground">
                Essa informação será utilizada nos relatórios de aquisição.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Etiquetas</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Selecione as etiquetas relacionadas ao contato.
              </p>
            </div>

            {loadingTags ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Carregando etiquetas...
              </div>
            ) : tagsError ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs text-muted-foreground">
                  Não foi possível carregar as etiquetas.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadTags()}
                  disabled={saving}
                >
                  <RefreshCw className="size-3.5" />
                  Tentar novamente
                </Button>
              </div>
            ) : tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma etiqueta disponível.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  const color =
                    typeof tag.color === 'string' && tag.color
                      ? tag.color
                      : '#64748b';

                  return (
                    <button
                      key={tag.id}
                      type="button"
                      disabled={saving}
                      onClick={() => toggleTag(tag.id)}
                      aria-pressed={selected}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        selected
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        color,
                        borderColor: `${color}70`,
                        backgroundColor: `${color}18`,
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={
                saving ||
                checkingDuplicate ||
                Boolean(duplicate?.exact) ||
                (!isEdit && entitlementsLoading) ||
                !accountId
              }
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {saving
                ? 'Salvando...'
                : isEdit
                  ? 'Salvar alterações'
                  : 'Adicionar contato'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
