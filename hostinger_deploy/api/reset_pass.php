<?php
// ⚠️ احذف هذا الملف فوراً بعد الاستخدام!
require_once __DIR__ . '/config.php';

$newPassword = 'MyPass2025!';
$hash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);

$stmt = $pdo->prepare("UPDATE admin_users SET password_hash = ? WHERE username = 'admin'");
$stmt->execute([$hash]);

echo "<h2>✅ تم تغيير كلمة المرور بنجاح</h2>";
echo "<p>اسم المستخدم: <strong>admin</strong></p>";
echo "<p>كلمة المرور الجديدة: <strong>MyPass2025!</strong></p>";
echo "<p style='color:red;font-weight:bold'>⚠️ احذف هذا الملف الآن من File Manager!</p>";
echo "<p>Hash: " . $hash . "</p>";
