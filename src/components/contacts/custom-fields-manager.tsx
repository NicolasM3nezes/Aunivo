'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import type { CustomField } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface CustomFieldsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DatabaseError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const FIELD_NAME_MAX_LENGTH = 80;

function normalizeFieldName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeFieldNameForComparison(value: string): string {
  return normalizeFieldName(value).toLocaleLowerCase('pt-BR');
}

function sortFields(fields: CustomField[]): CustomField[] {
  return [...fields].sort((first, second) =>
    first.field_name.localeCompare(second.field_name, 'pt-BR', {
      sensitivity: 'base',
      numeric: true,
    }),
  );
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  return (error as DatabaseError).code === '23505';
}

function logDatabaseError(scope: string, error: unknown) {
  const databaseError =
    error && typeof error === 'object'
      ? (error as DatabaseError)
      : undefined;

  console.error(scope, {
    message:
      databaseError?.message ??
      (error instanceof Error ? error.message : String(error)),
    code: databaseError?.code,
    details: databaseError?.details,
    hint: databaseError?.hint,
  });
}

/**
 * Dialog used on the Contacts page to manage account-wide custom fields.
 */
export function CustomFieldsManager({
  open,
  onOpenChange,
}: CustomFieldsManagerProps) {
  const t = useTranslations('Contacts.customFields');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            {t('title')}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t('desc')}
          </DialogDescription>
        </DialogHeader>

        <CustomFieldsPanel />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Creates, renames and removes account-wide contact field definitions.
 * Per-contact values are managed in the contact details view.
 */
export function CustomFieldsPanel() {
  const t = useTranslations('Contacts.customFields');
  const supabase = useMemo(() => createClient(), []);
  const { user, accountId } = useAuth();

  const requestIdRef = useRef(0);

  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchFields = useCallback(
    async (showLoading = true) => {
      const requestId = ++requestIdRef.current;

      if (!accountId) {
        setFields([]);
        setLoadError(false);
        setLoading(false);
        return;
      }

      if (showLoading) setLoading(true);
      setLoadError(false);

      try {
        const { data, error } = await supabase
          .from('custom_fields')
          .select('*')
          .eq('account_id', accountId)
          .order('field_name', { ascending: true });

        if (error) throw error;
        if (requestId !== requestIdRef.current) return;

        setFields(sortFields((data as CustomField[] | null) ?? []));
      } catch (error) {
        if (requestId !== requestIdRef.current) return;

        logDatabaseError('[custom-fields:list]', error);
        setLoadError(true);

        if (showLoading) {
          setFields([]);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [accountId, supabase],
  );

  useEffect(() => {
    void fetchFields(true);

    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchFields]);

  function isDuplicate(name: string, exceptId?: string): boolean {
    const normalizedName = normalizeFieldNameForComparison(name);

    return fields.some(
      (field) =>
        field.id !== exceptId &&
        normalizeFieldNameForComparison(field.field_name) === normalizedName,
    );
  }

  async function handleCreate() {
    const name = normalizeFieldName(newName);

    if (!name || creating || busyId) return;

    if (!accountId || !user) {
      toast.error(t('toastNoAccount'));
      return;
    }

    if (name.length > FIELD_NAME_MAX_LENGTH) {
      toast.error(
        `O nome do campo deve ter no máximo ${FIELD_NAME_MAX_LENGTH} caracteres.`,
      );
      return;
    }

    if (isDuplicate(name)) {
      toast.error(t('toastDuplicate', { name }));
      return;
    }

    setCreating(true);

    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .insert({
          field_name: name,
          field_type: 'text',
          user_id: user.id,
          account_id: accountId,
        })
        .select('*')
        .single();

      if (error) throw error;

      const createdField = data as CustomField;
      setFields((current) => sortFields([...current, createdField]));
      setNewName('');
      toast.success(t('toastCreated', { name }));
    } catch (error) {
      logDatabaseError('[custom-fields:create]', error);

      if (isUniqueViolation(error)) {
        toast.error(t('toastDuplicate', { name }));
      } else {
        toast.error(t('toastCreateFailed'));
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(
    field: CustomField,
    nextName: string,
  ): Promise<boolean> {
    const name = normalizeFieldName(nextName);

    if (!name) {
      toast.error('O nome do campo não pode ficar vazio.');
      return false;
    }

    if (name === field.field_name) return true;

    if (!accountId) {
      toast.error(t('toastNoAccount'));
      return false;
    }

    if (name.length > FIELD_NAME_MAX_LENGTH) {
      toast.error(
        `O nome do campo deve ter no máximo ${FIELD_NAME_MAX_LENGTH} caracteres.`,
      );
      return false;
    }

    if (isDuplicate(name, field.id)) {
      toast.error(t('toastDuplicate', { name }));
      return false;
    }

    setBusyId(field.id);

    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .update({ field_name: name })
        .eq('id', field.id)
        .eq('account_id', accountId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Campo personalizado não encontrado.');

      setFields((current) =>
        sortFields(
          current.map((currentField) =>
            currentField.id === field.id
              ? { ...currentField, field_name: name }
              : currentField,
          ),
        ),
      );

      return true;
    } catch (error) {
      logDatabaseError('[custom-fields:rename]', error);

      if (isUniqueViolation(error)) {
        toast.error(t('toastDuplicate', { name }));
      } else {
        toast.error(t('toastRenameFailed'));
      }

      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(field: CustomField) {
    if (!accountId || busyId || creating) return;

    const confirmed = window.confirm(
      t('deleteConfirm', { name: field.field_name }),
    );

    if (!confirmed) return;

    setBusyId(field.id);

    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .delete()
        .eq('id', field.id)
        .eq('account_id', accountId)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Campo personalizado não encontrado.');

      setFields((current) =>
        current.filter((currentField) => currentField.id !== field.id),
      );

      toast.success(t('toastDeleted', { name: field.field_name }));
    } catch (error) {
      logDatabaseError('[custom-fields:delete]', error);
      toast.error(t('toastDeleteFailed'));
    } finally {
      setBusyId(null);
    }
  }

  const hasActiveOperation = creating || busyId !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void handleCreate();
            }
          }}
          maxLength={FIELD_NAME_MAX_LENGTH}
          placeholder={t('fieldName')}
          disabled={loading || hasActiveOperation || !accountId}
          className="bg-muted text-foreground"
        />

        <Button
          type="button"
          onClick={() => void handleCreate()}
          disabled={
            loading ||
            hasActiveOperation ||
            !accountId ||
            !normalizeFieldName(newName)
          }
          className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {creating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {t('addField')}
        </Button>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-md border border-border">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('loading')}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar os campos personalizados.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchFields(true)}
              disabled={hasActiveOperation}
            >
              <RefreshCw className="size-4" />
              Tentar novamente
            </Button>
          </div>
        ) : fields.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t('empty')}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {fields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                busy={busyId === field.id}
                disabled={hasActiveOperation}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface FieldRowProps {
  field: CustomField;
  busy: boolean;
  disabled: boolean;
  onRename: (field: CustomField, name: string) => Promise<boolean>;
  onDelete: (field: CustomField) => Promise<void>;
}

function FieldRow({
  field,
  busy,
  disabled,
  onRename,
  onDelete,
}: FieldRowProps) {
  const t = useTranslations('Contacts.customFields');
  const [name, setName] = useState(field.field_name);
  const committingRef = useRef(false);

  useEffect(() => {
    setName(field.field_name);
  }, [field.field_name]);

  async function commit() {
    if (committingRef.current || busy) return;

    const normalizedName = normalizeFieldName(name);

    if (!normalizedName || normalizedName === field.field_name) {
      setName(field.field_name);
      return;
    }

    committingRef.current = true;

    try {
      const succeeded = await onRename(field, normalizedName);
      setName(succeeded ? normalizedName : field.field_name);
    } finally {
      committingRef.current = false;
    }
  }

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <Input
        value={name}
        disabled={disabled}
        maxLength={FIELD_NAME_MAX_LENGTH}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }

          if (event.key === 'Escape') {
            setName(field.field_name);
            event.currentTarget.blur();
          }
        }}
        aria-label={t('renameAria', { name: field.field_name })}
        className="h-8 border-transparent bg-transparent text-foreground hover:border-border focus:border-primary"
      />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => void onDelete(field)}
        title={t('deleteTitle')}
        aria-label={t('deleteTitle')}
        className="shrink-0 text-muted-foreground hover:text-red-400"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
      </Button>
    </li>
  );
}
