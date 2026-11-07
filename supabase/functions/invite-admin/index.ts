// Admins add a new admin by email: creates the person if needed, makes them admin,
// and queues an invitation email. Only callable by a logged-in admin.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cors, drainOutbox } from '../_shared/outbox.ts'

const url = Deno.env.get('SUPABASE_URL')!
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'METHOD' }, 405)

  // Who is asking? Must be a logged-in admin.
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: who } = await service.auth.getUser(token)
  if (!who?.user) return json({ error: 'NOT_LOGGED_IN' }, 401)
  const { data: me } = await service.from('profiles').select('is_admin, name').eq('user_id', who.user.id).single()
  if (!me?.is_admin) return json({ error: 'NOT_ALLOWED' }, 403)

  const { email: raw } = await req.json().catch(() => ({ email: '' }))
  const email = String(raw ?? '').trim().toLowerCase()
  if (email.length > 200 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'INVALID_EMAIL' }, 400)

  // Find or create the person (creating also creates the profile, via the auth trigger).
  let { data: profile } = await service.from('profiles').select('user_id, is_admin').eq('email', email).maybeSingle()
  let created = false
  if (!profile) {
    const { data, error } = await service.auth.admin.createUser({ email, email_confirm: true })
    if (error || !data.user) return json({ error: 'CREATE_FAILED', detail: error?.message }, 500)
    created = true
    profile = { user_id: data.user.id, is_admin: false }
  }
  const already = profile.is_admin
  if (!already) {
    const { error } = await service.from('profiles').update({ is_admin: true }).eq('user_id', profile.user_id)
    if (error) return json({ error: 'UPDATE_FAILED' }, 500)
  }

  // One invitation per person per day.
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(new Date())
  await service.from('email_outbox').upsert(
    { kind: 'admin_invite', to_email: email, dedupe_key: `admin_invite:${profile.user_id}:${day}` },
    { onConflict: 'dedupe_key', ignoreDuplicates: true },
  )
  await drainOutbox(service)
  return json({ ok: true, created, already })
})
