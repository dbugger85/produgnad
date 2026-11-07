import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Badge, Button, Card, Loading, Page, TopBar } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { longDate } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Campaign } from '../../lib/types'

export default function AdminHome() {
  const { session } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)
  const [mine, setMine] = useState<{ id: string; child_first_name: string; campaigns: { name: string } | null }[]>([])
  useEffect(() => {
    if (!session) return
    supabase
      .from('campaign_parents')
      .select('id, child_first_name, campaigns(name)')
      .eq('parent_user_id', session.user.id)
      .then(({ data }) => setMine((data as unknown as typeof mine) ?? []))
  }, [session])
  useEffect(() => {
    supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setCampaigns((data as Campaign[]) ?? []))
  }, [])

  return (
    <>
      <TopBar title="Administrasjon" right={<Link to="/admin/folk" className="text-sm font-semibold text-brand">Innstillinger</Link>} />
      <Page>
        {mine.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Dugnader jeg er med på</h2>
            {mine.map((m) => (
              <Link key={m.id} to={`/forelder/${m.id}`} className="block">
                <Card className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-bold">{m.campaigns?.name}</div>
                    <div className="text-sm text-muted">Mine bestillinger{m.child_first_name && ` (${m.child_first_name})`}</div>
                  </div>
                  <span className="text-xl text-brand">→</span>
                </Card>
              </Link>
            ))}
          </section>
        )}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Dugnader jeg administrerer</h2>
            <Link to="/admin/ny" className="block w-fit">
              <Button className="min-h-10 shrink-0 whitespace-nowrap px-4 text-sm">+ Ny dugnad</Button>
            </Link>
          </div>
        {campaigns === null ? (
          <Loading />
        ) : campaigns.length === 0 ? (
          <p className="text-muted">Ingen dugnader ennå.</p>
        ) : (
          campaigns.map((c) => (
            <Link key={c.id} to={`/admin/d/${c.id}`} className="block">
              <Card className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{c.name}</span>
                  {c.closed_at ? <Badge>Avsluttet</Badge> : c.locked_at ? <Badge tone="amber">Låst</Badge> : <Badge tone="green">Åpen</Badge>}
                </div>
                <div className="text-sm text-muted">{c.deadline ? `Frist ${longDate(c.deadline)}` : 'Ingen frist'}</div>
              </Card>
            </Link>
          ))
        )}
        </section>
      </Page>
    </>
  )
}
