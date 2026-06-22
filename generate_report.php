<?php
/**
 * generate_report.php — Agricultural Diagnostic PDF Generator
 * Uses dompdf + khaled-alshamaa/ar-php for correct Arabic shaping.
 *
 * Arabic fix: utf8Glyphs() converts Arabic Unicode to visual-order glyph forms
 * that dompdf can render correctly. Text containers must use direction:ltr after
 * this conversion (the glyph string is already in visual left-to-right order).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

@ini_set('memory_limit', '256M');
@ini_set('max_execution_time', '120');

$pdfDone = false;
function pdfRespond(int $code, array $payload): void
{
    global $pdfDone;
    if ($pdfDone) {
        return;
    }
    $pdfDone = true;
    if (!headers_sent()) {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

register_shutdown_function(function (): void {
    global $pdfDone;
    if ($pdfDone) {
        return;
    }
    $err = error_get_last();
    if (!$err || !in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        return;
    }
    pdfRespond(500, ['ok' => false, 'error' => 'PDF server error: ' . ($err['message'] ?? 'unknown')]);
});

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    pdfRespond(405, ['ok' => false, 'error' => 'POST required']);
}

if (PHP_VERSION_ID < 80000) {
    pdfRespond(500, [
        'ok'    => false,
        'error' => 'PHP 8.0+ required. In Hostinger hPanel set PHP version to 8.1 or 8.2 for this domain.',
    ]);
}

/* ── Load dompdf via Composer ── */
$autoload = null;
foreach ([__DIR__ . '/vendor/autoload.php', dirname(__DIR__) . '/vendor/autoload.php'] as $candidate) {
    if (is_file($candidate)) {
        $autoload = $candidate;
        break;
    }
}
if (!$autoload) {
    pdfRespond(500, [
        'ok'    => false,
        'error' => 'dompdf not installed. Upload the vendor/ folder next to generate_report.php on Hostinger.',
    ]);
}
try {
    require_once $autoload;
} catch (Throwable $e) {
    pdfRespond(500, ['ok' => false, 'error' => 'Failed to load PDF libraries: ' . $e->getMessage()]);
}
use Dompdf\Dompdf;
use Dompdf\Options;

/* ── Parse request body ── */
$body = file_get_contents('php://input');
if ($body === false || $body === '') {
    pdfRespond(413, [
        'ok'    => false,
        'error' => 'Empty request body. Images may exceed post_max_size on the server — try fewer/smaller photos.',
    ]);
}
$data = json_decode($body, true);
$reportHtmlRaw     = trim($data['reportHtml'] ?? '');
$reportSnapshotRaw = trim($data['reportSnapshot'] ?? '');
if (!$data || ($reportSnapshotRaw === '' && $reportHtmlRaw === '' && !isset($data['result']))) {
    pdfRespond(400, ['ok' => false, 'error' => 'Invalid JSON or missing result/reportSnapshot']);
}

$lang       = $data['lang']         ?? 'ar';
$fileName   = preg_replace('/[^a-zA-Z0-9_\-.]/', '_', $data['fileName'] ?? 'Plant_Report.pdf');
$pageBgColor = $data['pageBgColor']   ?? '#ffffff';
$theme      = $data['themeColor']   ?? '#2a7a2a';

/* ── Font paths (shared by preview-HTML and legacy template paths) ── */
$tajawalDir     = __DIR__ . '/vendor/dompdf/dompdf/lib/fonts/';
$tajawalRegular = $tajawalDir . 'Tajawal-Regular.ttf';
$tajawalBold    = $tajawalDir . 'Tajawal-Bold.ttf';
$tajawalRegularSrc = file_exists($tajawalRegular)
    ? 'url("' . $tajawalRegular . '") format("truetype")'
    : 'url("https://fonts.gstatic.com/s/tajawal/v9/Iurf6YBj_oCad4k1rzaLCr5IlLA.ttf") format("truetype")';
$tajawalBoldSrc = file_exists($tajawalBold)
    ? 'url("' . $tajawalBold . '") format("truetype")'
    : 'url("https://fonts.gstatic.com/s/tajawal/v9/Iura6YBj_oCad4k1nzSBC45I1LA.ttf") format("truetype")';

/* ── Arabic shaping (ar-php) — shared by preview-HTML + legacy template ── */
const AR_DIGITS = [
    '٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4',
    '٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9',
    '۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4',
    '۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9',
];

function arNorm(string $s): string
{
    return strtr($s, AR_DIGITS);
}

function loadArabicShaper(string $lang): ?\ArPHP\I18N\Arabic
{
    if ($lang !== 'ar') {
        return null;
    }
    $arPhpPath = __DIR__ . '/vendor/khaled-alshamaa/ar-php/src/Arabic.php';
    if (!file_exists($arPhpPath)) {
        return null;
    }
    require_once $arPhpPath;
    return new \ArPHP\I18N\Arabic();
}

/** Shape one Arabic string for dompdf (visual LTR glyph order — document must stay dir=ltr). */
function shapeArabicText(?\ArPHP\I18N\Arabic $arObj, string $raw): string
{
    if (!$arObj || trim($raw) === '') {
        return $raw;
    }
    /* Do not force RTL block reversal — dompdf reads glyphs in logical order inside dir=ltr spans */
    return strtr($arObj->utf8Glyphs(arNorm($raw), 2000, false, false), AR_DIGITS);
}

function appendInlineStyle(DOMElement $el, string $extra): void
{
    $style = trim($el->getAttribute('style') ?? '');
    $el->setAttribute('style', ($style === '' ? '' : rtrim($style, ';') . ';') . $extra);
}

/** After utf8Glyphs: flip layout to match RTL preview while keeping glyph direction ltr. */
function applyArabicPdfLayout(DOMDocument $doc, string $theme): void
{
    $root = $doc->getElementById('pdf-root');
    if (!$root || !($root->firstChild instanceof DOMElement)) {
        return;
    }
    $printRoot = $root->firstChild;
    $printRoot->setAttribute('dir', 'ltr');
    $cls = trim($printRoot->getAttribute('class') . ' pdf-ar-root');
    $printRoot->setAttribute('class', $cls);
    appendInlineStyle($printRoot, 'text-align:right;');

    if ($printRoot->firstChild instanceof DOMElement) {
        appendInlineStyle($printRoot->firstChild, 'flex-direction:row-reverse;');
    }

    foreach ($doc->getElementsByTagName('table') as $table) {
        if ($table instanceof DOMElement) {
            appendInlineStyle($table, 'direction:rtl;width:100%;border-collapse:collapse;');
        }
    }
    foreach ($doc->getElementsByTagName('th') as $th) {
        if ($th instanceof DOMElement) {
            appendInlineStyle($th, 'text-align:right;vertical-align:middle;');
        }
    }
    foreach ($doc->getElementsByTagName('td') as $td) {
        if ($td instanceof DOMElement) {
            appendInlineStyle($td, 'text-align:right;vertical-align:middle;');
        }
    }

    $xpath = new DOMXPath($doc);
    foreach ($xpath->query('//*[@style]') as $el) {
        if (!$el instanceof DOMElement) {
            continue;
        }
        $style = $el->getAttribute('style');
        if (stripos($style, 'border-inline-start') !== false || stripos($style, 'borderInlineStart') !== false) {
            appendInlineStyle($el, 'border-left:none;border-right:4px solid ' . $theme . ';padding-right:8px;padding-left:0;');
        }
        if (preg_match('/font-size:\s*10/i', $style)) {
            appendInlineStyle($el, 'direction:rtl;text-align:right;');
        }
        if (preg_match('/font-size:\s*12\.5/i', $style) && preg_match('/font-weight:\s*600/i', $style)) {
            appendInlineStyle($el, 'text-align:right;');
        }
    }
}

/**
 * arG() — Arabic glyph shaper for legacy PHP template.
 * Returns HTML-safe string. Pass $ltr=true for scientific names / English.
 */
function arG(?string $s, bool $ltr = false): string
{
    global $arObj, $isRtl;
    $s = $s ?? '—';
    if ($s === '' || $s === '—') {
        return '—';
    }

    $s = strtr($s, AR_DIGITS);
    $safe = htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    if ($isRtl && $arObj && !$ltr) {
        $glyphed = htmlspecialchars(shapeArabicText($arObj, $s), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        return '<span class="pdf-ar-glyphs" style="direction:ltr;display:inline-block;text-align:right;unicode-bidi:embed;">'
            . $glyphed . '</span>';
    }
    return $safe;
}

/** Shape nutrient name with separate Latin symbol e.g. "النيتروجين (N)" */
function shapeNutrientName(?\ArPHP\I18N\Arabic $arObj, string $raw): string
{
    $raw = trim($raw);
    if (preg_match('/^(.+?)\s*\(([A-Za-z]+)\)\s*$/u', $raw, $m)) {
        return shapeArabicText($arObj, trim($m[1])) . ' (' . $m[2] . ')';
    }
    return shapeArabicText($arObj, $raw);
}

function elementSkipsArabicShaping(DOMElement $el): bool
{
    if ($el->getAttribute('data-pdf-ltr') === '1') {
        return true;
    }
    $style = $el->getAttribute('style');
    if (preg_match('/direction\s*:\s*ltr/i', $style)
        && !preg_match('/[\x{0600}-\x{06FF}]/u', $el->textContent ?? '')) {
        return true;
    }
    return false;
}

function elementTextAlignForPdf(DOMElement $el, bool $isRtl): string
{
    $style = $el->getAttribute('style');
    if (preg_match('/text-align\s*:\s*(center|right|left|start|end)/i', $style, $m)) {
        $align = strtolower($m[1]);
        if ($align === 'start') {
            return $isRtl ? 'right' : 'left';
        }
        if ($align === 'end') {
            return $isRtl ? 'left' : 'right';
        }
        return $align;
    }
    return $isRtl ? 'right' : 'left';
}

/** Shape one block element (table cell) or walk mixed markup inside field values. */
function shapeArabicElement(DOMElement $el, ?\ArPHP\I18N\Arabic $arObj, DOMDocument $doc, bool $isRtl): void
{
    if (!$arObj || elementSkipsArabicShaping($el)) {
        return;
    }
    if ($el->getAttribute('class') === 'pdf-field-value' || elementHasElementChildren($el)) {
        shapeArabicInElementTree($el, $arObj, $doc, $isRtl);
        return;
    }
    $raw = $el->textContent ?? '';
    if (trim($raw) === '' || !preg_match('/[\x{0600}-\x{06FF}]/u', $raw)) {
        return;
    }
    if ($el->childNodes->length === 1
        && $el->firstChild instanceof DOMElement
        && $el->firstChild->getAttribute('class') === 'pdf-ar-glyphs') {
        return;
    }

    $align = elementTextAlignForPdf($el, $isRtl);
    while ($el->firstChild) {
        $el->removeChild($el->firstChild);
    }
    if ($el->getAttribute('data-pdf-nutrient-name') === '1' || preg_match('/\([A-Za-z]+\)/', $raw)) {
        $shaped = shapeNutrientName($arObj, $raw);
    } else {
        $shaped = shapeArabicText($arObj, $raw);
    }
    $span = $doc->createElement('span');
    $span->setAttribute('class', 'pdf-ar-glyphs');
    $span->setAttribute(
        'style',
        'direction:ltr;display:block;width:100%;text-align:' . $align
        . ';unicode-bidi:embed;white-space:pre-wrap;word-wrap:break-word;'
    );
    $span->appendChild($doc->createTextNode($shaped));
    $el->appendChild($span);
}

function elementHasElementChildren(DOMElement $el): bool
{
    foreach ($el->childNodes as $child) {
        if ($child instanceof DOMElement) {
            return true;
        }
    }
    return false;
}

function shapeArabicTextNode(DOMText $textNode, ?\ArPHP\I18N\Arabic $arObj, DOMDocument $doc, bool $isRtl): void
{
    if (!$arObj) {
        return;
    }
    $parent = $textNode->parentNode;
    if (!$parent instanceof DOMElement) {
        return;
    }
    $raw = $textNode->nodeValue ?? '';
    if (trim($raw) === '' || !preg_match('/[\x{0600}-\x{06FF}]/u', $raw)) {
        return;
    }
    $shaped = shapeArabicText($arObj, $raw);
    $align = elementTextAlignForPdf($parent, $isRtl);
    $span = $doc->createElement('span');
    $span->setAttribute('class', 'pdf-ar-glyphs');
    $span->setAttribute(
        'style',
        'direction:ltr;display:inline-block;text-align:' . $align . ';unicode-bidi:embed;'
    );
    $span->appendChild($doc->createTextNode($shaped));
    $parent->replaceChild($span, $textNode);
}

function shapeArabicInElementTree(DOMElement $el, ?\ArPHP\I18N\Arabic $arObj, DOMDocument $doc, bool $isRtl): void
{
    if (!$arObj) {
        return;
    }
    $textNodes = [];
    foreach ($el->childNodes as $child) {
        if ($child instanceof DOMText) {
            $textNodes[] = $child;
        } elseif ($child instanceof DOMElement) {
            $cls = $child->getAttribute('class');
            if ($child->getAttribute('data-pdf-ltr') === '1'
                || $cls === 'pdf-latin'
                || $cls === 'pdf-ar-glyphs') {
                continue;
            }
            shapeArabicInElementTree($child, $arObj, $doc, $isRtl);
        }
    }
    foreach ($textNodes as $textNode) {
        shapeArabicTextNode($textNode, $arObj, $doc, $isRtl);
    }
}

function textNodeInsideShapedBlock(DOMText $node): bool
{
    $p = $node->parentNode;
    while ($p instanceof DOMElement) {
        if ($p->getAttribute('class') === 'pdf-ar-glyphs') {
            return true;
        }
        if (in_array(strtolower($p->nodeName), ['td', 'th'], true)) {
            return false;
        }
        $p = $p->parentNode;
    }
    return false;
}

function textNodeSkipsArabicShaping(DOMText $node): bool
{
    $p = $node->parentNode;
    while ($p instanceof DOMElement) {
        if ($p->getAttribute('data-pdf-ltr') === '1') {
            return true;
        }
        if (in_array(strtolower($p->nodeName), ['td', 'th'], true)) {
            return true;
        }
        if ($p->getAttribute('class') === 'pdf-field-value') {
            return true;
        }
        if (in_array($p->getAttribute('class'), ['pdf-ar-glyphs', 'pdf-latin'], true)) {
            return true;
        }
        $p = $p->parentNode;
    }
    return false;
}

/** Shape Arabic in captured preview HTML for dompdf + Tajawal */
function shapeArabicPreviewHtml(string $html, ?\ArPHP\I18N\Arabic $arObj, string $theme = '#2a7a2a'): string
{
    if (!$arObj || !preg_match('/[\x{0600}-\x{06FF}]/u', $html)) {
        return $html;
    }

    libxml_use_internal_errors(true);
    $doc = new DOMDocument('1.0', 'UTF-8');
    $doc->loadHTML(
        '<?xml encoding="UTF-8"><div id="pdf-root">' . $html . '</div>',
        LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
    );
    libxml_clear_errors();

    $xpath = new DOMXPath($doc);
    $isRtl = true;

    foreach ($xpath->query('//td | //th | //*[contains(@class,"pdf-field-value")]') as $el) {
        if ($el instanceof DOMElement) {
            shapeArabicElement($el, $arObj, $doc, $isRtl);
        }
    }

    $textNodes = [];
    foreach ($xpath->query('//text()') as $n) {
        $textNodes[] = $n;
    }
    foreach ($textNodes as $textNode) {
        if (!($textNode instanceof DOMText)) {
            continue;
        }
        $parent = $textNode->parentNode;
        if (!$parent || in_array(strtolower($parent->nodeName), ['script', 'style'], true)) {
            continue;
        }
        if (textNodeInsideShapedBlock($textNode) || textNodeSkipsArabicShaping($textNode)) {
            continue;
        }
        $raw = $textNode->nodeValue ?? '';
        if (trim($raw) === '' || !preg_match('/[\x{0600}-\x{06FF}]/u', $raw)) {
            continue;
        }
        $shaped = shapeArabicText($arObj, $raw);
        $align = $parent instanceof DOMElement ? elementTextAlignForPdf($parent, $isRtl) : 'right';
        $span = $doc->createElement('span');
        $span->setAttribute('class', 'pdf-ar-glyphs');
        $span->setAttribute(
            'style',
            'direction:ltr;display:inline-block;text-align:' . $align . ';unicode-bidi:embed;'
        );
        $span->appendChild($doc->createTextNode($shaped));
        $parent->replaceChild($span, $textNode);
    }

    applyArabicPdfLayout($doc, $theme);

    $root = $doc->getElementById('pdf-root');
    if (!$root) {
        return $html;
    }
    $out = '';
    foreach ($root->childNodes as $child) {
        $out .= $doc->saveHTML($child);
    }
    return $out;
}

/**
 * Wrap browser-captured preview HTML — preserve inline layout; only add fonts + Arabic glyph helpers.
 */
function wrapPreviewHtmlForPdf(string $inner, string $pageBg, string $dir, string $lang, string $regularSrc, string $boldSrc, bool $arabicShaped = false): string
{
    $inner = preg_replace('/<script\b[^>]*>.*?<\/script>/is', '', $inner);
    $bg    = htmlspecialchars($pageBg, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $lang  = htmlspecialchars($lang, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    /* Shaped Arabic glyphs MUST render in dir=ltr — rtl on html reverses sentence order */
    $htmlDir = $arabicShaped ? 'ltr' : htmlspecialchars($dir, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    $arCss = $arabicShaped
        ? '.plant-report-print-root.pdf-ar-root{direction:ltr!important;text-align:right!important;}'
        . '.plant-report-print-root.pdf-ar-root table{direction:rtl!important;}'
        . '.plant-report-print-root.pdf-ar-root th,.plant-report-print-root.pdf-ar-root td{text-align:right!important;}'
        . '.plant-report-print-root.pdf-ar-root .pdf-ar-glyphs{direction:ltr!important;text-align:right!important;unicode-bidi:embed;white-space:pre-wrap;word-wrap:break-word;}'
        : '';

    return '<!DOCTYPE html><html dir="' . $htmlDir . '" lang="' . $lang . '"><head><meta charset="UTF-8"><style>'
        . '@font-face{font-family:\'Tajawal\';src:' . $regularSrc . ';font-weight:normal;font-style:normal;}'
        . '@font-face{font-family:\'Tajawal\';src:' . $boldSrc . ';font-weight:bold;font-style:normal;}'
        . '@page{size:210mm 1200mm;margin:0;}'
        . 'html,body{margin:0;padding:0;}'
        . 'body{font-family:Tajawal,\'DejaVu Sans\',Arial,sans-serif;color:#222;background:' . $bg . ';display:flex;justify-content:center;}'
        . '.plant-report-print-root{width:794px;max-width:794px;padding:36px;box-sizing:border-box;background:' . $bg . ';margin:0 auto;}'
        . $arCss
        . '.plant-report-print-root img[data-pdf-icon="1"]{vertical-align:middle;display:inline-block;object-fit:contain;background:transparent;}'
        . '.plant-report-print-root img[data-pdf-logo="1"],.plant-report-print-root img[alt="logo"]{background:transparent!important;object-fit:contain!important;max-height:58px;width:auto;}'
        . '.plant-report-print-root img:not([data-pdf-logo="1"]):not([data-pdf-icon="1"]):not([alt="logo"]){max-width:100%;height:auto;}'
        . '.pdf-section{page-break-inside:avoid;break-inside:avoid;}'
        . '</style></head><body>' . $inner . '</body></html>';
}

function savePdfBytesToResponse(string $pdfBytes, string $fileName): void
{
    $base64 = base64_encode($pdfBytes);

    $fileUrl    = '';
    $reportsDir = __DIR__ . '/reports/';
    if (!is_dir($reportsDir)) {
        @mkdir($reportsDir, 0755, true);
    }
    $savePath = $reportsDir . $fileName;
    if (@file_put_contents($savePath, $pdfBytes) !== false) {
        $proto   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host    = $_SERVER['HTTP_HOST'] ?? '';
        $base    = rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? ''), '/');
        $fileUrl = $proto . '://' . $host . $base . '/reports/' . rawurlencode($fileName);
    }

    pdfRespond(200, ['ok' => true, 'pdf_base64' => $base64, 'file_url' => $fileUrl]);
}

/** PDF from browser snapshot — pixel-perfect match to PlantDiagnostic preview */
function renderSnapshotPdfToResponse(string $dataUrl, string $fileName): void
{
    if (!preg_match('#^data:image/(jpe?g|png);base64,(.+)$#i', $dataUrl, $m)) {
        pdfRespond(400, ['ok' => false, 'error' => 'Invalid reportSnapshot']);
    }

    $mime = strtolower($m[1]) === 'png' ? 'png' : 'jpeg';
    $raw  = base64_decode($m[2], true);
    if ($raw === false || $raw === '') {
        pdfRespond(400, ['ok' => false, 'error' => 'Could not decode reportSnapshot']);
    }

    $info = @getimagesizefromstring($raw);
    if ($info === false) {
        pdfRespond(400, ['ok' => false, 'error' => 'Invalid image in reportSnapshot']);
    }

    [$imgW, $imgH] = $info;
    $pageW   = 595.28;
    $renderH = ($imgH / max(1, $imgW)) * $pageW;
    $pageH   = max(842.0, $renderH);
    $src     = 'data:image/' . $mime . ';base64,' . base64_encode($raw);

    $html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
        . '@page{margin:0;size:' . $pageW . 'pt ' . $pageH . 'pt;}'
        . 'html,body{margin:0;padding:0;width:' . $pageW . 'pt;height:' . $pageH . 'pt;overflow:hidden;}'
        . 'img{width:' . $pageW . 'pt;height:' . $renderH . 'pt;display:block;margin:0;padding:0;border:0;}'
        . '</style></head><body><img src="' . $src . '" alt="report"></body></html>';

    try {
        $options = new Options();
        $options->set('isRemoteEnabled', true);
        $options->set('isHtml5ParserEnabled', true);
        $options->set('dpi', 192);
        $options->set('chroot', realpath(__DIR__) ?: __DIR__);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper([0, 0, $pageW, $pageH], 'portrait');
        $dompdf->render();

        savePdfBytesToResponse($dompdf->output(), $fileName);
    } catch (Throwable $e) {
        pdfRespond(500, ['ok' => false, 'error' => $e->getMessage()]);
    }
}

function renderPdfToResponse(string $html, string $fileName, bool $singleLongPage = true): void
{
    try {
        $options = new Options();
        $options->set('isRemoteEnabled', true);
        $options->set('isHtml5ParserEnabled', true);
        $options->set('defaultFont', 'tajawal');
        $options->set('dpi', 192);
        $options->set('chroot', realpath(__DIR__) ?: __DIR__);
        $options->set('fontDir', __DIR__ . '/vendor/dompdf/dompdf/lib/fonts');
        $options->set('fontCache', __DIR__ . '/vendor/dompdf/dompdf/lib/fonts');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        if ($singleLongPage) {
            $pages = $dompdf->getCanvas()->get_page_count();
            if ($pages > 1) {
                $heightPt = (842 * $pages) + 24;
                $dompdf2 = new Dompdf($options);
                $dompdf2->loadHtml($html, 'UTF-8');
                $dompdf2->setPaper([0, 0, 595.28, $heightPt], 'portrait');
                $dompdf2->render();
                $dompdf = $dompdf2;
            }
        }

        $pdfBytes = $dompdf->output();
        savePdfBytesToResponse($pdfBytes, $fileName);
    } catch (Throwable $e) {
        pdfRespond(500, ['ok' => false, 'error' => $e->getMessage()]);
    }
}

/* ── Fast path: snapshot image from browser preview (pixel-perfect) ── */
if ($reportSnapshotRaw !== '') {
    renderSnapshotPdfToResponse($reportSnapshotRaw, $fileName);
}

/* ── Fallback: PDF from captured HTML + dompdf ── */
if ($reportHtmlRaw !== '') {
    $isRtl  = ($lang === 'ar');
    $dir    = $isRtl ? 'rtl' : 'ltr';
    $arObj  = loadArabicShaper($lang);
    $inner  = $isRtl ? shapeArabicPreviewHtml($reportHtmlRaw, $arObj, $theme) : $reportHtmlRaw;
    $html   = wrapPreviewHtmlForPdf($inner, $pageBgColor, $dir, $lang, $tajawalRegularSrc, $tajawalBoldSrc, $isRtl);
    renderPdfToResponse($html, $fileName, true);
}

$result     = $data['result']       ?? [];
$images     = $data['images']       ?? [];
$engName     = $data['engNameDisplay'] ?? $data['engName'] ?? 'Eng. Alaa Ahmad Almasri';
$engNameColor= $data['engNameColor']  ?? '#003366';
$headerText  = $data['headerText']    ?? '';
$footerText  = $data['footerText']    ?? '';
$headerLogo  = $data['headerLogo']    ?? '';
$engSig      = $data['engSignature']  ?? '';
$engStamp    = $data['engStamp']      ?? '';
$logoColor   = $data['logoColor']     ?? '#003366';
$logoImg     = $data['logoImg']       ?? '';
$logoText    = $data['logoText']      ?? 'م.علاء';
$stampAlign  = in_array($data['stampAlign'] ?? '', ['left','center','right']) ? $data['stampAlign'] : 'right';

/* ── Margins in mm (configurable from request, defaults ≈ 2 cm) ── */
$mTop    = max(14, intval($data['marginTop']    ?? 20));
$mRight  = max(10, intval($data['marginRight']  ?? 20));
$mBottom = max(14, intval($data['marginBottom'] ?? 20));
$mLeft   = max(10, intval($data['marginLeft']   ?? 20));

/* Header/footer heights (fixed) */
$hdrH = 13;   /* mm — page header strip height */
$ftrH = 12;   /* mm — page footer strip height */

/* How far the fixed strip extends into the margin area */
$hdrTop = -($mTop - 3);       /* negative: moves strip into top margin */
$ftrBot = -($mBottom - 3);    /* negative: moves strip into bottom margin */

$isRtl = ($lang === 'ar');
$dir   = $isRtl ? 'rtl' : 'ltr';
$today = date('d/m/Y');

$arObj = loadArabicShaper($lang);

/* Plain HTML-escape (for non-text attributes, URLs, etc.) */
function he(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/* ── Localisation table ── */
$L = [
  'ar' => [
    'reportTitle'         => 'تقرير التشخيص الزراعي',
    'date'                => 'التاريخ',
    'resultTitle'         => 'نتيجة التشخيص',
    'plantName'           => 'اسم النبات',
    'scientific'          => 'الاسم العلمي',
    'origin'              => 'الموطن الأصلي',
    'careTitle'           => 'تعليمات العناية',
    'water'               => 'الري',
    'fertilizer'          => 'التسميد',
    'light'               => 'الإضاءة',
    'lightLux'            => 'شدة الإضاءة (لوكس)',
    'temperature'         => 'درجة الحرارة المثلى (°C)',
    'soilSection'         => 'التربة المناسبة',
    'soilType'            => 'نوع التربة',
    'nutrientsSection'    => 'عناصر التغذية الكبرى والصغرى',
    'nutrientName'        => 'العنصر',
    'nutrientCat'         => 'التصنيف',
    'nutrientRatio'       => 'النسبة الموصى بها',
    'fertRatios'          => 'نسب التسميد بالأرقام',
    'plantingSection'     => 'مواعيد الزراعة والحصاد',
    'plantingDate'        => 'موعد الزراعة',
    'daysToHarvest'       => 'أيام حتى الإنتاج',
    'harvestTime'         => 'موسم الحصاد',
    'usesSection'         => 'استخدامات النبات',
    'healthSection'       => 'الفوائد الصحية والطبية',
    'healthBenefits'      => 'الفوائد الصحية والغذائية',
    'medicinalSubstances' => 'المواد الفعالة الدوائية',
    'medicines'           => 'الأدوية والمستحضرات',
    'diseaseTitle'        => 'التشخيص المرضي والآفات',
    'diseaseType'         => 'نوع الإصابة',
    'diseaseDetail'       => 'التشخيص',
    'pesticides'          => 'المبيدات الموصى بها',
    'imageLabel'          => 'صورة',
    'noDisease'           => 'لا توجد أمراض مكتشفة',
    'signature'           => 'التوقيع',
  ],
  'en' => [
    'reportTitle'         => 'Agricultural Diagnostic Report',
    'date'                => 'Date',
    'resultTitle'         => 'Diagnosis Result',
    'plantName'           => 'Plant Name',
    'scientific'          => 'Scientific Name',
    'origin'              => 'Origin',
    'careTitle'           => 'Care Instructions',
    'water'               => 'Water',
    'fertilizer'          => 'Fertilizer',
    'light'               => 'Light',
    'lightLux'            => 'Light Intensity (Lux)',
    'temperature'         => 'Optimal Temperature (°C)',
    'soilSection'         => 'Suitable Soil',
    'soilType'            => 'Soil Type',
    'nutrientsSection'    => 'Macro & Micro Nutrients',
    'nutrientName'        => 'Element',
    'nutrientCat'         => 'Category',
    'nutrientRatio'       => 'Recommended Ratio',
    'fertRatios'          => 'Fertilization Ratios',
    'plantingSection'     => 'Planting & Harvest Schedule',
    'plantingDate'        => 'Planting Date',
    'daysToHarvest'       => 'Days to Production',
    'harvestTime'         => 'Harvest Season',
    'usesSection'         => 'Plant Uses',
    'healthSection'       => 'Health & Medicinal Benefits',
    'healthBenefits'      => 'Health & Nutritional Benefits',
    'medicinalSubstances' => 'Active Medicinal Compounds',
    'medicines'           => 'Derived Pharmaceutical Products',
    'diseaseTitle'        => 'Disease & Pest Diagnosis',
    'diseaseType'         => 'Type',
    'diseaseDetail'       => 'Diagnosis',
    'pesticides'          => 'Recommended Pesticides',
    'imageLabel'          => 'Image',
    'noDisease'           => 'No diseases detected',
    'signature'           => 'Signature',
  ],
  'de' => [
    'reportTitle'         => 'Agrardiagnosebericht',
    'date'                => 'Datum',
    'resultTitle'         => 'Diagnoseergebnis',
    'plantName'           => 'Pflanzenname',
    'scientific'          => 'Wissenschaftlicher Name',
    'origin'              => 'Herkunft',
    'careTitle'           => 'Pflegehinweise',
    'water'               => 'Wasser',
    'fertilizer'          => 'Dünger',
    'light'               => 'Licht',
    'lightLux'            => 'Lichtintensität (Lux)',
    'temperature'         => 'Optimale Temperatur (°C)',
    'soilSection'         => 'Geeigneter Boden',
    'soilType'            => 'Bodenart',
    'nutrientsSection'    => 'Makro- & Mikronährstoffe',
    'nutrientName'        => 'Element',
    'nutrientCat'         => 'Kategorie',
    'nutrientRatio'       => 'Empfohlenes Verhältnis',
    'fertRatios'          => 'Düngungsquoten',
    'plantingSection'     => 'Pflanz- & Erntetermine',
    'plantingDate'        => 'Pflanztermin',
    'daysToHarvest'       => 'Tage bis zur Ernte',
    'harvestTime'         => 'Erntezeit',
    'usesSection'         => 'Pflanzenverwendung',
    'healthSection'       => 'Gesundheits- & Heilvorteile',
    'healthBenefits'      => 'Gesundheits- & Ernährungsvorteile',
    'medicinalSubstances' => 'Aktive Heilstoffe',
    'medicines'           => 'Abgeleitete Arzneimittel',
    'diseaseTitle'        => 'Krankheits- & Schädlingsdiagnose',
    'diseaseType'         => 'Art',
    'diseaseDetail'       => 'Diagnose',
    'pesticides'          => 'Empfohlene Pestizide',
    'imageLabel'          => 'Bild',
    'noDisease'           => 'Keine Krankheiten festgestellt',
    'signature'           => 'Unterschrift',
  ],
][$lang] ?? [];

/* ── Helper functions ── */

/**
 * field() — renders a label + value card.
 * $ltr: force LTR on the value (e.g. scientific names, numbers).
 * $rawValue: if true, value is already HTML (e.g. already passed through arG).
 */
function field(string $label, ?string $value, string $theme, bool $ltr = false): string
{
    global $isRtl;
    $labelHtml = arG($label);
    $valueHtml = arG($value ?? '—', $ltr);
    // When Arabic glyphs are pre-rendered the container must be ltr to avoid double-reversing
    $cellDir   = $isRtl ? 'direction:ltr;text-align:right;' : '';
    return '<div style="background:#f7faf7;border:1px solid #daeada;border-radius:6px;'
         . 'padding:6px 9px;margin-bottom:5px;page-break-inside:avoid;">'
         . '<div style="font-size:8.5pt;color:#8a9a8a;margin-bottom:2px;' . $cellDir . '">' . $labelHtml . '</div>'
         . '<div style="font-size:10.5pt;font-weight:600;color:#1d3a1d;' . $cellDir . 'word-wrap:break-word;">'
         . $valueHtml . '</div></div>';
}

function secTitle(string $text, string $theme): string
{
    global $isRtl;
    $cellDir = $isRtl ? 'direction:ltr;text-align:right;' : '';
    return '<div style="font-weight:900;color:' . $theme . ';font-size:12pt;'
         . 'margin:12px 0 7px 0;padding-right:8px;border-right:4px solid ' . $theme . ';' . $cellDir . '">'
         . arG($text) . '</div>';
}

function subTitle(string $text, string $theme): string
{
    global $isRtl;
    $cellDir = $isRtl ? 'direction:ltr;text-align:right;' : '';
    return '<div style="font-weight:700;color:' . $theme . ';font-size:10.5pt;'
         . 'margin:8px 0 5px 0;' . $cellDir . '">' . arG($text) . '</div>';
}

/* ── Build content ── */
$plantName   = trim($result['plantName'] ?? '');
$reportTitle = $plantName
    ? $L['reportTitle'] . ' — ' . $plantName
    : $L['reportTitle'];

/* Logo */
if ($headerLogo) {
    $logoHtml = '<img src="' . $headerLogo . '" style="height:50px;object-fit:contain;" />';
} elseif ($logoImg) {
    $logoHtml = '<img src="' . $logoImg . '" style="height:50px;object-fit:contain;" />';
} else {
    $logoHtml = '<div style="font-weight:900;color:' . he($logoColor) . ';font-size:17pt;direction:ltr;text-align:right;">'
              . arG($logoText) . '</div>';
}

$engLabel = arG($engName);

/* Plant images row */
$imagesHtml = '';
if (!empty($images)) {
    $count    = min(count($images), 6);
    $colPct   = $count <= 3 ? floor(100 / $count) : 24;
    $imagesHtml = '<table width="100%" cellpadding="3" cellspacing="0"'
                . ' style="margin-bottom:12px;page-break-inside:avoid;"><tr>';
    foreach (array_slice($images, 0, $count) as $img) {
        $imagesHtml .= '<td width="' . $colPct . '%" style="text-align:center;vertical-align:top;">'
                     . '<img src="' . $img . '" style="max-width:100%;height:88px;'
                     . 'object-fit:cover;border-radius:5px;border:1.5px solid ' . he($theme) . ';" /></td>';
    }
    $imagesHtml .= '</tr></table>';
}

/* Nutrients table */
$nutrientsHtml = '';
if (!empty($result['nutrients'])) {
    $nutrientsHtml .= subTitle($L['nutrientsSection'], $theme);

    /* Column styles
       ─ name  : Arabic/text  → arG() shaped; RTL→ dir:ltr align:right | LTR→ dir:ltr align:left
       ─ cat   : "Macro/Micro" always English → dir:ltr align:center (no arG needed)
       ─ ratio : mixed Arabic+numbers → arG() shaped; RTL→ dir:ltr align:right | LTR→ dir:ltr align:left
    */
    $thBase  = 'padding:6px 8px;vertical-align:middle;';
    $thName  = $thBase . ($isRtl ? 'direction:ltr;text-align:right;' : 'direction:ltr;text-align:left;');
    $thCat   = $thBase . 'direction:ltr;text-align:center;';
    $thRatio = $thBase . ($isRtl ? 'direction:ltr;text-align:right;' : 'direction:ltr;text-align:left;');

    $tdBase  = 'padding:5px 8px;vertical-align:middle;';
    $tdName  = $tdBase . ($isRtl ? 'direction:ltr;text-align:right;' : 'direction:ltr;text-align:left;');
    $tdCat   = $tdBase . 'direction:ltr;text-align:center;font-weight:700;color:' . he($theme) . ';';
    $tdRatio = $tdBase . ($isRtl ? 'direction:ltr;text-align:right;' : 'direction:ltr;text-align:left;');

    /* Table direction matches document; cells use direction:ltr because
       arG() output is already visual-order LTR glyphs. */
    $tblDir = $isRtl ? 'direction:rtl;' : '';

    $nutrientsHtml .= '<table width="100%" cellpadding="0" cellspacing="0"'
                   . ' style="border-collapse:collapse;font-size:9.5pt;'
                   . $tblDir
                   . 'margin-bottom:10px;page-break-inside:avoid;">';
    $nutrientsHtml .= '<thead><tr style="background:' . he($theme) . ';color:#fff;">'
                   . '<th style="' . $thName  . '">' . arG($L['nutrientName'])  . '</th>'
                   . '<th style="' . $thCat   . '">' . arG($L['nutrientCat'])   . '</th>'
                   . '<th style="' . $thRatio . '">' . arG($L['nutrientRatio']) . '</th>'
                   . '</tr></thead><tbody>';
    foreach ($result['nutrients'] as $i => $n) {
        $bg = ($i % 2 === 0) ? '#f6faf6' : '#ffffff';
        $cat = trim($n['category'] ?? '—');
        $nutrientsHtml .= '<tr style="background:' . $bg . ';">'
                       . '<td style="' . $tdName  . '">' . arG($n['name']  ?? '—') . '</td>'
                       . '<td style="' . $tdCat   . '">' . he($cat)                 . '</td>'
                       . '<td style="' . $tdRatio . '">' . arG($n['ratio'] ?? '—') . '</td>'
                       . '</tr>';
    }
    $nutrientsHtml .= '</tbody></table>';
}

/* Diseases section */
$diseasesHtml = '';
$diseases     = $result['diseases'] ?? null;
if (is_array($diseases)) {
    $diseasesHtml .= subTitle($L['diseaseTitle'], $theme);
    if (empty($diseases)) {
        $diseasesHtml .= '<div style="background:#f0faf0;border:1.5px solid #b2dfb2;'
                       . 'border-radius:7px;padding:8px 12px;color:#2a7a2a;font-weight:700;'
                       . ($isRtl ? 'direction:ltr;text-align:right;' : '') . '">'
                       . arG($L['noDisease']) . '</div>';
    } else {
        foreach ($diseases as $d) {
            $nums = array_map(
                fn($n) => arG($L['imageLabel']) . ' ' . intval($n),
                $d['imageNumbers'] ?? []
            );
            $imgLabel      = implode(' + ', $nums);
            $diseasesHtml .= '<div style="border:1.5px solid ' . he($theme) . ';border-radius:7px;'
                           . 'padding:9px 11px;background:#f7fdf7;margin-bottom:8px;page-break-inside:avoid;">'
                           . '<div style="font-weight:800;color:' . he($theme) . ';margin-bottom:6px;">'
                           . $imgLabel . '</div>'
                           . '<table width="100%" cellpadding="3" cellspacing="0"><tr>'
                           . '<td width="40%" style="vertical-align:top;">'
                           . field($L['diseaseType'], $d['diseaseType'] ?? null, $theme)
                           . '</td>'
                           . '<td width="60%" style="vertical-align:top;">'
                           . field($L['diseaseDetail'], $d['diseaseDetail'] ?? null, $theme)
                           . '</td></tr></table>'
                           . field($L['pesticides'], $d['pesticides'] ?? null, $theme)
                           . '</div>';
        }
    }
} elseif (!empty($result['diseaseType']) || !empty($result['diseaseDetail'])) {
    $diseasesHtml .= subTitle($L['diseaseTitle'], $theme);
    $diseasesHtml .= '<table width="100%" cellpadding="3" cellspacing="0"><tr>'
                  . '<td width="40%" style="vertical-align:top;">'
                  . field($L['diseaseType'], $result['diseaseType'] ?? null, $theme)
                  . '</td>'
                  . '<td width="60%" style="vertical-align:top;">'
                  . field($L['diseaseDetail'], $result['diseaseDetail'] ?? null, $theme)
                  . '</td></tr></table>'
                  . field($L['pesticides'], $result['pesticides'] ?? null, $theme);
}

/* Signature & stamp */
$sigHtml = $engSig
    ? '<img src="' . $engSig . '" style="max-height:55px;max-width:120px;object-fit:contain;" />'
    : '<div style="height:55px;"></div>';
$stampHtml = $engStamp
    ? '<td style="text-align:center;padding-right:8px;"><img src="' . $engStamp
      . '" style="max-height:74px;max-width:95px;object-fit:contain;" /></td>'
    : '';

/* ── Shared text direction style for Arabic cells ── */
$td = $isRtl ? 'direction:ltr;text-align:right;' : '';

/* ── Tajawal font paths ── */
$tajawalDir     = __DIR__ . '/vendor/dompdf/dompdf/lib/fonts/';
$tajawalRegular = $tajawalDir . 'Tajawal-Regular.ttf';
$tajawalBold    = $tajawalDir . 'Tajawal-Bold.ttf';

/* Google Fonts CDN fallback URLs (used only if local files are absent) */
$tajawalRegularSrc = file_exists($tajawalRegular)
    ? 'url("' . $tajawalRegular . '") format("truetype")'
    : 'url("https://fonts.gstatic.com/s/tajawal/v9/Iurf6YBj_oCad4k1rzaLCr5IlLA.ttf") format("truetype")';

$tajawalBoldSrc = file_exists($tajawalBold)
    ? 'url("' . $tajawalBold . '") format("truetype")'
    : 'url("https://fonts.gstatic.com/s/tajawal/v9/Iura6YBj_oCad4k1nzSBC45I1LA.ttf") format("truetype")';

/* ── Full HTML document ── */
ob_start();
?>
<!DOCTYPE html>
<html dir="<?= $dir ?>" lang="<?= $lang ?>">
<head>
<meta charset="UTF-8">
<style>
  @font-face {
    font-family: 'Tajawal';
    src: <?= $tajawalRegularSrc ?>;
    font-weight: normal;
    font-style: normal;
  }
  @font-face {
    font-family: 'Tajawal';
    src: <?= $tajawalBoldSrc ?>;
    font-weight: bold;
    font-style: normal;
  }
  @page {
    size: A4 portrait;
    margin: <?= $mTop ?>mm <?= $mRight ?>mm <?= $mBottom ?>mm <?= $mLeft ?>mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Tajawal', 'DejaVu Sans', Arial, sans-serif;
    font-size: 11pt;
    color: #222;
    direction: <?= $dir ?>;
    text-align: <?= $isRtl ? 'right' : 'left' ?>;
    background: <?= he($pageBgColor) ?>;
  }
  /* ── Fixed header (repeats on every page via dompdf position:fixed) ── */
  .page-header {
    position: fixed;
    top: <?= $hdrTop ?>mm;
    left: -<?= $mLeft ?>mm;
    right: -<?= $mRight ?>mm;
    height: <?= $hdrH ?>mm;
    background: <?= he($pageBgColor) ?>;
    border-bottom: 1.5px solid <?= $theme ?>;
    padding: 0 <?= $mLeft ?>mm;
  }
  .page-header table { width: 100%; height: <?= $hdrH ?>mm; }
  .page-header .hd-name {
    font-weight: 800;
    font-size: 8pt;
    color: <?= he($engNameColor) ?>;
    text-align: right;
    vertical-align: middle;
    direction: ltr;
  }
  .page-header .hd-date {
    font-size: 8pt;
    color: #888;
    text-align: left;
    vertical-align: middle;
    width: 80px;
    direction: ltr;
  }
  /* ── Fixed footer (repeats on every page) ── */
  .page-footer {
    position: fixed;
    bottom: <?= $ftrBot ?>mm;
    left: -<?= $mLeft ?>mm;
    right: -<?= $mRight ?>mm;
    height: <?= $ftrH ?>mm;
    background: #ffffff;
    border-top: 1.5px solid <?= $theme ?>;
    text-align: center;
    font-size: 7.5pt;
    color: #666;
    line-height: <?= $ftrH ?>mm;
    padding: 0 <?= $mLeft ?>mm;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    direction: ltr;
  }
  /* ── Stamp: fixed to bottom-left corner of every page ── */
  .page-stamp {
    position: fixed;
    bottom: 2mm;
    left: <?= $mLeft ?>mm;
  }
  /* ── Page-break rules: keep every section intact ── */
  .pdf-section,
  div, p, li, td, th {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  table { border-collapse: collapse; page-break-inside: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr    { page-break-inside: avoid; break-inside: avoid; }
  img   { max-width: 100%; page-break-inside: avoid; }
</style>
</head>
<body>

<!-- Fixed page header -->
<div class="page-header">
  <table cellpadding="0" cellspacing="0">
    <tr>
      <td class="hd-name"><?= $engLabel ?> &nbsp;|&nbsp; Agricultural Engineering</td>
      <td class="hd-date"><?= $today ?></td>
    </tr>
  </table>
</div>

<!-- Fixed page footer -->
<div class="page-footer"><?= arG($footerText) ?></div>

<?php if ($engStamp): ?>
<!-- Stamp fixed to every page footer area -->
<div class="page-stamp">
  <img src="<?= $engStamp ?>" style="max-height:64px;max-width:80px;object-fit:contain;opacity:0.88;" />
</div>
<?php endif; ?>

<!-- ── Report header ─────────────────────────────── -->
<table width="100%" cellpadding="0" cellspacing="0"
       style="border-bottom:2.5px solid <?= $theme ?>;padding-bottom:12px;margin-bottom:14px;">
  <tr>
    <td style="vertical-align:middle;">
      <table cellpadding="0" cellspacing="6"><tr>
        <td style="vertical-align:middle;"><?= $logoHtml ?></td>
        <td style="vertical-align:middle;">
          <div style="font-weight:800;color:<?= he($engNameColor) ?>;font-size:12pt;line-height:1.3;<?= $td ?>">
            <?= $engLabel ?>
          </div>
          <?php if ($headerText): ?>
          <div style="font-weight:600;color:<?= he($theme) ?>;font-size:10pt;margin-top:2px;<?= $td ?>">
            <?= arG($headerText) ?>
          </div>
          <?php endif; ?>
        </td>
      </tr></table>
    </td>
    <td style="text-align:left;vertical-align:middle;">
      <div style="font-weight:900;color:<?= he($theme) ?>;font-size:13pt;<?= $td ?>">
        <?= arG($reportTitle) ?>
      </div>
      <div style="font-size:10pt;color:#777;margin-top:3px;direction:ltr;">
        <?= arG($L['date']) ?>: <?= $today ?>
      </div>
    </td>
  </tr>
</table>

<!-- Plant images -->
<?= $imagesHtml ?>

<!-- Section: Diagnosis result -->
<?= secTitle($L['resultTitle'], $theme) ?>

<!-- Plant identification -->
<table width="100%" cellpadding="4" cellspacing="0" style="margin-bottom:8px;" class="pdf-section">
  <tr>
    <td width="50%" style="vertical-align:top;padding-left:6px;">
      <?= field($L['plantName'], $result['plantName'] ?? null, $theme) ?>
    </td>
    <td width="50%" style="vertical-align:top;">
      <?= field($L['scientific'], $result['scientificName'] ?? null, $theme, true) ?>
    </td>
  </tr>
</table>
<?php if (!empty($result['origin'])): ?>
  <?= field($L['origin'], $result['origin'], $theme) ?>
<?php endif; ?>

<!-- Care instructions -->
<?= subTitle($L['careTitle'], $theme) ?>
<table width="100%" cellpadding="4" cellspacing="0" style="margin-bottom:8px;" class="pdf-section">
  <tr>
    <td width="50%" style="vertical-align:top;padding-left:6px;">
      <?= field($L['water'],      $result['water']      ?? null, $theme) ?>
    </td>
    <td width="50%" style="vertical-align:top;">
      <?= field($L['fertilizer'], $result['fertilizer'] ?? null, $theme) ?>
    </td>
  </tr>
  <tr>
    <td width="50%" style="vertical-align:top;padding-left:6px;">
      <?= field($L['light'],       $result['light']       ?? null, $theme) ?>
    </td>
    <td width="50%" style="vertical-align:top;">
      <?php if (!empty($result['temperature'])): ?>
        <?= field($L['temperature'], $result['temperature'], $theme) ?>
      <?php endif; ?>
    </td>
  </tr>
</table>
<?php if (!empty($result['lightLux'])): ?>
  <?= field($L['lightLux'], $result['lightLux'], $theme) ?>
<?php endif; ?>

<!-- Soil type -->
<?php if (!empty($result['soilType'])): ?>
<div class="pdf-section">
  <?= subTitle($L['soilSection'], $theme) ?>
  <?= field($L['soilType'], $result['soilType'], $theme) ?>
</div>
<?php endif; ?>

<!-- Nutrients table -->
<div class="pdf-section"><?= $nutrientsHtml ?></div>

<!-- Fertilization ratios -->
<?php if (!empty($result['fertilizationRatios'])): ?>
<div class="pdf-section">
  <?= subTitle($L['fertRatios'], $theme) ?>
  <?= field($L['fertRatios'], $result['fertilizationRatios'], $theme) ?>
</div>
<?php endif; ?>

<!-- Planting & harvest schedule -->
<?php if (!empty($result['plantingDate']) || !empty($result['daysToHarvest']) || !empty($result['harvestTime'])): ?>
<div class="pdf-section">
  <?= subTitle($L['plantingSection'], $theme) ?>
  <table width="100%" cellpadding="4" cellspacing="0">
    <tr>
      <td width="33%" style="vertical-align:top;padding-left:4px;">
        <?= field($L['plantingDate'],  $result['plantingDate']  ?? null, $theme) ?>
      </td>
      <td width="33%" style="vertical-align:top;padding-left:4px;">
        <?= field($L['daysToHarvest'], $result['daysToHarvest'] ?? null, $theme) ?>
      </td>
      <td width="33%" style="vertical-align:top;">
        <?= field($L['harvestTime'],   $result['harvestTime']   ?? null, $theme) ?>
      </td>
    </tr>
  </table>
</div>
<?php endif; ?>

<!-- Plant uses -->
<?php if (!empty($result['uses'])): ?>
<div class="pdf-section">
  <?= subTitle($L['usesSection'], $theme) ?>
  <?= field($L['usesSection'], $result['uses'], $theme) ?>
</div>
<?php endif; ?>

<!-- Health & medicinal -->
<?php if (!empty($result['healthBenefits']) || !empty($result['medicinalSubstances']) || !empty($result['medicines'])): ?>
<div class="pdf-section">
  <?= subTitle($L['healthSection'], $theme) ?>
  <?php if (!empty($result['healthBenefits'])): ?>
    <?= field($L['healthBenefits'], $result['healthBenefits'], $theme) ?>
  <?php endif; ?>
  <?php if (!empty($result['medicinalSubstances'])): ?>
    <?= field($L['medicinalSubstances'], $result['medicinalSubstances'], $theme) ?>
  <?php endif; ?>
  <?php if (!empty($result['medicines'])): ?>
    <?= field($L['medicines'], $result['medicines'], $theme) ?>
  <?php endif; ?>
</div>
<?php endif; ?>

<!-- Diseases -->
<div class="pdf-section"><?= $diseasesHtml ?></div>

<!-- ── Footer: signature & footer text ── -->
<div class="pdf-section"
     style="margin-top:22px;border-top:2px solid <?= $theme ?>;padding-top:14px;page-break-inside:avoid;">
<?php
$sigBlock = '<table cellpadding="5" cellspacing="0"><tr>'
          . $stampHtml
          . '<td style="text-align:center;min-width:110px;">'
          . $sigHtml
          . '<div style="border-top:1px solid #aaa;margin-top:4px;padding-top:4px;'
          . 'font-size:9pt;font-weight:700;color:#444;' . $td . '">'
          . arG($L['signature']) . '</div></td></tr></table>';
$footBlock = '<span style="font-size:9pt;color:#666;line-height:1.7;' . $td . '">' . arG($footerText) . '</span>';
if ($stampAlign === 'center'):
?>
  <div style="text-align:center;margin-bottom:6px;"><?= $footBlock ?></div>
  <div style="text-align:center;"><?= $sigBlock ?></div>
<?php elseif ($stampAlign === 'left'): ?>
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:bottom;white-space:nowrap;"><?= $sigBlock ?></td>
    <td style="vertical-align:bottom;font-size:9pt;color:#666;line-height:1.7;padding-left:10px;<?= $td ?>"><?= arG($footerText) ?></td>
  </tr></table>
<?php else: /* right (default) */ ?>
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:bottom;font-size:9pt;color:#666;line-height:1.7;padding-left:10px;<?= $td ?>"><?= arG($footerText) ?></td>
    <td style="text-align:right;vertical-align:bottom;white-space:nowrap;"><?= $sigBlock ?></td>
  </tr></table>
<?php endif; ?>
</div>

</body>
</html>
<?php
$html = ob_get_clean();

renderPdfToResponse($html, $fileName, true);
