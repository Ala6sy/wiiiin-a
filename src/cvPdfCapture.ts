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
  headerBarGap: string;
  rowGap: string;
  nameLineHeight: string;
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

/** دقة اللقطة — الجوال كان scale=1 فكانت الصورة ضبابية */
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

function skillGapPx(gap: string, extra = 6): string {
  const n = parseFloat(gap);
  if (Number.isFinite(n) && n > 0) return `${n + extra}px`;
  return '12px';
}

/** html2canvas يتجاهل flex-gap — نستخدم margins صريحة كما في المعاينة */
function applySkillLayoutForCapture(root: ParentNode, vars: SkillLayoutVars): void {
  const lineGap = skillGapPx(vars.headerBarGap, 6);
  root.querySelectorAll<HTMLElement>('.cv-skill-bar-row').forEach(row => {
    row.style.setProperty('display', 'block', 'important');
    row.style.setProperty('margin-bottom', vars.rowGap, 'important');
  });
  root.querySelectorAll<HTMLElement>('.cv-skill-bar-line, .cv-skill-bar-header').forEach(line => {
    line.style.setProperty('display', 'flex', 'important');
    line.style.setProperty('flex-direction', 'row', 'important');
    line.style.setProperty('align-items', 'center', 'important');
    line.style.setProperty('justify-content', 'space-between', 'important');
    line.style.setProperty('width', '100%', 'important');
    line.style.setProperty('min-height', vars.nameLineHeight, 'important');
    line.style.setProperty('margin-bottom', lineGap, 'important');
    line.style.setProperty('padding-bottom', '0', 'important');
  });
  root.querySelectorAll<HTMLElement>('.cv-skill-bar-name-chip, .cv-skill-bar-name').forEach(chip => {
    chip.style.setProperty('display', 'inline-flex', 'important');
    chip.style.setProperty('flex-direction', 'row', 'important');
    chip.style.setProperty('align-items', 'center', 'important');
    chip.style.setProperty('direction', 'ltr', 'important');
  });
  root.querySelectorAll<HTMLElement>('.cv-skill-bar-track').forEach(track => {
    track.style.setProperty('display', 'block', 'important');
    track.style.setProperty('width', '100%', 'important');
    track.style.setProperty('margin-top', '0', 'important');
    track.style.setProperty('clear', 'both', 'important');
  });
}

function buildCaptureViewport(widthPx: number, heightPx: number): HTMLDivElement {
  const viewport = mountExportCaptureShell(widthPx, heightPx);
  viewport.style.setProperty('position', 'fixed', 'important');
  viewport.style.setProperty('left', '0', 'important');
  viewport.style.setProperty('top', '0', 'important');
  viewport.style.setProperty('opacity', '0.02', 'important');
  viewport.style.setProperty('visibility', 'visible', 'important');
  viewport.style.setProperty('overflow', 'hidden', 'important');
  viewport.style.setProperty('z-index', '2147483646', 'important');
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
      applySkillLayoutForCapture(doc, skillVars);
      applyQrLayoutForCapture(doc);
    },
  };
}

/** روابط QR والمحفظة — تُضاف كطبقة تفاعلية فوق صورة PDF */
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

/** لقطات متعددة → PDF A4 (210×297mm) */
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
