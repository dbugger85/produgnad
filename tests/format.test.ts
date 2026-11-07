import assert from 'node:assert/strict'
import { test } from 'node:test'
import { daysUntil, kr, longDate, phone, phoneDigits, plainAmount, weekdayDate } from '../src/lib/format.ts'
import { fillTemplate } from '../src/lib/share.ts'
import { defaultPictureFor } from '../src/lib/defaultPictures.ts'

const nbsp = (s: string) => s.replace(/ /g, ' ')

test('amounts use space as thousands separator and comma as decimal', () => {
  assert.equal(nbsp(kr(1440)), '1 440 kr')
  assert.equal(nbsp(kr('30000.00')), '30 000 kr')
  assert.equal(kr(12.5), '12,5 kr')
  assert.equal(plainAmount(240), '240')
  assert.equal(plainAmount(12.5), '12,5')
})

test('dates are Norwegian', () => {
  assert.equal(longDate('2026-11-20'), '20. november 2026')
  assert.equal(weekdayDate('2026-11-20'), 'fredag 20. november')
  assert.equal(longDate(null), '')
})

test('phone numbers get +47 and are grouped 3-2-3', () => {
  assert.equal(nbsp(phone('91234567')), '+47 912 34 567')
  assert.equal(nbsp(phone('912 34 567')), '+47 912 34 567')
  assert.equal(nbsp(phone('+47 912 34 567')), '+47 912 34 567')
  assert.equal(nbsp(phone('004791234567')), '+47 912 34 567')
  assert.equal(phone('+46 70 123 45 67'), '+46 70 123 45 67')
  assert.equal(phoneDigits('+47 912 34 567'), '91234567')
})

test('days until deadline counts in Oslo time', () => {
  assert.equal(daysUntil('2026-11-20', new Date('2026-11-17T23:30:00Z')), 2) // already 18th in Oslo
  assert.equal(daysUntil('2026-11-20', new Date('2026-11-20T10:00:00Z')), 0)
  assert.equal(daysUntil(null), null)
})

test('templates fill known placeholders and keep unknown ones', () => {
  const out = fillTemplate('Hei! {barn} i {lag} selger {produkter}. {ukjent} {lenke}', {
    barn: 'Emma',
    lag: 'Ready G2018',
    produkter: 'kaffe',
    lenke: 'https://x/k/ABC',
  })
  assert.equal(out, 'Hei! Emma i Ready G2018 selger kaffe. {ukjent} https://x/k/ABC')
  assert.equal(fillTemplate('{beløp} til {vipps}', { beløp: '240 kr', vipps: '912 34 567' }), '240 kr til 912 34 567')
})

test('standard pictures are chosen from the product name', () => {
  assert.equal(defaultPictureFor('Kaffe, filtermalt 500 g'), 'kaffe')
  assert.equal(defaultPictureFor('Espressobønner'), 'kaffe')
  assert.equal(defaultPictureFor('Te, 100 g'), 'te')
  assert.equal(defaultPictureFor('Grønn te med sitron'), 'te')
  assert.equal(defaultPictureFor('Urtete'), 'te')
  assert.equal(defaultPictureFor('Sokker, 3-pakning'), 'sokker')
  assert.equal(defaultPictureFor('Toalettpapir 24 ruller'), null)
  assert.equal(defaultPictureFor('Tekstilpose'), null)
  assert.equal(defaultPictureFor('Lodd'), null)
  assert.equal(defaultPictureFor('Kakebokser'), null)
})
