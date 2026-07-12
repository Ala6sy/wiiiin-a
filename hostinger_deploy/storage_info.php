<?php
/**
 * storage_info.php — Server Disk Space Monitor
 * ضع هذا الملف في: public_html/api/storage_info.php
 * يقرأ المساحة الحقيقية للقرص عبر دوال PHP المدمجة
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Cache-Control: no-store, max-age=0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

/* ── قراءة مساحة القرص الكاملة للسيرفر ── */
$path = defined('UPLOAD_BASE') ? UPLOAD_BASE : __DIR__;

$totalBytes = @disk_total_space($path);
$freeBytes  = @disk_free_space($path);

if ($totalBytes === false || $freeBytes === false) {
    http_response_code(500);
    echo json_encode(['error' => 'disk_space functions unavailable on this server']);
    exit;
}

$usedBytes = $totalBytes - $freeBytes;

/* ── حجم مجلد uploads (اختياري — للمعلومية فقط) ── */
$uploadsDir = dirname(__DIR__) . '/uploads';
$uploadsSize = 0;
if (is_dir($uploadsDir)) {
    $iter = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($uploadsDir, FilesystemIterator::SKIP_DOTS)
    );
    foreach ($iter as $f) {
        $uploadsSize += $f->getSize();
    }
}

echo json_encode([
    'ok'           => true,
    'total_bytes'  => $totalBytes,
    'free_bytes'   => $freeBytes,
    'used_bytes'   => $usedBytes,
    'uploads_bytes'=> $uploadsSize,
    'pct_used'     => $totalBytes > 0 ? round($usedBytes / $totalBytes * 100, 1) : 0,
    'source'       => 'disk_total_space / disk_free_space',
]);
