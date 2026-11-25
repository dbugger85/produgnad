import { useState } from 'react'
import { publicClient } from '../lib/supabase'
import { Button, ErrorBox } from './ui'

/** Downloads the receipt PDF (Edge Function receipt-pdf, the same file as in the «paid» email) */
export function ReceiptPdfButton({ token, code, variant = 'primary' }: { token: string; code: string; variant?: 'primary' | 'secondary' }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function download() {
    setBusy(true)
    setError('')
    const { data, error } = await publicClient.functions.invoke(`receipt-pdf?token=${encodeURIComponent(token)}`, { method: 'GET' })
    setBusy(false)
    if (error || !(data instanceof Blob)) return setError('Kunne ikke lage kvitteringen. Prøv igjen litt senere')
    const href = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
    const a = document.createElement('a')
    a.href = href
    a.download = `kvittering-${code.replace(/[^\w-]/g, '')}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 60_000)
  }

  return (
    <div className="space-y-2">
      <Button variant={variant} className="w-full" onClick={() => void download()} disabled={busy}>
        {busy ? 'Lager PDF …' : 'Last ned kvittering (PDF)'}
      </Button>
      <ErrorBox>{error}</ErrorBox>
    </div>
  )
}
