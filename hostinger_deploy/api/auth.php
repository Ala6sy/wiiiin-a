<?php
/**
 * api/auth.php — تسجيل الدخول / الخروج
 *
 * POST /api/auth.php   { username, password }  → { token, role, displayName }
 * DELETE /api/auth.php                          → { ok: true }
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require __DIR__ . '/config.php';
require __DIR__ . '/middleware.php';

$method = $_SERVER['REQUEST_METHOD'];

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

        $token = createToken([
            'id'   => $user['id'],
            'role' => $user['role'],
        ]);

        echo json_encode([
            'token'       => $token,
            'role'        => $user['role'],
            'displayName' => $user['display_name'] ?? $user['username'],
        ]);
    } else {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid username or password']);
    }
    exit;
}

// ── تسجيل الخروج (العميل يحذف التوكن — لا نحتاج عمل كثير) ──
if ($method === 'DELETE') {
    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
