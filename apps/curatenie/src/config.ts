/**
 * A6 · Curatenia — constantele aplicatiei.
 *
 * Ce era in `config.php` si tinea de gazduire (parola postei, cheia cronului, cheia sesiunii de
 * admin) NU mai are loc aici: posta e a platformei, iar dreptul de administrare vine de la
 * autorizarea centrala. A ramas doar ce e al domeniului.
 */

/**
 * Cate pozitii are de umplut o duminica — pragul de la care raportul spune „toate locurile de baza
 * sunt ocupate" si sub care pleaca alerta. E in cod, ca in V1 (`MIN_VOLUNTARI`), nu in setari.
 */
export const MIN_VOLUNTARI = 4

/** Numele echipei, cum il scriu rapoartele. */
export const NUMELE_ECHIPEI = 'Albinele Sfântului Ilie'

export const FUS = 'Europe/Bucharest'

/** Grupul de WhatsApp al echipei, din panoul de autentificare al V1. */
export const GRUP_WHATSAPP = 'https://chat.whatsapp.com/Fsn47Ro4Zx4D9XBj3cKIUc?mode=gi_t'

/**
 * Functia „Vacanta" e ascunsa din pagina, ca in V1 — spatele e intreg (tabelul, ruta, socoteala
 * din raportul lunar). Se aprinde cu o singura litera, cand utilizatorul o cere.
 */
export const VACANTA_IN_PAGINA = false

export const LUNI_RO: Record<number, string> = {
  1: 'Ianuarie', 2: 'Februarie', 3: 'Martie', 4: 'Aprilie',
  5: 'Mai', 6: 'Iunie', 7: 'Iulie', 8: 'August',
  9: 'Septembrie', 10: 'Octombrie', 11: 'Noiembrie', 12: 'Decembrie',
}

export const LUNI_RO_MICI: Record<number, string> = {
  1: 'ianuarie', 2: 'februarie', 3: 'martie', 4: 'aprilie',
  5: 'mai', 6: 'iunie', 7: 'iulie', 8: 'august',
  9: 'septembrie', 10: 'octombrie', 11: 'noiembrie', 12: 'decembrie',
}
