import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-[0_4px_14px_rgb(0_46_95/0.28)] hover:bg-brand-dark disabled:bg-line disabled:text-muted disabled:shadow-none',
  secondary: 'bg-white text-ink ring-1 ring-line shadow-sm hover:bg-cream disabled:text-muted/70',
  ghost: 'text-brand hover:bg-brand-soft disabled:text-muted/70',
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
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 py-2 font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[20px] bg-white/85 p-4 shadow-card ring-1 ring-line/80 ${className}`}>{children}</section>
  )
}

export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <main className={`mx-auto w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} space-y-4 px-4 py-5`}>{children}</main>
}

export function TopBar({ title, back, right, wide = false }: { title: string; back?: string; right?: ReactNode; wide?: boolean }) {
  return (
    <header className="no-print sticky top-0 z-10 border-b border-line/70 bg-cream/90">
      <div className={`mx-auto flex ${wide ? 'max-w-4xl' : 'max-w-xl'} items-center gap-3 px-4 py-3`}>
        {back ? (
          <Link to={back} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-2xl text-brand" aria-label="Tilbake">
            ←
          </Link>
        ) : (
          <Logo />
        )}
        <h1 className="flex-1 truncate font-display text-2xl leading-none uppercase tracking-wide">{title}</h1>
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
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  )
}

const inputClass =
  'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/20'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} ${props.className ?? ''}`} />
}

export function Loading({ text = 'Laster …' }: { text?: string }) {
  return <p className="py-10 text-center text-muted">{text}</p>
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
    stone: 'bg-cream text-ink',
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-900',
    blue: 'bg-sky-100 text-sky-900',
  }
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone]}`}>{children}</span>
}

export function Logo({ size = 34 }: { size?: number }) {
  return (
    <img
      src="/logo.svg"
      alt=""
      width={size}
      height={size}
      className="rounded-[9px] shadow-[0_4px_14px_rgb(0_46_95/0.32)]"
    />
  )
}

/** Logo tile + PRODUGNAD, as in Substitutor's top bar. */
export function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <Logo />
      <span className="font-display text-[28px] leading-none tracking-wide uppercase">
        <span className="text-brand/40">Pro</span>Dugnad
      </span>
    </Link>
  )
}

/** Title in the condensed display font. */
export function Title({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h1 className={`font-display text-[32px] leading-[1.05] tracking-wide uppercase ${className}`}>{children}</h1>
}

/** The logo's shopping bag with heart, as a line icon in the current text colour. Placeholder for products without a picture. */
export function BagIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round">
        <path d="M136 200 H376 L356 404 H156 Z" />
        <path d="M200 200 V168 A56 56 0 0 1 312 168 V200" />
      </g>
      <path d="M256 360 L214 318 A28 28 0 0 1 256 280 A28 28 0 0 1 298 318 Z" fill="currentColor" />
    </svg>
  )
}
