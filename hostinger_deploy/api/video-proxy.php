<?php
/**
 * api/video-proxy.php — بث تدريجي مع دعم Range (سرعة الجوال)
 * لا يحمّل الملف بالكامل في ذاكرة PHP
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
header('Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges');
header('Access-Control-Allow-Headers: Range, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

@ini_set('zlib.output_compression', '0');
@ini_set('output_buffering', '0');
while (ob_get_level() > 0) {
    @ob_end_flush();
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
    foreach ([
        '/\/file\/d\/([a-zA-Z0-9_-]+)/',
        '/\/d\/([a-zA-Z0-9_-]+)/',
        '/[?&]id=([a-zA-Z0-9_-]+)/',
    ] as $p) {
        if (preg_match($p, $url, $m)) return $m[1];
    }
    return null;
}

function isHtmlSnippet(string $body): bool
{
    $t = ltrim($body);
    return $t !== '' && ($t[0] === '<' || stripos($t, '<!DOCTYPE') === 0);
}

/**
 * يحل رابط التنزيل المباشر من Drive (مع confirm للملفات الكبيرة)
 * @return array{ok:bool,url?:string,cookie?:string,error?:string}
 */
function resolveDriveUrl(string $id): array
{
    $cookie = tempnam(sys_get_temp_dir(), 'gdvid');
    $ua = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36';
    $base = "https://drive.google.com/uc?export=download&id={$id}";

    $ch = curl_init($base);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 6,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_USERAGENT      => $ua,
        CURLOPT_COOKIEJAR      => $cookie,
        CURLOPT_COOKIEFILE     => $cookie,
        CURLOPT_HEADER         => true,
    ]);
    $resp = curl_exec($ch);
    if ($resp === false) {
        $err = curl_error($ch);
        curl_close($ch);
        @unlink($cookie);
        return ['ok' => false, 'error' => $err];
    }
    $hSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $final = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    $body  = substr($resp, $hSize);
    curl_close($ch);

    $downloadUrl = $final ?: $base;
    if (isHtmlSnippet($body)) {
        $confirm = 't';
        if (preg_match('/confirm=([0-9A-Za-z_\-]+)/', $body, $m)) $confirm = $m[1];
        elseif (preg_match('/name="confirm"\s+value="([0-9A-Za-z_\-]+)"/', $body, $m)) $confirm = $m[1];
        $downloadUrl = "https://drive.google.com/uc?export=download&confirm={$confirm}&id={$id}";
    }

    return ['ok' => true, 'url' => $downloadUrl, 'cookie' => $cookie];
}

/**
 * بث مباشر من الرابط البعيد مع تمرير Range
 */
function pipeStream(string $remoteUrl, ?string $range, ?string $cookieFile): void
{
    $ua = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36';
    $reqHeaders = ["User-Agent: {$ua}"];
    if ($range) $reqHeaders[] = "Range: {$range}";

    $status = 200;
    $outHeaders = [];
    $headersSent = false;

    $ch = curl_init($remoteUrl);
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER     => $reqHeaders,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 8,
        CURLOPT_TIMEOUT        => 0,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_RETURNTRANSFER => false,
        CURLOPT_HEADER         => false,
        CURLOPT_BUFFERSIZE     => 65536,
    ]);
    if ($cookieFile && is_file($cookieFile)) {
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
    }

    curl_setopt($ch, CURLOPT_HEADERFUNCTION, function ($ch, $line) use (&$status, &$outHeaders) {
        $len = strlen($line);
        if (preg_match('/^HTTP\/\S+\s+(\d+)/', $line, $m)) {
            $status = (int)$m[1];
            return $len;
        }
        if (str_contains($line, ':')) {
            [$n, $v] = explode(':', $line, 2);
            $outHeaders[strtolower(trim($n))] = trim($v);
        }
        return $len;
    });

    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($ch, $data) use (&$headersSent, &$status, &$outHeaders) {
        if (!$headersSent) {
            $headersSent = true;
            $mime = strtolower($outHeaders['content-type'] ?? 'video/mp4');
            if (str_contains($mime, 'text/html')) {
                return 0; // أوقف البث إن رجعت صفحة HTML
            }
            http_response_code($status >= 100 ? $status : 200);
            header('Content-Type: ' . ($outHeaders['content-type'] ?? 'video/mp4'));
            header('Accept-Ranges: bytes');
            header('Cache-Control: public, max-age=1800');
            if (!empty($outHeaders['content-length'])) {
                header('Content-Length: ' . $outHeaders['content-length']);
            }
            if (!empty($outHeaders['content-range'])) {
                header('Content-Range: ' . $outHeaders['content-range']);
            }
        }
        echo $data;
        flush();
        return strlen($data);
    });

    $ok = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);

    if ($cookieFile && is_file($cookieFile)) {
        @unlink($cookieFile);
    }

    if ($ok === false && !$headersSent) {
        http_response_code(502);
        header('Content-Type: application/json');
        echo json_encode(['error' => $err ?: 'stream failed']);
    }
}

$allowedHosts = ['drive.google.com', 'docs.google.com'];
$parsed = parse_url($url);
$host = strtolower($parsed['host'] ?? '');
$okHost = false;
foreach ($allowedHosts as $h) {
    if ($host === $h || str_ends_with($host, '.' . $h)) {
        $okHost = true;
        break;
    }
}
if (!$okHost) {
    http_response_code(403);
    header('Content-Type: application/json');
    die(json_encode(['error' => 'Domain not allowed: ' . $host]));
}

$driveId = extractDriveId($url);
$range = $_SERVER['HTTP_RANGE'] ?? null;

if ($driveId) {
    $resolved = resolveDriveUrl($driveId);
    if (!($resolved['ok'] ?? false)) {
        http_response_code(502);
        header('Content-Type: application/json');
        die(json_encode(['error' => $resolved['error'] ?? 'Drive resolve failed']));
    }
    if ($_SERVER['REQUEST_METHOD'] === 'HEAD') {
        /* HEAD سريع بدون جسم */
        $ch = curl_init($resolved['url']);
        curl_setopt_array($ch, [
            CURLOPT_NOBODY         => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_USERAGENT      => 'Mozilla/5.0',
            CURLOPT_COOKIEFILE     => $resolved['cookie'] ?? '',
        ]);
        curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $len  = (int)curl_getinfo($ch, CURLINFO_CONTENT_LENGTH_DOWNLOAD);
        $ctype = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: 'video/mp4';
        curl_close($ch);
        if (!empty($resolved['cookie'])) @unlink($resolved['cookie']);
        http_response_code($code > 0 ? $code : 200);
        header('Content-Type: ' . $ctype);
        header('Accept-Ranges: bytes');
        if ($len > 0) header('Content-Length: ' . $len);
        exit;
    }
    pipeStream($resolved['url'], $range, $resolved['cookie'] ?? null);
} else {
    pipeStream($url, $range, null);
}
