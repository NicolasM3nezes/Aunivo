import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { MetaEventParameters, MetaStandardEvent } from './meta-types'
import { metaStartTrialParameters, META_ANALYTICS_CONFIG, validateMetaMonetaryEvent } from './meta-config'

type ServerConversion = {
  eventName: MetaStandardEvent
  eventId: string
  externalReference: string
  eventSourceUrl: string
  email?: string | null
  customData?: MetaEventParameters
  eventTime?: number
}

const sha256 = (value: string) => createHash('sha256').update(value.trim().toLowerCase()).digest('hex')

export async function sendMetaConversion(db: SupabaseClient, event: ServerConversion): Promise<'sent' | 'duplicate' | 'not_configured' | 'failed'> {
  const token = process.env.META_CONVERSIONS_API_TOKEN?.trim()
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim()
  if (!token || !pixelId) return 'not_configured'

  const { error: claimError } = await db.from('analytics_conversion_events').insert({
    provider: 'meta',
    event_name: event.eventName,
    event_id: event.eventId,
    external_reference: event.externalReference,
    processing_status: 'processing',
  })
  if (claimError?.code === '23505') {
    const { data: prior } = await db.from('analytics_conversion_events')
      .select('processing_status,attempts')
      .eq('provider', 'meta')
      .eq('event_name', event.eventName)
      .eq('external_reference', event.externalReference)
      .maybeSingle()
    if (prior?.processing_status !== 'failed') {
      console.info('[analytics:meta-server] evento ignorado por duplicidade', { eventName: event.eventName, reference: event.externalReference })
      return 'duplicate'
    }
    const { error: retryError } = await db.from('analytics_conversion_events').update({
      processing_status: 'processing',
      attempts: Number(prior.attempts ?? 1) + 1,
      error_message: null,
    }).eq('provider', 'meta').eq('event_name', event.eventName).eq('external_reference', event.externalReference)
    if (retryError) return 'failed'
  }
  if (claimError && claimError.code !== '23505') {
    console.warn('[analytics:meta-server] falha ao reservar evento', { eventName: event.eventName, code: claimError.code })
    return 'failed'
  }

  const graphVersion = process.env.META_GRAPH_API_VERSION?.trim() || 'v23.0'
  const payload = {
    data: [{
      event_name: event.eventName,
      event_time: event.eventTime ?? Math.floor(Date.now() / 1000),
      event_id: event.eventId,
      action_source: 'website',
      event_source_url: event.eventSourceUrl,
      user_data: event.email ? { em: [sha256(event.email)] } : {},
      custom_data: event.customData ?? {},
    }],
    ...(process.env.META_TEST_EVENT_CODE?.trim() ? { test_event_code: process.env.META_TEST_EVENT_CODE.trim() } : {}),
  }

  try {
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error(`Meta responded ${response.status}`)
    await db.from('analytics_conversion_events').update({
      processing_status: 'sent', sent_at: new Date().toISOString(), error_message: null,
    }).eq('provider', 'meta').eq('event_name', event.eventName).eq('external_reference', event.externalReference)
    console.info('[analytics:meta-server] evento enviado', { eventName: event.eventName, reference: event.externalReference })
    return 'sent'
  } catch (error) {
    await db.from('analytics_conversion_events').update({
      processing_status: 'failed',
      error_message: error instanceof Error ? error.message.slice(0, 300) : 'unknown',
    }).eq('provider', 'meta').eq('event_name', event.eventName).eq('external_reference', event.externalReference)
    console.warn('[analytics:meta-server] falha de envio', { eventName: event.eventName })
    return 'failed'
  }
}

export async function sendMetaStartTrial(
  db: SupabaseClient,
  input: { trialId: string; email?: string | null; eventSourceUrl: string },
): Promise<'sent' | 'duplicate' | 'not_configured' | 'failed'> {
  const eventId = `trial:${input.trialId}`
  const { value } = META_ANALYTICS_CONFIG.trial
  const { currency } = META_ANALYTICS_CONFIG
  console.info('[meta:start-trial] Preparando evento', { eventId, value, currency, reference: input.trialId })
  if (!validateMetaMonetaryEvent(value, currency)) {
    console.warn('[meta:start-trial] Parâmetros inválidos', { eventId, value, currency })
    return 'failed'
  }
  const result = await sendMetaConversion(db, {
    eventName: 'StartTrial',
    eventId,
    externalReference: input.trialId,
    eventSourceUrl: input.eventSourceUrl,
    email: input.email,
    customData: metaStartTrialParameters(),
  })
  const messages = {
    sent: 'Evento enviado',
    duplicate: 'Evento já processado',
    not_configured: 'Falha no envio',
    failed: 'Falha no envio',
  } as const
  const log = result === 'failed' ? console.warn : console.info
  log(`[meta:start-trial] ${messages[result]}`, { eventId, value, currency, status: result, reference: input.trialId })
  return result
}
