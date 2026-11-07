import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Button } from './ui'

/** QR code made in the browser, with a print button. */
export function QrCode({ value, caption }: { value: string; caption: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    QRCode.toString(value, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(setSvg)
  }, [value])

  function print() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!doctype html><meta charset="utf-8"><title>QR-kode</title>
      <body style="font-family:system-ui;text-align:center;padding:40px">
      <h1 style="font-size:28px">${caption.replace(/</g, '&lt;')}</h1>
      <div style="width:70%;max-width:500px;margin:24px auto">${svg}</div>
      <p style="font-size:18px">${value.replace(/</g, '&lt;')}</p>
      <script>setTimeout(()=>print(),300)</script></body>`)
    win.document.close()
  }

  return (
    <div className="space-y-2 text-center">
      <div className="mx-auto w-56" dangerouslySetInnerHTML={{ __html: svg }} />
      <Button variant="secondary" onClick={print}>
        Skriv ut
      </Button>
    </div>
  )
}
