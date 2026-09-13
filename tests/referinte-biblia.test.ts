import { describe, expect, it } from "vitest"
import { citesteRef, extrage, plat } from "../apps/biblia/src/referinte.js"
import type { Carte, Index } from "../apps/biblia/src/depozit.js"

/**
 * CITIREA REFERINTELOR (A10 Biblia, portata din V1 pe 13.09.2026).
 *
 * Referintele nu vin de la om, ci din tipic si din calendar, unde se scriu asa cum le tipareste
 * cartea: cu versete discontinue („Luca 1, 1-25, 57-68"), cu treceri peste capitol („Evrei 12,
 * 28-13, 8") si cu doua pericope legate prin „și". Daca citirea lor se strica, pagina zilei din
 * Tipic si din Calendar ramane fara TEXT, nu doar fara o referinta — de aceea are proba a ei.
 *
 * Regula trecerii peste capitol: „a-b" cu b MAI MIC decat a nu poate fi un interval de versete
 * (ar merge inapoi), deci b e numar de capitol.
 */
const IX: Index = {
  sursa: "probă",
  url: "",
  carti: [
    { nume: "Luca", slug: "luca", parte: "nt", capitole: 24, versete: 1151 },
    { nume: "Ioan", slug: "ioan", parte: "nt", capitole: 21, versete: 879 },
    { nume: "Evrei", slug: "evrei", parte: "nt", capitole: 13, versete: 303 },
    { nume: "Faptele Apostolilor", slug: "faptele-apostolilor", parte: "nt", capitole: 28, versete: 1007 },
  ],
}

const intervalele = (ref: string) => citesteRef(ref, IX)?.intervale ?? null

describe("citesteRef", () => {
  it("referinta simpla: cartea si un singur interval", () => {
    const r = citesteRef("Ioan 3, 16-18", IX)
    expect(r?.carte.slug).toBe("ioan")
    expect(r?.intervale).toEqual([{ capitol: 3, de_la: 16, pana_la: 18 }])
  })

  it("capitolul intreg, fara versete", () => {
    expect(intervalele("Evrei 13")).toEqual([{ capitol: 13, de_la: null, pana_la: null }])
  })

  it("versete discontinue din acelasi capitol", () => {
    expect(intervalele("Luca 1, 1-25, 57-68, 76, 80")).toEqual([
      { capitol: 1, de_la: 1, pana_la: 25 },
      { capitol: 1, de_la: 57, pana_la: 68 },
      { capitol: 1, de_la: 76, pana_la: 76 },
      { capitol: 1, de_la: 80, pana_la: 80 },
    ])
  })

  it("trecerea peste capitol: al doilea numar mai mic e capitol, nu verset", () => {
    expect(intervalele("Evrei 12, 28-13, 8")).toEqual([
      { capitol: 12, de_la: 28, pana_la: null },
      { capitol: 13, de_la: 1, pana_la: 8 },
    ])
  })

  it("cuvantul «și» leaga doua pericope, ca si punctul si virgula", () => {
    expect(intervalele("Luca 10, 38-42 și 11, 27-28")).toEqual(intervalele("Luca 10, 38-42; 11, 27-28"))
    expect(intervalele("Luca 10, 38-42 și 11, 27-28")).toEqual([
      { capitol: 10, de_la: 38, pana_la: 42 },
      { capitol: 11, de_la: 27, pana_la: 28 },
    ])
  })

  it("numele cartii se recunoaste si fara diacritice sau pe inceput", () => {
    expect(citesteRef("Fapte 2, 1-4", IX)?.carte.slug).toBe("faptele-apostolilor")
    expect(citesteRef("luca 2, 1", IX)?.carte.slug).toBe("luca")
  })

  it("ce nu e referinta nu se ghiceste", () => {
    expect(citesteRef("mănăstire", IX)).toBeNull()
    expect(citesteRef("Cartea Neagră 3, 1", IX)).toBeNull()
  })
})

describe("extrage", () => {
  const carte: Carte = {
    id: 1,
    nume: "Evrei",
    parte: "nt",
    sursa: "probă",
    capitole: [
      ...Array.from({ length: 11 }, () => ({ "1": "…" })),
      { "27": "douăzeci și șapte", "28": "douăzeci și opt", "29": "douăzeci și nouă" },
      { "1": "unu", "2": "doi", "3": "trei" },
    ],
  }

  it("versetele ies in ordine, fiecare cu capitolul lui", () => {
    const r = citesteRef("Evrei 12, 28-13, 2", IX)!
    expect(extrage(carte, r.intervale)).toEqual([
      { numar: 28, text: "douăzeci și opt", capitol: 12 },
      { numar: 29, text: "douăzeci și nouă", capitol: 12 },
      { numar: 1, text: "unu", capitol: 13 },
      { numar: 2, text: "doi", capitol: 13 },
    ])
  })

  it("capitolul care nu exista se sare, nu strica restul", () => {
    expect(extrage(carte, [{ capitol: 99, de_la: null, pana_la: null }])).toEqual([])
  })
})

describe("plat", () => {
  it("taie diacriticele si majusculele, ca sa gaseasca «mănăstire» cine scrie «manastire»", () => {
    expect(plat("Mănăstire")).toBe("manastire")
    expect(plat("ȘTIINȚĂ")).toBe("stiinta")
  })
})
