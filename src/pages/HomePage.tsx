import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { Brand, Button, Card, Loading, Page, Title } from '../components/ui'
import { signOut, useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

interface MyCampaign {
  id: string
  child_first_name: string
  campaigns: { name: string; closed_at: string | null } | null
}

export default function HomePage() {
  const { session, profile, loading } = useAuth()
  const [mine, setMine] = useState<MyCampaign[] | null>(null)

  useEffect(() => {
    if (!session) return
    supabase
      .from('campaign_parents')
      .select('id, child_first_name, campaigns(name, closed_at)')
      .eq('parent_user_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setMine((data as unknown as MyCampaign[]) ?? []))
  }, [session])

  if (loading || (session && mine === null)) return <Loading />

  if (!session) {
    return (
      <Page>
        <Brand />
        <p className="text-ink">
          Et enkelt verktøy for dugnader i barne- og ungdomsidrett. Har du fått en bestillingslenke fra en forelder,
          åpner du den lenken direkte.
        </p>
        <Link to="/logg-inn" className="block w-fit">
          <Button>Logg inn som forelder eller admin</Button>
        </Link>
      </Page>
    )
  }

  if (!profile?.is_admin && mine && mine.length === 1) return <Navigate to={`/forelder/${mine[0].id}`} replace />

  return (
    <Page>
      <Brand />
      <Title className="pt-2">Hei{profile?.name ? `, ${profile.name.split(' ')[0]}` : ''}!</Title>
      {profile?.is_admin && (
        <Link to="/admin" className="block">
          <Card className="font-semibold text-brand">Admin: dugnader, foreldre og betalinger →</Card>
        </Link>
      )}
      {mine && mine.length > 0 ? (
        mine.map((m) => (
          <Link key={m.id} to={`/forelder/${m.id}`} className="block">
            <Card>
              <div className="font-semibold">{m.campaigns?.name}</div>
              <div className="text-sm text-muted">
                Mine bestillinger{m.child_first_name && ` (${m.child_first_name})`} →
              </div>
            </Card>
          </Link>
        ))
      ) : (
        !profile?.is_admin && (
          <p className="text-ink">
            Du er ikke med i noen dugnad ennå. Be en av de ansvarlige om påmeldingslenken.
          </p>
        )
      )}
      <Button variant="ghost" onClick={() => void signOut()}>
        Logg ut
      </Button>
    </Page>
  )
}
