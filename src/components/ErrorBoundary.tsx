import { Component, type ReactNode } from 'react'

/** True when a page section from an older version is gone from the server (after an update). */
export function isStaleChunkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '')
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch module|ChunkLoadError/i.test(msg)
}

/** Reloads once to pick up the new version; never loops (at most once per 30 seconds). */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem('produgnad:reloadedAt') ?? 0)
    if (Date.now() - last < 30_000) return false
    sessionStorage.setItem('produgnad:reloadedAt', String(Date.now()))
  } catch {
    // Storage blocked: reload anyway, the browser stops real loops
  }
  window.location.reload()
  return true
}

/** Catches crashes, so the page never stays empty and grey. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch(error: unknown) {
    if (isStaleChunkError(error)) reloadForNewVersion()
    else console.error(error)
  }

  render() {
    if (!this.state.error) return this.props.children
    const stale = isStaleChunkError(this.state.error)
    return (
      <main className="mx-auto max-w-xl space-y-4 px-4 py-10 text-center">
        <h1 className="font-display text-3xl uppercase tracking-wide">{stale ? 'Ny versjon' : 'Noe gikk galt'}</h1>
        <p className="text-muted">
          {stale
            ? 'Appen er oppdatert. Last inn siden på nytt for å fortsette'
            : 'Siden kunne ikke vises. Prøv å laste inn på nytt. Hjelper ikke det, ta kontakt med de ansvarlige'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-12 rounded-2xl bg-brand px-5 font-semibold text-white"
        >
          Last inn på nytt
        </button>
      </main>
    )
  }
}
