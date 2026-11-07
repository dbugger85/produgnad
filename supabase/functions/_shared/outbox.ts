// Sends queued emails from public.email_outbox through Resend. Shared by send-emails and daily-digest.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { renderEmail, type Rendered } from './email.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_ADDRESS = Deno.env.get('EMAIL_FROM_ADDRESS') ?? 'dugnad@substitutor.no'

/** Resend's daily or monthly quota is used up: stop, and leave the rest in the queue. */
class QuotaError extends Error {}

// A display name with commas or quotes must be quoted, or the email is rejected
const quoteName = (name: string) => `"${name.replace(/["\\\r\n]/g, '').trim()}"`
const oneLine = (text: string) => text.replace(/[\r\n]+/g, ' ').trim()

async function send(email: Rendered, to: string): Promise<void> {
  const body = {
    from: `${quoteName(email.fromName)} <${FROM_ADDRESS}>`,
    to: [to],
    subject: oneLine(email.subject),
    html: email.html,
    text: email.text,
    ...(email.replyTo ? { reply_to: email.replyTo } : {}),
  }
  if (!RESEND_API_KEY) {
    console.log('[dry run, no RESEND_API_KEY]', JSON.stringify({ to, subject: email.subject, replyTo: email.replyTo }))
    return
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 429 || /quota/i.test(text)) throw new QuotaError(text)
    throw new Error(`Resend ${res.status}: ${text}`)
  }
}

/** Sends up to `rounds` × 20 queued emails (the database caps it at 90 a day). */
export async function drainOutbox(
  db: SupabaseClient,
  rounds = 1,
): Promise<{ sent: number; failed: number; quotaReached?: boolean }> {
  let sent = 0
  let failed = 0
  for (let r = 0; r < rounds; r++) {
    const { data: rows, error } = await db.rpc('claim_outbox', { p_limit: 20 })
    if (error) throw new Error(error.message)
    if (!rows?.length) break
    for (const row of rows) {
      try {
        const email = await renderEmail(db, row)
        if (email) await send(email, row.to_email)
        await db
          .from('email_outbox')
          .update({ sent_at: new Date().toISOString(), error: email ? (RESEND_API_KEY ? null : 'dry run') : 'nothing to send' })
          .eq('id', row.id)
        sent++
      } catch (e) {
        if (e instanceof QuotaError) {
          // Back in the queue for this one and the rest of this batch; try again later
          for (const r of rows.slice(rows.indexOf(row))) await db.rpc('release_outbox', { p_id: r.id })
          return { sent, failed, quotaReached: true }
        }
        failed++
        await db.from('email_outbox').update({ error: String(e).slice(0, 500) }).eq('id', row.id)
      }
    }
  }
  return { sent, failed }
}

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
