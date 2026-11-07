import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { CopyButton } from '../../components/CopyButton'
import { ProgressBar } from '../../components/ProgressBar'
import { SharePreview } from '../../components/SharePreview'
import { ShareBox } from '../../components/ShareBox'
import { Badge, Button, Card, ErrorBox, Loading, Notice, Page, TopBar } from '../../components/ui'
import { VippsSimple } from '../../components/VippsSimple'
import { signOut, useAuth } from '../../lib/auth'
import { errorText } from '../../lib/errors'
import { daysUntil, kr, longDate, phone } from '../../lib/format'
import { useParentData } from '../../lib/parentData'
import { supabase } from '../../lib/supabase'
import { baseVars, fill, parentLink } from '../../lib/templates'
import { ORDER_TYPE_LABEL, orderAmount, orderUnits, type Order } from '../../lib/types'
import { QrCode } from '../../components/QrCode'
import { Transparency } from '../../components/Transparency'

type Filter = 'alle' | 'ubetalt' | 'ikke-levert'

// Same look as the copy button, so the four buttons under the link line up
const linkButton =
  'flex min-h-10 w-full items-center justify-center whitespace-nowrap rounded-xl bg-brand-soft px-1 text-sm font-semibold text-brand-dark'

export default function ParentPage() {
  const { cpId = '' } = useParams()
  const { data, error, reload } = useParentData(cpId)
  const { profile } = useAuth()
  const [filter, setFilter] = useState<Filter>('alle')
  const [shareKind, setShareKind] = useState<'short' | 'long'>('short')
  const [actionError, setActionError] = useState('')
  const [showQr, setShowQr] = useState(false)

  const vars = useMemo(() => {
    if (!data?.page) return null
    return baseVars(
      data.cp.campaigns,
      { ...data.cp.profiles, child_first_name: data.cp.child_first_name, link_code: data.cp.link_code },
      data.page.products,
    )
  }, [data])

  if (error) return <Page><ErrorBox>{error}</ErrorBox></Page>
  if (data === undefined) return <Loading />
  if (data === null || !vars)
    return (
      <Page>
        <ErrorBox>Fant ikke denne dugnaden for deg.</ErrorBox>
      </Page>
    )

  const { cp, orders, totals, payments, page } = data
  const campaign = cp.campaigns
  const open = !campaign.locked_at && !campaign.closed_at
  const owedLeft = Number(totals?.diff ?? 0)
  const link = parentLink(cp.link_code)
  const days = daysUntil(campaign.deadline)
  const showReminder = open && days !== null && days >= 0 && days <= 3

  const shown = orders.filter((o) => {
    if (filter === 'ubetalt') return o.type === 'friend' && !o.paid_to_parent_at
    if (filter === 'ikke-levert') return o.type === 'friend' && !o.delivered_at
    return true
  })

  async function act(fn: () => PromiseLike<{ error: unknown }>) {
    setActionError('')
    const { error } = await fn()
    if (error) setActionError(errorText(error))
    await reload()
  }

  return (
    <>
      <TopBar title={campaign.name} back={profile?.is_admin ? '/admin' : undefined} />
      <Page>
        {page && page.campaign.raised !== null && (
          <Card className="space-y-3">
            <p className="text-lg">
              <strong className="text-2xl">{kr(totals?.to_team)}</strong> til laget via deg
              <span className="block text-sm text-muted">av {kr(totals?.owed)} solgt</span>
            </p>
            <ProgressBar raised={page.campaign.raised} target={page.campaign.target_amount ?? 0} />
            <p className="-mt-1 text-xs text-muted">For hele dugnaden</p>
          </Card>
        )}
        {campaign.locked_at && !campaign.closed_at && (
          <Notice>Bestillingene er låst. Varene er bestilt fra leverandøren. Du kan fortsatt krysse av betalt og levert.</Notice>
        )}
        {campaign.closed_at && <Notice>Dugnaden er avsluttet.</Notice>}
        {cp.goods_sent_at && <Notice>Varene dine er sendt fra de ansvarlige ({longDate(cp.goods_sent_at)}).</Notice>}

        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Din bestillingslenke</h2>
          <p className="break-all rounded-lg bg-cream p-2 font-mono text-sm">{link}</p>
          <div className="grid grid-cols-4 gap-1.5">
            <CopyButton value={link} label="Kopier" className="w-full" />
            <Link to={`/k/${cp.link_code}`} className={linkButton}>
              Åpne
            </Link>
            <Link to={`/pakkeliste/${cp.id}`} className={linkButton}>
              Pakkeliste
            </Link>
            <button type="button" className={linkButton} onClick={() => setShowQr((v) => !v)} aria-expanded={showQr}>
              QR
            </button>
          </div>
          {showQr && <QrCode value={link} caption={`${campaign.name} – bestill via ${cp.profiles.name}`} />}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Del med venner og familie</h2>
          <div className="flex gap-2">
            <Button variant={shareKind === 'short' ? 'primary' : 'secondary'} onClick={() => setShareKind('short')}>
              Kort (SMS)
            </Button>
            <Button variant={shareKind === 'long' ? 'primary' : 'secondary'} onClick={() => setShareKind('long')}>
              Lang (Facebook)
            </Button>
          </div>
          <ShareBox text={fill(campaign, shareKind, vars)} rows={shareKind === 'short' ? 5 : 10} />
          {page && (
            <SharePreview
              link={link}
              input={{
                campaign: page.campaign,
                parent: { name: cp.profiles.name, child_first_name: cp.child_first_name },
                // The apps only see what everyone may see
                products: page.products.map((p) => ({
                  name: p.name,
                  to_team_amount: campaign.contribution_visibility === 'all' ? p.to_team_amount : null,
                  images: p.images,
                })),
              }}
            />
          )}
          {showReminder && (
            <div className="space-y-2 border-t border-line pt-3">
              <h3 className="font-semibold">Påminnelse om fristen</h3>
              <ShareBox text={fill(campaign, 'reminder', vars)} rows={4} />
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Oppgjør med de ansvarlige</h2>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt>Totalt bestilt via deg</dt>
            <dd className="text-right font-semibold">{kr(totals?.owed)}</dd>
            <dt>Betalt til admin</dt>
            <dd className="text-right font-semibold">{kr(totals?.paid)}</dd>
            <dt>Gjenstår</dt>
            <dd className="text-right text-base font-bold">{kr(owedLeft)}</dd>
            {Number(totals?.friend_unpaid ?? 0) > 0 && (
              <>
                <dt className="text-muted">Ubetalt fra venner</dt>
                <dd className="text-right text-muted">{kr(totals?.friend_unpaid)}</dd>
              </>
            )}
          </dl>
          {owedLeft > 0 && campaign.admin_vipps_phone && (
            <div className="rounded-2xl bg-cream/70 py-5 ring-1 ring-line">
              <VippsSimple
                amount={owedLeft}
                name={campaign.admin_vipps_name}
                phoneNumber={campaign.admin_vipps_phone}
                code={cp.payment_code}
              />
            </div>
          )}
          {owedLeft < 0 && <p className="text-sm">Du har betalt {kr(-owedLeft)} for mye. Ta kontakt med de ansvarlige.</p>}
          <p className="text-xs text-muted">
            Betal gjerne samlet når fristen er ute. Du kan betale i flere deler; skriv {cp.payment_code} i meldingen hver gang.
          </p>
          {payments.length > 0 && (
            <ul className="text-sm text-muted">
              {payments.map((p) => (
                <li key={p.id}>
                  {longDate(p.paid_on)}: {kr(p.amount)} registrert
                </li>
              ))}
            </ul>
          )}
        </Card>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Bestillinger ({orders.length})</h2>
            {open && (
              <Link to={`/forelder/${cp.id}/ny`}>
                <Button>+ Ny</Button>
              </Link>
            )}
          </div>
          <div className="flex gap-1 text-sm">
            {(['alle', 'ubetalt', 'ikke-levert'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 ${filter === f ? 'bg-ink text-white' : 'bg-line'}`}
              >
                {f === 'alle' ? 'Alle' : f === 'ubetalt' ? 'Ubetalt' : 'Ikke levert'}
              </button>
            ))}
          </div>
          <ErrorBox>{actionError}</ErrorBox>
          {shown.length === 0 && <p className="text-muted">Ingen bestillinger her ennå.</p>}
          {shown.map((o) => (
            <OrderRow
              key={o.id}
              order={o}
              cpId={cp.id}
              editable={open}
              canGive={!campaign.closed_at}
              productNames={Object.fromEntries((page?.products ?? []).map((p) => [p.id, p.name]))}
              reminder={fill(campaign, 'paymentReminder', {
                ...vars,
                kode: o.code,
                beløp: kr(orderAmount(o)),
              }).replace(/^Hei!/, `Hei ${o.buyer_first_name}!`)}
              onPaid={(paid) => act(() => supabase.rpc('set_order_paid', { p_order_id: o.id, p_paid: paid }))}
              onDelivered={(d) => act(() => supabase.rpc('set_order_delivered', { p_order_id: o.id, p_delivered: d }))}
            />
          ))}
        </section>

        <p className="text-sm text-muted">
          Venner ser navnet ditt og nummeret {phone(cp.profiles.phone)} når de bestiller. Svarer de på en e‑post fra
          appen, går svaret til e‑postadressen din. Betalingskoden din til admin er {cp.payment_code}.
        </p>
        {page && (
          <>
            <hr className="border-line" />
            <Transparency campaign={page.campaign} products={page.products} />
          </>
        )}
        <Button variant="ghost" onClick={() => void signOut()}>
          Logg ut
        </Button>
      </Page>
    </>
  )
}

function OrderRow({
  order,
  cpId,
  editable,
  canGive,
  productNames,
  reminder,
  onPaid,
  onDelivered,
}: {
  order: Order
  cpId: string
  editable: boolean
  canGive: boolean
  productNames: Record<string, string>
  reminder: string
  onPaid: (paid: boolean) => void
  onDelivered: (delivered: boolean) => void
}) {
  const [showReminder, setShowReminder] = useState(false)
  const isFriend = order.type === 'friend'
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-bold">
            {order.code} · {isFriend ? order.buyer_first_name : ORDER_TYPE_LABEL[order.type]}
          </div>
          <div className="text-sm text-muted">
            {order.order_lines.map((l) => `${l.qty} × ${productNames[l.product_id] ?? 'vare'}`).join(', ')}
          </div>
          {order.note && <div className="text-sm italic text-muted">{order.note}</div>}
        </div>
        <div className="text-right">
          <div className="whitespace-nowrap font-bold">{kr(orderAmount(order))}</div>
          <div className="text-xs text-muted">{orderUnits(order)} stk</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!isFriend && <Badge>{ORDER_TYPE_LABEL[order.type]}</Badge>}
        {order.created_by === 'friend' && <Badge tone="blue">via lenken</Badge>}
        {isFriend && (
          <label className="flex min-h-9 items-center gap-2 rounded-lg bg-cream px-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--color-brand)]"
              checked={!!order.paid_to_parent_at}
              onChange={(e) => onPaid(e.target.checked)}
            />
            Betalt
          </label>
        )}
        {isFriend && (
          <label className="flex min-h-9 items-center gap-2 rounded-lg bg-cream px-3">
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--color-brand)]"
              checked={!!order.delivered_at}
              onChange={(e) => onDelivered(e.target.checked)}
            />
            Levert
          </label>
        )}
        {isFriend && !order.paid_to_parent_at && (
          <button type="button" className="text-sm font-semibold text-brand" onClick={() => setShowReminder((v) => !v)}>
            Påminnelse
          </button>
        )}
        {order.type === 'extra' && canGive && (
          <Link to={`/forelder/${cpId}/fra-ekstra/${order.id}`} className="text-sm font-semibold text-brand">
            Gi til venn
          </Link>
        )}
        {editable && (
          <Link to={`/forelder/${cpId}/ordre/${order.id}`} className="ml-auto text-sm font-semibold text-brand">
            Endre
          </Link>
        )}
      </div>
      {showReminder && <ShareBox text={reminder} rows={3} />}
    </Card>
  )
}
