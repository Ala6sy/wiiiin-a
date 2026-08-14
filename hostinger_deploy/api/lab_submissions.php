<?php
/**
 * api/lab_submissions.php — طلبات زوار مختبرات الأكواد
 *
 * POST { action:"submit", clientId, submission:{...} }           — عام
 * GET  ?action=status&clientId=...                               — عام
 * GET  ?action=list&status=pending                               — مدير (JWT)
 * POST { action:"approve"|"reject", id, adminNote? }             — مدير (JWT)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'config.php not found']);
    exit;
}
require $configFile;
require __DIR__ . '/middleware.php';

function ensureLabSubmissionsTable(PDO $db): void
{
    static $done = false;
    if ($done) return;
    $done = true;
    $db->exec("CREATE TABLE IF NOT EXISTS `lab_submissions` (
      `id` VARCHAR(36) NOT NULL,
      `client_id` VARCHAR(64) NOT NULL,
      `visitor_name` VARCHAR(120) DEFAULT NULL,
      `visitor_contact` VARCHAR(200) DEFAULT NULL,
      `title` VARCHAR(200) NOT NULL DEFAULT '',
      `description` TEXT DEFAULT NULL,
      `code_html` LONGTEXT DEFAULT NULL,
      `code_css` LONGTEXT DEFAULT NULL,
      `code_js` LONGTEXT DEFAULT NULL,
      `category` VARCHAR(80) DEFAULT NULL,
      `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      `admin_note` TEXT DEFAULT NULL,
      `approved_snippet_id` VARCHAR(36) DEFAULT NULL,
      `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      `reviewed_at` DATETIME DEFAULT NULL,
      PRIMARY KEY (`id`),
      KEY `idx_status` (`status`),
      KEY `idx_client_id` (`client_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function genId(): string
{
    return bin2hex(random_bytes(16));
}

function rowToSubmission(array $r): array
{
    return [
        'id'                => $r['id'],
        'clientId'          => $r['client_id'],
        'visitorName'       => $r['visitor_name'] ?? '',
        'visitorContact'    => $r['visitor_contact'] ?? '',
        'title'             => $r['title'] ?? '',
        'desc'              => $r['description'] ?? '',
        'codeHtml'          => $r['code_html'] ?? '',
        'codeCss'           => $r['code_css'] ?? '',
        'codeJs'            => $r['code_js'] ?? '',
        'category'          => $r['category'] ?? '',
        'status'            => $r['status'] ?? 'pending',
        'adminNote'         => $r['admin_note'] ?? '',
        'approvedSnippetId' => $r['approved_snippet_id'] ?? '',
        'createdAt'         => $r['created_at'] ?? '',
        'reviewedAt'        => $r['reviewed_at'] ?? '',
    ];
}

function clip(string $s, int $max): string
{
    return mb_substr(trim($s), 0, $max);
}

$method = $_SERVER['REQUEST_METHOD'];

try {
    ensureLabSubmissionsTable($pdo);

    if ($method === 'GET') {
        $action = $_GET['action'] ?? '';

        if ($action === 'status') {
            $clientId = trim($_GET['clientId'] ?? '');
            if ($clientId === '' || strlen($clientId) > 64) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'clientId required']);
                exit;
            }
            $stmt = $pdo->prepare("SELECT * FROM lab_submissions WHERE client_id = ? ORDER BY created_at DESC LIMIT 50");
            $stmt->execute([$clientId]);
            $items = array_map('rowToSubmission', $stmt->fetchAll(PDO::FETCH_ASSOC));
            echo json_encode(['ok' => true, 'items' => $items], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($action === 'list') {
            requireAuth();
            $status = $_GET['status'] ?? 'pending';
            if (!in_array($status, ['pending', 'approved', 'rejected', 'all'], true)) {
                $status = 'pending';
            }
            if ($status === 'all') {
                $rows = $pdo->query("SELECT * FROM lab_submissions ORDER BY created_at DESC LIMIT 200")->fetchAll(PDO::FETCH_ASSOC);
            } else {
                $stmt = $pdo->prepare("SELECT * FROM lab_submissions WHERE status = ? ORDER BY created_at DESC LIMIT 200");
                $stmt->execute([$status]);
                $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }
            echo json_encode(['ok' => true, 'items' => array_map('rowToSubmission', $rows)], JSON_UNESCAPED_UNICODE);
            exit;
        }

        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Unknown action']);
        exit;
    }

    if ($method === 'POST') {
        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Invalid JSON']);
            exit;
        }
        $action = $body['action'] ?? '';

        if ($action === 'submit') {
            $clientId = trim($body['clientId'] ?? '');
            $sub = $body['submission'] ?? [];
            if ($clientId === '' || strlen($clientId) > 64) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'clientId required']);
                exit;
            }
            $title = clip($sub['title'] ?? '', 200);
            if ($title === '') {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'title required']);
                exit;
            }
            $id = trim($sub['id'] ?? '');
            if ($id === '' || strlen($id) > 36) {
                $id = genId();
            }
            $html = (string)($sub['codeHtml'] ?? '');
            $css  = (string)($sub['codeCss'] ?? '');
            $js   = (string)($sub['codeJs'] ?? '');
            if (strlen($html) > 500000 || strlen($css) > 200000 || strlen($js) > 200000) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'code too large']);
                exit;
            }
            $stmt = $pdo->prepare("
                INSERT INTO lab_submissions
                  (id, client_id, visitor_name, visitor_contact, title, description,
                   code_html, code_css, code_js, category, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
                ON DUPLICATE KEY UPDATE
                  visitor_name=VALUES(visitor_name),
                  visitor_contact=VALUES(visitor_contact),
                  title=VALUES(title),
                  description=VALUES(description),
                  code_html=VALUES(code_html),
                  code_css=VALUES(code_css),
                  code_js=VALUES(code_js),
                  category=VALUES(category),
                  status=IF(status='approved', status, 'pending'),
                  admin_note=IF(status='approved', admin_note, NULL),
                  reviewed_at=IF(status='approved', reviewed_at, NULL)
            ");
            $stmt->execute([
                $id,
                $clientId,
                clip($sub['visitorName'] ?? '', 120),
                clip($sub['visitorContact'] ?? '', 200),
                $title,
                clip($sub['desc'] ?? '', 2000),
                $html,
                $css,
                $js,
                clip($sub['category'] ?? '', 80),
            ]);
            echo json_encode(['ok' => true, 'id' => $id], JSON_UNESCAPED_UNICODE);
            exit;
        }

        requireAuth();

        if ($action === 'approve') {
            $id = trim($body['id'] ?? '');
            if ($id === '') {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'id required']);
                exit;
            }
            $stmt = $pdo->prepare("SELECT * FROM lab_submissions WHERE id = ? LIMIT 1");
            $stmt->execute([$id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                http_response_code(404);
                echo json_encode(['ok' => false, 'error' => 'not found']);
                exit;
            }
            if ($row['status'] === 'approved' && !empty($row['approved_snippet_id'])) {
                echo json_encode([
                    'ok' => true,
                    'snippet' => [
                        'id'       => $row['approved_snippet_id'],
                        'title'    => $row['title'],
                        'desc'     => $row['description'],
                        'codeHtml' => $row['code_html'],
                        'codeCss'  => $row['code_css'],
                        'codeJs'   => $row['code_js'],
                        'category' => $row['category'],
                    ],
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }
            $snippetId = genId();
            $pos = (int)$pdo->query("SELECT COALESCE(MAX(position_index), -1) + 1 FROM code_snippets")->fetchColumn();
            $ins = $pdo->prepare("
                INSERT INTO code_snippets
                  (id, title, description, code_html, code_css, code_js, category, position_index)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $ins->execute([
                $snippetId,
                $row['title'],
                $row['description'],
                $row['code_html'],
                $row['code_css'],
                $row['code_js'],
                $row['category'],
                $pos,
            ]);
            $upd = $pdo->prepare("
                UPDATE lab_submissions
                SET status='approved', approved_snippet_id=?, reviewed_at=NOW(), admin_note=?
                WHERE id=?
            ");
            $upd->execute([
                $snippetId,
                clip($body['adminNote'] ?? '', 500),
                $id,
            ]);
            echo json_encode([
                'ok' => true,
                'snippet' => [
                    'id'       => $snippetId,
                    'title'    => $row['title'],
                    'desc'     => $row['description'],
                    'codeHtml' => $row['code_html'],
                    'codeCss'  => $row['code_css'],
                    'codeJs'   => $row['code_js'],
                    'category' => $row['category'],
                ],
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($action === 'reject') {
            $id = trim($body['id'] ?? '');
            if ($id === '') {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'id required']);
                exit;
            }
            $note = clip($body['adminNote'] ?? '', 500);
            $upd = $pdo->prepare("
                UPDATE lab_submissions
                SET status='rejected', admin_note=?, reviewed_at=NOW()
                WHERE id=? AND status='pending'
            ");
            $upd->execute([$note, $id]);
            echo json_encode(['ok' => true, 'updated' => $upd->rowCount() > 0], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if ($action === 'delete') {
            $id = trim($body['id'] ?? '');
            $stmt = $pdo->prepare("DELETE FROM lab_submissions WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
            exit;
        }

        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Unknown action']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
