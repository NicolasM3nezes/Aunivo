"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, ListTodo, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Task } from "@/lib/tasks/types";

export function RelatedTasks({ contactId, dealId, compact = false }: { contactId?: string; dealId?: string; compact?: boolean }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const query = dealId ? `deal_id=${dealId}` : `contact_id=${contactId}`;
  useEffect(() => { void fetch(`/api/tasks?${query}`, { cache: "no-store" }).then(async (response) => response.ok ? response.json() : { tasks: [] }).then((payload) => setTasks(payload.tasks ?? [])); }, [query]);
  const createHref = `/tasks?new=1${contactId ? `&contact_id=${contactId}` : ""}${dealId ? `&deal_id=${dealId}` : ""}`;
  return <section className="rounded-xl border bg-background/40 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-medium"><ListTodo className="size-4 text-primary" />Tarefas relacionadas</h3>{!compact ? <p className="mt-1 text-xs text-muted-foreground">Próximos passos vinculados a este registro.</p> : null}</div><Button size="sm" variant="outline" render={<Link href={createHref} />}><Plus className="size-4" />Nova</Button></div>
    <div className="mt-3 space-y-2">{tasks === null ? <Loader2 className="mx-auto size-4 animate-spin text-primary" /> : tasks.length ? tasks.slice(0, 5).map((task) => <Link href="/tasks" key={task.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5 hover:bg-muted/60"><span className="min-w-0"><span className="block truncate text-sm font-medium">{task.title}</span><span className="text-xs text-muted-foreground">{task.status === "completed" ? "Concluída" : task.status === "cancelled" ? "Cancelada" : "Pendente"}</span></span>{task.due_at ? <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3" />{new Date(task.due_at).toLocaleDateString("pt-BR")}</span> : null}</Link>) : <p className="py-2 text-sm text-muted-foreground">Nenhuma tarefa vinculada.</p>}</div>
  </section>;
}
