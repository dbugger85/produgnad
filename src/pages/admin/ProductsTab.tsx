import { useId, useState } from 'react'
import { BagIcon, Badge, Button, Card, ErrorBox, Field, Input } from '../../components/ui'
import { defaultPictureFor, defaultPictureUrl } from '../../lib/defaultPictures'
import { errorText } from '../../lib/errors'
import { kr } from '../../lib/format'
import { newId } from '../../lib/id'
import { prepareProductImage } from '../../lib/images'
import { IMAGE_BUCKET, imageUrl, supabase } from '../../lib/supabase'
import type { Order, Product, ProductImageRow } from '../../lib/types'
import { useConfirm } from '../../components/Confirm'
import { RichTextEditor } from '../../components/RichText'

export function ProductsTab({
  campaignId,
  products,
  orders,
  reload,
}: {
  campaignId: string
  products: Product[]
  /** The campaign's orders that aren't deleted (all types), to count units sold */
  orders: Order[]
  reload: () => Promise<void>
}) {
  const sold: Record<string, number> = {}
  for (const o of orders) for (const l of o.order_lines) sold[l.product_id] = (sold[l.product_id] ?? 0) + l.qty
  const [editing, setEditing] = useState<string | 'new' | null>(products.length === 0 ? 'new' : null)
  const [copying, setCopying] = useState<string | null>(null)
  const [error, setError] = useState('')

  // A copy starts hidden, so friends don't see it before it's been changed, and opens for editing
  async function duplicate(p: Product) {
    setError('')
    setCopying(p.id)
    try {
      const { data: copy, error } = await supabase
        .from('products')
        .insert({
          campaign_id: campaignId,
          name: `${p.name} (kopi)`,
          description: p.description,
          price: p.price,
          to_team_amount: p.to_team_amount,
          stock: p.stock,
          active: false,
          sort_order: Math.max(0, ...products.map((x) => x.sort_order)) + 1,
        })
        .select('id')
        .single()
      if (error) throw error
      // Own copies of the pictures, so deleting one product's picture never breaks the other
      for (const img of p.product_images ?? []) {
        const base = `${campaignId}/${copy.id}/${newId()}`
        const paths: string[] = []
        for (const [from, suffix] of [[img.storage_path, ''], [img.thumb_path, '-thumb']] as const) {
          const blob = await (await fetch(imageUrl(from))).blob()
          const to = `${base}${suffix}.${from.split('.').pop()}`
          const up = await supabase.storage.from(IMAGE_BUCKET).upload(to, blob, { contentType: blob.type, upsert: false })
          if (up.error) throw up.error
          paths.push(to)
        }
        const ins = await supabase.from('product_images').insert({
          product_id: copy.id,
          storage_path: paths[0],
          thumb_path: paths[1],
          width: img.width,
          height: img.height,
          sort_order: img.sort_order,
        })
        if (ins.error) throw ins.error
      }
      await reload()
      setEditing(copy.id)
    } catch (e) {
      setError(errorText(e))
      await reload()
    }
    setCopying(null)
  }

  return (
    <div className="space-y-3">
      <ErrorBox>{error}</ErrorBox>
      {products.map((p) =>
        editing === p.id ? (
          <ProductForm
            key={p.id}
            campaignId={campaignId}
            product={p}
            sold={sold[p.id] ?? 0}
            nextSort={0}
            onDone={async () => {
              setEditing(null)
              await reload()
            }}
            reload={reload}
          />
        ) : (
          <Card key={p.id} className="flex gap-3">
            {p.product_images?.[0] ? (
              <img src={imageUrl(p.product_images[0].thumb_path)} alt="" className="h-20 w-20 rounded-xl object-cover" />
            ) : defaultPictureFor(p.name) ? (
              <img src={defaultPictureUrl(defaultPictureFor(p.name)!)} alt="" className="h-20 w-20 rounded-xl object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-brand-soft text-brand/40">
                <BagIcon className="h-12 w-12" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 font-bold">
                {p.name} {!p.active && <Badge>Skjult</Badge>}
              </div>
              <div className="text-sm text-muted">
                {kr(p.price)}, {kr(p.to_team_amount)} til laget
              </div>
              <div className="text-sm text-muted">
                Solgt {sold[p.id] ?? 0}
                {p.stock !== null && (
                  <>
                    {' '}av {p.stock} ·{' '}
                    {p.stock - (sold[p.id] ?? 0) > 0 ? `${p.stock - (sold[p.id] ?? 0)} igjen` : <strong className="text-red-700">Utsolgt</strong>}
                  </>
                )}
              </div>
              <div className="mt-1 flex gap-4">
                <button type="button" className="text-sm font-semibold text-brand" onClick={() => setEditing(p.id)}>
                  Endre
                </button>
                <button
                  type="button"
                  className="text-sm font-semibold text-brand disabled:text-muted"
                  onClick={() => void duplicate(p)}
                  disabled={copying !== null}
                >
                  {copying === p.id ? 'Kopierer …' : 'Kopier'}
                </button>
              </div>
            </div>
          </Card>
        ),
      )}
      {editing === 'new' ? (
        <ProductForm
          campaignId={campaignId}
          sold={0}
          nextSort={products.length}
          onDone={async () => {
            setEditing(null)
            await reload()
          }}
          reload={reload}
        />
      ) : (
        <Button onClick={() => setEditing('new')}>+ Ny vare</Button>
      )}
    </div>
  )
}

function ProductForm({
  campaignId,
  product,
  sold,
  nextSort,
  onDone,
  reload,
}: {
  campaignId: string
  product?: Product
  sold: number
  nextSort: number
  onDone: () => Promise<void>
  reload: () => Promise<void>
}) {
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price, setPrice] = useState(String(product?.price ?? ''))
  const [toTeam, setToTeam] = useState(String(product?.to_team_amount ?? ''))
  const [active, setActive] = useState(product?.active ?? true)
  const [sortOrder, setSortOrder] = useState(String(product?.sort_order ?? nextSort))
  const [stock, setStock] = useState(product?.stock === null || product?.stock === undefined ? '' : String(product.stock))
  const stockNumber = stock.trim() === '' ? null : Number(stock)
  const ask = useConfirm()
  const formId = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (Number(toTeam) > Number(price)) return setError('Beløpet til laget kan ikke være høyere enn prisen')
    if (stockNumber !== null && (!Number.isInteger(stockNumber) || stockNumber < 0)) return setError('Skriv antallet på lager som et helt tall')
    if (stockNumber !== null && stockNumber < sold) return setError(`Det er allerede solgt ${sold}, så lageret kan ikke være lavere`)
    setBusy(true)
    const row = {
      campaign_id: campaignId,
      name: name.trim(),
      description: description.trim(),
      price: Number(price.replace(',', '.')),
      to_team_amount: Number(toTeam.replace(',', '.')) || 0,
      active,
      sort_order: Number(sortOrder) || 0,
      stock: stockNumber,
    }
    const { error } = product
      ? await supabase.from('products').update(row).eq('id', product.id)
      : await supabase.from('products').insert(row)
    setBusy(false)
    if (error) return setError(errorText(error))
    await onDone()
  }

  async function remove() {
    if (!product || !(await ask(`Slette ${product.name}? Det går ikke hvis noen har bestilt varen; skjul den i stedet`, { confirm: 'Slett', danger: true }))) return
    const paths = (product.product_images ?? []).flatMap((i) => [i.storage_path, i.thumb_path])
    const { error } = await supabase.from('products').delete().eq('id', product.id)
    if (error) return setError('Kan ikke slette en vare som er bestilt. Fjern haken for «Vises» i stedet')
    if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths)
    await onDone()
  }

  return (
    <Card className="space-y-3 ring-2 ring-brand">
      <form
        id={formId}
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Navn">
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Kaffe, 500 g" />
        </Field>
        <RichTextEditor label="Kort beskrivelse" value={description} onChange={setDescription} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pris (kr)">
            <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </Field>
          <Field label="Til laget per stk (kr)">
            <Input inputMode="decimal" value={toTeam} onChange={(e) => setToTeam(e.target.value)} />
          </Field>
        </div>
        <Field
          label="Antall på lager (valgfritt)"
          hint={
            stockNumber === null || Number.isNaN(stockNumber)
              ? `Tomt = ingen grense. Solgt så langt: ${sold}`
              : `Totalt tilgjengelig, også de som er solgt. Solgt så langt: ${sold}, igjen: ${Math.max(0, stockNumber - sold)}`
          }
        >
          <Input type="number" inputMode="numeric" min={sold} step={1} value={stock} onChange={(e) => setStock(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 items-end gap-3">
          <Field label="Rekkefølge">
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </Field>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Vises
          </label>
        </div>
      </form>
      {product ? (
        <ImageManager product={product} reload={reload} />
      ) : (
        <p className="text-sm text-muted">Lagre varen først, så kan du legge til bilder</p>
      )}
      {/* Below the pictures: the buttons belong to the form above through form={formId} */}
      <ErrorBox>{error}</ErrorBox>
      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <Button type="submit" form={formId} disabled={busy}>
          {busy ? 'Lagrer …' : 'Lagre'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => void onDone()}>
          Avbryt
        </Button>
        {product && (
          <Button type="button" variant="danger" className="ml-auto" onClick={() => void remove()}>
            Slett
          </Button>
        )}
      </div>
    </Card>
  )
}

function ImageManager({ product, reload }: { product: Product; reload: () => Promise<void> }) {
  const images = product.product_images ?? []
  const ask = useConfirm()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setError('')
    setBusy(true)
    try {
      let sort = images.length
      for (const file of Array.from(files)) {
        const { main, thumb } = await prepareProductImage(file)
        const base = `${product.campaign_id}/${product.id}/${newId()}`
        const mainPath = `${base}.${main.ext}`
        const thumbPath = `${base}-thumb.${thumb.ext}`
        const opts = (r: typeof main) => ({ contentType: r.ext === 'webp' ? 'image/webp' : 'image/jpeg', upsert: false })
        const a = await supabase.storage.from(IMAGE_BUCKET).upload(mainPath, main.blob, opts(main))
        if (a.error) throw a.error
        const b = await supabase.storage.from(IMAGE_BUCKET).upload(thumbPath, thumb.blob, opts(thumb))
        if (b.error) throw b.error
        const { error } = await supabase.from('product_images').insert({
          product_id: product.id,
          storage_path: mainPath,
          thumb_path: thumbPath,
          width: main.width,
          height: main.height,
          sort_order: sort++,
        })
        if (error) throw error
      }
    } catch (e) {
      setError(errorText(e))
    }
    setBusy(false)
    await reload()
  }

  async function makeMain(image: ProductImageRow) {
    const ordered = [image, ...images.filter((i) => i.id !== image.id)]
    await Promise.all(ordered.map((img, i) => supabase.from('product_images').update({ sort_order: i }).eq('id', img.id)))
    await reload()
  }

  async function move(image: ProductImageRow, delta: number) {
    const list = [...images]
    const from = list.findIndex((i) => i.id === image.id)
    const to = from + delta
    if (to < 0 || to >= list.length) return
    list.splice(to, 0, list.splice(from, 1)[0])
    await Promise.all(list.map((img, i) => supabase.from('product_images').update({ sort_order: i }).eq('id', img.id)))
    await reload()
  }

  async function remove(image: ProductImageRow) {
    if (!(await ask('Slette bildet?', { confirm: 'Slett', danger: true }))) return
    await supabase.from('product_images').delete().eq('id', image.id)
    await supabase.storage.from(IMAGE_BUCKET).remove([image.storage_path, image.thumb_path])
    await reload()
  }

  return (
    <div className="space-y-2 border-t border-line pt-3">
      <h3 className="font-semibold">Bilder</h3>
      <p className="text-xs text-muted">
        Første bilde er hovedbildet. Bruk egne bilder eller bilder leverandøren lar oss bruke
        {images.length === 0 && defaultPictureFor(product.name) && ' Uten eget bilde brukes et standardbilde'}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {images.map((img, i) => (
          <div key={img.id} className="space-y-1">
            <img src={imageUrl(img.thumb_path)} alt="" className="aspect-square w-full rounded-lg object-cover" />
            <div className="flex justify-between text-sm">
              <button type="button" onClick={() => void move(img, -1)} disabled={i === 0} aria-label="Flytt til venstre" className="px-1 disabled:opacity-30">
                ←
              </button>
              {i === 0 ? (
                <span className="text-xs text-muted">Hoved</span>
              ) : (
                <button type="button" className="text-xs text-brand" onClick={() => void makeMain(img)}>
                  Gjør til hoved
                </button>
              )}
              <button type="button" onClick={() => void move(img, 1)} disabled={i === images.length - 1} aria-label="Flytt til høyre" className="px-1 disabled:opacity-30">
                →
              </button>
            </div>
            <button type="button" className="w-full text-xs text-red-700" onClick={() => void remove(img)}>
              Slett
            </button>
          </div>
        ))}
      </div>
      <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-brand-soft px-4 font-semibold text-brand-dark">
        {busy ? 'Laster opp …' : '+ Legg til bilde'}
        <input type="file" accept="image/*" multiple className="hidden" disabled={busy} onChange={(e) => void upload(e.target.files)} />
      </label>
      <ErrorBox>{error}</ErrorBox>
    </div>
  )
}
