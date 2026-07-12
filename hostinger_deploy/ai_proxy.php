<?php
/**
 * ai_proxy.php — Google Gemini API Proxy
 *
 * كيفية ضبط المفتاح على Hostinger (اختر إحدى الطريقتين):
 *
 * الطريقة 1 — ملف config.php (الأفضل):
 *   أنشئ ملف config.php في نفس مجلد ai_proxy.php بالمحتوى:
 *     <?php define('GEMINI_API_KEY', 'AIza...مفتاحك...'); ?>
 *
 * الطريقة 2 — متغير بيئة Hostinger:
 *   من لوحة Hostinger → Advanced → PHP Configuration
 *   أضف: GEMINI_API_KEY = AIza...مفتاحك...
 */

/* يحاول تحميل config.php أولاً (أمان أكبر — خارج git) */
$_cfgFile = __DIR__ . '/config.php';
if (file_exists($_cfgFile)) {
    require_once $_cfgFile;
}

/* يقرأ المفتاح: config.php > متغير بيئة > قيمة مباشرة */
if (!defined('GEMINI_API_KEY')) {
    $__key = getenv('GEMINI_API_KEY');
    define('GEMINI_API_KEY', $__key !== false ? $__key : 'YOUR_GEMINI_API_KEY_HERE');
}

/* ── CORS & Headers ─────────────────────────────────── */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

/* ── Read request body ──────────────────────────────── */
$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!$body || empty($body['prompt'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing prompt']);
    exit;
}

$prompt = $body['prompt'];
$images = isset($body['images']) ? $body['images'] : [];

$apiKey = GEMINI_API_KEY;
$base   = 'https://generativelanguage.googleapis.com/v1beta';

/* ── Helper: HTTP POST via cURL ─────────────────────── */
function curlPost(string $url, array $payload): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response   = curl_exec($ch);
    $httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError  = curl_error($ch);
    curl_close($ch);

    if ($curlError) return ['ok' => false, 'status' => 0, 'body' => [], 'error' => $curlError];
    $decoded = json_decode($response, true) ?: [];
    return ['ok' => $httpCode >= 200 && $httpCode < 300, 'status' => $httpCode, 'body' => $decoded];
}

/* ── Helper: HTTP GET via cURL ──────────────────────── */
function curlGet(string $url): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response  = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) return ['ok' => false, 'body' => [], 'error' => $curlError];
    $decoded = json_decode($response, true) ?: [];
    return ['ok' => $httpCode >= 200 && $httpCode < 300, 'body' => $decoded];
}

/* ── Discover available models, prefer flash ────────── */
function listModels(string $apiKey, string $base): array {
    $result = curlGet("{$base}/models?key={$apiKey}&pageSize=100");
    if (!$result['ok'] || empty($result['body']['models'])) return [];

    $all = $result['body']['models'];
    $usable = [];
    foreach ($all as $m) {
        $methods = isset($m['supportedGenerationMethods']) ? $m['supportedGenerationMethods'] : [];
        if (!in_array('generateContent', $methods)) continue;
        $name = preg_replace('/^models\//', '', $m['name']);
        if (preg_match('/embedding|aqa|imagen|tts|image-generation|learnlm/i', $name)) continue;
        $usable[] = $name;
    }

    usort($usable, function ($a, $b) {
        return scoreModel($b) - scoreModel($a);
    });

    return $usable;
}

function scoreModel(string $n): int {
    $s = 0;
    if (preg_match('/flash/i',   $n)) $s += 100;
    if (preg_match('/2\.5/',     $n)) $s += 40;
    elseif (preg_match('/2\.0/', $n)) $s += 30;
    if (preg_match('/lite/i',    $n)) $s -= 20;
    if (preg_match('/preview|exp|latest/i', $n)) $s -= 5;
    if (preg_match('/pro/i',     $n)) $s += 10;
    return $s;
}

/* ── Build request parts ────────────────────────────── */
$parts = [['text' => $prompt]];
foreach ($images as $img) {
    $mimeType = isset($img['mime_type']) ? $img['mime_type'] : 'image/jpeg';
    $data     = isset($img['data'])      ? $img['data']      : '';
    if ($data) {
        $parts[] = ['inline_data' => ['mime_type' => $mimeType, 'data' => $data]];
    }
}

$requestBody = [
    'contents'         => [['parts' => $parts]],
    'generationConfig' => ['temperature' => 0.4, 'maxOutputTokens' => 8192],
];

/* ── Try each model until one succeeds ──────────────── */
$models    = listModels($apiKey, $base);
$lastError = 'No compatible Gemini model found';

foreach ($models as $modelName) {
    $url    = "{$base}/models/{$modelName}:generateContent?key={$apiKey}";
    $result = curlPost($url, $requestBody);

    if (!$result['ok']) {
        $lastError = isset($result['body']['error']['message'])
            ? $result['body']['error']['message']
            : "{$modelName}: HTTP {$result['status']}";
        continue;
    }

    $text = $result['body']['candidates'][0]['content']['parts'][0]['text'] ?? '';
    if (!$text) { $lastError = "{$modelName}: empty response"; continue; }

    /* Strip markdown fences if present */
    $cleaned = preg_replace('/```json\s*/u', '', $text);
    $cleaned = preg_replace('/```\s*/u', '', $cleaned);
    $cleaned = trim($cleaned);

    $parsed = json_decode($cleaned, true);
    if ($parsed === null) { $lastError = "{$modelName}: invalid JSON in response"; continue; }

    echo json_encode(['ok' => true, 'result' => $parsed]);
    exit;
}

/* ── All models failed ──────────────────────────────── */
http_response_code(502);
echo json_encode(['ok' => false, 'error' => $lastError]);
