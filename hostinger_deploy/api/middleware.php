<?php
/**
 * api/middleware.php — التحقق من JWT
 * استخدام: require 'middleware.php'; ثم استدعِ requireAuth();
 */

/**
 * التحقق من توقيع وصلاحية التوكن بدون إنهاء الطلب.
 */
function verifyToken(string $token): ?array
{
    $parts = explode('.', $token);
    if (count($parts) !== 2) return null;

    [$payload64, $sig] = $parts;
    $expectedSig = hash_hmac('sha256', $payload64, JWT_SECRET);
    if (!hash_equals($expectedSig, $sig)) return null;

    $decoded = base64_decode($payload64, true);
    if ($decoded === false) return null;
    $data = json_decode($decoded, true);
    if (!$data || ($data['exp'] ?? 0) < time()) return null;
    return $data;
}

function requireAuth(): void
{
    global $pdo, $currentUser;
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        die(json_encode(['error' => 'Unauthorized — no token']));
    }

    $data = verifyToken(substr($authHeader, 7));
    if (!$data) {
        http_response_code(401);
        die(json_encode(['error' => 'Invalid or expired token']));
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
