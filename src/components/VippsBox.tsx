import { kr, phone, phoneDigits, plainAmount } from '../lib/format'
import { CopyButton } from './CopyButton'

/** "Vipps 240 kr til Ola Hansen, 912 34 567, melding K7" with copy buttons. */
export function VippsBox({
  amount,
  name,
  phoneNumber,
  code,
}: {
  amount: number
  name: string
  phoneNumber: string
  code: string
}) {
  return (
    <div className="space-y-3 rounded-2xl bg-[#fff4ec] p-4 ring-1 ring-[#ffd9bf]">
      <p className="text-lg leading-snug">
        Vipps <strong>{kr(amount)}</strong> til <strong>{name}</strong>, <strong className="whitespace-nowrap">{phone(phoneNumber)}</strong>, melding{' '}
        <strong>{code}</strong>
      </p>
      <div className="grid grid-cols-[1fr_1.45fr_1fr] gap-2 text-center text-sm">
        <div className="space-y-1">
          <div className="text-muted">Beløp</div>
          <CopyButton value={plainAmount(amount)} label={plainAmount(amount)} className="w-full" />
        </div>
        <div className="space-y-1">
          <div className="text-muted">Nummer</div>
          <CopyButton value={phoneDigits(phoneNumber)} label={phone(phoneNumber)} className="w-full" />
        </div>
        <div className="space-y-1">
          <div className="text-muted">Melding</div>
          <CopyButton value={code} label={code} className="w-full" />
        </div>
      </div>
      <p className="text-xs text-muted">Trykk for å kopiere</p>
    </div>
  )
}
