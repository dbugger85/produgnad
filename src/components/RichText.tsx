import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react'

// Rich text for product descriptions, stored as a small markdown subset:
//   **fet**   *kursiv*   ***begge***   lines starting with "- " are a bullet list   blank line = new paragraph
// Friends' pages draw it as React elements (never as HTML), so nothing typed can run as code on their phones.
// Admins edit it in a what-you-see editor (RichTextEditor) that turns its content back into this format.

type Block = { kind: 'p'; lines: string[] } | { kind: 'ul'; items: string[] }

const BULLET = /^\s*[-•]\s+/
// Flat runs: the editor never nests markers, it writes each piece of text with its own (bold, italic)
const INLINE = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*/g

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

type Run = { text: string; bold: boolean; italic: boolean }

function runs(line: string): Run[] {
  const out: Run[] = []
  let at = 0
  for (const m of line.matchAll(INLINE)) {
    if (m.index > at) out.push({ text: line.slice(at, m.index), bold: false, italic: false })
    if (m[1] !== undefined) out.push({ text: m[1], bold: true, italic: true })
    else if (m[2] !== undefined) out.push({ text: m[2], bold: true, italic: false })
    else out.push({ text: m[3], bold: false, italic: true })
    at = m.index + m[0].length
  }
  if (at < line.length) out.push({ text: line.slice(at), bold: false, italic: false })
  return out
}

function inline(line: string): ReactNode[] {
  return runs(line).map((r, i) => {
    let node: ReactNode = r.text
    if (r.italic) node = <em>{node}</em>
    if (r.bold) node = <strong className="font-semibold text-ink">{node}</strong>
    return <Fragment key={i}>{node}</Fragment>
  })
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

// ---- Editor ---------------------------------------------------------------------------------

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function inlineHtml(line: string): string {
  return runs(line)
    .map((r) => {
      let h = escape(r.text)
      if (r.italic) h = `<i>${h}</i>`
      if (r.bold) h = `<b>${h}</b>`
      return h
    })
    .join('')
}

/** Stored text -> the editor's starting content (all text escaped) */
function toHtml(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let html = ''
  let inList = false
  for (const line of lines) {
    const bullet = BULLET.test(line)
    if (bullet && !inList) html += '<ul>'
    if (!bullet && inList) html += '</ul>'
    inList = bullet
    html += bullet ? `<li>${inlineHtml(line.replace(BULLET, '')) || '<br>'}</li>` : `<div>${inlineHtml(line) || '<br>'}</div>`
  }
  return inList ? html + '</ul>' : html
}

function runsToText(list: Run[]): string {
  const merged: Run[] = []
  for (const r of list) {
    const last = merged[merged.length - 1]
    if (last && last.bold === r.bold && last.italic === r.italic) last.text += r.text
    else merged.push({ ...r })
  }
  return merged
    .map(({ text, bold, italic }) => {
      const marker = bold && italic ? '***' : bold ? '**' : italic ? '*' : ''
      if (!marker || !text.trim()) return text
      // Spaces go outside the markers: "**fet** tekst", not "**fet **tekst"
      const [, lead, core, trail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/)!
      return `${lead}${marker}${core}${marker}${trail}`
    })
    .join('')
}

/** The editor's content -> stored text */
function fromDom(root: HTMLElement): string {
  const lines: string[] = []
  let current: Run[] | null = null
  let prefix = ''

  const flush = () => {
    if (current) lines.push(prefix + runsToText(current))
    current = null
  }

  function walk(node: Node, bold: boolean, italic: boolean) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Typed asterisks would read as formatting; the look-alike ∗ keeps them visible
      const text = (node.textContent ?? '').replace(/ /g, ' ').replace(/\*/g, '∗')
      if (text) (current ??= []).push({ text, bold, italic })
      return
    }
    if (!(node instanceof HTMLElement)) return
    const tag = node.tagName
    const weight = node.style.fontWeight
    const b = bold || tag === 'B' || tag === 'STRONG' || weight === 'bold' || Number(weight) >= 600
    const i = italic || tag === 'I' || tag === 'EM' || node.style.fontStyle === 'italic'
    if (tag === 'BR') {
      if (!current) current = []
      flush()
    } else if (tag === 'UL' || tag === 'OL') {
      flush()
      for (const li of Array.from(node.childNodes)) {
        prefix = '- '
        walk(li, b, i)
        if (!current && li.textContent?.trim() === '') current = []
        flush()
        prefix = ''
      }
    } else if (tag === 'DIV' || tag === 'P' || tag === 'LI') {
      flush()
      node.childNodes.forEach((c) => walk(c, b, i))
      flush()
    } else {
      node.childNodes.forEach((c) => walk(c, b, i))
    }
  }

  root.childNodes.forEach((c) => walk(c, false, false))
  flush()
  return lines
    .map((l) => (l.trim() === '-' ? '' : l.replace(/\s+$/, '')))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** What-you-see editor: Fet, Kursiv and Punktliste switch on and off like in a word processor */
export function RichTextEditor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState({ bold: false, italic: false, list: false })

  // Filled once; after that the editor owns its content and reports changes as text
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = toHtml(value)
    document.execCommand('defaultParagraphSeparator', false, 'div')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const update = () => {
      const el = ref.current
      if (!el || !el.contains(document.getSelection()?.anchorNode ?? null)) return
      setActive({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        list: document.queryCommandState('insertUnorderedList'),
      })
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [])

  function changed() {
    if (ref.current) onChange(fromDom(ref.current))
  }

  function command(name: 'bold' | 'italic' | 'insertUnorderedList') {
    ref.current?.focus()
    document.execCommand(name)
    changed()
    setActive({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      list: document.queryCommandState('insertUnorderedList'),
    })
  }

  const tool = (on: boolean) =>
    `min-h-9 rounded-lg px-3 text-sm ring-1 ${on ? 'bg-brand text-white ring-brand' : 'bg-cream text-ink ring-line'}`

  return (
    <div className="space-y-1">
      <span id={id} className="block text-sm font-semibold text-ink">
        {label}
      </span>
      <div className="flex gap-1.5 pb-1" role="toolbar" aria-label="Formatering">
        {/* onMouseDown keeps the text selected while the button is pressed */}
        <button type="button" aria-pressed={active.bold} className={`${tool(active.bold)} font-bold`} onMouseDown={(e) => e.preventDefault()} onClick={() => command('bold')}>
          Fet
        </button>
        <button type="button" aria-pressed={active.italic} className={`${tool(active.italic)} italic`} onMouseDown={(e) => e.preventDefault()} onClick={() => command('italic')}>
          Kursiv
        </button>
        <button type="button" aria-pressed={active.list} className={tool(active.list)} onMouseDown={(e) => e.preventDefault()} onClick={() => command('insertUnorderedList')}>
          • Punktliste
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-labelledby={id}
        onInput={changed}
        onPaste={(e) => {
          // Pasted text comes in plain, without the source's fonts and colours
          e.preventDefault()
          document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
        }}
        className="min-h-24 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 [&_b]:font-semibold [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
      />
    </div>
  )
}
