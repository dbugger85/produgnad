// Link previews (Open Graph) for shared links, filled in on Cloudflare before the app loads.
// Messenger, WhatsApp, SMS apps and Facebook read these tags; they don't run the app's JavaScript.
// Used by functions/k/[code].ts and functions/bli-med/[code].ts.

export interface Env {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

export interface Preview {
  title: string
  description: string
  image?: string
  imageWidth?: number
  imageHeight?: number
}

// Public values; also set as Pages environment variables.
const FALLBACK_URL = 'https://nnqpdzqzwzhogcbzriyn.supabase.co'
const FALLBACK_KEY = 'sb_publishable_owBy0TpSPRQlMUav_Ev95g_ZZMt5bBj'

export async function rpc<T>(env: Env, name: string, args: Record<string, unknown>): Promise<T | null> {
  const url = env.VITE_SUPABASE_URL || FALLBACK_URL
  const key = env.VITE_SUPABASE_ANON_KEY || FALLBACK_KEY
  try {
    const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(2500),
    })
    return res.ok ? ((await res.json()) as T) : null
  } catch {
    return null
  }
}

export function imageUrl(env: Env, path: string): string {
  return `${env.VITE_SUPABASE_URL || FALLBACK_URL}/storage/v1/object/public/product-images/${path}`
}

export function kr(n: number): string {
  return `${new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 }).format(n)} kr`
}

/** Replaces the default tags in index.html with the preview's. */
export function withPreview(response: Response, pageUrl: string, p: Preview): Response {
  const set = (value: string | undefined) => ({
    element(el: Element) {
      if (value !== undefined) el.setAttribute('content', value)
    },
  })
  // The default picture's size (1200×630) stays unless the preview has its own picture.
  const size = (value: number | undefined) => ({
    element(el: Element) {
      if (!p.image) return
      if (value) el.setAttribute('content', String(value))
      else el.remove()
    },
  })
  return new HTMLRewriter()
    .on('title', { element: (el) => void el.setInnerContent(p.title) })
    .on('meta[name="description"]', set(p.description))
    .on('meta[property="og:title"]', set(p.title))
    .on('meta[property="og:description"]', set(p.description))
    .on('meta[property="og:url"]', set(pageUrl))
    .on('meta[property="og:image"]', set(p.image))
    .on('meta[name="twitter:image"]', set(p.image))
    .on('meta[property="og:image:width"]', size(p.imageWidth))
    .on('meta[property="og:image:height"]', size(p.imageHeight))
    .transform(response)
}
