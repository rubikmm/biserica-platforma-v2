import { z } from 'zod'
import {
  CerereAutorizare,
  PERMISIUNI_IMPLICITE,
  Permisiune,
  Rol,
  SCOPE_GLOBAL,
  Scope,
  type AtribuireRol,
  type Decizie,
  type Masca,
  numeMasca,
  permisiunileMastii,
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
  // ⚠️ Un rand cu rol necunoscut se trece cu vederea, TACUT. Din 19.09.2026 asta priveste si
  // randurile `role = 'admin'` ramase in baza: rolul global s-a stins, deci ele nu mai dau nimic.
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

/**
 * Decizia. Cand principalul poarta o masca „vezi ca", NU se mai uita nici la rolurile lui
 * adevarate, nici la granturile lui personale: conteaza exact ce poate omul imprumutat, si
 * atat. Altfel previzualizarea ar minti — un super-admin „mascat ca utilizator" ar putea in
 * continuare sa publice, iar intrebarea „ce vede un utilizator?" ar ramane fara raspuns.
 *
 * ⚠️ Din 19.09.2026 masca nu mai e un ROL imprumutat: `permisiunileMastii` da cheile: `user` cat un
 * utilizator, `admin:<cod>` cat un utilizator PLUS cheile aplicatiei aceleia (si numai ale ei).
 *
 * Masca `anonim` nu ajunge niciodata pana aici (identitatea intoarce sesiune anonima, deci
 * aplicatia n-are principal de trimis); daca totusi ajunge, e refuz.
 */
async function decide(
  db: D1Database,
  userId: string,
  permission: Permisiune,
  resourceScope: string,
  veziCa?: Masca,
): Promise<Decizie> {
  if (veziCa) {
    if (veziCa === 'anonim') {
      return { allowed: false, reason: 'te uiti ca neautentificat', matchedScopes: [] }
    }
    if (!scopeAcopera(SCOPE_GLOBAL, resourceScope)) {
      return { allowed: false, reason: `masca ${veziCa} nu acopera ${resourceScope}`, matchedScopes: [] }
    }
    if (!permisiunileMastii(veziCa).includes(permission)) {
      return {
        allowed: false,
        reason: `te uiti ca ${numeMasca(veziCa)}, iar el nu are ${permission}`,
        matchedScopes: [],
      }
    }
    return {
      allowed: true,
      reason: `acordat de masca ${veziCa}`,
      matchedScopes: [SCOPE_GLOBAL],
    }
  }

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

/** Acordarea sau retragerea unei chei direct pe un om. Cheia se valideaza fata de lista din contracte. */
const CerereGrant = z.object({
  userId: z.string().min(1),
  permission: Permisiune,
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
            date.principal.veziCa,
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
          // ⚠️ Un rol REVOCAT se reaprinde (14.09.2026). Pana atunci era `INSERT OR IGNORE`, care
          // lasa `revoked_at` pe loc: o atribuire dupa o revocare nu facea nimic, tacut. De asta
          // depinde garantia „super-adminul e permanent" — vezi `/sesiune` la identitate.
          await ruleaza(
            env.DB,
            `INSERT INTO role_assignments (id, user_id, role, scope, created_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (user_id, role, scope) DO UPDATE SET revoked_at = NULL`,
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

        // -------------------------------------------------------------------
        // Granturi punctuale: o cheie data DIRECT unui om, peste ce-i da rolul. Pana pe
        // 14.09.2026 se scriau numai de mana in D1 (asa se dadea `library.borrow`). Acum le cere
        // si curatenia, cand un admin al ei numeste un alt admin: eticheta „Admin" din panou NU
        // mai e un desen, ci chiar acordarea lui `cleaning.manage`.
        //
        // ⚠️ Aici nu se verifica cine cere. Autorizarea nu stie ce e un „admin de curatenie";
        // dreptul de a apasa se verifica SUS, in aplicatie, cu `can(...)`, inainte de a ajunge aici.
        case '/acorda': {
          const date = CerereGrant.parse(await req.json())
          await ruleaza(
            env.DB,
            `INSERT INTO permission_grants (id, user_id, permission, scope, created_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT (user_id, permission, scope) DO UPDATE SET revoked_at = NULL`,
            [id(), date.userId, date.permission, date.scope, acum()],
          )
          log.info('permisiune acordata', { userId: date.userId, permission: date.permission })
          return json({ ok: true })
        }

        case '/retrage': {
          const date = CerereGrant.parse(await req.json())
          await ruleaza(
            env.DB,
            `UPDATE permission_grants SET revoked_at = ?
             WHERE user_id = ? AND permission = ? AND scope = ? AND revoked_at IS NULL`,
            [acum(), date.userId, date.permission, date.scope],
          )
          log.info('permisiune retrasa', { userId: date.userId, permission: date.permission })
          return json({ ok: true })
        }

        // -------------------------------------------------------------------
        // Cine are cheia asta, si pe ce drum. Pentru ecranele care deseneaza o echipa: trebuie sa
        // stie si cui i s-a dat punctual (se poate retrage de acolo), si cui ii vine din rol
        // (nu se poate retrage din aplicatie — ar trebui coborat rolul, ceea ce e altceva).
        case '/cine-are': {
          const date = z
            .object({ permission: z.string().min(1), scope: Scope.default('global') })
            .parse(await req.json())
          const prinGrant = await toate<{ user_id: string }>(
            env.DB,
            `SELECT DISTINCT user_id FROM permission_grants
              WHERE permission = ? AND revoked_at IS NULL AND (scope = ? OR scope = 'global')`,
            [date.permission, date.scope],
          )
          const roluriCare = (Object.keys(PERMISIUNI_IMPLICITE) as Rol[]).filter((r) =>
            (PERMISIUNI_IMPLICITE[r] as readonly string[]).includes(date.permission),
          )
          let prinRol: { user_id: string }[] = []
          if (roluriCare.length) {
            const semne = roluriCare.map(() => '?').join(', ')
            prinRol = await toate<{ user_id: string }>(
              env.DB,
              `SELECT DISTINCT user_id FROM role_assignments
                WHERE role IN (${semne}) AND revoked_at IS NULL AND (scope = ? OR scope = 'global')`,
              [...roluriCare, date.scope],
            )
          }
          return json({
            prinGrant: prinGrant.map((r) => r.user_id),
            prinRol: prinRol.map((r) => r.user_id),
          })
        }

        // -------------------------------------------------------------------
        /*
         * HARTA ADMINILOR — cine e administrator pe ce aplicatie, pentru TOATE cheile deodata.
         * Cerut de tabelul din Administrare (user, 18.09.2026: „un tabel cu oamenii si aplicatiile si
         * bulina la intersectie"). E `/cine-are` pus la plural: cu unsprezece aplicatii, ecranul ar
         * fi pus unsprezece intrebari si ar fi citit de unsprezece ori aceleasi doua tabele.
         *
         * ⚠️ Cele doua feluri de drept rămân DEOSEBITE, ca in `/cine-are`: `prinGrant` e numirea pe
         * aplicatie (se poate retrage de acolo), `prinRol` e dreptul care vine din rolul global (nu
         * se poate retrage din aplicatie — ar trebui coborat rolul). Un tabel care le-ar amesteca ar
         * arata un buton „Scoate" care n-are ce scoate.
         *
         * ⚠️ Din 19.09.2026 `prinRol` inseamna, practic, SUPER-ADMIN: e singurul rol ramas cu chei de
         * aplicatie (le are pe toate). Randurile `role = 'admin'` ramase in baza cad la `Rol.safeParse`
         * si nu mai aprind nicio bulina — de aceea tabelul e si dovada ca numirile au fost mutate.
         */
        case '/harta-admini': {
          const date = z
            .object({ chei: z.array(z.string().min(1)).min(1).max(50) })
            .parse(await req.json())
          const chei = [...new Set(date.chei)]
          const semne = chei.map(() => '?').join(', ')
          const granturi = await toate<{ user_id: string; permission: string }>(
            env.DB,
            `SELECT DISTINCT user_id, permission FROM permission_grants
              WHERE permission IN (${semne}) AND revoked_at IS NULL AND scope = 'global'`,
            chei,
          )
          const roluriDate = await toate<{ user_id: string; role: string }>(
            env.DB,
            `SELECT DISTINCT user_id, role FROM role_assignments
              WHERE revoked_at IS NULL AND scope = 'global'`,
            [],
          )
          const harta: Record<string, { prinGrant: string[]; prinRol: string[] }> = {}
          for (const cheie of chei) harta[cheie] = { prinGrant: [], prinRol: [] }
          for (const g of granturi) harta[g.permission]?.prinGrant.push(g.user_id)
          for (const r of roluriDate) {
            const rol = Rol.safeParse(r.role)
            if (!rol.success) continue
            for (const cheie of chei) {
              if ((PERMISIUNI_IMPLICITE[rol.data] as readonly string[]).includes(cheie)) {
                harta[cheie]!.prinRol.push(r.user_id)
              }
            }
          }
          for (const c of chei) {
            harta[c]!.prinRol = [...new Set(harta[c]!.prinRol)]
          }
          return json({ harta })
        }

        // -------------------------------------------------------------------
        // Rolurile mai multor oameni deodata — pentru ecranul de numiri, ca sa nu punem o
        // intrebare pe fiecare rand din lista.
        case '/roluri-multi': {
          const date = z.object({ ids: z.array(z.string().min(1)).max(500) }).parse(await req.json())
          if (!date.ids.length) return json({ roluri: {} })
          const semne = date.ids.map(() => '?').join(', ')
          const randuri = await toate<{ user_id: string; role: string; scope: string }>(
            env.DB,
            `SELECT user_id, role, scope FROM role_assignments
              WHERE user_id IN (${semne}) AND revoked_at IS NULL`,
            date.ids,
          )
          const out: Record<string, AtribuireRol[]> = {}
          for (const r of randuri) {
            const rol = Rol.safeParse(r.role)
            const scope = Scope.safeParse(r.scope)
            if (!rol.success || !scope.success) continue
            ;(out[r.user_id] ??= []).push({ role: rol.data, scope: scope.data })
          }
          return json({ roluri: out })
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
