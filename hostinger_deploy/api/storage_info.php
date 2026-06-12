<?php
// api/storage_info.php — معلومات التخزين
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/config.php';

try {
    // حجم قاعدة البيانات
    $stmt = $pdo->prepare("
        SELECT ROUND(SUM(data_length + index_length)) AS db_bytes
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
    ");
    $stmt->execute();
    $dbBytes = (int)($stmt->fetchColumn() ?? 0);

    // حجم مجلد uploads
    $uploadsPath = UPLOAD_BASE;
    $uploadsBytes = 0;
    if (is_dir($uploadsPath)) {
        $iter = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($uploadsPath, FilesystemIterator::SKIP_DOTS)
        );
        foreach ($iter as $file) {
            $uploadsBytes += $file->getSize();
        }
    }

    // إجمالي الاستخدام
    $usedBytes  = $dbBytes + $uploadsBytes;
    $totalBytes = 2 * 1024 * 1024 * 1024; // 2 GB (حد Hostinger الشائع)
    $pctUsed    = $totalBytes > 0 ? round($usedBytes / $totalBytes * 100, 2) : 0;

    echo json_encode([
        'ok'            => true,
        'used_bytes'    => $usedBytes,
        'total_bytes'   => $totalBytes,
        'uploads_bytes' => $uploadsBytes,
        'db_bytes'      => $dbBytes,
        'pct_used'      => $pctUsed,
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
