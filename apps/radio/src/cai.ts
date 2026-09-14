import { EXTENSII_AUDIO } from '@xc/contracts'

/**
 * CĂILE din bibliotecă — curățarea lor, singură, fără nimic din runtime.
 *
 * ⚠️ E singura poartă între ce scrie omul în pagină și ce ajunge cheie în depozit. Bucketul ține și
 * înregistrările slujbelor (`remote/`) și arhiva de predici (`predici/`): o cale care ar putea ieși
 * din `mp3player/` ar însemna că se poate șterge sau suprascrie arhiva parohiei dintr-un formular.
 * De aceea calea se REFUZĂ, nu se „repară" — o cale absolută sau cu `..` e o cerere greșită, iar o
 * cerere greșită nu se ghicește.
 *
 * Stă într-un fișier fără dependențe ca să poată fi probată direct, fără `cloudflare:workers`.
 */

/** Cale relativă curată, sau `null`: fără `..`, fără `/` la capete, fără componente ascunse. */
export function caleCurata(brut: string | null): string | null {
  if (!brut) return null
  const brutNorm = brut.replace(/\\/g, '/')
  if (brutNorm.startsWith('/')) return null // cale absolută: refuzată, nu „reparată"
  const s = brutNorm.replace(/\/+$/g, '').normalize('NFC')
  if (!s) return null
  const parti = s.split('/')
  for (const p of parti) {
    if (!p || p === '.' || p === '..' || p.startsWith('.')) return null
  }
  return parti.join('/')
}

export const eAudio = (cale: string): boolean => EXTENSII_AUDIO.some((e) => cale.toLowerCase().endsWith(e))
