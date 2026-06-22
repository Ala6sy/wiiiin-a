<?php
/**
 * api/img-proxy.php — وسيط صور لحلّ مشكلة CORS مع Google Drive
 * يُستخدم فقط من مولّد غلاف الكتب (Canvas)
 *
 * GET ?url=<encoded_url>
 * - مقيّد بنطاقات Google Drive و Drive thumbnail فقط
 * - يعيد الصورة كـ binary مع Content-Type المناسب
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$raw = $_GET['url'] ?? '';
if (!$raw) {
    http_response_code(400);
    header('Content-Type: application/json');
    die(json_encode(['error' => 'Missing url parameter']));
}

$url = urldecode($raw);

/* ─── قائمة النطاقات المسموح بها ─── */
$allowedHosts = [
    'drive.google.com',
    'lh3.googleusercontent.com',
    'lh4.googleusercontent.com',
    'lh5.googleusercontent.com',
    'lh6.googleusercontent.com',
    'docs.google.com',
];

$parsed = parse_url($url);
$host   = strtolower($parsed['host'] ?? '');

$allowed = false;
foreach ($allowedHosts as $h) {
    if ($host === $h || str_ends_with($host, '.' . $h)) {
        $allowed = true;
        break;
    }
}

if (!$allowed) {
    http_response_code(403);
    header('Content-Type: application/json');
    die(json_encode(['error' => 'Domain not allowed: ' . $host]));
}

/* ─── جلب الصورة ─── */
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 5,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; eng-alaa-bot/1.0)',
    CURLOPT_SSL_VERIFYPEER => true,
]);

$body    = curl_exec($ch);
$status  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$mime    = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

if ($body === false || $status >= 400) {
    http_response_code(502);
    header('Content-Type: application/json');
    die(json_encode(['error' => "Upstream error: HTTP $status"]));
}

/* ─── نقلب نوع المحتوى ─── */
$allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
$cleanMime    = explode(';', $mime)[0]; // strip charset
if (!in_array($cleanMime, $allowedMimes, true)) {
    // إذا كان Drive يعيد HTML (غير مشارك) — نعيد خطأ
    http_response_code(422);
    header('Content-Type: application/json');
    die(json_encode(['error' => 'Not an image: ' . $cleanMime]));
}

header('Content-Type: ' . $cleanMime);
header('Cache-Control: public, max-age=86400');
echo $body;
