import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

/** The app's own confirm dialog (instead of the browser's confirm()). */
interface Options {
  /** The button that does it: "Slett", "Lås", "Gjør til admin" … */
  confirm?: string
  cancel?: string
  /** Red button, for things that delete */
  danger?: boolean
  title?: string
}

type Ask = (message: string, options?: Options) => Promise<boolean>

const ConfirmContext = createContext<Ask>(async () => false)

export function useConfirm(): Ask {
  return useContext(ConfirmContext)
}

interface Open extends Options {
  message: string
  resolve: (ok: boolean) => void
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const ask = useCallback<Ask>(
    (message, options = {}) => new Promise<boolean>((resolve) => setOpen({ message, resolve, ...options })),
    [],
  )

  const close = useCallback(
    (ok: boolean) => {
      open?.resolve(ok)
      setOpen(null)
    },
    [open],
  )

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          onClick={() => close(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            className="w-full max-w-sm space-y-4 rounded-[20px] bg-white p-5 shadow-card ring-1 ring-line"
            onClick={(e) => e.stopPropagation()}
          >
            {open.title && (
              <h2 id="confirm-title" className="text-lg font-bold">
                {open.title}
              </h2>
            )}
            <p id="confirm-message" className="text-ink">
              {open.message}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => close(false)}
                className="min-h-12 rounded-2xl bg-white px-4 font-semibold text-ink ring-1 ring-line"
              >
                {open.cancel ?? 'Avbryt'}
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={() => close(true)}
                className={`min-h-12 rounded-2xl px-4 font-semibold text-white ${open.danger ? 'bg-red-700' : 'bg-brand'}`}
              >
                {open.confirm ?? 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
