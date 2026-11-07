import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark disabled:bg-stone-300',
  secondary: 'bg-white text-stone-900 ring-1 ring-stone-300 hover:bg-stone-50 disabled:text-stone-400',
  ghost: 'text-brand hover:bg-brand-soft disabled:text-stone-400',
  danger: 'bg-white text-red-700 ring-1 ring-red-300 hover:bg-red-50',
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold transition disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200 ${className}`}>{children}</section>
}

export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <main className={`mx-auto w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} space-y-4 px-4 py-5`}>{children}</main>
}

export function TopBar({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  return (
    <header className="no-print sticky top-0 z-10 border-b border-stone-200 bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
        {back && (
          <Link to={back} className="-ml-2 rounded-lg px-2 py-1 text-xl text-brand" aria-label="Tilbake">
            ←
          </Link>
        )}
        <h1 className="flex-1 truncate text-lg font-bold">{title}</h1>
        {right}
      </div>
    </header>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold text-stone-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-stone-500">{hint}</span>}
    </label>
  )
}

const inputClass =
  'w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function Loading({ text = 'Laster …' }: { text?: string }) {
  return <p className="py-10 text-center text-stone-500">{text}</p>
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null
  return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">{children}</p>
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">{children}</p>
}

export function Badge({ children, tone = 'stone' }: { children: ReactNode; tone?: 'stone' | 'green' | 'amber' | 'blue' }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-700',
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-900',
    blue: 'bg-sky-100 text-sky-900',
  }
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}
