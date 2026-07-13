import { NextResponse } from "next/server";
import { getCurrentAccount, requireRole, toErrorResponse } from "@/lib/auth/account";
import { validateTaskInput } from "@/lib/tasks/validation";

export async function GET(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const url = new URL(request.url);
    let query = ctx.supabase.from("tasks").select("*").eq("account_id", ctx.accountId);
    const status = url.searchParams.get("status");
    const priority = url.searchParams.get("priority");
    const q = url.searchParams.get("q")?.trim();
    const contactId = url.searchParams.get("contact_id");
    const dealId = url.searchParams.get("deal_id");
    if (status && status !== "all") query = query.eq("status", status);
    if (priority && priority !== "all") query = query.eq("priority", priority);
    if (q) query = query.ilike("title", `%${q.replace(/[%_,]/g, "")}%`);
    if (contactId) query = query.eq("contact_id", contactId);
    if (dealId) query = query.eq("deal_id", dealId);
    const [{ data: tasks, error }, contacts, deals, members] = await Promise.all([
      query.order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
      ctx.supabase.from("contacts").select("id,name,phone").eq("account_id", ctx.accountId).eq("is_active", true).order("name").limit(500),
      ctx.supabase.from("deals").select("id,title,contact_id").eq("account_id", ctx.accountId).order("updated_at", { ascending: false }).limit(500),
      ctx.supabase.from("profiles").select("user_id,full_name").eq("account_id", ctx.accountId).order("full_name"),
    ]);
    if (error) throw error;
    const contactMap = new Map((contacts.data ?? []).map((item) => [item.id, item]));
    const dealMap = new Map((deals.data ?? []).map((item) => [item.id, item]));
    const memberMap = new Map((members.data ?? []).map((item) => [item.user_id, item]));
    return NextResponse.json({
      tasks: (tasks ?? []).map((task) => ({ ...task, contact: task.contact_id ? contactMap.get(task.contact_id) ?? null : null, deal: task.deal_id ? dealMap.get(task.deal_id) ?? null : null, assignee: task.assigned_to ? memberMap.get(task.assigned_to) ?? null : null })),
      options: { contacts: contacts.data ?? [], deals: deals.data ?? [], members: members.data ?? [] },
      canEdit: ctx.role !== "viewer",
    });
  } catch (error) { return toErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("agent");
    const parsed = validateTaskInput(await request.json().catch(() => null));
    if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { data, error } = await ctx.supabase.from("tasks").insert({ ...parsed.data, account_id: ctx.accountId, created_by: ctx.userId }).select().single();
    if (error) return NextResponse.json({ error: "Não foi possível criar a tarefa.", detail: error.message }, { status: 400 });
    return NextResponse.json({ task: data }, { status: 201 });
  } catch (error) { return toErrorResponse(error); }
}
