<?php
/**
 * ai_proxy.php — Google Gemini API Proxy
 *
 * يدعم مفاتيح Gemini القديمة (AIza...) والجديدة Auth keys (AQ...).
 *
 * ضبط المفتاح على Hostinger:
 *   في public_html/config.php:
 *     <?php define('GEMINI_API_KEY', 'AQ....أو AIza...'); ?>
 */

$_cfgFile = __DIR__ . '/config.php';
if (file_exists($_cfgFile)) {
    require_once $_cfgFile;
}

if (!defined('GEMINI_API_KEY')) {
    $__key = getenv('GEMINI_API_KEY');
    if ($__key === false || $__key === '') {
        $__key = getenv('GOOGLE_API_KEY');
    }
    define('GEMINI_API_KEY', $__key !== false && $__key !== '' ? $__key : 'YOUR_GEMINI_API_KEY_HERE');
}

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

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!$body || empty($body['prompt'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing prompt']);
    exit;
}

$prompt = $body['prompt'];
$images = isset($body['images']) ? $body['images'] : [];

$apiKey = trim((string) GEMINI_API_KEY);
$base   = 'https://generativelanguage.googleapis.com/v1beta';

if ($apiKey === '' || $apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'مفتاح Gemini غير مضبوط في config.php على السيرفر. ضع GEMINI_API_KEY بمفتاح يبدأ بـ AQ. أو AIza',
    ]);
    exit;
}

/* ── HTTP helpers — مفاتيح AQ تعمل أفضل مع ترويسة x-goog-api-key ── */
function geminiHeaders(string $apiKey): array {
    return [
        'Content-Type: application/json',
        'x-goog-api-key: ' . $apiKey,
    ];
}

function curlPost(string $url, array $payload, string $apiKey): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => geminiHeaders($apiKey),
        CURLOPT_TIMEOUT        => 90,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response  = curl_exec($ch);
    $httpCode  = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) return ['ok' => false, 'status' => 0, 'body' => [], 'error' => $curlError];
    $decoded = json_decode($response, true) ?: [];
    return ['ok' => $httpCode >= 200 && $httpCode < 300, 'status' => $httpCode, 'body' => $decoded, 'raw' => $response];
}

function curlGet(string $url, string $apiKey): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => geminiHeaders($apiKey),
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response  = curl_exec($ch);
    $httpCode  = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) return ['ok' => false, 'status' => 0, 'body' => [], 'error' => $curlError];
    $decoded = json_decode($response, true) ?: [];
    return ['ok' => $httpCode >= 200 && $httpCode < 300, 'status' => $httpCode, 'body' => $decoded];
}

function authErrorMessage(array $result): string {
    $msg = $result['body']['error']['message'] ?? '';
    $status = (int) ($result['status'] ?? 0);
    if ($status === 401 || $status === 403 || stripos($msg, 'API key') !== false || stripos($msg, 'UNAUTHENTICATED') !== false) {
        return 'مفتاح Gemini مرفوض (401/403). تأكد أن المفتاح في config.php صحيح (AQ. أو AIza) من Google AI Studio، وأن Generative Language API مفعّل.';
    }
    if (!empty($result['error'])) return (string) $result['error'];
    if ($msg !== '') return $msg;
    return 'Gemini HTTP ' . $status;
}

function listModels(string $apiKey, string $base): array {
    $result = curlGet("{$base}/models?pageSize=100", $apiKey);
    if (!$result['ok'] || empty($result['body']['models'])) {
        return [];
    }

    $usable = [];
    foreach ($result['body']['models'] as $m) {
        $methods = $m['supportedGenerationMethods'] ?? [];
        if (!in_array('generateContent', $methods, true)) continue;
        $name = preg_replace('/^models\//', '', $m['name'] ?? '');
        if ($name === '') continue;
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
    if (preg_match('/flash/i', $n)) $s += 100;
    if (preg_match('/3\.5/', $n)) $s += 50;
    elseif (preg_match('/2\.5/', $n)) $s += 40;
    elseif (preg_match('/2\.0/', $n)) $s += 30;
    if (preg_match('/lite/i', $n)) $s -= 20;
    if (preg_match('/preview|exp|latest/i', $n)) $s -= 5;
    if (preg_match('/pro/i', $n)) $s += 10;
    return $s;
}

/* نماذج احتياطية إذا فشل listModels مع مفاتيح AQ الجديدة */
function fallbackModels(): array {
    return [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.5-pro',
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-flash-latest',
        'gemini-pro-latest',
    ];
}

$parts = [['text' => $prompt]];
foreach ($images as $img) {
    $mimeType = $img['mime_type'] ?? 'image/jpeg';
    $data     = $img['data'] ?? '';
    if ($data) {
        $parts[] = ['inline_data' => ['mime_type' => $mimeType, 'data' => $data]];
    }
}

$requestBody = [
    'contents'         => [['parts' => $parts]],
    'generationConfig' => ['temperature' => 0.4, 'maxOutputTokens' => 8192],
];

$models = listModels($apiKey, $base);
$listFailed = empty($models);
if ($listFailed) {
    $models = fallbackModels();
}

$lastError = $listFailed
    ? 'تعذّر جلب قائمة النماذج — سيتم تجربة النماذج الاحتياطية'
    : 'No compatible Gemini model found';

foreach ($models as $modelName) {
    $url    = "{$base}/models/{$modelName}:generateContent";
    $result = curlPost($url, $requestBody, $apiKey);

    if (!$result['ok']) {
        $lastError = authErrorMessage($result);
        if ((int) ($result['status'] ?? 0) === 401 || (int) ($result['status'] ?? 0) === 403) {
            break;
        }
        continue;
    }

    $text = $result['body']['candidates'][0]['content']['parts'][0]['text'] ?? '';
    if (!$text) {
        $lastError = "{$modelName}: empty response";
        continue;
    }

    $cleaned = preg_replace('/```json\s*/u', '', $text);
    $cleaned = preg_replace('/```\s*/u', '', $cleaned);
    $cleaned = trim($cleaned);

    $parsed = json_decode($cleaned, true);
    if ($parsed === null) {
        $lastError = "{$modelName}: invalid JSON in response";
        continue;
    }

    echo json_encode(['ok' => true, 'result' => $parsed], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(502);
echo json_encode(['ok' => false, 'error' => $lastError], JSON_UNESCAPED_UNICODE);
