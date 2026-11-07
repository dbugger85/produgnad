import { kr, phone, phoneDigits } from '../lib/format'
import { CopyButton } from './CopyButton'

/** "Vipps 240 kr til Ola Hansen", the number with one copy button, and the message code. */
export function VippsSimple({ amount, name, phoneNumber, code }: { amount: number; name: string; phoneNumber: string; code: string }) {
  return (
    <div className="space-y-4 text-center">
      <p className="text-xl leading-snug">
        Vipps <strong>{kr(amount)}</strong> til <strong>{name}</strong>
      </p>
      <div className="flex items-center justify-center gap-3">
        <span className="text-2xl font-bold whitespace-nowrap tabular-nums">{phone(phoneNumber)}</span>
        <CopyButton value={phoneDigits(phoneNumber)} label="Kopier" />
      </div>
      <p className="text-lg">
        Skriv <strong>{code}</strong> i meldingen
      </p>
    </div>
  )
}
