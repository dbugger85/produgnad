import { useState } from 'react'
import { BagIcon, Badge, Button, Card, ErrorBox, Field, Input, TextArea } from '../../components/ui'
import { defaultPictureFor, defaultPictureUrl } from '../../lib/defaultPictures'
import { errorText } from '../../lib/errors'
import { kr } from '../../lib/format'
import { newId } from '../../lib/id'
import { prepareProductImage } from '../../lib/images'
import { IMAGE_BUCKET, imageUrl, supabase } from '../../lib/supabase'
import type { Product, ProductImageRow } from '../../lib/types'
import { useConfirm } from '../../components/Confirm'

export function ProductsTab({
  campaignId,
  products,
  reload,
}: {
  campaignId: string
  products: Product[]
  reload: () => Promise<void>
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(products.length === 0 ? 'new' : null)

  return (
    <div className="space-y-3">
      {products.map((p) =>
        editing === p.id ? (
          <ProductForm
            key={p.id}
            campaignId={campaignId}
            product={p}
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
              <button type="button" className="mt-1 text-sm font-semibold text-brand" onClick={() => setEditing(p.id)}>
                Endre
              </button>
            </div>
          </Card>
        ),
      )}
      {editing === 'new' ? (
        <ProductForm
          campaignId={campaignId}
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
  nextSort,
  onDone,
  reload,
}: {
  campaignId: string
  product?: Product
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
  const ask = useConfirm()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (Number(toTeam) > Number(price)) return setError('Beløpet til laget kan ikke være høyere enn prisen.')
    setBusy(true)
    const row = {
      campaign_id: campaignId,
      name: name.trim(),
      description: description.trim(),
      price: Number(price.replace(',', '.')),
      to_team_amount: Number(toTeam.replace(',', '.')) || 0,
      active,
      sort_order: Number(sortOrder) || 0,
    }
    const { error } = product
      ? await supabase.from('products').update(row).eq('id', product.id)
      : await supabase.from('products').insert(row)
    setBusy(false)
    if (error) return setError(errorText(error))
    await onDone()
  }

  async function remove() {
    if (!product || !(await ask(`Slette ${product.name}? Det går ikke hvis noen har bestilt varen; skjul den i stedet.`, { confirm: 'Slett', danger: true }))) return
    const paths = (product.product_images ?? []).flatMap((i) => [i.storage_path, i.thumb_path])
    const { error } = await supabase.from('products').delete().eq('id', product.id)
    if (error) return setError('Kan ikke slette en vare som er bestilt. Fjern haken for «Vises» i stedet.')
    if (paths.length) await supabase.storage.from(IMAGE_BUCKET).remove(paths)
    await onDone()
  }

  return (
    <Card className="space-y-3 ring-2 ring-brand">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <Field label="Navn">
          <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Kaffe, 500 g" />
        </Field>
        <Field label="Kort beskrivelse">
          <TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pris (kr)">
            <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </Field>
          <Field label="Til laget per stk (kr)">
            <Input inputMode="decimal" value={toTeam} onChange={(e) => setToTeam(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 items-end gap-3">
          <Field label="Rekkefølge">
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </Field>
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Vises
          </label>
        </div>
        <ErrorBox>{error}</ErrorBox>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'Lagrer …' : 'Lagre'}
          </Button>
          <Button variant="secondary" onClick={() => void onDone()}>
            Avbryt
          </Button>
          {product && (
            <Button variant="danger" className="ml-auto" onClick={() => void remove()}>
              Slett
            </Button>
          )}
        </div>
      </form>
      {product ? (
        <ImageManager product={product} reload={reload} />
      ) : (
        <p className="text-sm text-muted">Lagre varen først, så kan du legge til bilder.</p>
      )}
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
        Første bilde er hovedbildet. Bruk egne bilder eller bilder leverandøren lar oss bruke.
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
