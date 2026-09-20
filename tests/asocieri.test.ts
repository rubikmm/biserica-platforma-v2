import { describe, expect, it } from 'vitest'
import {
  APLICATII_CU_MEMBRI, PERMISIUNI_IMPLICITE, aplicatieCuMembri, cheileAdminului,
  permisiunileMastii, type MembruAplicatie,
} from '../packages/contracts/src/index.js'
import { CarteaOamenilor, ETICHETA_ADMIN, ETICHETA_MONITOR, ETICHETA_VOLUNTAR, CHEIE_ADMIN } from '../apps/curatenie/src/oameni.js'
import { imbina, numeScurt, type RandVoluntar } from '../apps/curatenie/src/depozit.js'

/**
 * ASOCIERILE — apartenența unui om la o aplicație a platformei (user, 14.09.2026).
 *
 * Probele de aici păzesc lucrurile care NU se văd din citirea codului și care, dacă se strică,
 * se strică în tăcere: cine e „în echipă" și cine doar a cerut, de unde vin numele după ce au
 * ieșit din tabelul aplicației, și faptul că eticheta „Admin" chiar deschide ușa.
 */

const om = (p: Partial<MembruAplicatie> & { userId: string }): MembruAplicatie => ({
  email: `${p.userId}@example.com`,
  displayName: null,
  firstName: null,
  lastName: null,
  phone: null,
  shortName: null,
  disabledAt: null,
  stare: null,
  etichete: [],
  cerutDe: null,
  acceptatDe: null,
  ...p,
})

const rand = (id: number, userId: string): RandVoluntar => ({
  id,
  user_id: userId,
  slug: null,
  created_at: '2026-05-01 10:00:00',
  updated_at: '2026-05-01 10:00:00',
})

describe('cine e în echipă', () => {
  it('⚠️ o cerere NU e o apartenență: omul nu e activ până nu-l primește un administrator', () => {
    // Miezul cererii utilizatorului din 14.09.2026: „să fie totuși o validare… nici chiar oricine
    // nu poate ajunge în acest punct". Dacă asta se strică, oricine se face singur voluntar.
    const carte = new CarteaOamenilor([
      om({ userId: 'u1', firstName: 'Ana', lastName: 'Pop', stare: 'ceruta', etichete: [] }),
      om({ userId: 'u2', firstName: 'Ion', lastName: 'Vlad', stare: 'acceptata', etichete: [ETICHETA_VOLUNTAR] }),
    ])

    const cerut = imbina(rand(1, 'u1'), carte.om('u1'))
    expect(cerut?.is_active).toBe(0)
    expect(cerut?.in_asteptare).toBe(true)

    const primit = imbina(rand(2, 'u2'), carte.om('u2'))
    expect(primit?.is_active).toBe(1)
    expect(primit?.in_asteptare).toBe(false)
    expect(primit?.is_volunteer).toBe(1)
  })

  it('un cont închis nu e în echipă, chiar dacă asocierea a rămas acceptată', () => {
    const carte = new CarteaOamenilor([
      om({ userId: 'u3', firstName: 'Dan', stare: 'acceptata', etichete: [ETICHETA_VOLUNTAR], disabledAt: '2026-09-01T10:00:00Z' }),
    ])
    expect(imbina(rand(3, 'u3'), carte.om('u3'))?.is_active).toBe(0)
  })

  it('rândul al cărui om lipsește de tot (cont șters) cade din listă, nu se desenează fără nume', () => {
    const carte = new CarteaOamenilor([])
    expect(imbina(rand(9, 'necunoscut'), carte.om('necunoscut'))).toBeNull()
  })

  it('etichetele asocierii devin steagurile pe care le știe aplicația', () => {
    const carte = new CarteaOamenilor([
      om({ userId: 'u4', stare: 'acceptata', etichete: [ETICHETA_VOLUNTAR, ETICHETA_MONITOR, ETICHETA_ADMIN] }),
    ])
    const v = imbina(rand(4, 'u4'), carte.om('u4'))
    expect([v?.is_volunteer, v?.is_monitor, v?.is_admin]).toEqual([1, 1, 1])
  })

  it('numără doar membrii primiți, nu și cererile', () => {
    const carte = new CarteaOamenilor([
      om({ userId: 'a', stare: 'acceptata' }),
      om({ userId: 'b', stare: 'acceptata' }),
      om({ userId: 'c', stare: 'ceruta' }),
      om({ userId: 'd', stare: null }),
    ])
    expect(carte.catiPrimiti()).toBe(2)
  })
})

describe('numele, după ce au plecat din tabelul aplicației', () => {
  it('vin din fișa contului: prenume + nume', () => {
    const carte = new CarteaOamenilor([om({ userId: 'u5', firstName: 'Mihai', lastName: 'Pătrașcu', stare: 'acceptata' })])
    const v = imbina(rand(5, 'u5'), carte.om('u5'))
    expect(v?.first_name).toBe('Mihai')
    expect(numeScurt(v!)).toBe('Mihai P.')
  })

  it('⚠️ numele scurt SCRIS de om pe contul lui bate socoteala „Prenume I."', () => {
    // Altfel un „Părintele Gabriel" ar ajunge „Părintele G." pe butoane, deși el și-a scris altfel.
    const carte = new CarteaOamenilor([
      om({ userId: 'u6', firstName: 'Gabriel', lastName: 'Grigore', shortName: 'Părintele Gabriel', stare: 'acceptata' }),
    ])
    expect(numeScurt(imbina(rand(6, 'u6'), carte.om('u6'))!)).toBe('Părintele Gabriel')
  })

  it('contul fără prenume/nume se descurcă din numele afișat, tăiat în două', () => {
    const carte = new CarteaOamenilor([om({ userId: 'u7', displayName: 'Ana Maria Ionescu', stare: 'acceptata' })])
    const v = imbina(rand(7, 'u7'), carte.om('u7'))
    expect(v?.first_name).toBe('Ana')
    expect(v?.last_name).toBe('Maria Ionescu')
  })

  it('contul cu totul gol cade pe adresă — pagina nu rămâne cu un buton fără scris', () => {
    const carte = new CarteaOamenilor([om({ userId: 'u8', email: 'cineva@example.com', stare: 'acceptata' })])
    expect(imbina(rand(8, 'u8'), carte.om('u8'))?.first_name).toBe('cineva@example.com')
  })
})

describe('numirea unui administrator al curățeniei', () => {
  it('⚠️ eticheta „Admin" e chiar cheia `cleaning.manage`, nu un desen', () => {
    // Până pe 14.09.2026 `is_admin` era doar o etichetă a echipei, iar dreptul se dădea de mână în
    // D1. Utilizatorul a cerut ca numirea să fie adevărată și să vină „doar de la alt admin sau
    // superadmin" — panoul din care se apasă comutatorul cere deja cheia asta.
    const app = aplicatieCuMembri('curatenie')
    expect(app?.etichetaAdmin).toEqual({ cod: ETICHETA_ADMIN, permisiune: CHEIE_ADMIN })
  })

  it('cheia de administrare a curățeniei vine din oficiu numai cu super-adminul', () => {
    // De asta un super-admin poate întotdeauna să intre în panou și să primească pe cineva în
    // echipă, chiar dacă toți administratorii curățeniei au fost scoși.
    // ⚠️ Din 19.09.2026 nu mai există rol intermediar: restul oamenilor o primesc prin numire.
    expect(PERMISIUNI_IMPLICITE['super-admin']).toContain(CHEIE_ADMIN)
    expect(PERMISIUNI_IMPLICITE['user']).not.toContain(CHEIE_ADMIN)
    expect(cheileAdminului('curatenie')).toContain(CHEIE_ADMIN)
  })

  it('numirea de ROLURI rămâne numai a super-adminului', () => {
    // „Eu pot să fac pe cineva super-admin — adică doar eu (alt super-admin)" (user, 14.09.2026).
    // Ecranul „Oameni" din Administrare e păzit de `roles.manage`.
    expect(PERMISIUNI_IMPLICITE['super-admin']).toContain('roles.manage')
    expect(PERMISIUNI_IMPLICITE['user']).not.toContain('roles.manage')
    // Nici administratorul unei aplicații n-o capătă — nici măcar sub mască.
    expect(permisiunileMastii('admin:curatenie')).not.toContain('roles.manage')
  })
})

describe('registrul aplicațiilor cu membri', () => {
  it('codul curățeniei e cel scris în rânduri și nu se schimbă', () => {
    // `asocieri.aplicatie` ține codul ăsta în baza de date; o redenumire ar orfana toate rândurile.
    expect(APLICATII_CU_MEMBRI.map((a) => a.cod)).toContain('curatenie')
  })

  it('fiecare etichetă folosită de aplicație are un nume pe românește pentru pagina contului', () => {
    const coduri = aplicatieCuMembri('curatenie')?.etichete.map((e) => e.cod) ?? []
    for (const cod of [ETICHETA_VOLUNTAR, ETICHETA_MONITOR, ETICHETA_ADMIN]) {
      expect(coduri).toContain(cod)
    }
  })
})
