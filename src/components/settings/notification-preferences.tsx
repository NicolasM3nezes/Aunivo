"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Switch } from "@/components/ui/switch";
import { SettingsPanelHead } from "@/components/settings/settings-panel-head";

type Preferences = { task_assigned: boolean; task_due_today: boolean; task_overdue: boolean };
const defaults: Preferences = { task_assigned: true, task_due_today: true, task_overdue: true };

export function NotificationPreferences() {
  const t = useTranslations("Settings.notifications");
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [saving, setSaving] = useState<keyof Preferences | null>(null);
  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await createClient().from("notification_preferences").select("task_assigned,task_due_today,task_overdue").eq("user_id", user.id).maybeSingle();
    if (error) { toast.error(t("loadError")); setPreferences(defaults); return; }
    setPreferences((data as Preferences | null) ?? defaults);
  }, [user, t]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  async function toggle(key: keyof Preferences, checked: boolean) {
    if (!user?.id || !preferences) return;
    const previous = preferences; const next = { ...preferences, [key]: checked };
    setPreferences(next); setSaving(key);
    const { error } = await createClient().from("notification_preferences").upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
    setSaving(null);
    if (error) { setPreferences(previous); toast.error(t("saveError")); } else toast.success(t("saved"));
  }
  return <div className="space-y-6"><SettingsPanelHead title={t("title")} description={t("description")} />
    {!preferences ? <div className="grid h-32 place-items-center"><Loader2 className="size-5 animate-spin text-primary" /></div> : <div className="divide-y rounded-xl border">{(["task_assigned", "task_due_today", "task_overdue"] as const).map((key) => <div key={key} className="flex items-center justify-between gap-5 p-4"><div><p className="font-medium">{t(`${key}.title`)}</p><p className="mt-1 text-sm text-muted-foreground">{t(`${key}.description`)}</p></div><Switch aria-label={t(`${key}.title`)} checked={preferences[key]} disabled={saving === key} onCheckedChange={(checked) => void toggle(key, checked)} /></div>)}</div>}
  </div>;
}
