<?php
/**
 * api/generate_customer_report.php
 * ─────────────────────────────────────────────────────────────────────────────
 * POST  /api/generate_customer_report.php
 *   Body (JSON):
 *     lang           : 'ar' | 'en' | 'de'
 *     report         : CustomerReport object
 *     template       : ReportTemplate object
 *     siteName       : string
 *     siteLogo       : { type, text:{ar,en,de}, img }
 *     currency       : string
 *     soilAnalysis   : SoilRow[]
 *
 * Returns JSON { ok: true, pdf_base64: "...", file_url: "..." }
 * ─────────────────────────────────────────────────────────────────────────────
 * Requires dompdf v2:  composer require dompdf/dompdf
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['ok' => false, 'error' => 'POST required']); exit;
}

/* ── Load dompdf ── */
$autoload = __DIR__ . '/../vendor/autoload.php';
if (!file_exists($autoload)) {
    echo json_encode(['ok' => false, 'error' => 'dompdf not installed. Run: composer require dompdf/dompdf in the project root.']);
    exit;
}
require_once $autoload;
use Dompdf\Dompdf;
use Dompdf\Options;

/* ── Arabic glyph shaping (ar-php) ─────────────────────────────────────────
 * ar-php reshapes Arabic Unicode text into visual presentation forms so that
 * DejaVu Sans (bundled with dompdf) renders connected Arabic calligraphy.
 * Install with: composer require khaled-alshamaa/ar-php
 * ─────────────────────────────────────────────────────────────────────────*/
$ar_php = null;
if ($isRtl) {
    try {
        if (class_exists('\ArPHP\I18N\Arabic')) {
            $ar_php = new \ArPHP\I18N\Arabic();
        }
    } catch (\Throwable $_ex) {}
}

/* ── Parse body ── */
$body = json_decode(file_get_contents('php://input'), true);
if (!$body || !isset($body['report'])) {
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON or missing report']); exit;
}

$lang     = $body['lang']         ?? 'ar';
$report   = $body['report']       ?? [];
$tpl      = $body['template']     ?? [];
$siteName = $body['siteName']     ?? 'م.علاء أحمد المصري';
$siteLogo = $body['siteLogo']     ?? [];
$currency = $body['currency']     ?? '';
$soilRows = $body['soilAnalysis'] ?? [];

$isRtl = ($lang === 'ar');
$dir   = $isRtl ? 'rtl' : 'ltr';
$align = $isRtl ? 'right' : 'left';
$alignOpp = $isRtl ? 'left' : 'right';

/* ── Localisation ── */
$T = [
    'ar' => [
        'reportTitle'    => 'تقرير التشخيص الزراعي',
        'soilTitle'      => 'تقرير تحليل التربة',
        'diseaseTitle'   => 'تقرير مرض نباتي / فطري',
        'insectTitle'    => 'تقرير إصابة حشرية',
        'typeSoil'       => 'فحص تربة',
        'typeDisease'    => 'مرض نباتي / فطري',
        'typeInsect'     => 'إصابة حشرية',
        'date'           => 'التاريخ',
        'customer'       => 'بيانات العميل',
        'name'           => 'اسم العميل',
        'phone'          => 'رقم الهاتف',
        'location'       => 'الموقع',
        'attendance'     => 'تاريخ الحضور',
        'exam'           => 'تاريخ الفحص',
        'plant'          => 'النبات المزروع',
        'description'    => 'الوصف',
        'soilAnalysis'   => 'تحليل التربة',
        'examResults'    => 'نتائج الفحص',
        'test'           => 'عنصر الفحص',
        'actual'         => 'النتيجة الفعلية',
        'ideal'          => 'التربة المثالية',
        'finalTitle'     => 'التقرير النهائي الشامل',
        'pricingTitle'   => 'التكلفة والخدمات',
        'item'           => 'البند',
        'price'          => 'السعر',
        'tax'            => 'الضريبة %',
        'total'          => 'الإجمالي',
        'grandTotal'     => 'الإجمالي الكلي',
        'signature'      => 'التوقيع',
        'stamp'          => 'الختم',
    ],
    'en' => [
        'reportTitle'    => 'Agricultural Diagnostic Report',
        'soilTitle'      => 'Soil Analysis Report',
        'diseaseTitle'   => 'Plant / Fungal Disease Report',
        'insectTitle'    => 'Insect Infestation Report',
        'typeSoil'       => 'Soil Test',
        'typeDisease'    => 'Plant / Fungal Disease',
        'typeInsect'     => 'Insect Infestation',
        'date'           => 'Date',
        'customer'       => 'Customer Details',
        'name'           => 'Customer Name',
        'phone'          => 'Phone',
        'location'       => 'Location',
        'attendance'     => 'Attendance Date',
        'exam'           => 'Examination Date',
        'plant'          => 'Planted Crop',
        'description'    => 'Description',
        'soilAnalysis'   => 'Soil Analysis',
        'examResults'    => 'Examination Results',
        'test'           => 'Test Item',
        'actual'         => 'Actual Result',
        'ideal'          => 'Ideal / Target',
        'finalTitle'     => 'Final Comprehensive Report',
        'pricingTitle'   => 'Costs & Services',
        'item'           => 'Item',
        'price'          => 'Price',
        'tax'            => 'Tax %',
        'total'          => 'Total',
        'grandTotal'     => 'Grand Total',
        'signature'      => 'Signature',
        'stamp'          => 'Stamp',
    ],
    'de' => [
        'reportTitle'    => 'Agrardiagnosebericht',
        'soilTitle'      => 'Bodenanalysebericht',
        'diseaseTitle'   => 'Pflanzen- / Pilzkrankheitsbericht',
        'insectTitle'    => 'Insektenbefallsbericht',
        'typeSoil'       => 'Bodentest',
        'typeDisease'    => 'Pflanzen- / Pilzkrankheit',
        'typeInsect'     => 'Insektenbefall',
        'date'           => 'Datum',
        'customer'       => 'Kundendaten',
        'name'           => 'Kundenname',
        'phone'          => 'Telefon',
        'location'       => 'Standort',
        'attendance'     => 'Anwesenheitsdatum',
        'exam'           => 'Untersuchungsdatum',
        'plant'          => 'Angebaute Pflanze',
        'description'    => 'Beschreibung',
        'soilAnalysis'   => 'Bodenanalyse',
        'examResults'    => 'Untersuchungsergebnisse',
        'test'           => 'Testkriterium',
        'actual'         => 'Istwert',
        'ideal'          => 'Idealwert',
        'finalTitle'     => 'Abschließender Gesamtbericht',
        'pricingTitle'   => 'Kosten & Leistungen',
        'item'           => 'Position',
        'price'          => 'Preis',
        'tax'            => 'Steuer %',
        'total'          => 'Gesamt',
        'grandTotal'     => 'Gesamtsumme',
        'signature'      => 'Unterschrift',
        'stamp'          => 'Stempel',
    ],
];
$L = $T[$lang] ?? $T['ar'];

/* ── Helper functions ── */

/**
 * Encode HTML + optionally reshape Arabic glyphs for dompdf.
 * When ar-php is installed and lang='ar', Arabic characters are converted
 * to visual presentation forms (connected calligraphy) and wrapped in a
 * dir="ltr" span so dompdf does not double-reverse the visual order.
 */
function he(string $s): string {
    global $ar_php, $isRtl;
    $enc = htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    if (!$isRtl || $ar_php === null || trim($s) === '') return $enc;
    /* Only process strings that actually contain Arabic script */
    if (!preg_match('/[\x{0600}-\x{06FF}\x{0750}-\x{077F}]/u', $s)) return $enc;
    try {
        $shaped = htmlspecialchars($ar_php->utf8Glyphs($s), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        return '<span dir="ltr" style="unicode-bidi:bidi-override;">' . $shaped . '</span>';
    } catch (\Throwable $_ex) {
        return $enc;
    }
}

/**
 * Same as he() but preserves newlines as <br/> tags.
 * Each line is reshaped independently so dompdf line breaks stay intact.
 */
function nl2br_he(string $s): string {
    global $ar_php, $isRtl;
    if (!$isRtl || $ar_php === null || trim($s) === '') {
        return nl2br(htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'));
    }
    $lines = explode("\n", str_replace(["\r\n", "\r"], "\n", $s));
    $parts = [];
    foreach ($lines as $line) {
        $enc = htmlspecialchars($line, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        if (trim($line) === '' || !preg_match('/[\x{0600}-\x{06FF}]/u', $line)) {
            $parts[] = $enc;
            continue;
        }
        try {
            $shaped = htmlspecialchars($ar_php->utf8Glyphs($line), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
            $parts[] = '<span dir="ltr" style="unicode-bidi:bidi-override;">' . $shaped . '</span>';
        } catch (\Throwable $_ex) {
            $parts[] = $enc;
        }
    }
    return implode('<br/>', $parts);
}
function pml(array $ml, string $lang): string {
    return $ml[$lang] ?? $ml['ar'] ?? $ml['en'] ?? '';
}
function withCur(string $num, string $currency): string {
    return $currency ? "$num $currency" : $num;
}

/* ── Extract data ── */
$rType        = $report['reportType'] ?? 'soil';
$custName     = $report['customerName']     ?? '';
$custPhone    = $report['customerPhone']    ?? '';
$custLocation = $report['customerLocation'] ?? '';
$attDate      = $report['attendanceDate']   ?? '';
$exDate       = $report['examDate']         ?? '';
$images       = array_filter($report['images'] ?? []);
$plantName    = pml($report['plantName']    ?? [], $lang);
$descTxt      = pml($report['description'] ?? [], $lang);
$finalTxt     = pml($report['finalReport'] ?? [], $lang);
$rows         = array_values(array_filter($report['soilRows'] ?? [], function($r) use ($lang) {
    return pml($r['test'] ?? [], $lang) || pml($r['actual'] ?? [], $lang) || pml($r['ideal'] ?? [], $lang);
}));

$theme        = ($tpl['themeColor'] ?? '#2a7a2a') ?: '#2a7a2a';
$headerTxt    = pml($tpl['headerText'] ?? [], $lang);
$footerTxt    = pml($tpl['footerText'] ?? [], $lang);
$headerLogo   = $tpl['headerLogo']    ?? '';
$engSig       = $tpl['engSignature']  ?? '';
$engStamp     = $tpl['engStamp']      ?? '';
$paidStamp    = $tpl['paidStamp']     ?? '';

/* ── Logo HTML ── */
$logoType = $siteLogo['type'] ?? 'text';
if ($headerLogo) {
    $logoHtml = '<img src="' . $headerLogo . '" style="height:52px;object-fit:contain;" />';
} elseif ($logoType === 'image' && !empty($siteLogo['img'])) {
    $logoHtml = '<img src="' . he($siteLogo['img']) . '" style="height:52px;object-fit:contain;" />';
} else {
    $logoTxt  = pml($siteLogo['text'] ?? [], $lang) ?: he($siteName);
    $logoHtml = '<div style="font-weight:900;color:#003366;font-size:15pt;line-height:1.2;">' . he($logoTxt) . '</div>';
}

/* ── Report type labels ── */
$docTitle = $rType === 'disease' ? $L['diseaseTitle'] : ($rType === 'insect' ? $L['insectTitle'] : $L['soilTitle']);
$typeLabel = $rType === 'disease' ? $L['typeDisease'] : ($rType === 'insect' ? $L['typeInsect'] : $L['typeSoil']);
$fullTitle = $custName ? $docTitle . ' — ' . $custName : $docTitle;
$rowsTitle = $rType === 'soil' ? $L['soilAnalysis'] : $L['examResults'];
$reportDate = $exDate ?: $attDate ?: date('Y-m-d');

/* ── Customer info fields ── */
$infoFields = array_filter([
    $custName     ? [$L['name'],       $custName]     : null,
    $custPhone    ? [$L['phone'],      $custPhone]    : null,
    $custLocation ? [$L['location'],   $custLocation] : null,
    $attDate      ? [$L['attendance'], $attDate]      : null,
    $exDate       ? [$L['exam'],       $exDate]       : null,
]);

/* ── Pricing table ── */
$priceRows = array_values(array_filter($soilRows ?? [], function($r) {
    return ($r['name'] ?? '') || ($r['price'] ?? '') || ($r['tax'] ?? '');
}));
$grandTotal = 0;
foreach ($priceRows as $pr) {
    $grandTotal += (floatval($pr['price'] ?? 0)) * (1 + (floatval($pr['tax'] ?? 0) / 100));
}

/* ── Estimate page height for single-page output ── */
$BASE_H     = 220;  // header + footer buffer
$IMG_H      = count($images) > 0 ? 110 : 0;
$INFO_H     = count($infoFields) > 0 ? (ceil(count($infoFields) / 2) * 30 + 50) : 0;
$DESC_H     = $descTxt  ? (ceil(strlen($descTxt)  / 80) * 15 + 40) : 0;
$FINAL_H    = $finalTxt ? (ceil(strlen($finalTxt) / 80) * 15 + 40) : 0;
$PLANT_H    = $plantName ? 35 : 0;
$TABLE_H    = count($rows)       > 0 ? (count($rows)       * 22 + 50) : 0;
$PRICE_H    = count($priceRows)  > 0 ? (count($priceRows)  * 22 + 60) : 0;
$SIG_H      = 100;

$estimatedPx = $BASE_H + $IMG_H + $INFO_H + $DESC_H + $FINAL_H + $PLANT_H + $TABLE_H + $PRICE_H + $SIG_H;
/* Convert px (96 DPI) to pt (72 DPI): px * 72/96 = px * 0.75 */
$estimatedPt = $estimatedPx * 0.75;
/* A4 width = 595pt; single-page height = estimated + 80pt padding */
$pageHeight  = max(595.0, $estimatedPt + 80);
/* Cap at 4800pt (~167cm) to avoid dompdf memory issues on huge reports */
$pageHeight  = min(4800.0, $pageHeight);

/* ── Build HTML ── */
ob_start();
?>
<!DOCTYPE html>
<html dir="<?= $dir ?>" lang="<?= $lang ?>">
<head>
<meta charset="UTF-8">
<style>
@page { size: 595pt <?= round($pageHeight, 2) ?>pt; margin: 18mm 13mm 16mm 13mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
    font-family: 'DejaVu Sans', 'Noto Sans Arabic', Arial, sans-serif;
    font-size: 10.5pt;
    color: #222;
    direction: <?= $dir ?>;
    line-height: 1.55;
}
table { border-collapse: collapse; width: 100%; }
img { max-width: 100%; }
.sec-title {
    font-weight: 900;
    color: <?= $theme ?>;
    font-size: 11.5pt;
    margin: 12pt 0 6pt 0;
    padding-<?= $align ?>: 8pt;
    border-<?= $align ?>: 4pt solid <?= $theme ?>;
}
.field-box {
    background: #f7faf7;
    border: 1pt solid #daeada;
    border-radius: 4pt;
    padding: 5pt 8pt;
    margin-bottom: 5pt;
}
.field-label { font-size: 8pt; color: #8a9a8a; margin-bottom: 2pt; }
.field-value { font-size: 10pt; font-weight: 600; color: #1d3a1d; word-wrap: break-word; }
.pre-wrap    { white-space: pre-wrap; line-height: 1.7; font-size: 10.5pt; color: #333; }
</style>
</head>
<body>

<!-- ── HEADER ──────────────────────────────────────────────── -->
<table cellpadding="0" cellspacing="0" style="width:100%;border-bottom:3pt solid <?= $theme ?>;padding-bottom:12pt;margin-bottom:14pt;">
  <tr>
    <td style="vertical-align:middle;text-align:<?= $align ?>;">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;"><?= $logoHtml ?></td>
          <?php if ($headerTxt): ?>
          <td style="vertical-align:middle;padding-<?= $alignOpp ?>:8pt;">
            <div style="font-weight:700;color:<?= $theme ?>;font-size:10pt;"><?= he($headerTxt) ?></div>
          </td>
          <?php endif; ?>
        </tr>
      </table>
    </td>
    <td style="vertical-align:middle;text-align:<?= $alignOpp ?>;">
      <div style="font-weight:900;color:<?= $theme ?>;font-size:13pt;"><?= he($fullTitle) ?></div>
      <div style="margin-top:5pt;display:inline-block;background:<?= $theme ?>;color:#fff;font-size:9pt;font-weight:700;border-radius:12pt;padding:2pt 10pt;">
        <?= he($typeLabel) ?>
      </div>
      <div style="font-size:9pt;color:#777;margin-top:4pt;"><?= he($L['date']) ?>: <?= he($reportDate) ?></div>
    </td>
  </tr>
</table>

<!-- ── CUSTOMER INFO ────────────────────────────────────────── -->
<?php if ($infoFields): ?>
<div class="sec-title"><?= he($L['customer']) ?></div>
<table cellpadding="4" cellspacing="0" style="margin-bottom:12pt;">
<?php
$fields = array_values($infoFields);
for ($i = 0; $i < count($fields); $i += 2):
    $f1 = $fields[$i];
    $f2 = $fields[$i + 1] ?? null;
?>
  <tr>
    <td width="50%" style="vertical-align:top;padding-<?= $alignOpp ?>:5pt;">
      <div class="field-box">
        <div class="field-label"><?= he($f1[0]) ?></div>
        <div class="field-value"><?= he($f1[1]) ?></div>
      </div>
    </td>
    <td width="50%" style="vertical-align:top;">
      <?php if ($f2): ?>
      <div class="field-box">
        <div class="field-label"><?= he($f2[0]) ?></div>
        <div class="field-value"><?= he($f2[1]) ?></div>
      </div>
      <?php endif; ?>
    </td>
  </tr>
<?php endfor; ?>
</table>
<?php endif; ?>

<!-- ── IMAGES ───────────────────────────────────────────────── -->
<?php if ($images): ?>
<?php
$imgs    = array_slice($images, 0, 6);
$cnt     = count($imgs);
$colPct  = $cnt <= 3 ? floor(100 / $cnt) : 24;
?>
<table cellpadding="3" cellspacing="0" style="margin-bottom:14pt;">
  <tr>
<?php foreach ($imgs as $img): ?>
    <td width="<?= $colPct ?>%" style="text-align:center;vertical-align:top;">
      <img src="<?= $img ?>" style="width:100%;max-height:95pt;object-fit:cover;border-radius:4pt;border:1.5pt solid <?= $theme ?>;" />
    </td>
<?php endforeach; ?>
  </tr>
</table>
<?php endif; ?>

<!-- ── PLANT NAME ───────────────────────────────────────────── -->
<?php if ($plantName): ?>
<div class="field-box" style="margin-bottom:10pt;">
  <div class="field-label">🌱 <?= he($L['plant']) ?></div>
  <div class="field-value" style="font-size:11pt;"><?= he($plantName) ?></div>
</div>
<?php endif; ?>

<!-- ── DESCRIPTION ──────────────────────────────────────────── -->
<?php if ($descTxt): ?>
<div class="sec-title"><?= he($L['description']) ?></div>
<div class="pre-wrap" style="margin-bottom:12pt;"><?= nl2br_he($descTxt) ?></div>
<?php endif; ?>

<!-- ── SOIL / EXAM TABLE ────────────────────────────────────── -->
<?php if ($rows): ?>
<div class="sec-title"><?= he($rowsTitle) ?></div>
<table cellpadding="0" cellspacing="0" style="margin-bottom:14pt;font-size:10pt;">
  <thead>
    <tr style="background:<?= $theme ?>;color:#fff;">
      <th style="padding:6pt 8pt;text-align:<?= $align ?>;"><?= he($L['test']) ?></th>
      <th style="padding:6pt 8pt;text-align:<?= $align ?>;"><?= he($L['actual']) ?></th>
      <th style="padding:6pt 8pt;text-align:<?= $align ?>;"><?= he($L['ideal']) ?></th>
    </tr>
  </thead>
  <tbody>
<?php foreach ($rows as $i => $row): ?>
    <tr style="background:<?= $i % 2 ? '#fff' : '#f6faf6' ?>;">
      <td style="padding:5pt 8pt;border-bottom:1pt solid #e8f0e8;font-weight:700;color:#1d3a1d;"><?= he(pml($row['test']   ?? [], $lang)) ?></td>
      <td style="padding:5pt 8pt;border-bottom:1pt solid #e8f0e8;"><?= he(pml($row['actual'] ?? [], $lang)) ?></td>
      <td style="padding:5pt 8pt;border-bottom:1pt solid #e8f0e8;color:<?= $theme ?>;font-weight:600;"><?= he(pml($row['ideal']  ?? [], $lang)) ?></td>
    </tr>
<?php endforeach; ?>
  </tbody>
</table>
<?php endif; ?>

<!-- ── FINAL REPORT ─────────────────────────────────────────── -->
<?php if ($finalTxt): ?>
<div class="sec-title"><?= he($L['finalTitle']) ?></div>
<div class="pre-wrap" style="margin-bottom:14pt;"><?= nl2br_he($finalTxt) ?></div>
<?php endif; ?>

<!-- ── PRICING TABLE ────────────────────────────────────────── -->
<?php if ($priceRows): ?>
<div class="sec-title"><?= he($L['pricingTitle']) ?></div>
<table cellpadding="0" cellspacing="0" style="margin-bottom:14pt;font-size:10pt;">
  <thead>
    <tr style="background:<?= $theme ?>;color:#fff;">
      <th style="padding:6pt 8pt;text-align:<?= $align ?>;"><?= he($L['item']) ?></th>
      <th style="padding:6pt 8pt;text-align:<?= $align ?>;"><?= he($L['price']) ?></th>
      <th style="padding:6pt 8pt;text-align:<?= $align ?>;"><?= he($L['tax']) ?></th>
      <th style="padding:6pt 8pt;text-align:<?= $align ?>;"><?= he($L['total']) ?></th>
    </tr>
  </thead>
  <tbody>
<?php foreach ($priceRows as $i => $pr):
    $pName  = is_array($pr['name'] ?? null) ? pml($pr['name'], $lang) : ($pr['name'] ?? '');
    $pPrice = $pr['price'] ?? '';
    $pTax   = $pr['tax']   ?? '';
    $pTot   = $pPrice ? number_format((floatval($pPrice)) * (1 + floatval($pTax) / 100), 2) : '';
?>
    <tr style="background:<?= $i % 2 ? '#fff' : '#f6faf6' ?>;">
      <td style="padding:5pt 8pt;border-bottom:1pt solid #e8f0e8;font-weight:700;color:#1d3a1d;"><?= he($pName) ?></td>
      <td style="padding:5pt 8pt;border-bottom:1pt solid #e8f0e8;direction:ltr;"><?= $pPrice ? he(withCur($pPrice, $currency)) : '' ?></td>
      <td style="padding:5pt 8pt;border-bottom:1pt solid #e8f0e8;direction:ltr;"><?= he($pTax) ?></td>
      <td style="padding:5pt 8pt;border-bottom:1pt solid #e8f0e8;direction:ltr;font-weight:700;color:<?= $theme ?>;"><?= $pTot ? he(withCur($pTot, $currency)) : '' ?></td>
    </tr>
<?php endforeach; ?>
  </tbody>
  <tfoot>
    <tr style="background:#eef6ee;">
      <td colspan="3" style="padding:6pt 8pt;font-weight:800;"><?= he($L['grandTotal']) ?></td>
      <td style="padding:6pt 8pt;direction:ltr;font-weight:900;color:<?= $theme ?>;"><?= he(withCur(number_format($grandTotal, 2), $currency)) ?></td>
    </tr>
  </tfoot>
</table>
<?php endif; ?>

<!-- ── FOOTER: signature + stamps ───────────────────────────── -->
<div style="margin-top:20pt;border-top:2pt solid <?= $theme ?>;padding-top:14pt;">
  <table cellpadding="0" cellspacing="0" style="width:100%;">
    <tr>
      <td style="vertical-align:bottom;font-size:8.5pt;color:#666;line-height:1.7;text-align:<?= $align ?>;">
        <?= he($footerTxt) ?>
      </td>
      <td style="vertical-align:bottom;text-align:<?= $alignOpp ?>;white-space:nowrap;width:1%;">
        <table cellpadding="6" cellspacing="0">
          <tr>
<?php if ($paidStamp): ?>
            <td style="text-align:center;vertical-align:bottom;">
              <img src="<?= $paidStamp ?>" style="max-height:72pt;max-width:88pt;object-fit:contain;" />
            </td>
<?php endif; ?>
<?php if ($engStamp): ?>
            <td style="text-align:center;vertical-align:bottom;">
              <img src="<?= $engStamp ?>" style="max-height:72pt;max-width:88pt;object-fit:contain;" />
            </td>
<?php endif; ?>
            <td style="text-align:center;vertical-align:bottom;min-width:100pt;">
              <?php if ($engSig): ?>
              <img src="<?= $engSig ?>" style="max-height:52pt;max-width:130pt;object-fit:contain;" /><br/>
              <?php else: ?>
              <div style="height:52pt;"></div>
              <?php endif; ?>
              <div style="border-top:1pt solid #aaa;margin-top:4pt;padding-top:4pt;font-size:9pt;font-weight:700;color:#444;">
                <?= he($L['signature']) ?>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>

</body>
</html>
<?php
$html = ob_get_clean();

/* ── Render PDF with dompdf ── */
try {
    $opts = new Options();
    $opts->set('defaultFont',          'DejaVu Sans');
    $opts->set('isRemoteEnabled',      true);
    $opts->set('isHtml5ParserEnabled', true);
    $opts->set('dpi',                  150);
    $opts->set('chroot',               realpath(__DIR__ . '/..'));

    $dompdf = new Dompdf($opts);
    $dompdf->loadHtml($html, 'UTF-8');

    /* Single-page: custom width=595pt (A4), height=estimated */
    $dompdf->setPaper([0, 0, 595.28, round($pageHeight, 2)], 'portrait');
    $dompdf->render();

    $pdfBytes = $dompdf->output();
    $base64   = base64_encode($pdfBytes);

    /* Optionally save for direct URL sharing (WhatsApp link) */
    $safeName   = preg_replace('/[^a-zA-Z0-9_\-.أ-ي]/', '_', $custName ?: 'report');
    $fileName   = 'Report_' . $safeName . '_' . $lang . '_' . date('Ymd') . '.pdf';
    $fileUrl    = '';
    $reportsDir = __DIR__ . '/../reports/';
    if (!is_dir($reportsDir)) { @mkdir($reportsDir, 0755, true); }
    $savePath = $reportsDir . $fileName;
    if (@file_put_contents($savePath, $pdfBytes) !== false) {
        $proto   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host    = $_SERVER['HTTP_HOST'] ?? '';
        $base    = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
        $fileUrl = $proto . '://' . $host . $base . '/reports/' . rawurlencode($fileName);
    }

    echo json_encode([
        'ok'         => true,
        'pdf_base64' => $base64,
        'file_url'   => $fileUrl,
        'file_name'  => $fileName,
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
