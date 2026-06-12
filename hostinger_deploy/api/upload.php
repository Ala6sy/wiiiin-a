<?php
/**
 * api/upload.php — رفع الملفات
 *
 * POST multipart/form-data:
 *   file   → الملف
 *   folder → (اختياري) projects | books | reports | gfx | general
 *
 * Response: { url, filename, folder }
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require __DIR__ . '/config.php';
require __DIR__ . '/middleware.php';
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die(json_encode(['error' => 'Method not allowed']));
}

if (empty($_FILES['file'])) {
    http_response_code(400);
    die(json_encode(['error' => 'No file uploaded']));
}

$allowedFolders = ['projects', 'books', 'reports', 'gfx', 'general'];
$folder  = preg_replace('/[^a-z0-9_]/', '', strtolower($_POST['folder'] ?? 'general'));
if (!in_array($folder, $allowedFolders, true)) $folder = 'general';

$target  = rtrim(UPLOAD_BASE, '/') . '/' . $folder . '/';
if (!is_dir($target)) {
    mkdir($target, 0755, true);
}

$file = $_FILES['file'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    die(json_encode(['error' => 'Upload error code: ' . $file['error']]));
}

$allowed = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'image/gif', 'application/pdf',
];
$mimeActual = mime_content_type($file['tmp_name']);
if (!in_array($mimeActual, $allowed, true)) {
    http_response_code(415);
    die(json_encode(['error' => 'File type not allowed: ' . $mimeActual]));
}
if ($file['size'] > MAX_UPLOAD_BYTES) {
    http_response_code(413);
    die(json_encode(['error' => 'File too large (max 5 MB)']));
}

$ext     = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$newName = uniqid('', true) . '.' . $ext;
$dest    = $target . $newName;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    http_response_code(500);
    die(json_encode(['error' => 'Failed to move uploaded file']));
}

// سجّل في جدول uploaded_files
try {
    $stmt = $pdo->prepare(
        "INSERT INTO uploaded_files (filename, original, folder, mime_type, size_bytes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $newName,
        $file['name'],
        $folder,
        $mimeActual,
        $file['size'],
        $currentUser['id'] ?? null,
    ]);
} catch (Throwable $e) { /* non-critical */ }

$url = rtrim(UPLOAD_URL, '/') . '/' . $folder . '/' . $newName;
echo json_encode(['url' => $url, 'filename' => $newName, 'folder' => $folder]);
