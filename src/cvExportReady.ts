/** هل السيرة جاهزة للتصدير؟ */
function cvExportDomReady(root: HTMLElement | null): boolean {
  if (!root) return false;
  const sheets = root.querySelectorAll('.cv-paged-root > .cv-a4-sheet, .cv-a4-sheet');
  if (sheets.length > 0) return true;
  return !!(root.querySelector('.cv-page-frame, .cv-head'));
}

/** انتظر رسم CV المخفي + الخطوط والصور قبل التصدير (مهم على الجوال) */
export async function waitForCvExportReady(
  root: HTMLElement | null,
  timeoutMs = 10000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (cvExportDomReady(root)) break;
    await new Promise(r => setTimeout(r, 60));
  }
  if (!cvExportDomReady(root)) {
    throw new Error('CV export mount timeout');
  }
  try {
    if (document.fonts?.ready) await document.fonts.ready;
  } catch { /* ignore */ }
  const imgs = [...(root?.querySelectorAll('img') ?? [])];
  await Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>(resolve => {
      const done = () => resolve();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      setTimeout(done, 2000);
    });
  }));

  const titleDeadline = Date.now() + Math.min(timeoutMs, 6000);
  while (Date.now() < titleDeadline) {
    const titles = [...(root?.querySelectorAll('.cv-sec-title--raster') ?? [])];
    if (!titles.length) break;
    const ready = titles.every(el => el.getAttribute('data-cv-title-ready') === '1'
      || !!(el.querySelector('.cv-sec-title-img') as HTMLImageElement | null)?.src);
    if (ready) break;
    await new Promise(r => setTimeout(r, 80));
  }

  await new Promise(r => setTimeout(r, 350));

  const qrDeadline = Date.now() + Math.min(timeoutMs, 5000);
  while (Date.now() < qrDeadline) {
    const qrImgs = [...(root?.querySelectorAll('.cv-docs-qr-img') ?? [])];
    if (!qrImgs.length) break;
    const qrReady = qrImgs.every(img => (img as HTMLImageElement).complete);
    if (qrReady) break;
    await new Promise(r => setTimeout(r, 80));
  }
}

/** انتظر اكتمال تقسيم صفحات A4 قبل التصدير — يطابق المعاينة */
export async function waitForCvPagedLayout(
  root: HTMLElement | null,
  timeoutMs = 12000,
): Promise<number> {
  if (!root) return 0;
  const start = Date.now();
  let lastCount = -1;
  let stable = 0;
  while (Date.now() - start < timeoutMs) {
    const pagedRoot = root.querySelector('.cv-paged-root');
    const measureBody = root.querySelector('.cv-paged-measure .cv-page-body-inner') as HTMLElement | null;
    const sheets = root.querySelectorAll('.cv-paged-root > .cv-a4-sheet');
    const attrCount = Number(pagedRoot?.getAttribute('data-cv-page-count') || 0);
    const count = sheets.length;
    const bodyReady = (measureBody?.scrollHeight ?? 0) > 40;
    const countReady = count > 0 && attrCount > 0 && count === attrCount;
    const budgetsReady = Array.from(sheets).every(s => {
      const b = s.querySelector('.cv-page-body-window')?.getAttribute('data-cv-body-budget');
      return !!b && Number.parseFloat(b) > 40;
    });
    const cloneReady = count > 0 && attrCount > 0 && count === attrCount && !measureBody;
    if ((bodyReady && countReady && budgetsReady) || cloneReady || (count > 0 && !measureBody && budgetsReady)) {
      if (count === lastCount) {
        stable += 1;
        if (stable >= 3) return count;
      } else {
        stable = 0;
        lastCount = count;
      }
    }
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  }
  const finalSheets = root.querySelectorAll('.cv-paged-root > .cv-a4-sheet').length;
  const finalAttr = Number(root.querySelector('.cv-paged-root')?.getAttribute('data-cv-page-count') || 0);
  return Math.max(finalSheets, finalAttr, 1);
}
