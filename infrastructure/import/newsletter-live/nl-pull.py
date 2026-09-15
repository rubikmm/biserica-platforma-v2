#!/usr/bin/env python3
"""Aduce newsletterele noi din MailPoet-ul LIVE, pentru arhiva A8 din V2.

Adus din V1 (`biserica-newsletter/unelte/live/nl-pull.py`, 9 sept. 2026), neschimbat la temelie.

Trei pasi, in ordinea asta, si al treilea se face ORICE ar fi:
  1. urca `nl-export.php` prin FTPS, sub un nume cu jeton aleator;
  2. il cheama O DATA peste HTTPS si scrie raspunsul in fisierul cerut;
  3. il STERGE de pe server si verifica, peste HTTPS, ca a disparut (403/404).

Nu scrie nimic altceva pe live si nu atinge niciun fisier al site-ului. Nu citeste nimic despre
abonati (vezi `nl-export.php`).

  --dry           face totul in gol: arata ce ar urca si unde, fara sa se atinga de server
  --de-la=YYYY-MM-DD   de unde incolo se cer numerele (implicit 2026-09-01)
  --in=<cale>     unde se scrie JSON-ul (implicit /data/nl-live.json)

⚠️ Se ruleaza prin seif, care aduce `ftp.conf` langa el si-l ia inapoi la sfarsit:
     sh /volume1/agents/_shared/bin/ftp-proiect.sh biserica-site 'python3 nl/nl-pull.py --dry'
"""
import io, os, ssl, sys, json, secrets, ftplib, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
DRY = "--dry" in sys.argv
DE_LA = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--de-la=")), "2026-09-01")
IESIRE = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--in=")), "/data/nl-live.json")

# ftp.conf il pune seiful in /workspace; scriptul poate sta intr-un subdosar, deci se cauta in
# amandoua locurile — langa el si un nivel mai sus.
cale_cfg = next((c for c in (os.path.join(HERE, "ftp.conf"),
                             os.path.join(os.path.dirname(HERE), "ftp.conf"),
                             "/workspace/ftp.conf") if os.path.isfile(c)), None)
if not cale_cfg:
    sys.exit("nu gasesc ftp.conf — ruleaza prin ftp-proiect.sh, care il aduce din seif")

cfg = {}
with open(cale_cfg) as fh:
    for line in fh:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            cfg[k.strip()] = v.strip()
if "HOST" not in cfg or "USER" not in cfg:
    sys.exit(f"{cale_cfg} n-are datele reale (e stubul din seif?) — ruleaza prin ftp-proiect.sh")

BASE = cfg.get("BASE", "/").rstrip("/") or "/"
jeton = secrets.token_urlsafe(24)
nume = f"nl-{secrets.token_hex(8)}.php"
fara_jeton = f"https://sfantul-ilie.ro{BASE}/{nume}"
adresa = f"{fara_jeton}?token={jeton}&de_la={DE_LA}"

sursa = open(os.path.join(HERE, "nl-export.php")).read().replace("__TOKEN__", jeton)
print(f"[1] as urca {len(sursa)} octeti ca {BASE}/{nume}")
print(f"[2] as chema {fara_jeton}?token=… (de_la={DE_LA})")
print(f"[3] as sterge {BASE}/{nume} si as verifica ca da 403/404")
print(f"[4] as scrie raspunsul in {IESIRE}")
if DRY:
    print("\n--dry: nu s-a atins nimic pe server.")
    sys.exit(0)


def conecteaza():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    f = ftplib.FTP_TLS(context=ctx)
    f.connect(cfg["HOST"], int(cfg.get("PORT", "21")), timeout=60)
    f.login(cfg["USER"], cfg["PASS"])
    f.prot_p()
    return f


ftp = conecteaza()
ftp.storbinary(f"STOR {BASE}/{nume}", io.BytesIO(sursa.encode()))
print("urcat.")
try:
    req = urllib.request.Request(adresa, headers={"user-agent": "arhiva-newsletter/2.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        date = r.read()
    os.makedirs(os.path.dirname(IESIRE) or ".", exist_ok=True)
    open(IESIRE, "wb").write(date)
    d = json.loads(date)
    print(f"adus: {d['cate']} numere ({d.get('cu_html', '?')} cu HTML randat), "
          f"{len(date)} octeti -> {IESIRE}")
    print("feluri de randare:", json.dumps(d.get("feluri", {}), ensure_ascii=False))
finally:
    # ⚠️ Stergerea se face ORICE ar fi — un exportator uitat pe server e o usa lasata deschisa.
    try:
        ftp.delete(f"{BASE}/{nume}")
        print("sters de pe server.")
    except Exception as e:
        print("!! STERGEREA A ESUAT:", str(e)[:120])
        print("!! sterge manual:", f"{BASE}/{nume}")
    try:
        ftp.quit()
    except Exception:
        pass
    # ...si se VERIFICA peste HTTPS ca a disparut: ftp.delete poate sa raporteze bine si fisierul
    # sa ramana (cache, alt document root). 403/404 = curat.
    try:
        with urllib.request.urlopen(fara_jeton, timeout=30) as r:
            print(f"!! ATENTIE: {fara_jeton} inca raspunde {r.status} — sterge-l de mana.")
    except urllib.error.HTTPError as e:
        print(f"verificat: {fara_jeton} da {e.code} — nu mai e acolo.")
    except Exception as e:
        print("verificarea n-a putut fi facuta:", str(e)[:120])
