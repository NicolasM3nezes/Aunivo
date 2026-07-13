"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Task, TaskInput, TaskOptions } from "@/lib/tasks/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  options: TaskOptions;
  defaults?: Partial<TaskInput>;
  onSaved: () => void;
}

const empty: TaskInput = { title: "", description: null, status: "pending", priority: "medium", due_at: null, contact_id: null, deal_id: null, assigned_to: null };
const selectClass = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

function toLocalDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function TaskFormDialog({ open, onOpenChange, task, options, defaults, onSaved }: Props) {
  const t = useTranslations("Tasks");
  const [form, setForm] = useState<TaskInput>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Form state intentionally resets when a different task is opened.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    setForm(task ? { title: task.title, description: task.description, status: task.status, priority: task.priority, due_at: task.due_at, contact_id: task.contact_id, deal_id: task.deal_id, assigned_to: task.assigned_to } : { ...empty, ...defaults });
  }, [open, task, defaults]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError(null);
    const response = await fetch(task ? `/api/tasks/${task.id}` : "/api/tasks", {
      method: task ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) { setError(payload.error ?? t("errors.save")); return; }
    onOpenChange(false); onSaved();
  }

  const availableDeals = form.contact_id ? options.deals.filter((deal) => deal.contact_id === form.contact_id) : options.deals;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{task ? t("form.editTitle") : t("form.createTitle")}</DialogTitle><DialogDescription>{t("form.description")}</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2"><Label htmlFor="task-title">{t("fields.title")}</Label><Input id="task-title" autoFocus required maxLength={160} value={form.title} onChange={(e) => setForm((old) => ({ ...old, title: e.target.value }))} placeholder={t("fields.titlePlaceholder")} /></div>
          <div className="space-y-2"><Label htmlFor="task-description">{t("fields.description")}</Label><Textarea id="task-description" rows={4} maxLength={4000} value={form.description ?? ""} onChange={(e) => setForm((old) => ({ ...old, description: e.target.value || null }))} placeholder={t("fields.descriptionPlaceholder")} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="task-priority">{t("fields.priority")}</Label><select id="task-priority" className={selectClass} value={form.priority} onChange={(e) => setForm((old) => ({ ...old, priority: e.target.value as TaskInput["priority"] }))}><option value="low">{t("priority.low")}</option><option value="medium">{t("priority.medium")}</option><option value="high">{t("priority.high")}</option></select></div>
            <div className="space-y-2"><Label htmlFor="task-due">{t("fields.dueAt")}</Label><Input id="task-due" type="datetime-local" value={toLocalDateTime(form.due_at)} onChange={(e) => setForm((old) => ({ ...old, due_at: e.target.value ? new Date(e.target.value).toISOString() : null }))} /></div>
            <div className="space-y-2"><Label htmlFor="task-contact">{t("fields.contact")}</Label><select id="task-contact" className={selectClass} value={form.contact_id ?? ""} onChange={(e) => setForm((old) => ({ ...old, contact_id: e.target.value || null, deal_id: null }))}><option value="">{t("fields.none")}</option>{options.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name || contact.phone}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="task-deal">{t("fields.deal")}</Label><select id="task-deal" className={selectClass} value={form.deal_id ?? ""} onChange={(e) => setForm((old) => ({ ...old, deal_id: e.target.value || null }))}><option value="">{t("fields.none")}</option>{availableDeals.map((deal) => <option key={deal.id} value={deal.id}>{deal.title}</option>)}</select></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="task-assignee">{t("fields.assignee")}</Label><select id="task-assignee" className={selectClass} value={form.assigned_to ?? ""} onChange={(e) => setForm((old) => ({ ...old, assigned_to: e.target.value || null }))}><option value="">{t("fields.unassigned")}</option>{options.members.map((member) => <option key={member.user_id} value={member.user_id}>{member.full_name}</option>)}</select></div>
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("actions.cancel")}</Button><Button type="submit" disabled={saving || !form.title.trim()}>{saving ? <Loader2 className="size-4 animate-spin" /> : null}{saving ? t("actions.saving") : t("actions.save")}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
