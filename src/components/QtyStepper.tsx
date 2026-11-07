export function QtyStepper({
  value,
  onChange,
  max,
  label,
}: {
  value: number
  onChange: (next: number) => void
  max: number
  label: string
}) {
  return (
    <div className="flex items-center gap-1" aria-label={`Antall ${label}`}>
      <button
        type="button"
        className="h-11 w-11 rounded-full bg-cream text-2xl font-bold text-ink disabled:opacity-40"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        aria-label={`Færre ${label}`}
      >
        −
      </button>
      <span className="w-8 text-center text-lg font-bold tabular-nums">{value}</span>
      <button
        type="button"
        className="h-11 w-11 rounded-full bg-brand text-2xl font-bold text-white disabled:opacity-40"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Flere ${label}`}
      >
        +
      </button>
    </div>
  )
}
