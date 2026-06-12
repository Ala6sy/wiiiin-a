# دليل الـ Backend — eng-alaa.com
## Hostinger Shared Hosting · PHP 8.x · MySQL 8.x

---

## §1 — هيكل المجلدات على الاستضافة

```
public_html/
├── index.html              ← ملف React المبني (npm run build)
├── assets/                 ← JS/CSS/fonts المبنية
├── api/                    ← نقاط الـ API بـ PHP
│   ├── config.php          ← إعدادات قاعدة البيانات (لا ترفعها على GitHub!)
│   ├── auth.php            ← تسجيل الدخول / الخروج
│   ├── settings.php        ← GET/PUT site_settings
│   ├── projects.php        ← CRUD web_projects
│   ├── articles.php        ← CRUD agri_articles
│   ├── library.php         ← CRUD library_nodes + library_books
│   ├── cvdocs.php          ← CRUD cv_docs + cv_sections
│   ├── reports.php         ← CRUD customer_reports
│   ├── skills.php          ← CRUD skills
│   ├── upload.php          ← رفع الصور
│   └── files.php           ← قائمة/حذف الملفات المرفوعة
├── uploads/                ← الصور المرفوعة (777 permissions)
│   ├── projects/
│   ├── books/
│   ├── reports/
│   ├── gfx/
│   └── general/
└── .htaccess               ← إعادة توجيه React Router + حماية api/config.php
```

---

## §2 — ملف .htaccess المطلوب

```apache
# إعادة توجيه كل الطلبات لـ React (SPA)
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # حماية ملف الإعدادات
  RewriteRule ^api/config\.php$ - [F,L]

  # السماح لملفات api/ و assets/ و uploads/ بالمرور مباشرة
  RewriteCond %{REQUEST_URI} ^/api/ [OR]
  RewriteCond %{REQUEST_URI} ^/assets/ [OR]
  RewriteCond %{REQUEST_URI} ^/uploads/
  RewriteRule ^ - [L]

  # كل الباقي → index.html
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>

# رؤوس CORS (تحتاجها إذا API و frontend على نفس الدومين — احتياطي)
<IfModule mod_headers.c>
  Header set Access-Control-Allow-Origin "https://eng-alaa.com"
  Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
  Header set Access-Control-Allow-Headers "Content-Type, Authorization"
</IfModule>
```

---

## §3 — ملف config.php (لا ترفعه على GitHub)

```php
<?php
// api/config.php
define('DB_HOST', 'localhost');
define('DB_NAME', 'u123456_alaa');   // اسم قاعدة البيانات من Hostinger cPanel
define('DB_USER', 'u123456_alaa');   // اسم المستخدم
define('DB_PASS', 'YOUR_PASSWORD');  // كلمة المرور

define('JWT_SECRET', 'CHANGE_ME_TO_RANDOM_64_CHARS');  // سر عشوائي طويل

// مجلد الرفع
define('UPLOAD_BASE', dirname(__DIR__) . '/uploads/');
define('UPLOAD_URL',  'https://eng-alaa.com/uploads/');

// حجم الصورة الأقصى: 5MB
define('MAX_UPLOAD_BYTES', 5 * 1024 * 1024);

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER, DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
} catch (PDOException $e) {
    http_response_code(500);
    die(json_encode(['error' => 'DB connection failed']));
}
```

---

## §4 — إنشاء أول مستخدم Admin (bcrypt)

### الطريقة أ — عبر PHP CLI أو سكريبت مؤقت
أنشئ ملف مؤقت `api/create_admin.php` واحذفه فور الانتهاء:

```php
<?php
// api/create_admin.php  ← احذفه بعد الاستخدام مباشرة!
require 'config.php';

$username = 'admin';
$password = 'YOUR_STRONG_PASSWORD';   // ← غيّره
$hash     = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

$stmt = $pdo->prepare(
    "INSERT INTO admin_users (username, password_hash, display_name, role)
     VALUES (?, ?, 'Eng. Alaa Almasri', 'super')"
);
$stmt->execute([$username, $hash]);

echo "Admin created. Hash: " . $hash;
// احذف هذا الملف الآن!
```

افتح الرابط مرة واحدة: `https://eng-alaa.com/api/create_admin.php`  
ثم احذف الملف فوراً من File Manager في Hostinger.

### الطريقة ب — مباشرة عبر phpMyAdmin
1. افتح phpMyAdmin → اختر قاعدة البيانات
2. افتح تبويب SQL
3. شغّل هذا الاستعلام (بعد توليد الـ hash خارجياً):

```sql
-- ولّد الـ hash أولاً على: https://bcrypt-generator.com (cost=12)
INSERT INTO admin_users (username, password_hash, display_name, role)
VALUES (
  'admin',
  '$2y$12$PASTE_YOUR_HASH_HERE',
  'Eng. Alaa Almasri',
  'super'
);
```

---

## §5 — نموذج API في PHP (auth.php)

```php
<?php
// api/auth.php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://eng-alaa.com');

require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $username = trim($body['username'] ?? '');
    $password = trim($body['password'] ?? '');

    if (!$username || !$password) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing credentials']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT * FROM admin_users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        // توليد JWT بسيط (أو استخدم مكتبة firebase/php-jwt)
        $payload = base64_encode(json_encode([
            'id'   => $user['id'],
            'role' => $user['role'],
            'exp'  => time() + 86400  // 24 ساعة
        ]));
        $sig = hash_hmac('sha256', $payload, JWT_SECRET);
        $token = $payload . '.' . $sig;

        // تحديث آخر تسجيل دخول
        $pdo->prepare("UPDATE admin_users SET last_login=NOW() WHERE id=?")
            ->execute([$user['id']]);

        echo json_encode(['token' => $token, 'role' => $user['role']]);
    } else {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
```

---

## §6 — نموذج API CRUD (projects.php)

```php
<?php
// api/projects.php
header('Content-Type: application/json');
require 'config.php';
require 'middleware.php';   // يتحقق من JWT ويضع $currentUser

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {

    case 'GET':
        // عام — بدون مصادقة
        $rows = $pdo->query("SELECT * FROM web_projects ORDER BY position_index, created_at")->fetchAll();
        foreach ($rows as &$r) {
            $r['title']       = json_decode($r['title'], true);
            $r['description'] = json_decode($r['description'], true);
            $r['images']      = json_decode($r['images'], true);
            $r['tags']        = json_decode($r['tags'], true);
        }
        echo json_encode($rows);
        break;

    case 'POST':
        requireAuth();   // من middleware.php
        $b = json_decode(file_get_contents('php://input'), true);
        $id = $b['id'] ?? bin2hex(random_bytes(9));
        $stmt = $pdo->prepare("
            INSERT INTO web_projects
              (id, title, description, main_img, images, video_url, live_url,
               github_url, github_visible, tags, thumb_size, position_index)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ");
        $stmt->execute([
            $id,
            json_encode($b['title']       ?? ['ar'=>'','en'=>'','de'=>'']),
            json_encode($b['description'] ?? ['ar'=>'','en'=>'','de'=>'']),
            $b['mainImg']       ?? '',
            json_encode($b['images']      ?? []),
            $b['videoUrl']      ?? '',
            $b['liveUrl']       ?? '',
            $b['githubUrl']     ?? '',
            ($b['githubVisible'] ?? true) ? 1 : 0,
            json_encode($b['tags']        ?? []),
            $b['thumbSize']     ?? 220,
            $b['positionIndex'] ?? 0,
        ]);
        echo json_encode(['success' => true, 'id' => $id]);
        break;

    case 'PUT':
        requireAuth();
        $b  = json_decode(file_get_contents('php://input'), true);
        $id = $b['id'] ?? '';
        $stmt = $pdo->prepare("
            UPDATE web_projects SET
              title=?, description=?, main_img=?, images=?, video_url=?, live_url=?,
              github_url=?, github_visible=?, tags=?, thumb_size=?, position_index=?
            WHERE id=?
        ");
        $stmt->execute([
            json_encode($b['title']       ?? ['ar'=>'','en'=>'','de'=>'']),
            json_encode($b['description'] ?? ['ar'=>'','en'=>'','de'=>'']),
            $b['mainImg']       ?? '',
            json_encode($b['images']      ?? []),
            $b['videoUrl']      ?? '',
            $b['liveUrl']       ?? '',
            $b['githubUrl']     ?? '',
            ($b['githubVisible'] ?? true) ? 1 : 0,
            json_encode($b['tags']        ?? []),
            $b['thumbSize']     ?? 220,
            $b['positionIndex'] ?? 0,
            $id,
        ]);
        echo json_encode(['success' => true]);
        break;

    case 'DELETE':
        requireAuth();
        $id = $_GET['id'] ?? '';
        $pdo->prepare("DELETE FROM web_projects WHERE id=?")->execute([$id]);
        echo json_encode(['success' => true]);
        break;
}
```

---

## §7 — رفع الصور (upload.php)

```php
<?php
// api/upload.php
header('Content-Type: application/json');
require 'config.php';
require 'middleware.php';
requireAuth();

$folder  = preg_replace('/[^a-z0-9_]/', '', strtolower($_POST['folder'] ?? 'general'));
$target  = UPLOAD_BASE . $folder . '/';

if (!is_dir($target)) {
    mkdir($target, 0755, true);
}

if (!isset($_FILES['file'])) {
    http_response_code(400);
    die(json_encode(['error' => 'No file uploaded']));
}

$file = $_FILES['file'];

// التحقق من النوع والحجم
$allowed = ['image/jpeg','image/png','image/webp','image/gif','application/pdf'];
if (!in_array($file['type'], $allowed)) {
    http_response_code(415);
    die(json_encode(['error' => 'File type not allowed']));
}
if ($file['size'] > MAX_UPLOAD_BYTES) {
    http_response_code(413);
    die(json_encode(['error' => 'File too large (max 5MB)']));
}

// اسم فريد لتجنب التعارض
$ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
$newName  = uniqid('', true) . '.' . strtolower($ext);
$destPath = $target . $newName;

if (move_uploaded_file($file['tmp_name'], $destPath)) {
    // سجّل في جدول uploaded_files
    $stmt = $pdo->prepare(
        "INSERT INTO uploaded_files (filename, original, folder, mime_type, size_bytes, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([$newName, $file['name'], $folder, $file['type'], $file['size'],
                    $currentUser['id'] ?? null]);

    echo json_encode([
        'url'      => UPLOAD_URL . $folder . '/' . $newName,
        'filename' => $newName,
        'folder'   => $folder,
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to move file']);
}
```

**صلاحيات مجلد uploads:**  
في Hostinger File Manager → انقر بزر اليمين على `uploads/` → Permissions → اختر `755`.  
إذا لم يعمل الرفع جرّب `777` مؤقتاً ثم ارجع لـ `755`.

---

## §8 — middleware.php (التحقق من JWT)

```php
<?php
// api/middleware.php
function requireAuth(): void {
    global $pdo, $currentUser;

    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($authHeader, 'Bearer ')) {
        http_response_code(401);
        die(json_encode(['error' => 'Unauthorized']));
    }

    $token  = substr($authHeader, 7);
    [$payload64, $sig] = explode('.', $token) + [null, null];

    if (!$payload64 || !$sig) {
        http_response_code(401);
        die(json_encode(['error' => 'Invalid token']));
    }

    $expectedSig = hash_hmac('sha256', $payload64, JWT_SECRET);
    if (!hash_equals($expectedSig, $sig)) {
        http_response_code(401);
        die(json_encode(['error' => 'Token tampered']));
    }

    $data = json_decode(base64_decode($payload64), true);
    if (($data['exp'] ?? 0) < time()) {
        http_response_code(401);
        die(json_encode(['error' => 'Token expired']));
    }

    $currentUser = $data;
}
```

---

## §9 — العلاقات بين الجداول

```
admin_users ──┐
              └─< uploaded_files.uploaded_by

article_categories ──< agri_articles.category_id

library_nodes ──< library_nodes.parent_id   (شجرة متكررة)
library_nodes ──< library_books.node_id

gfx_categories ──< gfx_subcategories.category_id
gfx_subcategories ──< gfx_items.subcategory_id
skills.id ←── gfx_items.used_skill_ids (JSON array)

cv_docs ──< cv_sections.cv_doc_id

site_settings  (صف واحد id=1)
personal_info  (صف واحد id=1)
report_template (صف واحد id=1)
```

---

## §10 — خطوات النشر على Hostinger

| الخطوة | التفاصيل |
|--------|----------|
| 1 | افتح **phpMyAdmin** → أنشئ قاعدة بيانات جديدة (utf8mb4_unicode_ci) |
| 2 | افتح تبويب **SQL** → الصق محتوى `schema.sql` كاملاً → نفّذ |
| 3 | أنشئ أول مستخدم admin عبر طريقة §4 |
| 4 | ارفع ملفات `api/` عبر FTP أو File Manager |
| 5 | أنشئ مجلدات `uploads/projects` و `uploads/books` ... وعيّن الصلاحيات 755 |
| 6 | شغّل `npm run build` على Replit → ارفع محتوى مجلد `dist/` إلى `public_html/` |
| 7 | ارفع `.htaccess` |
| 8 | اختبر: `https://eng-alaa.com/api/projects.php` → يجب أن يُرجع `[]` |
| 9 | عند التعديل مستقبلاً: شغّل build على Replit → ارفع `dist/` فقط |

---

## §11 — ملاحظات أمنية مهمة

- **لا ترفع `config.php` على GitHub أبداً** — أضفه إلى `.gitignore`
- **احذف `create_admin.php`** فوراً بعد إنشاء الـ admin
- **JWT Secret** يجب أن يكون 64 حرفاً عشوائياً على الأقل — يمكن توليده بـ: `openssl rand -hex 32`
- كلمة مرور Admin يجب أن تكون قوية (حروف + أرقام + رموز)
- ملفات `uploads/` لا تسمح بتنفيذ PHP — أضف `.htaccess` داخلها:
  ```apache
  # uploads/.htaccess
  php_flag engine off
  ```

---

*آخر تحديث: يونيو 2026*
