<?php
/**
 * api/auth.php — تسجيل الدخول / الخروج
 *
 * POST /api/auth.php   { username, password }  → access token + HttpOnly refresh cookie
 * GET  /api/auth.php                            → تجديد الجلسة تلقائياً
 * DELETE /api/auth.php                          → حذف الجلسة
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require __DIR__ . '/config.php';
require __DIR__ . '/middleware.php';

$method = $_SERVER['REQUEST_METHOD'];

function setRefreshCookie(array $user): void
{
    $ttl = 365 * 24 * 60 * 60;
    $refresh = createToken([
        'id' => $user['id'],
        'role' => $user['role'],
        'kind' => 'refresh',
    ], $ttl);
    setcookie('eng_alaa_admin_refresh', $refresh, [
        'expires' => time() + $ttl,
        'path' => '/api',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function sendSession(array $user): void
{
    $access = createToken([
        'id' => $user['id'],
        'role' => $user['role'],
        'kind' => 'access',
    ], 7 * 24 * 60 * 60);
    setRefreshCookie($user);
    echo json_encode([
        'ok' => true,
        'token' => $access,
        'role' => $user['role'],
        'displayName' => $user['display_name'] ?? $user['username'] ?? '',
    ]);
}

// ── تسجيل الدخول ──────────────────────────────────────────
if ($method === 'POST') {
    $body     = json_decode(file_get_contents('php://input'), true) ?? [];
    $username = trim($body['username'] ?? '');
    $password = trim($body['password'] ?? '');

    if (!$username || !$password) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing username or password']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT * FROM admin_users WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        $pdo->prepare("UPDATE admin_users SET last_login = NOW() WHERE id = ?")
            ->execute([$user['id']]);

        sendSession($user);
    } else {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid username or password']);
    }
    exit;
}

// ── استعادة وتجديد الجلسة تلقائياً ────────────────────────
if ($method === 'GET') {
    $identity = null;
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (str_starts_with($authHeader, 'Bearer ')) {
        $identity = verifyToken(substr($authHeader, 7));
    }
    if (!$identity) {
        $refresh = $_COOKIE['eng_alaa_admin_refresh'] ?? '';
        $candidate = $refresh ? verifyToken($refresh) : null;
        if ($candidate && ($candidate['kind'] ?? '') === 'refresh') $identity = $candidate;
    }
    if (!$identity || empty($identity['id'])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Session expired']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT * FROM admin_users WHERE id = ? LIMIT 1");
    $stmt->execute([$identity['id']]);
    $user = $stmt->fetch();
    if (!$user) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Account not found']);
        exit;
    }
    sendSession($user);
    exit;
}

// ── تسجيل الخروج (العميل يحذف التوكن — لا نحتاج عمل كثير) ──
if ($method === 'DELETE') {
    setcookie('eng_alaa_admin_refresh', '', [
        'expires' => time() - 3600,
        'path' => '/api',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
