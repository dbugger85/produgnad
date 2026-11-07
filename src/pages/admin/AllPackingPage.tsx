import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { CheckRow, PackedProgress, UnitsTable, unitsByProduct, unitsText } from '../../components/PackingList'
import { Card, ErrorBox, Loading, Page, TopBar } from '../../components/ui'
import { useAdminData } from '../../lib/adminData'
import { errorText } from '../../lib/errors'
import { supabase } from '../../lib/supabase'

/** /admin/d/:id/pakkelister: one row per parent; tick when that parent's bag is packed. */
export default function AllPackingPage() {
  const { id = '' } = useParams()
  const { data, reload } = useAdminData(id)
  // Ticks shown at once, before the reload confirms them
  const [ticks, setTicks] = useState<Record<string, string | null>>({})
  const [error, setError] = useState('')
  if (data === undefined) return <Loading />
  if (data === null) return <Page><ErrorBox>Fant ikke dugnaden</ErrorBox></Page>

  const packedAt = (cpId: string, saved: string | null) => (cpId in ticks ? ticks[cpId] : saved)
  const rows = data.parents
    .map((p) => ({ parent: p, orders: data.orders.filter((o) => o.campaign_parent_id === p.id) }))
    .filter((r) => r.orders.length > 0)
    .sort((a, b) => a.parent.profiles.name.localeCompare(b.parent.profiles.name, 'nb'))
  const isPacked = (r: (typeof rows)[number]) => !!packedAt(r.parent.id, r.parent.packed_at)
  const done = rows.filter(isPacked).length
  const left = unitsByProduct(rows.filter((r) => !isPacked(r)).flatMap((r) => r.orders), data.products)

  async function toggle(cpId: string, saved: string | null) {
    const next = packedAt(cpId, saved) ? null : new Date().toISOString()
    setError('')
    setTicks((t) => ({ ...t, [cpId]: next }))
    const { error } = await supabase.from('campaign_parents').update({ packed_at: next }).eq('id', cpId)
    if (error) setError(errorText(error))
    await reload()
    setTicks(({ [cpId]: _, ...rest }) => rest)
  }

  return (
    <>
      <TopBar title="Pakkeliste" back={`/admin/d/${id}?fane=foreldre`} />
      <Page>
        {rows.length === 0 ? (
          <p className="text-muted">Ingen bestillinger ennå</p>
        ) : (
          <>
            <PackedProgress done={done} total={rows.length} noun="poser" />
            {left.length > 0 && (
              <Card className="space-y-2">
                <h3 className="font-semibold">Igjen å pakke ({left.reduce((a, r) => a + r.units, 0)} stk)</h3>
                <UnitsTable rows={left} />
              </Card>
            )}
            <p className="text-sm text-muted">
              Én pose per forelder. Trykk når posen er pakket. Se fordelingen per venn under hver forelder
            </p>
            <ErrorBox>{error}</ErrorBox>
            <div className="space-y-2">
              {rows.map((r) => {
                const p = r.parent
                const units = unitsByProduct(r.orders, data.products)
                const checked = isPacked(r)
                return (
                  <div key={p.id}>
                    <CheckRow
                      checked={checked}
                      onToggle={() => void toggle(p.id, p.packed_at)}
                      aside={<span className="font-semibold">{units.reduce((a, u) => a + u.units, 0)} stk</span>}
                    >
                      <span className={`block font-semibold ${checked ? 'line-through decoration-ink/30' : ''}`}>
                        {p.profiles.name}
                        {p.child_first_name && <span className="font-normal text-muted"> · {p.child_first_name}</span>}
                      </span>
                      <span className="block text-sm">{unitsText(units)}</span>
                      {p.goods_sent_at && <span className="block text-xs text-green-800">Sendt</span>}
                    </CheckRow>
                    <Link to={`/pakkeliste/${p.id}`} className="ml-12 inline-flex min-h-9 items-center text-sm font-semibold text-brand">
                      Fordeling per venn ({r.orders.length}) →
                    </Link>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </Page>
    </>
  )
}
