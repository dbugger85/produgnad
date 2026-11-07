// Security tests against the LOCAL Supabase: friend (anon), parent, admin.
// Run: npm run db:start (once), then npm run test:db
import { createClient } from '@supabase/supabase-js'
import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import { localEnv } from '../scripts/local-env.mjs'

const { url, serviceKey, anonKey } = localEnv()
const service = createClient(url, serviceKey, { auth: { persistSession: false } })
const run = Math.random().toString(36).slice(2, 8)
const PASSWORD = 'test-only-password-1'

const anon = () => createClient(url, anonKey, { auth: { persistSession: false } })

async function makeUser(label, extra = {}) {
  const email = `${label}-${run}@example.com`
  const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  if (Object.keys(extra).length) await service.from('profiles').update(extra).eq('user_id', data.user.id)
  const client = anon()
  const { error: e2 } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (e2) throw e2
  return { id: data.user.id, email, client }
}

function expectError(result, code) {
  assert.ok(result.error, `expected error ${code ?? ''}, got data ${JSON.stringify(result.data)}`)
  if (code) assert.match(result.error.message, new RegExp(code))
}

function expectNoRows(result) {
  assert.ok(result.error || (Array.isArray(result.data) && result.data.length === 0) || result.data === null,
    `expected nothing, got ${JSON.stringify(result.data)}`)
}

let admin, parentA, parentB, outsider
let campaign, otherCampaign, coffee, tea, hidden, foreignProduct
let cpA, cpB, linkA, linkB
let friendOrder

before(async () => {
  admin = await makeUser('admin', { is_admin: true, name: 'Admin Test', phone: '90000001', show_phone_public: false })
  parentA = await makeUser('parent-a')
  parentB = await makeUser('parent-b')
  outsider = await makeUser('outsider')

  const ins = await admin.client
    .from('campaigns')
    .insert({ name: `Test ${run}`, organizer_label: 'Supportere av T', target_amount: 1000, max_qty_per_line: 10 })
    .select()
    .single()
  assert.ifError(ins.error)
  campaign = ins.data
  otherCampaign = (await admin.client.from('campaigns').insert({ name: `Other ${run}`, organizer_label: 'X' }).select().single()).data

  const prod = await admin.client
    .from('products')
    .insert([
      { campaign_id: campaign.id, name: 'Kaffe', price: 120, to_team_amount: 50, sort_order: 0, active: true },
      { campaign_id: campaign.id, name: 'Te', price: 80, to_team_amount: 30, sort_order: 1, active: true },
      { campaign_id: campaign.id, name: 'Skjult', price: 10, to_team_amount: 1, sort_order: 2, active: false },
      { campaign_id: otherCampaign.id, name: 'Annen', price: 10, to_team_amount: 1, sort_order: 0, active: true },
    ], { defaultToNull: false })
    .select()
  assert.ifError(prod.error)
  ;[coffee, tea, hidden, foreignProduct] = prod.data

  const joinA = await parentA.client.rpc('join_campaign', {
    p_join_code: campaign.join_code, p_name: 'Ola Hansen', p_phone: '91234567', p_child_first_name: 'Emma',
  })
  assert.ifError(joinA.error)
  cpA = joinA.data
  cpB = (await parentB.client.rpc('join_campaign', {
    p_join_code: campaign.join_code, p_name: 'Lise Berg', p_phone: '92345678', p_child_first_name: 'Jonas',
  })).data
  const links = (await service.from('campaign_parents').select('id, link_code').in('id', [cpA, cpB])).data
  linkA = links.find((l) => l.id === cpA).link_code
  linkB = links.find((l) => l.id === cpB).link_code

  const order = await anon().rpc('create_friend_order', {
    p_link_code: linkA, p_first_name: 'Kari',
    p_lines: [{ product_id: coffee.id, qty: 2 }],
    p_email: 'kari@example.com', p_wants_email: true,
  })
  assert.ifError(order.error)
  friendOrder = order.data
})

describe('friend (no login)', () => {
  test('cannot read any table or view directly', async () => {
    const a = anon()
    for (const table of ['profiles', 'campaigns', 'products', 'product_images', 'campaign_parents', 'orders',
      'order_lines', 'parent_payments', 'email_outbox', 'v_order_amounts', 'v_parent_totals', 'v_campaign_progress']) {
      expectNoRows(await a.from(table).select('*').limit(1))
    }
  })

  test('cannot write tables directly', async () => {
    const a = anon()
    expectError(await a.from('orders').insert({ campaign_parent_id: cpA, type: 'friend', created_by: 'friend', code: 'X' }))
    expectError(await a.from('campaigns').update({ name: 'hacked' }).eq('id', campaign.id).select())
  })

  test('sees the public page for a link, with admin phone hidden unless opted in', async () => {
    const { data, error } = await anon().rpc('public_campaign_by_link', { p_link_code: linkA.toLowerCase() })
    assert.ifError(error)
    assert.equal(data.parent.name, 'Ola Hansen')
    assert.equal(data.parent.phone, '91234567')
    assert.equal(data.parent.child_first_name, 'Emma')
    assert.deepEqual(data.products.map((p) => p.name), ['Kaffe', 'Te'])
    const adminRow = data.campaign.admins.find((x) => x.name === 'Admin Test')
    assert.ok(adminRow)
    assert.equal(adminRow.phone, null)
    assert.equal(Number(data.campaign.raised), 100)
  })

  test('unknown link gives nothing', async () => {
    const { data } = await anon().rpc('public_campaign_by_link', { p_link_code: 'NOPE99' })
    assert.equal(data, null)
  })

  test('order validation', async () => {
    const a = anon()
    const base = { p_link_code: linkA, p_first_name: 'Per' }
    expectError(await a.rpc('create_friend_order', { ...base, p_lines: [{ product_id: coffee.id, qty: 11 }] }), 'INVALID_QTY')
    expectError(await a.rpc('create_friend_order', { ...base, p_lines: [{ product_id: coffee.id, qty: -1 }] }), 'INVALID_QTY')
    expectError(await a.rpc('create_friend_order', { ...base, p_first_name: '  ', p_lines: [{ product_id: coffee.id, qty: 1 }] }), 'INVALID_NAME')
    expectError(await a.rpc('create_friend_order', { ...base, p_lines: [] }), 'EMPTY_ORDER')
    expectError(await a.rpc('create_friend_order', { ...base, p_lines: [{ product_id: hidden.id, qty: 1 }] }), 'INVALID_PRODUCT')
    expectError(await a.rpc('create_friend_order', { ...base, p_lines: [{ product_id: foreignProduct.id, qty: 1 }] }), 'INVALID_PRODUCT')
    expectError(await a.rpc('create_friend_order', { ...base, p_lines: [{ product_id: coffee.id, qty: 1 }, { product_id: coffee.id, qty: 1 }] }), 'INVALID_LINES')
    expectError(await a.rpc('create_friend_order', { ...base, p_link_code: 'NOPE99', p_lines: [{ product_id: coffee.id, qty: 1 }] }), 'UNKNOWN_LINK')
    expectError(await a.rpc('create_friend_order', { ...base, p_email: 'not-an-email', p_lines: [{ product_id: coffee.id, qty: 1 }] }), 'INVALID_EMAIL')
  })

  test('honeypot pretends success but stores nothing', async () => {
    const before = (await service.from('orders').select('id', { count: 'exact', head: true }).eq('campaign_parent_id', cpB)).count
    const { data, error } = await anon().rpc('create_friend_order', {
      p_link_code: linkB, p_first_name: 'Bot', p_lines: [{ product_id: coffee.id, qty: 1 }], p_honeypot: 'http://spam',
    })
    assert.ifError(error)
    assert.ok(data.code)
    const after = (await service.from('orders').select('id', { count: 'exact', head: true }).eq('campaign_parent_id', cpB)).count
    assert.equal(after, before)
  })

  test('double submit with the same client token returns the same order', async () => {
    const token = crypto.randomUUID()
    const args = { p_link_code: linkB, p_first_name: 'Dobbel', p_lines: [{ product_id: tea.id, qty: 1 }], p_client_token: token }
    const first = await anon().rpc('create_friend_order', args)
    const second = await anon().rpc('create_friend_order', args)
    assert.ifError(first.error)
    assert.ifError(second.error)
    assert.equal(first.data.code, second.data.code)
    assert.equal(first.data.status_token, second.data.status_token)
    // Same token through another parent's link is rejected.
    expectError(await anon().rpc('create_friend_order', { ...args, p_link_code: linkA }), 'INVALID_TOKEN')
  })

  test('order result and status by token; codes count per parent', async () => {
    assert.equal(friendOrder.code, 'K1')
    assert.equal(Number(friendOrder.amount), 240)
    assert.equal(friendOrder.parent.phone, '91234567')
    const { data } = await anon().rpc('order_status_by_token', { p_token: friendOrder.status_token })
    assert.equal(data.status, 'registrert')
    assert.equal(data.code, 'K1')
    assert.equal(Number(data.amount), 240)
    const none = await anon().rpc('order_status_by_token', { p_token: crypto.randomUUID() })
    assert.equal(none.data, null)
  })

  test('opt-in email is queued once', async () => {
    const { data } = await service.from('email_outbox').select('*').eq('kind', 'friend_order').eq('to_email', 'kari@example.com')
    assert.equal(data.filter((r) => r.campaign_parent_id === cpA).length, 1)
  })

  test('cannot call parent or admin functions', async () => {
    expectError(await anon().rpc('save_order', { p_campaign_parent_id: cpA, p_type: 'own', p_lines: [{ product_id: coffee.id, qty: 1 }] }))
    expectError(await anon().rpc('set_admin', { p_email: 'x@example.com', p_is_admin: true }))
    expectError(await anon().rpc('claim_outbox', { p_limit: 5 }))
  })
})

describe('parent', () => {
  test('sees own campaign_parents row only', async () => {
    const { data } = await parentA.client.from('campaign_parents').select('*')
    assert.deepEqual(data.map((r) => r.id), [cpA])
  })

  test('sees own orders only', async () => {
    await parentB.client.rpc('save_order', { p_campaign_parent_id: cpB, p_type: 'own', p_lines: [{ product_id: tea.id, qty: 1 }] })
    const a = await parentA.client.from('orders').select('campaign_parent_id')
    assert.ok(a.data.length > 0)
    assert.ok(a.data.every((o) => o.campaign_parent_id === cpA))
    const lines = await parentA.client.from('order_lines').select('order_id, orders!inner(campaign_parent_id)')
    assert.ok(lines.data.every((l) => l.orders.campaign_parent_id === cpA))
  })

  test('sees own profile only, cannot make self admin', async () => {
    const { data } = await parentA.client.from('profiles').select('user_id')
    assert.deepEqual(data.map((p) => p.user_id), [parentA.id])
    expectError(await parentA.client.from('profiles').update({ is_admin: true }).eq('user_id', parentA.id))
    expectError(await parentA.client.rpc('set_admin', { p_email: parentA.email, p_is_admin: true }), 'NOT_ALLOWED')
    const me = (await service.from('profiles').select('is_admin').eq('user_id', parentA.id).single()).data
    assert.equal(me.is_admin, false)
  })

  test('can read their campaign and its products, not other campaigns', async () => {
    const { data } = await parentA.client.from('campaigns').select('id')
    assert.deepEqual(data.map((c) => c.id), [campaign.id])
    const p = await parentA.client.from('products').select('campaign_id')
    assert.ok(p.data.every((x) => x.campaign_id === campaign.id))
  })

  test('cannot change campaigns, products, payments or codes', async () => {
    const upd = await parentA.client.from('campaigns').update({ name: 'hacked' }).eq('id', campaign.id).select()
    expectNoRows(upd)
    expectError(await parentA.client.from('products').insert({ campaign_id: campaign.id, name: 'X', price: 1 }))
    expectError(await parentA.client.from('parent_payments').insert({ campaign_parent_id: cpA, amount: 1000 }))
    expectError(await parentA.client.from('campaign_parents').update({ payment_code: 'D-1' }).eq('id', cpA))
    expectNoRows(await parentA.client.from('campaign_parents').update({ goods_sent_at: new Date().toISOString() }).eq('id', cpA).select())
    expectNoRows(await parentA.client.from('email_outbox').select('*'))
  })

  test("cannot touch another parent's orders", async () => {
    expectError(await parentA.client.rpc('save_order', { p_campaign_parent_id: cpB, p_type: 'own', p_lines: [{ product_id: coffee.id, qty: 1 }] }), 'NOT_ALLOWED')
    const bOrder = (await service.from('orders').select('id').eq('campaign_parent_id', cpB).limit(1).single()).data
    expectError(await parentA.client.rpc('set_order_paid', { p_order_id: bOrder.id, p_paid: true }), 'NOT_ALLOWED')
    expectError(await parentA.client.rpc('delete_order', { p_order_id: bOrder.id }), 'NOT_ALLOWED')
    // Editing B's order while claiming to be A's row is also refused.
    expectError(await parentA.client.rpc('save_order', { p_campaign_parent_id: cpA, p_order_id: bOrder.id, p_type: 'own', p_lines: [{ product_id: coffee.id, qty: 1 }] }))
  })

  test('adds, edits, ticks paid and deletes own orders', async () => {
    const created = await parentA.client.rpc('save_order', {
      p_campaign_parent_id: cpA, p_type: 'friend', p_buyer_first_name: 'Nabo', p_lines: [{ product_id: tea.id, qty: 1 }],
    })
    assert.ifError(created.error)
    const id = created.data.id
    const edited = await parentA.client.rpc('save_order', {
      p_campaign_parent_id: cpA, p_order_id: id, p_type: 'friend', p_buyer_first_name: 'Nabo',
      p_lines: [{ product_id: tea.id, qty: 3 }, { product_id: coffee.id, qty: 1 }],
    })
    assert.ifError(edited.error)
    const lines = (await parentA.client.from('order_lines').select('product_id, qty').eq('order_id', id)).data
    assert.equal(lines.length, 2)
    assert.ifError((await parentA.client.rpc('set_order_paid', { p_order_id: id, p_paid: true })).error)
    const o = (await parentA.client.from('orders').select('paid_to_parent_at').eq('id', id).single()).data
    assert.ok(o.paid_to_parent_at)
    assert.ifError((await parentA.client.rpc('delete_order', { p_order_id: id })).error)
    const gone = (await service.from('orders').select('deleted_at').eq('id', id).single()).data
    assert.ok(gone.deleted_at)
  })

  test('friend order status follows paid -> delivered', async () => {
    const id = (await service.from('orders').select('id').eq('status_token', friendOrder.status_token).single()).data.id
    await parentA.client.rpc('set_order_paid', { p_order_id: id, p_paid: true })
    let s = (await anon().rpc('order_status_by_token', { p_token: friendOrder.status_token })).data
    assert.equal(s.status, 'betalt')
    const mail = await service.from('email_outbox').select('id').eq('dedupe_key', `friend_paid:${id}`)
    assert.equal(mail.data.length, 1)
    await parentA.client.rpc('set_order_delivered', { p_order_id: id, p_delivered: true })
    s = (await anon().rpc('order_status_by_token', { p_token: friendOrder.status_token })).data
    assert.equal(s.status, 'levert')
  })

  test('join with a wrong code fails', async () => {
    expectError(await outsider.client.rpc('join_campaign', { p_join_code: 'WRONG', p_name: 'X Y', p_phone: '12345678', p_child_first_name: '' }), 'UNKNOWN_JOIN_CODE')
  })
})

describe('logged in, not part of any campaign', () => {
  test('sees nothing', async () => {
    for (const table of ['campaigns', 'products', 'campaign_parents', 'orders', 'parent_payments']) {
      expectNoRows(await outsider.client.from(table).select('*'))
    }
  })
})

describe('admin', () => {
  test('sees all parents and orders', async () => {
    const cps = (await admin.client.from('campaign_parents').select('id').eq('campaign_id', campaign.id)).data
    assert.equal(cps.length, 2)
    const orders = (await admin.client.from('orders').select('campaign_parent_id').eq('campaign_id', campaign.id)).data
    assert.ok(orders.some((o) => o.campaign_parent_id === cpA) && orders.some((o) => o.campaign_parent_id === cpB))
  })

  test('records a parent payment; totals add up; parent gets an email', async () => {
    const before = (await admin.client.from('v_parent_totals').select('*').eq('campaign_parent_id', cpA).single()).data
    const owed = Number(before.owed)
    assert.ok(owed > 0)
    assert.ifError((await admin.client.from('parent_payments').insert({ campaign_parent_id: cpA, amount: owed })).error)
    const after = (await parentA.client.from('v_parent_totals').select('*').eq('campaign_parent_id', cpA).single()).data
    assert.equal(Number(after.paid), owed)
    assert.equal(Number(after.diff), 0)
    const mails = (await service.from('email_outbox').select('kind').eq('campaign_parent_id', cpA).eq('kind', 'parent_payment')).data
    assert.equal(mails.length, 1)
  })

  test('progress = sum of qty × to-team over all non-deleted orders', async () => {
    const lines = (await service.from('order_lines').select('qty, unit_to_team, orders!inner(campaign_id, deleted_at)')
      .eq('orders.campaign_id', campaign.id).is('orders.deleted_at', null)).data
    const expected = lines.reduce((s, l) => s + l.qty * Number(l.unit_to_team), 0)
    const pub = (await anon().rpc('public_campaign_by_link', { p_link_code: linkA })).data
    assert.equal(Number(pub.campaign.raised), expected)
    const view = (await admin.client.from('v_campaign_progress').select('raised').eq('campaign_id', campaign.id).single()).data
    assert.equal(Number(view.raised), expected)
  })

  test('price changes do not change existing orders', async () => {
    const order = (await anon().rpc('create_friend_order', { p_link_code: linkB, p_first_name: 'Snap', p_lines: [{ product_id: coffee.id, qty: 1 }] })).data
    await admin.client.from('products').update({ price: 999, to_team_amount: 1 }).eq('id', coffee.id)
    const s = (await anon().rpc('order_status_by_token', { p_token: order.status_token })).data
    assert.equal(Number(s.amount), 120)
    await admin.client.from('products').update({ price: 120, to_team_amount: 50 }).eq('id', coffee.id)
  })

  test('lock stops parents and friends, but not paid/delivered ticks or admins', async () => {
    assert.ifError((await admin.client.from('campaigns').update({ locked_at: new Date().toISOString() }).eq('id', campaign.id)).error)
    try {
      expectError(await parentA.client.rpc('save_order', { p_campaign_parent_id: cpA, p_type: 'own', p_lines: [{ product_id: coffee.id, qty: 1 }] }), 'CAMPAIGN_LOCKED')
      expectError(await anon().rpc('create_friend_order', { p_link_code: linkA, p_first_name: 'Sen', p_lines: [{ product_id: coffee.id, qty: 1 }] }), 'CAMPAIGN_CLOSED')
      const id = (await service.from('orders').select('id').eq('status_token', friendOrder.status_token).single()).data.id
      expectError(await parentA.client.rpc('delete_order', { p_order_id: id }), 'CAMPAIGN_LOCKED')
      assert.ifError((await parentA.client.rpc('set_order_paid', { p_order_id: id, p_paid: false })).error)
      assert.ifError((await admin.client.rpc('save_order', { p_campaign_parent_id: cpA, p_type: 'own', p_lines: [{ product_id: coffee.id, qty: 1 }] })).error)
      const pub = (await anon().rpc('public_campaign_by_link', { p_link_code: linkA })).data
      assert.equal(pub.campaign.accepting_orders, false)
    } finally {
      await admin.client.from('campaigns').update({ locked_at: null }).eq('id', campaign.id)
    }
  })

  test('deadline passed stops friends but not parents', async () => {
    const yesterday = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)
    await admin.client.from('campaigns').update({ deadline: yesterday }).eq('id', campaign.id)
    try {
      expectError(await anon().rpc('create_friend_order', { p_link_code: linkA, p_first_name: 'Sen', p_lines: [{ product_id: coffee.id, qty: 1 }] }), 'CAMPAIGN_CLOSED')
      assert.ifError((await parentA.client.rpc('save_order', { p_campaign_parent_id: cpA, p_type: 'own', p_lines: [{ product_id: tea.id, qty: 1 }] })).error)
    } finally {
      await admin.client.from('campaigns').update({ deadline: null }).eq('id', campaign.id)
    }
  })

  test('goods sent queues an email to the parent and shows "på vei"', async () => {
    assert.ifError((await admin.client.from('campaign_parents').update({ goods_sent_at: new Date().toISOString() }).eq('id', cpB)).error)
    const mails = (await service.from('email_outbox').select('kind').eq('dedupe_key', `goods_sent:${cpB}`)).data
    assert.equal(mails.length, 1)
    const order = (await anon().rpc('create_friend_order', { p_link_code: linkB, p_first_name: 'Vei', p_lines: [{ product_id: tea.id, qty: 1 }] })).data
    const s = (await anon().rpc('order_status_by_token', { p_token: order.status_token })).data
    assert.equal(s.status, 'på vei')
  })

  test('only admins upload product pictures', async () => {
    const file = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
    const path = `${campaign.id}/test-${run}.png`
    expectError(await parentA.client.storage.from('product-images').upload(path, file, { contentType: 'image/png' }))
    expectError(await anon().storage.from('product-images').upload(path, file, { contentType: 'image/png' }))
    const ok = await admin.client.storage.from('product-images').upload(path, file, { contentType: 'image/png' })
    assert.ifError(ok.error)
    expectError(await admin.client.storage.from('product-images').upload(`${campaign.id}/x-${run}.txt`, new Blob(['hi'], { type: 'text/plain' }), { contentType: 'text/plain' }))
    await admin.client.storage.from('product-images').remove([path])
  })

  test('manages admins but cannot remove the last one', async () => {
    assert.ifError((await admin.client.rpc('set_admin', { p_email: outsider.email, p_is_admin: true })).error)
    assert.ifError((await admin.client.rpc('set_admin', { p_email: outsider.email, p_is_admin: false })).error)
    expectError(await admin.client.rpc('set_admin', { p_email: 'nobody@example.com', p_is_admin: true }), 'UNKNOWN_USER')
  })
})
