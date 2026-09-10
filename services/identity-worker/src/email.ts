import { acum, id, ruleaza } from '@xc/db'

export interface EmailDeTrimis {
  catre: string
  subiect: string
  text: string
  html?: string
  /** Secretul din mesaj (azi: codul de sase cifre) — se pastreaza in jurnal DOAR pe sandbox (dev). */
  secret: string
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
 * Adaptorul de dezvoltare: NU trimite nimic in exterior. Scrie scrisoarea (cu cod cu tot) in
 * `emails_iesire`, de unde interfata o poate arata. Singurul adaptor in care codul ajunge
 * in baza de date.
 */
export class EmailSandbox implements AdaptorEmail {
  readonly nume = 'sandbox'

  constructor(private readonly db: D1Database) {}

  async trimite(mesaj: EmailDeTrimis): Promise<RezultatTrimitere> {
    const rezultat = { livrat: false, detaliu: 'inregistrat in sandbox, nu a plecat nimic in exterior' }
    await jurnalizeaza(this.db, mesaj, this.nume, rezultat, mesaj.secret)
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
    // Codul NU se scrie in jurnal pe drumul real — ar fi o a doua copie a secretului.
    await jurnalizeaza(this.db, mesaj, this.nume, rezultat, null)
    return rezultat
  }
}

async function jurnalizeaza(
  db: D1Database,
  mesaj: EmailDeTrimis,
  adaptor: string,
  rezultat: RezultatTrimitere,
  secret: string | null,
): Promise<void> {
  await ruleaza(
    db,
    `INSERT INTO emails_iesire (id, catre, subiect, secret_debug, adaptor, livrat, detaliu, correlation_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id(),
      mesaj.catre,
      mesaj.subiect,
      secret,
      adaptor,
      rezultat.livrat ? 1 : 0,
      rezultat.detaliu.slice(0, 500),
      mesaj.correlationId,
      acum(),
    ],
  )
}

// ---------------------------------------------------------------------------
// Scrisoarea cu codul de intrare
// ---------------------------------------------------------------------------

/** Cum se scrie codul pentru ochi: `123 456`. Aceeasi taietura 3-3 ca in cele sase casute. */
export function codFrumos(cod: string): string {
  return `${cod.slice(0, 3)} ${cod.slice(3)}`
}

/**
 * Scrisoarea cu cele sase cifre — textele si forma din V1 (subiectul incepe cu codul, ca sa se
 * vada in lista de mesaje fara sa deschizi scrisoarea; cifrele mari, la mijloc; „Detalii" si
 * „De ce primesc acest email?"). Niciun link: nu mai exista drum de intrare prin apasare.
 */
export function scrisoareaCodului(
  catre: string,
  cod: string,
  contNou: boolean,
): { subiect: string; text: string; html: string } {
  const frumos = codFrumos(cod)
  const subiect = `${frumos} — codul tău de intrare`
  const rost = contNou
    ? `Ai cerut să-ți deschizi un cont în platforma parohiei cu adresa ${catre}. Scrie codul de mai jos ca să continui:`
    : `Ai cerut să intri în cont cu adresa ${catre}. Scrie codul de mai jos ca să continui:`

  const text = [
    contNou ? 'Codul tău de intrare — cont nou' : 'Codul tău de intrare',
    '',
    rost,
    '',
    `    ${frumos}`,
    '',
    'Codul este bun zece minute și se folosește o singură dată.',
    '',
    'De ce primesc acest email?',
    `Cineva a cerut un cod de intrare pentru adresa ${catre}. Dacă nu ai fost tu, nu trebuie`,
    'să faci nimic: fără cod nu intră nimeni în contul tău.',
    '',
    '— Biserica Sfântul Ilie – Hanul Colței',
  ].join('\n')

  // Tabele si `color-scheme: light only`: ce s-a invatat in V1 despre cum se randeaza o
  // scrisoare pe telefoane si in clientii cu tema intunecata.
  const html = `<!doctype html>
<html lang="ro"><head><meta charset="utf-8"><meta name="color-scheme" content="light only">
<title>${esc(subiect)}</title></head>
<body style="margin:0;background:#f6f5f3;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#23201c">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">Codul tău: ${esc(frumos)}. Este bun zece minute.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #e3ded7;border-radius:12px">
<tr><td style="padding:28px 28px 8px;font-size:20px;font-weight:600">Codul tău de intrare</td></tr>
<tr><td style="padding:0 28px 4px;font-size:16px;line-height:1.55">${esc(rost)}</td></tr>
<tr><td align="center" style="padding:16px 28px;font-size:32px;line-height:40px;font-weight:600;letter-spacing:4px;color:#000">${esc(frumos)}</td></tr>
<tr><td style="padding:0 28px 24px;font-size:13px;line-height:1.5;color:#6b645c">Codul este bun zece minute și se folosește o singură dată.</td></tr>
<tr><td style="padding:0 28px 28px;font-size:13px;line-height:1.5;color:#6b645c"><b style="color:#23201c">De ce primesc acest email?</b><br>Cineva a cerut un cod de intrare pentru adresa ${esc(catre)}. Dacă nu ai fost tu, nu trebuie să faci nimic: fără cod nu intră nimeni în contul tău.</td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px"><tr><td style="padding:16px 8px;font-size:12px;color:#6b645c;text-align:center">Biserica Sfântul Ilie – Hanul Colței</td></tr></table>
</td></tr></table>
</body></html>`

  return { subiect, text, html }
}

/** Scapare minima pentru HTML-ul scrisorii — adresa vine de la om. */
function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
}
