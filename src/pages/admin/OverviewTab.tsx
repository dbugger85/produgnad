import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CopyButton } from '../../components/CopyButton'
import { ProgressBar } from '../../components/ProgressBar'
import { Button, Card, ErrorBox, Notice } from '../../components/ui'
import type { AdminData } from '../../lib/adminData'
import { useAuth } from '../../lib/auth'
import { errorText } from '../../lib/errors'
import { kr, longDate } from '../../lib/format'
import { supabase } from '../../lib/supabase'

export function OverviewTab({ data, reload }: { data: AdminData; reload: () => Promise<void> }) {
  const { campaign, progress, parents, orders, totals, products, supplier } = data
  const [error, setError] = useState('')
  const { session } = useAuth()
  // The admin's own seller row in this campaign, if they have joined
  const myCp = parents.find((p) => p.parent_user_id === session?.user.id)?.id
  const joinLink = `${window.location.origin}/bli-med/${campaign.join_code}`
  const owed = totals.reduce((s, t) => s + Number(t.owed), 0)
  const paid = totals.reduce((s, t) => s + Number(t.paid), 0)

  async function update(fields: Record<string, string | null>, question: string) {
    if (!confirm(question)) return
    setError('')
    const { error } = await supabase.from('campaigns').update(fields).eq('id', campaign.id)
    if (error) setError(errorText(error))
    await reload()
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <ProgressBar raised={Number(progress?.raised ?? 0)} target={Number(campaign.target_amount)} />
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt>Salg totalt</dt>
          <dd className="text-right font-semibold">{kr(progress?.sales)}</dd>
          <dt>Betalt fra foreldre</dt>
          <dd className="text-right font-semibold">
            {kr(paid)} av {kr(owed)}
          </dd>
          <dt>Foreldre</dt>
          <dd className="text-right">{parents.length}</dd>
          <dt>Bestillinger</dt>
          <dd className="text-right">{orders.length}</dd>
          <dt>Frist</dt>
          <dd className="text-right">{campaign.deadline ? longDate(campaign.deadline) : '–'}</dd>
        </dl>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-bold">Påmeldingslenke for foreldre</h2>
        <p className="break-all rounded-lg bg-cream p-2 font-mono text-sm">{joinLink}</p>
        <div className="flex flex-wrap items-center gap-3">
          <CopyButton value={joinLink} label="Kopier lenke" />
          {myCp ? (
            <Link to={`/forelder/${myCp}`} className="text-sm font-semibold text-brand">
              Du er med som selger: mine bestillinger →
            </Link>
          ) : (
            <Link to={`/bli-med/${campaign.join_code}`} className="text-sm font-semibold text-brand">
              Bli med som selger selv →
            </Link>
          )}
        </div>
        <p className="text-xs text-muted">Del denne i foreldregruppa. Alle med lenken kan melde seg på som selger</p>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-bold">Til leverandøren</h2>
        {supplier.length === 0 ? (
          <p className="text-sm text-muted">Ingen bestillinger ennå.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {products.map((p) => {
                const units = supplier.find((s) => s.product_id === p.id)?.units ?? 0
                return (
                  <tr key={p.id} className="border-b border-line">
                    <td className="py-1">{p.name}</td>
                    <td className="py-1 text-right font-semibold tabular-nums">{units} stk</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">Status</h2>
        <ErrorBox>{error}</ErrorBox>
        {campaign.closed_at ? (
          <>
            <Notice>Avsluttet {longDate(campaign.closed_at)}.</Notice>
            <Wrapup data={data} reload={reload} />
            <Button variant="secondary" onClick={() => void update({ closed_at: null }, 'Åpne dugnaden igjen?')}>
              Åpne igjen
            </Button>
          </>
        ) : campaign.locked_at ? (
          <>
            <Notice>Låst {longDate(campaign.locked_at)}. Foreldre kan ikke legge til eller endre bestillinger.</Notice>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void update({ locked_at: null }, 'Låse opp bestillingene igjen?')}>
                Lås opp
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  void update(
                    { closed_at: new Date().toISOString() },
                    'Avslutte dugnaden? Avslutningsmeldingen vises da på alle sider.',
                  )
                }
              >
                Avslutt dugnaden
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">Lås når varene er bestilt fra leverandøren.</p>
            <Button
              onClick={() =>
                void update(
                  { locked_at: new Date().toISOString() },
                  'Låse bestillingene? Foreldre og venner kan ikke bestille eller endre etterpå.',
                )
              }
            >
              Lås bestillingene
            </Button>
          </>
        )}
      </Card>
    </div>
  )
}

/** After closing: the closing message by email, and deleting the friends' personal data. */
function Wrapup({ data, reload }: { data: AdminData; reload: () => Promise<void> }) {
  const { campaign, parents } = data
  const [sent, setSent] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('email_outbox')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('kind', 'closing')
      .then(({ count }) => setSent(count ?? 0))
  }, [campaign.id, message])

  const withEmail = parents.filter((p) => p.profiles.email).length

  async function sendClosing() {
    if (!confirm(`Sende avslutningsmeldingen på e‑post til ${withEmail} foreldre?`)) return
    setError('')
    setBusy(true)
    const { data: n, error } = await supabase.rpc('queue_closing_emails', { p_campaign_id: campaign.id })
    if (error) {
      setBusy(false)
      return setError(errorText(error))
    }
    // Send right away (20 per call); anything left goes with the evening job
    for (let i = 0; i < 3; i++) await supabase.functions.invoke('send-emails').catch(() => {})
    setBusy(false)
    setMessage(n ? `Sendt til ${n} foreldre.` : 'Alle foreldrene har allerede fått avslutningsmeldingen.')
  }

  async function anonymize() {
    if (!confirm('Slette vennenes personopplysninger? Fornavn blir «Venn», og e‑postadresser og notater slettes. Beløp og betalinger beholdes. Dette kan ikke angres.')) return
    setError('')
    setBusy(true)
    const { error } = await supabase.rpc('anonymize_friends', { p_campaign_id: campaign.id })
    setBusy(false)
    if (error) return setError(errorText(error))
    await reload()
  }

  return (
    <div className="space-y-4 border-t border-line pt-3">
      <div className="space-y-2">
        <h3 className="font-semibold">Avslutningsmelding på e‑post</h3>
        {!campaign.closing_message.trim() ? (
          <p className="text-sm text-muted">Skriv en avslutningsmelding under Oppsett først</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Foreldrene får meldingen din, hvor mye dugnaden samlet inn til laget, og hvor mye som kom via dem
            </p>
            {sent !== null && sent > 0 && <p className="text-sm">Sendt til {sent} foreldre.</p>}
            <Button onClick={() => void sendClosing()} disabled={busy || withEmail === 0}>
              {sent ? 'Send til foreldre som ikke har fått den' : `Send til ${withEmail} foreldre`}
            </Button>
          </>
        )}
        {message && <p className="text-sm text-green-800">{message}</p>}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Vennenes personopplysninger</h3>
        {campaign.anonymized_at ? (
          <p className="text-sm">Slettet {longDate(campaign.anonymized_at)}. Beløp og betalinger er beholdt.</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Slett fornavn, e‑postadresser og notater fra vennene når varene er levert og alt er betalt, slik personvernteksten lover
            </p>
            <Button variant="danger" onClick={() => void anonymize()} disabled={busy}>
              Slett vennenes personopplysninger
            </Button>
          </>
        )}
      </div>
      <ErrorBox>{error}</ErrorBox>
    </div>
  )
}
