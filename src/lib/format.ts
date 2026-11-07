// Norwegian formats used everywhere in the UI.

const numberFormat = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 })
const dateFormat = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Oslo',
})
const weekdayFormat = new Intl.DateTimeFormat('nb-NO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Oslo',
})
const shortDateTime = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Oslo',
})

/** 1440 -> "1 440 kr" */
export function kr(amount: number | string | null | undefined): string {
  return `${numberFormat.format(Number(amount ?? 0))} kr`
}

/** 1440 -> "1440" (for copying into Vipps) */
export function plainAmount(amount: number | string | null | undefined): string {
  return String(Math.round(Number(amount ?? 0) * 100) / 100).replace('.', ',')
}

/** Date-only strings ("2026-11-20") are read as that calendar day, not UTC midnight. */
function toDate(value: string | Date): Date {
  if (value instanceof Date) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00Z`)
  return new Date(value)
}

/** "20. november 2026" */
export function longDate(value: string | Date | null | undefined): string {
  return value ? dateFormat.format(toDate(value)) : ''
}

/** "fredag 20. november" */
export function weekdayDate(value: string | Date | null | undefined): string {
  return value ? weekdayFormat.format(toDate(value)) : ''
}

/** "7. nov., 14:05" */
export function shortDateTimeText(value: string | Date | null | undefined): string {
  return value ? shortDateTime.format(toDate(value)) : ''
}

/** "91234567" -> "912 34 567" */
export function phone(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '')
  if (digits.length === 8) return `${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`
  return value ?? ''
}

export function phoneDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/** Days from today (Oslo) until a date-only string. Negative when past. */
export function daysUntil(dateOnly: string | null | undefined, now = new Date()): number | null {
  if (!dateOnly) return null
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(now)
  const a = Date.parse(`${today}T00:00:00Z`)
  const b = Date.parse(`${dateOnly}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

export function todayOslo(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(now)
}
