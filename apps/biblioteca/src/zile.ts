/**
 * Cele doua socoteli de timp pe care carcasa nu le are.
 *
 * Restul vin din `@xc/ui`, unde le folosesc si celelalte aplicatii: `aziBucuresti` (ziua de azi),
 * `adaugaZile`, `zileIntre` si `dataCuZi` („joi, 17 septembrie 2026" — chiar `dataRo` din V1).
 *
 * Termenele se socotesc in zile de calendar, nu in ore: cine imprumuta o carte pe 30 august o
 * aduce pe 30 septembrie, indiferent la ce ora a trecut pe la pangar.
 */

const FUS = "Europe/Bucharest"

/**
 * Momentul exact, cu decalajul scris: „2026-09-13T19:04:11+03:00".
 *
 * Nu se ia `acum()` din `@xc/db` (acela da UTC): randurile Bibliotecii poarta ora de perete a
 * Bucurestiului de cand exista aplicatia, iar pangarul citeste `ceruta_la` cu ochii lui.
 */
export function acum(): string {
  const d = new Date()
  const f = new Intl.DateTimeFormat("sv-SE", {
    timeZone: FUS,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  })
  const local = f.format(d).replace(" ", "T")
  // decalajul e diferenta dintre ora de perete si UTC, la momentul asta al anului
  const minute = Math.round((new Date(`${local}Z`).getTime() - Math.floor(d.getTime() / 1000) * 1000) / 60000)
  const semn = minute >= 0 ? "+" : "-"
  const a = Math.abs(minute)
  return `${local}${semn}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`
}

/**
 * O luna calendaristica, cu capatul de luna prins: 31 ianuarie + o luna = 28 (sau 29) februarie,
 * nu 3 martie. Altfel termenul ar sari peste o luna intreaga de patru ori pe an.
 */
export function plusLuna(data: string, n = 1): string {
  const [a, l, z] = data.split("-").map(Number) as [number, number, number]
  const tinta = new Date(Date.UTC(a, l - 1 + n, 1))
  const ultimaZi = new Date(Date.UTC(tinta.getUTCFullYear(), tinta.getUTCMonth() + 1, 0)).getUTCDate()
  tinta.setUTCDate(Math.min(z, ultimaZi))
  return tinta.toISOString().slice(0, 10)
}
