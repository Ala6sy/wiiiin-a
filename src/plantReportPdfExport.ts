import { exportLibsReady, getHtml2Canvas, getJsPDFCtor } from './pdfCaptureLibs';
import { mountExportCaptureShell, prepareSheetForCapture, reflowCvSheetFooterForCapture } from './cvExportCapture';

export { exportLibsReady } from './pdfCaptureLibs';

/** A4 report width at 96 CSS px/in â€” matches PlantReportDoc */
export const REPORT_EXPORT_PX = 794;

/** ط¹ط±ط¶ A4 ط¨ط§ظ„ظ…ظ„ظٹظ…طھط± â€” ط«ط§ط¨طھ ط¹ظ„ظ‰ ط§ظ„ط¬ظˆط§ظ„ ظˆط§ظ„ظˆظٹط¨ */
export const REPORT_PAGE_WIDTH_MM = 210;
export const REPORT_PAGE_HEIGHT_MM = 297;

/** ظ‡ط¯ظپ ~300 DPI ظ„ط¹ط±ط¶ A4 (794 CSS px أ— 3 â‰ˆ 2382 px) */
const EXPORT_SCALE_TARGET = 3;
const CAPTURE_BOTTOM_PAD = 80;
const CANVAS_MAX_SIDE = 4096;
const CANVAS_MAX_AREA = 16_777_216;

/** ظ…ظ‚ظٹط§ط³ ط§ظ„طھظ‚ط§ط· ظ…ظˆط­ظ‘ط¯ â€” ظٹطھظƒظٹظ‘ظپ ظ…ط¹ ط·ظˆظ„ ط§ظ„طھظ‚ط±ظٹط± ظˆط­ط¯ظˆط¯ canvas */
export function computeCaptureScale(cssW: number, cssH: number, target = EXPORT_SCALE_TARGET): number {
  let s = target;
  s = Math.min(s, CANVAS_MAX_SIDE / Math.max(1, cssW), CANVAS_MAX_SIDE / Math.max(1, cssH));
  const area = cssW * cssH * s * s;
  if (area > CANVAS_MAX_AREA) s = Math.sqrt(CANVAS_MAX_AREA / Math.max(1, cssW * cssH));
  return Math.max(1, Math.min(target, s));
}

export function applyPlantReportPdfLayoutFixes(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('.plant-report-nutrients-table th, .plant-report-nutrients-table td').forEach(cell => {
    cell.style.setProperty('display', 'table-cell', 'important');
    cell.style.setProperty('vertical-align', 'middle', 'important');
    cell.style.setProperty('line-height', '1.45', 'important');
    cell.style.setProperty('padding-top', '8px', 'important');
    cell.style.setProperty('padding-bottom', '8px', 'important');
  });

  root.querySelectorAll<HTMLElement>('.plant-report-signature-img, .plant-report-stamp-img, .plant-report-header-logo').forEach(img => {
    img.style.setProperty('display', 'inline-block', 'important');
    img.style.setProperty('visibility', 'visible', 'important');
    img.style.setProperty('opacity', '1', 'important');
    img.style.setProperty('vertical-align', 'middle', 'important');
  });
}

function imgProxyUrl(src: string): string {
  const base = typeof window !== 'undefined' && window.location.pathname.includes('/api/')
    ? '../api/img-proxy.php'
    : '/api/img-proxy.php';
  return `${base}?url=${encodeURIComponent(src)}`;
}

function loadImageForRaster(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

async function rasterizeImageElement(img: HTMLImageElement): Promise<void> {
  const raw = img.getAttribute('src') || img.src || '';
  if (!raw || raw.startsWith('blob:')) return;

  let loaded: HTMLImageElement | null = null;
  const candidates = [raw];
  if (/^https?:\/\//i.test(raw)) candidates.push(imgProxyUrl(raw));

  for (const url of candidates) {
    try {
      loaded = await loadImageForRaster(url);
      break;
    } catch { /* try next */ }
  }
  if (!loaded || loaded.naturalWidth < 1 || loaded.naturalHeight < 1) return;

  const canvas = document.createElement('canvas');
  canvas.width = loaded.naturalWidth;
  canvas.height = loaded.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(loaded, 0, 0);
  img.src = canvas.toDataURL('image/png');
  img.style.visibility = 'visible';
  img.style.opacity = '1';
  img.style.display = 'inline-block';
}

/** يحوّل صور التوقيع/الختم/الشعار إلى data-URL قبل html2canvas — يمنع اختفاءها في PDF */
export async function rasterizeReportImagesForCapture(root: HTMLElement): Promise<void> {
  const imgs = [
    ...root.querySelectorAll<HTMLImageElement>('.plant-report-signature-img'),
    ...root.querySelectorAll<HTMLImageElement>('.plant-report-stamp-img'),
    ...root.querySelectorAll<HTMLImageElement>('.plant-report-header-logo'),
  ];
  await Promise.all(imgs.map(img => rasterizeImageElement(img).catch(() => undefined)));
}

export function applyCvFooterForCapture(scope: ParentNode): void {
  scope.querySelectorAll<HTMLElement>('.cv-a4-sheet, .a4-page').forEach(sheet => {
    sheet.style.setProperty('--cv-pad-x', '14mm', 'important');
    sheet.style.setProperty('--cv-pad-y', '18mm', 'important');
    sheet.style.setProperty('overflow', 'hidden', 'important');
    sheet.style.setProperty('box-sizing', 'border-box', 'important');
    reflowCvSheetFooterForCapture(sheet);
  });
  scope.querySelectorAll<HTMLElement>(
    '.cv-page-footer-band, .cv-footer-full-bleed, .cv-footer-bar-layout, .cv-footer-color-bar',
  ).forEach(el => {
    el.style.setProperty('flex-shrink', '0', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.style.setProperty('opacity', '1', 'important');
  });
}

function prepareExportRoot(root: HTMLElement, widthPx: number, fullHeightPx?: number) {
  const isCvSheet = root.classList.contains('cv-a4-sheet');
  const printCapture = isCvSheet && (
    document.body.classList.contains('cv-print-active')
    || !!root.closest('.cv-print-stack')
  );
  root.style.width = `${widthPx}px`;
  root.style.maxWidth = `${widthPx}px`;
  root.style.minWidth = `${widthPx}px`;
  root.style.boxSizing = 'border-box';
  root.style.transform = 'none';
  root.style.overflow = 'hidden';
  root.style.display = 'block';
  root.style.flexDirection = 'column';
  root.style.minHeight = 'auto';
  if (fullHeightPx && fullHeightPx > 0) {
    root.style.height = `${fullHeightPx}px`;
    root.style.minHeight = `${fullHeightPx}px`;
    root.style.maxHeight = `${fullHeightPx}px`;
  } else {
    root.style.height = 'auto';
    root.style.minHeight = 'auto';
    root.style.maxHeight = 'none';
  }
  root.style.paddingBottom = isCvSheet ? '0' : `${CAPTURE_BOTTOM_PAD}px`;
  const footer = root.querySelector('.plant-report-footer');
  if (footer instanceof HTMLElement) {
    footer.style.marginTop = '28px';
    footer.style.flexShrink = '0';
  }
  if (printCapture) {
    applyCvFooterForCapture(root);
  }
}

function findPrintRoot(doc: Document, node?: Element | null): HTMLElement | null {
  if (node instanceof HTMLElement) {
    if (node.classList.contains('plant-report-print-root')) return node;
    if (node.classList.contains('cv-a4-sheet')) return node;
    if (node.classList.contains('plant-report-export-capture-viewport')) {
      const sheet = node.querySelector('.cv-a4-sheet');
      if (sheet instanceof HTMLElement) return sheet;
    }
    const nested = node.querySelector('.plant-report-print-root, .cv-a4-sheet');
    if (nested instanceof HTMLElement) return nested;
  }
  const fromDoc = doc.querySelector('.plant-report-print-root');
  return fromDoc instanceof HTMLElement ? fromDoc : null;
}

/**
 * ط®ظٹط§ط±ط§طھ html2canvas ظ…ظˆط­ظ‘ط¯ط© â€” ط¨ط¯ظˆظ† height/windowHeight (طھط³ط¨ظ‘ط¨ طھط´ظˆظ‘ظ‡ط§ظ‹ ط¹ظ„ظ‰ ط§ظ„ظˆظٹط¨)
 * ط§ظ„ط¯ظ‚ط© ط¹ط¨ط± scale ظ…ط¨ط§ط´ط±ط© ظˆظ„ظٹط³ طھظƒط¨ظٹط±ط§ظ‹ ظ„ط§ط­ظ‚ط§ظ‹ ظ„ظ„طµظˆط±ط©
 */
function html2canvasOpts(
  scale: number,
  width: number,
  withPrepare = true,
  height?: number,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    scrollX: 0,
    scrollY: 0,
    logging: false,
    foreignObjectRendering: false,
    width,
  };
  if (height && height > 0) base.height = height;
  if (withPrepare) {
    base.onclone = (doc: Document, node?: Element | null) => {
      const root = findPrintRoot(doc, node);
      if (root) {
        prepareExportRoot(root, width, height);
        applyPlantReportPdfLayoutFixes(root);
      }
      doc.querySelectorAll('img').forEach(img => {
        if (!(img instanceof HTMLImageElement)) return;
        const src = img.getAttribute('src') || img.src || '';
        if (!src) {
          img.style.display = 'none';
          return;
        }
        img.loading = 'eager';
        img.style.visibility = 'visible';
        img.style.opacity = '1';
        img.style.display = img.style.display === 'none' ? 'inline-block' : (img.style.display || 'inline-block');
      });
    };
  }
  return base;
}

function measureContentBottom(el: HTMLElement): number {
  const selectors = [
    '.plant-report-footer',
    '.cv-page-footer-band',
    '.cv-footer-bar-layout',
    '.cv-footer-color-bar',
  ];
  let bottom = 0;
  for (const sel of selectors) {
    const node = el.querySelector(sel);
    if (node instanceof HTMLElement) {
      bottom = Math.max(bottom, node.offsetTop + node.offsetHeight);
    }
  }
  return bottom;
}

async function measureFullHeight(el: HTMLElement): Promise<number> {
  let prev = 0;
  let h = 0;
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 80));
    const contentBottom = measureContentBottom(el);
    h = Math.max(
      el.scrollHeight,
      el.offsetHeight,
      el.getBoundingClientRect().height,
      contentBottom + CAPTURE_BOTTOM_PAD,
      400,
    );
    if (Math.abs(h - prev) < 2) break;
    prev = h;
  }
  return h;
}

export async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = [...root.querySelectorAll('img')];
  const timeoutMs = isMobileCaptureDevice() ? 6000 : 4000;
  await Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    img.loading = 'eager';
    return new Promise<void>(resolve => {
      const done = () => resolve();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      setTimeout(done, timeoutMs);
    });
  }));
}

function isMobileCaptureDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 768px)').matches;
}

function canvasAcceptable(
  canvas: HTMLCanvasElement,
  width: number,
  height: number | undefined,
  scale: number,
): boolean {
  if (!canvas?.toDataURL) return false;
  const expW = Math.round(width * scale);
  const expH = height && height > 0 ? Math.round(height * scale) : 0;
  const minW = Math.round(expW * (isMobileCaptureDevice() ? 0.92 : 0.45));
  const minH = expH > 0 ? Math.round(expH * (isMobileCaptureDevice() ? 0.9 : 0.45)) : 1;
  return canvas.width >= minW && canvas.height >= minH;
}

async function elementToCanvas(
  el: HTMLElement,
  scale: number,
  width: number,
  height?: number,
): Promise<HTMLCanvasElement> {
  const h2c = getHtml2Canvas();
  prepareSheetForCapture(el);
  const mobile = isMobileCaptureDevice();
  const scales = mobile
    ? [scale, 1]
    : [scale, Math.max(1, scale * 0.75), Math.max(1, scale * 0.5), 1];
  const heights = height && height > 0 ? [height, undefined] : [height];
  let lastErr: unknown;
  let lastCanvas: HTMLCanvasElement | null = null;
  for (let attempt = 0; attempt < scales.length; attempt++) {
    const s = scales[attempt];
    for (const h of heights) {
      const opts = html2canvasOpts(s, width, true, h);
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, mobile ? 350 : 300));
        const canvas = await h2c(el, opts);
        if (canvas?.width > 0 && canvas.height > 0) lastCanvas = canvas;
        if (canvasAcceptable(canvas, width, h, s)) return canvas;
      } catch (e) {
        lastErr = e;
      }
    }
  }
  if (lastCanvas) return lastCanvas;
  const msg = lastErr instanceof Error ? lastErr.message : '';
  throw new Error(msg || 'طھط¹ط°ظ‘ط± ط§ظ„طھظ‚ط§ط· ط§ظ„طµظپط­ط© ظ„ظ„طھطµط¯ظٹط± â€” ط­ط¯ظ‘ط« ط§ظ„طµظپط­ط© ظˆط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰');
}

/** ط§ظ„طھظ‚ط§ط· ط¹ظ…ظˆط¯ظٹ ط¹ظ„ظ‰ ط¯ظپط¹ط§طھ ط¹ظ†ط¯ ظ‚طµظ‘ ط§ظ„ط§ط±طھظپط§ط¹ (ط¬ظˆط§ظ„ ط£ظˆ ظˆظٹط¨) */
async function captureTiledCanvas(
  el: HTMLElement,
  width: number,
  totalCssH: number,
  scale: number,
): Promise<HTMLCanvasElement> {
  const h2c = getHtml2Canvas();
  const tileCssH = Math.min(1800, totalCssH);
  const tiles: HTMLCanvasElement[] = [];
  let y = 0;

  while (y < totalCssH) {
    const sliceH = Math.min(tileCssH, totalCssH - y);
    const viewport = document.createElement('div');
    viewport.style.cssText = `position:fixed;left:-12000px;top:0;width:${width}px;height:${sliceH}px;overflow:hidden;background:#fff;z-index:-1;`;
    const shifted = el.cloneNode(true) as HTMLElement;
    shifted.style.margin = '0';
    shifted.style.transform = `translateY(-${y}px)`;
    shifted.style.transformOrigin = 'top left';
    prepareExportRoot(shifted, width, totalCssH);
    viewport.appendChild(shifted);
    document.body.appendChild(viewport);

    try {
      const tile = await h2c(viewport, html2canvasOpts(scale, width, false));
      tiles.push(tile);
    } finally {
      viewport.remove();
    }
    y += sliceH;
  }

  const out = document.createElement('canvas');
  out.width = tiles[0]?.width ?? Math.round(width * scale);
  out.height = tiles.reduce((sum, t) => sum + t.height, 0);
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('طھط¹ط°ظ‘ط± ط¯ظ…ط¬ ظ„ظ‚ط·ط§طھ ط§ظ„طھظ‚ط±ظٹط±');
  let dy = 0;
  for (const tile of tiles) {
    ctx.drawImage(tile, 0, dy);
    dy += tile.height;
  }
  return out;
}

function canvasMatchesExpected(
  canvas: HTMLCanvasElement,
  widthPx: number,
  cssH: number,
  scale: number,
): boolean {
  const expW = Math.round(widthPx * scale);
  const expH = Math.round(cssH * scale);
  return canvas.width >= expW * 0.88 && canvas.height >= expH * 0.88;
}

/** ظ…ط³ط§ط± ط§ظ„طھظ‚ط§ط· ظˆط§ط­ط¯ â€” ظ†ظپط³ ط§ظ„ظ…ظ†ط·ظ‚ ط¹ظ„ظ‰ ط§ظ„ط¬ظˆط§ظ„ ظˆط§ظ„ظˆظٹط¨ */
async function captureRoot(
  el: HTMLElement,
  widthPx: number,
  scaleTarget = EXPORT_SCALE_TARGET,
  allowTiling = true,
): Promise<string> {
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  await waitForImages(el);
  await rasterizeReportImagesForCapture(el);
  applyPlantReportPdfLayoutFixes(el);

  let cssH = await measureFullHeight(el);
  prepareExportRoot(el, widthPx, cssH);
  await new Promise(r => setTimeout(r, 450));
  cssH = await measureFullHeight(el);
  prepareExportRoot(el, widthPx, cssH);

  const captureCssH = cssH + CAPTURE_BOTTOM_PAD;
  const scale = computeCaptureScale(widthPx, captureCssH, scaleTarget);

  let canvas = await elementToCanvas(el, scale, widthPx);

  if (!canvasMatchesExpected(canvas, widthPx, captureCssH, scale)) {
    await new Promise(r => setTimeout(r, 300));
    cssH = await measureFullHeight(el);
    prepareExportRoot(el, widthPx, cssH);
    canvas = await elementToCanvas(el, scale, widthPx);
  }

  if (allowTiling && !canvasMatchesExpected(canvas, widthPx, cssH + CAPTURE_BOTTOM_PAD, scale)) {
    try {
      canvas = await captureTiledCanvas(el, widthPx, cssH + CAPTURE_BOTTOM_PAD, scale);
    } catch { /* keep best single capture */ }
  }

  return canvas.toDataURL('image/png');
}

/**
 * ظ„ظ‚ط·ط© ظ…ط¨ط§ط´ط±ط© ظ…ظ† ط¹ظ†طµط± ط¬ط§ظ‡ط² (ط¨ط¯ظˆظ† clone ط¥ط¶ط§ظپظٹ) â€” ظ„ظ„ط³ظٹط±ط© ظˆط§ظ„ظ…ط¹ط§ظٹظ†ط© ط§ظ„ط­ظٹط©
 */
export async function captureDirectSnapshot(
  el: HTMLElement,
  widthPx: number = REPORT_EXPORT_PX,
  scaleTarget = EXPORT_SCALE_TARGET,
  allowTiling = true,
): Promise<string> {
  if (!exportLibsReady()) {
    throw new Error('ظ…ظƒطھط¨ط© ط§ظ„طھطµط¯ظٹط± ط؛ظٹط± ظ…ط­ظ…ظ‘ظ„ط©. ط­ط¯ظ‘ط« ط§ظ„طµظپط­ط© (Ctrl+F5) ظˆط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰.');
  }
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    try {
      await Promise.all([
        document.fonts.load("400 14px 'Tajawal'"),
        document.fonts.load("700 14px 'Tajawal'"),
        document.fonts.load("800 14px 'Tajawal'"),
        document.fonts.load("900 17px 'Tajawal'"),
      ]);
    } catch { /* ignore */ }
  } catch { /* ignore */ }
  return captureRoot(el, widthPx, scaleTarget, allowTiling);
}

/**
 * ظ„ظ‚ط·ط© ظƒط§ظ…ظ„ط© ظ„ظ„طھظ‚ط±ظٹط± â€” ظٹظپط¶ظ‘ظ„ ط§ظ„ط¹ظ†طµط± ط§ظ„ط­ظٹ ظپظٹ export-host (ط¨ط¯ظˆظ† clone)
 */
export async function captureElementSnapshot(el: HTMLElement, widthPx: number = REPORT_EXPORT_PX): Promise<string> {
  if (!exportLibsReady()) {
    throw new Error('ظ…ظƒطھط¨ط© ط§ظ„طھطµط¯ظٹط± ط؛ظٹط± ظ…ط­ظ…ظ‘ظ„ط©. ط­ط¯ظ‘ط« ط§ظ„طµظپط­ط© (Ctrl+F5) ظˆط­ط§ظˆظ„ ظ…ط±ط© ط£ط®ط±ظ‰.');
  }

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    try {
      await Promise.all([
        document.fonts.load("400 14px 'Tajawal'"),
        document.fonts.load("700 14px 'Tajawal'"),
        document.fonts.load("900 17px 'Tajawal'"),
      ]);
    } catch { /* ignore */ }
  } catch { /* ignore */ }

  const inExportHost = !!el.closest('.plant-report-export-host');
  if (inExportHost) {
    return captureRoot(el, widthPx);
  }

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.className = 'plant-report-export-capture';
  host.style.cssText = `position:fixed;left:-12000px;top:0;width:${widthPx}px;max-width:none;min-width:${widthPx}px;opacity:1;pointer-events:none;z-index:-1;overflow:visible;`;
  const clone = el.cloneNode(true) as HTMLElement;
  clone.classList.add('plant-report-export-capture-root');
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    return await captureRoot(clone, widthPx);
  } finally {
    document.body.removeChild(host);
  }
}

/** Rasterize plant report at A4 export width */
export async function captureReportSnapshot(el: HTMLElement): Promise<string> {
  return captureElementSnapshot(el, REPORT_EXPORT_PX);
}

type JsPDFInstance = {
  addImage: (...args: unknown[]) => void;
  addPage: (format?: string | number[], orientation?: string) => void;
  output: (type: string) => Blob;
};

type JsPDFCtor = new (o?: object) => JsPDFInstance;

async function loadImageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('طھط¹ط°ظ‘ط± ظ‚ط±ط§ط،ط© طµظˆط±ط© ط§ظ„طھطµط¯ظٹط±'));
    img.src = dataUrl;
  });
}

async function resolveJsPDF(): Promise<JsPDFCtor | null> {
  try {
    return getJsPDFCtor() as unknown as JsPDFCtor;
  } catch {
    return null;
  }
}

/**
 * ط¨ظ†ط§ط، PDF ظ…ظ† ظ„ظ‚ط·ط© â€” ط¹ط±ط¶ ط«ط§ط¨طھ 210mmطŒ ط§ظ„ط§ط±طھظپط§ط¹ ظ…ظ† ظ†ط³ط¨ط© ط§ظ„طµظˆط±ط© (ظ…ظˆط­ظ‘ط¯ ط¬ظˆط§ظ„/ظˆظٹط¨)
 */
export async function snapshotDataUrlToPdfBlob(
  dataUrl: string,
  pageWidthMm = REPORT_PAGE_WIDTH_MM,
): Promise<Blob> {
  const dims = await loadImageDims(dataUrl);
  const pageHmm = (dims.h / dims.w) * pageWidthMm;
  const format = dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';

  const JsPDF = await resolveJsPDF();
  if (!JsPDF) {
    throw new Error('ظ…ظƒطھط¨ط© jsPDF ط؛ظٹط± ظ…ط­ظ…ظ‘ظ„ط©');
  }
  const pdf = new JsPDF({
    unit: 'mm',
    format: [pageWidthMm, pageHmm],
    orientation: 'portrait',
    compress: true,
  });
  pdf.addImage(dataUrl, format, 0, 0, pageWidthMm, pageHmm, undefined, 'FAST');
  return pdf.output('blob');
}
