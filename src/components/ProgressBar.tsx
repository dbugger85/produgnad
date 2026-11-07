import { kr } from '../lib/format'

export function ProgressBar({ raised, target }: { raised: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((Number(raised) / Number(target)) * 100)) : 0
  return (
    <div className="space-y-1">
      <div
        className="h-2.5 overflow-hidden rounded-full bg-line/80"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-ink">
        <strong>{kr(raised)}</strong> til laget{target > 0 ? <> av {kr(target)}</> : null}
      </p>
    </div>
  )
}
