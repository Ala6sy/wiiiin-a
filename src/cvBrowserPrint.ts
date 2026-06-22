/**
 * تصدير PDF للسيرة الذاتية — مسار واحد للكمبيوتر والجوال
 */
import { CV_EXPORT_PX, CV_PAGE_H_PX } from './cvConstants';
import { showCvPdfPreview, cvPdfPreviewLabels } from './cvPdfDownload';
import { waitForCvPagedLayout } from './cvExportReady';
import { lockCvExportDimensions, sheetHasVisibleBodyContent } from './cvExportCapture';
import { captureCvSheetsToPdfBlob } from './cvPdfCapture';
import { exportLibsReady } from './pdfCaptureLibs';

function resolvePrintStack(root: HTMLElement): HTMLElement {
  if (root.classList.contains('cv-preview-stack')) return root;
  const nested = root.querySelector('.cv-preview-stack');
  if (nested instanceof HTMLElement) return nested;
  throw new Error('لم يُعثر على .cv-preview-stack');
}

function collectSheets(stack: HTMLElement): HTMLElement[] {
  const paged = Array.from(stack.querySelectorAll<HTMLElement>('.cv-paged-root > .cv-a4-sheet'));
  if (paged.length > 0) return paged;
  return Array.from(stack.querySelectorAll<HTMLElement>(':scope > .cv-a4-sheet'));
}

export function isMobileCvDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    return true;
  }
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches;
}

async function waitForPrintPaint(): Promise<void> {
  try {
    await document.fonts?.ready;
  } catch { /* ignore */ }
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  await new Promise<void>(r => setTimeout(r, 200));
}

export async function printCvFromRoot(
  root: HTMLElement,
  documentTitle?: string,
  uiLang: 'ar' | 'en' | 'de' = 'ar',
): Promise<void> {
  if (!exportLibsReady()) {
    throw new Error('مكتبة التصدير غير محمّلة — حدّث الصفحة (Ctrl+F5)');
  }

  const stack = resolvePrintStack(root);
  const fileName = documentTitle || 'cv.pdf';
  const prevTitle = document.title;
  if (documentTitle) document.title = documentTitle.replace(/\.pdf$/i, '');

  stack.style.width = `${CV_EXPORT_PX}px`;
  stack.style.opacity = '1';
  stack.style.visibility = 'visible';
  lockCvExportDimensions(stack, CV_EXPORT_PX, CV_PAGE_H_PX);
  const exportHost = stack.closest('.cv-print-mount, .cv-export-offscreen') as HTMLElement | null;
  if (exportHost) lockCvExportDimensions(exportHost, CV_EXPORT_PX, CV_PAGE_H_PX);

  await waitForPrintPaint();
  await waitForCvPagedLayout(stack, isMobileCvDevice() ? 40000 : 30000);

  const measure = stack.querySelector<HTMLElement>('.cv-paged-measure');
  const measureDisplay = measure?.style.display ?? '';
  if (measure) measure.style.display = 'none';

  try {
    const allSheets = collectSheets(stack);
    const sheets = allSheets.filter(s => sheetHasVisibleBodyContent(s));
    if (sheets.length === 0) {
      throw new Error('لا توجد صفحات بمحتوى للتصدير');
    }

    const expected = Number(stack.querySelector('.cv-paged-root')?.getAttribute('data-cv-page-count') || 0);
    if (expected > 0 && allSheets.length !== expected && sheets.length < expected) {
      throw new Error(
        `عدد الصفحات غير متطابق (${allSheets.length}/${expected}) — انتظر اكتمال المعاينة وحاول مجدداً`,
      );
    }

    const blob = await captureCvSheetsToPdfBlob(sheets);
    const name = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    await showCvPdfPreview(blob, name, cvPdfPreviewLabels(uiLang));
  } finally {
    if (measure) measure.style.display = measureDisplay;
    if (documentTitle) document.title = prevTitle;
  }
}
