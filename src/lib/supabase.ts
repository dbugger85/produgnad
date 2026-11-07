import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY (see .env.example)')
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const IMAGE_BUCKET = 'product-images'

export function imageUrl(path: string | null | undefined): string {
  if (!path) return ''
  return `${url}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`
}
