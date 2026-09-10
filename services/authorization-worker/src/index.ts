import { z } from 'zod'
import {
  CerereAutorizare,
  PERMISIUNI_IMPLICITE,
  Rol,
  Scope,
  type AtribuireRol,
  type Decizie,
  type Permisiune,
  scopeAcopera,
} from '@xc/contracts'
import { acum, id, ruleaza, toate } from '@xc/db'
import { Logger, correlationId } from '@xc/observability'

export interface Env {
  DB: D1Database
  MEDIU: string
}

const SERVICIU = 'authorization-worker'

function json(date: unknown, status = 200): Response {
  return new Response(JSON.stringify(date), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

interface RandRol {
  role: string
  scope: string
}

async function roluri(db: D1Database, userId: string): Promise<AtribuireRol[]> {
  const randuri = await toate<RandRol>(
    db,
    `SELECT role, scope FROM role_assignments WHERE user_id = ? AND revoked_at IS NULL`,
    [userId],
  )
  const iesire: AtribuireRol[] = []
  for (const rand of randuri) {
    const rol = Rol.safeParse(rand.role)
    const scope = Scope.safeParse(rand.scope)
    if (rol.success && scope.success) iesire.push({ role: rol.data, scope: scope.data })
  }
  return iesire
}

interface RandGrant {
  permission: string
  scope: string
}

/** Permisiuni acordate direct unui utilizator, peste cele care vin din rol. */
async function granturi(db: D1Database, userId: string): Promise<RandGrant[]> {
  return toate<RandGrant>(
    db,
    `SELECT permission, scope FROM permission_grants WHERE user_id = ? AND revoked_at IS NULL`,
    [userId],
  )
}

async function decide(
  db: D1Database,
  userId: string,
  permission: Permisiune,
  resourceScope: string,
): Promise<Decizie> {
  const potrivite: string[] = []

  for (const atribuire of await roluri(db, userId)) {
    if (!scopeAcopera(atribuire.scope, resourceScope)) continue
    if (PERMISIUNI_IMPLICITE[atribuire.role].includes(permission)) {
      potrivite.push(atribuire.scope)
    }
  }

  for (const grant of await granturi(db, userId)) {
    if (grant.permission !== permission) continue
    if (!scopeAcopera(grant.scope, resourceScope)) continue
    potrivite.push(grant.scope)
  }

  if (potrivite.length === 0) {
    return {
      allowed: false,
      reason: `niciun rol sau grant nu acorda ${permission} pe ${resourceScope}`,
      matchedScopes: [],
    }
  }

  return {
    allowed: true,
    reason: `acordat prin ${potrivite.join(', ')}`,
    matchedScopes: [...new Set(potrivite)],
  }
}

const CerereAtribuire = z.object({
  userId: z.string().min(1),
  role: Rol,
  scope: Scope.default('global'),
  correlationId: z.string().default('fara-corelare'),
})

const CerereRoluri = z.object({ userId: z.string().min(1) })

const CerereRevocare = z.object({
  userId: z.string().min(1),
  role: Rol,
  scope: Scope.default('global'),
})

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cid = correlationId(req)
    const log = new Logger({ service: SERVICIU, correlationId: cid })
    const cale = new URL(req.url).pathname

    if (req.method !== 'POST') return json({ eroare: 'doar POST' }, 405)

    try {
      switch (cale) {
        case '/can': {
          const date = CerereAutorizare.parse(await req.json())
          const decizie = await decide(
            env.DB,
            date.principal.userId,
            date.permission,
            date.resourceScope,
          )
          return json(decizie)
        }

        case '/roluri': {
          const date = CerereRoluri.parse(await req.json())
          return json({ roles: await roluri(env.DB, date.userId) })
        }

        case '/atribuie': {
          const date = CerereAtribuire.parse(await req.json())
          // Idempotent: aceeasi pereche (user, rol, scope) nu se dubleaza.
          await ruleaza(
            env.DB,
            `INSERT OR IGNORE INTO role_assignments (id, user_id, role, scope, created_at)
             VALUES (?, ?, ?, ?, ?)`,
            [id(), date.userId, date.role, date.scope, acum()],
          )
          log.info('rol atribuit', { userId: date.userId, role: date.role, scope: date.scope })
          return json({ ok: true })
        }

        case '/revoca': {
          const date = CerereRevocare.parse(await req.json())
          await ruleaza(
            env.DB,
            `UPDATE role_assignments SET revoked_at = ?
             WHERE user_id = ? AND role = ? AND scope = ? AND revoked_at IS NULL`,
            [acum(), date.userId, date.role, date.scope],
          )
          return json({ ok: true })
        }

        case '/permisiuni': {
          const date = CerereRoluri.parse(await req.json())
          const atribuiri = await roluri(env.DB, date.userId)
          const set = new Set<string>()
          for (const a of atribuiri) {
            for (const p of PERMISIUNI_IMPLICITE[a.role]) set.add(p)
          }
          for (const g of await granturi(env.DB, date.userId)) set.add(g.permission)
          return json({ permissions: [...set] })
        }

        default:
          return json({ eroare: 'ruta necunoscuta' }, 404)
      }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return json({ eroare: 'date invalide', detalii: e.issues.map((i) => i.message) }, 400)
      }
      log.error('eroare neasteptata', { eroare: e instanceof Error ? e.message : String(e) })
      return json({ eroare: 'eroare interna' }, 500)
    }
  },
}
