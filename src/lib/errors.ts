// Database errors are short codes; this turns them into Norwegian messages.

const messages: Record<string, string> = {
  UNKNOWN_LINK: 'Fant ikke denne lenken. Sjekk at du har hele lenken.',
  CAMPAIGN_CLOSED: 'Dugnaden tar ikke imot flere bestillinger.',
  CAMPAIGN_LOCKED: 'Bestillingene er låst fordi varene er bestilt fra leverandøren.',
  INVALID_NAME: 'Skriv inn et fornavn.',
  INVALID_EMAIL: 'E-postadressen ser ikke riktig ut.',
  INVALID_QTY: 'Antallet er for høyt.',
  INVALID_PRODUCT: 'En av varene finnes ikke lenger. Last siden på nytt.',
  INVALID_LINES: 'Noe gikk galt med varene. Last siden på nytt.',
  EMPTY_ORDER: 'Velg minst én vare.',
  RATE_LIMIT: 'Mange bestillinger akkurat nå. Prøv igjen om litt.',
  UNKNOWN_JOIN_CODE: 'Fant ikke denne påmeldingslenken.',
  INVALID_PROFILE: 'Fyll inn navn og telefonnummer.',
  NOT_LOGGED_IN: 'Du må logge inn først.',
  NOT_ALLOWED: 'Du har ikke tilgang til dette.',
  UNKNOWN_ORDER: 'Fant ikke bestillingen.',
  UNKNOWN_USER: 'Fant ingen bruker med den e-postadressen. Personen må logge inn én gang først.',
  LAST_ADMIN: 'Det må være minst én admin.',
  CAMPAIGN_NOT_CLOSED: 'Dugnaden må være avsluttet først.',
  NO_CLOSING_MESSAGE: 'Skriv en avslutningsmelding under Oppsett først.',
  UNKNOWN_CAMPAIGN: 'Fant ikke dugnaden.',
  CREATE_FAILED: 'Klarte ikke å opprette brukeren. Prøv igjen.',
  NOT_EXTRA_ORDER: 'Dette er ikke en ekstrabestilling.',
  NOT_ENOUGH_EXTRA: 'Du har ikke så mange igjen av ekstrabestillingen.',
}

export function errorText(error: unknown): string {
  const raw =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error ?? '')
  for (const code of Object.keys(messages)) {
    if (raw.includes(code)) return messages[code]
  }
  if (/fetch|network/i.test(raw)) return 'Fikk ikke kontakt med serveren. Sjekk nettet og prøv igjen.'
  return raw || 'Noe gikk galt. Prøv igjen.'
}
