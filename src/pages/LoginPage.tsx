import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { LoginForm } from '../components/LoginForm'
import { Brand, Card, Page, Title } from '../components/ui'
import { useAuth } from '../lib/auth'

export function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export default function LoginPage() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('neste'))
  const { session } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (session) navigate(next, { replace: true })
  }, [session, next, navigate])

  return (
    <Page>
      <Brand />
      <Title className="pt-4">Logg inn</Title>
      <p className="text-ink">For foreldre og administratorer. Du får en kode på e‑post, ikke noe passord.</p>
      <Card>
        <LoginForm next={next} />
      </Card>
    </Page>
  )
}
