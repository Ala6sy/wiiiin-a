<?php
/**
 * api/analytics.php — تتبع زوار الموقع (عام) + إحصائيات (للمدير فقط)
 *
 * POST { action:"track", sessionId, event, path?, label?, meta? }
 * GET  ?action=stats  (Authorization: Bearer …)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'config.php not found']);
    exit;
}
require $configFile;
require __DIR__ . '/middleware.php';

$method = $_SERVER['REQUEST_METHOD'];

function ensureAnalyticsTables(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS `analytics_sessions` (
      `id` VARCHAR(36) NOT NULL,
      `ip` VARCHAR(45) DEFAULT NULL,
      `country` VARCHAR(80) DEFAULT NULL,
      `country_code` CHAR(2) DEFAULT NULL,
      `city` VARCHAR(120) DEFAULT NULL,
      `region` VARCHAR(120) DEFAULT NULL,
      `latitude` DECIMAL(9,6) DEFAULT NULL,
      `longitude` DECIMAL(9,6) DEFAULT NULL,
      `user_agent` VARCHAR(512) DEFAULT NULL,
      `first_seen` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `last_seen` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      `page_views` INT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (`id`),
      KEY `idx_last_seen` (`last_seen`),
      KEY `idx_country` (`country_code`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `analytics_events` (
      `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      `session_id` VARCHAR(36) NOT NULL,
      `event_type` ENUM('page_view','cv_download','file_download','heartbeat') NOT NULL,
      `path` VARCHAR(255) DEFAULT NULL,
      `label` VARCHAR(255) DEFAULT NULL,
      `meta` JSON DEFAULT NULL,
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`id`),
      KEY `idx_session` (`session_id`),
      KEY `idx_type_created` (`event_type`, `created_at`),
      KEY `idx_created` (`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `ip_geo_cache` (
      `ip` VARCHAR(45) NOT NULL,
      `country` VARCHAR(80) DEFAULT NULL,
      `country_code` CHAR(2) DEFAULT NULL,
      `city` VARCHAR(120) DEFAULT NULL,
      `region` VARCHAR(120) DEFAULT NULL,
      `latitude` DECIMAL(9,6) DEFAULT NULL,
      `longitude` DECIMAL(9,6) DEFAULT NULL,
      `cached_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (`ip`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function ensureAnalyticsColumns(PDO $pdo): void
{
    $add = function (string $table, string $col, string $def) use ($pdo): void {
        try {
            $pdo->query("SELECT `{$col}` FROM `{$table}` LIMIT 1");
        } catch (Throwable $e) {
            $pdo->exec("ALTER TABLE `{$table}` ADD COLUMN `{$col}` {$def}");
        }
    };
    foreach (['analytics_sessions', 'ip_geo_cache'] as $tbl) {
        $add($tbl, 'zip', 'VARCHAR(20) DEFAULT NULL');
        $add($tbl, 'isp', 'VARCHAR(120) DEFAULT NULL');
        $add($tbl, 'timezone', 'VARCHAR(64) DEFAULT NULL');
        $add($tbl, 'geo_source', 'VARCHAR(24) DEFAULT NULL');
    }
    $add('analytics_sessions', 'client_timezone', 'VARCHAR(64) DEFAULT NULL');
}

function geoDefaults(): array
{
    return [
        'country' => null, 'country_code' => null, 'city' => null, 'region' => null,
        'latitude' => null, 'longitude' => null, 'zip' => null, 'isp' => null,
        'timezone' => null, 'geo_source' => null,
    ];
}

function rowToGeo(array $row): array
{
    return [
        'country' => $row['country'] ?? null,
        'country_code' => $row['country_code'] ?? null,
        'city' => $row['city'] ?? null,
        'region' => $row['region'] ?? null,
        'latitude' => $row['latitude'] ?? null,
        'longitude' => $row['longitude'] ?? null,
        'zip' => $row['zip'] ?? null,
        'isp' => $row['isp'] ?? null,
        'timezone' => $row['timezone'] ?? null,
        'geo_source' => $row['geo_source'] ?? null,
    ];
}

function cacheGeo(PDO $pdo, string $ip, array $geo): void
{
    $pdo->prepare('INSERT INTO ip_geo_cache
        (ip, country, country_code, city, region, latitude, longitude, zip, isp, timezone, geo_source, cached_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW())
        ON DUPLICATE KEY UPDATE country=VALUES(country), country_code=VALUES(country_code), city=VALUES(city),
        region=VALUES(region), latitude=VALUES(latitude), longitude=VALUES(longitude),
        zip=VALUES(zip), isp=VALUES(isp), timezone=VALUES(timezone), geo_source=VALUES(geo_source), cached_at=NOW()')
        ->execute([
            $ip, $geo['country'], $geo['country_code'], $geo['city'], $geo['region'],
            $geo['latitude'], $geo['longitude'], $geo['zip'], $geo['isp'], $geo['timezone'],
            $geo['geo_source'] ?? null,
        ]);
}

function lookupGeoFromCloudflare(): ?array
{
    $cc = strtoupper(trim($_SERVER['HTTP_CF_IPCOUNTRY'] ?? ''));
    if (!$cc || $cc === 'XX' || $cc === 'T1') {
        return null;
    }
    $city = trim($_SERVER['HTTP_CF_IPCITY'] ?? '') ?: null;
    $region = trim($_SERVER['HTTP_CF_REGION'] ?? $_SERVER['HTTP_CF_REGION_CODE'] ?? '') ?: null;
    $lat = $_SERVER['HTTP_CF_IPLATITUDE'] ?? '';
    $lon = $_SERVER['HTTP_CF_IPLONGITUDE'] ?? '';
    $latF = is_numeric($lat) ? (float)$lat : null;
    $lonF = is_numeric($lon) ? (float)$lon : null;
    if (!$city && $latF === null) {
        return null;
    }
    return array_merge(geoDefaults(), [
        'country' => $cc,
        'country_code' => $cc,
        'city' => $city,
        'region' => $region,
        'latitude' => $latF,
        'longitude' => $lonF,
        'geo_source' => 'cloudflare',
    ]);
}

function lookupGeoFromIpwho(string $ip): ?array
{
    $url = 'https://ipwho.is/' . urlencode($ip);
    $ctx = stream_context_create(['http' => ['timeout' => 4, 'user_agent' => 'eng-alaa-analytics/1.0']]);
    $raw = @file_get_contents($url, false, $ctx);
    if (!$raw) {
        return null;
    }
    $j = json_decode($raw, true);
    if (!($j['success'] ?? false)) {
        return null;
    }
    return array_merge(geoDefaults(), [
        'country' => $j['country'] ?? null,
        'country_code' => $j['country_code'] ?? null,
        'city' => $j['city'] ?? null,
        'region' => $j['region'] ?? null,
        'latitude' => isset($j['latitude']) ? (float)$j['latitude'] : null,
        'longitude' => isset($j['longitude']) ? (float)$j['longitude'] : null,
        'zip' => $j['postal'] ?? null,
        'isp' => $j['connection']['isp'] ?? ($j['isp'] ?? null),
        'timezone' => is_array($j['timezone'] ?? null) ? ($j['timezone']['id'] ?? null) : ($j['timezone'] ?? null),
        'geo_source' => 'ipwho',
    ]);
}

function saveSessionGeo(PDO $pdo, string $sessionId, string $ip, array $geo, ?string $ua = null, ?string $clientTz = null): void
{
    $pdo->prepare('UPDATE analytics_sessions SET
        last_seen = NOW(), ip = ?, country = ?, country_code = ?, city = ?, region = ?,
        latitude = ?, longitude = ?, zip = ?, isp = ?, timezone = ?, geo_source = ?,
        client_timezone = COALESCE(?, client_timezone),
        user_agent = COALESCE(?, user_agent)
        WHERE id = ?')
        ->execute([
            $ip, $geo['country'], $geo['country_code'], $geo['city'], $geo['region'],
            $geo['latitude'], $geo['longitude'], $geo['zip'], $geo['isp'], $geo['timezone'],
            $geo['geo_source'] ?? null, $clientTz, $ua, $sessionId,
        ]);
}
function clientIp(): string
{
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'] as $k) {
        $v = $_SERVER[$k] ?? '';
        if (!$v) continue;
        if ($k === 'HTTP_X_FORWARDED_FOR') {
            $v = trim(explode(',', $v)[0]);
        }
        if (filter_var($v, FILTER_VALIDATE_IP)) {
            return $v;
        }
    }
    return '0.0.0.0';
}

function lookupGeo(PDO $pdo, string $ip): array
{
    if ($ip === '0.0.0.0' || $ip === '127.0.0.1' || str_starts_with($ip, '192.168.') || str_starts_with($ip, '10.')) {
        return array_merge(geoDefaults(), [
            'country' => 'Local', 'country_code' => 'LO', 'city' => 'Local', 'geo_source' => 'local',
        ]);
    }

    $stmt = $pdo->prepare('SELECT * FROM ip_geo_cache WHERE ip = ? AND cached_at > DATE_SUB(NOW(), INTERVAL 30 DAY) LIMIT 1');
    $stmt->execute([$ip]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        return rowToGeo($row);
    }

    foreach ([lookupGeoFromCloudflare(), lookupGeoFromIpwho($ip)] as $candidate) {
        if ($candidate && ($candidate['city'] || $candidate['latitude'])) {
            cacheGeo($pdo, $ip, $candidate);
            return $candidate;
        }
    }

    $geo = geoDefaults();
    $url = 'http://ip-api.com/json/' . urlencode($ip)
        . '?fields=status,country,countryCode,regionName,city,zip,lat,lon,timezone,isp';
    $ctx = stream_context_create(['http' => ['timeout' => 4, 'user_agent' => 'eng-alaa-analytics/1.0']]);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw) {
        $j = json_decode($raw, true);
        if (($j['status'] ?? '') === 'success') {
            $geo = [
                'country' => $j['country'] ?? null,
                'country_code' => $j['countryCode'] ?? null,
                'city' => $j['city'] ?? null,
                'region' => $j['regionName'] ?? null,
                'latitude' => isset($j['lat']) ? (float)$j['lat'] : null,
                'longitude' => isset($j['lon']) ? (float)$j['lon'] : null,
                'zip' => $j['zip'] ?? null,
                'isp' => $j['isp'] ?? null,
                'timezone' => $j['timezone'] ?? null,
                'geo_source' => 'ip-api',
            ];
        }
    }

    cacheGeo($pdo, $ip, $geo);
    return $geo;
}

function validSessionId(string $id): bool
{
    return (bool)preg_match('/^[a-zA-Z0-9_-]{8,64}$/', $id);
}

function trackEvent(PDO $pdo, array $body): void
{
    $sessionId = trim($body['sessionId'] ?? '');
    $event = trim($body['event'] ?? '');
    $allowed = ['page_view', 'cv_download', 'file_download', 'heartbeat'];
    if (!validSessionId($sessionId) || !in_array($event, $allowed, true)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid session or event']);
        exit;
    }

    $path = substr(trim($body['path'] ?? ''), 0, 255);
    $label = substr(trim($body['label'] ?? ''), 0, 255);
    $meta = is_array($body['meta'] ?? null) ? $body['meta'] : [];
    $metaJson = $meta ? json_encode($meta, JSON_UNESCAPED_UNICODE) : null;
    $clientTz = substr(trim((string)($meta['timezone'] ?? '')), 0, 64) ?: null;

    $ip = clientIp();
    $ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 512);

    $stmt = $pdo->prepare('SELECT id, ip, latitude, zip FROM analytics_sessions WHERE id = ? LIMIT 1');
    $stmt->execute([$sessionId]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$existing) {
        $geo = lookupGeo($pdo, $ip);
        $pdo->prepare('INSERT INTO analytics_sessions
            (id, ip, country, country_code, city, region, latitude, longitude, zip, isp, timezone, geo_source, client_timezone, user_agent, first_seen, last_seen, page_views)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW(),0)')
            ->execute([
                $sessionId, $ip, $geo['country'], $geo['country_code'], $geo['city'], $geo['region'],
                $geo['latitude'], $geo['longitude'], $geo['zip'], $geo['isp'], $geo['timezone'],
                $geo['geo_source'] ?? null, $clientTz, $ua,
            ]);
    } else {
        $needGeo = ($existing['ip'] ?? '') !== $ip
            || empty($existing['latitude']);
        if ($needGeo) {
            $geo = lookupGeo($pdo, $ip);
            saveSessionGeo($pdo, $sessionId, $ip, $geo, $ua, $clientTz);
        } else {
            $pdo->prepare('UPDATE analytics_sessions SET last_seen = NOW(), ip = ?, client_timezone = COALESCE(?, client_timezone) WHERE id = ?')
                ->execute([$ip, $clientTz, $sessionId]);
        }
    }

    if (!empty($meta['gps']) && isset($meta['lat'], $meta['lon']) && is_numeric($meta['lat']) && is_numeric($meta['lon'])) {
        $gpsGeo = array_merge(geoDefaults(), [
            'city' => !empty($meta['city']) ? (string)$meta['city'] : null,
            'country' => !empty($meta['country']) ? (string)$meta['country'] : null,
            'region' => !empty($meta['region']) ? (string)$meta['region'] : null,
            'latitude' => (float)$meta['lat'],
            'longitude' => (float)$meta['lon'],
            'geo_source' => 'gps',
        ]);
        saveSessionGeo($pdo, $sessionId, $ip, $gpsGeo, $ua, $clientTz);
    }

    if ($event === 'page_view') {
        $pdo->prepare('UPDATE analytics_sessions SET page_views = page_views + 1, last_seen = NOW() WHERE id = ?')
            ->execute([$sessionId]);
    } elseif ($event === 'heartbeat') {
        $pdo->prepare('UPDATE analytics_sessions SET last_seen = NOW() WHERE id = ?')->execute([$sessionId]);
    } else {
        $pdo->prepare('UPDATE analytics_sessions SET last_seen = NOW() WHERE id = ?')->execute([$sessionId]);
    }

    $pdo->prepare('INSERT INTO analytics_events (session_id, event_type, path, label, meta) VALUES (?,?,?,?,?)')
        ->execute([$sessionId, $event, $path ?: null, $label ?: null, $metaJson]);

    echo json_encode(['ok' => true]);
}

function resetAnalytics(PDO $pdo): void
{
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    $pdo->exec('TRUNCATE TABLE analytics_events');
    $pdo->exec('TRUNCATE TABLE analytics_sessions');
    $pdo->exec('TRUNCATE TABLE ip_geo_cache');
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    echo json_encode(['ok' => true, 'message' => 'Analytics cleared']);
}

function fetchStats(PDO $pdo): void
{
    $onlineMinutes = 5;

    $since = $pdo->query("SELECT DATE(MIN(first_seen)) FROM analytics_sessions")->fetchColumn() ?: date('Y-m-d');

    $totals = [
        'pageViews' => (int)$pdo->query("SELECT COUNT(*) FROM analytics_events WHERE event_type = 'page_view'")->fetchColumn(),
        'uniqueVisitors' => (int)$pdo->query("SELECT COUNT(*) FROM analytics_sessions")->fetchColumn(),
        'cvDownloads' => (int)$pdo->query("SELECT COUNT(*) FROM analytics_events WHERE event_type = 'cv_download'")->fetchColumn(),
        'fileDownloads' => (int)$pdo->query("SELECT COUNT(*) FROM analytics_events WHERE event_type = 'file_download'")->fetchColumn(),
        'onlineNow' => (int)$pdo->query("SELECT COUNT(*) FROM analytics_sessions WHERE last_seen >= DATE_SUB(NOW(), INTERVAL {$onlineMinutes} MINUTE)")->fetchColumn(),
    ];

    $today = [
        'pageViews' => (int)$pdo->query("SELECT COUNT(*) FROM analytics_events WHERE event_type = 'page_view' AND DATE(created_at) = CURDATE()")->fetchColumn(),
        'uniqueVisitors' => (int)$pdo->query("SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE DATE(created_at) = CURDATE()")->fetchColumn(),
        'cvDownloads' => (int)$pdo->query("SELECT COUNT(*) FROM analytics_events WHERE event_type = 'cv_download' AND DATE(created_at) = CURDATE()")->fetchColumn(),
        'fileDownloads' => (int)$pdo->query("SELECT COUNT(*) FROM analytics_events WHERE event_type = 'file_download' AND DATE(created_at) = CURDATE()")->fetchColumn(),
        'onlineNow' => $totals['onlineNow'],
    ];

    $byCountry = $pdo->query("
        SELECT country, country_code AS code, COUNT(*) AS visitors,
               AVG(latitude) AS lat, AVG(longitude) AS lon
        FROM analytics_sessions
        WHERE country IS NOT NULL AND country != ''
        GROUP BY country, country_code
        ORDER BY visitors DESC
        LIMIT 40
    ")->fetchAll(PDO::FETCH_ASSOC);

    $sessionCols = 'id AS sessionId, ip, country, country_code AS countryCode, city, region, zip, isp, timezone,
               client_timezone AS clientTimezone, geo_source AS geoSource,
               latitude AS lat, longitude AS lon, page_views AS pageViews,
               last_seen AS lastSeen, first_seen AS firstSeen';

    $onlineNow = $pdo->query("
        SELECT {$sessionCols}
        FROM analytics_sessions
        WHERE last_seen >= DATE_SUB(NOW(), INTERVAL {$onlineMinutes} MINUTE)
        ORDER BY last_seen DESC
        LIMIT 50
    ")->fetchAll(PDO::FETCH_ASSOC);

    $recentVisitors = $pdo->query("
        SELECT {$sessionCols}
        FROM analytics_sessions
        ORDER BY last_seen DESC
        LIMIT 30
    ")->fetchAll(PDO::FETCH_ASSOC);

    $recentEvents = $pdo->query("
        SELECT e.id, e.event_type AS eventType, e.path, e.label, e.created_at AS createdAt,
               s.ip, s.country, s.city, s.region, s.zip, s.latitude AS lat, s.longitude AS lon,
               s.geo_source AS geoSource
        FROM analytics_events e
        LEFT JOIN analytics_sessions s ON s.id = e.session_id
        WHERE e.event_type IN ('cv_download','file_download','page_view')
        ORDER BY e.created_at DESC
        LIMIT 40
    ")->fetchAll(PDO::FETCH_ASSOC);

    $cvDownloads = $pdo->query("
        SELECT COALESCE(label, path, 'CV') AS label, COUNT(*) AS count
        FROM analytics_events
        WHERE event_type = 'cv_download'
        GROUP BY label, path
        ORDER BY count DESC
        LIMIT 20
    ")->fetchAll(PDO::FETCH_ASSOC);

    $fileDownloads = $pdo->query("
        SELECT COALESCE(label, path, 'file') AS label, COUNT(*) AS count
        FROM analytics_events
        WHERE event_type = 'file_download'
        GROUP BY label, path
        ORDER BY count DESC
        LIMIT 20
    ")->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'ok' => true,
        'since' => $since,
        'onlineMinutes' => $onlineMinutes,
        'totals' => $totals,
        'today' => $today,
        'byCountry' => $byCountry,
        'onlineNow' => $onlineNow,
        'recentVisitors' => $recentVisitors,
        'recentEvents' => $recentEvents,
        'cvDownloads' => $cvDownloads,
        'fileDownloads' => $fileDownloads,
    ], JSON_UNESCAPED_UNICODE);
}

try {
    ensureAnalyticsTables($pdo);
    ensureAnalyticsColumns($pdo);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'DB setup failed: ' . $e->getMessage()]);
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid JSON body']);
        exit;
    }
    $action = $body['action'] ?? '';
    if ($action === 'reset') {
        requireAuth();
        try {
            resetAnalytics($pdo);
        } catch (Throwable $e) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
        }
        exit;
    }
    if ($action !== 'track') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Expected action: track or reset']);
        exit;
    }
    try {
        trackEvent($pdo, $body);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

if ($method === 'GET' && ($_GET['action'] ?? '') === 'stats') {
    requireAuth();
    try {
        fetchStats($pdo);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
