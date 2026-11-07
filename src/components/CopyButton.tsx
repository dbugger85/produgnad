import { useState } from 'react'
import { copyText } from '../lib/share'

export function CopyButton({ value, label = 'Kopier', className = '' }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(value)) {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        }
      }}
      className={`inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl bg-brand-soft px-2 py-1 text-sm font-semibold text-brand-dark ${className}`}
    >
      {done ? 'Kopiert ✓' : label}
    </button>
  )
}
