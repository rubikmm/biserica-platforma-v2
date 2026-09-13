import { describe, expect, it } from "vitest"
import {
  FARA_AUTOR, autorii, dupaNume, faraGhilimele, faraTitlu, litera, numeAfisat, numeDeAsezare,
  numeEditura, numeUnit, slugAutor, slugDin,
} from "../apps/biblioteca/src/nume.js"
import { compune } from "../apps/biblioteca/src/scrisori.js"
import { plusLuna } from "../apps/biblioteca/src/zile.js"

/**
 * BIBLIOTECA (A12), portata din V1 pe 13.09.2026.
 *
 * Ce se probeaza aici e chiar partea care poate strica datele fara sa se vada pe ecran:
 * despartirea casutei de autor in oameni, unirea felurilor de a scrie acelasi om, asezarea
 * dupa nume si socoteala termenelor. Foaia parohiei e scrisa de mana, de mai multi oameni, de-a
 * lungul anilor — o regula gresita aici nu da eroare, ci muta 113 carti la alt autor.
 *
 * Proba cea mai tare a portarii a fost alta, si s-a facut pe viu: `/v1/carti`, `/v1/autori` si
 * `/v1/edituri` ies din V2 IDENTICE octet cu octet cu cele din V1 din productie (13.09.2026).
 */

describe("despartirea casutei in oameni", () => {
  it("desparte la virgula si la „si”, unde chiar incepe altcineva", () => {
    expect(autorii("Arhim. Antipa Dinescu, Ierom. Petroniu Tanase")).toEqual([
      "Arhim. Antipa Dinescu",
      "Ierom. Petroniu Tanase",
    ])
  })

  it("„Daniel, Patriarhul B.O.R.” ramane UN singur om", () => {
    // Dupa virgula vine functia celui dinainte, nu alt om: un singur cuvant cu litera mare.
    expect(autorii("Daniel, Patriarhul B.O.R.")).toHaveLength(1)
  })

  it("„Oana si Alexandru Iftime” raman impreuna: impart numele de familie", () => {
    expect(autorii("Oana si Alexandru Iftime")).toHaveLength(1)
  })

  it("casuta goala nu da niciun autor", () => {
    // ⚠️ Numai golul adevarat se opreste aici. Marcajele foii — „*", „****", „-", „—", care
    // inseamna toate „nu se stie" — se curata la INTRARE, cand `unelte/actualizeaza.mjs` face
    // catalogul din foaia parohiei, si ajung `null` in `catalog.json`. Citirea nu le mai vede.
    for (const gol of [null, undefined, "", "   "]) {
      expect(autorii(gol)).toEqual([])
    }
  })
})

describe("unirea felurilor de a scrie acelasi om", () => {
  it("acelasi om scris altfel ajunge la acelasi slug", () => {
    const feluri = ["Arhim Cleopa Ilie", "Arhim. Cleopa Ilie", "Parintele Cleopa Ilie", "Cleopa Ilie"]
    const sluguri = new Set(feluri.map(slugAutor))
    expect(sluguri.size).toBe(1)
  })

  it("ce nu se poate ghici din litere sta in tabelul scris de mana", () => {
    // „Ierotei Vlahos” si „Hierotheos Vlachos” sunt acelasi om, dar literele nu spun asta.
    expect(slugAutor("Ierotei Vlahos")).toBe(slugAutor("Hierotheos Vlachos"))
  })

  it("numele de aratat se scrie cu omul in fata si titlul prescurtat, la coada", () => {
    const variante = new Map([["Arhim. Cleopa Ilie", 8], ["Arhim Cleopa Ilie", 2]])
    expect(numeUnit(variante)).toBe("Cleopa Ilie, Arhim.")
  })

  it("initialele intregite: „V. Voiculescu” e Vasile Voiculescu", () => {
    expect(faraTitlu("V. Voiculescu")).toContain("Vasile")
  })
})

describe("asezarea dupa numele omului, nu dupa titlu", () => {
  it("„Cleopa Ilie, Arhim.” sta la C", () => {
    expect(litera("Cleopa Ilie, Arhim.", "autor")).toBe("C")
  })

  it("cartile fara autor stau sub „#”, nu la F", () => {
    expect(FARA_AUTOR.litera).toBe("#")
  })

  it("ordinea e dupa numele omului", () => {
    const nume = ["Paisie Aghioritul, Cuv.", "Cleopa Ilie, Arhim.", "Ioanichie Bălan, Arhim."]
    expect([...nume].sort(dupaNume("autor"))[0]).toBe("Cleopa Ilie, Arhim.")
  })
})

describe("editurile: ghilimelele si scrierea dubla", () => {
  it("ghilimelele nu tin numele departe de litera lui", () => {
    expect(litera(faraGhilimele("”Părinți Aghioriți”"), "editura")).toBe("P")
  })

  it("„AXA” si „Axa” sunt aceeasi editura", () => {
    expect(slugDin(faraGhilimele("AXA"))).toBe(slugDin(faraGhilimele("Axa")))
  })

  it("dintre doua feluri de scris se alege cel cu diacritice", () => {
    const variante = new Map([["Credința strămoșească", 3], ["Credinta stramoseasca", 5]])
    expect(numeEditura(variante)).toBe("Credința strămoșească")
  })

  it("la editura se taie doar „Ed./Editura” — „Mănăstirea Sihăstria” ramane intreg", () => {
    // „Sfantul Nectarie” sau „Manastirea Sihastria” sunt CHIAR numele editurii (decizie V1).
    expect(numeDeAsezare("Mănăstirea Sihăstria", "editura")).toBe("Mănăstirea Sihăstria")
    expect(numeDeAsezare("Editura Deisis", "editura")).toBe("Deisis")
  })
})

describe("termenul imprumutului prinde capatul de luna", () => {
  it("31 ianuarie + o luna = 28 februarie, nu 3 martie", () => {
    expect(plusLuna("2026-01-31")).toBe("2026-02-28")
  })

  it("in an bisect cade pe 29", () => {
    expect(plusLuna("2028-01-31")).toBe("2028-02-29")
  })

  it("o zi obisnuita trece firesc", () => {
    expect(plusLuna("2026-09-13")).toBe("2026-10-13")
  })

  it("decembrie trece in anul urmator", () => {
    expect(plusLuna("2026-12-15")).toBe("2027-01-15")
  })
})

describe("scrisorile catre enorias", () => {
  it("nu se adreseaza pe nume: numele omului nu e al bibliotecii", () => {
    for (const sablon of ["cerere_primita", "pregatita", "imprumutata", "returnata"] as const) {
      const s = compune(sablon, { titlu: "Dogmatica", data: "2026-10-13" })
      expect(s.corp).toContain("Bună ziua,")
      expect(s.corp).not.toMatch(/\bdrag[ăa]\b/i)
    }
  })

  it("scrie titlul cartii si termenul, in romaneste", () => {
    const s = compune("pregatita", { titlu: "Dogmatica", data: "2026-10-13" })
    expect(s.subiect).toContain("„Dogmatica”")
    expect(s.corp).toContain("13 octombrie 2026")
  })

  it("anuntul de intarziere numara zilele cu „de” acolo unde trebuie", () => {
    expect(compune("intarziere", { titlu: "X", data: "2026-09-01", zile: 1 }).corp).toContain("o zi")
    expect(compune("intarziere", { titlu: "X", data: "2026-09-01", zile: 5 }).corp).toContain("5 zile")
    expect(compune("intarziere", { titlu: "X", data: "2026-09-01", zile: 25 }).corp).toContain("25 de zile")
  })

  it("semnatura duce la raftul omului, pe adresa mediului", () => {
    const s = compune("returnata", { titlu: "X" }, "https://biblioteca.staging.sfantul-ilie.ro")
    expect(s.corp).toContain("https://biblioteca.staging.sfantul-ilie.ro/eu")
  })
})

describe("numele aratat", () => {
  it("titlul se prescurteaza si trece dupa nume", () => {
    expect(numeAfisat("Arhimandrit Cleopa Ilie")).toBe("Cleopa Ilie, Arhim.")
  })
})
