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
  const [mine, setMine] = useState<{ id: string; campaigns: { name: string } | null }[]>([])
  useEffect(() => {
    if (!session) return
    supabase
      .from('campaign_parents')
      .select('id, campaigns(name)')
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
        {mine.map((m) => (
          <Link key={m.id} to={`/forelder/${m.id}`} className="block">
            <Card className="font-semibold text-brand">Mine bestillinger som selger: {m.campaigns?.name} →</Card>
          </Link>
        ))}
        <Link to="/admin/ny" className="block w-fit">
          <Button>+ Ny dugnad</Button>
        </Link>
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
      </Page>
    </>
  )
}
