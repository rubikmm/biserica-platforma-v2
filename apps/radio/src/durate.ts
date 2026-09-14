/**
 * DURATELE — masurate pe Cloudflare, fara Python si fara ffmpeg. Adus din V1 neschimbat.
 *
 * Cererea utilizatorului (6.09.2026): „sa te descurci doar cu ce ai pe Cloudflare". Un mp3 e un
 * sir de cadre, fiecare cu un antet mic care spune cate esantioane are si la ce rata: le NUMARAM
 * pe toate si adunam. Asa iese durata EXACTA — nu ghicita din debit, cum facea ffprobe la
 * fisierele fara antet Xing — si nu ne pacaleste nici coperta inglobata (e in eticheta ID3, pe
 * care o sarim). WAV-ul isi spune singur lungimea in antet.
 *
 * ⚠️ De ce conteaza: tot radioul sta pe durate. Ceasul le aduna ca sa afle ce se aude; o eroare de
 * cateva procente pe piesa se strange si, dupa o ora, pagina arata cu totul alta melodie decat se
 * aude. De aici venea „schimba melodia in mijlocul uneia" din V1.
 *
 * Citim fisierul din depozit ca flux, bucata cu bucata; 25 MB se parcurg in cateva zeci de ms.
 */

/** Durata in secunde, sau null daca formatul nu e cunoscut / fisierul e stricat. */
export async function masoaraDurata(corp: ReadableStream<Uint8Array>, cale: string): Promise<number | null> {
  const e = cale.slice(cale.lastIndexOf(".") + 1).toLowerCase();
  if (e === "mp3") return durataMp3(corp);
  if (e === "wav") return durataWav(corp);
  return null;
}

// --- MP3 ---------------------------------------------------------------------------

const RATE = [
  [44100, 48000, 32000], // MPEG 1
  [22050, 24000, 16000], // MPEG 2
  [11025, 12000, 8000], // MPEG 2.5
];
// kbps, [versiune (0 = MPEG1, 1 = MPEG2/2.5)][strat (0 = L1, 1 = L2, 2 = L3)][index]
const DEBIT: number[][][] = [
  [
    [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  ],
  [
    [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  ],
];

interface Cadru {
  lungime: number;
  esantioane: number;
  rata: number;
}

/** Antetul unui cadru MPEG audio la pozitia `i` din `b`, sau null daca nu e unul valid. */
function cadru(b: Uint8Array, i: number): Cadru | null {
  if (i + 4 > b.length) return null;
  // Cei patru octeti ai antetului, cititi o data: indexarea e verificata de compilator, iar
  // `?? 0` nu ascunde nimic — lungimea a fost deja verificata pe randul de mai sus.
  const o0 = b[i] ?? 0, o1 = b[i + 1] ?? 0, o2 = b[i + 2] ?? 0;
  if (o0 !== 0xff || (o1 & 0xe0) !== 0xe0) return null;
  const vers = (o1 >> 3) & 3; // 0 = 2.5, 1 = rezervat, 2 = 2, 3 = 1
  const strat = (o1 >> 1) & 3; // 1 = L3, 2 = L2, 3 = L1
  const idxDebit = o2 >> 4;
  const idxRata = (o2 >> 2) & 3;
  const umplere = (o2 >> 1) & 1;
  if (vers === 1 || strat === 0 || idxDebit === 0 || idxDebit === 15 || idxRata === 3) return null;
  const mpeg1 = vers === 3;
  const rata = RATE[mpeg1 ? 0 : vers === 2 ? 1 : 2]?.[idxRata];
  const kbps = DEBIT[mpeg1 ? 0 : 1]?.[3 - strat]?.[idxDebit];
  if (!rata || !kbps) return null;
  let esantioane: number;
  let lungime: number;
  if (strat === 3) {
    esantioane = 384;
    lungime = Math.floor((12 * kbps * 1000) / rata + umplere) * 4;
  } else if (strat === 2) {
    esantioane = 1152;
    lungime = Math.floor((144 * kbps * 1000) / rata + umplere);
  } else {
    esantioane = mpeg1 ? 1152 : 576;
    lungime = Math.floor(((mpeg1 ? 144 : 72) * kbps * 1000) / rata + umplere);
  }
  if (lungime < 24) return null;
  return { lungime, esantioane, rata };
}

async function durataMp3(corp: ReadableStream<Uint8Array>): Promise<number | null> {
  const cititor = corp.getReader();
  let rest: Uint8Array = new Uint8Array(0);
  let secunde = 0;
  let cadre = 0;
  let idSarit = false;
  let deSarit = 0; // octeti de sarit (ex. eticheta ID3v2 mai lunga decat bucata curenta)

  for (;;) {
    const { value, done } = await cititor.read();
    let b: Uint8Array;
    if (done) {
      if (rest.length === 0) break;
      b = rest;
      rest = new Uint8Array(0);
    } else {
      b = rest.length ? concat(rest, value) : value;
      rest = new Uint8Array(0);
    }
    let i = 0;
    if (deSarit > 0) {
      const s = Math.min(deSarit, b.length);
      deSarit -= s;
      i = s;
    }
    if (!idSarit && i === 0 && b.length >= 10 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
      // ID3v2: dimensiune „syncsafe" pe 4 octeti, + 10 antet (+ 10 subsol daca e steag)
      const marime =
        (((b[6] ?? 0) & 0x7f) << 21) | (((b[7] ?? 0) & 0x7f) << 14) | (((b[8] ?? 0) & 0x7f) << 7) | ((b[9] ?? 0) & 0x7f);
      const total = 10 + marime + ((b[5] ?? 0) & 0x10 ? 10 : 0);
      if (total <= b.length) i = total;
      else {
        deSarit = total - b.length;
        i = b.length;
      }
    }
    idSarit = true;
    while (i < b.length) {
      // Sub 4 octeti ramasi: poate fi inceputul unui antet — il pastram pentru bucata urmatoare,
      // altfel am pierde un cadru la fiecare granita de bucata (~1 % din durata).
      if (i + 4 > b.length && !done) break;
      const c = cadru(b, i);
      if (!c) {
        i++; // zgomot / eticheta / umplutura: cautam urmatorul sync
        continue;
      }
      if (i + c.lungime > b.length) {
        // Cadrul continua in bucata urmatoare: pastram restul (cel mult un cadru).
        if (done) {
          // ultimul cadru, trunchiat: il socotim intreg — asa face si decodorul
          secunde += c.esantioane / c.rata;
          cadre++;
          i = b.length;
        }
        break;
      }
      // Cadru valid doar daca e urmat de alt sync (sau e la sfarsit): taie falsele potriviri.
      const urm = i + c.lungime;
      if (urm + 2 <= b.length && !(b[urm] === 0xff && ((b[urm + 1] ?? 0) & 0xe0) === 0xe0) && !eEticheta(b, urm)) {
        i++;
        continue;
      }
      secunde += c.esantioane / c.rata;
      cadre++;
      i = urm;
    }
    if (!done && i < b.length) rest = b.slice(i);
    if (done) break;
  }
  return cadre > 0 ? Math.round(secunde * 100) / 100 : null;
}

/** „TAG" (ID3v1) sau „ID3" (o eticheta v2 la coada) — dupa ultimul cadru. */
function eEticheta(b: Uint8Array, i: number): boolean {
  return (
    (b[i] === 0x54 && b[i + 1] === 0x41 && b[i + 2] === 0x47) ||
    (b[i] === 0x49 && b[i + 1] === 0x44 && b[i + 2] === 0x33) ||
    (b[i] === 0x4c && b[i + 1] === 0x59 && b[i + 2] === 0x52) // „LYRICS200"
  );
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const c = new Uint8Array(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}

// --- WAV ----------------------------------------------------------------------------

async function durataWav(corp: ReadableStream<Uint8Array>): Promise<number | null> {
  // Ne trebuie doar antetul: „fmt " (rata de octeti) si marimea lui „data".
  const cititor = corp.getReader();
  let b: Uint8Array = new Uint8Array(0);
  while (b.length < 64 * 1024) {
    const { value, done } = await cititor.read();
    if (done) break;
    b = concat(b, value);
    if (gasitData(b)) break;
  }
  await cititor.cancel().catch(() => undefined);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length < 12 || dv.getUint32(0, false) !== 0x52494646 || dv.getUint32(8, false) !== 0x57415645) return null;
  let i = 12;
  let octetiPeSecunda = 0;
  while (i + 8 <= b.length) {
    const id = dv.getUint32(i, false);
    const marime = dv.getUint32(i + 4, true);
    if (id === 0x666d7420 && i + 24 <= b.length) octetiPeSecunda = dv.getUint32(i + 16, true); // "fmt "
    if (id === 0x64617461) return octetiPeSecunda ? Math.round((marime / octetiPeSecunda) * 100) / 100 : null; // "data"
    i += 8 + marime + (marime & 1);
  }
  return null;
}

function gasitData(b: Uint8Array): boolean {
  for (let i = 12; i + 4 <= b.length; i++) {
    if (b[i] === 0x64 && b[i + 1] === 0x61 && b[i + 2] === 0x74 && b[i + 3] === 0x61) return true;
  }
  return false;
}
