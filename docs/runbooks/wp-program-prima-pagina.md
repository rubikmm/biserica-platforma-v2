# Programul pe prima pagină a site-ului parohiei (WordPress) — legătură TEMPORARĂ

**De ce**: până acum programul liturgic stătea în două locuri — în aplicația Program (A2) și încă o
dată tastat de mână în WordPress-ul de pe apex (`sfantul-ilie.ro`), ca articol de tipul `program` cu
câmpuri ACF. Cererea userului (18.09.2026): „să nu ținem în două locuri programul".

**Cât ține**: până când apexul trece pe V2 („legătura cu site-ul actual este o legătură temporară;
când vom schimba site-ul, va dispărea și această necesitate", user, 18.09.2026). Atunci se șterg
`apps/program/src/site.ts`, ruta `/v1/bucata-site`, rândul ei din indexul `/v1`,
`tests/program-bucata-site.test.ts` și fișierul acesta.

**Cine ce face**: partea de V2 (endpointul) e făcută aici. Partea de WordPress — tema
`sfantulilie` din containerul `biserica-site`, publicată prin FTP — o aplică **#proj-biserica-website**,
niciodată automat.

---

## Ce dă platforma

```
GET https://program.sfantul-ilie.ro/v1/bucata-site?data=azi
```

```json
{
  "ok": true,
  "bucata": "<ul>\n<li>\n<strong>Luni</strong>: 14 septembrie<br>\n⁞ 07:00 – …</ul>",
  "titlu": "14 – 20 septembrie 2026",
  "de_la": "2026-09-14",
  "pana_la": "2026-09-20",
  "slujbe": 3,
  "stare": "validat"
}
```

- `data` înțelege `azi`, `AAAA-LL-ZZ` sau numele unei zile; se dă **săptămâna care conține data**,
  întreagă (cu zilele trecute, ca acum pe site). Zilele fără slujbe nu se scriu.
- `bucata` e HTML-ul temei, rând cu rând: `<ul>` → `<li>` cu `<strong>Zi</strong>: 14 septembrie<br>`,
  `⁞ 07:00 – <strong class="rosu">…</strong>`, detaliile în `<em>→ …</em><br/>` într-un
  `div.program-detalii`. Pe pagină **nu se schimbă nimic vizual** — CSS-ul rămâne al temei.
- `stare`: `validat` = săptămâna confirmată de paroh; `propus` = ce e disponibil (rândurile din bază
  ori propunerea făcută din istoric), **neconfirmat**. Pe prima pagină publică se pune numai
  `validat` (mai jos); pagina n-are unde scrie „PROPUS", iar un program propus dat drept al parohiei
  ar fi o minciună.
- `cache-control: public, max-age=300`, cu `etag`.

## Ce se schimbă în temă

### 1. `functions.php` — funcția care cere bucata

```php
/**
 * Programul liturgic, cerut de la aplicația Program (V2). TEMPORAR: dispare la trecerea pe V2.
 *
 * Trei lucruri dinadins:
 *   - cererea se face LA SERVER, nu din browser: se vede în sursa paginii (Google) și nu cere CORS;
 *   - se ține ultima copie bună într-o opțiune: dacă workerul tace, prima pagină arată programul
 *     dinainte, nu un gol;
 *   - se ia numai săptămâna VALIDATĂ; una doar propusă nu se dă drept programul parohiei.
 */
function sfilie_program_bucata() {
	$cheie = 'sfilie_program_bucata';
	$bun   = get_option( 'sfilie_program_ultima_buna', '' );

	$gata = get_transient( $cheie );
	if ( false !== $gata ) {
		return $gata;
	}

	$r = wp_remote_get(
		'https://program.sfantul-ilie.ro/v1/bucata-site?data=azi',
		array( 'timeout' => 5, 'user-agent' => 'sfantul-ilie.ro (prima pagină)' )
	);

	$bucata = '';
	if ( ! is_wp_error( $r ) && 200 === wp_remote_retrieve_response_code( $r ) ) {
		$d = json_decode( wp_remote_retrieve_body( $r ), true );
		if ( ! empty( $d['ok'] ) && ! empty( $d['bucata'] ) && 'validat' === $d['stare'] ) {
			$bucata = $d['bucata'];
		}
	}

	if ( '' === $bucata ) {
		// nu batem la ușă la fiecare vizitator cât timp aplicația tace ori săptămâna nu e validată
		set_transient( $cheie, $bun, 5 * MINUTE_IN_SECONDS );
		return $bun;
	}

	set_transient( $cheie, $bucata, 10 * MINUTE_IN_SECONDS );
	update_option( 'sfilie_program_ultima_buna', $bucata, true ); // autoload: se citește la fiecare vizită
	return $bucata;
}
```

### 2. `content-single-program.php` — în locul buclei ACF

Tot ce e între `<?php if( have_rows('zi_liturgică') ): ?>` și `<?php endif; ?>` (rândurile 27–117)
se înlocuiește cu:

```php
<?php echo sfilie_program_bucata(); // HTML al nostru, nu intrare de utilizator ?>
```

Restul fișierului (titlul „Programul Liturgic", `the_content()`, subsolul) rămâne neatins.

### 3. Cache-ul paginii (LiteSpeed / Cloudflare) — de hotărât înainte de publicare

Transientul de 10 minute nu ajută dacă prima pagină stă ore întregi în cache-ul de pagină. Două
drumuri, la alegerea agentului site-ului:

- un `wp_schedule_event` la 10 minute care cheamă `sfilie_program_bucata()` și, dacă bucata s-a
  schimbat față de opțiunea salvată, golește cache-ul paginii principale;
- sau blocul ESI care există deja în temă (`my_esi_block_esi_load`, `litespeed_control_set_ttl`),
  cu TTL scurt numai pe bucata programului.

## Ce NU s-a atins

**Widgetul „Transmisiune audio"** (`widget_display` în `functions.php`, widgetul `custom_html-5`)
citește ACELEAȘI câmpuri ACF ca să scrie „Slujba următoare" / „Conectare…" / „LIVE". Dacă tipul de
articol `program` nu mai e completat, widgetul rămâne pe „Actualizare program …". Corespondentul
lui în V2 există deja:

- `GET /v1/urmatoarea` — următoarea slujbă, cel mult 21 de zile;
- `GET /v1/curenta` — slujba în curs (începută de cel mult 3 ore), adică exact fereastra în care
  widgetul arată „Conectare…";
- starea emisiei o știe `live.sfantul-ilie.ro`, nu programul.

De legat la o rundă anume, cu userul de față.

## Deosebiri de conținut față de ce se tasta în WP

Textele duminicii vin acum din calendarul nostru (A1), deci sunt cele din foaia de pe ușă și din
buletin, nu cele scrise de mână. Pe săptămâna 14–20.09.2026, de pildă:

| în WP, de mână | din aplicație |
| --- | --- |
| Duminica după Înălțarea Sfintei Cruci (Luarea Crucii și urmarea lui Hristos) | Duminica după Înălțarea Sfintei Cruci |
| Sfântul Mare Mucenic Eustatie și soția sa Teopista, cu cei doi fii: Agapie și Teopist | Sf. Mari Mc. Eustație și soția sa, Teopista, cu cei doi fii ai lor: Agapie și Teopist |

Nu e o pierdere de date: e forma calendarului, aceeași peste tot în platformă. Dacă parohia vrea
forma lungă, se schimbă în calendar — și se schimbă atunci în toate hârtiile deodată.
