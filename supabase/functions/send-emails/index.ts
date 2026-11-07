// Sends queued emails from public.email_outbox through Resend.
// Called by the app right after a friend orders, and by the daily cron.
// It takes no input, so calling it without login is harmless.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { renderEmail, type Rendered } from '../_shared/email.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_ADDRESS = Deno.env.get('EMAIL_FROM_ADDRESS') ?? 'dugnad@substitutor.no'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function send(email: Rendered, to: string): Promise<void> {
  const body = {
    from: `${email.fromName} <${FROM_ADDRESS}>`,
    to: [to],
    subject: email.subject,
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
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const { data: rows, error } = await supabase.rpc('claim_outbox', { p_limit: 20 })
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors })

  let sent = 0
  let failed = 0
  for (const row of rows ?? []) {
    try {
      const email = await renderEmail(supabase, row)
      if (email) await send(email, row.to_email)
      await supabase
        .from('email_outbox')
        .update({ sent_at: new Date().toISOString(), error: email ? (RESEND_API_KEY ? null : 'dry run') : 'nothing to send' })
        .eq('id', row.id)
      sent++
    } catch (e) {
      failed++
      await supabase.from('email_outbox').update({ error: String(e).slice(0, 500) }).eq('id', row.id)
    }
  }
  return new Response(JSON.stringify({ sent, failed }), { headers: { ...cors, 'Content-Type': 'application/json' } })
})
