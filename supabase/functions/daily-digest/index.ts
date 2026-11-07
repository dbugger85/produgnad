// Called every evening by GitHub Actions (.github/workflows/daily.yml).
// 1. From 20:00 Oslo time: queues one digest email per parent who got friend orders today.
// 2. Sends whatever is waiting in the outbox.
// The call also keeps the free Supabase project awake (it pauses after 7 idle days).
// No input and no login: calling it early does nothing, and twice the same day sends nothing new.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cors, drainOutbox } from '../_shared/outbox.ts'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

function osloHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Oslo' }).format(now))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    let queued = 0
    const hour = osloHour()
    if (hour >= 20) {
      const { data, error } = await supabase.rpc('queue_daily_digests')
      if (error) throw new Error(error.message)
      queued = data ?? 0
    }
    const result = await drainOutbox(supabase, 5)
    return new Response(JSON.stringify({ osloHour: hour, queued, ...result }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors })
  }
})
