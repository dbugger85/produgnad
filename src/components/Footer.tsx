/** Small footer on every page, with a link to the sister app Substitutor. */
export function Footer() {
  return (
    <footer className="no-print mx-auto max-w-xl px-4 pt-2 pb-6 text-center text-xs text-muted">
      ProDugnad · Laget av samme folk som{' '}
      <a href="https://substitutor.no/?lang=no" className="font-semibold text-brand underline-offset-2 hover:underline">
        Substitutor
      </a>
      , rettferdige bytter i barneidrett
    </footer>
  )
}
