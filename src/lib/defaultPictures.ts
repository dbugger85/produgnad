// Standard pictures for common dugnad products, used when a product has no picture of its own.
// Chosen from the product name. Files are in public/defaults (SVG for the app, PNG 1200×630 for link previews).

export type DefaultPicture = 'kaffe' | 'te' | 'sokker'

const RULES: [DefaultPicture, RegExp][] = [
  ['kaffe', /kaffe|coffee|espresso/i],
  ['sokker', /sokk|sock/i],
  // "Te", "Te, 100 g", "Grønn te", "Urtete" – but not words that just contain "te" ("Tekopp" is fine too)
  ['te', /(^|[^a-zæøå])te([^a-zæøå]|$)|urtete|\btea\b|tekopp/i],
]

export function defaultPictureFor(name: string): DefaultPicture | null {
  for (const [key, re] of RULES) if (re.test(name)) return key
  return null
}

export function defaultPictureUrl(key: DefaultPicture): string {
  return `/defaults/${key}.svg`
}

export function defaultPreviewUrl(key: DefaultPicture): string {
  return `/defaults/${key}-preview.png`
}
