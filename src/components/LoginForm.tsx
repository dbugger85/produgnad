import { useState } from 'react'
import { errorText } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { Button, ErrorBox, Field, Input } from './ui'

/**
 * Email login without password. The email has only a code (8 digits live, 6 locally), no link:
 * email security filters open links to check them, which used the code up. The code also works
 * when the page is open in another app's browser (e.g. inside Messenger).
 */
export function LoginForm({ next, onDone }: { next: string; onDone?: () => void }) {
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get('e') ?? '')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}${next}`, shouldCreateUser: true },
    })
    setBusy(false)
    if (error) {
      setError(
        /rate|seconds/i.test(error.message)
          ? 'Vent litt før du ber om en ny kode'
          : /sending|smtp|email/i.test(error.message)
            ? 'Klarte ikke å sende e‑posten akkurat nå. Prøv igjen om litt, eller kontakt de ansvarlige'
            : errorText(error),
      )
      return
    }
    setSent(true)
  }

  async function verify() {
    setError('')
    setBusy(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.replace(/\s/g, ''),
      type: 'email',
    })
    setBusy(false)
    if (error) {
      setError('Koden stemmer ikke, eller den er for gammel. Prøv igjen eller be om en ny')
      return
    }
    onDone?.()
  }

  if (!sent) {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <Field label="E‑post">
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <ErrorBox>{error}</ErrorBox>
        <Button type="submit" className="w-full" disabled={busy || !email.includes('@')}>
          {busy ? 'Sender …' : 'Send meg en innloggingskode'}
        </Button>
      </form>
    )
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void verify()
      }}
    >
      <p className="text-sm text-ink">
        Vi har sendt en e‑post til <strong>{email}</strong>. Skriv inn koden fra e‑posten her
      </p>
      <Field label="Kode fra e‑posten">
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="text-center text-2xl tracking-[0.4em]"
          autoFocus
        />
      </Field>
      <ErrorBox>{error}</ErrorBox>
      <Button type="submit" className="w-full" disabled={busy || code.replace(/\D/g, '').length < 6}>
        {busy ? 'Sjekker …' : 'Logg inn'}
      </Button>
      <button type="button" className="text-sm text-brand underline" onClick={() => setSent(false)}>
        Feil e‑post, eller ingen e‑post? Prøv igjen
      </button>
    </form>
  )
}
