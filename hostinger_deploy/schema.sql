-- ============================================================
--  eng-alaa.com — MySQL Schema  (v3 — June 2026)
--  Hostinger Shared Hosting / phpMyAdmin
--  Charset : utf8mb4 (full Unicode + emoji support)
--  Engine  : InnoDB (foreign keys + transactions)
--
--  USAGE
--  ─────
--  جديد تماماً → شغّل الملف كاملاً من أعلى إلى أسفل.
--  قاعدة موجودة → شغّل قسم  ██ MIGRATION  في الأسفل فقط.
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;


-- ------------------------------------------------------------
-- 1. ADMIN USERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id`            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `username`      VARCHAR(80)      NOT NULL UNIQUE,
  `password_hash` VARCHAR(255)     NOT NULL,
  `display_name`  VARCHAR(120)     DEFAULT NULL,
  `role`          ENUM('super','editor') NOT NULL DEFAULT 'editor',
  `last_login`    DATETIME         DEFAULT NULL,
  `created_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- أنشئ أول مستخدم admin (انظر BACKEND_DOCS.md §4)
-- INSERT INTO admin_users (username, password_hash, display_name, role)
-- VALUES ('admin', '$2y$12$REPLACE_WITH_REAL_HASH', 'Eng. Alaa', 'super');


-- ------------------------------------------------------------
-- 2. SITE SETTINGS  (صف واحد id=1)
--    يحتوي على إعدادات الموقع العامة + حقول AppData الإضافية
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `site_settings` (
  `id`                    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `logo_type`             ENUM('image','text','svg_alaa') NOT NULL DEFAULT 'svg_alaa',
  `logo_img`              TEXT             DEFAULT NULL,
  `logo_text`             JSON             NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `logo_color`            VARCHAR(30)      DEFAULT NULL,
  `footer_bg`             VARCHAR(30)      DEFAULT '#001529',
  `footer_text`           JSON             NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `theme_mode`            ENUM('dark','light') NOT NULL DEFAULT 'dark',
  `accent_color`          VARCHAR(30)      DEFAULT '#0af',
  `glass_opacity`         FLOAT            DEFAULT 0.12,
  `three_script_url`      TEXT             DEFAULT NULL,
  `social_links`          JSON             NOT NULL DEFAULT (JSON_ARRAY()),
  `nav_items`             JSON             NOT NULL DEFAULT (JSON_ARRAY()),
  -- ── حقول AppData الإضافية (v3) ──────────────────────────
  `site_name`             VARCHAR(200)     DEFAULT 'م. علاء أحمد المصري',
  `site_bio`              TEXT             DEFAULT NULL,
  `agri_cats`             JSON             NOT NULL DEFAULT (JSON_ARRAY()),
  `ai_diagnostics_enabled` TINYINT(1)      NOT NULL DEFAULT 1,
  `show_agri_cv`          TINYINT(1)       NOT NULL DEFAULT 1,
  `show_designer_cv`      TINYINT(1)       NOT NULL DEFAULT 1,
  `watermark_img`         TEXT             DEFAULT NULL,
  `watermark_opacity`     FLOAT            DEFAULT 0.15,
  `library_view`          ENUM('tree','expanded') NOT NULL DEFAULT 'tree',
  `is_seeded`             TINYINT(1)       NOT NULL DEFAULT 0,
  -- ─────────────────────────────────────────────────────────
  `updated_at`            DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `site_settings` (`id`) VALUES (1);


-- ------------------------------------------------------------
-- 3. SKILLS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `skills` (
  `id`         VARCHAR(36)       NOT NULL,
  `name`       VARCHAR(120)      NOT NULL,
  `percent`    TINYINT UNSIGNED  NOT NULL DEFAULT 50,
  `icon`       VARCHAR(120)      DEFAULT NULL,
  `size`       SMALLINT UNSIGNED DEFAULT 40,
  `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 4. WEB PROJECTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `web_projects` (
  `id`             VARCHAR(36)  NOT NULL,
  `title`          JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `description`    JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `main_img`       TEXT         DEFAULT NULL,
  `images`         JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  `video_url`      TEXT         DEFAULT NULL,
  `live_url`       TEXT         DEFAULT NULL,
  `github_url`     TEXT         DEFAULT NULL,
  `github_visible` TINYINT(1)   NOT NULL DEFAULT 1,
  `tags`           JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  `thumb_size`     SMALLINT UNSIGNED DEFAULT 220,
  `position_index` SMALLINT UNSIGNED DEFAULT 0,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 5. CODE SNIPPETS (Software Lab)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `code_snippets` (
  `id`             VARCHAR(36)  NOT NULL,
  `title`          VARCHAR(200) NOT NULL DEFAULT '',
  `description`    TEXT         DEFAULT NULL,
  `code_html`      LONGTEXT     DEFAULT NULL,
  `code_css`       LONGTEXT     DEFAULT NULL,
  `code_js`        LONGTEXT     DEFAULT NULL,
  `category`       VARCHAR(80)  DEFAULT NULL,
  `position_index` SMALLINT UNSIGNED DEFAULT 0,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 6. ARTICLE CATEGORIES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `article_categories` (
  `id`         VARCHAR(36) NOT NULL,
  `name`       JSON        NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `sort_order` SMALLINT UNSIGNED DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 7. AGRI ARTICLES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `agri_articles` (
  `id`             VARCHAR(36)  NOT NULL,
  `category_id`    VARCHAR(36)  DEFAULT NULL,
  `title`          JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `content`        JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `images`         JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  `reference`      JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `article_date`   DATE         DEFAULT NULL,
  `position_index` SMALLINT UNSIGNED DEFAULT 0,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_article_category`
    FOREIGN KEY (`category_id`) REFERENCES `article_categories`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 8. LIBRARY NODES  (شجرة مجلدات بعمق لانهائي)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `library_nodes` (
  `id`         VARCHAR(36)  NOT NULL,
  `parent_id`  VARCHAR(36)  DEFAULT NULL,
  `name`       JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `sort_order` SMALLINT UNSIGNED DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_node_parent`
    FOREIGN KEY (`parent_id`) REFERENCES `library_nodes`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 9. LIBRARY BOOKS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `library_books` (
  `id`             VARCHAR(36)  NOT NULL,
  `node_id`        VARCHAR(36)  DEFAULT NULL,
  `title`          JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `author`         JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `thumbnail`      TEXT         DEFAULT NULL,
  `drive_url`      TEXT         DEFAULT NULL,
  `preview_url`    TEXT         DEFAULT NULL,
  `is_paid`        TINYINT(1)   NOT NULL DEFAULT 0,
  `pages`          VARCHAR(20)  DEFAULT NULL,
  `kind`           ENUM('theory','practical','both') NOT NULL DEFAULT 'theory',
  `languages`      JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  `position_index` SMALLINT UNSIGNED DEFAULT 0,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_book_node`
    FOREIGN KEY (`node_id`) REFERENCES `library_nodes`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 10. AGRI VIDEOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `agri_videos` (
  `id`             VARCHAR(36) NOT NULL,
  `title`          JSON        NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `url`            TEXT        NOT NULL,
  `visible`        TINYINT(1)  NOT NULL DEFAULT 1,
  `position_index` SMALLINT UNSIGNED DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 11. PUBLIC REPORTS  (ملفات PDF للزوار)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `public_reports` (
  `id`             VARCHAR(36) NOT NULL,
  `title`          JSON        NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `thumbnail`      TEXT        DEFAULT NULL,
  `url`            TEXT        NOT NULL,
  `visible`        TINYINT(1)  NOT NULL DEFAULT 1,
  `position_index` SMALLINT UNSIGNED DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 12. GRAPHICS: CATEGORIES + SUB-CATEGORIES + ITEMS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `gfx_categories` (
  `id`         VARCHAR(36) NOT NULL,
  `name`       JSON        NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `icon`       VARCHAR(80) DEFAULT NULL,
  `sort_order` SMALLINT UNSIGNED DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gfx_subcategories` (
  `id`          VARCHAR(36) NOT NULL,
  `category_id` VARCHAR(36) NOT NULL,
  `name`        JSON        NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `sort_order`  SMALLINT UNSIGNED DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_sub_category`
    FOREIGN KEY (`category_id`) REFERENCES `gfx_categories`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `gfx_items` (
  `id`             VARCHAR(36) NOT NULL,
  `subcategory_id` VARCHAR(36) NOT NULL,
  `title`          JSON        NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `description`    JSON        NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  -- ملاحظة: الـ TypeScript يستخدم `desc` لكن الـ DB يحتفظ بـ `description` — الـ API يُرجعها كـ `desc`
  `main_img`       TEXT        DEFAULT NULL,
  `images`         JSON        NOT NULL DEFAULT (JSON_ARRAY()),
  `video_url`      TEXT        DEFAULT NULL,
  `used_skill_ids` JSON        NOT NULL DEFAULT (JSON_ARRAY()),
  `cv_is_featured` TINYINT(1)  NOT NULL DEFAULT 0,
  `cv_img_size`    TINYINT UNSIGNED DEFAULT 100,
  `cv_show_desc`   TINYINT(1)  NOT NULL DEFAULT 1,
  `cv_show_tools`  TINYINT(1)  NOT NULL DEFAULT 1,
  `position_index` SMALLINT UNSIGNED DEFAULT 0,
  `created_at`     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_item_sub`
    FOREIGN KEY (`subcategory_id`) REFERENCES `gfx_subcategories`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 13. CV DOCUMENTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cv_docs` (
  `id`              VARCHAR(36)  NOT NULL,
  `name`            VARCHAR(120) NOT NULL DEFAULT 'CV',
  `removable`       TINYINT(1)   NOT NULL DEFAULT 1,
  `accent`          VARCHAR(30)  DEFAULT '#0af',
  `icon`            VARCHAR(80)  DEFAULT NULL,
  `photo`           TEXT         DEFAULT NULL,
  `full_name`       JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `subtitle`        JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `since`           SMALLINT UNSIGNED DEFAULT 2015,
  `show_in_about`   TINYINT(1)   NOT NULL DEFAULT 0,
  `global_color`    VARCHAR(30)  DEFAULT NULL,
  `footer_bg_color` VARCHAR(30)  DEFAULT NULL,
  `footer_text`     JSON         DEFAULT NULL,
  `sidebar_docs`    JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  `qr_credentials`  JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  `sort_order`      SMALLINT UNSIGNED DEFAULT 0,
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 14. CV SECTIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cv_sections` (
  `id`                VARCHAR(36)  NOT NULL,
  `cv_doc_id`         VARCHAR(36)  NOT NULL,
  `kind`              ENUM('header','contact','entries','tags','skillbars','portfolio','text')
                                   NOT NULL DEFAULT 'text',
  `title`             JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `column_pos`        ENUM('left','right','full') NOT NULL DEFAULT 'full',
  `visible`           TINYINT(1)   NOT NULL DEFAULT 1,
  `entries`           JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  `tags`              JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  `contact_items`     JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  `portfolio`         JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  `text_content`      JSON         DEFAULT NULL,
  `use_global_skills` TINYINT(1)   NOT NULL DEFAULT 0,
  `gallery_layout`    TINYINT UNSIGNED DEFAULT 1,
  `img_height`        SMALLINT UNSIGNED DEFAULT 120,
  `page_break_before` TINYINT(1)   NOT NULL DEFAULT 0,
  `sort_order`        SMALLINT UNSIGNED DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_section_doc`
    FOREIGN KEY (`cv_doc_id`) REFERENCES `cv_docs`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 15. SOIL ANALYSIS  (قالب التحاليل + أسعارها)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `soil_analysis` (
  `id`         VARCHAR(36)      NOT NULL,
  `name`       JSON             NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `ideal`      VARCHAR(80)      DEFAULT NULL,
  `actual`     VARCHAR(80)      DEFAULT NULL,
  `price`      DECIMAL(10,2)    NOT NULL DEFAULT 0.00,
  `tax`        DECIMAL(5,2)     NOT NULL DEFAULT 5.00,
  `sort_order` SMALLINT UNSIGNED DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 16. CUSTOMER REPORTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customer_reports` (
  `id`                VARCHAR(36)  NOT NULL,
  `report_type`       ENUM('soil','disease','insect') NOT NULL DEFAULT 'soil',
  `customer_name`     VARCHAR(150) NOT NULL DEFAULT '',
  `customer_phone`    VARCHAR(30)  DEFAULT NULL,
  `customer_location` VARCHAR(200) DEFAULT NULL,
  `attendance_date`   DATE         DEFAULT NULL,
  `exam_date`         DATE         DEFAULT NULL,
  `images`            JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  `plant_name`        JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `description`       JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `soil_rows`         JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  `final_report`      JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 17. REPORT TEMPLATE  (صف واحد id=1)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `report_template` (
  `id`            TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `theme_color`   VARCHAR(30)  DEFAULT '#003366',
  `header_logo`   TEXT         DEFAULT NULL,
  `header_text`   JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `footer_text`   JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `eng_name`      JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `eng_title`     JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `eng_signature` TEXT         DEFAULT NULL,
  `eng_stamp`     TEXT         DEFAULT NULL,
  `paid_stamp`    TEXT         DEFAULT NULL,
  `currency`      VARCHAR(20)  DEFAULT '',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                               ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `report_template` (`id`) VALUES (1);


-- ------------------------------------------------------------
-- 18. PERSONAL INFO  (صف واحد id=1)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `personal_info` (
  `id`             TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `photo`          TEXT         DEFAULT NULL,
  `phone`          VARCHAR(30)  DEFAULT NULL,
  `email`          VARCHAR(120) DEFAULT NULL,
  `location`       VARCHAR(200) DEFAULT NULL,
  `website`        VARCHAR(200) DEFAULT NULL,
  `linkedin`       VARCHAR(200) DEFAULT NULL,
  `github`         VARCHAR(200) DEFAULT NULL,
  `twitter`        VARCHAR(200) DEFAULT NULL,
  `custom_socials` JSON         NOT NULL DEFAULT (JSON_ARRAY()),
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `personal_info` (`id`) VALUES (1);


-- ------------------------------------------------------------
-- 19. UPLOADED FILES  (سجل كل ملف مرفوع)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `uploaded_files` (
  `id`          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `filename`    VARCHAR(255)     NOT NULL,
  `original`    VARCHAR(255)     DEFAULT NULL,
  `folder`      VARCHAR(80)      NOT NULL DEFAULT 'general',
  `mime_type`   VARCHAR(80)      DEFAULT NULL,
  `size_bytes`  INT UNSIGNED     DEFAULT NULL,
  `uploaded_by` INT UNSIGNED     DEFAULT NULL,
  `uploaded_at` DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_file_user`
    FOREIGN KEY (`uploaded_by`) REFERENCES `admin_users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 20. AI VAULT  (جديد v3)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ai_vault` (
  `id`              VARCHAR(36)  NOT NULL,
  `title`           JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `prompt`          LONGTEXT     DEFAULT NULL,
  `img`             TEXT         DEFAULT NULL,
  `category_id`     VARCHAR(36)  DEFAULT NULL,
  `sub_category_id` VARCHAR(36)  DEFAULT NULL,
  `sort_order`      SMALLINT UNSIGNED DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------------
-- 21. INJECTED PAGES  (صفحات HTML مخصصة — جديد v3)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `injected_pages` (
  `id`         VARCHAR(36)  NOT NULL,
  `title`      VARCHAR(200) DEFAULT NULL,
  `html`       LONGTEXT     DEFAULT NULL,
  `css`        LONGTEXT     DEFAULT NULL,
  `sort_order` SMALLINT UNSIGNED DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
--  ██  MIGRATION — قاعدة بيانات موجودة (v2 → v3)  ██
--
--  شغّل هذا القسم فقط إذا كانت لديك قاعدة بيانات من v2.
--  جميع الأوامر تستخدم IF NOT EXISTS / IGNORE — آمنة للتشغيل المتكرر.
-- ============================================================

-- ── site_settings: إضافة الأعمدة الجديدة ──────────────────
ALTER TABLE `site_settings`
  ADD COLUMN IF NOT EXISTS `site_name`              VARCHAR(200)  DEFAULT 'م. علاء أحمد المصري'  AFTER `nav_items`,
  ADD COLUMN IF NOT EXISTS `site_bio`               TEXT          DEFAULT NULL                    AFTER `site_name`,
  ADD COLUMN IF NOT EXISTS `agri_cats`              JSON          NOT NULL DEFAULT (JSON_ARRAY()) AFTER `site_bio`,
  ADD COLUMN IF NOT EXISTS `ai_diagnostics_enabled` TINYINT(1)   NOT NULL DEFAULT 1              AFTER `agri_cats`,
  ADD COLUMN IF NOT EXISTS `show_agri_cv`           TINYINT(1)   NOT NULL DEFAULT 1              AFTER `ai_diagnostics_enabled`,
  ADD COLUMN IF NOT EXISTS `show_designer_cv`       TINYINT(1)   NOT NULL DEFAULT 1              AFTER `show_agri_cv`,
  ADD COLUMN IF NOT EXISTS `watermark_img`          TEXT          DEFAULT NULL                    AFTER `show_designer_cv`,
  ADD COLUMN IF NOT EXISTS `watermark_opacity`      FLOAT         DEFAULT 0.15                   AFTER `watermark_img`,
  ADD COLUMN IF NOT EXISTS `library_view`           ENUM('tree','expanded') NOT NULL DEFAULT 'tree' AFTER `watermark_opacity`,
  ADD COLUMN IF NOT EXISTS `is_seeded`              TINYINT(1)   NOT NULL DEFAULT 0               AFTER `library_view`;

-- ── skills: تأكيد sort_order ────────────────────────────────
ALTER TABLE `skills`
  MODIFY COLUMN `sort_order` SMALLINT UNSIGNED NOT NULL DEFAULT 0;

-- ── skills: إضافة size إن لم تكن موجودة ────────────────────
ALTER TABLE `skills`
  ADD COLUMN IF NOT EXISTS `size` SMALLINT UNSIGNED DEFAULT 40 AFTER `icon`;

-- ── article_categories: إضافة sort_order إن لم تكن موجودة ──
ALTER TABLE `article_categories`
  ADD COLUMN IF NOT EXISTS `sort_order` SMALLINT UNSIGNED DEFAULT 0;

-- ── library_books: إضافة preview_url و is_paid ──────────────
ALTER TABLE `library_books`
  ADD COLUMN IF NOT EXISTS `preview_url` TEXT      DEFAULT NULL AFTER `drive_url`,
  ADD COLUMN IF NOT EXISTS `is_paid`     TINYINT(1) NOT NULL DEFAULT 0 AFTER `preview_url`;

-- ── report_template: إضافة eng_name و eng_title و currency ──
ALTER TABLE `report_template`
  ADD COLUMN IF NOT EXISTS `eng_name`  JSON NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')) AFTER `footer_text`,
  ADD COLUMN IF NOT EXISTS `eng_title` JSON NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')) AFTER `eng_name`,
  ADD COLUMN IF NOT EXISTS `currency`  VARCHAR(20) DEFAULT ''                                       AFTER `paid_stamp`;

-- ── soil_analysis: إنشاء الجدول إن لم يكن موجوداً ──────────
CREATE TABLE IF NOT EXISTS `soil_analysis` (
  `id`         VARCHAR(36)      NOT NULL,
  `name`       JSON             NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `ideal`      VARCHAR(80)      DEFAULT NULL,
  `actual`     VARCHAR(80)      DEFAULT NULL,
  `price`      DECIMAL(10,2)    NOT NULL DEFAULT 0.00,
  `tax`        DECIMAL(5,2)     NOT NULL DEFAULT 5.00,
  `sort_order` SMALLINT UNSIGNED DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── ai_vault: إنشاء الجدول الجديد ───────────────────────────
CREATE TABLE IF NOT EXISTS `ai_vault` (
  `id`              VARCHAR(36)  NOT NULL,
  `title`           JSON         NOT NULL DEFAULT (JSON_OBJECT('ar','','en','','de','')),
  `prompt`          LONGTEXT     DEFAULT NULL,
  `img`             TEXT         DEFAULT NULL,
  `category_id`     VARCHAR(36)  DEFAULT NULL,
  `sub_category_id` VARCHAR(36)  DEFAULT NULL,
  `sort_order`      SMALLINT UNSIGNED DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── injected_pages: إنشاء الجدول الجديد ─────────────────────
CREATE TABLE IF NOT EXISTS `injected_pages` (
  `id`         VARCHAR(36)  NOT NULL,
  `title`      VARCHAR(200) DEFAULT NULL,
  `html`       LONGTEXT     DEFAULT NULL,
  `css`        LONGTEXT     DEFAULT NULL,
  `sort_order` SMALLINT UNSIGNED DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
--  خريطة العلاقات (للمرجع)
-- ============================================================
--
--  admin_users          ──< uploaded_files.uploaded_by
--
--  article_categories   ──< agri_articles.category_id
--
--  library_nodes        ──< library_nodes.parent_id  (شجرة متكررة)
--  library_nodes        ──< library_books.node_id
--
--  gfx_categories       ──< gfx_subcategories.category_id
--  gfx_subcategories    ──< gfx_items.subcategory_id
--  skills.id            ←── gfx_items.used_skill_ids  (JSON array)
--
--  cv_docs              ──< cv_sections.cv_doc_id
--
--  site_settings        (صف واحد id=1) — يشمل حقول AppData الإضافية
--  personal_info        (صف واحد id=1)
--  report_template      (صف واحد id=1) — يشمل currency
--
--  soil_analysis        ← مستقل (قالب التحاليل)
--  customer_reports     ← مستقل (تقارير العملاء)
--  ai_vault             ← مستقل (جديد v3)
--  injected_pages       ← مستقل (جديد v3)
--
-- ============================================================
--  END OF SCHEMA  v3 — June 2026
-- ============================================================
