// The receipt for a paid friend order as a PDF: GET ?token=<status token>.
// The status token is the same secret as in the friend's /status/ and /kvittering/ links, so this
// shows nothing those pages don't already show. No login.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cors } from '../_shared/outbox.ts'
import { loadLogo, receiptFileName, receiptPdf, type ReceiptData } from '../_shared/receiptPdf.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response('Fant ikke bestillingen', { status: 404, headers: cors })
  const { data, error } = await supabase.rpc('order_status_by_token', { p_token: token })
  if (error) return new Response('Noe gikk galt', { status: 500, headers: cors })
  if (!data) return new Response('Fant ikke bestillingen', { status: 404, headers: cors })
  if (!data.paid_at) return new Response('Kvitteringen kommer når betalingen er registrert', { status: 409, headers: cors })
  const pdf = await receiptPdf(data as ReceiptData, await loadLogo())
  return new Response(pdf as Uint8Array<ArrayBuffer>, {
    headers: {
      ...cors,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${receiptFileName(data.code)}"`,
      'Cache-Control': 'private, no-store',
    },
  })
})
