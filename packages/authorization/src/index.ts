import { Decizie, type Permisiune, type Principal, type Scope } from '@xc/contracts'

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
