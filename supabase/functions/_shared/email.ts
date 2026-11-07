// Email texts (Norwegian). Every email names the organizer and the purpose,
// and replies go to the campaign's contact admin.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://dugnad.substitutor.no'

export interface Rendered {
  fromName: string
  replyTo: string | null
  subject: string
  html: string
  text: string
}

interface OutboxRow {
  kind: string
  campaign_id: string | null
  order_id: string | null
  campaign_parent_id: string | null
}

const nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 })
const kr = (n: number | string) => `${nf.format(Number(n))} kr`
const phone = (p: string) => {
  const d = (p ?? '').replace(/\D/g, '')
  return d.length === 8 ? `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5)}` : p
}
const esc = (s: string) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function layout(campaign: { organizer_label: string; purpose_text: string; name: string }, contactName: string, body: string) {
  return `<!doctype html><html lang="nb"><body style="margin:0;background:#faf7f2;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#6b4226;text-transform:uppercase;letter-spacing:.04em">${esc(campaign.organizer_label)}</p>
<div style="background:#fff;border-radius:16px;padding:20px;border:1px solid #e7e5e4">${body}</div>
<p style="font-size:13px;color:#57534e;line-height:1.5;margin-top:16px">
${esc(campaign.name)} er organisert av ${esc(campaign.organizer_label)}, ikke av klubben.
${campaign.purpose_text ? `<br>${esc(campaign.purpose_text)}` : ''}
${contactName ? `<br>Kontakt: ${esc(contactName)} (svar på denne e-posten).` : ''}</p>
</div></body></html>`
}

function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/(p|div|tr|h\d)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function button(href: string, label: string) {
  return `<p><a href="${esc(href)}" style="display:inline-block;background:#12603f;color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:10px">${esc(label)}</a></p>`
}

export async function renderEmail(db: SupabaseClient, row: OutboxRow): Promise<Rendered | null> {
  const { data: campaign } = await db.from('campaigns').select('*').eq('id', row.campaign_id).single()
  if (!campaign) return null
  const { data: contact } = campaign.contact_admin_user_id
    ? await db.from('profiles').select('name, email').eq('user_id', campaign.contact_admin_user_id).single()
    : { data: null }
  const base = {
    fromName: `${campaign.organizer_label.replace(/[<>"]/g, '')} via ProDugnad`,
    replyTo: contact?.email || null,
  }
  const wrap = (subject: string, body: string): Rendered => {
    const html = layout(campaign, contact?.name ?? '', body)
    return { ...base, subject, html, text: htmlToText(html) }
  }

  const { data: cp } = await db
    .from('campaign_parents')
    .select('*, profiles(name, phone, email)')
    .eq('id', row.campaign_parent_id)
    .single()
  if (!cp) return null
  const parentName: string = cp.profiles?.name ?? ''

  if (row.kind === 'friend_order' || row.kind === 'friend_paid') {
    const { data: order } = await db
      .from('orders')
      .select('*, order_lines(qty, unit_price, products(name))')
      .eq('id', row.order_id)
      .single()
    if (!order || order.deleted_at) return null
    const amount = order.order_lines.reduce((s: number, l: { qty: number; unit_price: number }) => s + l.qty * Number(l.unit_price), 0)
    const lines = order.order_lines
      .map((l: { qty: number; unit_price: number; products: { name: string } }) => `<tr><td>${l.qty} × ${esc(l.products.name)}</td><td style="text-align:right">${kr(l.qty * Number(l.unit_price))}</td></tr>`)
      .join('')
    const statusUrl = `${APP_URL}/status/${order.status_token}`
    if (row.kind === 'friend_order') {
      return wrap(
        `Bestilling ${order.code}: Vipps ${kr(amount)} til ${parentName}`,
        `<h1 style="font-size:20px;margin:0 0 12px">Takk for bestillingen, ${esc(order.buyer_first_name)}!</h1>
<table style="width:100%;font-size:15px;border-collapse:collapse">${lines}
<tr><td style="padding-top:8px;font-weight:700">Totalt</td><td style="padding-top:8px;text-align:right;font-weight:700">${kr(amount)}</td></tr></table>
<p style="font-size:17px;background:#fff4ec;border-radius:12px;padding:12px">Vipps <strong>${kr(amount)}</strong> til <strong>${esc(parentName)}, ${esc(phone(cp.profiles?.phone ?? ''))}</strong>, melding <strong>${esc(order.code)}</strong></p>
${button(statusUrl, 'Se status på bestillingen')}
<p>${esc(parentName)} leverer varene når de kommer.</p>`,
      )
    }
    return wrap(
      `Takk! Betalingen for ${order.code} er registrert`,
      `<h1 style="font-size:20px;margin:0 0 12px">Takk, ${esc(order.buyer_first_name)}!</h1>
<p>${esc(parentName)} har registrert at du har betalt ${kr(amount)} for bestilling ${esc(order.code)}.</p>
${button(statusUrl, 'Se status på bestillingen')}`,
    )
  }

  if (row.kind === 'parent_payment') {
    const { data: totals } = await db.from('v_parent_totals').select('*').eq('campaign_parent_id', cp.id).single()
    const left = Number(totals?.diff ?? 0)
    return wrap(
      `Betaling registrert: ${kr(totals?.paid ?? 0)} av ${kr(totals?.owed ?? 0)}`,
      `<h1 style="font-size:20px;margin:0 0 12px">Takk, ${esc(parentName.split(' ')[0])}!</h1>
<p>Vi har registrert betalingen din for ${esc(campaign.name)}. Du har nå betalt <strong>${kr(totals?.paid ?? 0)}</strong> av <strong>${kr(totals?.owed ?? 0)}</strong>.</p>
${left > 0 ? `<p>Det gjenstår <strong>${kr(left)}</strong>. Vipps til ${esc(campaign.admin_vipps_name)}, ${esc(phone(campaign.admin_vipps_phone))}, melding <strong>${esc(cp.payment_code)}</strong>.</p>` : left < 0 ? `<p>Du har betalt ${kr(-left)} for mye. Vi tar kontakt.</p>` : '<p>Alt er betalt. Tusen takk!</p>'}
${button(`${APP_URL}/forelder/${cp.id}`, 'Se dine bestillinger')}`,
    )
  }

  if (row.kind === 'goods_sent') {
    return wrap(
      `Varene til ${campaign.name} er på vei til deg`,
      `<h1 style="font-size:20px;margin:0 0 12px">Varene er på vei, ${esc(parentName.split(' ')[0])}!</h1>
<p>Varene for bestillingene dine er sendt til deg. Bruk pakkelisten for å fordele dem, og kryss av «levert» etter hvert.</p>
${button(`${APP_URL}/forelder/${cp.id}`, 'Åpne bestillingene')}`,
    )
  }

  return null
}
