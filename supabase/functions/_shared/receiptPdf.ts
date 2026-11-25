// The receipt (kvittering) as an A4 PDF: attached to the «paid» email when the friend asked for a
// receipt, and downloaded from the status page (Edge Function receipt-pdf). Same content as
// src/pages/ReceiptPage.tsx. Data is what order_status_by_token returns.
import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'npm:pdf-lib@1.17.1'
import { kr, osloDate, phone } from './format.ts'

export interface ReceiptData {
  code: string
  buyer_first_name: string
  receipt_name: string
  paid_at: string
  amount: number
  lines: { name: string; qty: number; unit_price: number }[]
  parent: { name: string; phone: string }
  campaign: { name: string; team_name?: string; organizer_label: string; purpose_text: string }
}

const BRAND = rgb(0, 0x2e / 255, 0x5f / 255)
const INK = rgb(0x12 / 255, 0x1a / 255, 0x26 / 255)
const MUTED = rgb(0x57 / 255, 0x53 / 255, 0x4e / 255)
const LINE = rgb(0xe7 / 255, 0xe5 / 255, 0xe4 / 255)

const APP_URL = Deno.env.get('APP_URL') ?? 'https://dugnad.substitutor.no'

/** The ProDugnad logo for the top of the receipt; none if the site doesn't answer quickly */
export async function loadLogo(): Promise<Uint8Array | null> {
  try {
    const res = await fetch(`${APP_URL}/email-logo.png`, { signal: AbortSignal.timeout(3000) })
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null
  } catch {
    return null
  }
}

/** The file name for downloads and attachments */
export const receiptFileName = (code: string) => `kvittering-${code.replace(/[^\w-]/g, '')}.pdf`

export async function receiptPdf(r: ReceiptData, logoPng?: Uint8Array | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Kvittering ${r.code}`)
  doc.setAuthor(r.campaign.organizer_label)
  doc.setCreator('ProDugnad')
  const page = doc.addPage([595.28, 841.89]) // A4
  const regular = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)

  const left = 64
  const right = page.getWidth() - 64
  const width = right - left
  let y = page.getHeight() - 64

  if (logoPng) {
    try {
      const logo = await doc.embedPng(logoPng)
      const h = 32
      const w = (logo.width / logo.height) * h
      page.drawImage(logo, { x: left, y: y - h, width: w, height: h })
      y -= h + 18
    } catch {
      // No logo is fine
    }
  }

  const text = (s: string, x: number, size: number, font = regular, color = INK) =>
    page.drawText(safe(s, font), { x, y, size, font, color })
  const rightText = (s: string, size: number, font = regular, color = INK) => {
    const t = safe(s, font)
    page.drawText(t, { x: right - font.widthOfTextAtSize(t, size), y, size, font, color })
  }
  const rule = (gap = 10) => {
    page.drawLine({ start: { x: left, y: y + gap + 2 }, end: { x: right, y: y + gap + 2 }, thickness: 0.75, color: LINE })
  }
  const paragraph = (s: string, x: number, maxWidth: number, size: number, font = regular, color = INK, lead = 1.4) => {
    for (const line of wrap(safe(s, font), font, size, maxWidth)) {
      page.drawText(line, { x, y, size, font, color })
      y -= size * lead
    }
  }

  y -= 11
  paragraph(r.campaign.organizer_label, left, width, 11, bold, BRAND)
  y -= 22
  text('KVITTERING', left, 30, bold)
  y -= 22
  text(`Bestilling ${r.code} · ${osloDate(r.paid_at)}`, left, 12, regular, MUTED)
  y -= 36

  // Seller and buyer
  const labelW = 80
  const block = (label: string, rows: { s: string; font: PDFFont }[]) => {
    rule()
    text(label, left, 11, regular, MUTED)
    for (const row of rows) paragraph(row.s, left + labelW, width - labelW, 11, row.font)
    y -= 12
  }
  block('Selger', [
    { s: r.parent.name, font: bold },
    ...(r.parent.phone ? [{ s: phone(r.parent.phone), font: regular }] : []),
    { s: `Dugnad til inntekt for ${r.campaign.team_name || r.campaign.organizer_label}`, font: regular },
  ])
  block(
    'Kjøper',
    r.receipt_name
      ? [{ s: r.receipt_name, font: bold }, { s: `Bestilt av ${r.buyer_first_name}`, font: regular }]
      : [{ s: r.buyer_first_name, font: bold }],
  )
  y -= 18

  // Lines
  const amountW = 90
  for (const l of r.lines) {
    rule()
    const start = y
    paragraph(`${l.qty} × ${l.name} à ${kr(l.unit_price)}`, left, width - amountW, 11)
    const after = y
    y = start
    rightText(kr(l.qty * Number(l.unit_price)), 11)
    y = after - 8
  }
  rule()
  text('Totalt', left, 12, bold)
  rightText(kr(r.amount), 12, bold)
  y -= 40

  text(`Betalt med Vipps ${osloDate(r.paid_at)}`, left, 11)
  y -= 16
  text('Ikke MVA-pliktig (privatsalg / dugnad)', left, 11, regular, MUTED)

  // Footer: who organizes it and the purpose, like every page and email
  y = 64 + 3 * 13
  rule(14)
  paragraph(`${r.campaign.name} er organisert av ${r.campaign.organizer_label}, ikke av klubben direkte`, left, width, 9, regular, MUTED)
  if (r.campaign.purpose_text) paragraph(r.campaign.purpose_text, left, width, 9, regular, MUTED)

  return await doc.save()
}

/** Keeps only the characters the standard PDF fonts can draw (Latin-1 and a few more) */
function safe(s: string, font: PDFFont): string {
  let out = ''
  for (const ch of String(s ?? '').replace(/[‐‑]/g, '-').replace(/[  ]/g, ' ').replace(/[\r\n\t]+/g, ' ')) {
    try {
      font.encodeText(ch)
      out += ch
    } catch {
      // Emoji and other characters the font lacks are left out
    }
  }
  return out.replace(/ {2,}/g, ' ').trim()
}

function wrap(s: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = s.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}
