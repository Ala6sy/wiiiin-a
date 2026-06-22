import { CV_EXPORT_PX } from './cvConstants';

/** تحويل translateY إلى marginTop — html2canvas يحترم القصّ بعدها */
export function flattenCvSheetShift(sheet: HTMLElement): () => void {
  const shift = sheet.querySelector('.cv-page-body-shift') as HTMLElement | null;
  if (!shift) return () => {};
  const prevTransform = shift.style.transform;
  const prevMargin = shift.style.marginTop;
  const match = prevTransform.match(/translateY\(-(\d+(?:\.\d+)?)px\)/);
  if (!match) return () => {};
  shift.style.transform = 'none';
  shift.style.marginTop = `-${match[1]}px`;
  return () => {
    shift.style.transform = prevTransform;
    shift.style.marginTop = prevMargin;
  };
}

/** قفل قصّ نافذة المحتوى — يمنع ظهور أقسام الصفحة 2 على لقطة الصفحة 1 */
export function lockSheetClipForCapture(sheet: HTMLElement): () => void {
  type Backup = { el: HTMLElement; key: string; value: string };
  const backups: Backup[] = [];
  const lock = (el: HTMLElement, props: Record<string, string>) => {
    for (const [key, value] of Object.entries(props)) {
      backups.push({ el, key, value: el.style.getPropertyValue(key) });
      el.style.setProperty(key, value, 'important');
    }
  };

  lock(sheet, { overflow: 'hidden' });

  const frame = sheet.querySelector<HTMLElement>('.cv-page-frame--paged');
  if (frame) {
    lock(frame, {
      overflow: 'hidden',
      display: 'flex',
      'flex-direction': 'column',
      height: '100%',
    });
  }

  const bodyWin = sheet.querySelector<HTMLElement>('.cv-page-body-window');
  const bodyShift = sheet.querySelector<HTMLElement>('.cv-page-body-shift');
  const bodyInner = sheet.querySelector<HTMLElement>('.cv-page-body-inner');
  const budgetAttr = bodyWin?.getAttribute('data-cv-body-budget');
  const budgetFromAttr = budgetAttr ? Number.parseFloat(budgetAttr) : NaN;
  const clipH = Number.isFinite(budgetFromAttr) && budgetFromAttr > 0
    ? budgetFromAttr
    : (bodyWin?.offsetHeight ?? 0);
  if (bodyWin) {
    const h = clipH;
    if (h > 0) {
      lock(bodyWin, {
        overflow: 'hidden',
        height: `${h}px`,
        'max-height': `${h}px`,
        position: 'relative',
      });
    }
  }
  if (bodyShift && bodyWin) {
    const h = clipH;
    if (h > 0) {
      lock(bodyShift, {
        overflow: 'hidden',
        'max-height': `${h}px`,
      });
    }
  }
  if (bodyInner && bodyWin) {
    const h = clipH;
    if (h > 0) {
      lock(bodyInner, {
        overflow: 'hidden',
        'max-height': `${h}px`,
      });
    }
  }

  sheet.querySelectorAll<HTMLElement>(
    '.cv-page-footer-band, .cv-footer-full-bleed, .cv-footer-bar-layout, .cv-footer-color-bar',
  ).forEach(el => {
    lock(el, {
      'flex-shrink': '0',
      visibility: 'visible',
      opacity: '1',
    });
  });

  /*
   * لا نضع margin-top:0 هنا — reflowCvSheetFooterForCapture يحسب القيمة الصحيحة
   * لإبقاء التذييل في أسفل الصفحة. الكتابة فوقها هنا كان يُشوّه موضع التذييل.
   */
  const footerWrap = frame?.querySelector<HTMLElement>(':scope > div:last-child');
  if (footerWrap?.querySelector('.cv-page-footer-band, .cv-footer-bar-layout, .cv-footer-full-bleed')) {
    lock(footerWrap, { 'flex-shrink': '0' });
  }

  return () => {
    for (const { el, key, value } of backups) {
      if (value) el.style.setProperty(key, value);
      else el.style.removeProperty(key);
    }
  };
}

/**
 * تخطيط QR ثابت عند التصدير — يمنع امتداد الباركود عرض الصفحة.
 *
 * html2canvas 1.4.1 يتجاهل gap على flex وعلى grid.
 * الحل:
 *   - grid: اضبط gap=0 وأضف padding-inline على الخلايا.
 *   - cell: اضبط gap=0 وأضف margin-bottom على الرابط (بدل gap بين الصورة والتسمية).
 */
export function applyQrLayoutForCapture(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('.cv-docs-qr-grid').forEach(grid => {
    const cols = grid.getAttribute('data-qr-cols') || '3';
    const colCount = parseInt(cols, 10) || 3;
    /* padding-inline على الخلايا يعطي مسافة أفقية بدلاً من column-gap المتجاهَل */
    const cellPadPx = colCount >= 4 ? 3 : 5;
    grid.setAttribute('data-cell-pad', String(cellPadPx));
    grid.style.setProperty('display', 'grid', 'important');
    grid.style.setProperty('grid-template-columns', `repeat(${cols}, minmax(0, 1fr))`, 'important');
    grid.style.setProperty('width', '100%', 'important');
    grid.style.setProperty('align-items', 'start', 'important');
    grid.style.setProperty('gap', '0', 'important');         /* أوقف gap المتجاهَل */
    grid.style.setProperty('column-gap', '0', 'important');
    grid.style.setProperty('row-gap', '0', 'important');
  });

  root.querySelectorAll<HTMLElement>('.cv-docs-qr-cell').forEach(cell => {
    const grid = cell.closest<HTMLElement>('.cv-docs-qr-grid');
    const padPx = Number(grid?.getAttribute('data-cell-pad') ?? 5);
    cell.style.setProperty('display', 'flex', 'important');
    cell.style.setProperty('flex-direction', 'column', 'important');
    cell.style.setProperty('align-items', 'center', 'important');
    cell.style.setProperty('min-width', '0', 'important');
    cell.style.setProperty('overflow', 'visible', 'important');  /* لا تقصّ التسمية */
    cell.style.setProperty('padding-inline', `${padPx}px`, 'important');
    cell.style.setProperty('padding-bottom', '6px', 'important');
    cell.style.setProperty('gap', '0', 'important');             /* أوقف gap المتجاهَل */
    cell.style.setProperty('text-align', 'center', 'important');
  });

  root.querySelectorAll<HTMLElement>('.cv-docs-qr-link').forEach(link => {
    link.style.setProperty('display', 'block', 'important');
    link.style.setProperty('width', 'fit-content', 'important');
    link.style.setProperty('max-width', '100%', 'important');
    link.style.setProperty('margin-inline', 'auto', 'important');
    /* استبدال gap:6px بين صورة QR والتسمية النصية */
    link.style.setProperty('margin-bottom', '6px', 'important');
  });

  root.querySelectorAll<HTMLElement>('.cv-docs-qr-caption').forEach(cap => {
    cap.style.setProperty('display', 'block', 'important');
    cap.style.setProperty('width', '100%', 'important');
    cap.style.setProperty('text-align', 'center', 'important');
    cap.style.setProperty('word-break', 'break-word', 'important');
    cap.style.setProperty('overflow-wrap', 'anywhere', 'important');
    cap.style.setProperty('white-space', 'normal', 'important');
  });

  root.querySelectorAll<HTMLImageElement>('.cv-docs-qr-img').forEach(img => {
    const attrW = Number(img.getAttribute('width')) || 68;
    const attrH = Number(img.getAttribute('height')) || attrW;
    const px = Math.max(40, Math.min(96, Math.round(Math.min(attrW, attrH))));
    img.style.setProperty('width', `${px}px`, 'important');
    img.style.setProperty('height', `${px}px`, 'important');
    img.style.setProperty('max-width', `${px}px`, 'important');
    img.style.setProperty('min-width', `${px}px`, 'important');
    img.style.setProperty('max-height', `${px}px`, 'important');
    img.style.setProperty('min-height', `${px}px`, 'important');
    img.style.setProperty('object-fit', 'contain', 'important');
    img.style.setProperty('display', 'block', 'important');
    img.style.setProperty('flex-shrink', '0', 'important');
    img.style.setProperty('margin-inline', 'auto', 'important');
  });
}

function blockTopInInner(el: HTMLElement, inner: HTMLElement): number {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== inner) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
    if (node && !inner.contains(node)) break;
  }
  return top;
}

/** هل الصفحة تحتوي محتوى مرئي داخل نافذة الجسم؟ */
export function sheetHasVisibleBodyContent(sheet: HTMLElement): boolean {
  const kind = sheet.getAttribute('data-cv-page-kind');
  if (kind === 'blank') return false;

  const bodyWin = sheet.querySelector<HTMLElement>('.cv-page-body-window');
  const bodyInner = sheet.querySelector<HTMLElement>('.cv-page-body-inner');
  if (!bodyWin || !bodyInner) return kind === 'pinned';

  const budget = Number(bodyWin.getAttribute('data-cv-body-budget'));
  if (!Number.isFinite(budget) || budget <= 0) return true;

  const shift = sheet.querySelector<HTMLElement>('.cv-page-body-shift');
  const offset = Number(shift?.getAttribute('data-cv-flow-offset') || 0);
  const winTop = offset;
  const winBottom = offset + budget;

  const nodes = bodyInner.querySelectorAll<HTMLElement>('.cv-block, .cv-docs-qr-block, .cv-col-l > .cv-item');
  for (const el of nodes) {
    const top = blockTopInInner(el, bodyInner);
    const bottom = top + el.offsetHeight;
    if (bottom > winTop + 2 && top < winBottom - 2) return true;
  }
  return false;
}

/**
 * إخفاء أقسام خارج نافذة الصفحة — html2canvas يتجاهل overflow أحياناً (جوال)
 * يمنع ظهور «إدخالات…» وأقسام الصفحة 2 على لقطة الصفحة 1
 */
export function hideFlowBlocksOutsideWindow(sheet: HTMLElement): () => void {
  const pageKind = sheet.getAttribute('data-cv-page-kind');
  if (pageKind === 'pinned' || pageKind === 'blank') return () => {};

  const bodyWin = sheet.querySelector<HTMLElement>('.cv-page-body-window');
  const bodyInner = sheet.querySelector<HTMLElement>('.cv-page-body-inner');
  if (!bodyWin || !bodyInner) return () => {};

  const budget = Number(bodyWin.getAttribute('data-cv-body-budget'));
  if (!Number.isFinite(budget) || budget <= 0) return () => {};

  const shift = sheet.querySelector<HTMLElement>('.cv-page-body-shift');
  const offset = Number(shift?.getAttribute('data-cv-flow-offset') || 0);
  const winTop = offset;
  const winBottom = offset + budget;

  type Backup = { el: HTMLElement; display: string };
  const restored: Backup[] = [];

  const nodes = bodyInner.querySelectorAll<HTMLElement>(
    '.cv-block, .cv-docs-qr-block, .cv-col-l > .cv-item',
  );
  nodes.forEach(el => {
    const top = blockTopInInner(el, bodyInner);
    const bottom = top + el.offsetHeight;
    if (bottom > winTop + 1 && top < winBottom - 1) return;
    restored.push({ el, display: el.style.display });
    el.style.setProperty('display', 'none', 'important');
  });

  return () => {
    restored.forEach(({ el, display }) => {
      if (display) el.style.setProperty('display', display);
      else el.style.removeProperty('display');
    });
  };
}

/**
 * إعادة تدفق التذييل ليبقى في أسفل الورقة.
 *
 * المشكلة: html2canvas لا يدعم `margin-top: auto` في flex containers.
 * في المعاينة التفاعلية يجعل margin-top:auto التذييل في أسفل الصفحة.
 * عند الالتقاط يجب استبدالها بـ margin-top: Npx محسوبة.
 *
 * المشكلة الثانية: .cv-footer-bar-layout يستخدم gap:5 (لا يدعمه html2canvas).
 * الحل: نضيف margin-bottom على .cv-footer-color-bar بدلاً من الـ gap.
 */
export function reflowCvSheetFooterForCapture(sheet: HTMLElement): void {
  const frame = sheet.querySelector<HTMLElement>('.cv-page-frame--paged');
  const headerWrap = frame?.querySelector<HTMLElement>(':scope > div:first-child');
  const bodyWin = sheet.querySelector<HTMLElement>('.cv-page-body-window');
  const footerWrap = frame?.querySelector<HTMLElement>(':scope > div:last-child');
  const footer = footerWrap?.querySelector<HTMLElement>(
    '.cv-page-footer-band, .cv-footer-bar-layout, .cv-footer-full-bleed',
  );
  if (!frame || !bodyWin || !footerWrap || !footer) return;

  /* تصحيح full-bleed: أزل الـ margin السالبة قبل القياس */
  sheet.querySelectorAll<HTMLElement>('.cv-footer-full-bleed').forEach(el => {
    el.style.setProperty('margin-inline', '0', 'important');
    el.style.setProperty('margin-bottom', '0', 'important');
    el.style.setProperty('margin-top', '0', 'important');
    el.style.setProperty('width', '100%', 'important');
  });

  frame.style.setProperty('display', 'flex', 'important');
  frame.style.setProperty('flex-direction', 'column', 'important');
  frame.style.setProperty('height', '100%', 'important');
  frame.style.setProperty('min-height', '100%', 'important');
  frame.style.setProperty('overflow', 'hidden', 'important');
  frame.style.setProperty('box-sizing', 'border-box', 'important');

  if (headerWrap) headerWrap.style.setProperty('flex-shrink', '0', 'important');
  footerWrap.style.setProperty('flex-shrink', '0', 'important');
  footer.style.setProperty('flex-shrink', '0', 'important');
  footer.style.setProperty('visibility', 'visible', 'important');
  footer.style.setProperty('opacity', '1', 'important');

  /*
   * إصلاح gap:5 داخل .cv-footer-bar-layout (بين الشريط اللوني والنص أسفله).
   * html2canvas يتجاهل gap على flex — نستبدله بـ margin-bottom على الشريط.
   */
  sheet.querySelectorAll<HTMLElement>('.cv-footer-bar-layout').forEach(barLayout => {
    barLayout.style.setProperty('gap', '0', 'important');
  });
  sheet.querySelectorAll<HTMLElement>('.cv-footer-color-bar').forEach(colorBar => {
    colorBar.style.setProperty('margin-bottom', '5px', 'important');
  });

  /* اقرأ أبعاد الإطار والترويسة والتذييل بعد إجبار إعادة الحساب */
  void sheet.offsetHeight;

  const frameInnerH = frame.clientHeight; /* ارتفاع الإطار بعد padding الورقة */
  const headerH = headerWrap?.offsetHeight ?? 0;
  const footerH = footerWrap.offsetHeight;

  /* احسب bodyH من data-cv-body-budget أو من القياس */
  const budgetAttr = bodyWin.getAttribute('data-cv-body-budget');
  const budgetFromAttr = budgetAttr ? Number.parseFloat(budgetAttr) : NaN;
  let bodyH = Number.isFinite(budgetFromAttr) && budgetFromAttr > 0
    ? budgetFromAttr
    : 0;
  if (bodyH <= 0) {
    bodyH = Math.max(80, frameInnerH - headerH - footerH);
  }

  /* اضبط ارتفاع نافذة المحتوى */
  bodyWin.style.setProperty('flex-shrink', '0', 'important');
  bodyWin.style.setProperty('height', `${bodyH}px`, 'important');
  bodyWin.style.setProperty('max-height', `${bodyH}px`, 'important');
  bodyWin.style.setProperty('overflow', 'hidden', 'important');
  bodyWin.style.setProperty('position', 'relative', 'important');

  /*
   * احسب المسافة المتبقية بين نهاية المحتوى ورأس التذييل.
   * هذا يحلّ محلّ margin-top:auto الذي لا يدعمه html2canvas.
   * المعادلة: gap = frame_inner_height - header - body - footer
   */
  const gap = Math.max(0, frameInnerH - headerH - bodyH - footerH);
  footerWrap.style.setProperty('margin-top', `${gap}px`, 'important');
}

/** html2canvas على الجوال لا يلتقط عناصر opacity≈0 — اجعل الورقة مرئية قبل اللقطة */
export function prepareSheetForCapture(sheet: HTMLElement): void {
  sheet.style.setProperty('opacity', '1', 'important');
  sheet.style.setProperty('visibility', 'visible', 'important');
  sheet.style.setProperty('filter', 'none', 'important');
  sheet.style.setProperty('-webkit-filter', 'none', 'important');
}

/** يمنع قصّ عرض 794px داخل شاشة الجوال أثناء اللقطة */
export function unlockPageOverflowForCapture(): () => void {
  const html = document.documentElement;
  const body = document.body;
  const saved = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    htmlWidth: html.style.width,
    bodyWidth: body.style.width,
  };
  html.style.setProperty('overflow', 'visible', 'important');
  body.style.setProperty('overflow', 'visible', 'important');
  html.style.setProperty('width', 'auto', 'important');
  body.style.setProperty('width', 'auto', 'important');
  return () => {
    if (saved.htmlOverflow) html.style.overflow = saved.htmlOverflow;
    else html.style.removeProperty('overflow');
    if (saved.bodyOverflow) body.style.overflow = saved.bodyOverflow;
    else body.style.removeProperty('overflow');
    if (saved.htmlWidth) html.style.width = saved.htmlWidth;
    else html.style.removeProperty('width');
    if (saved.bodyWidth) body.style.width = saved.bodyWidth;
    else body.style.removeProperty('width');
  };
}

/** حاوية التقاط خارج الشاشة — عرض A4 كامل بدون قصّ viewport الجوال */
export function mountSheetInCaptureViewport(
  sheet: HTMLElement,
  widthPx: number,
  heightPx: number,
): () => void {
  const viewport = mountExportCaptureShell(widthPx, heightPx);
  viewport.style.setProperty('left', '-12000px', 'important');
  viewport.style.setProperty('top', '0', 'important');
  viewport.style.setProperty('opacity', '1', 'important');
  viewport.style.setProperty('visibility', 'visible', 'important');
  viewport.style.setProperty('overflow', 'hidden', 'important');
  viewport.style.setProperty('z-index', '-1', 'important');

  const parent = sheet.parentNode;
  const next = sheet.nextSibling;
  prepareSheetForCapture(sheet);
  viewport.appendChild(sheet);
  document.body.appendChild(viewport);

  return () => {
    if (parent) {
      if (next) parent.insertBefore(sheet, next);
      else parent.appendChild(sheet);
    }
    viewport.remove();
  };
}

/** @deprecated */
export function fitSheetFooterForCapture(sheet: HTMLElement): () => void {
  reflowCvSheetFooterForCapture(sheet);
  return () => {};
}

/** فئات تحمي التصدير من قواعد الجوال (max-width:100vw و a4-page:100%) */
export const CV_EXPORT_SHELL_CLASS =
  'plant-report-export-capture-viewport plant-report-export-capture plant-report-export-host cv-export-offscreen';

export function mountExportCaptureShell(widthPx: number, heightPx?: number): HTMLDivElement {
  const viewport = document.createElement('div');
  viewport.className = CV_EXPORT_SHELL_CLASS;
  viewport.setAttribute('aria-hidden', 'true');
  const h = heightPx && heightPx > 0 ? `height:${heightPx}px;` : '';
  viewport.style.cssText = [
    'position:fixed',
    'left:-12000px',
    'top:0',
    `width:${widthPx}px`,
    'max-width:none',
    `min-width:${widthPx}px`,
    h,
    'overflow:hidden',
    'background:#fff',
    'opacity:1',
    'pointer-events:none',
    'z-index:-1',
    'box-sizing:border-box',
  ].join(';');
  return viewport;
}

/** قفل أبعاد A4 داخل عقدة التصدير — يتجاوز media queries على الجوال */
export function lockCvExportDimensions(root: HTMLElement, widthPx = CV_EXPORT_PX, sheetHeightPx?: number): void {
  root.classList.add(
    'plant-report-export-capture-root',
    'cv-export-capturing',
    'plant-report-export-host',
    'cv-export-offscreen',
  );
  root.style.setProperty('width', `${widthPx}px`, 'important');
  root.style.setProperty('max-width', 'none', 'important');
  root.style.setProperty('min-width', `${widthPx}px`, 'important');
  root.style.setProperty('box-sizing', 'border-box', 'important');

  const sheetSel = '.cv-a4-sheet, .a4-page.cvx-preview-a4-full, .a4-page.cvx-preview-a4';
  root.querySelectorAll<HTMLElement>(sheetSel).forEach(sheet => {
    sheet.style.setProperty('width', `${widthPx}px`, 'important');
    sheet.style.setProperty('max-width', 'none', 'important');
    sheet.style.setProperty('min-width', `${widthPx}px`, 'important');
    sheet.style.setProperty('box-sizing', 'border-box', 'important');
    if (sheetHeightPx && sheetHeightPx > 0) {
      sheet.style.setProperty('height', `${sheetHeightPx}px`, 'important');
      sheet.style.setProperty('min-height', `${sheetHeightPx}px`, 'important');
      sheet.style.setProperty('max-height', `${sheetHeightPx}px`, 'important');
    }
  });

  root.querySelectorAll<HTMLElement>('.cv-two-col').forEach(col => {
    col.style.setProperty('grid-template-columns', '1fr 2fr', 'important');
    col.style.setProperty('display', 'grid', 'important');
  });
}
