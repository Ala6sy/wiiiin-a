<?php
/**
 * api/config.example.php — قالب إعدادات قاعدة البيانات والـ JWT
 *
 * الخطوات:
 * 1. انسخ هذا الملف إلى: api/config.php
 * 2. ضع بيانات MySQL الحقيقية و JWT_SECRET عشوائي طويل
 * 3. لا ترفع config.php إلى GitHub أبداً (موجود في .gitignore)
 */

declare(strict_types=1);

define('DB_HOST', 'localhost');
define('DB_NAME', 'YOUR_DATABASE_NAME');
define('DB_USER', 'YOUR_DATABASE_USER');
define('DB_PASS', 'YOUR_DATABASE_PASSWORD');
define('DB_CHARSET', 'utf8mb4');

/** مفتاح توقيع الجلسات — غيّره إلى سلسلة عشوائية 64 حرفاً على الأقل */
define('JWT_SECRET', 'CHANGE_ME_TO_RANDOM_64_CHARS_MINIMUM_REPLACE_THIS_NOW_PLEASE_00');

try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}
