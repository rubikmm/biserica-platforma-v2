#!/usr/bin/env node
/**
 * Mută cei 29 de voluntari ai curățeniei în CONTURI ale platformei (user, 14.09.2026).
 *
 *   node infrastructure/import/curatenie-oameni-in-conturi.mjs --scrie staging
 *   node infrastructure/import/curatenie-oameni-in-conturi.mjs --scrie staging --uscat
 *
 * Pe 13.09.2026 utilizatorul ceruse anume ca „pickerul să rămână": omul își alegea numele dintr-o
 * listă, fără cont, iar aplicația ținea nume, e-mail și telefon. Pe 14.09 s-a răzgândit — „toate
 * conturile care sunt acum la Curățenie se vor face conturi Utilizator pe platformă" — și odată cu
 * asta a căzut ultima abatere de la „datele stau într-un loc, autentificarea la fel".
 *
 * Ce face, pentru fiecare voluntar:
 *   1. îi caută contul după adresă în `xc-identity-*`; dacă n-are, îi face unul CONFIRMAT
 *      (ca `/utilizatori/asigura`) — ⚠️ nu pleacă niciun e-mail, nici acum, nici mai târziu;
 *   2. îi completează fișa (prenume, nume, telefon, nume scurt) — dar NUMAI pe locurile goale:
 *      ce și-a scris omul singur pe contul lui e mai proaspăt decât orice listă veche;
 *   3. îi scrie asocierea `curatenie`, stare `acceptata`, cu etichetele din V1
 *      (`is_volunteer` → „voluntar", `is_monitor` → „monitor", `is_admin` → „admin");
 *   4. îi dă rolul `user` la autorizare, dacă n-are niciun rol;
 *   5. adminilor echipei le acordă `cleaning.manage` — de pe 14.09 eticheta „Admin" NU mai e un
 *      desen, ci chiar numirea, deci trebuie să aibă cheia și în `permission_grants`;
 *   6. scrie `user_id` înapoi pe rândul din `volunteers`.
 *
 * ⚠️ ORDINEA, și nu se schimbă:
 *     migrația identității 0003  →  ACEST SCRIPT  →  migrația curățeniei 0002.
 * A doua migrație aruncă numele și adresele din `volunteers`; dacă se rulează înainte, scriptul
 * n-ar mai avea de unde le lua, iar rândurile fără `user_id` s-ar pierde.
 *
 * Se poate relua de oricâte ori: fiecare pas e idempotent, iar `--uscat` doar povestește.
 */
import { randomUUID } from 'node:crypto'
import { bazaStaging } from './d1.mjs'

const argumente = process.argv.slice(2)
const opt = (n, implicit = null) => {
  const i = argumente.indexOf(`--${n}`)
  return i >= 0 ? argumente[i + 1] : implicit
}
const are = (n) => argumente.includes(`--${n}`)

const USCAT = are('uscat')
const DB_CURATENIE = opt('db-curatenie', '0c60549b-9f84-4f92-a788-835929a2f8c7')
const DB_IDENTITATE = opt('db-identitate', 'a8ef90fa-28a7-4574-9ee8-ff8d3dc6be45')
const DB_AUTHZ = opt('db-authz', '82fae023-48cc-4ca4-aab6-b2fd03cfcb37')

const APLICATIE = 'curatenie'
const CHEIE_ADMIN = 'cleaning.manage'

if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.CLOUDFLARE_API_TOKEN) {
  console.error('lipseste CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN')
  console.error('inainte de rulare: set -a; . /backup/_setup/cloudflare.env; set +a')
  process.exit(1)
}

const curatenie = bazaStaging(DB_CURATENIE)
const identitate = bazaStaging(DB_IDENTITATE)
const authz = bazaStaging(DB_AUTHZ)

const randuri = async (baza, sql, params = []) => {
  const r = await baza.ruleaza(sql, params)
  return r?.[0]?.results ?? []
}
const acum = () => new Date().toISOString()

/** Numele scurt, ca `numeScurt()` din aplicație: „Mihai P.". */
const numeScurt = (first, last) => `${first} ${last ? last.slice(0, 1).toUpperCase() + '.' : ''}`.trim()

async function main() {
  const voluntari = await randuri(
    curatenie,
    `SELECT id, first_name, last_name, email, phone, is_active, is_admin, is_volunteer, is_monitor, slug, user_id
       FROM volunteers ORDER BY id`,
  )
  console.log(`Voluntari in curatenie: ${voluntari.length}`)

  const faraEmail = voluntari.filter((v) => !v.email || String(v.email).trim() === '')
  if (faraEmail.length) {
    // Fara adresa nu se poate face cont: adresa E contul. S-ar pierde oameni in tacere.
    console.error(`\n⚠️  ${faraEmail.length} voluntari nu au e-mail — nu li se poate face cont:`)
    for (const v of faraEmail) console.error(`    #${v.id} ${v.first_name} ${v.last_name}`)
    console.error('    Completeaza-le adresa in V2 si reia. Ma opresc aici, ca sa nu pierd pe nimeni.\n')
    process.exit(1)
  }

  let conturiNoi = 0
  let conturiGasite = 0
  let asocieri = 0
  let cheiAdmin = 0

  for (const v of voluntari) {
    const email = String(v.email).trim().toLowerCase()
    const first = String(v.first_name ?? '').trim()
    const last = String(v.last_name ?? '').trim()
    const intreg = `${first} ${last}`.trim()
    const scurt = numeScurt(first, last)
    const telefon = v.phone ? String(v.phone).trim() : null

    // ---- 1. contul ------------------------------------------------------
    let [existent] = await randuri(
      identitate,
      `SELECT id, display_name, first_name, last_name, phone, short_name FROM users WHERE email = ?`,
      [email],
    )
    let userId = existent?.id ?? null

    if (!userId) {
      userId = randomUUID()
      if (!USCAT) {
        await identitate.ruleaza(
          `INSERT INTO users (id, email, display_name, first_name, last_name, phone, short_name,
                              email_verified_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, email, intreg || email, first || null, last || null, telefon, scurt, acum(), acum(), acum()],
        )
      }
      conturiNoi++
      console.log(`  + cont nou   ${intreg.padEnd(26)} ${email}`)
    } else {
      conturiGasite++
      // ⚠️ Numai golurile. Ce și-a scris omul pe contul lui nu se calcă.
      const gol = (x) => x === null || x === undefined || String(x).trim() === ''
      const bucati = []
      const valori = []
      if (gol(existent.display_name) && intreg) { bucati.push('display_name = ?'); valori.push(intreg) }
      if (gol(existent.first_name) && first) { bucati.push('first_name = ?'); valori.push(first) }
      if (gol(existent.last_name) && last) { bucati.push('last_name = ?'); valori.push(last) }
      if (gol(existent.phone) && telefon) { bucati.push('phone = ?'); valori.push(telefon) }
      if (gol(existent.short_name) && scurt) { bucati.push('short_name = ?'); valori.push(scurt) }
      if (bucati.length && !USCAT) {
        valori.push(acum(), userId)
        await identitate.ruleaza(`UPDATE users SET ${bucati.join(', ')}, updated_at = ? WHERE id = ?`, valori)
      }
      console.log(`  = cont avea  ${intreg.padEnd(26)} ${email}${bucati.length ? `  (completat: ${bucati.length} campuri)` : ''}`)
    }

    // ---- 2. asocierea cu curatenia -------------------------------------
    const etichete = []
    if (Number(v.is_volunteer ?? 1) === 1) etichete.push('voluntar')
    if (Number(v.is_monitor ?? 0) === 1) etichete.push('monitor')
    if (Number(v.is_admin ?? 0) === 1) etichete.push('admin')
    // Cine era inactiv in V1 nu se aduce in echipa: randul lui ramane, cu istoricul, dar fara
    // asociere. Poate cere oricand intrarea, de pe contul lui.
    if (Number(v.is_active ?? 1) === 1) {
      if (!USCAT) {
        await identitate.ruleaza(
          `INSERT INTO asocieri (id, user_id, aplicatie, stare, etichete, cerut_de, acceptat_de, created_at, updated_at)
           VALUES (?, ?, ?, 'acceptata', ?, ?, ?, ?, ?)
           ON CONFLICT (user_id, aplicatie) DO UPDATE SET
             stare = 'acceptata', etichete = excluded.etichete, updated_at = excluded.updated_at`,
          [randomUUID(), userId, APLICATIE, JSON.stringify(etichete), userId, userId, acum(), acum()],
        )
      }
      asocieri++
    }

    // ---- 3. rolul si cheia de administrare ------------------------------
    const roluri = await randuri(authz, `SELECT role FROM role_assignments WHERE user_id = ? AND revoked_at IS NULL`, [userId])
    if (!roluri.length && !USCAT) {
      await authz.ruleaza(
        `INSERT INTO role_assignments (id, user_id, role, scope, created_at)
         VALUES (?, ?, 'user', 'global', ?)
         ON CONFLICT (user_id, role, scope) DO UPDATE SET revoked_at = NULL`,
        [randomUUID(), userId, acum()],
      )
    }
    if (Number(v.is_admin ?? 0) === 1 && Number(v.is_active ?? 1) === 1) {
      if (!USCAT) {
        await authz.ruleaza(
          `INSERT INTO permission_grants (id, user_id, permission, scope, created_at)
           VALUES (?, ?, ?, 'global', ?)
           ON CONFLICT (user_id, permission, scope) DO UPDATE SET revoked_at = NULL`,
          [randomUUID(), userId, CHEIE_ADMIN, acum()],
        )
      }
      cheiAdmin++
      console.log(`    ↳ administrator al curateniei (${CHEIE_ADMIN})`)
    }

    // ---- 4. legatura inapoi, pe randul aplicatiei ------------------------
    if (!USCAT) {
      await curatenie.ruleaza(`UPDATE volunteers SET user_id = ?, updated_at = datetime('now') WHERE id = ?`, [userId, v.id])
    }
  }

  console.log(`\n${USCAT ? '[USCAT] ' : ''}Gata.`)
  console.log(`  conturi noi        ${conturiNoi}`)
  console.log(`  conturi existente  ${conturiGasite}`)
  console.log(`  asocieri acceptate ${asocieri}`)
  console.log(`  chei de admin      ${cheiAdmin}`)

  if (!USCAT) {
    const fara = await randuri(curatenie, `SELECT COUNT(*) AS n FROM volunteers WHERE user_id IS NULL OR TRIM(user_id) = ''`)
    const n = Number(fara[0]?.n ?? 0)
    if (n > 0) {
      console.error(`\n⚠️  ${n} randuri au ramas fara user_id — NU rula migratia 0002 pana nu se lamuresc.`)
      process.exit(1)
    }
    console.log('\n  Toate randurile au user_id. Acum se poate rula migratia curateniei 0002.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
