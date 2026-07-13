import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { validateTaskInput } from "@/lib/tasks/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRole("agent");
    const { id } = await params;
    const parsed = validateTaskInput(await request.json().catch(() => null), true);
    if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const payload = { ...parsed.data } as Record<string, unknown>;
    if (payload.status === "completed") payload.completed_at = new Date().toISOString();
    if (payload.status && payload.status !== "completed") payload.completed_at = null;
    const { data, error } = await ctx.supabase.from("tasks").update(payload).eq("id", id).eq("account_id", ctx.accountId).select().maybeSingle();
    if (error) return NextResponse.json({ error: "Não foi possível atualizar a tarefa.", detail: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    return NextResponse.json({ task: data });
  } catch (error) { return toErrorResponse(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireRole("agent");
    const { id } = await params;
    const { error, count } = await ctx.supabase.from("tasks").delete({ count: "exact" }).eq("id", id).eq("account_id", ctx.accountId);
    if (error) return NextResponse.json({ error: "Não foi possível excluir a tarefa." }, { status: 400 });
    if (!count) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch (error) { return toErrorResponse(error); }
}
