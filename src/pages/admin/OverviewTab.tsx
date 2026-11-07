import { useState } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { ProgressBar } from '../../components/ProgressBar'
import { Button, Card, ErrorBox, Notice } from '../../components/ui'
import type { AdminData } from '../../lib/adminData'
import { errorText } from '../../lib/errors'
import { kr, longDate } from '../../lib/format'
import { supabase } from '../../lib/supabase'

export function OverviewTab({ data, reload }: { data: AdminData; reload: () => Promise<void> }) {
  const { campaign, progress, parents, orders, totals, products, supplier } = data
  const [error, setError] = useState('')
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
        <p className="break-all rounded-lg bg-stone-100 p-2 font-mono text-sm">{joinLink}</p>
        <CopyButton value={joinLink} label="Kopier lenke" />
        <p className="text-xs text-stone-500">Del denne i foreldregruppa. Alle med lenken kan melde seg på som selger</p>
      </Card>

      <Card className="space-y-2">
        <h2 className="text-lg font-bold">Til leverandøren</h2>
        {supplier.length === 0 ? (
          <p className="text-sm text-stone-500">Ingen bestillinger ennå.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {products.map((p) => {
                const units = supplier.find((s) => s.product_id === p.id)?.units ?? 0
                return (
                  <tr key={p.id} className="border-b border-stone-100">
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
            <p className="text-sm text-stone-600">Lås når varene er bestilt fra leverandøren.</p>
            <Button
              onClick={() =>
                void update(
                  { locked_at: new Date().toISOString() },
                  'Låse bestillingene? Foreldre og kunder kan ikke bestille eller endre etterpå.',
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
