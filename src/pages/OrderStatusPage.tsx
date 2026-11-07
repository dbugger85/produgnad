import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ClosingMessage, Transparency } from '../components/Transparency'
import { Card, ErrorBox, Loading, Logo, Page } from '../components/ui'
import { VippsBox } from '../components/VippsBox'
import { kr, longDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import { STATUS_LABEL, type FriendStatus, type StatusPage } from '../lib/types'

const STEPS: FriendStatus[] = ['registrert', 'betalt', 'på vei', 'levert']
const STEP_LABEL: Record<string, string> = {
  registrert: 'Registrert',
  betalt: 'Betalt',
  'på vei': 'På vei',
  levert: 'Levert',
}

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
  const stepIndex = STEPS.indexOf(order.status)

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

      {order.status !== 'avbestilt' && (
        <ol className="grid grid-cols-4 gap-1 text-center text-xs">
          {STEPS.map((s, i) => (
            <li key={s} className="space-y-1">
              <div className={`h-2 rounded-full ${i <= stepIndex ? 'bg-brand' : 'bg-line'}`} />
              <span className={i <= stepIndex ? 'font-semibold text-brand-dark' : 'text-muted'}>{STEP_LABEL[s]}</span>
            </li>
          ))}
        </ol>
      )}

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
        <VippsBox amount={order.amount} name={parent.name} phoneNumber={parent.phone} code={order.code} />
      )}

      <Link to={`/k/${parent.link_code}`} className="block font-semibold text-brand">
        Til bestillingssiden →
      </Link>
      <hr className="border-line" />
      <Transparency campaign={campaign} />
    </Page>
  )
}
