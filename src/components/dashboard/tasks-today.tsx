"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Task } from "@/lib/tasks/types";

export function TasksToday() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  useEffect(() => { void fetch("/api/tasks", { cache: "no-store" }).then(async (response) => response.ok ? response.json() : { tasks: [] }).then((payload) => setTasks(payload.tasks ?? [])); }, []);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const today = (tasks ?? []).filter((task) => task.status === "pending" && task.due_at && new Date(task.due_at) <= end).slice(0, 5);
  return <Card className="border-primary/20"><CardHeader className="flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><CalendarClock className="size-5 text-primary" />Tarefas de hoje</CardTitle><Button size="sm" variant="ghost" render={<Link href="/tasks" />}>Ver todas</Button></CardHeader><CardContent>{tasks === null ? <Loader2 className="mx-auto size-5 animate-spin text-primary" /> : today.length ? <div className="space-y-2">{today.map((task) => <Link key={task.id} href="/tasks" className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/60"><span className="truncate text-sm font-medium">{task.title}</span><span className="shrink-0 text-xs text-muted-foreground">{task.due_at ? new Date(task.due_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}</span></Link>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma tarefa pendente para hoje.</p>}</CardContent></Card>;
}
