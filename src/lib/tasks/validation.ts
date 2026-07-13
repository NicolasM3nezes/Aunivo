import type { TaskInput, TaskPriority, TaskStatus } from "./types";

const statuses = new Set<TaskStatus>(["pending", "completed", "cancelled"]);
const priorities = new Set<TaskPriority>(["low", "medium", "high"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateTaskInput(value: unknown, partial = false): { data?: TaskInput; error?: string } {
  if (!value || typeof value !== "object") return { error: "Dados da tarefa inválidos." };
  const body = value as Record<string, unknown>;
  if (!partial || "title" in body) {
    if (typeof body.title !== "string" || !body.title.trim()) return { error: "Informe o título da tarefa." };
    if (body.title.trim().length > 160) return { error: "O título deve ter no máximo 160 caracteres." };
  }
  if (body.description != null && (typeof body.description !== "string" || body.description.length > 4000)) return { error: "A descrição deve ter no máximo 4.000 caracteres." };
  if (body.status != null && (typeof body.status !== "string" || !statuses.has(body.status as TaskStatus))) return { error: "Status inválido." };
  if (body.priority != null && (typeof body.priority !== "string" || !priorities.has(body.priority as TaskPriority))) return { error: "Prioridade inválida." };
  if (body.due_at != null && (typeof body.due_at !== "string" || Number.isNaN(Date.parse(body.due_at)))) return { error: "Prazo inválido." };
  for (const key of ["contact_id", "deal_id", "assigned_to"] as const) {
    if (body[key] != null && (typeof body[key] !== "string" || !uuid.test(body[key]))) return { error: `Referência inválida em ${key}.` };
  }
  const data: TaskInput = {} as TaskInput;
  if (typeof body.title === "string") data.title = body.title.trim();
  if ("description" in body) data.description = typeof body.description === "string" ? body.description.trim() || null : null;
  if (body.status) data.status = body.status as TaskStatus;
  if (body.priority) data.priority = body.priority as TaskPriority;
  for (const key of ["due_at", "contact_id", "deal_id", "assigned_to"] as const) if (key in body) data[key] = (body[key] as string | null) || null;
  return { data };
}
