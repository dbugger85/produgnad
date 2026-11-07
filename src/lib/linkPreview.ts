// The link preview for a parent's order link (title, text, picture), as Messenger, WhatsApp and
// SMS apps show it. Used by the Cloudflare function (functions/k/[code].ts) and by the preview card
// on the parent page, so the parent sees exactly what friends will see.
import { defaultPictureFor, defaultPreviewUrl } from './defaultPictures'

export interface PreviewInput {
  campaign: { name: string; organizer_label: string; purpose_text: string }
  parent: { name: string; child_first_name: string }
  products: {
    name: string
    /** Null when the contribution isn't shown to everyone (the apps only see public data) */
    to_team_amount: number | null
    images: { path: string; width: number | null; height: number | null }[]
  }[]
}

export interface LinkPreview {
  title: string
  description: string
  /** Storage path of an uploaded picture, or a site path to a standard picture, or null for the default */
  image: { kind: 'upload'; path: string; width?: number; height?: number } | { kind: 'site'; path: string; width: number; height: number } | null
}

const nf = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 })
const kr = (n: number) => `${nf.format(n)} kr`

export function buildLinkPreview({ campaign, parent, products }: PreviewInput): LinkPreview {
  const via = parent.child_first_name ? `${parent.name}, forelder til ${parent.child_first_name}` : parent.name
  const perUnit = products.find((p) => p.to_team_amount !== null && Number(p.to_team_amount) > 0)
  // Sentences without a final full stop, joined with ". " (the owner's style: no full stop at the end)
  const description = [
    campaign.organizer_label,
    `Bestill via ${via}`,
    campaign.purpose_text,
    perUnit ? `${kr(Number(perUnit.to_team_amount))} av hver ${perUnit.name.toLowerCase()} går til laget` : '',
  ]
    .map((s) => s.trim().replace(/\.+$/, ''))
    .filter(Boolean)
    .join('. ')

  // Only JPEG/PNG: some apps (WhatsApp) don't show WebP. Then a standard picture, then the default one.
  const first = products.find((p) => p.images.length > 0)?.images[0]
  const own = first && /\.(jpe?g|png)$/i.test(first.path) ? first : undefined
  const standard = own ? null : products.map((p) => defaultPictureFor(p.name)).find(Boolean)
  const image: LinkPreview['image'] = own
    ? { kind: 'upload', path: own.path, width: own.width ?? undefined, height: own.height ?? undefined }
    : standard
      ? { kind: 'site', path: defaultPreviewUrl(standard), width: 1200, height: 630 }
      : null

  return { title: `${campaign.name} – bestill via ${parent.name}`, description, image }
}
