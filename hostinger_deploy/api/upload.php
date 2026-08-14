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

$allowedFolders = ['projects', 'books', 'reports', 'gfx', 'general', 'skills', 'skill', 'cv', 'walkthrough'];
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
    'image/gif', 'image/svg+xml', 'application/pdf',
    'video/webm', 'video/mp4', 'video/quicktime', 'video/ogg',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
    'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/aac',
    'application/octet-stream', // بعض السيرفرات تُرجع webm هكذا
];
$mimeActual = mime_content_type($file['tmp_name']);
$extCheck = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$videoExts = ['webm', 'mp4', 'mov', 'm4v', 'ogv', 'ogg'];
$audioExts = ['mp3', 'wav', 'm4a', 'aac', 'oga', 'opus'];
$isVideoUpload = in_array($extCheck, $videoExts, true)
    || str_starts_with((string)$mimeActual, 'video/');
$isAudioUpload = in_array($extCheck, $audioExts, true)
    || str_starts_with((string)$mimeActual, 'audio/');

if (!in_array($mimeActual, $allowed, true) && !(($isVideoUpload || $isAudioUpload) && $mimeActual === 'application/octet-stream')) {
    http_response_code(415);
    die(json_encode(['error' => 'File type not allowed: ' . $mimeActual]));
}

$maxBytes = defined('MAX_UPLOAD_BYTES') ? MAX_UPLOAD_BYTES : (5 * 1024 * 1024);
if ($isVideoUpload) {
    $maxBytes = max($maxBytes, 40 * 1024 * 1024); // فيديو/WebM حتى 40MB
}
if ($isAudioUpload) {
    $maxBytes = max($maxBytes, 20 * 1024 * 1024); // تعليق صوتي حتى 20MB
}
if ($file['size'] > $maxBytes) {
    http_response_code(413);
    die(json_encode(['error' => 'File too large (max ' . round($maxBytes / 1024 / 1024) . ' MB)']));
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

$url = rtrim(UPLOAD_URL, '/') . '/' . ($folder === 'skill' ? 'skills' : $folder) . '/' . $newName;
echo json_encode(['url' => $url, 'filename' => $newName, 'folder' => $folder]);
