import { driveDownloadUrl, isGoogleDriveUrl } from './mediaUrl';
import type { CvDoc, LangKey } from './appData';

export function getCvPdfUrl(doc: CvDoc, lang: LangKey): string | null {
  const pf = doc.pdfFiles;
  if (!pf) return null;
  const url = pf[lang];
  if (!url || !url.trim()) return null;
  const u = url.trim();
  if (u.startsWith('blob:')) return null;
  return u;
}

export type CvPdfSourceKind = 'auto' | 'drive' | 'upload';

export function cvPdfSourceKind(doc: CvDoc, lang: LangKey): CvPdfSourceKind {
  const url = getCvPdfUrl(doc, lang);
  if (!url) return 'auto';
  if (isGoogleDriveUrl(url)) return 'drive';
  return 'upload';
}

export function resolveCvPdfFetchUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (isGoogleDriveUrl(u)) return driveDownloadUrl(u);
  return u;
}

export type CvPdfPreviewLabels = {
  title: string;
  save: string;
  close: string;
  hint: string;
};

const DEFAULT_PREVIEW_LABELS: CvPdfPreviewLabels = {
  title: 'معاينة السيرة الذاتية',
  save: 'حفظ كملف PDF',
  close: 'إغلاق',
  hint: 'راجع المعاينة ثم اضغط «حفظ كملف PDF»',
};

export function cvPdfPreviewLabels(lang: 'ar' | 'en' | 'de'): CvPdfPreviewLabels {
  if (lang === 'en') {
    return {
      title: 'CV preview',
      save: 'Save as PDF',
      close: 'Close',
      hint: 'Review the preview, then tap «Save as PDF»',
    };
  }
  if (lang === 'de') {
    return {
      title: 'Lebenslauf-Vorschau',
      save: 'Als PDF speichern',
      close: 'Schließen',
      hint: 'Vorschau prüfen, dann «Als PDF speichern»',
    };
  }
  return DEFAULT_PREVIEW_LABELS;
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const name = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

/** تنزيل مباشر — بدون مشاركة WhatsApp */
export function downloadCvPdfBlob(blob: Blob, fileName: string): void {
  triggerBlobDownload(blob, fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
}

/** معاينة PDF ثم زر حفظ — للكمبيوتر والجوال */
export function showCvPdfPreview(
  blob: Blob,
  fileName: string,
  labels: CvPdfPreviewLabels = DEFAULT_PREVIEW_LABELS,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const name = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    const url = URL.createObjectURL(blob);

    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:13000',
      'background:rgba(0,0,0,0.82)', 'display:flex',
      'flex-direction:column', 'align-items:stretch',
      'padding:12px', 'box-sizing:border-box',
      "font-family:'Tajawal','Segoe UI',Arial,sans-serif",
    ].join(';');

    const panel = document.createElement('div');
    panel.style.cssText = [
      'flex:1', 'display:flex', 'flex-direction:column',
      'max-width:900px', 'width:100%', 'margin:0 auto',
      'background:#0c1628', 'border-radius:14px',
      'border:1px solid rgba(120,160,255,0.28)',
      'overflow:hidden', 'min-height:0',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid rgba(120,160,255,0.2);';

    const title = document.createElement('div');
    title.textContent = labels.title;
    title.style.cssText = 'color:#e8f0ff;font-weight:800;font-size:16px;';

    const hint = document.createElement('div');
    hint.textContent = labels.hint;
    hint.style.cssText = 'width:100%;color:rgba(200,215,240,0.8);font-size:12px;line-height:1.5;';

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-shrink:0;';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.textContent = labels.save;
    saveBtn.style.cssText = 'background:#003366;color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:700;font-size:13px;cursor:pointer;';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = labels.close;
    closeBtn.style.cssText = 'background:rgba(255,255,255,0.1);color:#e8f0ff;border:1px solid rgba(120,160,255,0.3);border-radius:8px;padding:10px 14px;font-size:13px;cursor:pointer;';

    const frameWrap = document.createElement('div');
    frameWrap.style.cssText = 'flex:1;min-height:0;background:#fff;';

    const iframe = document.createElement('iframe');
    iframe.title = labels.title;
    iframe.src = url;
    iframe.style.cssText = 'width:100%;height:100%;min-height:50vh;border:0;display:block;';

    const cleanup = () => {
      overlay.remove();
      URL.revokeObjectURL(url);
    };

    const close = () => {
      cleanup();
      resolve();
    };

    saveBtn.onclick = () => {
      triggerBlobDownload(blob, name);
    };
    closeBtn.onclick = close;
    overlay.addEventListener('click', e => {
      if (e.target === overlay) close();
    });

    actions.append(saveBtn, closeBtn);
    header.append(title, actions, hint);
    frameWrap.appendChild(iframe);
    panel.append(header, frameWrap);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    iframe.onerror = () => {
      cleanup();
      reject(new Error('تعذّر عرض معاينة PDF'));
    };
  });
}

/** @deprecated — استخدم showCvPdfPreview */
export function printCvPdfBlob(blob: Blob): Promise<void> {
  return showCvPdfPreview(blob, 'cv.pdf');
}

export async function downloadCvPdfFile(url: string, fileName: string): Promise<void> {
  let fetchUrl = resolveCvPdfFetchUrl(url.trim());
  if (fetchUrl.startsWith('blob:') || fetchUrl.startsWith('data:') || /^https?:\/\//i.test(fetchUrl)) {
    /* absolute */
  } else if (fetchUrl.startsWith('/')) {
    /* root-relative */
  } else {
    fetchUrl = `./${fetchUrl.replace(/^\.\//, '')}`;
  }

  if (fetchUrl.startsWith('data:')) {
    const res = await fetch(fetchUrl);
    triggerBlobDownload(await res.blob(), fileName);
    return;
  }

  if (fetchUrl.startsWith('blob:')) {
    const res = await fetch(fetchUrl);
    triggerBlobDownload(await res.blob(), fileName);
    return;
  }

  try {
    const res = await fetch(fetchUrl, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    if (!blob.size || blob.type.includes('text/html')) {
      throw new Error('Invalid PDF response');
    }
    triggerBlobDownload(blob, fileName);
  } catch (err) {
    throw err instanceof Error ? err : new Error('PDF fetch failed');
  }
}
