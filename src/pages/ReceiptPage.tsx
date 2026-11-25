import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ReceiptPdfButton } from '../components/ReceiptPdfButton'
import { Button, Card, ErrorBox, Loading, Logo, Page } from '../components/ui'
import { kr, longDate, phone } from '../lib/format'
import { publicClient } from '../lib/supabase'
import type { StatusPage } from '../lib/types'

/** Receipt (kvittering) for a paid friend order. Same content as the «paid» email and the PDF (_shared/receiptPdf.ts) */
export default function ReceiptPage() {
  const { token = '' } = useParams()
  const [order, setOrder] = useState<StatusPage | null | undefined>(undefined)

  useEffect(() => {
    if (!/^[0-9a-f-]{36}$/i.test(token)) {
      setOrder(null)
      return
    }
    publicClient.rpc('order_status_by_token', { p_token: token }).then(({ data }) => setOrder((data as StatusPage) ?? null))
  }, [token])

  if (order === undefined) return <Loading />
  if (order === null)
    return (
      <Page>
        <ErrorBox>Fant ikke bestillingen. Sjekk at du har hele lenken</ErrorBox>
      </Page>
    )
  if (!order.paid_at)
    return (
      <Page>
        <ErrorBox>Kvitteringen kommer når betalingen er registrert</ErrorBox>
        <Link to={`/status/${token}`} className="block font-semibold text-brand">
          Til bestillingen →
        </Link>
      </Page>
    )

  const { campaign, parent } = order
  const row = 'grid grid-cols-[5rem_1fr] gap-2 border-t border-line py-2'

  return (
    <Page>
      <Card className="space-y-4 print:shadow-none print:ring-0">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <p className="text-sm font-semibold text-brand">{campaign.organizer_label}</p>
        </div>
        <div>
          <h1 className="font-display text-[32px] leading-[1.05] tracking-wider uppercase">Kvittering</h1>
          <p className="text-muted">
            Bestilling {order.code} · {longDate(order.paid_at)}
          </p>
        </div>

        <div>
          <div className={row}>
            <span className="text-muted">Selger</span>
            <span>
              <strong>{parent.name}</strong>
              {parent.phone && <br />}
              {parent.phone && phone(parent.phone)}
              <br />
              Dugnad til inntekt for {campaign.team_name || campaign.organizer_label}
            </span>
          </div>
          <div className={row}>
            <span className="text-muted">Kjøper</span>
            {order.receipt_name ? (
              <span>
                <strong>{order.receipt_name}</strong>
                <br />
                Bestilt av {order.buyer_first_name}
              </span>
            ) : (
              <strong>{order.buyer_first_name}</strong>
            )}
          </div>
        </div>

        <div>
          {order.lines.map((l) => (
            <p key={l.name} className="flex justify-between gap-3 border-t border-line py-2">
              <span>
                {l.qty} × {l.name} <span className="whitespace-nowrap">à {kr(l.unit_price)}</span>
              </span>
              <span className="whitespace-nowrap">{kr(l.qty * l.unit_price)}</span>
            </p>
          ))}
          <p className="flex justify-between border-t border-line pt-2 font-bold">
            <span>Totalt</span>
            <span>{kr(order.amount)}</span>
          </p>
        </div>

        <div>
          <p>Betalt med Vipps {longDate(order.paid_at)}</p>
          <p className="text-muted">Ikke MVA-pliktig (privatsalg / dugnad)</p>
        </div>
        <p className="border-t border-line pt-3 text-sm text-muted">
          {campaign.name} er organisert av {campaign.organizer_label}, ikke av klubben direkte
          {campaign.purpose_text && <><br />{campaign.purpose_text}</>}
        </p>
      </Card>

      <div className="space-y-4 print:hidden">
        <ReceiptPdfButton token={token} code={order.code} />
        <Button variant="secondary" className="w-full" onClick={() => window.print()}>
          Skriv ut
        </Button>
        <Link to={`/status/${token}`} className="block font-semibold text-brand">
          Til bestillingen →
        </Link>
      </div>
    </Page>
  )
}
