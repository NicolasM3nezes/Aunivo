import type { SupabaseClient } from '@supabase/supabase-js'

export async function notifyBillingOwner(db: SupabaseClient, accountId: string, type: string, title: string, body?: string) {
  const { data: account } = await db.from('accounts').select('owner_user_id').eq('id', accountId).single()
  if (!account?.owner_user_id) return
  const { error } = await db.from('notifications').insert({ account_id: accountId, user_id: account.owner_user_id, type, title, body: body ?? null })
  if (error) console.error('[billing notification]', error.message)
}
