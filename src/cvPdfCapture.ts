/**
 * تصدير السيرة الذاتية — لقطة WYSIWYG من المعاينة (794×1123)
 * يستخدم نسخة clone للتقاط — لا يحرّك DOM الأصلي (آمن على الجوال + React)
 */
import { CV_EXPORT_PX, CV_EXPORT_SCALE, CV_PAGE_H_PX } from './cvConstants';
import { exportLibsReady, getHtml2Canvas, getJsPDFCtor } from './pdfCaptureLibs';
import {
  flattenCvSheetShift,
  applyQrLayoutForCapture,
  hideFlowBlocksOutsideWindow,
  lockSheetClipForCapture,
  mountExportCaptureShell,
  prepareSheetForCapture,
  reflowCvSheetFooterForCapture,
  unlockPageOverflowForCapture,
} from './cvExportCapture';
import { refreshCvQrBitmaps } from './cvQrRaster';

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;

type SkillLayoutVars = {
  headerBarGap: string;   /* gap between name-line and bar-track (flex-column gap) */
  rowGap: string;         /* margin-bottom between skill rows */
  nameLineHeight: string; /* min-height of name line */
  iconSize: string;       /* --cv-skill-icon-size */
  iconNameGap: string;    /* gap between name text and icon inside chip */
};

export type CvPdfLink = {
  url: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type PageCapture = {
  dataUrl: string;
  links: CvPdfLink[];
};

function isMobileCapture(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches);
}

function captureScalesToTry(): number[] {
  const max = Math.max(2, CV_EXPORT_SCALE);
  if (isMobileCapture()) return max >= 3 ? [3, 2, 1] : [2, 1];
  return max >= 3 ? [3, 2, 1] : [2, 1];
}

function readSkillLayoutVars(sheet: HTMLElement): SkillLayoutVars {
  const frame = sheet.querySelector('.cv-page-frame') as HTMLElement | null;
  const scope = frame ?? sheet;
  const cs = getComputedStyle(scope);
  return {
    headerBarGap: cs.getPropertyValue('--cv-skill-header-bar-gap').trim() || '10px',
    rowGap: cs.getPropertyValue('--cv-skill-row-gap').trim() || '10px',
    nameLineHeight: cs.getPropertyValue('--cv-skill-name-line-height').trim() || '16px',
    iconSize: cs.getPropertyValue('--cv-skill-icon-size').trim() || '14px',
    iconNameGap: cs.getPropertyValue('--cv-skill-icon-name-gap').trim() || '6px',
  };
}

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = [...root.querySelectorAll('img')];
  await Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    img.loading = 'eager';
    return new Promise<void>(resolve => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
      setTimeout(resolve, 5000);
    });
  }));
}

function lockSheetSize(sheet: HTMLElement, widthPx: number, heightPx: number): void {
  sheet.style.setProperty('width', `${widthPx}px`, 'important');
  sheet.style.setProperty('min-width', `${widthPx}px`, 'important');
  sheet.style.setProperty('max-width', `${widthPx}px`, 'important');
  sheet.style.setProperty('height', `${heightPx}px`, 'important');
  sheet.style.setProperty('min-height', `${heightPx}px`, 'important');
  sheet.style.setProperty('max-height', `${heightPx}px`, 'important');
  sheet.style.setProperty('overflow', 'hidden', 'important');
  sheet.style.setProperty('box-sizing', 'border-box', 'important');
}

/**
 * إصلاح تخطيط المهارات لـ html2canvas:
 *
 * html2canvas 1.4.1 يتجاهل `gap` على flex وgrid.
 * الحل: نُبقي flex-column على .cv-skill-bar-row (لا نغيّر display)
 * ونستبدل gap بـ margin-bottom صريحة على العناصر الأبناء.
 * كذلك نستبدل gap داخل .cv-skill-bar-name-chip بـ margin على النص.
 */
function applySkillLayoutForCapture(root: ParentNode, vars: SkillLayoutVars): void {
  /* ─── Row: احتفظ بـ flex-column، فقط اقتل gap واستبدله بـ margin على السطر ─── */
  root.querySelectorAll<HTMLElement>('.cv-skill-bar-row').forEach(row => {
    row.style.setProperty('display', 'flex', 'important');
    row.style.setProperty('flex-direction', 'column', 'important');
    row.style.setProperty('gap', '0', 'important');           /* html2canvas يتجاهل gap */
    row.style.setProperty('margin-bottom', vars.rowGap, 'important');
  });

  /* ─── السطر (اسم + نسبة): flex-row، استبدل gap الصف بـ margin-bottom على هذا السطر ─── */
  root.querySelectorAll<HTMLElement>('.cv-skill-bar-line, .cv-skill-bar-header').forEach(line => {
    line.style.setProperty('display', 'flex', 'important');
    line.style.setProperty('flex-direction', 'row', 'important');
    line.style.setProperty('align-items', 'center', 'important');
    line.style.setProperty('justify-content', 'space-between', 'important');
    line.style.setProperty('width', '100%', 'important');
    line.style.setProperty('min-height', vars.nameLineHeight, 'important');
    line.style.setProperty('gap', '0', 'important');
    /*
     * هذا هو المسافة بين سطر الاسم وشريط المهارة.
     * في CSS العادي كانت gap على .cv-skill-bar-row = --cv-skill-header-bar-gap.
     * نضعها هنا كـ margin-bottom على السطر.
     */
    line.style.setProperty('margin-bottom', vars.headerBarGap, 'important');
    line.style.setProperty('padding-bottom', '0', 'important');
  });

  /* ─── Chip (اسم + أيقونة): inline-flex + vertical-align:middle للـ chip نفسه ─── */
  root.querySelectorAll<HTMLElement>('.cv-skill-bar-name-chip, .cv-skill-bar-name').forEach(chip => {
    chip.style.setProperty('display', 'inline-flex', 'important');
    chip.style.setProperty('flex-direction', 'row', 'important');
    chip.style.setProperty('align-items', 'center', 'important');
    chip.style.setProperty('direction', 'ltr', 'important');
    chip.style.setProperty('gap', '0', 'important');
    /*
     * html2canvas أحياناً يعالج inline-flex كـ inline عادي.
     * vertical-align:middle يضمن أن الـ chip نفسه يتمحور مع سطر الـ pct.
     */
    chip.style.setProperty('vertical-align', 'middle', 'important');
  });

  /*
   * بديل gap داخل chip: margin-inline-end على النص.
   *
   * السبب الجذري لنزول الاسم: الأيقونة لها vertical-align:middle أما النص
   * له vertical-align:baseline (الافتراضي). baseline أسفل من middle خطّ x،
   * فيظهر النص أنزل من الأيقونة. الحل: نضع vertical-align:middle على النص
   * و display:inline-block (شرط تفعيل vertical-align على عنصر span).
   */
  root.querySelectorAll<HTMLElement>('.cv-skill-bar-name-text').forEach(txt => {
    txt.style.setProperty('display', 'inline-block', 'important');
    txt.style.setProperty('vertical-align', 'middle', 'important');
    txt.style.setProperty('margin-inline-end', vars.iconNameGap, 'important');
  });

  /* ─── الشريط: block صريح لضمان القصّ الكامل ─── */
  root.querySelectorAll<HTMLElement>('.cv-skill-bar-track').forEach(track => {
    track.style.setProperty('display', 'block', 'important');
    track.style.setProperty('width', '100%', 'important');
    track.style.setProperty('margin-top', '0', 'important');
    track.style.setProperty('clear', 'both', 'important');
  });

  /* ─── الأيقونات: ثبّت الحجم + vertical-align متوافق مع النص ─── */
  const iconPx = vars.iconSize || '14px';
  root.querySelectorAll<HTMLElement>('.cv-skill-icon').forEach(icon => {
    icon.style.setProperty('width', iconPx, 'important');
    icon.style.setProperty('height', iconPx, 'important');
    icon.style.setProperty('max-width', 'none', 'important');
    icon.style.setProperty('max-height', 'none', 'important');
    icon.style.setProperty('min-width', iconPx, 'important');
    icon.style.setProperty('min-height', iconPx, 'important');
    icon.style.setProperty('flex-shrink', '0', 'important');
    icon.style.setProperty('display', 'inline-block', 'important');
    icon.style.setProperty('vertical-align', 'middle', 'important');
    icon.style.setProperty('object-fit', 'contain', 'important');
  });
}

/**
 * حاوية التقاط مخفية تماماً — position:fixed left:-12000px
 * left:0 كان يسبّب مشاكل على الجوال (إعادة تدفق + قصّ 794px).
 */
function buildCaptureViewport(widthPx: number, heightPx: number): HTMLDivElement {
  const viewport = mountExportCaptureShell(widthPx, heightPx);
  viewport.style.setProperty('position', 'fixed', 'important');
  viewport.style.setProperty('left', '-12000px', 'important');
  viewport.style.setProperty('top', '0', 'important');
  viewport.style.setProperty('opacity', '1', 'important');
  viewport.style.setProperty('visibility', 'visible', 'important');
  viewport.style.setProperty('overflow', 'hidden', 'important');
  viewport.style.setProperty('z-index', '-1', 'important');
  viewport.style.setProperty('pointer-events', 'none', 'important');
  return viewport;
}

function html2canvasOptions(
  scale: number,
  widthPx: number,
  heightPx: number,
  skillVars: SkillLayoutVars,
): Record<string, unknown> {
  return {
    scale,
    width: widthPx,
    height: heightPx,
    backgroundColor: '#ffffff',
    useCORS: true,
    allowTaint: true,
    scrollX: 0,
    scrollY: 0,
    logging: false,
    foreignObjectRendering: false,
    removeContainer: true,
    ignoreElements: (el: Element) => {
      const tag = el.tagName;
      return tag === 'IFRAME' || tag === 'VIDEO' || tag === 'OBJECT' || tag === 'EMBED';
    },
    onclone: (doc: Document) => {
      doc.querySelectorAll('iframe, video, object, embed').forEach(n => n.remove());
      doc.querySelectorAll('img').forEach(img => {
        if (!(img instanceof HTMLImageElement)) return;
        if (!img.src || (img.complete && img.naturalWidth === 0)) {
          img.style.display = 'none';
          img.style.visibility = 'hidden';
        }
      });
      /*
       * يجب تطبيق إصلاح المهارات والـ QR على المستند المستنسخ أيضاً.
       * onclone يستلم document كامل — لا يرث فئات الحاوية (.cv-export-offscreen)،
       * لذا تُطبَّق قاعدة img{max-width:100%!important} من media-query الجوال.
       */
      applySkillLayoutForCapture(doc, skillVars);
      applyQrLayoutForCapture(doc);
    },
  };
}

function collectPdfLinks(sheet: HTMLElement): CvPdfLink[] {
  const links: CvPdfLink[] = [];
  const sheetRect = sheet.getBoundingClientRect();
  if (sheetRect.width < 10 || sheetRect.height < 10) return links;

  sheet.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(a => {
    const raw = a.getAttribute('href') || '';
    const url = raw.startsWith('http') ? raw : (a.href || '');
    if (!url || url === '#' || url.startsWith('javascript:')) return;

    const r = a.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;

    const xPx = r.left - sheetRect.left;
    const yPx = r.top - sheetRect.top;
    if (xPx + r.width < 0 || yPx + r.height < 0) return;
    if (xPx > CV_EXPORT_PX + 4 || yPx > CV_PAGE_H_PX + 4) return;

    links.push({
      url,
      x: (xPx / CV_EXPORT_PX) * PAGE_W_MM,
      y: (yPx / CV_PAGE_H_PX) * PAGE_H_MM,
      w: Math.max(4, (r.width / CV_EXPORT_PX) * PAGE_W_MM),
      h: Math.max(4, (r.height / CV_PAGE_H_PX) * PAGE_H_MM),
    });
  });

  return links;
}

function addPdfLinks(
  pdf: InstanceType<ReturnType<typeof getJsPDFCtor>>,
  links: CvPdfLink[],
): void {
  const linkFn = (pdf as { link?: (x: number, y: number, w: number, h: number, opts: { url: string }) => void }).link;
  if (typeof linkFn !== 'function') return;
  for (const l of links) {
    try {
      linkFn.call(pdf, l.x, l.y, l.w, l.h, { url: l.url });
    } catch { /* optional */ }
  }
}

async function captureSheetOnce(
  sheet: HTMLElement,
  widthPx: number,
  heightPx: number,
  scale: number,
  skillVars: SkillLayoutVars,
): Promise<string> {
  const h2c = getHtml2Canvas();
  const canvas = await h2c(sheet, html2canvasOptions(scale, widthPx, heightPx, skillVars));
  return canvas.toDataURL('image/png');
}

async function captureSheet(liveSheet: HTMLElement, pageIndex: number, pageTotal: number): Promise<PageCapture> {
  const widthPx = CV_EXPORT_PX;
  const heightPx = CV_PAGE_H_PX;
  const skillVars = readSkillLayoutVars(liveSheet);

  let restoreOverflow = () => {};
  let restoreShift = () => {};
  let restoreClip = () => {};
  let restoreHidden = () => {};
  const viewport = buildCaptureViewport(widthPx, heightPx);

  try {
    restoreOverflow = unlockPageOverflowForCapture();

    try { await refreshCvQrBitmaps(liveSheet, { exportHiRes: true }); } catch { /* optional */ }
    await waitForImages(liveSheet);

    const clone = liveSheet.cloneNode(true) as HTMLElement;
    viewport.appendChild(clone);
    document.body.appendChild(viewport);

    restoreShift = flattenCvSheetShift(clone);
    await waitForImages(clone);

    lockSheetSize(clone, widthPx, heightPx);
    reflowCvSheetFooterForCapture(clone);
    applySkillLayoutForCapture(clone, skillVars);
    applyQrLayoutForCapture(clone);
    prepareSheetForCapture(clone);
    restoreClip = lockSheetClipForCapture(clone);

    /*
     * فرض إعادة حساب التخطيط قبل قياس offsetTop في hideFlowBlocksOutsideWindow.
     * بدون هذا، التعديلات السابقة (lockSheetSize، reflowFooter…) لم يُطبّقها المتصفح بعد
     * فتأتي قيم offsetTop خاطئة وتُخفى كتل مرئية أو تُظهر كتل خارج النافذة.
     */
    void clone.offsetHeight;

    restoreHidden = hideFlowBlocksOutsideWindow(clone);

    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const links = collectPdfLinks(clone);

    const scales = captureScalesToTry();
    let lastErr: unknown;
    for (const scale of scales) {
      try {
        const dataUrl = await captureSheetOnce(clone, widthPx, heightPx, scale, skillVars);
        return { dataUrl, links };
      } catch (e) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 250));
      }
    }

    const detail = lastErr instanceof Error ? lastErr.message : '';
    throw new Error(
      detail
        ? `تعذّر التقاط الصفحة ${pageIndex + 1} من ${pageTotal} — ${detail}`
        : `تعذّر التقاط الصفحة ${pageIndex + 1} من ${pageTotal}`,
    );
  } finally {
    restoreHidden();
    restoreClip();
    restoreShift();
    viewport.remove();
    restoreOverflow();
  }
}

export async function captureCvSheetsToPdfBlob(sheets: HTMLElement[]): Promise<Blob> {
  if (!exportLibsReady()) {
    throw new Error('مكتبة التصدير غير محمّلة — حدّث الصفحة (Ctrl+F5)');
  }
  if (sheets.length === 0) {
    throw new Error('لا توجد صفحات للتصدير — تأكد من ظهور السيرة كاملة');
  }

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await Promise.all([
      document.fonts.load("400 14px 'Tajawal'"),
      document.fonts.load("700 14px 'Tajawal'"),
      document.fonts.load("800 14px 'Tajawal'"),
    ]);
  } catch { /* optional */ }

  const pages: PageCapture[] = [];
  for (let i = 0; i < sheets.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 150));
    pages.push(await captureSheet(sheets[i], i, sheets.length));
  }

  const JsPDF = getJsPDFCtor();
  const pdf = new JsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  });

  pages.forEach((page, i) => {
    if (i > 0) pdf.addPage('a4', 'portrait');
    pdf.addImage(page.dataUrl, 'PNG', 0, 0, PAGE_W_MM, PAGE_H_MM, undefined, 'MEDIUM');
    addPdfLinks(pdf, page.links);
  });

  return pdf.output('blob');
}
