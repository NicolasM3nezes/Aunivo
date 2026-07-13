"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

const POLLING_INTERVAL = 5 * 60 * 1000;

function logSupabaseError(
  context: string,
  error: {
    message?: string;
    code?: string;
    details?: string;
    hint?: string;
  },
) {
  console.error(context, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}

/**
 * Retorna a quantidade de notificações não lidas do usuário atual.
 *
 * A RLS da tabela `notifications` deve garantir que o usuário consulte
 * somente notificações cujo `user_id` corresponda ao usuário autenticado.
 */
export function useUnreadNotifications(): number {
  const [count, setCount] = useState(0);

  // Mantém a mesma instância do Supabase entre renderizações.
  const supabase = useMemo(() => createClient(), []);

  const syncTaskNotifications = useCallback(async () => {
    const { error } = await supabase.rpc("sync_my_task_notifications");

    if (error) {
      logSupabaseError("[notifications:sync]", error);
      return false;
    }

    return true;
  }, [supabase]);

  const loadUnreadCount = useCallback(async (): Promise<number | null> => {
    const { count: unreadCount, error } = await supabase
      .from("notifications")
      .select("id", {
        count: "exact",
        head: true,
      })
      .is("read_at", null);

    if (error) {
      logSupabaseError("[notifications:unread-count]", error);
      return null;
    }

    return unreadCount ?? 0;
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    let requestInProgress = false;

    /**
     * Atualiza a contagem.
     *
     * `syncBeforeLoad` deve ser true no carregamento inicial e no polling,
     * para criar notificações de tarefas que ainda não foram sincronizadas.
     *
     * Nos eventos Realtime basta recarregar a contagem, evitando chamar
     * a função RPC novamente para cada INSERT ou UPDATE.
     */
    async function refreshCount(syncBeforeLoad: boolean) {
      if (cancelled || requestInProgress) return;

      requestInProgress = true;

      try {
        if (syncBeforeLoad) {
          await syncTaskNotifications();
        }

        const nextCount = await loadUnreadCount();

        if (!cancelled && nextCount !== null) {
          setCount(nextCount);
        }
      } catch (error) {
        console.error("[notifications:refresh]", error);
      } finally {
        requestInProgress = false;
      }
    }

    void refreshCount(true);

    /*
     * O nome único evita que React Strict Mode, Fast Refresh ou uma
     * desmontagem ainda em andamento reutilizem um canal que já chamou
     * subscribe().
     */
    const channelId =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(`notifications-unread-count-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          /*
           * Reconsulta o banco em vez de somar ou subtrair manualmente.
           * Isso evita contagem incorreta em atualizações repetidas,
           * exclusões e eventos duplicados do Realtime.
           */
          void refreshCount(false);
        },
      )
      .subscribe((status, error) => {
        if (error) {
          console.error("[notifications:realtime]", {
            status,
            message: error.message,
            name: error.name,
          });
          return;
        }

        if (status === "CHANNEL_ERROR") {
          console.error(
            "[notifications:realtime] Erro ao conectar ao canal.",
          );
        }

        if (status === "TIMED_OUT") {
          console.error(
            "[notifications:realtime] A conexão com o canal expirou.",
          );
        }
      });

    const pollId = window.setInterval(() => {
      void refreshCount(true);
    }, POLLING_INTERVAL);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshCount(true);
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      cancelled = true;

      window.clearInterval(pollId);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      void supabase.removeChannel(channel);
    };
  }, [
    loadUnreadCount,
    supabase,
    syncTaskNotifications,
  ]);

  return count;
}