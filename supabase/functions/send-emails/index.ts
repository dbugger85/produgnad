// Sends queued emails. Called by the app right after a friend orders.
// It takes no input, so calling it without login is harmless.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cors, drainOutbox } from '../_shared/outbox.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const result = await drainOutbox(supabase)
    return new Response(JSON.stringify(result), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors })
  }
})
