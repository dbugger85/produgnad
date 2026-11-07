import { useEffect, useState } from 'react'
import { copyText, shareText } from '../lib/share'
import { Button, TextArea } from './ui'

/** Editable text with "Del" (phone share menu) and "Kopier". */
export function ShareBox({ text, rows = 4 }: { text: string; rows?: number }) {
  const [value, setValue] = useState(text)
  const [copied, setCopied] = useState(false)
  useEffect(() => setValue(text), [text])
  const canShare = typeof navigator.share === 'function'

  async function copy() {
    if (await copyText(value)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="space-y-2">
      <TextArea value={value} rows={rows} onChange={(e) => setValue(e.target.value)} className="text-sm" />
      <div className="flex gap-2">
        {canShare && (
          <Button
            onClick={async () => {
              if (!(await shareText(value))) await copy()
            }}
          >
            Del
          </Button>
        )}
        <Button variant="secondary" onClick={() => void copy()}>
          {copied ? 'Kopiert ✓' : 'Kopier'}
        </Button>
      </div>
    </div>
  )
}
