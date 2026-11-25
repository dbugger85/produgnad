// Formats shared by the emails and the receipt PDF (same rules as src/lib/format.ts)

const nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 })
// Non-breaking space so "250 kr" never splits over two lines
export const kr = (n: number | string) => `${nf.format(Number(n))} kr`
// Same rules as phone() in src/lib/format.ts: "+47 912 34 567"
export const phone = (p: string) => {
  const raw = (p ?? '').replace(/[^\d+]/g, '')
  const d = raw.replace(/^(\+47|0047)/, '')
  return /^\d{8}$/.test(d) ? `+47 ${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5)}` : (p ?? '').trim()
}
// "20. november 2026" in Norwegian time, like longDate() in src/lib/format.ts
export const osloDate = (d: string | Date) =>
  new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Oslo' }).format(new Date(d))
