"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  BriefcaseBusiness,
  Building2,
  Check,
  Copy,
  DollarSign,
  ExternalLink,
  LayoutTemplate,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Save,
  StickyNote,
  Tags,
  Trash2,
  UserRound,
  ListFilter,
  ListTodo,
} from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/currency";
import {
  formatBrazilianPhone,
  isValidBrazilianPhone,
  normalizePhone,
} from "@/lib/phone";
import { normalizeError } from "@/lib/errors/normalize-error";
import {
  findExistingContact,
  isExactMatch,
  isUniqueViolation,
  type ExistingContact,
} from "@/lib/contacts/dedupe";
import type {
  ContactNote,
  CustomField,
  Deal,
  MessageTemplate,
  Tag,
} from "@/types";

import {
  TemplatePicker,
  type TemplateSendValues,
} from "@/components/inbox/template-picker";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Textarea } from "@/components/ui/textarea";
import { RelatedTasks } from "@/components/tasks/related-tasks";

interface ContactDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  onUpdated: () => void | Promise<void>;
}

/**
 * Estrutura mínima e compatível com a tabela contacts atual.
 *
 * Não adicione estimated_value, last_contact_at ou next_follow_up_at aqui
 * enquanto essas colunas não existirem no banco.
 */
type ContactRecord = {
  id: string;
  account_id: string;
  name: string | null;
  phone: string;
  email: string | null;
  company: string | null;
};

type DuplicatePhone = {
  contact: ExistingContact;
  exact: boolean;
};

type SectionName = "tags" | "notes" | "custom" | "deals";

type SectionErrors = Record<SectionName, string | null>;

type CustomValueIdMap = Record<string, string>;

const CONTACT_SELECT =
  "id, account_id, name, phone, email, company";

const EMPTY_SECTION_ERRORS: SectionErrors = {
  tags: null,
  notes: null,
  custom: null,
  deals: null,
};

function getInitials(name?: string | null): string {
  if (!name?.trim()) return "?";

  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function isValidEmail(value: string): boolean {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function safeTagColor(value?: string | null): string {
  if (value && /^#[0-9a-f]{6}$/i.test(value)) return value;
  return "#64748b";
}

function getDealStatusLabel(status?: string | null): string {
  if (status === "won") return "Ganho";
  if (status === "lost") return "Perdido";
  return status ?? "";
}

function getCustomFieldInputType(fieldType?: string | null) {
  if (fieldType === "number") return "number";
  if (fieldType === "date") return "date";
  if (fieldType === "email") return "email";
  if (fieldType === "url") return "url";
  return "text";
}

function getWhatsAppNumber(phone: string): string {
  const digits = normalizePhone(phone).replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("55") && digits.length >= 12) {
    return digits;
  }

  return `55${digits}`;
}

function reportWarning(scope: string, error: unknown) {
  const normalized = normalizeError(error);

  // console.warn evita que erros já tratados apareçam como overlay vermelho
  // do Next.js durante o desenvolvimento.
  console.warn(scope, {
    message: normalized.message,
    code: normalized.code,
    details: normalized.details,
    hint: normalized.hint,
  });
}

function SectionError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-8 text-center">
      <AlertCircle className="size-5 text-destructive" />
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="size-4" />
        Tentar novamente
      </Button>
    </div>
  );
}

function SectionLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
      {label}
    </div>
  );
}

export function ContactDetailView({
  open,
  onOpenChange,
  contactId,
  onUpdated,
}: ContactDetailViewProps) {
  const supabase = useMemo(() => createClient(), []);
  const { user, accountId, defaultCurrency } = useAuth();

  const requestVersionRef = useRef(0);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeTab, setActiveTab] = useState("details");

  const [contact, setContact] = useState<ContactRecord | null>(null);
  const [loadingContact, setLoadingContact] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicatePhone, setDuplicatePhone] =
    useState<DuplicatePhone | null>(null);

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [sendingTemplate, setSendingTemplate] = useState(false);

  const [tags, setTags] = useState<Tag[]>([]);
  const [contactTagIds, setContactTagIds] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [savingTagId, setSavingTagId] = useState<string | null>(null);

  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [customValueIds, setCustomValueIds] =
    useState<CustomValueIdMap>({});
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);

  const [sectionErrors, setSectionErrors] =
    useState<SectionErrors>(EMPTY_SECTION_ERRORS);

  const hasPendingOperation =
    savingDetails ||
    checkingDuplicate ||
    sendingTemplate ||
    savingTagId !== null ||
    savingNote ||
    deletingNoteId !== null ||
    savingCustom;

  const fillContactForm = useCallback((value: ContactRecord) => {
    setName(value.name ?? "");
    setPhone(value.phone ?? "");
    setEmail(value.email ?? "");
    setCompany(value.company ?? "");
    setDuplicatePhone(null);
  }, []);

  const setSectionError = useCallback(
    (section: SectionName, message: string | null) => {
      setSectionErrors((current) => ({
        ...current,
        [section]: message,
      }));
    },
    [],
  );

  const resetView = useCallback(() => {
    setActiveTab("details");

    setContact(null);
    setContactError(null);
    setName("");
    setPhone("");
    setEmail("");
    setCompany("");
    setDuplicatePhone(null);

    setTags([]);
    setContactTagIds([]);

    setNotes([]);
    setNewNote("");

    setCustomFields([]);
    setCustomValues({});
    setCustomValueIds({});

    setDeals([]);
    setSectionErrors(EMPTY_SECTION_ERRORS);

    setTemplatePickerOpen(false);
    setCopiedPhone(false);
  }, []);

  const loadTags = useCallback(
    async (
      targetContactId = contactId,
      targetAccountId = accountId,
      version = requestVersionRef.current,
    ) => {
      if (!targetContactId || !targetAccountId) return;

      setLoadingTags(true);
      setSectionError("tags", null);

      try {
        const [tagsResult, selectedResult] = await Promise.all([
          supabase
            .from("tags")
            .select("*")
            .eq("account_id", targetAccountId)
            .order("name", { ascending: true }),
          supabase
            .from("contact_tags")
            .select("tag_id")
            .eq("contact_id", targetContactId),
        ]);

        if (version !== requestVersionRef.current) return;

        if (tagsResult.error) throw tagsResult.error;
        if (selectedResult.error) throw selectedResult.error;

        setTags((tagsResult.data ?? []) as Tag[]);
        setContactTagIds(
          (selectedResult.data ?? []).map((item) => item.tag_id),
        );
      } catch (error) {
        if (version !== requestVersionRef.current) return;

        reportWarning("[contacts:detail:load-tags]", error);
        setTags([]);
        setContactTagIds([]);
        setSectionError(
          "tags",
          "Não foi possível carregar as etiquetas deste contato.",
        );
      } finally {
        if (version === requestVersionRef.current) {
          setLoadingTags(false);
        }
      }
    },
    [accountId, contactId, setSectionError, supabase],
  );

  const loadNotes = useCallback(
    async (
      targetContactId = contactId,
      targetAccountId = accountId,
      version = requestVersionRef.current,
    ) => {
      if (!targetContactId || !targetAccountId) return;

      setLoadingNotes(true);
      setSectionError("notes", null);

      try {
        const { data, error } = await supabase
          .from("contact_notes")
          .select("*")
          .eq("contact_id", targetContactId)
          .eq("account_id", targetAccountId)
          .order("created_at", { ascending: false });

        if (version !== requestVersionRef.current) return;
        if (error) throw error;

        setNotes((data ?? []) as ContactNote[]);
      } catch (error) {
        if (version !== requestVersionRef.current) return;

        reportWarning("[contacts:detail:load-notes]", error);
        setNotes([]);
        setSectionError(
          "notes",
          "Não foi possível carregar as anotações deste contato.",
        );
      } finally {
        if (version === requestVersionRef.current) {
          setLoadingNotes(false);
        }
      }
    },
    [accountId, contactId, setSectionError, supabase],
  );

  const loadCustomFields = useCallback(
    async (
      targetContactId = contactId,
      targetAccountId = accountId,
      version = requestVersionRef.current,
    ) => {
      if (!targetContactId || !targetAccountId) return;

      setLoadingCustom(true);
      setSectionError("custom", null);

      try {
        const [fieldsResult, valuesResult] = await Promise.all([
          supabase
            .from("custom_fields")
            .select("*")
            .eq("account_id", targetAccountId)
            .order("field_name", { ascending: true }),
          supabase
            .from("contact_custom_values")
            .select("*")
            .eq("contact_id", targetContactId),
        ]);

        if (version !== requestVersionRef.current) return;

        if (fieldsResult.error) throw fieldsResult.error;
        if (valuesResult.error) throw valuesResult.error;

        const loadedFields = (fieldsResult.data ?? []) as CustomField[];
        const allowedFieldIds = new Set(
          loadedFields.map((field) => field.id),
        );

        const valueMap: Record<string, string> = {};
        const valueIdMap: CustomValueIdMap = {};

        for (const item of valuesResult.data ?? []) {
          if (!allowedFieldIds.has(item.custom_field_id)) continue;

          valueMap[item.custom_field_id] = item.value ?? "";
          valueIdMap[item.custom_field_id] = item.id;
        }

        setCustomFields(loadedFields);
        setCustomValues(valueMap);
        setCustomValueIds(valueIdMap);
      } catch (error) {
        if (version !== requestVersionRef.current) return;

        reportWarning("[contacts:detail:load-custom-fields]", error);
        setCustomFields([]);
        setCustomValues({});
        setCustomValueIds({});
        setSectionError(
          "custom",
          "Não foi possível carregar os campos personalizados.",
        );
      } finally {
        if (version === requestVersionRef.current) {
          setLoadingCustom(false);
        }
      }
    },
    [accountId, contactId, setSectionError, supabase],
  );

  const loadDeals = useCallback(
    async (
      targetContactId = contactId,
      targetAccountId = accountId,
      version = requestVersionRef.current,
    ) => {
      if (!targetContactId || !targetAccountId) return;

      setLoadingDeals(true);
      setSectionError("deals", null);

      try {
        const { data, error } = await supabase
          .from("deals")
          .select(
            "id, user_id, pipeline_id, stage_id, contact_id, title, value, currency, status, created_at, stage:pipeline_stages(id, name, color)",
          )
          .eq("contact_id", targetContactId)
          .eq("account_id", targetAccountId)
          .order("created_at", { ascending: false });

        if (version !== requestVersionRef.current) return;
        if (error) throw error;

        setDeals((data ?? []) as unknown as Deal[]);
      } catch (error) {
        if (version !== requestVersionRef.current) return;

        reportWarning("[contacts:detail:load-deals]", error);
        setDeals([]);
        setSectionError(
          "deals",
          "Não foi possível carregar os negócios deste contato.",
        );
      } finally {
        if (version === requestVersionRef.current) {
          setLoadingDeals(false);
        }
      }
    },
    [accountId, contactId, setSectionError, supabase],
  );

  const loadContact = useCallback(async () => {
    if (!contactId || !accountId) return;

    const version = ++requestVersionRef.current;

    setLoadingContact(true);
    setContactError(null);

    try {
      const { data, error } = await supabase
        .from("contacts")
        .select(CONTACT_SELECT)
        .eq("id", contactId)
        .eq("account_id", accountId)
        .maybeSingle();

      if (version !== requestVersionRef.current) return;

      if (error) throw error;
      if (!data) {
        throw new Error("CONTACT_NOT_FOUND");
      }

      const loadedContact = data as ContactRecord;

      setContact(loadedContact);
      fillContactForm(loadedContact);

      // Cada seção cuida do próprio erro. Uma tabela secundária com problema
      // não impede mais a abertura e edição dos dados principais do contato.
      void loadTags(contactId, accountId, version);
      void loadNotes(contactId, accountId, version);
      void loadCustomFields(contactId, accountId, version);
      void loadDeals(contactId, accountId, version);
    } catch (error) {
      if (version !== requestVersionRef.current) return;

      reportWarning("[contacts:detail:load-contact]", error);
      setContact(null);

      const normalized = normalizeError(error);
      setContactError(
        normalized.message === "CONTACT_NOT_FOUND"
          ? "Contato não encontrado nesta conta."
          : "Não foi possível carregar este contato.",
      );
    } finally {
      if (version === requestVersionRef.current) {
        setLoadingContact(false);
      }
    }
  }, [
    accountId,
    contactId,
    fillContactForm,
    loadCustomFields,
    loadDeals,
    loadNotes,
    loadTags,
    supabase,
  ]);

  useEffect(() => {
    if (!open) {
      requestVersionRef.current += 1;
      resetView();
      return;
    }

    resetView();

    if (!contactId) {
      setContactError("Nenhum contato foi selecionado.");
      return;
    }

    if (!accountId) {
      setLoadingContact(true);
      return;
    }

    void loadContact();
  }, [accountId, contactId, loadContact, open, resetView]);

  useEffect(() => {
    return () => {
      requestVersionRef.current += 1;

      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  function handleSheetOpenChange(nextOpen: boolean) {
    if (!nextOpen && hasPendingOperation) {
      toast.info("Aguarde a operação atual terminar.");
      return;
    }

    onOpenChange(nextOpen);
  }

  async function safelyNotifyUpdated() {
    try {
      await onUpdated();
    } catch (error) {
      reportWarning("[contacts:detail:on-updated]", error);
    }
  }

  async function copyPhone() {
    if (!contact?.phone) return;

    try {
      await navigator.clipboard.writeText(contact.phone);

      setCopiedPhone(true);

      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }

      copyTimerRef.current = setTimeout(() => {
        setCopiedPhone(false);
      }, 2_000);
    } catch (error) {
      reportWarning("[contacts:detail:copy-phone]", error);
      toast.error("Não foi possível copiar o telefone.");
    }
  }

  function openWhatsApp() {
    if (!contact?.phone) return;

    const whatsappNumber = getWhatsAppNumber(contact.phone);
    if (!whatsappNumber) {
      toast.error("Telefone inválido para abrir no WhatsApp.");
      return;
    }

    window.open(
      `https://wa.me/${whatsappNumber}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function checkDuplicatePhone() {
    if (!accountId || !phone.trim() || !contactId) {
      setDuplicatePhone(null);
      return;
    }

    setCheckingDuplicate(true);

    try {
      const existing = await findExistingContact(
        supabase,
        accountId,
        phone.trim(),
      );

      if (!existing || existing.id === contactId) {
        setDuplicatePhone(null);
        return;
      }

      setDuplicatePhone({
        contact: existing,
        exact: isExactMatch(existing, phone.trim()),
      });
    } catch (error) {
      reportWarning("[contacts:detail:check-duplicate]", error);
      setDuplicatePhone(null);
    } finally {
      setCheckingDuplicate(false);
    }
  }

  async function saveDetails() {
    if (!contactId || !accountId) {
      toast.error("Sua conta ainda não foi carregada.");
      return;
    }

    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim();
    const cleanCompany = company.trim();

    if (!cleanName) {
      toast.error("Informe o nome do contato.");
      return;
    }

    if (!cleanPhone) {
      toast.error("Informe o telefone do contato.");
      return;
    }

    if (!isValidBrazilianPhone(cleanPhone)) {
      toast.error("Informe um telefone válido com DDD.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    if (duplicatePhone?.exact) {
      toast.error("Outro contato já utiliza este telefone.");
      return;
    }

    setSavingDetails(true);

    try {
      const { data, error } = await supabase
        .from("contacts")
        .update({
          name: cleanName,
          phone: normalizePhone(cleanPhone),
          email: cleanEmail || null,
          company: cleanCompany || null,
        })
        .eq("id", contactId)
        .eq("account_id", accountId)
        .select(CONTACT_SELECT)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error("Contato não encontrado nesta conta.");
      }

      const updatedContact = data as ContactRecord;

      setContact(updatedContact);
      fillContactForm(updatedContact);

      toast.success("Contato atualizado com sucesso.");
      await safelyNotifyUpdated();
    } catch (error) {
      if (isUniqueViolation(error)) {
        toast.error("Outro contato já utiliza este telefone.");
        return;
      }

      reportWarning("[contacts:detail:save]", error);

      const normalized = normalizeError(error);
      if (normalized.message.includes("schema cache")) {
        toast.error(
          "O formulário está tentando usar um campo inexistente no banco.",
        );
      } else if (normalized.message.includes("row-level security")) {
        toast.error(
          "Você não tem permissão para editar este contato.",
        );
      } else {
        toast.error("Não foi possível atualizar o contato.");
      }
    } finally {
      setSavingDetails(false);
    }
  }

  async function toggleTag(tagId: string) {
    if (!contactId || !accountId || savingTagId) return;

    const belongsToAccount = tags.some((tag) => tag.id === tagId);
    if (!belongsToAccount) {
      toast.error("Esta etiqueta não pertence à sua conta.");
      return;
    }

    const wasSelected = contactTagIds.includes(tagId);
    setSavingTagId(tagId);

    try {
      if (wasSelected) {
        const { error } = await supabase
          .from("contact_tags")
          .delete()
          .eq("contact_id", contactId)
          .eq("tag_id", tagId);

        if (error) throw error;

        setContactTagIds((current) =>
          current.filter((id) => id !== tagId),
        );
      } else {
        const { error } = await supabase
          .from("contact_tags")
          .insert({
            contact_id: contactId,
            tag_id: tagId,
          });

        if (error) throw error;

        setContactTagIds((current) =>
          current.includes(tagId)
            ? current
            : [...current, tagId],
        );
      }

      await safelyNotifyUpdated();
    } catch (error) {
      reportWarning("[contacts:detail:toggle-tag]", error);
      toast.error("Não foi possível atualizar a etiqueta.");
    } finally {
      setSavingTagId(null);
    }
  }

  async function addNote() {
    if (!contactId || !accountId) return;

    const cleanNote = newNote.trim();

    if (!cleanNote) {
      toast.error("Escreva uma anotação antes de salvar.");
      return;
    }

    if (cleanNote.length > 2_000) {
      toast.error("A anotação pode ter no máximo 2.000 caracteres.");
      return;
    }

    if (!user?.id) {
      toast.error("Usuário não autenticado.");
      return;
    }

    setSavingNote(true);

    try {
      const { data, error } = await supabase
        .from("contact_notes")
        .insert({
          contact_id: contactId,
          account_id: accountId,
          user_id: user.id,
          note_text: cleanNote,
        })
        .select("*")
        .single();

      if (error) throw error;

      setNotes((current) => [data as ContactNote, ...current]);
      setNewNote("");
      toast.success("Anotação adicionada.");
    } catch (error) {
      reportWarning("[contacts:detail:add-note]", error);
      toast.error("Não foi possível adicionar a anotação.");
    } finally {
      setSavingNote(false);
    }
  }

  async function deleteNote(noteId: string) {
    if (!contactId || !accountId || deletingNoteId) return;

    const confirmed = window.confirm(
      "Deseja realmente excluir esta anotação?",
    );

    if (!confirmed) return;

    setDeletingNoteId(noteId);

    try {
      const { data, error } = await supabase
        .from("contact_notes")
        .delete()
        .eq("id", noteId)
        .eq("contact_id", contactId)
        .eq("account_id", accountId)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Anotação não encontrada.");

      setNotes((current) =>
        current.filter((note) => note.id !== noteId),
      );
      toast.success("Anotação excluída.");
    } catch (error) {
      reportWarning("[contacts:detail:delete-note]", error);
      toast.error("Não foi possível excluir a anotação.");
    } finally {
      setDeletingNoteId(null);
    }
  }

  async function saveCustomFields() {
    if (!contactId || !accountId || savingCustom) return;

    setSavingCustom(true);

    try {
      const allowedFieldIds = new Set(
        customFields.map((field) => field.id),
      );

      for (const field of customFields) {
        if (!allowedFieldIds.has(field.id)) continue;

        const value = (customValues[field.id] ?? "").trim();
        const existingValueId = customValueIds[field.id];

        if (existingValueId && value) {
          const { error } = await supabase
            .from("contact_custom_values")
            .update({ value })
            .eq("id", existingValueId)
            .eq("contact_id", contactId);

          if (error) throw error;
          continue;
        }

        if (existingValueId && !value) {
          const { error } = await supabase
            .from("contact_custom_values")
            .delete()
            .eq("id", existingValueId)
            .eq("contact_id", contactId);

          if (error) throw error;
          continue;
        }

        if (!existingValueId && value) {
          const { error } = await supabase
            .from("contact_custom_values")
            .insert({
              contact_id: contactId,
              custom_field_id: field.id,
              value,
            });

          if (error) throw error;
        }
      }

      await loadCustomFields(
        contactId,
        accountId,
        requestVersionRef.current,
      );

      toast.success("Campos personalizados salvos.");
    } catch (error) {
      reportWarning("[contacts:detail:save-custom-fields]", error);

      // Recarrega os valores para a tela representar o que realmente
      // ficou salvo caso alguma operação intermediária tenha falhado.
      await loadCustomFields(
        contactId,
        accountId,
        requestVersionRef.current,
      );

      toast.error("Não foi possível salvar os campos personalizados.");
    } finally {
      setSavingCustom(false);
    }
  }

  async function handleSendTemplate(
    template: MessageTemplate,
    values: TemplateSendValues,
  ) {
    if (!contactId || !accountId || sendingTemplate) return;

    setSendingTemplate(true);

    try {
      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contact_id: contactId,
          message_type: "template",
          template_name: template.name,
          template_language: template.language,
          template_message_params: {
            body: values.body,
            headerText: values.headerText,
            buttonParams: values.buttonParams,
          },
          template_params: values.body,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const reason =
          typeof payload?.error === "string"
            ? payload.error
            : `HTTP ${response.status}`;

        throw new Error(reason);
      }

      setTemplatePickerOpen(false);
      toast.success(`Template "${template.name}" enviado.`);
    } catch (error) {
      reportWarning("[contacts:detail:send-template]", error);

      const normalized = normalizeError(error);
      toast.error(
        `Não foi possível enviar o template: ${normalized.message}`,
      );
    } finally {
      setSendingTemplate(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          side="right"
          className="w-full max-w-full gap-0 overflow-hidden border-border bg-popover p-0 text-popover-foreground sm:max-w-2xl"
        >
          {loadingContact ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Loader2 className="size-7 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Carregando contato...
              </p>
            </div>
          ) : contactError || !contact ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="size-6 text-destructive" />
              </div>

              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  Não foi possível abrir o contato
                </p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {contactError ??
                    "O contato solicitado não está disponível."}
                </p>
              </div>

              {contactId && accountId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void loadContact()}
                >
                  <RefreshCw className="size-4" />
                  Tentar novamente
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              <SheetHeader className="shrink-0 border-b border-border/70 bg-background/30 p-5 text-left">
                <div className="flex items-start gap-4">
                  <Avatar className="size-14 shrink-0 border border-border shadow-sm">
                    <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                      {getInitials(contact.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <SheetTitle className="truncate text-xl text-foreground">
                      {contact.name || "Contato sem nome"}
                    </SheetTitle>

                    <SheetDescription className="mt-1 text-sm">
                      Informações, etiquetas, anotações e negócios do
                      contato.
                    </SheetDescription>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => void copyPhone()}
                        className="inline-flex items-center gap-1.5 transition-colors hover:text-primary"
                      >
                        <Phone className="size-3.5" />
                        {formatBrazilianPhone(contact.phone)}
                        {copiedPhone ? (
                          <Check className="size-3.5 text-primary" />
                        ) : (
                          <Copy className="size-3.5" />
                        )}
                      </button>

                      {contact.email ? (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <Mail className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {contact.email}
                          </span>
                        </span>
                      ) : null}

                      {contact.company ? (
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <Building2 className="size-3.5 shrink-0" />
                          <span className="truncate">
                            {contact.company}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" render={<Link href={`/tasks?new=1&contact_id=${contact.id}`} />}>
                    <ListTodo className="size-4" />Nova tarefa
                  </Button>
                  <Button
  type="button"
  size="sm"
  variant="outline"
  onClick={openWhatsApp}
  aria-label="Abrir conversa no WhatsApp"
  className="
    group gap-2
    border-emerald-500/40
    text-emerald-700
    transition-colors
    hover:border-emerald-500
    hover:bg-emerald-500/10
    hover:text-emerald-700
    dark:text-emerald-400
    dark:hover:text-emerald-400
  "
>
  <MessageCircle className="size-4" />

  <span>Abrir WhatsApp</span>

  <ExternalLink
    className="
      size-3.5 opacity-60
      transition-transform
      group-hover:-translate-y-0.5
      group-hover:translate-x-0.5
    "
  />
</Button>

                  
                </div>
              </SheetHeader>

              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="shrink-0 overflow-x-auto border-b border-border/60 px-4 py-3">
                  <TabsList className="h-auto w-max min-w-full justify-start bg-muted/60 p-1">
                    <TabsTrigger
                      value="details"
                      className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-primary"
                    >
                      <UserRound className="size-3.5" />
                      Dados
                    </TabsTrigger>

                    <TabsTrigger
                      value="tags"
                      className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-primary"
                    >
                      <Tags className="size-3.5" />
                      Etiquetas
                    </TabsTrigger>

                    <TabsTrigger
                      value="notes"
                      className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-primary"
                    >
                      <StickyNote className="size-3.5" />
                      Anotações
                    </TabsTrigger>

                    <TabsTrigger
                      value="custom"
                      className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-primary"
                    >
                      <ListFilter className="size-3.5" />
                      Personalizados
                    </TabsTrigger>

                    <TabsTrigger
                      value="deals"
                      className="gap-1.5 data-[state=active]:bg-background data-[state=active]:text-primary"
                    >
                      <BriefcaseBusiness className="size-3.5" />
                      Negócios
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent
                  value="details"
                  className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-5"
                >
                  <div className="mx-auto max-w-xl space-y-5">
                    <RelatedTasks contactId={contact.id} />
                    <div className="rounded-xl border border-border bg-background/40 p-4">
                      <div className="mb-4">
                        <h3 className="font-medium text-foreground">
                          Dados principais
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Atualize as informações de identificação e
                          contato.
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="contact-detail-name">
                            Nome{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="contact-detail-name"
                            value={name}
                            onChange={(event) =>
                              setName(event.target.value)
                            }
                            disabled={savingDetails}
                            placeholder="Nome do contato"
                            autoComplete="name"
                          />
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="contact-detail-phone">
                            Telefone{" "}
                            <span className="text-destructive">*</span>
                          </Label>
                          <PhoneInput
                            id="contact-detail-phone"
                            value={phone}
                            onChange={(event) => {
                              setPhone(event.target.value);
                              setDuplicatePhone(null);
                            }}
                            onBlur={() =>
                              void checkDuplicatePhone()
                            }
                            disabled={savingDetails}
                            placeholder="(11) 99999-9999"
                          />

                          {checkingDuplicate ? (
                            <p className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Loader2 className="size-3 animate-spin" />
                              Verificando telefone...
                            </p>
                          ) : null}

                          {duplicatePhone ? (
                            <div
                              className={
                                duplicatePhone.exact
                                  ? "flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
                                  : "flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-300"
                              }
                            >
                              <AlertCircle className="mt-0.5 size-4 shrink-0" />
                              <p>
                                {duplicatePhone.exact
                                  ? `Este telefone já pertence a ${
                                      duplicatePhone.contact.name ||
                                      "outro contato"
                                    }.`
                                  : `Existe um telefone semelhante em ${
                                      duplicatePhone.contact.name ||
                                      "outro contato"
                                    }.`}
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="contact-detail-email">
                            E-mail
                          </Label>
                          <Input
                            id="contact-detail-email"
                            type="email"
                            value={email}
                            onChange={(event) =>
                              setEmail(event.target.value)
                            }
                            disabled={savingDetails}
                            placeholder="contato@empresa.com"
                            autoComplete="email"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="contact-detail-company">
                            Empresa
                          </Label>
                          <Input
                            id="contact-detail-company"
                            value={company}
                            onChange={(event) =>
                              setCompany(event.target.value)
                            }
                            disabled={savingDetails}
                            placeholder="Nome da empresa"
                            autoComplete="organization"
                          />
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={() => void saveDetails()}
                      disabled={
                        savingDetails ||
                        checkingDuplicate ||
                        Boolean(duplicatePhone?.exact)
                      }
                      className="w-full"
                    >
                      {savingDetails ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      {savingDetails
                        ? "Salvando..."
                        : "Salvar alterações"}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent
                  value="tags"
                  className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-5"
                >
                  {loadingTags ? (
                    <SectionLoader label="Carregando etiquetas..." />
                  ) : sectionErrors.tags ? (
                    <SectionError
                      message={sectionErrors.tags}
                      onRetry={() => void loadTags()}
                    />
                  ) : tags.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border py-12 text-center">
                      <Tags className="mx-auto size-6 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">
                        Nenhuma etiqueta disponível
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Crie etiquetas para organizar seus contatos.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium text-foreground">
                          Etiquetas do contato
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Clique para adicionar ou remover uma etiqueta.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => {
                          const selected =
                            contactTagIds.includes(tag.id);
                          const saving = savingTagId === tag.id;
                          const color = safeTagColor(tag.color);

                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() =>
                                void toggleTag(tag.id)
                              }
                              disabled={savingTagId !== null}
                              aria-pressed={selected}
                              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                selected
                                  ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                                  : "opacity-65 hover:opacity-100"
                              }`}
                              style={{
                                color,
                                borderColor: `${color}70`,
                                backgroundColor: `${color}18`,
                              }}
                            >
                              {saving ? (
                                <Loader2 className="mr-1.5 size-3 animate-spin" />
                              ) : selected ? (
                                <Check className="mr-1.5 size-3" />
                              ) : null}
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent
                  value="notes"
                  className="mt-0 flex min-h-0 flex-1 flex-col px-5 py-5"
                >
                  {sectionErrors.notes ? (
                    <SectionError
                      message={sectionErrors.notes}
                      onRetry={() => void loadNotes()}
                    />
                  ) : (
                    <>
                      <div className="shrink-0 rounded-xl border border-border bg-background/40 p-4">
                        <Label htmlFor="contact-new-note">
                          Nova anotação
                        </Label>

                        <Textarea
                          id="contact-new-note"
                          value={newNote}
                          onChange={(event) =>
                            setNewNote(
                              event.target.value.slice(0, 2_000),
                            )
                          }
                          disabled={savingNote}
                          placeholder="Registre informações importantes sobre este contato..."
                          className="mt-2 min-h-24 resize-none"
                        />

                        <div className="mt-2 flex items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground">
                            {newNote.length}/2.000
                          </span>

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void addNote()}
                            disabled={!newNote.trim() || savingNote}
                          >
                            {savingNote ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Plus className="size-4" />
                            )}
                            Adicionar
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
                        {loadingNotes ? (
                          <SectionLoader label="Carregando anotações..." />
                        ) : notes.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border py-12 text-center">
                            <StickyNote className="mx-auto size-6 text-muted-foreground" />
                            <p className="mt-3 text-sm font-medium">
                              Nenhuma anotação
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              As anotações adicionadas aparecerão aqui.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3 pb-2">
                            {notes.map((note) => (
                              <article
                                key={note.id}
                                className="group rounded-xl border border-border bg-background/40 p-4"
                              >
                                <div className="flex items-start gap-3">
                                  <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/85">
                                    {note.note_text}
                                  </p>

                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      void deleteNote(note.id)
                                    }
                                    disabled={
                                      deletingNoteId !== null
                                    }
                                    aria-label="Excluir anotação"
                                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                                  >
                                    {deletingNoteId === note.id ? (
                                      <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="size-4" />
                                    )}
                                  </Button>
                                </div>

                                <p className="mt-3 text-xs text-muted-foreground">
                                  {new Date(
                                    note.created_at,
                                  ).toLocaleString("pt-BR", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent
                  value="custom"
                  className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-5"
                >
                  {loadingCustom ? (
                    <SectionLoader label="Carregando campos personalizados..." />
                  ) : sectionErrors.custom ? (
                    <SectionError
                      message={sectionErrors.custom}
                      onRetry={() => void loadCustomFields()}
                    />
                  ) : customFields.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border py-12 text-center">
                      <ListFilter className="mx-auto size-6 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">
                        Nenhum campo personalizado
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Crie campos personalizados nas configurações.
                      </p>
                    </div>
                  ) : (
                    <div className="mx-auto max-w-xl space-y-4">
                      <div>
                        <h3 className="font-medium text-foreground">
                          Informações personalizadas
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Preencha dados adicionais específicos deste
                          contato.
                        </p>
                      </div>

                      <div className="space-y-4 rounded-xl border border-border bg-background/40 p-4">
                        {customFields.map((field) => {
                          const fieldType = (
                            field as CustomField & {
                              field_type?: string | null;
                            }
                          ).field_type;

                          return (
                            <div
                              key={field.id}
                              className="space-y-2"
                            >
                              <Label
                                htmlFor={`contact-custom-${field.id}`}
                              >
                                {field.field_name}
                              </Label>

                              {fieldType === "textarea" ? (
                                <Textarea
                                  id={`contact-custom-${field.id}`}
                                  value={
                                    customValues[field.id] ?? ""
                                  }
                                  onChange={(event) =>
                                    setCustomValues((current) => ({
                                      ...current,
                                      [field.id]:
                                        event.target.value,
                                    }))
                                  }
                                  disabled={savingCustom}
                                  className="min-h-20 resize-none"
                                />
                              ) : (
                                <Input
                                  id={`contact-custom-${field.id}`}
                                  type={getCustomFieldInputType(
                                    fieldType,
                                  )}
                                  value={
                                    customValues[field.id] ?? ""
                                  }
                                  onChange={(event) =>
                                    setCustomValues((current) => ({
                                      ...current,
                                      [field.id]:
                                        event.target.value,
                                    }))
                                  }
                                  disabled={savingCustom}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <Button
                        type="button"
                        onClick={() => void saveCustomFields()}
                        disabled={savingCustom}
                        className="w-full"
                      >
                        {savingCustom ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Save className="size-4" />
                        )}
                        {savingCustom
                          ? "Salvando..."
                          : "Salvar campos personalizados"}
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent
                  value="deals"
                  className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-5"
                >
                  {loadingDeals ? (
                    <SectionLoader label="Carregando negócios..." />
                  ) : sectionErrors.deals ? (
                    <SectionError
                      message={sectionErrors.deals}
                      onRetry={() => void loadDeals()}
                    />
                  ) : deals.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border py-12 text-center">
                      <BriefcaseBusiness className="mx-auto size-6 text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">
                        Nenhum negócio encontrado
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Os negócios vinculados ao contato aparecerão
                        aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {deals.map((deal) => {
                        const stageColor = safeTagColor(
                          deal.stage?.color,
                        );
                        const numericValue = Number(
                          deal.value ?? 0,
                        );

                        return (
                          <article
                            key={deal.id}
                            className="rounded-xl border border-border bg-background/40 p-4 transition-colors hover:bg-muted/30"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <h3 className="truncate text-sm font-medium text-foreground">
                                  {deal.title}
                                </h3>

                                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                                  <DollarSign className="size-4" />
                                  {formatCurrency(
                                    Number.isFinite(numericValue)
                                      ? numericValue
                                      : 0,
                                    deal.currency ||
                                      defaultCurrency ||
                                      "BRL",
                                  )}
                                </p>
                              </div>

                              {deal.stage ? (
                                <span
                                  className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                                  style={{
                                    color: stageColor,
                                    borderColor: `${stageColor}60`,
                                    backgroundColor: `${stageColor}16`,
                                  }}
                                >
                                  {deal.stage.name}
                                </span>
                              ) : null}
                            </div>

                            {deal.status &&
                            deal.status !== "open" ? (
                              <div className="mt-3 border-t border-border/60 pt-3 text-xs">
                                <span
                                  className={
                                    deal.status === "won"
                                      ? "font-medium text-emerald-500"
                                      : "font-medium text-destructive"
                                  }
                                >
                                  {getDealStatusLabel(
                                    deal.status,
                                  )}
                                </span>
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      
    </>
  );
}
