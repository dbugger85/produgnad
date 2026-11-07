// /k/<link code>: a parent's order link. Preview with the campaign, the parent and the first product picture.
import { buildLinkPreview, type PreviewInput } from '../../src/lib/linkPreview'
import { imageUrl, isPreviewBot, rpc, withPreview, type Env } from '../../functions-lib/preview'

export const onRequest = async (context: { request: Request; env: Env; params: { code: string }; next: () => Promise<Response> }) => {
  const response = await context.next()
  if (!isPreviewBot(context.request)) return response
  const data = await rpc<PreviewInput>(context.env, 'public_campaign_by_link', { p_link_code: context.params.code })
  if (!data?.campaign) return response

  const p = buildLinkPreview(data)
  return withPreview(response, context.request.url, {
    title: p.title,
    description: p.description,
    image: !p.image ? undefined : p.image.kind === 'upload' ? imageUrl(context.env, p.image.path) : new URL(p.image.path, context.request.url).href,
    imageWidth: p.image?.width,
    imageHeight: p.image?.height,
  })
}
