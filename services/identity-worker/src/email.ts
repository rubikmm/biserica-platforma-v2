import { acum, id, ruleaza } from '@xc/db'

export interface EmailDeTrimis {
  catre: string
  subiect: string
  text: string
  /** Linkul continut in mesaj — il pastram separat ca sa-l putem arata in dev, fara SMTP. */
  link: string
  correlationId: string
}

export interface AdaptorEmail {
  readonly nume: string
  /** `true` doar daca mesajul chiar a plecat catre un destinatar real. */
  trimite(mesaj: EmailDeTrimis): Promise<{ livrat: boolean; detaliu: string }>
}

/**
 * Adaptorul implicit: NU trimite nimic in exterior. Scrie mesajul in `emails_iesire` si il
 * logheaza. E singurul adaptor activ atat timp cat nu exista un furnizor configurat — asa
 * fluxul se poate testa cap-coada fara sa plece un email real catre cineva.
 */
export class EmailSandbox implements AdaptorEmail {
  readonly nume = 'sandbox'

  constructor(private readonly db: D1Database) {}

  async trimite(mesaj: EmailDeTrimis): Promise<{ livrat: boolean; detaliu: string }> {
    await ruleaza(
      this.db,
      `INSERT INTO emails_iesire (id, catre, subiect, text, link, correlation_id, created_at, adaptor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id(), mesaj.catre, mesaj.subiect, mesaj.text, mesaj.link, mesaj.correlationId, acum(), this.nume],
    )
    return { livrat: false, detaliu: 'inregistrat in sandbox, nu a plecat nimic in exterior' }
  }
}

/**
 * Scheletul pentru un furnizor real (Resend, Postmark, SMTP prin HTTP...). Nu e cablat nicaieri
 * si nu are cheie: se activeaza cand utilizatorul pune un secret si schimba `ADAPTOR_EMAIL`.
 * Pana atunci ramane aici doar ca sa fie evident unde se intra.
 */
export class EmailFurnizorHttp implements AdaptorEmail {
  readonly nume = 'http'

  constructor(
    private readonly urlApi: string,
    private readonly cheie: string,
    private readonly expeditor: string,
  ) {}

  async trimite(mesaj: EmailDeTrimis): Promise<{ livrat: boolean; detaliu: string }> {
    const raspuns = await fetch(this.urlApi, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.cheie}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.expeditor,
        to: [mesaj.catre],
        subject: mesaj.subiect,
        text: mesaj.text,
      }),
    })
    if (!raspuns.ok) {
      return { livrat: false, detaliu: `furnizorul a raspuns ${raspuns.status}` }
    }
    return { livrat: true, detaliu: 'trimis' }
  }
}

export function textConfirmareLogin(link: string): string {
  return [
    'Bună,',
    '',
    'Cineva a cerut autentificarea în platforma parohiei cu adresa aceasta.',
    'Dacă tu ai fost, confirmă apăsând linkul de mai jos:',
    '',
    link,
    '',
    'Linkul e valabil 15 minute și poate fi folosit o singură dată.',
    'Dacă nu ai cerut tu autentificarea, ignoră mesajul — fără această confirmare nu se creează nicio sesiune.',
  ].join('\n')
}

export function textVerificareEmail(link: string): string {
  return [
    'Bine ai venit,',
    '',
    'Confirmă adresa de email apăsând linkul de mai jos:',
    '',
    link,
    '',
    'Linkul e valabil 24 de ore.',
  ].join('\n')
}
