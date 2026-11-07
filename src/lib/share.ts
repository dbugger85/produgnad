// Share texts are filled from admin-written templates. No AI.

export type TemplateVars = Partial<
  Record<'barn' | 'lag' | 'produkter' | 'frist' | 'lenke' | 'forelder' | 'beløp' | 'kode' | 'vipps', string>
>

export const PLACEHOLDERS = ['barn', 'lag', 'produkter', 'frist', 'lenke', 'forelder', 'beløp', 'kode', 'vipps'] as const

export function fillTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{([a-zæøå]+)\}/gi, (whole, name: string) => {
    const value = vars[name.toLowerCase() as keyof TemplateVars]
    return value === undefined ? whole : value
  })
}

/** Shares through the phone's share menu. Returns false if not available (then copy instead). */
export async function shareText(text: string, url?: string): Promise<boolean> {
  if (typeof navigator.share !== 'function') return false
  try {
    await navigator.share(url ? { text, url } : { text })
    return true
  } catch (error) {
    // The user closed the share menu: that still counts as handled.
    return error instanceof DOMException && error.name === 'AbortError'
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

export const DEFAULT_TEMPLATES = {
  short:
    'Dugnaden du faktisk trenger! {barn} og resten av {lag} selger {produkter} til lagkassen. Bestill innen {frist} her: {lenke} Tusen takk for støtten!',
  long:
    'Hei alle sammen!\n\nDugnaden du faktisk trenger! {barn} og resten av {lag} har dugnad til lagkassen.\n\nVi selger: {produkter}\n\nBestill innen {frist} her: {lenke}\n\nDu betaler med Vipps til meg ({forelder}, {vipps}) når du har bestilt, og jeg leverer varene når de kommer.\n\nTusen takk for at du støtter {barn} og laget!',
  reminder:
    'Hei! Bare en påminnelse: fristen for å bestille fra {lag} sin dugnad er {frist}. Bestill her: {lenke} Takk!',
  paymentReminder: 'Hei! Bestillingen din {kode} er {beløp}. Vipps til {vipps} med melding {kode}. Takk!',
}
