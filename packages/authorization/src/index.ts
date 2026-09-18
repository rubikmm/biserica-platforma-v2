import {
  aplicatiaAdministrabila,
  Decizie,
  SCOPE_GLOBAL,
  type Permisiune,
  type Principal,
  type Scope,
} from '@xc/contracts'

export interface ServiciuAutorizare {
  fetch: typeof fetch
}

export class EroareAutorizare extends Error {
  constructor(
    readonly permission: Permisiune,
    readonly scope: string,
    readonly reason: string,
  ) {
    super(`acces refuzat: ${permission} pe ${scope}`)
    this.name = 'EroareAutorizare'
  }
}

/**
 * Clientul de politici. Aplicatiile NU verifica roluri direct — intreaba serviciul central,
 * si primesc o decizie motivata, care poate fi legata de o intrare de audit.
 */
export class ClientAutorizare {
  constructor(
    private readonly serviciu: ServiciuAutorizare,
    private readonly correlationId: string,
  ) {}

  async can(
    principal: Principal,
    permission: Permisiune,
    resourceScope: Scope,
  ): Promise<Decizie> {
    const raspuns = await this.serviciu.fetch('https://authz.intern/can', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        principal,
        permission,
        resourceScope,
        correlationId: this.correlationId,
      }),
    })

    if (!raspuns.ok) {
      // Indisponibilitatea serviciului de politici inseamna REFUZ, nu permisiune.
      return { allowed: false, reason: `authorization-worker a raspuns ${raspuns.status}`, matchedScopes: [] }
    }

    const parsat = Decizie.safeParse(await raspuns.json())
    if (!parsat.success) {
      return { allowed: false, reason: 'raspuns invalid de la authorization-worker', matchedScopes: [] }
    }
    return parsat.data
  }

  async require(
    principal: Principal,
    permission: Permisiune,
    resourceScope: Scope,
  ): Promise<void> {
    const decizie = await this.can(principal, permission, resourceScope)
    if (!decizie.allowed) {
      throw new EroareAutorizare(permission, resourceScope, decizie.reason)
    }
  }
}

/**
 * E OMUL ADMINISTRATORUL ACESTEI APLICATII? Un singur rand, pentru toate aplicatiile.
 *
 * ⚠️ De ce exista (user, 18.09.2026): pana atunci aplicatiile isi citeau adminul din ROL
 * (`sesiune.roles.some(r => r.role === 'admin')`), deci nimeni nu putea fi facut administrator NUMAI
 * intr-o aplicatie — trebuia rol de admin pe toata platforma. Acum raspunsul vine de la autorizare,
 * pe cheia aplicatiei din registrul `APLICATII_ADMINISTRABILE`, si atunci:
 *   - adminul global si super-adminul rămân ce erau (cheile vin cu rolul, implicit);
 *   - un om cu grant punctual capata panoul APLICATIEI, si numai al ei;
 *   - masca „vezi ca" coboara singura, fiindca trece prin autorizare (citit din roluri, un
 *     super-admin „ca utilizator" ar fi rămas admin — adica previzualizarea ar fi mintit).
 *
 * ⚠️ NU e acelasi lucru cu randul „Administrare" din meniul contului: acela duce la panoul
 * PLATFORMEI si rămâne al rolului global. Un administrator de Program n-are ce face acolo.
 *
 * Fara principal (om neintrat) si fara serviciu, raspunsul e NU: indisponibilitatea inseamna refuz.
 */
export async function eAdminulAplicatiei(
  serviciu: ServiciuAutorizare | undefined,
  correlationId: string,
  principal: Principal | null,
  codAplicatie: string,
): Promise<boolean> {
  if (!serviciu || !principal) return false
  const app = aplicatiaAdministrabila(codAplicatie)
  if (!app) return false
  const decizie = await new ClientAutorizare(serviciu, correlationId).can(
    principal,
    app.cheieAdmin,
    SCOPE_GLOBAL,
  )
  return decizie.allowed
}
