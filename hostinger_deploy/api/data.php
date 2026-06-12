<?php
/**
 * api/data.php — نقطة API الرئيسية للبيانات
 * ─────────────────────────────────────────────────────────────────
 * GET  /api/data.php          → يُرجع كل AppData مجمّعة من جميع الجداول (عام)
 * GET  /api/data.php?test     → تشخيص: يختبر الاتصال بقاعدة البيانات
 * POST /api/data.php          → يحفظ كل AppData في جداول MySQL (يتطلب JWT)
 * ─────────────────────────────────────────────────────────────────
 */

/* ── إظهار جميع الأخطاء في الـ Response (للتشخيص) ── */
ini_set('display_errors', '0');   // لا يُشوّه JSON
ini_set('log_errors',     '1');   // يُسجّل في error_log
error_reporting(E_ALL);

/* التقاط أي fatal error وإرجاعه كـ JSON */
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode([
            'ok'    => false,
            'error' => 'PHP Fatal: ' . $err['message'],
            'file'  => basename($err['file']),
            'line'  => $err['line'],
        ]);
    }
});

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ── تحميل الإعدادات واتصال DB ── */
$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'config.php not found — upload it to api/ on Hostinger']);
    exit;
}
require $configFile;
require __DIR__ . '/middleware.php';

$method = $_SERVER['REQUEST_METHOD'];

// ═══════════════════════════════════════════════════════════════
// GET ?test — تشخيص الاتصال (آمن، بدون بيانات حساسة)
// ═══════════════════════════════════════════════════════════════
if ($method === 'GET' && isset($_GET['test'])) {
    $info = [
        'ok'          => false,
        'php_version' => PHP_VERSION,
        'db_host'     => defined('DB_HOST') ? DB_HOST : '—',
        'db_name'     => defined('DB_NAME') ? DB_NAME : '—',
        'db_user'     => defined('DB_USER') ? DB_USER : '—',
        'db_pass_set' => defined('DB_PASS') && DB_PASS !== 'YOUR_DB_PASSWORD_HERE' && DB_PASS !== '',
        'jwt_set'     => defined('JWT_SECRET') && strlen(JWT_SECRET) > 20 && JWT_SECRET !== 'CHANGE_ME_TO_RANDOM_64_CHARS_MINIMUM_REPLACE_THIS_NOW_PLEASE_00',
        'pdo_ok'      => false,
        'tables'      => [],
        'error'       => null,
    ];
    try {
        if (!isset($pdo)) throw new \Exception('PDO not initialised (check config.php credentials)');
        $info['pdo_ok'] = true;
        $rows = $pdo->query("SHOW TABLES")->fetchAll(\PDO::FETCH_COLUMN);
        $info['tables'] = $rows;
        $info['ok']     = true;
    } catch (\Throwable $e) {
        $info['error'] = $e->getMessage();
    }
    echo json_encode($info, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// ═══════════════════════════════════════════════════════════════
// GET — تجميع جميع الجداول وإرجاعها كـ AppData
// ═══════════════════════════════════════════════════════════════
if ($method === 'GET') {
    try {
        echo json_encode(buildAppData($pdo), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage(), 'trace' => substr($e->getTraceAsString(), 0, 400)]);
    }
    exit;
}

// ═══════════════════════════════════════════════════════════════
// POST — حفظ AppData من الفرونت إند في قاعدة البيانات
// ═══════════════════════════════════════════════════════════════
if ($method === 'POST') {
    requireAuth();
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid JSON body']);
        exit;
    }
    try {
        syncAppData($pdo, $body);
        echo json_encode(['ok' => true]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => $e->getMessage(), 'trace' => substr($e->getTraceAsString(), 0, 400)]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);

// ═══════════════════════════════════════════════════════════════
// دوال مساعدة
// ═══════════════════════════════════════════════════════════════

/** فك ترميز JSON بأمان مع قيمة افتراضية */
function jd(?string $val, $default = null)
{
    if ($val === null || $val === '') return $default;
    $decoded = json_decode($val, true);
    return $decoded !== null ? $decoded : $default;
}

/** ترميز قيمة كـ JSON للحفظ في DB */
function je($val): string
{
    return json_encode($val, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/** توليد UUID بسيط (18 حرفاً hex) */
function genId(): string
{
    return bin2hex(random_bytes(9));
}

// ═══════════════════════════════════════════════════════════════
// buildAppData — بناء AppData من قاعدة البيانات
// ═══════════════════════════════════════════════════════════════
function buildAppData(PDO $db): array
{
    // ── site_settings (صف واحد id=1) ─────────────────────────
    $ss = $db->query("SELECT * FROM site_settings WHERE id=1")->fetch() ?: [];
    $dbIsSeeded = (bool)($ss['is_seeded'] ?? 0);
    $siteSettings = [
        'logoType'      => $ss['logo_type']       ?? 'svg_alaa',
        'logoImg'       => $ss['logo_img']         ?? '',
        'logoText'      => jd($ss['logo_text']     ?? null, ['ar'=>'','en'=>'','de'=>'']),
        'logoColor'     => $ss['logo_color']       ?? null,
        'footerBg'      => $ss['footer_bg']        ?? '#001529',
        'footerText'    => jd($ss['footer_text']   ?? null, ['ar'=>'','en'=>'','de'=>'']),
        'socialLinks'   => jd($ss['social_links']  ?? null, []),
        'navItems'      => jd($ss['nav_items']     ?? null, []),
        'themeMode'     => $ss['theme_mode']       ?? 'dark',
        'accentColor'   => $ss['accent_color']     ?? '#003366',
        'glassOpacity'  => (float)($ss['glass_opacity']   ?? 0.5),
        'threeScriptUrl'=> $ss['three_script_url'] ?? null,
    ];

    // ── skills ───────────────────────────────────────────────
    $skills = [];
    foreach ($db->query("SELECT * FROM skills ORDER BY sort_order, id")->fetchAll() as $r) {
        $skills[] = [
            'id'      => $r['id'],
            'name'    => $r['name'],
            'percent' => (int)$r['percent'],
            'icon'    => $r['icon'] ?? '',
            'size'    => (int)($r['size'] ?? 40),
        ];
    }

    // ── personal_info (صف واحد id=1) ─────────────────────────
    $pi = $db->query("SELECT * FROM personal_info WHERE id=1")->fetch() ?: [];
    $personalInfo = [
        'photo'         => $pi['photo']    ?? '',
        'phone'         => $pi['phone']    ?? '',
        'email'         => $pi['email']    ?? '',
        'location'      => $pi['location'] ?? '',
        'website'       => $pi['website']  ?? '',
        'linkedin'      => $pi['linkedin'] ?? '',
        'github'        => $pi['github']   ?? '',
        'twitter'       => $pi['twitter']  ?? '',
        'customSocials' => jd($pi['custom_socials'] ?? null, []),
    ];

    // ── article_categories ───────────────────────────────────
    $articleCategories = [];
    foreach ($db->query("SELECT * FROM article_categories ORDER BY sort_order, id")->fetchAll() as $r) {
        $articleCategories[] = [
            'id'   => $r['id'],
            'name' => jd($r['name'], ['ar'=>'','en'=>'','de'=>'']),
        ];
    }

    // ── agri_articles ────────────────────────────────────────
    $agriArticles = [];
    foreach ($db->query("SELECT * FROM agri_articles ORDER BY position_index, created_at")->fetchAll() as $r) {
        $agriArticles[] = [
            'id'         => $r['id'],
            'categoryId' => $r['category_id'] ?? '',
            'title'      => jd($r['title'],     ['ar'=>'','en'=>'','de'=>'']),
            'content'    => jd($r['content'],   ['ar'=>'','en'=>'','de'=>'']),
            'images'     => jd($r['images'],    []),
            'reference'  => jd($r['reference'], ['ar'=>'','en'=>'','de'=>'']),
            'date'       => $r['article_date']  ?? '',
        ];
    }

    // ── library_nodes → شجرة متداخلة ─────────────────────────
    $allNodes   = $db->query("SELECT * FROM library_nodes ORDER BY sort_order, id")->fetchAll();
    $libraryTree = buildNodeTree($allNodes, null);

    // ── library_books ─────────────────────────────────────────
    $agriBooks = [];
    foreach ($db->query("SELECT * FROM library_books ORDER BY position_index, created_at")->fetchAll() as $r) {
        $agriBooks[] = [
            'id'         => $r['id'],
            'nodeId'     => $r['node_id']    ?? '',
            'title'      => jd($r['title'],  ['ar'=>'','en'=>'','de'=>'']),
            'author'     => jd($r['author'], ['ar'=>'','en'=>'','de'=>'']),
            'thumbnail'  => $r['thumbnail']  ?? '',
            'driveUrl'   => $r['drive_url']  ?? '',
            'previewUrl' => $r['preview_url']?? '',
            'isPaid'     => (bool)($r['is_paid'] ?? 0),
            'pages'      => $r['pages']      ?? '',
            'kind'       => $r['kind']       ?? 'both',
            'languages'  => jd($r['languages'] ?? null, []),
        ];
    }

    // ── agri_videos ───────────────────────────────────────────
    $agriVideos = [];
    foreach ($db->query("SELECT * FROM agri_videos ORDER BY position_index, id")->fetchAll() as $r) {
        $agriVideos[] = [
            'id'      => $r['id'],
            'title'   => jd($r['title'], ['ar'=>'','en'=>'','de'=>'']),
            'url'     => $r['url'],
            'visible' => (bool)$r['visible'],
        ];
    }

    // ── public_reports ───────────────────────────────────────
    $publicReports = [];
    foreach ($db->query("SELECT * FROM public_reports ORDER BY position_index, id")->fetchAll() as $r) {
        $publicReports[] = [
            'id'        => $r['id'],
            'title'     => jd($r['title'], ['ar'=>'','en'=>'','de'=>'']),
            'thumbnail' => $r['thumbnail'] ?? '',
            'url'       => $r['url']       ?? '',
            'visible'   => (bool)$r['visible'],
        ];
    }

    // ── gfx_categories + gfx_subcategories + gfx_items ───────
    $gfxCategories = buildGfxCategories($db);

    // ── code_snippets ─────────────────────────────────────────
    $softwareSnippets = [];
    foreach ($db->query("SELECT * FROM code_snippets ORDER BY position_index, created_at")->fetchAll() as $r) {
        $softwareSnippets[] = [
            'id'       => $r['id']          ?? null,
            'title'    => $r['title']       ?? '',
            'desc'     => $r['description'] ?? '',
            'codeHtml' => $r['code_html']   ?? '',
            'codeCss'  => $r['code_css']    ?? '',
            'codeJs'   => $r['code_js']     ?? '',
            'category' => $r['category']    ?? '',
        ];
    }

    // ── web_projects ─────────────────────────────────────────
    $webProjects = [];
    foreach ($db->query("SELECT * FROM web_projects ORDER BY position_index, created_at")->fetchAll() as $r) {
        $webProjects[] = [
            'id'            => $r['id'],
            'title'         => jd($r['title'],       ['ar'=>'','en'=>'','de'=>'']),
            'desc'          => jd($r['description'], ['ar'=>'','en'=>'','de'=>'']),
            'mainImg'       => $r['main_img']        ?? '',
            'images'        => jd($r['images'],      []),
            'videoUrl'      => $r['video_url']       ?? '',
            'liveUrl'       => $r['live_url']        ?? '',
            'githubUrl'     => $r['github_url']      ?? '',
            'githubVisible' => (bool)($r['github_visible'] ?? 1),
            'tags'          => jd($r['tags'],         []),
            'thumbSize'     => (int)($r['thumb_size'] ?? 220),
        ];
    }

    // ── cv_docs + cv_sections ─────────────────────────────────
    $cvDocs = buildCvDocs($db);

    // ── soil_analysis ─────────────────────────────────────────
    $soilAnalysis = [];
    foreach ($db->query("SELECT * FROM soil_analysis ORDER BY sort_order, id")->fetchAll() as $r) {
        $soilAnalysis[] = [
            'id'     => $r['id'],
            'name'   => jd($r['name'], ['ar'=>'','en'=>'','de'=>'']),
            'ideal'  => $r['ideal']  ?? '',
            'actual' => $r['actual'] ?? '',
            'price'  => (string)($r['price'] ?? '0'),
            'tax'    => (string)($r['tax']   ?? '5'),
        ];
    }

    // ── report_template (صف واحد id=1) ───────────────────────
    $rt = $db->query("SELECT * FROM report_template WHERE id=1")->fetch() ?: [];
    $reportTemplate = [
        'themeColor'   => $rt['theme_color']   ?? '#003366',
        'headerLogo'   => $rt['header_logo']   ?? '',
        'headerText'   => jd($rt['header_text'] ?? null, ['ar'=>'','en'=>'','de'=>'']),
        'footerText'   => jd($rt['footer_text'] ?? null, ['ar'=>'','en'=>'','de'=>'']),
        'engName'      => jd($rt['eng_name']    ?? null, ['ar'=>'','en'=>'','de'=>'']),
        'engTitle'     => jd($rt['eng_title']   ?? null, ['ar'=>'','en'=>'','de'=>'']),
        'engSignature' => $rt['eng_signature']  ?? '',
        'engStamp'     => $rt['eng_stamp']      ?? '',
        'paidStamp'    => $rt['paid_stamp']      ?? '',
        'currency'     => $rt['currency']        ?? '',
    ];

    // ── customer_reports ─────────────────────────────────────
    $customerReports = [];
    foreach ($db->query("SELECT * FROM customer_reports ORDER BY created_at DESC")->fetchAll() as $r) {
        $customerReports[] = [
            'id'               => $r['id'],
            'reportType'       => $r['report_type']        ?? 'soil',
            'customerName'     => $r['customer_name']      ?? '',
            'customerPhone'    => $r['customer_phone']     ?? '',
            'customerLocation' => $r['customer_location']  ?? '',
            'attendanceDate'   => $r['attendance_date']    ?? '',
            'examDate'         => $r['exam_date']          ?? '',
            'images'           => jd($r['images'],         []),
            'plantName'        => jd($r['plant_name'],     ['ar'=>'','en'=>'','de'=>'']),
            'description'      => jd($r['description'],    ['ar'=>'','en'=>'','de'=>'']),
            'soilRows'         => jd($r['soil_rows'],       []),
            'finalReport'      => jd($r['final_report'],   ['ar'=>'','en'=>'','de'=>'']),
            'createdAt'        => $r['created_at']         ?? '',
        ];
    }

    // ── ai_vault (جدول جديد — يتجاهل الخطأ إن لم يُنشأ بعد) ──
    $aiVault = [];
    try {
        foreach ($db->query("SELECT * FROM ai_vault ORDER BY sort_order, id")->fetchAll() as $r) {
            $aiVault[] = [
                'id'            => $r['id'],
                'title'         => jd($r['title'], ['ar'=>'','en'=>'','de'=>'']),
                'prompt'        => $r['prompt']         ?? '',
                'img'           => $r['img']            ?? '',
                'categoryId'    => $r['category_id']    ?? '',
                'subCategoryId' => $r['sub_category_id']?? '',
            ];
        }
    } catch (Throwable $e) { /* الجدول لم يُنشأ بعد */ }

    // ── injected_pages (جدول جديد) ───────────────────────────
    $injectedPages = [];
    try {
        foreach ($db->query("SELECT * FROM injected_pages ORDER BY sort_order, id")->fetchAll() as $r) {
            $injectedPages[] = [
                'title' => $r['title'] ?? '',
                'html'  => $r['html']  ?? '',
                'css'   => $r['css']   ?? '',
            ];
        }
    } catch (Throwable $e) { /* الجدول لم يُنشأ بعد */ }

    return [
        // flag يُخبر الفرونت إن كانت DB قد زُوِّدت ببيانات حقيقية
        'dbIsSeeded'           => $dbIsSeeded,

        // معلومات الموقع
        'name'                 => $ss['site_name'] ?? 'م. علاء أحمد المصري',
        'bio'                  => $ss['site_bio']  ?? '',
        'currency'             => $rt['currency']  ?? '',
        'watermarkImg'         => $ss['watermark_img']     ?? '',
        'watermarkOpacity'     => (float)($ss['watermark_opacity'] ?? 0.15),
        'aiDiagnosticsEnabled' => (bool)($ss['ai_diagnostics_enabled'] ?? false),
        'showAgriCv'           => (bool)($ss['show_agri_cv']           ?? true),
        'showDesignerCv'       => (bool)($ss['show_designer_cv']       ?? true),
        'agriCats'             => jd($ss['agri_cats'] ?? null, []),
        'libraryView'          => $ss['library_view'] ?? 'tree',

        // بيانات الموقع
        'siteSettings'         => $siteSettings,
        'personalInfo'         => $personalInfo,
        'skills'               => $skills,
        'articleCategories'    => $articleCategories,
        'agriArticles'         => $agriArticles,
        'libraryTree'          => $libraryTree,
        'agriBooks'            => $agriBooks,
        'agriVideos'           => $agriVideos,
        'publicReports'        => $publicReports,
        'gfxCategories'        => $gfxCategories,
        'softwareSnippets'     => $softwareSnippets,
        'webProjects'          => $webProjects,
        'cvDocs'               => $cvDocs,
        'soilAnalysis'         => $soilAnalysis,
        'reportTemplate'       => $reportTemplate,
        'customerReports'      => $customerReports,
        'aiVault'              => $aiVault,
        'injectedPages'        => $injectedPages,

        // حقول تعاد كمصفوفات فارغة (بيانات قديمة legacy)
        'gfxGallery'  => [],
        'customCvs'   => [],
        'fileNodes'   => [],
        'agriCv'      => defaultCvProfile(),
        'devCv'       => defaultCvProfile(),
    ];
}

// ─── بناء شجرة الفصول ────────────────────────────────────────
function buildNodeTree(array $flat, ?string $parentId): array
{
    $result = [];
    foreach ($flat as $node) {
        if ($node['parent_id'] === $parentId) {
            $result[] = [
                'id'       => $node['id'],
                'name'     => jd($node['name'], ['ar'=>'','en'=>'','de'=>'']),
                'children' => buildNodeTree($flat, $node['id']),
            ];
        }
    }
    return $result;
}

// ─── بناء تصنيفات الغرافيك ──────────────────────────────────
function buildGfxCategories(PDO $db): array
{
    $cats  = $db->query("SELECT * FROM gfx_categories ORDER BY sort_order, id")->fetchAll();
    $subs  = $db->query("SELECT * FROM gfx_subcategories ORDER BY sort_order, id")->fetchAll();
    $items = $db->query("SELECT * FROM gfx_items ORDER BY position_index, created_at")->fetchAll();

    // فهرسة
    $itemsBySubId = [];
    foreach ($items as $item) {
        $sid = $item['subcategory_id'];
        if (!isset($itemsBySubId[$sid])) $itemsBySubId[$sid] = [];
        $itemsBySubId[$sid][] = [
            'id'           => $item['id'],
            'title'        => jd($item['title'],       ['ar'=>'','en'=>'','de'=>'']),
            'desc'         => jd($item['description'], ['ar'=>'','en'=>'','de'=>'']),
            'mainImg'      => $item['main_img']        ?? '',
            'images'       => jd($item['images'],      []),
            'videoUrl'     => $item['video_url']       ?? '',
            'usedSkillsIds'=> jd($item['used_skill_ids'], []),
            'cvSettings'   => [
                'isFeatured' => (bool)($item['cv_is_featured'] ?? false),
                'imgSize'    => (int)($item['cv_img_size']     ?? 100),
                'showDesc'   => (bool)($item['cv_show_desc']   ?? true),
                'showTools'  => (bool)($item['cv_show_tools']  ?? true),
            ],
        ];
    }

    $subsByCatId = [];
    foreach ($subs as $sub) {
        $cid = $sub['category_id'];
        if (!isset($subsByCatId[$cid])) $subsByCatId[$cid] = [];
        $subsByCatId[$cid][] = [
            'id'    => $sub['id'],
            'name'  => jd($sub['name'], ['ar'=>'','en'=>'','de'=>'']),
            'items' => $itemsBySubId[$sub['id']] ?? [],
        ];
    }

    $result = [];
    foreach ($cats as $cat) {
        $result[] = [
            'id'            => $cat['id'],
            'name'          => jd($cat['name'], ['ar'=>'','en'=>'','de'=>'']),
            'icon'          => $cat['icon'] ?? '',
            'subCategories' => $subsByCatId[$cat['id']] ?? [],
        ];
    }
    return $result;
}

// ─── بناء وثائق السيرة الذاتية ────────────────────────────────
function buildCvDocs(PDO $db): array
{
    $docs     = $db->query("SELECT * FROM cv_docs ORDER BY sort_order, created_at")->fetchAll();
    $sections = $db->query("SELECT * FROM cv_sections ORDER BY sort_order, id")->fetchAll();

    $secsByDocId = [];
    foreach ($sections as $s) {
        $did = $s['cv_doc_id'];
        if (!isset($secsByDocId[$did])) $secsByDocId[$did] = [];
        $secsByDocId[$did][] = [
            'id'              => $s['id'],
            'kind'            => $s['kind'],
            'title'           => jd($s['title'],        ['ar'=>'','en'=>'','de'=>'']),
            'column'          => $s['column_pos'],
            'visible'         => (bool)$s['visible'],
            'entries'         => jd($s['entries'],       []),
            'tags'            => jd($s['tags'],          []),
            'contactItems'    => jd($s['contact_items'], []),
            'portfolio'       => jd($s['portfolio'],     []),
            'text'            => jd($s['text_content'],  null),
            'useGlobalSkills' => (bool)$s['use_global_skills'],
            'galleryLayout'   => (int)($s['gallery_layout'] ?? 1),
            'imgHeight'       => (int)($s['img_height']     ?? 120),
            'pageBreakBefore' => (bool)$s['page_break_before'],
        ];
    }

    $result = [];
    foreach ($docs as $d) {
        $result[] = [
            'id'            => $d['id'],
            'name'          => $d['name'],
            'removable'     => (bool)$d['removable'],
            'accent'        => $d['accent']          ?? '#0af',
            'icon'          => $d['icon']            ?? '',
            'photo'         => $d['photo']           ?? '',
            'fullName'      => jd($d['full_name'],   ['ar'=>'','en'=>'','de'=>'']),
            'subtitle'      => jd($d['subtitle'],    ['ar'=>'','en'=>'','de'=>'']),
            'since'         => (int)($d['since']     ?? 2015),
            'showInAbout'   => (bool)$d['show_in_about'],
            'globalColor'   => $d['global_color']    ?? null,
            'footerBgColor' => $d['footer_bg_color'] ?? null,
            'footerText'    => jd($d['footer_text'], null),
            'sidebarDocs'   => jd($d['sidebar_docs'], []),
            'qrCredentials' => jd($d['qr_credentials'], []),
            'sections'      => $secsByDocId[$d['id']] ?? [],
        ];
    }
    return $result;
}

function defaultCvProfile(): array
{
    return ['subtitle'=>'','since'=>2016,'experiences'=>[],'education'=>[],'labSkills'=>[],'references'=>[],'portfolio'=>[],'showInAbout'=>false];
}

// ═══════════════════════════════════════════════════════════════
// syncAppData — توزيع AppData على جداول قاعدة البيانات
// ═══════════════════════════════════════════════════════════════
function syncAppData(PDO $db, array $d): void
{
    $db->beginTransaction();
    try {
        syncSiteSettings($db, $d);
        syncPersonalInfo($db, $d['personalInfo'] ?? []);
        syncSkills($db, $d['skills'] ?? []);
        syncArticleCategories($db, $d['articleCategories'] ?? []);
        syncAgriArticles($db, $d['agriArticles'] ?? []);
        syncLibraryTree($db, $d['libraryTree'] ?? []);
        syncLibraryBooks($db, $d['agriBooks'] ?? []);
        syncAgriVideos($db, $d['agriVideos'] ?? []);
        syncPublicReports($db, $d['publicReports'] ?? []);
        syncGfxCategories($db, $d['gfxCategories'] ?? []);
        syncCodeSnippets($db, $d['softwareSnippets'] ?? []);
        syncWebProjects($db, $d['webProjects'] ?? []);
        syncCvDocs($db, $d['cvDocs'] ?? []);
        syncSoilAnalysis($db, $d['soilAnalysis'] ?? []);
        syncReportTemplate($db, $d['reportTemplate'] ?? []);
        syncCustomerReports($db, $d['customerReports'] ?? []);
        syncAiVault($db, $d['aiVault'] ?? []);
        syncInjectedPages($db, $d['injectedPages'] ?? []);
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
}

// ── site_settings ─────────────────────────────────────────────
function syncSiteSettings(PDO $db, array $d): void
{
    $ss = $d['siteSettings'] ?? [];
    $db->prepare("
        UPDATE site_settings SET
          logo_type            = ?, logo_img          = ?, logo_text         = ?,
          logo_color           = ?, footer_bg         = ?, footer_text       = ?,
          theme_mode           = ?, accent_color      = ?, glass_opacity     = ?,
          three_script_url     = ?, social_links      = ?, nav_items         = ?,
          site_name            = ?, site_bio          = ?, agri_cats         = ?,
          ai_diagnostics_enabled = ?, show_agri_cv   = ?, show_designer_cv  = ?,
          watermark_img        = ?, watermark_opacity = ?, library_view      = ?,
          is_seeded            = 1
        WHERE id = 1
    ")->execute([
        $ss['logoType']       ?? 'svg_alaa',
        $ss['logoImg']        ?? '',
        je($ss['logoText']    ?? ['ar'=>'','en'=>'','de'=>'']),
        $ss['logoColor']      ?? null,
        $ss['footerBg']       ?? '#001529',
        je($ss['footerText']  ?? ['ar'=>'','en'=>'','de'=>'']),
        $ss['themeMode']      ?? 'dark',
        $ss['accentColor']    ?? '#0af',
        (float)($ss['glassOpacity'] ?? 0.12),
        $ss['threeScriptUrl'] ?? null,
        je($ss['socialLinks'] ?? []),
        je($ss['navItems']    ?? []),
        $d['name']            ?? '',
        $d['bio']             ?? '',
        je($d['agriCats']     ?? []),
        ($d['aiDiagnosticsEnabled'] ?? false) ? 1 : 0,
        ($d['showAgriCv']     ?? true)  ? 1 : 0,
        ($d['showDesignerCv'] ?? true)  ? 1 : 0,
        $d['watermarkImg']    ?? '',
        (float)($d['watermarkOpacity'] ?? 0.15),
        $d['libraryView']     ?? 'tree',
    ]);
}

// ── personal_info ─────────────────────────────────────────────
function syncPersonalInfo(PDO $db, array $pi): void
{
    $db->prepare("
        UPDATE personal_info SET
          photo=?, phone=?, email=?, location=?,
          website=?, linkedin=?, github=?, twitter=?, custom_socials=?
        WHERE id=1
    ")->execute([
        $pi['photo']    ?? '',
        $pi['phone']    ?? '',
        $pi['email']    ?? '',
        $pi['location'] ?? '',
        $pi['website']  ?? '',
        $pi['linkedin'] ?? '',
        $pi['github']   ?? '',
        $pi['twitter']  ?? '',
        je($pi['customSocials'] ?? []),
    ]);
}

// ── skills ───────────────────────────────────────────────────
function syncSkills(PDO $db, array $skills): void
{
    $ids = array_column($skills, 'id');
    if ($ids) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $db->prepare("DELETE FROM skills WHERE id NOT IN ({$ph})")->execute($ids);
    } else {
        $db->exec("DELETE FROM skills");
    }
    $stmt = $db->prepare("
        INSERT INTO skills (id, name, percent, icon, size, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name=VALUES(name), percent=VALUES(percent),
          icon=VALUES(icon), size=VALUES(size), sort_order=VALUES(sort_order)
    ");
    foreach ($skills as $i => $s) {
        $stmt->execute([
            $s['id']      ?? genId(),
            $s['name']    ?? '',
            (int)($s['percent'] ?? 50),
            $s['icon']    ?? '',
            (int)($s['size']    ?? 40),
            $i,
        ]);
    }
}

// ── article_categories ───────────────────────────────────────
function syncArticleCategories(PDO $db, array $cats): void
{
    $ids = array_column($cats, 'id');
    if ($ids) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $db->prepare("DELETE FROM article_categories WHERE id NOT IN ({$ph})")->execute($ids);
    } else {
        $db->exec("DELETE FROM article_categories");
    }
    $stmt = $db->prepare("
        INSERT INTO article_categories (id, name, sort_order)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE name=VALUES(name), sort_order=VALUES(sort_order)
    ");
    foreach ($cats as $i => $c) {
        $stmt->execute([$c['id'] ?? genId(), je($c['name'] ?? ['ar'=>'','en'=>'','de'=>'']), $i]);
    }
}

// ── agri_articles ─────────────────────────────────────────────
function syncAgriArticles(PDO $db, array $articles): void
{
    $ids = array_column($articles, 'id');
    if ($ids) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $db->prepare("DELETE FROM agri_articles WHERE id NOT IN ({$ph})")->execute($ids);
    } else {
        $db->exec("DELETE FROM agri_articles");
    }
    $stmt = $db->prepare("
        INSERT INTO agri_articles
          (id, category_id, title, content, images, reference, article_date, position_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          category_id=VALUES(category_id), title=VALUES(title), content=VALUES(content),
          images=VALUES(images), reference=VALUES(reference), article_date=VALUES(article_date),
          position_index=VALUES(position_index)
    ");
    foreach ($articles as $i => $a) {
        $stmt->execute([
            $a['id']         ?? genId(),
            $a['categoryId'] ?? null,
            je($a['title']     ?? ['ar'=>'','en'=>'','de'=>'']),
            je($a['content']   ?? ['ar'=>'','en'=>'','de'=>'']),
            je($a['images']    ?? []),
            je($a['reference'] ?? ['ar'=>'','en'=>'','de'=>'']),
            $a['date']       ?? null,
            $i,
        ]);
    }
}

// ── library tree: تسطيح الشجرة ثم حفظ ────────────────────────
function syncLibraryTree(PDO $db, array $tree): void
{
    $flat  = [];
    $order = 0;
    flattenTree($tree, null, $flat, $order);

    $ids = array_column($flat, 'id');
    if ($ids) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $db->prepare("DELETE FROM library_nodes WHERE id NOT IN ({$ph})")->execute($ids);
    } else {
        $db->exec("DELETE FROM library_nodes");
    }
    $stmt = $db->prepare("
        INSERT INTO library_nodes (id, parent_id, name, sort_order)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          parent_id=VALUES(parent_id), name=VALUES(name), sort_order=VALUES(sort_order)
    ");
    foreach ($flat as $node) {
        $stmt->execute([$node['id'], $node['parent_id'], je($node['name']), $node['sort_order']]);
    }
}

function flattenTree(array $nodes, ?string $parentId, array &$out, int &$order): void
{
    foreach ($nodes as $node) {
        $id = $node['id'] ?? genId();
        $out[] = [
            'id'         => $id,
            'parent_id'  => $parentId,
            'name'       => $node['name'] ?? ['ar'=>'','en'=>'','de'=>''],
            'sort_order' => $order++,
        ];
        if (!empty($node['children'])) {
            flattenTree($node['children'], $id, $out, $order);
        }
    }
}

// ── library_books ─────────────────────────────────────────────
function syncLibraryBooks(PDO $db, array $books): void
{
    $ids = array_column($books, 'id');
    if ($ids) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $db->prepare("DELETE FROM library_books WHERE id NOT IN ({$ph})")->execute($ids);
    } else {
        $db->exec("DELETE FROM library_books");
    }
    $stmt = $db->prepare("
        INSERT INTO library_books
          (id, node_id, title, author, thumbnail, drive_url, preview_url,
           is_paid, pages, kind, languages, position_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          node_id=VALUES(node_id), title=VALUES(title), author=VALUES(author),
          thumbnail=VALUES(thumbnail), drive_url=VALUES(drive_url),
          preview_url=VALUES(preview_url), is_paid=VALUES(is_paid),
          pages=VALUES(pages), kind=VALUES(kind), languages=VALUES(languages),
          position_index=VALUES(position_index)
    ");
    foreach ($books as $i => $b) {
        $stmt->execute([
            $b['id']         ?? genId(),
            $b['nodeId']     ?? null,
            je($b['title']   ?? ['ar'=>'','en'=>'','de'=>'']),
            je($b['author']  ?? ['ar'=>'','en'=>'','de'=>'']),
            $b['thumbnail']  ?? '',
            $b['driveUrl']   ?? '',
            $b['previewUrl'] ?? '',
            ($b['isPaid']    ?? false) ? 1 : 0,
            $b['pages']      ?? '',
            $b['kind']       ?? 'both',
            je($b['languages'] ?? []),
            $i,
        ]);
    }
}

// ── agri_videos ───────────────────────────────────────────────
function syncAgriVideos(PDO $db, array $videos): void
{
    $ids = array_column($videos, 'id');
    if ($ids) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $db->prepare("DELETE FROM agri_videos WHERE id NOT IN ({$ph})")->execute($ids);
    } else {
        $db->exec("DELETE FROM agri_videos");
    }
    $stmt = $db->prepare("
        INSERT INTO agri_videos (id, title, url, visible, position_index)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title=VALUES(title), url=VALUES(url), visible=VALUES(visible),
          position_index=VALUES(position_index)
    ");
    foreach ($videos as $i => $v) {
        $stmt->execute([
            $v['id']  ?? genId(),
            je($v['title'] ?? ['ar'=>'','en'=>'','de'=>'']),
            $v['url']     ?? '',
            ($v['visible'] ?? true) ? 1 : 0,
            $i,
        ]);
    }
}

// ── public_reports ───────────────────────────────────────────
function syncPublicReports(PDO $db, array $reports): void
{
    $ids = array_column($reports, 'id');
    if ($ids) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $db->prepare("DELETE FROM public_reports WHERE id NOT IN ({$ph})")->execute($ids);
    } else {
        $db->exec("DELETE FROM public_reports");
    }
    $stmt = $db->prepare("
        INSERT INTO public_reports (id, title, thumbnail, url, visible, position_index)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title=VALUES(title), thumbnail=VALUES(thumbnail), url=VALUES(url),
          visible=VALUES(visible), position_index=VALUES(position_index)
    ");
    foreach ($reports as $i => $r) {
        $stmt->execute([
            $r['id']        ?? genId(),
            je($r['title']  ?? ['ar'=>'','en'=>'','de'=>'']),
            $r['thumbnail'] ?? '',
            $r['url']       ?? '',
            ($r['visible']  ?? true) ? 1 : 0,
            $i,
        ]);
    }
}

// ── gfx_categories + gfx_subcategories + gfx_items ───────────
function syncGfxCategories(PDO $db, array $cats): void
{
    // نحذف الكل ثم نعيد الإدخال (cascade يحذف subs و items تلقائياً)
    $db->exec("DELETE FROM gfx_categories");

    $stmtCat = $db->prepare("INSERT INTO gfx_categories (id, name, icon, sort_order) VALUES (?, ?, ?, ?)");
    $stmtSub = $db->prepare("INSERT INTO gfx_subcategories (id, category_id, name, sort_order) VALUES (?, ?, ?, ?)");
    $stmtItem = $db->prepare("
        INSERT INTO gfx_items
          (id, subcategory_id, title, description, main_img, images, video_url,
           used_skill_ids, cv_is_featured, cv_img_size, cv_show_desc, cv_show_tools, position_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    foreach ($cats as $ci => $cat) {
        $catId = $cat['id'] ?? genId();
        $stmtCat->execute([$catId, je($cat['name'] ?? ['ar'=>'','en'=>'','de'=>'']), $cat['icon'] ?? '', $ci]);

        foreach ($cat['subCategories'] ?? [] as $si => $sub) {
            $subId = $sub['id'] ?? genId();
            $stmtSub->execute([$subId, $catId, je($sub['name'] ?? ['ar'=>'','en'=>'','de'=>'']), $si]);

            foreach ($sub['items'] ?? [] as $ii => $item) {
                $cv = $item['cvSettings'] ?? [];
                $stmtItem->execute([
                    $item['id']      ?? genId(),
                    $subId,
                    je($item['title'] ?? ['ar'=>'','en'=>'','de'=>'']),
                    je($item['desc']  ?? ['ar'=>'','en'=>'','de'=>'']),
                    $item['mainImg']  ?? '',
                    je($item['images'] ?? []),
                    $item['videoUrl'] ?? '',
                    je($item['usedSkillsIds'] ?? []),
                    ($cv['isFeatured'] ?? false) ? 1 : 0,
                    (int)($cv['imgSize']  ?? 100),
                    ($cv['showDesc']  ?? true) ? 1 : 0,
                    ($cv['showTools'] ?? true) ? 1 : 0,
                    $ii,
                ]);
            }
        }
    }
}

// ── code_snippets ─────────────────────────────────────────────
function syncCodeSnippets(PDO $db, array $snippets): void
{
    $ids = array_filter(array_column($snippets, 'id'));
    if ($ids) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $db->prepare("DELETE FROM code_snippets WHERE id NOT IN ({$ph})")->execute(array_values($ids));
    } else {
        $db->exec("DELETE FROM code_snippets");
    }
    $stmt = $db->prepare("
        INSERT INTO code_snippets
          (id, title, description, code_html, code_css, code_js, category, position_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title=VALUES(title), description=VALUES(description),
          code_html=VALUES(code_html), code_css=VALUES(code_css),
          code_js=VALUES(code_js), category=VALUES(category),
          position_index=VALUES(position_index)
    ");
    foreach ($snippets as $i => $s) {
        $stmt->execute([
            $s['id']       ?? genId(),
            $s['title']    ?? '',
            $s['desc']     ?? '',
            $s['codeHtml'] ?? '',
            $s['codeCss']  ?? '',
            $s['codeJs']   ?? '',
            $s['category'] ?? '',
            $i,
        ]);
    }
}

// ── web_projects ─────────────────────────────────────────────
function syncWebProjects(PDO $db, array $projects): void
{
    $ids = array_column($projects, 'id');
    if ($ids) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $db->prepare("DELETE FROM web_projects WHERE id NOT IN ({$ph})")->execute($ids);
    } else {
        $db->exec("DELETE FROM web_projects");
    }
    $stmt = $db->prepare("
        INSERT INTO web_projects
          (id, title, description, main_img, images, video_url, live_url,
           github_url, github_visible, tags, thumb_size, position_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          title=VALUES(title), description=VALUES(description), main_img=VALUES(main_img),
          images=VALUES(images), video_url=VALUES(video_url), live_url=VALUES(live_url),
          github_url=VALUES(github_url), github_visible=VALUES(github_visible),
          tags=VALUES(tags), thumb_size=VALUES(thumb_size), position_index=VALUES(position_index)
    ");
    foreach ($projects as $i => $p) {
        $stmt->execute([
            $p['id']              ?? genId(),
            je($p['title']        ?? ['ar'=>'','en'=>'','de'=>'']),
            je($p['desc']         ?? ['ar'=>'','en'=>'','de'=>'']),
            $p['mainImg']         ?? '',
            je($p['images']       ?? []),
            $p['videoUrl']        ?? '',
            $p['liveUrl']         ?? '',
            $p['githubUrl']       ?? '',
            ($p['githubVisible']  ?? true) ? 1 : 0,
            je($p['tags']         ?? []),
            (int)($p['thumbSize'] ?? 220),
            $i,
        ]);
    }
}

// ── cv_docs + cv_sections ────────────────────────────────────
function syncCvDocs(PDO $db, array $docs): void
{
    $ids = array_column($docs, 'id');
    if ($ids) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        // cascade يحذف cv_sections تلقائياً
        $db->prepare("DELETE FROM cv_docs WHERE id NOT IN ({$ph})")->execute($ids);
    } else {
        $db->exec("DELETE FROM cv_docs");
    }
    $stmtDoc = $db->prepare("
        INSERT INTO cv_docs
          (id, name, removable, accent, icon, photo, full_name, subtitle, since,
           show_in_about, global_color, footer_bg_color, footer_text, sidebar_docs, qr_credentials, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name=VALUES(name), removable=VALUES(removable), accent=VALUES(accent),
          icon=VALUES(icon), photo=VALUES(photo), full_name=VALUES(full_name),
          subtitle=VALUES(subtitle), since=VALUES(since), show_in_about=VALUES(show_in_about),
          global_color=VALUES(global_color), footer_bg_color=VALUES(footer_bg_color),
          footer_text=VALUES(footer_text), sidebar_docs=VALUES(sidebar_docs),
          qr_credentials=VALUES(qr_credentials), sort_order=VALUES(sort_order)
    ");
    $stmtSec = $db->prepare("
        INSERT INTO cv_sections
          (id, cv_doc_id, kind, title, column_pos, visible, entries, tags,
           contact_items, portfolio, text_content, use_global_skills,
           gallery_layout, img_height, page_break_before, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          kind=VALUES(kind), title=VALUES(title), column_pos=VALUES(column_pos),
          visible=VALUES(visible), entries=VALUES(entries), tags=VALUES(tags),
          contact_items=VALUES(contact_items), portfolio=VALUES(portfolio),
          text_content=VALUES(text_content), use_global_skills=VALUES(use_global_skills),
          gallery_layout=VALUES(gallery_layout), img_height=VALUES(img_height),
          page_break_before=VALUES(page_break_before), sort_order=VALUES(sort_order)
    ");

    foreach ($docs as $di => $doc) {
        $docId = $doc['id'] ?? genId();
        $stmtDoc->execute([
            $docId,
            $doc['name']          ?? 'CV',
            ($doc['removable']    ?? true) ? 1 : 0,
            $doc['accent']        ?? '#0af',
            $doc['icon']          ?? '',
            $doc['photo']         ?? '',
            je($doc['fullName']   ?? ['ar'=>'','en'=>'','de'=>'']),
            je($doc['subtitle']   ?? ['ar'=>'','en'=>'','de'=>'']),
            (int)($doc['since']   ?? 2015),
            ($doc['showInAbout']  ?? false) ? 1 : 0,
            $doc['globalColor']   ?? null,
            $doc['footerBgColor'] ?? null,
            $doc['footerText']    !== null ? je($doc['footerText']) : null,
            je($doc['sidebarDocs']    ?? []),
            je($doc['qrCredentials']  ?? []),
            $di,
        ]);

        // حذف الأقسام القديمة التي لم تعد موجودة
        $secIds = array_column($doc['sections'] ?? [], 'id');
        if ($secIds) {
            $ph = implode(',', array_fill(0, count($secIds), '?'));
            $params = array_merge([$docId], $secIds);
            $db->prepare("DELETE FROM cv_sections WHERE cv_doc_id=? AND id NOT IN ({$ph})")->execute($params);
        } else {
            $db->prepare("DELETE FROM cv_sections WHERE cv_doc_id=?")->execute([$docId]);
        }

        foreach ($doc['sections'] ?? [] as $si => $s) {
            $stmtSec->execute([
                $s['id']              ?? genId(),
                $docId,
                $s['kind']            ?? 'text',
                je($s['title']        ?? ['ar'=>'','en'=>'','de'=>'']),
                $s['column']          ?? 'full',
                ($s['visible']        ?? true) ? 1 : 0,
                je($s['entries']      ?? []),
                je($s['tags']         ?? []),
                je($s['contactItems'] ?? []),
                je($s['portfolio']    ?? []),
                isset($s['text'])     ? je($s['text']) : null,
                ($s['useGlobalSkills']?? false) ? 1 : 0,
                (int)($s['galleryLayout'] ?? 1),
                (int)($s['imgHeight']     ?? 120),
                ($s['pageBreakBefore']    ?? false) ? 1 : 0,
                $si,
            ]);
        }
    }
}

// ── soil_analysis ─────────────────────────────────────────────
function syncSoilAnalysis(PDO $db, array $rows): void
{
    $ids = array_column($rows, 'id');
    if ($ids) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $db->prepare("DELETE FROM soil_analysis WHERE id NOT IN ({$ph})")->execute($ids);
    } else {
        $db->exec("DELETE FROM soil_analysis");
    }
    $stmt = $db->prepare("
        INSERT INTO soil_analysis (id, name, ideal, actual, price, tax, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name=VALUES(name), ideal=VALUES(ideal), actual=VALUES(actual),
          price=VALUES(price), tax=VALUES(tax), sort_order=VALUES(sort_order)
    ");
    foreach ($rows as $i => $r) {
        $nameVal = is_array($r['name'] ?? null)
            ? je($r['name'])
            : je(['ar' => (string)($r['name'] ?? ''), 'en' => (string)($r['name'] ?? ''), 'de' => (string)($r['name'] ?? '')]);
        $stmt->execute([
            $r['id']    ?? genId(),
            $nameVal,
            $r['ideal'] ?? '',
            $r['actual']?? '',
            (float)($r['price'] ?? 0),
            (float)($r['tax']   ?? 5),
            $i,
        ]);
    }
}

// ── report_template ───────────────────────────────────────────
function syncReportTemplate(PDO $db, array $rt): void
{
    $db->prepare("
        UPDATE report_template SET
          theme_color=?, header_logo=?, header_text=?, footer_text=?,
          eng_name=?, eng_title=?, eng_signature=?, eng_stamp=?, paid_stamp=?, currency=?
        WHERE id=1
    ")->execute([
        $rt['themeColor']   ?? '#003366',
        $rt['headerLogo']   ?? '',
        je($rt['headerText']?? ['ar'=>'','en'=>'','de'=>'']),
        je($rt['footerText']?? ['ar'=>'','en'=>'','de'=>'']),
        je($rt['engName']   ?? ['ar'=>'','en'=>'','de'=>'']),
        je($rt['engTitle']  ?? ['ar'=>'','en'=>'','de'=>'']),
        $rt['engSignature'] ?? '',
        $rt['engStamp']     ?? '',
        $rt['paidStamp']    ?? '',
        $rt['currency']     ?? '',
    ]);
}

// ── customer_reports ─────────────────────────────────────────
function syncCustomerReports(PDO $db, array $reports): void
{
    $ids = array_column($reports, 'id');
    if ($ids) {
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $db->prepare("DELETE FROM customer_reports WHERE id NOT IN ({$ph})")->execute($ids);
    } else {
        $db->exec("DELETE FROM customer_reports");
    }
    $stmt = $db->prepare("
        INSERT INTO customer_reports
          (id, report_type, customer_name, customer_phone, customer_location,
           attendance_date, exam_date, images, plant_name, description,
           soil_rows, final_report)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          report_type=VALUES(report_type), customer_name=VALUES(customer_name),
          customer_phone=VALUES(customer_phone), customer_location=VALUES(customer_location),
          attendance_date=VALUES(attendance_date), exam_date=VALUES(exam_date),
          images=VALUES(images), plant_name=VALUES(plant_name), description=VALUES(description),
          soil_rows=VALUES(soil_rows), final_report=VALUES(final_report)
    ");
    foreach ($reports as $r) {
        $stmt->execute([
            $r['id']               ?? genId(),
            $r['reportType']       ?? 'soil',
            $r['customerName']     ?? '',
            $r['customerPhone']    ?? '',
            $r['customerLocation'] ?? '',
            $r['attendanceDate']   ?: null,
            $r['examDate']         ?: null,
            je($r['images']        ?? []),
            je($r['plantName']     ?? ['ar'=>'','en'=>'','de'=>'']),
            je($r['description']   ?? ['ar'=>'','en'=>'','de'=>'']),
            je($r['soilRows']      ?? []),
            je($r['finalReport']   ?? ['ar'=>'','en'=>'','de'=>'']),
        ]);
    }
}

// ── ai_vault ─────────────────────────────────────────────────
function syncAiVault(PDO $db, array $items): void
{
    try {
        $ids = array_column($items, 'id');
        if ($ids) {
            $ph = implode(',', array_fill(0, count($ids), '?'));
            $db->prepare("DELETE FROM ai_vault WHERE id NOT IN ({$ph})")->execute($ids);
        } else {
            $db->exec("DELETE FROM ai_vault");
        }
        $stmt = $db->prepare("
            INSERT INTO ai_vault (id, title, prompt, img, category_id, sub_category_id, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              title=VALUES(title), prompt=VALUES(prompt), img=VALUES(img),
              category_id=VALUES(category_id), sub_category_id=VALUES(sub_category_id),
              sort_order=VALUES(sort_order)
        ");
        foreach ($items as $i => $item) {
            $stmt->execute([
                $item['id']            ?? genId(),
                je($item['title']      ?? ['ar'=>'','en'=>'','de'=>'']),
                $item['prompt']        ?? '',
                $item['img']           ?? '',
                $item['categoryId']    ?? '',
                $item['subCategoryId'] ?? '',
                $i,
            ]);
        }
    } catch (Throwable $e) { /* الجدول لم يُنشأ بعد */ }
}

// ── injected_pages ───────────────────────────────────────────
function syncInjectedPages(PDO $db, array $pages): void
{
    try {
        $db->exec("DELETE FROM injected_pages");
        $stmt = $db->prepare("
            INSERT INTO injected_pages (id, title, html, css, sort_order)
            VALUES (?, ?, ?, ?, ?)
        ");
        foreach ($pages as $i => $p) {
            $stmt->execute([genId(), $p['title'] ?? '', $p['html'] ?? '', $p['css'] ?? '', $i]);
        }
    } catch (Throwable $e) { /* الجدول لم يُنشأ بعد */ }
}
