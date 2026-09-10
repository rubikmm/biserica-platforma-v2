/**
 * Drumul unei scrisori: Cloudflare Email Service prin binding-ul `send_email`, sau sandbox-ul
 * care nu trimite nimic. Un singur loc pentru amandoua — serviciile (identitate, comunicare) il
 * folosesc, nu-si scriu fiecare adaptorul lui.
 *
 * Expeditorul e pe `posta.sfantul-ilie.ro` (subdomeniul imbarcat la Email Service), nu pe apex,
 * ca SPF-ul mailului obisnuit al parohiei sa ramana neatins (decizie V1, 8 sept. 2026).
 */

export interface Scrisoare {
  catre: string
  subiect: string
  text: string
  html?: string
  /** Adresa de raspuns, cand nu e cea a expeditorului. */
  raspundeLa?: string
  correlationId: string
}

export interface RezultatScrisoare {
  /** `true` doar daca scrisoarea chiar a plecat catre un destinatar real. */
  livrat: boolean
  /** 'sent' | 'simulated' | 'failed' — vocabularul livrarilor din comunicare. */
  stare: 'sent' | 'simulated' | 'failed'
  detaliu: string
}

export interface Postas {
  readonly nume: string
  trimite(scrisoare: Scrisoare): Promise<RezultatScrisoare>
}

/** Sandbox: nu pleaca nimic in exterior. */
export class PostasSandbox implements Postas {
  readonly nume = 'email-sandbox'
  async trimite(s: Scrisoare): Promise<RezultatScrisoare> {
    return { livrat: false, stare: 'simulated', detaliu: `email simulat catre ${s.catre}` }
  }
}

/**
 * Cloudflare Email Service. Erorile vin cu cod (`E_SENDER_NOT_VERIFIED`, `E_RATE_LIMIT_EXCEEDED`…);
 * il pastram in detaliu, ca jurnalul sa spuna singur ce e de facut.
 */
export class PostasCloudflare implements Postas {
  readonly nume = 'cloudflare-email'
  constructor(
    private readonly legatura: SendEmail,
    private readonly deLa: string,
    private readonly numeDeLa: string,
  ) {}

  async trimite(s: Scrisoare): Promise<RezultatScrisoare> {
    try {
      const raspuns = await this.legatura.send({
        to: s.catre,
        from: { name: this.numeDeLa, email: this.deLa },
        subject: s.subiect,
        text: s.text,
        ...(s.html ? { html: s.html } : {}),
        ...(s.raspundeLa ? { replyTo: s.raspundeLa } : {}),
        headers: { 'Auto-Submitted': 'auto-generated' },
      })
      return { livrat: true, stare: 'sent', detaliu: `trimis, messageId=${raspuns.messageId}` }
    } catch (e) {
      const cod = (e as { code?: string }).code
      return { livrat: false, stare: 'failed', detaliu: `cloudflare: ${cod ? `${cod} — ` : ''}${e instanceof Error ? e.message : String(e)}` }
    }
  }
}

export interface MediuPosta {
  POSTA?: SendEmail
  POSTA_DE_LA?: string
  POSTA_NUME?: string
}

/**
 * Alege drumul: real doar cand comutatorul e „da" SI binding-ul exista. Altfel sandbox — si
 * spune de ce, ca sa nu se creada ca a plecat ceva.
 */
export function alegePostasul(env: MediuPosta, livrareReala: boolean, avertizeaza: (mesaj: string) => void = () => {}): Postas {
  if (livrareReala) {
    if (env.POSTA && typeof env.POSTA.send === 'function') {
      return new PostasCloudflare(env.POSTA, env.POSTA_DE_LA ?? 'no-reply@posta.sfantul-ilie.ro', env.POSTA_NUME ?? 'Biserica Sfântul Ilie – Hanul Colței')
    }
    avertizeaza('livrarea reala e pornita, dar binding-ul POSTA lipseste; folosesc sandbox')
  }
  return new PostasSandbox()
}

/** Text simplu din HTML, pentru partea `text/plain` a scrisorii. */
export function textDinHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
