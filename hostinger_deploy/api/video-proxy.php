<?php
/**
 * api/video-proxy.php — بث فيديو ومجسمات 3D من Google Drive بنفس نطاق الموقع
 * GET ?url=<encoded_url>
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
header('Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges');

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

function extractDriveId(string $url): ?string
{
    $patterns = [
        '/\/file\/d\/([a-zA-Z0-9_-]+)/',
        '/\/d\/([a-zA-Z0-9_-]+)/',
        '/[?&]id=([a-zA-Z0-9_-]+)/',
    ];
    foreach ($patterns as $p) {
        if (preg_match($p, $url, $m)) {
            return $m[1];
        }
    }
    return null;
}

function isHtmlBody(string $body, string $mime): bool
{
    $clean = explode(';', strtolower($mime))[0];
    if (in_array($clean, ['text/html', 'text/plain'], true)) {
        return true;
    }
    $trim = ltrim($body);
    return $trim !== '' && ($trim[0] === '<' || str_starts_with($trim, '<!DOCTYPE'));
}

function sniffMime(string $body): string
{
    if (strlen($body) >= 4 && substr($body, 0, 4) === 'glTF') {
        return 'model/gltf-binary';
    }
    $trim = ltrim($body);
    if (str_starts_with(strtolower($trim), 'solid')) {
        return 'model/stl';
    }
    if (strlen($body) >= 2 && ord($body[0]) === 0x50 && ord($body[1]) === 0x4b) {
        return 'application/zip';
    }
    return 'application/octet-stream';
}

function curlFetch(string $url, bool $headOnly = false, ?string $range = null): array
{
    $headers = ['User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'];
    if ($range) {
        $headers[] = 'Range: ' . $range;
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 8,
        CURLOPT_TIMEOUT        => 120,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_HEADER         => true,
        CURLOPT_NOBODY         => $headOnly,
        CURLOPT_COOKIEJAR      => '',
        CURLOPT_COOKIEFILE     => '',
    ]);

    $response = curl_exec($ch);
    if ($response === false) {
        $err = curl_error($ch);
        curl_close($ch);
        return ['ok' => false, 'error' => $err, 'status' => 502];
    }

    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $status     = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $rawHeaders = substr($response, 0, $headerSize);
    $body       = $headOnly ? '' : substr($response, $headerSize);
    curl_close($ch);

    $outHeaders = [];
    foreach (explode("\r\n", $rawHeaders) as $line) {
        if (!str_contains($line, ':')) continue;
        [$name, $value] = explode(':', $line, 2);
        $outHeaders[strtolower(trim($name))] = trim($value);
    }

    return [
        'ok'      => $status < 400,
        'status'  => $status,
        'body'    => $body,
        'mime'    => $outHeaders['content-type'] ?? 'application/octet-stream',
        'headers' => $outHeaders,
    ];
}

function fetchDriveFile(string $id, bool $headOnly = false, ?string $range = null): array
{
    $base = "https://drive.google.com/uc?export=download&id={$id}";
    $res  = curlFetch($base, $headOnly, $range);

    if (!$res['ok'] && !$headOnly) {
        return $res;
    }

    if (!$headOnly && isHtmlBody($res['body'] ?? '', $res['mime'] ?? '')) {
        $confirm = 't';
        if (preg_match('/confirm=([0-9A-Za-z_\-]+)/', $res['body'], $m)) {
            $confirm = $m[1];
        } elseif (preg_match('/name="confirm"\s+value="([0-9A-Za-z_\-]+)"/', $res['body'], $m)) {
            $confirm = $m[1];
        }
        $retry = "https://drive.google.com/uc?export=download&confirm={$confirm}&id={$id}";
        $res2  = curlFetch($retry, false, $range);
        if ($res2['ok'] || strlen($res2['body'] ?? '') > 100) {
            $res = $res2;
        }
    }

    if (!$headOnly && isHtmlBody($res['body'] ?? '', $res['mime'] ?? '')) {
        return ['ok' => false, 'status' => 422, 'error' => 'Google Drive returned HTML — enable link sharing for anyone with the link'];
    }

    if (!$headOnly && !empty($res['body'])) {
        $res['mime'] = sniffMime($res['body']);
    }

    return $res;
}

$allowedHosts = ['drive.google.com', 'docs.google.com'];
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

$driveId = extractDriveId($url);
$rangeHeader = $_SERVER['HTTP_RANGE'] ?? null;

if ($driveId) {
    $res = fetchDriveFile($driveId, $_SERVER['REQUEST_METHOD'] === 'HEAD', $rangeHeader);
} else {
    $res = curlFetch($url, $_SERVER['REQUEST_METHOD'] === 'HEAD', $rangeHeader);
}

if (!($res['ok'] ?? false)) {
    $status = $res['status'] ?? 502;
    http_response_code($status >= 400 ? $status : 502);
    header('Content-Type: application/json');
    die(json_encode(['error' => $res['error'] ?? 'Upstream fetch failed']));
}

$mime = explode(';', $res['mime'] ?? 'application/octet-stream')[0];
$allowedMimes = [
    'video/webm', 'video/mp4', 'video/ogg', 'video/quicktime',
    'model/gltf-binary', 'model/stl', 'model/gltf+json',
    'application/octet-stream', 'binary/octet-stream', 'application/zip',
];

if (!in_array($mime, $allowedMimes, true)) {
    http_response_code(422);
    header('Content-Type: application/json');
    die(json_encode(['error' => 'Unsupported media type: ' . $mime]));
}

http_response_code($res['status'] ?? 200);
header('Content-Type: ' . ($res['mime'] ?? 'application/octet-stream'));
header('Accept-Ranges: bytes');
if (!empty($res['headers']['content-length'])) {
    header('Content-Length: ' . $res['headers']['content-length']);
}
if (!empty($res['headers']['content-range'])) {
    header('Content-Range: ' . $res['headers']['content-range']);
}
header('Cache-Control: public, max-age=3600');

if ($_SERVER['REQUEST_METHOD'] !== 'HEAD') {
    echo $res['body'];
}
