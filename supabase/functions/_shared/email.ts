// Email texts (Norwegian). Every email names the organizer and the purpose,
// Replies from parents go to the campaign's contact admin; replies from friends go to the parent
// they ordered through (friends don't see the admins, owner's choice 7 Nov 2026).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

const APP_URL = Deno.env.get('APP_URL') ?? 'https://dugnad.substitutor.no'

export interface Rendered {
  fromName: string
  replyTo: string | null
  subject: string
  html: string
  text: string
}

// Not tied to a campaign: someone was made admin
function renderAdminInvite(row: OutboxRow & { to_email?: string }): Rendered {
  const login = `${APP_URL}/logg-inn?e=${encodeURIComponent(row.to_email ?? '')}`
  const html = `<!doctype html><html lang="nb"><body style="margin:0;background:#f1eee8;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#121a26">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<p style="margin:0 0 12px"><img src="${APP_URL}/email-logo.png" width="180" height="48" alt="ProDugnad" style="display:block;border:0"></p>
<div style="background:#fff;border-radius:16px;padding:20px;border:1px solid #e7e5e4">
<h1 style="font-size:20px;margin:0 0 12px">Du er lagt til som administrator</h1>
<p>Du kan nå sette opp dugnader, varer og foreldre, og registrere betalinger i ProDugnad</p>
<p>Logg inn med denne e‑postadressen. Du får en kode på e‑post, ikke noe passord</p>
${button(login, 'Logg inn')}
<p style="font-size:13px;color:#57534e">Fyll gjerne inn navn, rolle og telefon under Innstillinger når du er logget inn</p>
</div></div></body></html>`
  return { fromName: 'ProDugnad', replyTo: null, subject: 'Du er lagt til som administrator i ProDugnad', html, text: htmlToText(html) }
}

interface OutboxRow {
  to_email?: string
  created_at?: string
  kind: string
  campaign_id: string | null
  order_id: string | null
  campaign_parent_id: string | null
}

const nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 })
const kr = (n: number | string) => `${nf.format(Number(n))} kr`
// Same rules as phone() in src/lib/format.ts: "+47 912 34 567"
const phone = (p: string) => {
  const raw = (p ?? '').replace(/[^\d+]/g, '')
  const d = raw.replace(/^(\+47|0047)/, '')
  return /^\d{8}$/.test(d) ? `+47\u00a0${d.slice(0, 3)}\u00a0${d.slice(3, 5)}\u00a0${d.slice(5)}` : (p ?? '').trim()
}
const esc = (s: string) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function layout(campaign: { organizer_label: string; purpose_text: string; name: string }, contactLine: string, body: string) {
  return `<!doctype html><html lang="nb"><body style="margin:0;background:#f1eee8;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#121a26">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<p style="margin:0 0 12px"><img src="${APP_URL}/email-logo.png" width="180" height="48" alt="ProDugnad" style="display:block;border:0"></p>
<p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#002e5f">${esc(campaign.organizer_label)}</p>
<div style="background:#fff;border-radius:16px;padding:20px;border:1px solid #e7e5e4">${body}</div>
<p style="font-size:13px;color:#57534e;line-height:1.5;margin-top:16px">
${esc(campaign.name)} er organisert av ${esc(campaign.organizer_label)}, ikke av klubben direkte
${campaign.purpose_text ? `<br>${esc(campaign.purpose_text)}` : ''}
${contactLine ? `<br>${contactLine}` : ''}</p>
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

// Same three lines as on the pages: amount and name, the number, the message code
function vippsBlock(amount: number, name: string, number: string, code: string) {
  return `<div style="text-align:center;background:#f1eee8;border:1px solid #dedad2;border-radius:14px;padding:16px 12px;margin:14px 0">
<p style="font-size:18px;margin:0 0 8px">Vipps <strong>${kr(amount)}</strong> til <strong>${esc(name)}</strong></p>
<p style="font-size:24px;font-weight:700;margin:0 0 8px;white-space:nowrap">${esc(phone(number))}</p>
<p style="font-size:16px;margin:0">Skriv <strong>${esc(code)}</strong> i meldingen</p></div>`
}

function button(href: string, label: string) {
  return `<p><a href="${esc(href)}" style="display:inline-block;background:#002e5f;color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:10px">${esc(label)}</a></p>`
}

export async function renderEmail(db: SupabaseClient, row: OutboxRow): Promise<Rendered | null> {
  if (row.kind === 'admin_invite') return renderAdminInvite(row)
  const { data: campaign } = await db.from('campaigns').select('*').eq('id', row.campaign_id).single()
  if (!campaign) return null
  const { data: contact } = campaign.contact_admin_user_id
    ? await db.from('profiles').select('name, email').eq('user_id', campaign.contact_admin_user_id).single()
    : { data: null }
  const base = {
    fromName: `${campaign.organizer_label.replace(/[<>"]/g, '')} via ProDugnad`,
    // With "Ansvarlige og kontakt = Ikke vist" the admins' addresses aren't shown either
    replyTo: campaign.admins_visibility === 'none' ? null : contact?.email || null,
  }
  // Emails to parents: replies to the contact admin
  const wrap = (subject: string, body: string): Rendered => {
    const line = contact?.name && campaign.admins_visibility !== 'none' ? `Kontakt: ${esc(contact.name)} (svar på denne e‑posten)` : ''
    const html = layout(campaign, line, body)
    return { ...base, subject, html, text: htmlToText(html) }
  }

  const { data: cp } = await db
    .from('campaign_parents')
    .select('*, profiles(name, phone, email)')
    .eq('id', row.campaign_parent_id)
    .single()
  if (!cp) return null
  const parentName: string = cp.profiles?.name ?? ''
  // Emails to friends: replies go to the parent they ordered through, unless the campaign shows
  // its admins to everyone (Oppsett → Ansvarlige og kontakt = Alle)
  const wrapFriend = (subject: string, body: string): Rendered => {
    if (campaign.admins_visibility === 'all' && contact?.email) return wrap(subject, body)
    const first = parentName.split(' ')[0]
    const line = first ? `Spørsmål? Svar på denne e‑posten, så kommer den til ${esc(first)}` : ''
    const html = layout(campaign, line, body)
    return { ...base, replyTo: cp.profiles?.email || null, subject, html, text: htmlToText(html) }
  }

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
      return wrapFriend(
        `Bestilling ${order.code}: Vipps ${kr(amount)} til ${parentName}`,
        `<h1 style="font-size:20px;margin:0 0 12px">Takk for bestillingen, ${esc(order.buyer_first_name)}!</h1>
<table style="width:100%;font-size:15px;border-collapse:collapse">${lines}
<tr><td style="padding-top:8px;font-weight:700">Totalt</td><td style="padding-top:8px;text-align:right;font-weight:700">${kr(amount)}</td></tr></table>
${vippsBlock(amount, parentName, cp.profiles?.phone ?? '', order.code)}
${button(statusUrl, 'Se status på bestillingen')}
<p>${esc(parentName)} leverer varene når de kommer</p>`,
      )
    }
    return wrapFriend(
      `Takk! Betalingen for ${order.code} er registrert`,
      `<h1 style="font-size:20px;margin:0 0 12px">Takk, ${esc(order.buyer_first_name)}!</h1>
<p>${esc(parentName)} har registrert at du har betalt ${kr(amount)} for bestilling ${esc(order.code)}</p>
${button(statusUrl, 'Se status på bestillingen')}`,
    )
  }

  if (row.kind === 'parent_payment') {
    const { data: totals } = await db.from('v_parent_totals').select('*').eq('campaign_parent_id', cp.id).single()
    const left = Number(totals?.diff ?? 0)
    return wrap(
      `Betaling registrert: ${kr(totals?.paid ?? 0)} av ${kr(totals?.owed ?? 0)}`,
      `<h1 style="font-size:20px;margin:0 0 12px">Takk, ${esc(parentName.split(' ')[0])}!</h1>
<p>Vi har registrert betalingen din for ${esc(campaign.name)}. Du har nå betalt <strong>${kr(totals?.paid ?? 0)}</strong> av <strong>${kr(totals?.owed ?? 0)}</strong></p>
${left > 0 ? `<p>Det gjenstår <strong>${kr(left)}</strong></p>${vippsBlock(left, campaign.admin_vipps_name, campaign.admin_vipps_phone, cp.payment_code)}` : left < 0 ? `<p>Du har betalt ${kr(-left)} for mye. Vi tar kontakt</p>` : '<p>Alt er betalt. Tusen takk!</p>'}
${button(`${APP_URL}/forelder/${cp.id}`, 'Se dine bestillinger')}`,
    )
  }

  if (row.kind === 'digest') {
    // Orders since this parent's previous digest (or the last 24 hours), up to when this one was queued
    const until = row.created_at ? new Date(row.created_at) : new Date()
    const { data: prev } = await db
      .from('email_outbox')
      .select('created_at')
      .eq('kind', 'digest')
      .eq('campaign_parent_id', cp.id)
      .lt('created_at', until.toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const since = prev ? new Date(prev.created_at) : new Date(until.getTime() - 24 * 3600 * 1000)
    const { data: orders } = await db
      .from('orders')
      .select('code, type, buyer_first_name, created_by, created_at, paid_to_parent_at, order_lines(qty, unit_price, products(name))')
      .eq('campaign_parent_id', cp.id)
      .is('deleted_at', null)
      .order('created_at')
    type Line = { qty: number; unit_price: number; products: { name: string } }
    type O = { code: string; type: string; buyer_first_name: string; created_by: string; created_at: string; paid_to_parent_at: string | null; order_lines: Line[] }
    const all = (orders ?? []) as O[]
    const amount = (o: O) => o.order_lines.reduce((s, l) => s + l.qty * Number(l.unit_price), 0)
    const fresh = all.filter((o) => {
      const t = new Date(o.created_at)
      return o.created_by === 'friend' && t > since && t <= until
    })
    if (fresh.length === 0) return null
    const freshSum = fresh.reduce((s, o) => s + amount(o), 0)
    const unpaid = all.filter((o) => o.type === 'friend' && !o.paid_to_parent_at)
    const unpaidSum = unpaid.reduce((s, o) => s + amount(o), 0)
    const { data: totals } = await db.from('v_parent_totals').select('*').eq('campaign_parent_id', cp.id).single()
    const rows = fresh
      .map(
        (o) =>
          `<tr><td style="padding:4px 0"><strong>${esc(o.code)}</strong> ${esc(o.buyer_first_name)}<br><span style="color:#5d6472;font-size:13px">${o.order_lines
            .map((l) => `${l.qty} × ${esc(l.products.name)}`)
            .join(', ')}</span></td><td style="text-align:right;vertical-align:top;padding:4px 0">${kr(amount(o))}</td></tr>`,
      )
      .join('')
    return wrap(
      `${fresh.length === 1 ? '1 ny bestilling' : `${fresh.length} nye bestillinger`} siden sist (${kr(freshSum)})`,
      `<h1 style="font-size:20px;margin:0 0 12px">Nye bestillinger, ${esc(parentName.split(' ')[0])}</h1>
<table style="width:100%;font-size:15px;border-collapse:collapse">${rows}
<tr><td style="padding-top:8px;font-weight:700;border-top:1px solid #dedad2">Nye totalt</td><td style="padding-top:8px;text-align:right;font-weight:700;border-top:1px solid #dedad2">${kr(freshSum)}</td></tr></table>
<p>Totalt bestilt via deg: <strong>${kr(totals?.owed ?? 0)}</strong>${
        unpaid.length
          ? `<br>Ikke betalt ennå: <strong>${kr(unpaidSum)}</strong> fra ${unpaid.map((o) => `${esc(o.code)} ${esc(o.buyer_first_name)}`).join(', ')}`
          : '<br>Alle venner har betalt'
      }</p>
${button(`${APP_URL}/forelder/${cp.id}`, 'Åpne bestillingene')}
<p style="font-size:13px;color:#5d6472">Du får denne e‑posten bare på dager med nye bestillinger via lenken din</p>`,
    )
  }

  if (row.kind === 'closing') {
    const [{ data: progress }, { data: totals }] = await Promise.all([
      db.from('v_campaign_progress').select('raised').eq('campaign_id', campaign.id).single(),
      db.from('v_parent_totals').select('to_team').eq('campaign_parent_id', cp.id).single(),
    ])
    const raised = Number(progress?.raised ?? 0)
    const mine = Number(totals?.to_team ?? 0)
    return wrap(
      `${campaign.name}: takk for innsatsen!`,
      `<h1 style="font-size:20px;margin:0 0 12px">Takk for innsatsen, ${esc(parentName.split(' ')[0])}!</h1>
<p style="white-space:pre-line">${esc(campaign.closing_message)}</p>
<div style="text-align:center;background:#f1eee8;border:1px solid #dedad2;border-radius:14px;padding:16px 12px;margin:14px 0">
<p style="font-size:15px;margin:0 0 4px">Til laget totalt</p>
<p style="font-size:28px;font-weight:700;margin:0 0 10px">${kr(raised)}</p>
${mine > 0 ? `<p style="font-size:15px;margin:0">Via deg: <strong>${kr(mine)}</strong></p>` : ''}</div>
${button(`${APP_URL}/forelder/${cp.id}`, 'Se dine bestillinger')}`,
    )
  }

  if (row.kind === 'goods_sent') {
    return wrap(
      `Varene til ${campaign.name} er på vei til deg`,
      `<h1 style="font-size:20px;margin:0 0 12px">Varene er på vei, ${esc(parentName.split(' ')[0])}!</h1>
<p>Varene for bestillingene dine er sendt til deg. Åpne pakkelisten på mobilen og kryss av hver bestilling når den er pakket. Merk «levert» når vennen har fått varene</p>
${button(`${APP_URL}/pakkeliste/${cp.id}`, 'Åpne pakkelisten')}
<p><a href="${APP_URL}/forelder/${cp.id}" style="color:#002e5f">Til bestillingene dine</a></p>`,
    )
  }

  return null
}
