<?php
/**
 * Export TINTIT al newsletterelor MailPoet, pentru arhiva A8 (V2).
 *
 * Adus din V1 (`biserica-newsletter/unelte/live/nl-export.php`, 9 sept. 2026) si EXTINS pe
 * 15.09.2026: pe langa structura numarului (`body`) scoate acum si HTML-UL RANDAT, adica exact ce a
 * plecat pe email. Fara el, numerele noi n-ar avea ce afisa: cele 459 din arhiva sunt randate cu
 * chiar motorul MailPoet, iar o randare scrisa de noi ar arata altfel — tocmai ce s-a cerut sa nu se
 * refaca (user, 10.09.2026: „să respecți mesajele și grafica din V1").
 *
 * ⚠️ MailPoet pastreaza HTML-ul randat NUMAI pentru numerele recente, in `wp_mailpoet_sending_queues`
 * (coloana `newsletter_rendered_body`). Tocmai alea ne trebuie: aducem ce e mai nou decat arhiva.
 * Cand lipseste, numarul iese cu `html: null` si se vede in socoteala de la sfarsit — nu se ghiceste.
 *
 * ⚠️ Forma coloanei difera de la o versiune de MailPoet la alta: JSON curat, JSON gzcompresat, ori
 * serializat PHP. Se incearca toate trei, in ordinea asta, si se spune care a mers (`fel`).
 *
 * Se urca temporar prin FTP langa wp-config.php, se cheama O DATA peste HTTPS cu ?token=…,
 * raspunde cu JSON, apoi se STERGE prin FTP. Nu scrie niciun fisier pe server.
 *
 * ⚠️ NIMIC DESPRE ABONATI: se citesc doar `wp_mailpoet_newsletters` si `wp_mailpoet_sending_queues`;
 * `wp_mailpoet_subscribers` si statisticile nici nu sunt atinse. Nu contine credentiale — le citeste
 * din wp-config.php. Nu scrie nimic in baza de date: doar SELECT.
 */
$TOKEN = getenv("NL_EXPORT_TOKEN") ?: "__TOKEN__";
if (!hash_equals($TOKEN, (string)($_GET["token"] ?? ""))) { http_response_code(403); exit("forbidden"); }
$DE_LA = preg_match("/^\d{4}-\d{2}-\d{2}$/", (string)($_GET["de_la"] ?? "")) ? $_GET["de_la"] : "2026-09-01";

$cfg = is_file(__DIR__."/wp-config.php") ? __DIR__."/wp-config.php" : dirname(__DIR__)."/wp-config.php";
$src = @file_get_contents($cfg);
if ($src === false) { http_response_code(500); exit("no wp-config"); }
function cfg($s, $k) { return preg_match("/define\(\s*[\x27\"]".$k."[\x27\"]\s*,\s*[\x27\"](.*?)[\x27\"]\s*\)/s", $s, $m) ? $m[1] : ""; }

$db = @new mysqli(cfg($src,"DB_HOST") ?: "localhost", cfg($src,"DB_USER"), cfg($src,"DB_PASSWORD"), cfg($src,"DB_NAME"));
if ($db->connect_errno) { http_response_code(500); exit("db connect: ".$db->connect_errno); }
$db->set_charset("utf8mb4");

$pre = "wp_";

/**
 * Din ce a pastrat coada de trimitere scoatem HTML-ul. Trei forme stiute, incercate in ordine;
 * a patra inseamna „n-am inteles" si se spune pe fata, nu se tace.
 */
function desfaRandarea($brut) {
  if ($brut === null || $brut === "") return [null, "lipsa"];
  $j = json_decode($brut, true);
  if (is_array($j) && isset($j["html"])) return [$j["html"], "json"];
  $g = @gzuncompress($brut);
  if ($g === false) $g = @gzdecode($brut);
  if ($g !== false && $g !== null) {
    $j = json_decode($g, true);
    if (is_array($j) && isset($j["html"])) return [$j["html"], "json-gz"];
    if (is_string($g) && stripos($g, "<html") !== false) return [$g, "html-gz"];
  }
  $s = @unserialize($brut);
  if (is_array($s) && isset($s["html"])) return [$s["html"], "serializat"];
  if (stripos($brut, "<html") !== false) return [$brut, "html"];
  return [null, "necunoscut"];
}

$sql = "SELECT n.id, n.hash, n.subject, n.type, n.status, n.sent_at, n.created_at, n.updated_at,
               n.body, q.newsletter_rendered_body AS randat
        FROM {$pre}mailpoet_newsletters n
        LEFT JOIN {$pre}mailpoet_sending_queues q ON q.newsletter_id = n.id
        WHERE n.deleted_at IS NULL
          AND ( (n.status = \x27sent\x27 AND n.sent_at >= ?)
             OR (n.status <> \x27sent\x27 AND (n.created_at >= ? OR n.updated_at >= ?)) )
        ORDER BY n.id";
$st = $db->prepare($sql);
if (!$st) { http_response_code(500); exit("prepare: ".$db->error); }
$st->bind_param("sss", $DE_LA, $DE_LA, $DE_LA);
$st->execute();
$res = $st->get_result();

$out = []; $cuHtml = 0; $feluri = []; $ids = [];
while ($r = $res->fetch_assoc()) {
  list($html, $fel) = desfaRandarea($r["randat"] ?? null);
  unset($r["randat"]);
  $r["html"] = $html;
  $r["html_fel"] = $fel;
  $feluri[$fel] = ($feluri[$fel] ?? 0) + 1;
  if ($html !== null) $cuHtml++;
  $ids[(int)$r["id"]] = true;
  $out[] = $r;
}

/**
 * ⚠️ LINKURILE ADEVARATE (15.09.2026). HTML-ul din coada de trimitere are adresele inlocuite cu urme
 * de click: `[mailpoet_click_data]-<hash>`. Intr-un email ele duc prin numaratoarea MailPoet; intr-o
 * arhiva de web sunt legaturi moarte. Adresele adevarate stau in `wp_mailpoet_newsletter_links`,
 * legate prin acelasi `hash` — de acolo se pun la loc, ca numerele noi sa aiba aceleasi legaturi vii
 * ca cele 459 dinainte (alea s-au re-randat fara numaratoare, deci au avut mereu adresa adevarata).
 */
$linkuri = [];
if ($ids) {
  $lista = implode(",", array_map("intval", array_keys($ids)));
  $q = $db->query("SELECT newsletter_id, hash, url FROM {$pre}mailpoet_newsletter_links
                   WHERE newsletter_id IN ($lista)");
  if ($q) while ($l = $q->fetch_assoc()) $linkuri[$l["hash"]] = $l["url"];
}

header("content-type: application/json; charset=utf-8");
echo json_encode([
  "de_la" => $DE_LA,
  "cate" => count($out),
  "cu_html" => $cuHtml,
  "feluri" => $feluri,
  "linkuri" => $linkuri,
  "numere" => $out,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
