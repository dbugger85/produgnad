// Fills the LOCAL database with a dummy campaign, products with placeholder pictures,
// an admin, two parents and some orders. Dummy data only.
//   npm run seed            (after npm run db:reset)
import { createClient } from '@supabase/supabase-js'
import { deflateSync } from 'node:zlib'
import { localEnv } from './local-env.mjs'

const { url, serviceKey, anonKey } = localEnv()
if (!/127\.0\.0\.1|localhost/.test(url)) {
  console.error(`Refusing to seed ${url}: this script is for the local database only.`)
  process.exit(1)
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
const PASSWORD = 'local-dev-only-123'

async function user(email, name, phone, extra = {}) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error && !/already/.test(error.message)) throw error
  const id = data?.user?.id ?? (await admin.from('profiles').select('user_id').eq('email', email).single()).data.user_id
  await admin.from('profiles').update({ name, phone, ...extra }).eq('user_id', id)
  return id
}

async function as(email) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw error
  return client
}

// Minimal solid-colour PNG, so we need no image library.
function png(size, [r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf) => {
    let c = 0xffffffff
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const row = Buffer.alloc(1 + size * 3)
  for (let x = 0; x < size; x++) row.set([r, g, b], 1 + x * 3)
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const adminId = await user('admin@example.com', 'Kari Nordmann', '91234567', {
  is_admin: true,
  role_title: 'kasserer',
  show_phone_public: true,
})
await user('ola@example.com', 'Ola Hansen', '91234568')
await user('lise@example.com', 'Lise Berg', '92345678')

const deadline = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
const { data: campaign, error: cErr } = await admin
  .from('campaigns')
  .insert({
    name: 'Kaffesalg høsten 2026',
    team_name: 'G2012',
    organizer_label: 'Foreldre og supportere av G2012',
    purpose_text: 'Alt overskudd går til cupavgifter og reiser for laget i 2027.',
    target_amount: 30000,
    deadline,
    admin_vipps_name: 'Kari Nordmann',
    admin_vipps_phone: '91234567',
    contact_admin_user_id: adminId,
    join_code: 'G2012KAF',
    closing_message: '',
  })
  .select()
  .single()
if (cErr) throw cErr

const productRows = [
  { name: 'Kaffe, filtermalt 500 g', description: 'Mellomristet, fra lokal brenner', price: 120, to_team_amount: 50, sort_order: 0, color: [107, 66, 38] },
  { name: 'Kaffe, hele bønner 500 g', description: 'Mørkristet espressobønner', price: 130, to_team_amount: 55, sort_order: 1, color: [60, 40, 30] },
  { name: 'Te, 100 g', description: 'Grønn te med sitron', price: 80, to_team_amount: 30, sort_order: 2, color: [90, 140, 80] },
]
const products = []
for (const { color, ...p } of productRows) {
  const { data, error } = await admin.from('products').insert({ ...p, campaign_id: campaign.id }).select().single()
  if (error) throw error
  const base = `${campaign.id}/${data.id}/seed`
  await admin.storage.from('product-images').upload(`${base}.png`, png(600, color), { contentType: 'image/png', upsert: true })
  await admin.storage.from('product-images').upload(`${base}-thumb.png`, png(200, color), { contentType: 'image/png', upsert: true })
  await admin.from('product_images').insert({
    product_id: data.id,
    storage_path: `${base}.png`,
    thumb_path: `${base}-thumb.png`,
    width: 600,
    height: 600,
    sort_order: 0,
  })
  products.push(data)
}

const ola = await as('ola@example.com')
const olaCp = (await ola.rpc('join_campaign', { p_join_code: 'G2012KAF', p_name: 'Ola Hansen', p_phone: '91234568', p_child_first_name: 'Emma' })).data
const lise = await as('lise@example.com')
const liseCp = (await lise.rpc('join_campaign', { p_join_code: 'G2012KAF', p_name: 'Lise Berg', p_phone: '92345678', p_child_first_name: 'Jonas' })).data

const { data: links } = await admin.from('campaign_parents').select('id, link_code, payment_code').in('id', [olaCp, liseCp])
const olaLink = links.find((l) => l.id === olaCp)

const anon = createClient(url, anonKey, { auth: { persistSession: false } })
for (const [name, lines] of [
  ['Kari', [{ product_id: products[0].id, qty: 2 }]],
  ['Per', [{ product_id: products[1].id, qty: 1 }, { product_id: products[2].id, qty: 2 }]],
]) {
  const { error } = await anon.rpc('create_friend_order', { p_link_code: olaLink.link_code, p_first_name: name, p_lines: lines })
  if (error) throw error
}
await ola.rpc('save_order', {
  p_campaign_parent_id: olaCp,
  p_type: 'own',
  p_lines: [{ product_id: products[0].id, qty: 3 }],
})
await ola.rpc('save_order', {
  p_campaign_parent_id: olaCp,
  p_type: 'friend',
  p_buyer_first_name: 'Bestemor',
  p_paid: true,
  p_lines: [{ product_id: products[0].id, qty: 4 }],
})
await lise.rpc('save_order', {
  p_campaign_parent_id: liseCp,
  p_type: 'extra',
  p_lines: [{ product_id: products[0].id, qty: 5 }],
})

console.log(`
Seeded dummy campaign "${campaign.name}".
  Friend order page (Ola):  http://localhost:5173/k/${olaLink.link_code}
  Parent sign-up:           http://localhost:5173/bli-med/G2012KAF
  Log in as admin@example.com, ola@example.com or lise@example.com.
  The login code arrives in the local mail viewer: http://127.0.0.1:54324
`)
