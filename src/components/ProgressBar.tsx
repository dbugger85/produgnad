import { kr } from '../lib/format'

/** Money to the team. With a target: a bar towards it. Without one: just the amount (an empty bar says nothing). */
export function ProgressBar({ raised, target }: { raised: number; target: number }) {
  const hasTarget = Number(target) > 0
  if (!hasTarget) {
    return (
      <p className="text-ink">
        <strong className="text-2xl">{kr(raised)}</strong> til laget
      </p>
    )
  }
  const pct = Math.min(100, Math.round((Number(raised) / Number(target)) * 100))
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
        <strong>{kr(raised)}</strong> til laget av {kr(target)}
      </p>
    </div>
  )
}
