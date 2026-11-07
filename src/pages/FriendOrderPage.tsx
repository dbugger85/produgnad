import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { VippsSimple } from '../components/VippsSimple'
import { ProgressBar } from '../components/ProgressBar'
import { ProductPicker, quantitiesToLines, quantitiesTotal, type Quantities } from '../components/ProductPicker'
import { ClosingMessage, Transparency } from '../components/Transparency'
import { Button, Card, ErrorBox, Field, Input, Loading, Logo, Notice, Page, Title } from '../components/ui'
import { errorText } from '../lib/errors'
import { kr, longDate } from '../lib/format'
import { newId } from '../lib/id'
import { ordersForLink, rememberOrder, type LocalOrder } from '../lib/localOrders'
import { supabase } from '../lib/supabase'
import { STATUS_LABEL, type FriendStatus, type LinkPage, type PublicParent } from '../lib/types'

interface Placed {
  code: string
  status_token: string
  amount: number
  parent: PublicParent
}

export function statusUrl(token: string) {
  return `${window.location.origin}/status/${token}`
}

export default function FriendOrderPage() {
  const { code = '' } = useParams()
  const [page, setPage] = useState<LinkPage | null | undefined>(undefined)
  const [loadError, setLoadError] = useState('')
  const [quantities, setQuantities] = useState<Quantities>({})
  const [firstName, setFirstName] = useState('')
  const [wantsEmail, setWantsEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [clientToken, setClientToken] = useState(newId)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [placed, setPlaced] = useState<Placed | null>(null)

  useEffect(() => {
    supabase.rpc('public_campaign_by_link', { p_link_code: code }).then(({ data, error }) => {
      if (error) setLoadError(errorText(error))
      setPage((data as LinkPage | null) ?? null)
    })
  }, [code])

  const total = useMemo(() => (page ? quantitiesTotal(page.products, quantities) : 0), [page, quantities])

  if (loadError) return <Page><ErrorBox>{loadError}</ErrorBox></Page>
  if (page === undefined) return <Loading />
  if (page === null)
    return (
      <Page>
        <ErrorBox>Fant ikke denne lenken. Sjekk at du har hele lenken.</ErrorBox>
      </Page>
    )

  const { campaign, parent, products } = page
  const childText = parent.child_first_name ? `, forelder til ${parent.child_first_name}` : ''

  async function submit() {
    setError('')
    if (!firstName.trim()) return setError('Skriv inn fornavnet ditt.')
    if (total <= 0) return setError('Velg minst én vare.')
    setSending(true)
    const { data, error } = await supabase.rpc('create_friend_order', {
      p_link_code: code,
      p_first_name: firstName.trim(),
      p_lines: quantitiesToLines(quantities),
      p_email: wantsEmail ? email.trim() : null,
      p_wants_email: wantsEmail && email.trim() !== '',
      p_honeypot: honeypot,
      p_client_token: clientToken,
    })
    setSending(false)
    if (error) return setError(errorText(error))
    const result = data as Placed
    rememberOrder({
      link_code: code,
      code: result.code,
      status_token: result.status_token,
      amount: Number(result.amount),
      created_at: new Date().toISOString(),
    })
    // Ask the server to send the confirmation email now (fire and forget).
    if (wantsEmail && email.trim()) void supabase.functions.invoke('send-emails').catch(() => {})
    setPlaced(result)
    window.scrollTo({ top: 0 })
  }

  function orderMore() {
    setPlaced(null)
    setQuantities({})
    setClientToken(newId())
  }

  return (
    <Page>
      <header className="space-y-2">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <p className="text-sm font-semibold text-brand">{campaign.organizer_label}</p>
        </div>
        <Title>{campaign.name}</Title>
        {!placed && (
          <>
            <p className="text-ink">
              Du bestiller via <strong>{parent.name}</strong>
              {childText}.
            </p>
            {campaign.purpose_text && <p className="text-ink">{campaign.purpose_text}</p>}
            {campaign.raised !== null && <ProgressBar raised={campaign.raised} target={campaign.target_amount ?? 0} />}
          </>
        )}
      </header>

      <ClosingMessage campaign={campaign} />

      {placed ? (
        <Card className="space-y-5 py-6 text-center">
          <h2 className="font-display text-[34px] leading-none uppercase tracking-wide">Takk for støtten, {firstName.trim()}!</h2>
          <VippsSimple amount={placed.amount} name={placed.parent.name} phoneNumber={placed.parent.phone} code={placed.code} />
          <div className="flex justify-center gap-6 pt-1 text-sm">
            <Link to={`/status/${placed.status_token}`} className="font-semibold text-brand">
              Se bestillingen
            </Link>
            <button type="button" onClick={orderMore} className="font-semibold text-brand">
              Bestill mer
            </button>
          </div>
        </Card>
      ) : (
        <>
          <MyOrders linkCode={code} />
          {!campaign.accepting_orders ? (
            <Notice>
              {campaign.closed
                ? 'Dugnaden er avsluttet.'
                : campaign.locked
                  ? 'Bestillingen er stengt fordi varene er bestilt fra leverandøren.'
                  : 'Fristen for å bestille har gått ut.'}
            </Notice>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              {campaign.deadline && (
                <p className="text-sm text-muted">Bestill innen {longDate(campaign.deadline)}.</p>
              )}
              <ProductPicker
                products={products}
                quantities={quantities}
                onChange={setQuantities}
                maxQty={campaign.max_qty_per_line}
              />
              <Card className="space-y-4">
                <p className="flex items-baseline justify-between text-lg">
                  <span>Totalt</span>
                  <strong className="text-2xl">{kr(total)}</strong>
                </p>
                <Field label="Fornavnet ditt">
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    autoComplete="given-name"
                    maxLength={40}
                    required
                  />
                </Field>
                {/* Hidden field that only bots fill in */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  className="absolute -left-[9999px] h-0 w-0 opacity-0"
                  aria-hidden="true"
                />
                <ErrorBox>{error}</ErrorBox>
                <Button type="submit" className="w-full text-lg" disabled={sending}>
                  {sending ? 'Sender …' : 'Bestill'}
                </Button>
                <details open={wantsEmail} onToggle={(e) => setWantsEmail((e.target as HTMLDetailsElement).open)}>
                  <summary className="cursor-pointer text-sm text-brand">Vil du ha bekreftelse på e‑post?</summary>
                  <div className="pt-2">
                    <Field label="E‑post (valgfritt)">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        inputMode="email"
                      />
                    </Field>
                  </div>
                </details>
              </Card>
              <p className="text-xs text-muted">
                Personvern: {campaign.organizer_label} lagrer fornavnet ditt (og e‑post hvis du vil ha bekreftelse) bare
                for å levere varene og holde orden på betalingen. Opplysningene slettes etter dugnaden.
              </p>
            </form>
          )}
        </>
      )}

      <hr className="border-line" />
      <Transparency campaign={campaign} products={products} />
    </Page>
  )
}

/** Orders placed earlier on this device through the same link. */
function MyOrders({ linkCode }: { linkCode: string }) {
  const [rows, setRows] = useState<(LocalOrder & { status?: FriendStatus })[]>(() => ordersForLink(linkCode))

  useEffect(() => {
    const local = ordersForLink(linkCode)
    if (local.length === 0) return
    Promise.all(
      local.map(async (o) => {
        const { data } = await supabase.rpc('order_status_by_token', { p_token: o.status_token })
        return data ? { ...o, status: (data as { status: FriendStatus }).status } : null
      }),
    ).then((list) => setRows(list.filter((x): x is LocalOrder & { status: FriendStatus } => x !== null)))
  }, [linkCode])

  if (rows.length === 0) return null
  return (
    <Card className="space-y-2">
      {rows.map((o) => (
        <Link key={o.status_token} to={`/status/${o.status_token}`} className="flex justify-between gap-2">
          <span>
            Din bestilling <strong>{o.code}</strong>: {o.status ? STATUS_LABEL[o.status] : '…'}
          </span>
          <span className="text-brand">Se →</span>
        </Link>
      ))}
    </Card>
  )
}
