<?php
/**
 * check_db.php — اختبار اتصال قاعدة البيانات
 * ─────────────────────────────────────────────
 * ارفعه على: public_html/check_db.php
 * افتح الرابط: https://eng-alaa.com/check_db.php
 * ⚠ احذفه من السيرفر فوراً بعد الاختبار!
 */

$configFile = __DIR__ . '/api/config.php';

if (!file_exists($configFile)) {
    die(renderResult('error', 'ملف api/config.php غير موجود', 'يجب أن تنشئ الملف وتضع فيه بيانات اتصال قاعدة البيانات الخاصة بك من Hostinger.'));
}

try {
    require $configFile;
    $version   = $pdo->query('SELECT VERSION()')->fetchColumn();
    $tables    = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    $tableList = implode(', ', $tables) ?: '(لا توجد جداول بعد — شغّل schema.sql)';
    renderResult('success', 'اتصال ناجح بقاعدة البيانات ✅', "
        <b>إصدار MySQL:</b> {$version}<br>
        <b>قاعدة البيانات:</b> " . DB_NAME . "<br>
        <b>المستضيف:</b> " . DB_HOST . "<br>
        <b>عدد الجداول:</b> " . count($tables) . "<br>
        <b>الجداول:</b> <code style='font-size:12px'>{$tableList}</code>
    ");
} catch (PDOException $e) {
    renderResult('error', 'فشل الاتصال ❌', htmlspecialchars($e->getMessage()));
}

function renderResult(string $type, string $title, string $detail): void
{
    $color = $type === 'success' ? '#1a7a1a' : '#cc2200';
    $bg    = $type === 'success' ? '#e8f8e8' : '#fde8e8';
    echo '<!DOCTYPE html><html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><title>فحص قاعدة البيانات</title>
<style>
  body{font-family:Tahoma,Arial,sans-serif;background:#f0f4f8;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}
  .box{background:#fff;border-radius:12px;padding:32px 40px;box-shadow:0 4px 24px rgba(0,0,0,.15);max-width:640px;width:90%}
  h2{color:' . $color . ';margin:0 0 16px}
  .detail{background:' . $bg . ';border-right:4px solid ' . $color . ';padding:14px 18px;border-radius:6px;line-height:1.8}
  .warn{margin-top:24px;background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:12px 16px;color:#856404;font-size:14px}
</style></head><body>
<div class="box">
  <h2>' . $title . '</h2>
  <div class="detail">' . $detail . '</div>
  <div class="warn">⚠️ <b>مهم:</b> احذف ملف <code>check_db.php</code> من السيرفر فوراً بعد الاختبار لأسباب أمنية.</div>
</div></body></html>';
    exit;
}
