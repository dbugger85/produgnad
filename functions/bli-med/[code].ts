// /bli-med/<join code>: sign-up link for parents.
import { isPreviewBot, rpc, withPreview, type Env } from '../../functions-lib/preview'

export const onRequest = async (context: { request: Request; env: Env; params: { code: string }; next: () => Promise<Response> }) => {
  const response = await context.next()
  if (!isPreviewBot(context.request)) return response
  const campaign = await rpc<{ name: string; organizer_label: string; purpose_text: string }>(
    context.env,
    'public_campaign_by_join',
    { p_join_code: context.params.code },
  )
  if (!campaign) return response
  return withPreview(response, context.request.url, {
    title: `Bli med som selger: ${campaign.name}`,
    description: `${campaign.organizer_label}. Meld deg på, så får du din egen bestillingslenke å dele. ${campaign.purpose_text}`.trim(),
  })
}
