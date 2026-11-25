import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { VippsSimple } from '../components/VippsSimple'
import { ProgressBar } from '../components/ProgressBar'
import { ProductPicker, quantitiesToLines, quantitiesTotal, type Quantities } from '../components/ProductPicker'
import { ClosingMessage, Transparency } from '../components/Transparency'
import { Button, Card, ErrorBox, Field, Input, Loading, Logo, Notice, Page, Title } from '../components/ui'
import { useAuth } from '../lib/auth'
import { errorText } from '../lib/errors'
import { kr, longDate } from '../lib/format'
import { newId } from '../lib/id'
import { ordersForLink, rememberOrder, type LocalOrder } from '../lib/localOrders'
import { publicClient, supabase } from '../lib/supabase'
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
  const [wantsReceipt, setWantsReceipt] = useState(false)
  const [receiptName, setReceiptName] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [clientToken, setClientToken] = useState(newId)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [placed, setPlaced] = useState<Placed | null>(null)

  // A logged-in parent opening their own link gets a bar with the way back
  const { session } = useAuth()
  const [ownCp, setOwnCp] = useState<string | null>(null)
  useEffect(() => {
    if (!session) return setOwnCp(null)
    supabase
      .from('campaign_parents')
      .select('id')
      .eq('link_code', code.toUpperCase())
      .eq('parent_user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setOwnCp(data?.id ?? null))
  }, [session, code])

  useEffect(() => {
    publicClient.rpc('public_campaign_by_link', { p_link_code: code }).then(({ data, error }) => {
      if (error) setLoadError(errorText(error))
      setPage((data as LinkPage | null) ?? null)
    })
  }, [code])

  // Someone else bought the last ones meanwhile: fresh stock, and no more in the basket than is left
  async function refreshStock() {
    const { data } = await publicClient.rpc('public_campaign_by_link', { p_link_code: code })
    const fresh = data as LinkPage | null
    if (!fresh) return
    setPage(fresh)
    setQuantities((q) =>
      Object.fromEntries(
        Object.entries(q).map(([id, n]) => {
          const left = fresh.products.find((p) => p.id === id)?.remaining
          return [id, left === null || left === undefined ? n : Math.min(n, left)]
        }),
      ),
    )
  }

  const total = useMemo(() => (page ? quantitiesTotal(page.products, quantities) : 0), [page, quantities])

  if (loadError) return <Page><ErrorBox>{loadError}</ErrorBox></Page>
  if (page === undefined) return <Loading />
  if (page === null)
    return (
      <Page>
        <ErrorBox>Fant ikke denne lenken. Sjekk at du har hele lenken</ErrorBox>
      </Page>
    )

  const { campaign, parent, products } = page
  const childText = parent.child_first_name ? `, forelder til ${parent.child_first_name}` : ''

  async function submit() {
    setError('')
    if (!firstName.trim()) return setError('Skriv inn fornavnet ditt')
    if (total <= 0) return setError('Velg minst én vare')
    if (wantsReceipt && !receiptName.trim()) return setError('Skriv inn navnet som skal stå på kvitteringen')
    if (wantsReceipt && !email.trim()) return setError('Skriv inn e‑posten kvitteringen skal sendes til')
    // A receipt also gives the order confirmation by email
    const sendEmail = (wantsEmail || wantsReceipt) && email.trim() !== ''
    setSending(true)
    const { data, error } = await publicClient.rpc('create_friend_order', {
      p_link_code: code,
      p_first_name: firstName.trim(),
      p_lines: quantitiesToLines(quantities),
      p_email: sendEmail ? email.trim() : null,
      p_wants_email: sendEmail,
      p_honeypot: honeypot,
      p_client_token: clientToken,
      p_receipt_name: wantsReceipt ? receiptName.trim() : '',
      p_wants_receipt: wantsReceipt,
    })
    setSending(false)
    if (error) {
      if (error.message.includes('OUT_OF_STOCK')) void refreshStock()
      return setError(errorText(error))
    }
    const result = data as Placed
    rememberOrder({
      link_code: code,
      code: result.code,
      status_token: result.status_token,
      amount: Number(result.amount),
      created_at: new Date().toISOString(),
    })
    // Ask the server to send the confirmation email now (fire and forget).
    if (sendEmail) void supabase.functions.invoke('send-emails').catch(() => {})
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
      {ownCp && (
        <div className="-mt-1 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand px-3 py-2 text-sm text-white">
          <span>
            <strong>Dette er din bestillingsside</strong>, slik vennene dine ser den
          </span>
          <Link to={`/forelder/${ownCp}`} className="font-semibold whitespace-nowrap underline underline-offset-2">
            ← Tilbake til mine bestillinger
          </Link>
        </div>
      )}
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
              {childText}
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
          {wantsReceipt && (
            <p className="text-sm text-muted">
              Kvitteringen kommer som PDF på e‑post når {placed.parent.name.split(' ')[0]} har registrert betalingen
            </p>
          )}
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
                ? 'Dugnaden er avsluttet'
                : campaign.locked
                  ? 'Bestillingen er stengt fordi varene er bestilt fra leverandøren'
                  : 'Fristen for å bestille har gått ut'}
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
                <p className="text-sm text-muted">Bestill innen {longDate(campaign.deadline)}</p>
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
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[var(--color-brand)]"
                    checked={wantsReceipt}
                    onChange={(e) => setWantsReceipt(e.target.checked)}
                  />
                  Jeg trenger kvittering
                </label>
                {wantsReceipt && (
                  <div className="space-y-4 border-l-2 border-brand/20 pl-3">
                    <Field label="Navn på kvitteringen" hint="Organisasjon eller firma">
                      <Input
                        value={receiptName}
                        onChange={(e) => setReceiptName(e.target.value)}
                        autoComplete="organization"
                        maxLength={80}
                        required
                      />
                    </Field>
                    <Field label="E‑post" hint="Kvitteringen kommer som PDF på e‑post når betalingen er registrert">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        inputMode="email"
                        maxLength={200}
                        required
                      />
                    </Field>
                  </div>
                )}
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
                {!wantsReceipt && (
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
                )}
              </Card>
              <p className="text-xs text-muted">
                Personvern: {campaign.organizer_label} lagrer fornavnet ditt (og e‑post og navn på kvitteringen hvis du oppgir det) bare
                for å levere varene og holde orden på betalingen. Opplysningene slettes etter dugnaden
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
        const { data } = await publicClient.rpc('order_status_by_token', { p_token: o.status_token })
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
