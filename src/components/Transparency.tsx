import { kr, phone } from '../lib/format'
import type { PublicCampaign, PublicProduct } from '../lib/types'

/** Who organizes, who the admins are, and where the money goes. Shown on every public page. */
export function Transparency({
  campaign,
  products = [],
}: {
  campaign: PublicCampaign
  products?: Pick<PublicProduct, 'name' | 'price' | 'to_team_amount'>[]
}) {
  return (
    <section className="space-y-2 text-sm text-muted">
      <p>
        Salget er organisert av <strong className="text-ink">{campaign.organizer_label}</strong>, ikke av klubben
        direkte.
      </p>
      {campaign.admins.length > 0 && (
        <p>
          Ansvarlige:{' '}
          {campaign.admins.map((a, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {a.name}
              {a.role_title && ` (${a.role_title})`}
              {a.phone && `, ${phone(a.phone)}`}
            </span>
          ))}
        </p>
      )}
      {campaign.purpose_text && <p>{campaign.purpose_text}</p>}
      {products
        .filter((p) => p.to_team_amount !== null && Number(p.to_team_amount) > 0)
        .map((p) => (
          <p key={p.name}>
            {kr(p.to_team_amount)} av hver {p.name.toLowerCase()} på {kr(p.price)} går til laget.
          </p>
        ))}
    </section>
  )
}

export function ClosingMessage({ campaign }: { campaign: PublicCampaign }) {
  if (!campaign.closed || !campaign.closing_message) return null
  return (
    <section className="rounded-2xl bg-brand-soft p-4 text-brand-dark">
      <p className="whitespace-pre-line">{campaign.closing_message}</p>
    </section>
  )
}
