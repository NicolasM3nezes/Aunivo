"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalendarClock, Check, CheckCircle2, CircleAlert, Clock3, Loader2, Pencil, Plus, RotateCcw, Search, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import type { Task, TaskInput, TaskOptions, TaskPriority, TaskStatus } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Period = "all" | "today" | "overdue" | "week";
const selectClass = "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";
const blankOptions: TaskOptions = { contacts: [], deals: [], members: [] };
const summaryCards: Array<{ key: "today" | "overdue" | "completed" | "pending"; icon: LucideIcon; color: string; background: string }> = [
  { key: "today", icon: CalendarClock, color: "text-primary", background: "bg-primary/10" },
  { key: "overdue", icon: CircleAlert, color: "text-destructive", background: "bg-destructive/10" },
  { key: "completed", icon: CheckCircle2, color: "text-emerald-600", background: "bg-emerald-500/10" },
  { key: "pending", icon: Clock3, color: "text-amber-600", background: "bg-amber-500/10" },
];

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function endOfToday() { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }

export default function TasksPage() {
  const t = useTranslations("Tasks");
  const params = useSearchParams();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [options, setOptions] = useState<TaskOptions>(blankOptions);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TaskStatus | "all">("pending");
  const [priority, setPriority] = useState<TaskPriority | "all">("all");
  const [period, setPeriod] = useState<Period>("all");
  const [dialogOpen, setDialogOpen] = useState(() => params.get("new") === "1");
  const [editing, setEditing] = useState<Task | null>(null);
  const defaults = useMemo<Partial<TaskInput>>(() => ({ contact_id: params.get("contact_id"), deal_id: params.get("deal_id") }), [params]);

  const load = useCallback(async () => {
    setError(null);
    const response = await fetch("/api/tasks", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { setError(payload.error ?? t("errors.load")); setTasks([]); return; }
    setTasks(payload.tasks ?? []); setOptions(payload.options ?? blankOptions); setCanEdit(Boolean(payload.canEdit));
  }, [t]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const all = tasks ?? []; const todayStart = startOfToday(); const todayEnd = endOfToday();
    return {
      today: all.filter((task) => task.status === "pending" && task.due_at && new Date(task.due_at) >= todayStart && new Date(task.due_at) <= todayEnd).length,
      overdue: all.filter((task) => task.status === "pending" && task.due_at && new Date(task.due_at) < todayStart).length,
      completed: all.filter((task) => task.status === "completed").length,
      pending: all.filter((task) => task.status === "pending").length,
    };
  }, [tasks]);
  const filtered = useMemo(() => (tasks ?? []).filter((task) => {
    if (status !== "all" && task.status !== status) return false;
    if (priority !== "all" && task.priority !== priority) return false;
    if (query && !`${task.title} ${task.description ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) return false;
    if (period !== "all") {
      if (!task.due_at) return false; const due = new Date(task.due_at); const todayStart = startOfToday(); const todayEnd = endOfToday();
      if (period === "today" && !(due >= todayStart && due <= todayEnd)) return false;
      if (period === "overdue" && !(task.status === "pending" && due < todayStart)) return false;
      if (period === "week") { const week = new Date(todayEnd); week.setDate(week.getDate() + 7); if (!(due >= todayStart && due <= week)) return false; }
    }
    return true;
  }), [tasks, status, priority, query, period]);

  async function mutate(task: Task, payload: Partial<TaskInput>) {
    const response = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) { const body = await response.json().catch(() => ({})); toast.error(body.error ?? t("errors.save")); return; }
    toast.success(t("feedback.updated")); void load();
  }
  async function remove(task: Task) {
    if (!window.confirm(t("confirmDelete", { title: task.title }))) return;
    const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (!response.ok) { toast.error(t("errors.delete")); return; }
    toast.success(t("feedback.deleted")); void load();
  }

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-primary">{t("eyebrow")}</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{t("title")}</h1><p className="mt-2 text-muted-foreground">{t("description")}</p></div>{canEdit ? <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus className="size-4" />{t("create")}</Button> : null}</header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summaryCards.map(({ key, icon: Icon, color, background }) => <Card key={key}><CardContent className="flex items-center gap-3 p-4"><span className={cn("grid size-10 place-items-center rounded-xl", background)}><Icon className={cn("size-5", color)} /></span><span><strong className="block text-2xl">{summary[key]}</strong><span className="text-xs text-muted-foreground">{t(`summary.${key}`)}</span></span></CardContent></Card>)}</div>
    <Card><CardContent className="p-4"><div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_auto_auto_auto]"><label className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("filters.search")} /></label><select aria-label={t("filters.status")} className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="all">{t("filters.allStatuses")}</option><option value="pending">{t("status.pending")}</option><option value="completed">{t("status.completed")}</option><option value="cancelled">{t("status.cancelled")}</option></select><select aria-label={t("filters.priority")} className={selectClass} value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}><option value="all">{t("filters.allPriorities")}</option><option value="low">{t("priority.low")}</option><option value="medium">{t("priority.medium")}</option><option value="high">{t("priority.high")}</option></select><select aria-label={t("filters.period")} className={selectClass} value={period} onChange={(e) => setPeriod(e.target.value as Period)}><option value="all">{t("filters.anyDate")}</option><option value="today">{t("filters.today")}</option><option value="overdue">{t("filters.overdue")}</option><option value="week">{t("filters.week")}</option></select></div></CardContent></Card>
    {error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-5"><p>{error}</p><Button className="mt-3" variant="outline" onClick={() => void load()}>{t("actions.retry")}</Button></div> : null}
    {tasks === null ? <div className="grid h-48 place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div> : null}
    {tasks !== null && !error && filtered.length === 0 ? <div className="rounded-2xl border border-dashed bg-muted/20 p-10 text-center"><CheckCircle2 className="mx-auto size-10 text-primary" /><h2 className="mt-3 font-semibold">{tasks.length ? t("empty.filteredTitle") : t("empty.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{tasks.length ? t("empty.filteredDescription") : t("empty.description")}</p>{canEdit && !tasks.length ? <Button className="mt-4" onClick={() => setDialogOpen(true)}><Plus className="size-4" />{t("create")}</Button> : null}</div> : null}
    <div className="space-y-3">{filtered.map((task) => { const overdue = task.status === "pending" && task.due_at && new Date(task.due_at) < startOfToday(); return <article key={task.id} className="rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/30 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start"><button disabled={!canEdit} onClick={() => canEdit && void mutate(task, { status: task.status === "completed" ? "pending" : "completed" })} className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border", task.status === "completed" ? "border-emerald-500 bg-emerald-500 text-white" : "border-border hover:border-primary")} aria-label={task.status === "completed" ? t("actions.reopen") : t("actions.complete")}>{task.status === "completed" ? <Check className="size-4" /> : null}</button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className={cn("font-semibold", task.status === "completed" && "text-muted-foreground line-through")}>{task.title}</h2><Badge variant="outline" className={cn(task.priority === "high" && "border-destructive/40 text-destructive", task.priority === "medium" && "border-amber-500/40 text-amber-600")}>{t(`priority.${task.priority}`)}</Badge>{task.status !== "pending" ? <Badge variant="secondary">{t(`status.${task.status}`)}</Badge> : null}</div>{task.description ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.description}</p> : null}<div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">{task.due_at ? <span className={cn("flex items-center gap-1", overdue && "font-medium text-destructive")}><CalendarClock className="size-3.5" />{new Date(task.due_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span> : null}{task.contact ? <Link className="hover:text-primary" href={`/contacts?contact=${task.contact.id}`}>{task.contact.name || task.contact.phone}</Link> : null}{task.deal ? <Link className="hover:text-primary" href="/pipelines">{task.deal.title}</Link> : null}{task.assignee ? <span>{t("assignedTo", { name: task.assignee.full_name })}</span> : null}</div></div>{canEdit ? <div className="flex shrink-0 flex-wrap gap-1"><Button size="icon-sm" variant="ghost" title={t("actions.edit")} onClick={() => { setEditing(task); setDialogOpen(true); }}><Pencil /></Button>{task.status === "completed" ? <Button size="icon-sm" variant="ghost" title={t("actions.reopen")} onClick={() => void mutate(task, { status: "pending" })}><RotateCcw /></Button> : <Button size="icon-sm" variant="ghost" title={t("actions.cancelTask")} onClick={() => void mutate(task, { status: "cancelled" })}><XCircle /></Button>}<Button size="icon-sm" variant="ghost" className="text-destructive" title={t("actions.delete")} onClick={() => void remove(task)}><Trash2 /></Button></div> : null}</div></article>; })}</div>
    <TaskFormDialog open={dialogOpen} onOpenChange={setDialogOpen} task={editing} options={options} defaults={defaults} onSaved={() => { toast.success(t("feedback.saved")); void load(); }} />
  </div>;
}
