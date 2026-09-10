import { z } from 'zod'
import { Logger, correlationId } from '@xc/observability'

export interface Env {
  FISIERE: R2Bucket
  MEDIU: string
}

function json(date: unknown, status = 200): Response {
  return new Response(JSON.stringify(date), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/**
 * Cheile sunt mereu prefixate cu domeniul proprietar (`program/…`, `buletin/…`), ca sa se
 * vada cui apartine fisierul si sa se poata face curatenie pe domeniu.
 */
const Cheie = z
  .string()
  .regex(/^[a-z0-9-]+\/[a-zA-Z0-9._/-]{1,200}$/, 'cheie invalida: astept `<domeniu>/<cale>`')

const CerereIncarcare = z.object({
  key: Cheie,
  contentType: z.string().min(1).default('application/octet-stream'),
})

const CerereCitire = z.object({ key: Cheie })

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cid = correlationId(req)
    const log = new Logger({ service: 'media-worker', correlationId: cid })
    const url = new URL(req.url)

    try {
      // Descarcare directa, pe GET, pentru fisierele publice ale aplicatiilor.
      if (req.method === 'GET' && url.pathname.startsWith('/fisier/')) {
        const cheie = decodeURIComponent(url.pathname.slice('/fisier/'.length))
        const parsat = Cheie.safeParse(cheie)
        if (!parsat.success) return json({ eroare: 'cheie invalida' }, 400)

        const obiect = await env.FISIERE.get(parsat.data)
        if (!obiect) return json({ eroare: 'inexistent' }, 404)

        return new Response(obiect.body, {
          headers: {
            'content-type': obiect.httpMetadata?.contentType ?? 'application/octet-stream',
            'cache-control': 'public, max-age=300',
            etag: obiect.httpEtag,
          },
        })
      }

      if (req.method !== 'POST') return json({ eroare: 'metoda nepermisa' }, 405)

      if (url.pathname === '/incarca') {
        // Apelantul intern a verificat deja permisiunea; aici doar scriem.
        const meta = CerereIncarcare.parse(
          JSON.parse(req.headers.get('x-meta') ?? '{}'),
        )
        if (!req.body) return json({ eroare: 'corp lipsa' }, 400)

        await env.FISIERE.put(meta.key, req.body, {
          httpMetadata: { contentType: meta.contentType },
        })
        log.info('fisier incarcat', { key: meta.key })
        return json({ ok: true, key: meta.key })
      }

      if (url.pathname === '/sterge') {
        const date = CerereCitire.parse(await req.json())
        await env.FISIERE.delete(date.key)
        return json({ ok: true })
      }

      if (url.pathname === '/lista') {
        const date = z.object({ prefix: z.string().default('') }).parse(await req.json())
        const rezultat = await env.FISIERE.list({ prefix: date.prefix, limit: 100 })
        return json({
          fisiere: rezultat.objects.map((o) => ({
            key: o.key,
            size: o.size,
            uploaded: o.uploaded.toISOString(),
          })),
        })
      }

      return json({ eroare: 'ruta necunoscuta' }, 404)
    } catch (e) {
      if (e instanceof z.ZodError) {
        return json({ eroare: 'date invalide', detalii: e.issues.map((i) => i.message) }, 400)
      }
      log.error('eroare neasteptata', { eroare: e instanceof Error ? e.message : String(e) })
      return json({ eroare: 'eroare interna' }, 500)
    }
  },
}
