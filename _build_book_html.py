# -*- coding: utf-8 -*-
"""Convert PROJECT_LEARNING_BOOK.md → PROJECT_LEARNING_BOOK.html (temporary script)."""
import html as htmlmod
import pathlib
import re

import markdown

ROOT = pathlib.Path(__file__).parent
MD_PATH = ROOT / "PROJECT_LEARNING_BOOK.md"
OUT_PATH = ROOT / "PROJECT_LEARNING_BOOK.html"

md_text = MD_PATH.read_text(encoding="utf-8")

body = markdown.markdown(
    md_text,
    extensions=["tables", "fenced_code", "nl2br", "sane_lists"],
    output_format="html5",
)

chapters: list[tuple[str, str]] = []


def slugify(text: str) -> str:
    s = re.sub(r"[^\w\u0600-\u06FF]+", "-", text.strip())
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "section"


def chapter_repl(m: re.Match) -> str:
    inner = m.group(1)
    plain = re.sub(r"<[^>]+>", "", inner)
    slug = slugify(plain)
    n = len(chapters) + 1
    slug = f"chapter-{n:02d}-{slug}"[:100]
    chapters.append((plain, slug))
    return f'<h2 id="{slug}" class="chapter">{inner}</h2>'


body = re.sub(r"<h2>(الفصل[^<]*)</h2>", chapter_repl, body)

body = body.replace("<h1>", '<h1 class="md-h1">')
body = re.sub(
    r'<h2(?!\s+id=)(?!\s+class="chapter")',
    '<h2 class="section"',
    body,
)
body = body.replace("<h3>", '<h3 class="subsection">')
body = body.replace("<h4>", '<h4 class="subsubsection">')
body = body.replace("<pre>", '<pre class="code-block">')
body = body.replace("<blockquote>", '<blockquote class="note">')

toc_items = "\n".join(
    f'    <li><a href="#{slug}">{htmlmod.escape(title)}</a></li>'
    for title, slug in chapters
)

cover = """
<section class="cover" dir="rtl">
  <div class="cover-inner">
    <p class="cover-label">Portfolio Hub — eng-alaa.com</p>
    <h1 class="cover-title">كتاب تعليمي شامل</h1>
    <p class="cover-subtitle">مشروع eng-alaa.com</p>
    <p class="cover-desc">دليل المبتدئ لفهم وتعديل الموقع بأمان</p>
    <p class="cover-meta">React · Vite · TypeScript · PHP · MySQL · Hostinger</p>
    <p class="cover-edition">٢٠ فصلًا + ملاحق · يونيو ٢٠٢٦</p>
  </div>
</section>
"""

nav_toc = f"""
<nav class="book-toc" dir="rtl" aria-label="فهرس الفصول">
  <h2 class="toc-heading">فهرس سريع — الفصول ١–٢٠</h2>
  <ol class="toc-list">
{toc_items}
  </ol>
</nav>
"""

CSS = """
:root {
  --bg: #faf9f7;
  --paper: #fffef9;
  --text: #1a1a1e;
  --muted: #5c5c66;
  --accent: #1e4d6b;
  --accent-soft: #e8f0f5;
  --border: #ddd8ce;
  --code-bg: #f4f1ea;
  --code-border: #d9d2c4;
  --font: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
  --mono: 'Consolas', 'Courier New', monospace;
  --max-w: 820px;
  --page-margin: 2.2cm;
}

* { box-sizing: border-box; }

html {
  scroll-behavior: smooth;
  font-size: 17px;
}

body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  line-height: 1.85;
  direction: rtl;
  text-align: right;
}

.cover {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #1e4d6b 0%, #2d6a8f 45%, #1a3a4a 100%);
  color: #fff;
  page-break-after: always;
  break-after: page;
  padding: 2rem;
}

.cover-inner { text-align: center; max-width: 640px; }

.cover-label {
  font-size: 0.95rem;
  letter-spacing: 0.05em;
  opacity: 0.85;
  margin-bottom: 1.5rem;
}

.cover-title {
  font-size: 2.6rem;
  font-weight: 800;
  margin: 0 0 0.75rem;
  line-height: 1.35;
}

.cover-subtitle { font-size: 1.35rem; margin: 0 0 1rem; opacity: 0.95; }

.cover-desc { font-size: 1.05rem; margin: 0 0 2rem; opacity: 0.9; }

.cover-meta, .cover-edition { font-size: 0.9rem; opacity: 0.8; margin: 0.4rem 0; }

.book-toc {
  max-width: var(--max-w);
  margin: 0 auto;
  padding: 2.5rem 1.5rem 3rem;
  background: var(--paper);
  border-bottom: 3px solid var(--accent);
  page-break-after: always;
  break-after: page;
}

.toc-heading {
  color: var(--accent);
  font-size: 1.5rem;
  margin: 0 0 1.25rem;
  border-bottom: 2px solid var(--accent-soft);
  padding-bottom: 0.5rem;
}

.toc-list {
  columns: 1;
  padding-right: 1.25rem;
  margin: 0;
  line-height: 2;
}

.toc-list a { color: var(--accent); text-decoration: none; font-weight: 500; }
.toc-list a:hover { text-decoration: underline; }

.book-content {
  max-width: var(--max-w);
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  background: var(--paper);
  box-shadow: 0 0 40px rgba(0,0,0,0.06);
}

h1.md-h1 {
  font-size: 1.85rem;
  color: var(--accent);
  margin: 2rem 0 1rem;
  padding-bottom: 0.35rem;
  border-bottom: 2px solid var(--accent-soft);
}

h2.section {
  font-size: 1.45rem;
  color: #2a2a32;
  margin: 2rem 0 0.85rem;
  padding-right: 0.75rem;
  border-right: 4px solid var(--accent);
}

h2.chapter {
  font-size: 1.65rem;
  color: var(--accent);
  margin: 0;
  padding: 2.5rem 0 1rem;
  border-top: 4px solid var(--accent);
  page-break-before: always;
  break-before: page;
}

h3.subsection { font-size: 1.2rem; color: #333; margin: 1.75rem 0 0.65rem; }
h4.subsubsection { font-size: 1.05rem; color: #444; margin: 1.25rem 0 0.5rem; }

p { margin: 0.65rem 0 1rem; }
a { color: var(--accent); }
ul, ol { margin: 0.5rem 0 1rem; padding-right: 1.5rem; }
li { margin: 0.35rem 0; }

hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 2rem 0;
}

blockquote.note {
  margin: 1.25rem 0;
  padding: 1rem 1.25rem;
  background: var(--accent-soft);
  border-right: 4px solid var(--accent);
  border-radius: 0 8px 8px 0;
  color: #2a3a44;
}

blockquote.note p { margin: 0.35rem 0; }

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.25rem 0 1.75rem;
  font-size: 0.92rem;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  border-radius: 8px;
  overflow: hidden;
}

thead { background: var(--accent); color: #fff; }

th, td {
  border: 1px solid var(--border);
  padding: 0.55rem 0.75rem;
  text-align: right;
  vertical-align: top;
}

tbody tr:nth-child(even) { background: #f9f8f5; }

code {
  font-family: var(--mono);
  font-size: 0.88em;
  background: var(--code-bg);
  border: 1px solid var(--code-border);
  padding: 0.12em 0.35em;
  border-radius: 4px;
  direction: ltr;
  unicode-bidi: embed;
}

pre.code-block {
  font-family: var(--mono);
  font-size: 0.82rem;
  line-height: 1.55;
  background: #2b2b2b;
  color: #f0f0f0;
  border-radius: 8px;
  padding: 1rem 1.15rem;
  overflow-x: auto;
  margin: 1rem 0 1.5rem;
  direction: ltr;
  text-align: left;
  border: 1px solid #444;
  white-space: pre-wrap;
  word-break: break-word;
}

pre.code-block code {
  background: none;
  border: none;
  padding: 0;
  color: inherit;
  font-size: inherit;
}

@page { size: A4; margin: var(--page-margin); }

@media print {
  html { font-size: 11pt; }
  body { background: #fff; color: #000; }
  .cover {
    min-height: 100vh;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .book-content { box-shadow: none; max-width: 100%; padding: 0; }
  h2.chapter { page-break-before: always; break-before: page; }
  pre.code-block, table, blockquote.note {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  a { color: #000; text-decoration: none; }
}

@media screen and (min-width: 900px) {
  .toc-list { columns: 2; column-gap: 2rem; }
  .book-content { padding: 2.5rem 2.5rem 5rem; }
}
"""

html_doc = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>كتاب تعليمي — مشروع eng-alaa.com</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet" />
  <style>
{CSS}
  </style>
</head>
<body>
{cover}
{nav_toc}
<main class="book-content" dir="rtl">
{body}
</main>
</body>
</html>
"""

OUT_PATH.write_text(html_doc, encoding="utf-8")
print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size:,} bytes, {len(chapters)} chapters)")
