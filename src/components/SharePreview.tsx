import { buildLinkPreview, type PreviewInput } from '../lib/linkPreview'
import { imageUrl } from '../lib/supabase'

/**
 * How the parent's link looks when shared in Messenger, WhatsApp or an SMS app.
 * `input` must hold what friends' apps can see (public data), so it matches the real preview.
 */
export function SharePreview({ input, link }: { input: PreviewInput; link: string }) {
  const p = buildLinkPreview(input)
  const src = !p.image ? '/og-default.png' : p.image.kind === 'upload' ? imageUrl(p.image.path) : p.image.path
  return (
    <figure className="space-y-1">
      <div className="ml-auto max-w-[300px] overflow-hidden rounded-[18px] rounded-br-md bg-[#0b5cff] text-white shadow-card">
        <p className="break-all px-3 py-2 text-[13px]">{link}</p>
        <div className="bg-white text-ink">
          <img src={src} alt="" className="block aspect-[1.91/1] w-full object-cover" />
          <div className="space-y-0.5 px-3 py-2">
            <p className="text-[11px] text-muted">{new URL(link).host}</p>
            <p className="text-sm leading-snug font-bold">{p.title}</p>
            <p className="line-clamp-3 text-xs text-muted">{p.description}</p>
          </div>
        </div>
      </div>
      <figcaption className="text-right text-xs text-muted">Slik ser lenken ut når den deles</figcaption>
    </figure>
  )
}
