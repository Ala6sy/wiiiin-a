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
  lockCvExportDimensions,
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
  headerBarGap: string;   /* gap between name-line and bar-track */
  rowGap: string;         /* margin-bottom between skill rows */
  nameLineHeight: string; /* min-height of name line */
  iconSize: string;       /* --cv-skill-icon-size */
  iconNameGap: string;    /* gap between name text and icon */
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
    nameLineHeight: cs.getPropertyValue('--cv-skill-name-line-height').trim() || '14px',
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
 * إصلاح تخطيط المهارات لـ html2canvas.
 *
 * مشكلتان معروفتان في html2canvas 1.4.1:
 *   1. يتجاهل `gap` على flex وgrid.
 *   2. قد لا يُطبّق `align-items:center` بشكل صحيح على inline-flex.
 *
 * الحل للمحاذاة العمودية (اسم البرنامج والأيقونة):
 *   نحوّل .cv-skill-bar-name-chip إلى inline-table.
 *   الخلايا table-cell + vertical-align:middle مضمونة في html2canvas.
 *
 * الحل لـ gap:
 *   نُبقي flex-column على .cv-skill-bar-row ونستبدل gap بـ margin صريحة.
 */
function applySkillLayoutForCapture(root: ParentNode, vars: SkillLayoutVars): void {
  const iconPx = vars.iconSize || '14px';
  const iconSizeNum = parseFloat(iconPx) || 14;

  /*
   * ─── Row: flex-column، gap=0، margin-bottom للمسافة بين الصفوف ────────────
   *
   * المشكلة السابقة: وضعنا margin-bottom على .cv-skill-bar-line لإنشاء فراغ
   * بينه وبين الشريط. لكن CSS لديه margin:0!important على .cv-skill-bar-line
   * وهذا أدى إلى صراع مع html2canvas وجعل السطر يظهر في الأسفل.
   *
   * الحل الجذري: بدل margin → نُدرج عنصر <div> فاصل صريح (spacer) بين
   * سطر الاسم والشريط. عنصر DOM حقيقي بارتفاع ثابت — لا صراع CSS مطلقاً.
   */
  root.querySelectorAll<HTMLElement>('.cv-skill-bar-row').forEach(row => {
    row.style.setProperty('display', 'flex', 'important');
    row.style.setProperty('flex-direction', 'column', 'important');
    row.style.setProperty('gap', '0', 'important');
    row.style.setProperty('margin-bottom', vars.rowGap, 'important');

    /* أدرج spacer بين سطر الاسم والشريط إن لم يكن موجوداً */
    if (!row.querySelector('.cv-h2c-spacer')) {
      const line = row.querySelector<HTMLElement>('.cv-skill-bar-line, .cv-skill-bar-header');
      const track = row.querySelector<HTMLElement>('.cv-skill-bar-track');
      if (line && track) {
        const spacer = (root instanceof Document ? root : row.ownerDocument!).createElement('div');
        spacer.className = 'cv-h2c-spacer';
        spacer.style.cssText = [
          'display:block',
          `height:${vars.headerBarGap}`,
          'width:100%',
          'flex-shrink:0',
          'margin:0',
          'padding:0',
          'border:none',
          'background:transparent',
          'pointer-events:none',
        ].join('!important;') + '!important';
        row.insertBefore(spacer, track);
      }
    }
  });

  /* ─── سطر الاسم: flex-row، لا margin — الفراغ يأتي من spacer ─── */
  root.querySelectorAll<HTMLElement>('.cv-skill-bar-line, .cv-skill-bar-header').forEach(line => {
    line.style.setProperty('display', 'flex', 'important');
    line.style.setProperty('flex-direction', 'row', 'important');
    line.style.setProperty('align-items', 'center', 'important');
    line.style.setProperty('justify-content', 'space-between', 'important');
    line.style.setProperty('width', '100%', 'important');
    line.style.setProperty('min-height', vars.nameLineHeight, 'important');
    line.style.setProperty('gap', '0', 'important');
    line.style.setProperty('margin', '0', 'important');
    line.style.setProperty('padding', '0', 'important');
  });

  /*
   * ─── Chip: إصلاح المحاذاة العمودية بدون تغيير display ────────────────
   *
   * السبب الجذري:
   *   html2canvas قد يُعالج inline-flex كـ inline عادي.
   *   الأيقونة لها vertical-align:middle (من CSS) لكن النص له
   *   vertical-align:baseline (الافتراضي) → النص ينزل أسفل الأيقونة.
   *
   * الحل الجذري المضمون:
   *   نجعل النص ونفس ارتفاع الأيقونة متساويين: height = line-height = iconPx.
   *   بذلك كلاهما 14px، وكلاهما vertical-align:middle → يتمحوران بالضبط
   *   في نفس النقطة بغض النظر عن هل html2canvas يُطبّق flex أم inline.
   *
   *   لماذا لا نستخدم inline-table:
   *   inline-table في سياق flex يُصبح block-table، مما يُكسر
   *   margin-bottom على سطر الاسم ويُزيل الفراغ بينه وبين الشريط.
   */
  root.querySelectorAll<HTMLElement>('.cv-skill-bar-name-chip, .cv-skill-bar-name').forEach(chip => {
    chip.style.setProperty('display', 'inline-flex', 'important');
    chip.style.setProperty('flex-direction', 'row', 'important');
    chip.style.setProperty('align-items', 'center', 'important');
    chip.style.setProperty('direction', 'ltr', 'important');
    chip.style.setProperty('gap', '0', 'important');
    chip.style.setProperty('vertical-align', 'middle', 'important');
  });

  /*
   * النص: نفس ارتفاع الأيقونة + line-height مطابق → يتمحور النص داخله.
   * كلاهما vertical-align:middle → يتمحوران عند نفس خط x-height.
   * margin-inline-end / margin-right بديل gap داخل الـ chip.
   */
  root.querySelectorAll<HTMLElement>('.cv-skill-bar-name-text').forEach(txt => {
    txt.style.setProperty('display', 'inline-block', 'important');
    txt.style.setProperty('vertical-align', 'middle', 'important');
    txt.style.setProperty('height', iconPx, 'important');
    txt.style.setProperty('line-height', iconPx, 'important');
    txt.style.setProperty('overflow', 'hidden', 'important');
    txt.style.setProperty('white-space', 'nowrap', 'important');
    txt.style.setProperty('margin-inline-end', vars.iconNameGap, 'important');
    txt.style.setProperty('margin-right', vars.iconNameGap, 'important');
  });

  /* ─── الشريط: block صريح ─── */
  root.querySelectorAll<HTMLElement>('.cv-skill-bar-track').forEach(track => {
    track.style.setProperty('display', 'block', 'important');
    track.style.setProperty('width', '100%', 'important');
    track.style.setProperty('margin-top', '0', 'important');
    track.style.setProperty('clear', 'both', 'important');
  });

  /* ─── الأيقونات خارج الـ chip (نادرة): ثبّت الحجم ─── */
  root.querySelectorAll<HTMLElement>('.cv-skill-icon').forEach(icon => {
    /* لا نُعيد تحديد display هنا — ضُبطت بالفعل من خلال chip.querySelectorAll أعلاه */
    icon.style.setProperty('width', iconPx, 'important');
    icon.style.setProperty('height', iconPx, 'important');
    icon.style.setProperty('max-width', 'none', 'important');
    icon.style.setProperty('max-height', 'none', 'important');
    icon.style.setProperty('min-width', iconPx, 'important');
    icon.style.setProperty('min-height', iconPx, 'important');
    icon.style.setProperty('flex-shrink', '0', 'important');
    icon.style.setProperty('object-fit', 'contain', 'important');
  });
}

/**
 * حاوية التقاط مخفية تماماً — position:fixed left:-12000px
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

/**
 * خيارات html2canvas.
 *
 * windowWidth:1920 / windowHeight:1080 → يجبر html2canvas على تقييم
 * media queries كـ "desktop"، مما يمنع انهيار العمودين على الجوال.
 *
 * onclone: نُطبّق هنا إصلاحات التخطيط على المستند المستنسخ داخلياً،
 * ونجبر التخطيط ثنائي العمود حتى على الجوال.
 */
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
    /*
     * windowWidth/windowHeight: يُعلم html2canvas بأن viewport المرجعي هو 1920×1080
     * لتقييم media queries. هذا يمنع تطبيق CSS الجوال (breakpoints < 768px)
     * على المستند المستنسخ حتى عند التصدير من هاتف.
     */
    windowWidth: 1920,
    windowHeight: 1080,
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
       * جبر التخطيط ثنائي العمود على الجوال:
       * media queries تُطبَّق بناءً على viewport الحقيقي، لذا نستخدم
       * inline styles (تتغلب على أي !important في CSS) لإجبار 1fr/2fr.
       */
      doc.querySelectorAll<HTMLElement>('.cv-two-col').forEach(col => {
        col.style.setProperty('display', 'grid', 'important');
        col.style.setProperty('grid-template-columns', '1fr 2fr', 'important');
      });

      /*
       * يُطبّق إصلاحات المهارات والـ QR على المستند المستنسخ داخلياً.
       * onclone يستلم document كامل — يجب إعادة التطبيق هنا أيضاً.
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

    /*
     * جبر التخطيط ثنائي العمود على الـ clone قبل باقي الإصلاحات.
     * هذا يعالج مشكلة الجوال: media queries تنهار العمودين لعمود واحد.
     */
    lockCvExportDimensions(clone, widthPx, heightPx);
    clone.querySelectorAll<HTMLElement>('.cv-two-col').forEach(col => {
      col.style.setProperty('display', 'grid', 'important');
      col.style.setProperty('grid-template-columns', '1fr 2fr', 'important');
    });

    reflowCvSheetFooterForCapture(clone);
    applySkillLayoutForCapture(clone, skillVars);
    applyQrLayoutForCapture(clone);
    prepareSheetForCapture(clone);
    restoreClip = lockSheetClipForCapture(clone);

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
