<?php
/**
 * api/middleware.php — التحقق من JWT
 * استخدام: require 'middleware.php'; ثم استدعِ requireAuth();
 */

function requireAuth(): void
{
    global $pdo, $currentUser;

    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        die(json_encode(['error' => 'Unauthorized — no token']));
    }

    $token = substr($authHeader, 7);
    $parts = explode('.', $token);

    if (count($parts) !== 2) {
        http_response_code(401);
        die(json_encode(['error' => 'Invalid token format']));
    }

    [$payload64, $sig] = $parts;

    $expectedSig = hash_hmac('sha256', $payload64, JWT_SECRET);
    if (!hash_equals($expectedSig, $sig)) {
        http_response_code(401);
        die(json_encode(['error' => 'Token tampered']));
    }

    $data = json_decode(base64_decode($payload64), true);

    if (!$data || ($data['exp'] ?? 0) < time()) {
        http_response_code(401);
        die(json_encode(['error' => 'Token expired']));
    }

    $currentUser = $data;
}

/**
 * إنشاء JWT token
 */
function createToken(array $payload, int $ttlSeconds = 86400): string
{
    $payload['exp'] = time() + $ttlSeconds;
    $payload64 = base64_encode(json_encode($payload));
    $sig = hash_hmac('sha256', $payload64, JWT_SECRET);
    return $payload64 . '.' . $sig;
}
