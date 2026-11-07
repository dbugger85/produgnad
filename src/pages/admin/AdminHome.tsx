import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Badge, Button, Card, Loading, Page, TopBar } from '../../components/ui'
import { longDate } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Campaign } from '../../lib/types'

export default function AdminHome() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)
  useEffect(() => {
    supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setCampaigns((data as Campaign[]) ?? []))
  }, [])

  return (
    <>
      <TopBar title="Admin" back="/" right={<Link to="/admin/folk" className="text-sm font-semibold text-brand">Admins og profil</Link>} />
      <Page>
        <Link to="/admin/ny">
          <Button>+ Ny dugnad</Button>
        </Link>
        {campaigns === null ? (
          <Loading />
        ) : campaigns.length === 0 ? (
          <p className="text-stone-600">Ingen dugnader ennå.</p>
        ) : (
          campaigns.map((c) => (
            <Link key={c.id} to={`/admin/d/${c.id}`} className="block">
              <Card className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{c.name}</span>
                  {c.closed_at ? <Badge>Avsluttet</Badge> : c.locked_at ? <Badge tone="amber">Låst</Badge> : <Badge tone="green">Åpen</Badge>}
                </div>
                <div className="text-sm text-stone-600">{c.deadline ? `Frist ${longDate(c.deadline)}` : 'Ingen frist'}</div>
              </Card>
            </Link>
          ))
        )}
      </Page>
    </>
  )
}
