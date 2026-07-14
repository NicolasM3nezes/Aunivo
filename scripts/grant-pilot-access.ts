import { parseArgs } from 'node:util'
import { adminClient, fail, printSummary, requireUuid } from './billing/access-grants'

async function main() {
  const { values } = parseArgs({ options: {
    'account-id': { type: 'string' },
    days: { type: 'string' },
    reason: { type: 'string' },
  } })
  const accountId = requireUuid(values['account-id'])
  const days = Number(values.days)
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error('--days must be an integer between 1 and 3650')
  const reason = values.reason?.trim() || null
  const db = adminClient()

  const { error: expiryError } = await db.from('account_access_grants')
    .update({ status: 'expired' }).eq('account_id', accountId).eq('status', 'active').lte('expires_at', new Date().toISOString())
  if (expiryError) throw new Error(`Could not expire previous grants: ${expiryError.message}`)

  const [{ data: account, error: accountError }, { data: activeGrant, error: grantError }, { data: billing, error: billingError }] = await Promise.all([
    db.from('accounts').select('id,name').eq('id', accountId).maybeSingle(),
    db.from('account_access_grants').select('id,grant_type,plan_key,starts_at,expires_at').eq('account_id', accountId).eq('status', 'active').maybeSingle(),
    db.from('account_billing').select('subscription_status,grace_period_ends_at,trial_used_at').eq('account_id', accountId).maybeSingle(),
  ])
  if (accountError) throw new Error(`Could not verify account: ${accountError.message}`)
  if (!account) throw new Error('Account does not exist')
  if (grantError) throw new Error(`Could not verify active grants: ${grantError.message}`)
  if (activeGrant) throw new Error(`Account already has an active ${activeGrant.grant_type} grant (${activeGrant.id})`)
  if (billingError) throw new Error(`Could not verify billing: ${billingError.message}`)
  const stripeActive = billing?.subscription_status === 'active' || billing?.subscription_status === 'trialing' ||
    (billing?.subscription_status === 'past_due' && billing.grace_period_ends_at && new Date(billing.grace_period_ends_at).getTime() > Date.now())
  if (stripeActive) throw new Error(`Account already has Stripe access (${billing.subscription_status})`)

  const startsAt = new Date()
  const expiresAt = new Date(startsAt.getTime() + days * 86_400_000)
  const { data: grant, error: insertError } = await db.from('account_access_grants').insert({
    account_id: accountId, grant_type: 'pilot', plan_key: 'pro', status: 'active',
    starts_at: startsAt.toISOString(), expires_at: expiresAt.toISOString(), reason,
  }).select('id,account_id,grant_type,plan_key,status,starts_at,expires_at,reason').single()
  if (insertError) throw new Error(`Could not create pilot grant: ${insertError.message}`)

  const { error: trialError } = await db.from('account_billing')
    .update({ trial_used_at: billing?.trial_used_at ?? startsAt.toISOString() })
    .eq('account_id', accountId)
  if (trialError) {
    await db.from('account_access_grants').update({ status: 'revoked', revoked_at: new Date().toISOString() }).eq('id', grant.id)
    throw new Error(`Pilot was revoked because trial protection failed: ${trialError.message}`)
  }

  printSummary({ result: 'pilot_granted', account: { id: account.id, name: account.name }, grant })
}

main().catch(fail)
