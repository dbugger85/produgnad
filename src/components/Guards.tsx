import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../lib/auth'
import { ErrorBox, Loading, Page } from './ui'

export function RequireLogin({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!session) return <Navigate to={`/logg-inn?neste=${encodeURIComponent(location.pathname)}`} replace />
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading || (session && !profile)) return <Loading />
  if (!session) return <Navigate to={`/logg-inn?neste=${encodeURIComponent(location.pathname)}`} replace />
  if (!profile?.is_admin)
    return (
      <Page>
        <ErrorBox>Denne siden er bare for administratorer.</ErrorBox>
      </Page>
    )
  return <>{children}</>
}
