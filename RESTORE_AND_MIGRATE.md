# استعادة الموقع أو نقله إلى دومين آخر

هذه النسخة تحتوي على:

- كود React/TypeScript كاملاً داخل `src/`.
- ملفات PHP داخل `hostinger_deploy/`.
- مخطط قاعدة MySQL داخل `hostinger_deploy/schema.sql`.
- نسخة حديثة من محتوى الموقع العام داخل `public/data.json`.
- قوالب إعداد آمنة:
  - `hostinger_deploy/config.sample.php`
  - `hostinger_deploy/api/config.example.php`

## ما لا يوجد في GitHub لأسباب أمنية

- كلمات مرور MySQL وHostinger.
- مفتاح Gemini أو أي API key حقيقي.
- `JWT_SECRET`.
- ملفات `config.php` الحقيقية.
- مفاتيح SFTP.
- أرقام هواتف العملاء في نسخة `public/data.json`.
- جلسات الإدارة وتحليلات الزوار.

## استعادة نسخة تعمل من `data.json`

1. نزّل المستودع.
2. شغّل `npm install`.
3. شغّل `npm run build:hostinger`.
4. ارفع محتويات `hostinger_upload/` إلى `public_html/`.
5. سيقرأ الموقع محتوى `public/data.json` حتى قبل تجهيز MySQL.

## نقل قاعدة البيانات إلى دومين جديد

1. أنشئ قاعدة MySQL جديدة.
2. نفّذ `hostinger_deploy/schema.sql` عبر phpMyAdmin.
3. انسخ `hostinger_deploy/api/config.example.php` إلى `hostinger_deploy/api/config.php`.
4. ضع بيانات MySQL الجديدة وولّد `JWT_SECRET` عشوائياً بطول 64 حرفاً على الأقل.
5. أنشئ مستخدم الإدارة كما هو موضح في `hostinger_deploy/BACKEND_DOCS.md`.
6. ارفع المشروع إلى الدومين الجديد.
7. سجّل الدخول من لوحة الإدارة؛ عند أول حفظ ستُنقل بيانات `public/data.json` إلى MySQL.

## النسخة الخاصة الكاملة

للاحتفاظ بأرقام العملاء وحساب الإدارة وكامل سجلات MySQL:

1. افتح phpMyAdmin في Hostinger.
2. اختر قاعدة الموقع ثم **Export**.
3. اختر SQL وفعّل تضمين البنية والبيانات.
4. احفظ الملف في مكان خاص أو مشفّر.
5. لا ترفع ملف SQL الذي يحتوي بيانات حقيقية إلى هذا المستودع العام.

