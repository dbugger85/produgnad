// /k/<link code>: a parent's order link. Preview with the campaign, the parent and the first product picture.
import { imageUrl, kr, rpc, withPreview, type Env } from '../../functions-lib/preview'

interface LinkPage {
  campaign: { name: string; organizer_label: string; purpose_text: string }
  parent: { name: string; child_first_name: string }
  products: { name: string; price: number; to_team_amount: number; images: { path: string; width: number | null; height: number | null }[] }[]
}

export const onRequest = async (context: { request: Request; env: Env; params: { code: string }; next: () => Promise<Response> }) => {
  const response = await context.next()
  const data = await rpc<LinkPage>(context.env, 'public_campaign_by_link', { p_link_code: context.params.code })
  if (!data?.campaign) return response

  const { campaign, parent, products } = data
  const via = parent.child_first_name ? `${parent.name}, forelder til ${parent.child_first_name}` : parent.name
  const first = products.find((p) => p.images.length > 0)
  const image = first?.images[0]
  const perUnit = products.find((p) => p.to_team_amount > 0)
  const description = [
    `${campaign.organizer_label}. Bestill via ${via}.`,
    campaign.purpose_text,
    perUnit ? `${kr(perUnit.to_team_amount)} av hver ${perUnit.name.toLowerCase()} går til laget.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return withPreview(response, context.request.url, {
    title: `${campaign.name} – bestill via ${parent.name}`,
    description,
    // Only JPEG/PNG: some apps (WhatsApp) don't show WebP previews. Otherwise the default picture.
    image: image && /\.(jpe?g|png)$/i.test(image.path) ? imageUrl(context.env, image.path) : undefined,
    imageWidth: image?.width ?? undefined,
    imageHeight: image?.height ?? undefined,
  })
}
