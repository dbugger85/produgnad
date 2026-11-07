import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ProgressBar } from '../components/ProgressBar'
import { ClosingMessage, Transparency } from '../components/Transparency'
import { Card, ErrorBox, Loading, Logo, Page } from '../components/ui'
import { VippsSimple } from '../components/VippsSimple'
import { kr, longDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import { STATUS_LABEL, type StatusPage } from '../lib/types'

export default function OrderStatusPage() {
  const { token = '' } = useParams()
  const [order, setOrder] = useState<StatusPage | null | undefined>(undefined)

  useEffect(() => {
    if (!/^[0-9a-f-]{36}$/i.test(token)) {
      setOrder(null)
      return
    }
    supabase.rpc('order_status_by_token', { p_token: token }).then(({ data }) => setOrder((data as StatusPage) ?? null))
  }, [token])

  if (order === undefined) return <Loading />
  if (order === null)
    return (
      <Page>
        <ErrorBox>Fant ikke bestillingen. Sjekk at du har hele lenken.</ErrorBox>
      </Page>
    )

  const { campaign, parent } = order

  return (
    <Page>
      <header className="space-y-1">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <p className="text-sm font-semibold text-brand">{campaign.organizer_label}</p>
        </div>
        <h1 className="font-display text-[32px] leading-[1.05] tracking-wide uppercase">Bestilling {order.code}</h1>
        <p className="text-lg font-semibold text-brand">Status: {STATUS_LABEL[order.status]}</p>
        <p className="text-ink">
          {order.buyer_first_name}, bestilt {longDate(order.created_at)} via {parent.name}
          {parent.child_first_name && `, forelder til ${parent.child_first_name}`}.
        </p>
      </header>

      <ClosingMessage campaign={campaign} />

      <Card className="space-y-2">
        {order.lines.map((l) => (
          <p key={l.name} className="flex justify-between">
            <span>
              {l.qty} × {l.name}
            </span>
            <span>{kr(l.qty * l.unit_price)}</span>
          </p>
        ))}
        <p className="flex justify-between border-t border-line pt-2 font-bold">
          <span>Totalt</span>
          <span>{kr(order.amount)}</span>
        </p>
      </Card>

      {order.status === 'registrert' && (
        <Card className="py-6">
          <VippsSimple amount={order.amount} name={parent.name} phoneNumber={parent.phone} code={order.code} />
        </Card>
      )}

      {campaign.raised !== null && <ProgressBar raised={campaign.raised} target={campaign.target_amount ?? 0} />}
      <Link to={`/k/${parent.link_code}`} className="block font-semibold text-brand">
        Til bestillingssiden →
      </Link>
      <hr className="border-line" />
      <Transparency campaign={campaign} />
    </Page>
  )
}
