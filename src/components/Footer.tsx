/** Small footer on every page, with a link to the sister app Substitutor. */
export function Footer() {
  return (
    <footer className="no-print mx-auto max-w-xl px-3 pt-2 pb-6 text-center text-[11px] text-muted min-[380px]:text-xs">
      ProDugnad · Vi har også laget{' '}
      <a href="https://substitutor.no/?lang=no" className="font-semibold text-brand underline-offset-2 hover:underline">
        Substitutor
      </a>
      , rettferdige bytter
    </footer>
  )
}
