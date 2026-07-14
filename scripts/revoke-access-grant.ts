import { parseArgs } from 'node:util'
import { adminClient, fail, printSummary, requireUuid } from './billing/access-grants'

async function main() {
  const { values } = parseArgs({ options: { 'account-id': { type: 'string' } } })
  const accountId = requireUuid(values['account-id'])
  const db = adminClient()
  const { data: account, error: accountError } = await db.from('accounts').select('id,name').eq('id', accountId).maybeSingle()
  if (accountError) throw new Error(`Could not verify account: ${accountError.message}`)
  if (!account) throw new Error('Account does not exist')
  const revokedAt = new Date().toISOString()
  const { data: grant, error } = await db.from('account_access_grants')
    .update({ status: 'revoked', revoked_at: revokedAt })
    .eq('account_id', accountId).eq('status', 'active')
    .select('id,account_id,grant_type,plan_key,status,starts_at,expires_at,revoked_at').maybeSingle()
  if (error) throw new Error(`Could not revoke access grant: ${error.message}`)
  if (!grant) throw new Error('Account has no active access grant')
  printSummary({ result: 'grant_revoked', account: { id: account.id, name: account.name }, grant })
}

main().catch(fail)
