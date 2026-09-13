/**
 * Ceasul rapoartelor — `cron/newsletter.php` din V1, hotărâre cu hotărâre.
 *
 * Bate din oră în oră (Cron Trigger `0 * * * *`) și decide singur, pe ora Bucureștiului:
 *   1. **bătaia** (mereu) → `app_settings.newsletter_cron_last_check`, ca beculețul din panou să
 *      arate dacă ceasul trăiește;
 *   2. **ALERTA** (ziua + ora din panou; implicit vineri, ora 9) — numai dacă duminica ce vine NU e
 *      completă. Dacă pleacă, se oprește aici: nu se trimit două scrisori în același ceas;
 *   3. **LUNARUL** (lunea săptămânii care conține 1 ale lunii țintă, la ora setată) — trimite și
 *      MERGE ÎNAINTE, fiindcă săptămânalul de sâmbătă e altă zi;
 *   4. **SĂPTĂMÂNALUL** (ziua + ora setate, o singură dată pe zi).
 *
 * Ce a ieșit din V1: comutatorul `NEWSLETTER_ACTIV` (era „nu" până la mutarea de pe cPanel) și
 * `?key=CRON_KEY` pentru pornirea din browser. Pornirea cu mâna e acum `/cron`, în panou, păzită de
 * `cleaning.manage`.
 *
 * ⚠️ Cât timp producția rutează încă A6 din V1, ceasul de acolo trimite el rapoartele. Aici,
 * pe staging, scrisorile intră în nisipul comunicării (`LIVRARE_REALA` stins), deci nimeni nu
 * primește câte două.
 */

import { setare, puneSetarea } from './depozit.js'
import {
  allActiveVolunteerEmails, newsletterMonthlyTriggerToday, newsletterSend, newsletterSendMonthly,
  nextSundayDate, nextSundayIsFilled, type MediuRaport,
} from './newsletter.js'
import { acum, dataLocala } from './timp.js'

/**
 * Rulează ceasul. `acumSilit` = pornire cu mâna din panou: sare peste toate socotelile de zi și oră
 * și trimite săptămânalul, ca `?force=1` din V1 (bun la probe).
 */
export async function ruleazaCeasul(db: D1Database, posta: MediuRaport, acumSilit: boolean): Promise<string> {
  const mo = acum()
  const clipa = () => dataLocala('Y-m-d H:i:s')
  let out = ''

  // Bătaia — fie că se trimite ceva, fie că nu.
  await puneSetarea(db, 'newsletter_cron_last_check', clipa())

  const scheduleWeekday = parseInt((await setare(db, 'newsletter_weekday', '6')) ?? '6', 10)
  const scheduleHour = parseInt((await setare(db, 'newsletter_hour', '16')) ?? '16', 10)
  const lastSentAt = await setare(db, 'newsletter_last_sent_at', null)

  const nowWeekday = mo.w
  const nowHour = mo.h
  const today = mo.ymd

  // ---- ALERTA ----
  const alertWeekday = parseInt((await setare(db, 'newsletter_alert_weekday', '5')) ?? '5', 10)
  const alertHour = parseInt((await setare(db, 'newsletter_alert_hour', '9')) ?? '9', 10)
  const alertSunday = nextSundayDate(mo)
  const alertLastFor = (await setare(db, 'newsletter_alert_last_sent_for_sunday', '')) ?? ''

  const doAlert = !acumSilit
    && nowWeekday === alertWeekday
    && nowHour === alertHour
    && !(await nextSundayIsFilled(db, alertSunday))
    && alertLastFor !== alertSunday

  if (doAlert) {
    const toateAdresele = await allActiveVolunteerEmails(db)
    const r = await newsletterSend(db, posta, toateAdresele, true)
    await puneSetarea(db, 'newsletter_alert_last_sent_for_sunday', alertSunday)
    out += `[Alertă] ${clipa()}\n`
      + `  Duminica: ${alertSunday} — locuri neocupate, alertă trimisă tuturor voluntarilor.\n`
      + `  Trimise: ${r.sent ?? 0}\n`
      + `  Eșuate:  ${r.failed ?? 0}\n`
    return out
  }

  // ---- LUNARUL ----
  const monthlyHour = parseInt((await setare(db, 'newsletter_monthly_hour', '9')) ?? '9', 10)
  const monthlyTarget = newsletterMonthlyTriggerToday(mo)
  const monthlyLastYm = (await setare(db, 'newsletter_monthly_last_sent_for_ym', '')) ?? ''

  let doMonthly = false
  if (!acumSilit && monthlyTarget !== null && nowHour === monthlyHour) {
    const targetYm = `${monthlyTarget[0]}-${String(monthlyTarget[1]).padStart(2, '0')}`
    if (monthlyLastYm !== targetYm) doMonthly = true
  }

  if (doMonthly && monthlyTarget) {
    const r = await newsletterSendMonthly(db, posta, null, monthlyTarget[0], monthlyTarget[1])
    out += `[Lunar] ${clipa()}\n`
      + `  Luna țintă: ${r.month_label ?? '?'}\n`
      + `  Trimise:    ${r.sent ?? 0}\n`
      + `  Eșuate:     ${r.failed ?? 0}\n`
    if (r.errors && r.errors.length) out += `  Necazuri: ${r.errors.join(', ')}\n`
  }

  // ---- SĂPTĂMÂNALUL ----
  let pricina = ''
  if (!acumSilit) {
    if (nowWeekday !== scheduleWeekday) {
      pricina = `Nu e ziua programată (azi=${nowWeekday}, programat=${scheduleWeekday}).`
    } else if (nowHour !== scheduleHour) {
      pricina = `Nu e ora programată (acum=${nowHour}, programat=${scheduleHour}).`
    } else if (lastSentAt !== null && lastSentAt.slice(0, 10) === today) {
      pricina = `Deja s-a trimis astăzi la ${lastSentAt}.`
    }
  }

  if (pricina !== '') {
    if (!doMonthly) out += `[Ceas] ${clipa()} - nimic de trimis: ${pricina}\n`
    return out
  }

  const rezultat = await newsletterSend(db, posta)
  if ((rezultat.sent ?? 0) > 0 || (rezultat.failed ?? 0) > 0) {
    await puneSetarea(db, 'newsletter_last_sent_at', clipa())
  }
  out += `[Săptămânal] ${clipa()}\n`
    + `  Duminica: ${rezultat.sunday ?? '?'}\n`
    + `  Trimise:  ${rezultat.sent ?? 0}\n`
    + `  Eșuate:   ${rezultat.failed ?? 0}\n`
  if (rezultat.errors && rezultat.errors.length) out += `  Necazuri: ${rezultat.errors.join(', ')}\n`
  return out
}
