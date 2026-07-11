"use client";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Check,
  CircleDot,
  DollarSign,
  Loader2,
  MessageSquare,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { CURRENCIES } from "@/lib/currency";
import { createClient } from "@/lib/supabase/client";
import type {
  Contact,
  Conversation,
  Deal,
  DealStatus,
  PipelineStage,
  Profile,
} from "@/types";

interface DealFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  pipelineId: string;
  stages: PipelineStage[];
  defaultStageId?: string;
  onSaved: () => void;
}

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50";

export function DealForm({
  open,
  onOpenChange,
  deal,
  pipelineId,
  stages,
  defaultStageId,
  onSaved,
}: DealFormProps) {
  const t = useTranslations("Pipelines.form");
  const { accountId, defaultCurrency } = useAuth();

  // Mantém a mesma instância durante todo o ciclo de vida do componente.
  // Sem isso, os efeitos que dependem de `supabase` podem disparar novamente
  // a cada renderização.
  const supabase = useMemo(() => createClient(), []);

  const fallbackCurrency =
    defaultCurrency || CURRENCIES[0]?.code || "BRL";
  const firstStageId = stages[0]?.id || "";

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState(fallbackCurrency);
  const [contactId, setContactId] = useState("");
  const [stageId, setStageId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [linkedConversation, setLinkedConversation] =
    useState<Conversation | null>(null);

  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusAction, setStatusAction] = useState<DealStatus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isBusy = saving || deleting || statusAction !== null;
  const canSubmit =
    Boolean(title.trim()) && Boolean(contactId) && Boolean(stageId) && !isBusy;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;

    setConfirmDelete(false);
    setLinkedConversation(null);

    if (deal) {
      setTitle(deal.title ?? "");
      setValue(String(deal.value ?? ""));
      setCurrency(deal.currency || fallbackCurrency);
      setContactId(deal.contact_id ?? "");
      setStageId(deal.stage_id ?? defaultStageId ?? firstStageId);
      setAssignedTo(deal.assigned_to ?? "");
      setExpectedCloseDate(deal.expected_close_date ?? "");
      setNotes(deal.notes ?? "");
      return;
    }

    setTitle("");
    setValue("");
    setCurrency(fallbackCurrency);
    setContactId("");
    setStageId(defaultStageId || firstStageId);
    setAssignedTo("");
    setExpectedCloseDate("");
    setNotes("");
  }, [
    open,
    deal,
    defaultStageId,
    firstStageId,
    fallbackCurrency,
  ]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadSupportingData() {
      setLoadingData(true);

      try {
        const [contactsResult, profilesResult] = await Promise.all([
          supabase.from("contacts").select("*").order("name"),
          supabase.from("profiles").select("*").order("full_name"),
        ]);

        if (cancelled) return;

        if (contactsResult.error) {
          console.error(
            "Erro ao carregar contatos do formulário:",
            contactsResult.error,
          );
        }

        if (profilesResult.error) {
          console.error(
            "Erro ao carregar perfis do formulário:",
            profilesResult.error,
          );
        }

        setContacts((contactsResult.data ?? []) as Contact[]);
        setProfiles((profilesResult.data ?? []) as Profile[]);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }

    void loadSupportingData();

    return () => {
      cancelled = true;
    };
  }, [open, supabase]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open || !contactId) {
      setLinkedConversation(null);
      return;
    }

    let cancelled = false;

    async function loadLinkedConversation() {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("contact_id", contactId)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Erro ao carregar conversa vinculada:", error);
        setLinkedConversation(null);
        return;
      }

      setLinkedConversation((data as Conversation | null) ?? null);
    }

    void loadLinkedConversation();

    return () => {
      cancelled = true;
    };
  }, [open, contactId, supabase]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleSheetOpenChange(nextOpen: boolean) {
    if (!nextOpen && isBusy) return;
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim() || !contactId || !stageId) {
      toast.error(t("toastRequired"));
      return;
    }

    setSaving(true);

    try {
      const parsedValue = Number(value);
      const payload = {
        title: title.trim(),
        value: Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0,
        currency,
        contact_id: contactId,
        pipeline_id: pipelineId,
        stage_id: stageId,
        assigned_to: assignedTo || null,
        notes: notes.trim() || null,
        expected_close_date: expectedCloseDate || null,
      };

      if (deal) {
        const { error } = await supabase
          .from("deals")
          .update(payload)
          .eq("id", deal.id);

        if (error) {
          console.error("Erro ao atualizar negócio:", error);
          toast.error(t("toastFailedSave"));
          return;
        }
      } else {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          toast.error(t("toastNotSignedIn"));
          return;
        }

        if (!accountId) {
          toast.error(t("toastNotLinked"));
          return;
        }

        const { error } = await supabase.from("deals").insert({
          ...payload,
          user_id: user.id,
          account_id: accountId,
          status: "open",
        });

        if (error) {
          console.error("Erro ao criar negócio:", error);
          toast.error(t("toastFailedCreate"));
          return;
        }
      }

      toast.success(deal ? t("toastUpdated") : t("toastCreated"));
      onOpenChange(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: DealStatus) {
    if (!deal || isBusy || deal.status === status) return;

    setStatusAction(status);

    try {
      const { error } = await supabase
        .from("deals")
        .update({ status })
        .eq("id", deal.id);

      if (error) {
        console.error("Erro ao alterar status do negócio:", error);
        toast.error(t("toastFailedStatus"));
        return;
      }

      toast.success(
        status === "won"
          ? t("toastMarkedWon")
          : status === "lost"
            ? t("toastMarkedLost")
            : t("toastReopened"),
      );

      onOpenChange(false);
      onSaved();
    } finally {
      setStatusAction(null);
    }
  }

  async function handleDelete() {
    if (!deal || isBusy) return;

    setDeleting(true);

    try {
      const { error } = await supabase
        .from("deals")
        .delete()
        .eq("id", deal.id);

      if (error) {
        console.error("Erro ao excluir negócio:", error);
        toast.error(t("toastFailedDelete"));
        return;
      }

      toast.success(t("toastDeleted"));
      setConfirmDelete(false);
      onOpenChange(false);
      onSaved();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-l border-border bg-background p-0 text-foreground sm:max-w-xl"
      >
        <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
          <SheetHeader className="shrink-0 border-b border-border/70 px-5 py-4 pr-12 text-left">
            <SheetTitle className="text-lg font-semibold tracking-tight">
              {deal ? t("editDeal") : t("newDeal")}
            </SheetTitle>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-6 px-5 py-5">
              <section className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="deal-title">
                    {t("title")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="deal-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={t("titlePlaceholder")}
                    autoFocus
                    autoComplete="off"
                    disabled={isBusy}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="deal-contact">
                    {t("contact")} <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="deal-contact"
                    value={contactId}
                    onChange={(event) => setContactId(event.target.value)}
                    className={selectClassName}
                    disabled={loadingData || isBusy}
                    required
                  >
                    <option value="">{t("selectContact")}</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name || contact.phone}
                      </option>
                    ))}
                  </select>

                  {linkedConversation && (
                    <Link
                      href="/inbox"
                      className="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {t("linkToConversation")}
                    </Link>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-border/70 bg-muted/25 p-4">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <div className="grid gap-2">
                    <Label htmlFor="deal-value">{t("value")}</Label>
                    <div className="relative">
                      <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="deal-value"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        placeholder="0,00"
                        className="pl-9"
                        disabled={isBusy}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="deal-currency">{t("currency")}</Label>
                    <select
                      id="deal-currency"
                      value={currency}
                      onChange={(event) => setCurrency(event.target.value)}
                      className={selectClassName}
                      disabled={isBusy}
                    >
                      {CURRENCIES.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="deal-stage">
                    {t("stage")} <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="deal-stage"
                    value={stageId}
                    onChange={(event) => setStageId(event.target.value)}
                    className={selectClassName}
                    disabled={isBusy || stages.length === 0}
                    required
                  >
                    {stages.length === 0 && <option value="">—</option>}
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="deal-close-date">
                    {t("expectedCloseDate")}
                  </Label>
                  <Input
                    id="deal-close-date"
                    type="date"
                    value={expectedCloseDate}
                    onChange={(event) =>
                      setExpectedCloseDate(event.target.value)
                    }
                    disabled={isBusy}
                  />
                </div>
              </section>

              <div className="grid gap-2">
                <Label htmlFor="deal-assigned-to">{t("assignedTo")}</Label>
                <select
                  id="deal-assigned-to"
                  value={assignedTo}
                  onChange={(event) => setAssignedTo(event.target.value)}
                  className={selectClassName}
                  disabled={loadingData || isBusy}
                >
                  <option value="">{t("unassigned")}</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name || profile.email}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="deal-notes">{t("notes")}</Label>
                <Textarea
                  id="deal-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={t("notesPlaceholder")}
                  className="min-h-28 resize-y"
                  disabled={isBusy}
                />
              </div>

              {deal && (
                <section className="space-y-3 rounded-xl border border-border/70 bg-muted/25 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("status")}
                    </p>

                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-medium",
                        deal.status === "won"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : deal.status === "lost"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-primary/10 text-primary",
                      ].join(" ")}
                    >
                      {deal.status === "won"
                        ? "Ganho"
                        : deal.status === "lost"
                          ? "Perdido"
                          : "Em aberto"}
                    </span>
                  </div>

                  <div
                    className="grid grid-cols-3 gap-2"
                    role="group"
                    aria-label={t("status")}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      aria-pressed={deal.status === "open"}
                      onClick={() => void handleStatusChange("open")}
                      disabled={isBusy}
                      className={[
                        "h-auto min-h-16 flex-col gap-1.5 px-2 py-3 text-xs",
                        deal.status === "open"
                          ? "border-primary bg-primary/10 text-primary shadow-sm hover:bg-primary/15 hover:text-primary"
                          : "text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
                      ].join(" ")}
                    >
                      {statusAction === "open" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CircleDot className="h-4 w-4" />
                      )}
                      <span>Em aberto</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      aria-pressed={deal.status === "won"}
                      onClick={() => void handleStatusChange("won")}
                      disabled={isBusy}
                      className={[
                        "h-auto min-h-16 flex-col gap-1.5 px-2 py-3 text-xs",
                        deal.status === "won"
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 shadow-sm hover:bg-emerald-500/15 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-400"
                          : "text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-700 dark:hover:text-emerald-400",
                      ].join(" ")}
                    >
                      {statusAction === "won" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      <span>Ganho</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      aria-pressed={deal.status === "lost"}
                      onClick={() => void handleStatusChange("lost")}
                      disabled={isBusy}
                      className={[
                        "h-auto min-h-16 flex-col gap-1.5 px-2 py-3 text-xs",
                        deal.status === "lost"
                          ? "border-destructive bg-destructive/10 text-destructive shadow-sm hover:bg-destructive/15 hover:text-destructive"
                          : "text-muted-foreground hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive",
                      ].join(" ")}
                    >
                      {statusAction === "lost" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      <span>Perdido</span>
                    </Button>
                  </div>
                </section>
              )}
            </div>
          </div>

          <footer className="shrink-0 border-t border-border/70 bg-background/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSheetOpenChange(false)}
                disabled={isBusy}
              >
                {t("cancel")}
              </Button>

              <Button type="submit" disabled={!canSubmit}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving
                  ? t("saving")
                  : deal
                    ? t("saveChanges")
                    : t("createDeal")}
              </Button>
            </div>

            {deal &&
              (confirmDelete ? (
                <div className="mt-3 flex flex-col gap-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-destructive">
                    {t("deletePrompt")}
                  </span>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmDelete(false)}
                      disabled={isBusy}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => void handleDelete()}
                      disabled={isBusy}
                    >
                      {deleting && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {deleting ? t("deleting") : t("confirm")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isBusy}
                  className="mt-2 w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  {t("deleteDeal")}
                </Button>
              ))}
          </footer>
        </form>
      </SheetContent>
    </Sheet>
  );
}
