export type TaskStatus = "pending" | "completed" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";

export interface Task {
  id: string;
  account_id: string;
  created_by: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  completed_at: string | null;
  contact_id: string | null;
  deal_id: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  contact?: { id: string; name: string | null; phone: string } | null;
  deal?: { id: string; title: string } | null;
  assignee?: { user_id: string; full_name: string } | null;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_at?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
  assigned_to?: string | null;
}

export interface TaskOptions {
  contacts: Array<{ id: string; name: string | null; phone: string }>;
  deals: Array<{ id: string; title: string; contact_id: string }>;
  members: Array<{ user_id: string; full_name: string }>;
}
