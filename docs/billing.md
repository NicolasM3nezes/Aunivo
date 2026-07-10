# Aunivo billing

## Architecture and source of truth

Billing belongs to `accounts`, never users. Stripe is the financial source of truth; `account_billing` is its local projection for UI and entitlements. Only the account `owner` can create Checkout/Portal sessions, synchronize, or read detailed billing. Stripe code is isolated under `src/lib/billing/stripe`.

The browser sends only `planKey` and `interval`; the server maps them to allowlisted Price IDs. A Checkout redirect never activates access. Only a signed webhook or owner-initiated server synchronization can do that.

## Tables and RLS

Migration `036_billing.sql` creates `billing_plans`, one-row-per-account `account_billing`, minimized/idempotent `billing_webhook_events`, `billing_usage_monthly`, and usage retry keys. All use RLS. Clients cannot write financial state or usage; service-role code is server-only. Database triggers also enforce account limits on direct inserts.

Pending, unexpired invitations count toward the member limit. Expired or accepted invitations do not. Downgrades never delete existing data.

If a brand-new WhatsApp sender arrives after the contact limit is reached, Meta still receives HTTP 200 and the message identity is preserved in `billing_blocked_inbound`; the owner is notified. Existing contacts continue normally. After upgrade, an operator can reconcile this staging queue without mixing unrelated senders into one contact.

## Plans, states and grace

Prices and application behavior live in `src/lib/billing/catalog.ts`; migration 036 seeds matching database limits. Prices are centavos: Free R$0; Pro R$229/month or R$2,290/year; Business R$499/month or R$4,990/year. `null` means unlimited and `0` unavailable.

`trialing` and `active` grant paid access. Scheduled cancellation retains it through the paid period. `past_due` retains it until `grace_period_ends_at` (seven days by default). After grace, and for `unpaid`, `paused`, `incomplete_expired`, or `canceled`, access falls back to Free without deleting data. Existing records remain available; new premium operations and background execution stop.

## Environment

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PRICE_ID=price_...
STRIPE_BUSINESS_MONTHLY_PRICE_ID=price_...
STRIPE_BUSINESS_YEARLY_PRICE_ID=price_...
BILLING_GRACE_PERIOD_DAYS=7
```

Never expose Stripe secrets or `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`.

## Products and prices

Run `npm run stripe:setup`. The idempotent script finds products by `app=aunivo` and `plan_key`, reuses stable lookup keys, creates BRL recurring prices, and prints the four environment values. Live setup is blocked unless `ALLOW_STRIPE_LIVE_SETUP=true` is explicitly set with an `sk_live_` key. Test and live products/prices are separate.

## Customer Portal

In Stripe Dashboard enable payment-method updates, invoice history, cancellation at period end, Pro/Business and monthly/yearly switching, tax-ID display, and a deliberate proration policy. First purchase uses Checkout; an account with a paid subscription is sent to Portal to prevent duplicate subscriptions.

## Webhook

Configure `https://YOUR_DOMAIN/api/billing/webhook` for:

- `checkout.session.completed`
- `customer.subscription.created`, `.updated`, `.deleted`, `.trial_will_end`
- `invoice.paid`, `.payment_failed`, `.payment_action_required`

Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`. The handler reads the raw body, validates `stripe-signature`, records event IDs, retries failed processing, rejects cross-account customer links and prevents older events overwriting newer state.

Local test:

```bash
stripe login
stripe listen --forward-to http://localhost:3000/api/billing/webhook
npm run dev
```

Use test card `4242 4242 4242 4242`, any future expiry and CVC. Use Stripe's documented decline/authentication cards for failure paths.

## Checkout, reconciliation and usage

Success returns to `/settings?tab=billing&checkout=success`; the UI displays confirmation and polls local state. Owner synchronization is rate-limited and retrieves the current Stripe subscription. It never accepts an account or Price ID from the browser.

`increment_billing_usage` atomically increments calendar-month counters. Optional idempotency keys prevent retries from double counting. Campaign recipients and successful AI calls are account-wide metrics.

## Email and receipts

Aunivo creates in-app owner notifications. It adds no email infrastructure; configure Stripe Customer Emails for receipts, failures and renewals.

## Deploy and troubleshooting

1. Apply migrations through 036 to Supabase.
2. Configure server-only environment values.
3. Create products/prices for the correct mode.
4. Configure Portal and the production webhook.
5. Complete a test purchase before live mode.

Common issues: a missing Price ID requires rerunning setup; invalid signatures usually use the wrong `whsec_`; if Checkout returns but access stays Free, inspect webhook delivery and use synchronization; Portal requires an existing Stripe customer.

## Changing prices or limits

Stripe prices are immutable. Create a new Price, update the environment allowlist and centavo display, then configure Portal migration behavior. For limits, update the TypeScript catalog and add a migration updating the `billing_plans` seed. Never change only the UI.

## Live-mode checklist

- Explicitly authorize `sk_live_` setup and obtain four live Price IDs.
- Use the live endpoint's webhook secret.
- Review proration, cancellation, taxes, legal name and statement descriptor.
- Enable Stripe receipts and dunning communication.
- Test a real payment, refund, Portal change and cancellation.
- Verify webhook monitoring, logs and backups.
- Remove all test credentials from production.
