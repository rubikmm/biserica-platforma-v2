import { acum, id, ruleaza } from '@xc/db'

export interface EmailDeTrimis {
  catre: string
  subiect: string
  text: string
  html?: string
  /** Linkul continut in mesaj — se pastreaza in jurnal DOAR pe adaptorul sandbox (dev). */
  link: string
  correlationId: string
}

export interface RezultatTrimitere {
  /** `true` doar daca scrisoarea chiar a plecat catre un destinatar real. */
  livrat: boolean
  detaliu: string
}

export interface AdaptorEmail {
  readonly nume: string
  trimite(mesaj: EmailDeTrimis): Promise<RezultatTrimitere>
}

/**
 * Adaptorul de dezvoltare: NU trimite nimic in exterior. Scrie scrisoarea (cu link cu tot) in
 * `emails_iesire`, de unde interfata o poate arata. Singurul adaptor in care linkul ajunge
 * in baza de date.
 */
export class EmailSandbox implements AdaptorEmail {
  readonly nume = 'sandbox'

  constructor(private readonly db: D1Database) {}

  async trimite(mesaj: EmailDeTrimis): Promise<RezultatTrimitere> {
    const rezultat = { livrat: false, detaliu: 'inregistrat in sandbox, nu a plecat nimic in exterior' }
    await jurnalizeaza(this.db, mesaj, this.nume, rezultat, mesaj.link)
    return rezultat
  }
}

/**
 * Cloudflare Email Service, prin binding-ul `send_email` (`POSTA`). Acelasi drum pe care
 * merge deja intrarea in platforma V1: 3.000 de scrisori pe luna incluse in planul Workers
 * platit, DKIM semnat de Cloudflare, nicio parola de tinut.
 *
 * Expeditorul e pe `posta.sfantul-ilie.ro` — subdomeniul imbarcat la Email Service —
 * nu pe apex, ca SPF-ul mailului obisnuit al parohiei sa ramana neatins.
 *
 * Erorile Cloudflare vin cu cod (`E_SENDER_NOT_VERIFIED`, `E_RATE_LIMIT_EXCEEDED`, ...);
 * il pastram in mesaj, ca jurnalul sa spuna singur ce e de facut.
 */
export class EmailCloudflare implements AdaptorEmail {
  readonly nume = 'cloudflare'

  constructor(
    private readonly db: D1Database,
    private readonly legatura: SendEmail,
    private readonly deLa: string,
    private readonly numeDeLa: string,
  ) {}

  async trimite(mesaj: EmailDeTrimis): Promise<RezultatTrimitere> {
    let rezultat: RezultatTrimitere
    try {
      const raspuns = await this.legatura.send({
        to: mesaj.catre,
        from: { name: this.numeDeLa, email: this.deLa },
        subject: mesaj.subiect,
        text: mesaj.text,
        ...(mesaj.html ? { html: mesaj.html } : {}),
        // Ca robotii de „sunt in concediu" sa nu raspunda la un link de intrare.
        headers: { 'Auto-Submitted': 'auto-generated' },
      })
      rezultat = { livrat: true, detaliu: `trimis, messageId=${raspuns.messageId}` }
    } catch (e) {
      const cod = (e as { code?: string }).code
      rezultat = {
        livrat: false,
        detaliu: `cloudflare: ${cod ? `${cod} — ` : ''}${e instanceof Error ? e.message : String(e)}`,
      }
    }
    // Linkul NU se scrie in jurnal pe drumul real — ar fi o a doua copie a secretului.
    await jurnalizeaza(this.db, mesaj, this.nume, rezultat, null)
    return rezultat
  }
}

async function jurnalizeaza(
  db: D1Database,
  mesaj: EmailDeTrimis,
  adaptor: string,
  rezultat: RezultatTrimitere,
  link: string | null,
): Promise<void> {
  await ruleaza(
    db,
    `INSERT INTO emails_iesire (id, catre, subiect, link, adaptor, livrat, detaliu, correlation_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id(),
      mesaj.catre,
      mesaj.subiect,
      link,
      adaptor,
      rezultat.livrat ? 1 : 0,
      rezultat.detaliu.slice(0, 500),
      mesaj.correlationId,
      acum(),
    ],
  )
}

// ---------------------------------------------------------------------------
// Scrisoarea de intrare
// ---------------------------------------------------------------------------

export function scrisoareaDeIntrare(link: string, contNou: boolean): { text: string; html: string } {
  const titlu = contNou ? 'Bine ai venit' : 'Bună'
  const rost = contNou
    ? 'Ca să-ți deschidem contul în platforma parohiei, confirmă adresa apăsând linkul de mai jos:'
    : 'Cineva a cerut intrarea în platforma parohiei cu adresa aceasta. Dacă tu ai fost, apasă linkul:'

  const text = [
    `${titlu},`,
    '',
    rost,
    '',
    link,
    '',
    'Linkul e valabil 15 minute și poate fi folosit o singură dată.',
    'Dacă nu ai cerut tu intrarea, ignoră mesajul — fără această confirmare nu se întâmplă nimic.',
  ].join('\n')

  // Tabele si `color-scheme: light only`: ce s-a invatat in V1 despre cum se randeaza o
  // scrisoare pe telefoane si in clientii cu tema intunecata.
  const html = `<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><meta name="color-scheme" content="light only">
<title>${titlu}</title></head>
<body style="margin:0;background:#f6f5f3;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#23201c">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #e3ded7;border-radius:12px">
<tr><td style="padding:28px 28px 8px;font-size:20px;font-weight:600">${titlu},</td></tr>
<tr><td style="padding:0 28px 20px;font-size:16px;line-height:1.55">${rost}</td></tr>
<tr><td style="padding:0 28px 24px" align="center">
<a href="${link}" style="display:inline-block;background:#7a5c3e;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px">${contNou ? 'Deschide contul' : 'Intră în platformă'}</a>
</td></tr>
<tr><td style="padding:0 28px 28px;font-size:13px;line-height:1.5;color:#6b645c">Linkul e valabil 15 minute și poate fi folosit o singură dată.<br>Dacă nu ai cerut tu intrarea, ignoră mesajul — fără această confirmare nu se întâmplă nimic.</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px"><tr><td style="padding:16px 8px;font-size:12px;color:#6b645c;text-align:center">Biserica Sfântul Ilie – Hanul Colței</td></tr></table>
</td></tr></table>
</body></html>`

  return { text, html }
}
