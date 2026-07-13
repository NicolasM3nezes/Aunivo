import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { getTemplate } from '@/lib/automations/templates'
import { insertSteps, type BuilderStepInput } from '@/lib/automations/steps-tree'
import { validateStepsForActivation, validateTriggerForActivation } from '@/lib/automations/validate'
import { assertFeature, assertWithinLimit, BillingAccessError } from '@/lib/billing/entitlements'
import { billingErrorResponse } from '@/lib/billing/http'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabase.from('automations').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Não foi possível carregar as automações' }, { status: 500 })
  return NextResponse.json({ automations: data ?? [] })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })

  try {
    // One account/role lookup is the source of truth for the whole write.
    const ctx = await requireRole('agent')
    const admin = supabaseAdmin()
    await assertFeature(ctx.accountId, 'automations')

    if (body.is_active) {
      const { count, error } = await admin
        .from('automations')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', ctx.accountId)
        .eq('is_active', true)
      if (error) throw new Error(`Could not count active automations: ${error.message}`)
      await assertWithinLimit(ctx.accountId, 'automations', count ?? 0)
    }

    const { name, description, trigger_type, trigger_config, is_active, steps, template } = body
    let effectiveSteps: BuilderStepInput[] | undefined = Array.isArray(steps) ? steps : undefined
    let effectiveName = typeof name === 'string' ? name : ''
    let effectiveDescription = typeof description === 'string' ? description : null
    let effectiveTriggerType = trigger_type
    let effectiveTriggerConfig = trigger_config

    if (template && (!effectiveSteps || effectiveSteps.length === 0)) {
      const selectedTemplate = getTemplate(template)
      if (selectedTemplate) {
        effectiveName = effectiveName || selectedTemplate.name
        effectiveDescription = effectiveDescription ?? selectedTemplate.description
        effectiveTriggerType = effectiveTriggerType ?? selectedTemplate.trigger_type
        effectiveTriggerConfig = effectiveTriggerConfig ?? selectedTemplate.trigger_config
        effectiveSteps = selectedTemplate.steps as unknown as BuilderStepInput[]
      }
    }

    if (!effectiveName.trim() || !effectiveTriggerType) {
      return NextResponse.json({ error: 'Nome e gatilho são obrigatórios' }, { status: 400 })
    }

    if (is_active) {
      const issues = [
        ...validateTriggerForActivation(effectiveTriggerType, effectiveTriggerConfig ?? {}),
        ...validateStepsForActivation((effectiveSteps ?? []) as unknown as { step_type: string; step_config: Record<string, unknown> }[]),
      ]
      if (issues.length > 0) return NextResponse.json({ error: 'Revise a configuração antes de ativar a automação', issues }, { status: 400 })
    }

    const { data: automation, error: insertError } = await admin
      .from('automations')
      .insert({
        user_id: ctx.userId,
        account_id: ctx.accountId,
        name: effectiveName.trim(),
        description: effectiveDescription?.trim() || null,
        trigger_type: effectiveTriggerType,
        trigger_config: effectiveTriggerConfig ?? {},
        is_active: !!is_active,
      })
      .select()
      .single()

    if (insertError || !automation) throw new Error(`Could not insert automation: ${insertError?.message ?? 'missing row'}`)

    if (effectiveSteps && effectiveSteps.length > 0) {
      const stepError = await insertSteps(automation.id, effectiveSteps)
      if (stepError) {
        // Avoid leaving a half-created automation when its tree fails.
        await admin.from('automations').delete().eq('id', automation.id).eq('account_id', ctx.accountId)
        throw new Error(`Could not insert automation steps: ${stepError}`)
      }
    }

    return NextResponse.json({ automation }, { status: 201 })
  } catch (error) {
    if (error instanceof BillingAccessError) return billingErrorResponse(error)
    return toErrorResponse(error)
  }
}
