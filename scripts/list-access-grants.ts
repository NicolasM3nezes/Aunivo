import { parseArgs } from 'node:util'
import { adminClient, fail, printSummary, requireUuid } from './billing/access-grants'

async function main() {
  const { values } = parseArgs({ options: { 'account-id': { type: 'string' } } })
  const accountId = values['account-id'] ? requireUuid(values['account-id']) : null
  const db = adminClient()
  let query = db.from('account_access_grants')
    .select('id,account_id,grant_type,plan_key,status,starts_at,expires_at,reason,created_by,created_at,updated_at,revoked_at,converted_at')
    .order('created_at', { ascending: false }).limit(200)
  if (accountId) query = query.eq('account_id', accountId)
  const { data, error } = await query
  if (error) throw new Error(`Could not list access grants: ${error.message}`)
  printSummary({ result: 'access_grants', count: data.length, grants: data })
}

main().catch(fail)
