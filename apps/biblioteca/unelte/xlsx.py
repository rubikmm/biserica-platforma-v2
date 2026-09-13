#!/usr/bin/env python3
"""A12 · Citeste foaia de calcul a parohiei si o scrie ca JSON, rand cu rand.

Parohia trimite inventarul ca .xlsx (ultima data „Biblioteca_17.07.2025_C-P.xlsx").
Aici NU se interpreteaza nimic: se scot celulele asa cum sunt, cu numarul randului
langa ele, ca `actualizeaza.mjs` sa faca singur toata judecata.

    python3 unelte/xlsx.py <fisier.xlsx> <iesire.json>
"""
import sys, json, zipfile
import xml.etree.ElementTree as ET

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
NS = {"m": M[1:-1]}


def coloana(ref):
    """„BC12" -> 54. Litera din referinta celulei, in numar de coloana (de la 0)."""
    litere = ""
    for ch in ref:
        if not ch.isalpha():
            break
        litere += ch
    n = 0
    for ch in litere:
        n = n * 26 + ord(ch) - 64
    return n - 1


def foaie(z, cale, siruri):
    randuri = []
    for rand in ET.fromstring(z.read(cale)).iter(M + "row"):
        celule = {}
        for c in rand.findall("m:c", NS):
            t, v, inline = c.get("t"), c.find("m:v", NS), c.find("m:is", NS)
            if t == "s" and v is not None:
                val = siruri[int(v.text)]
            elif inline is not None:
                val = "".join(x.text or "" for x in inline.iter(M + "t"))
            elif v is not None:
                val = v.text
            else:
                continue
            if val is not None and str(val).strip():
                celule[coloana(c.get("r"))] = str(val).strip()
        if celule:
            lat = max(celule) + 1
            randuri.append({"r": int(rand.get("r")), "c": [celule.get(i) for i in range(lat)]})
    return randuri


def main(intrare, iesire):
    z = zipfile.ZipFile(intrare)
    siruri = ["".join(t.text or "" for t in si.iter(M + "t"))
              for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS)]
    nume = [s.get("name") for s in ET.fromstring(z.read("xl/workbook.xml")).iter(M + "sheet")]
    out = {}
    for i, n in enumerate(nume, start=1):
        out[n] = foaie(z, "xl/worksheets/sheet%d.xml" % i, siruri)
        print("  %-12s %5d randuri" % (n, len(out[n])), file=sys.stderr)
    json.dump(out, open(iesire, "w"), ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
