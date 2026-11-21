import { Fragment, useId, useRef, type ReactNode } from 'react'
import { TextArea } from './ui'

// Rich text for product descriptions, stored as a small markdown subset:
//   **fet**   *kursiv*   lines starting with "- " are a bullet list   blank line = new paragraph
// Rendered to React elements (never as HTML), so nothing typed can run as code on friends' phones.

type Block = { kind: 'p'; lines: string[] } | { kind: 'ul'; items: string[] }

const BULLET = /^\s*[-•*]\s+/

function blocks(text: string): Block[] {
  const out: Block[] = []
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const last = out[out.length - 1]
    if (!raw.trim()) {
      out.push({ kind: 'p', lines: [] }) // paragraph break
    } else if (BULLET.test(raw)) {
      const item = raw.replace(BULLET, '')
      if (last?.kind === 'ul') last.items.push(item)
      else out.push({ kind: 'ul', items: [item] })
    } else if (last?.kind === 'p' && last.lines.length) {
      last.lines.push(raw)
    } else {
      out.push({ kind: 'p', lines: [raw] })
    }
  }
  return out.filter((b) => (b.kind === 'p' ? b.lines.length : b.items.length))
}

/** **bold** and *italic* inside one line */
function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g
  let at = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > at) parts.push(text.slice(at, m.index))
    parts.push(m[1] !== undefined ? <strong key={m.index} className="font-semibold text-ink">{inline(m[1])}</strong> : <em key={m.index}>{m[2]}</em>)
    at = m.index + m[0].length
  }
  if (at < text.length) parts.push(text.slice(at))
  return parts
}

export function RichText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {blocks(text).map((b, i) =>
        b.kind === 'ul' ? (
          <ul key={i} className="list-disc space-y-0.5 pl-5">
            {b.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {b.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(line)}
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  )
}

/** Text box with Fet / Kursiv / Punktliste buttons and a preview of what friends see */
export function RichTextEditor({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  rows?: number
}) {
  const id = useId()
  const ref = useRef<HTMLTextAreaElement>(null)

  function restore(start: number, end: number) {
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(start, end)
    })
  }

  function wrap(marker: string, placeholder: string) {
    const el = ref.current
    if (!el) return
    const { selectionStart: s, selectionEnd: e } = el
    const picked = value.slice(s, e) || placeholder
    onChange(value.slice(0, s) + marker + picked + marker + value.slice(e))
    restore(s + marker.length, s + marker.length + picked.length)
  }

  function bullets() {
    const el = ref.current
    if (!el) return
    const s = value.lastIndexOf('\n', el.selectionStart - 1) + 1
    const nextBreak = value.indexOf('\n', Math.max(el.selectionEnd, el.selectionStart))
    const e = nextBreak === -1 ? value.length : nextBreak
    const lines = value.slice(s, e).split('\n')
    const allBullets = lines.every((l) => BULLET.test(l))
    const changed = lines.map((l) => (allBullets ? l.replace(BULLET, '') : `- ${l}`)).join('\n')
    onChange(value.slice(0, s) + changed + value.slice(e))
    restore(s + changed.length, s + changed.length)
  }

  const tool = 'min-h-9 rounded-lg bg-cream px-3 text-sm text-ink ring-1 ring-line'

  return (
    <div className="space-y-1">
      {/* Not a <label> around everything: a click on the label would press the first button */}
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="flex gap-1.5 pb-1" role="toolbar" aria-label="Formatering">
        <button type="button" className={`${tool} font-bold`} onClick={() => wrap('**', 'fet tekst')}>
          Fet
        </button>
        <button type="button" className={`${tool} italic`} onClick={() => wrap('*', 'kursiv tekst')}>
          Kursiv
        </button>
        <button type="button" className={tool} onClick={bullets}>
          • Punktliste
        </button>
      </div>
      <TextArea id={id} ref={ref} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      {/[*\n]|^\s*[-•]/.test(value) && (
        <div className="mt-2 rounded-xl bg-cream px-3 py-2 ring-1 ring-line">
          <p className="mb-1 text-xs font-semibold text-muted">Slik ser vennene det</p>
          <RichText text={value} className="text-sm text-muted" />
        </div>
      )}
    </div>
  )
}
