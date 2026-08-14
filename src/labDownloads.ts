/**
 * تنزيلات مختبر الأكواد — Blob + ObjectURL (يعمل خارج وداخل iframe مع allow-downloads)
 */

export const LAB_IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-downloads allow-modals';

/** تنزيل أي بيانات كملف عبر Blob و ObjectURL */
export function downloadViaBlob(
  data: BlobPart | BlobPart[],
  filename: string,
  mime = 'application/octet-stream',
): void {
  const parts = Array.isArray(data) ? data : [data];
  const blob = data instanceof Blob ? data : new Blob(parts, { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // تأخير الإبطال حتى يبدأ المتصفح التحميل
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

export function safeFilename(name: string, ext: string): string {
  const base = (name || 'project')
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80)
    .replace(/_+$/, '') || 'project';
  const e = ext.replace(/^\./, '');
  return base.toLowerCase().endsWith(`.${e.toLowerCase()}`) ? base : `${base}.${e}`;
}

/** مستند HTML مستقل يعمل خارج الموقع للتجربة */
export function buildStandaloneLabHtml(
  html: string,
  css: string,
  js = '',
  title = 'Lab Project',
): string {
  const safeTitle = String(title || 'Lab Project')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet" />
<style>
*, *::before, *::after { box-sizing: border-box; }
body { font-family: 'Tajawal', system-ui, sans-serif; margin: 0; padding: 16px; }
${css || ''}
</style>
</head>
<body>
${html || ''}
${js ? `<script>\n${js}\n</script>` : ''}
</body>
</html>`;
}

export function downloadLabAsHtml(html: string, css: string, js: string, title: string): void {
  const doc = buildStandaloneLabHtml(html, css, js, title);
  downloadViaBlob(doc, safeFilename(title, 'html'), 'text/html;charset=utf-8');
}

/** يفتح المشروع في تبويب جديد كملف مستقل */
export function openLabStandalone(html: string, css: string, js: string, title: string): void {
  const doc = buildStandaloneLabHtml(html, css, js, title);
  const blob = new Blob([doc], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    downloadViaBlob(blob, safeFilename(title, 'html'), 'text/html;charset=utf-8');
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

declare global {
  interface Window {
    html2pdf?: any;
  }
}

/** تصدير PDF من عنصر أو من كود المختبر عبر html2pdf + useCORS */
export async function downloadLabAsPdf(opts: {
  element?: HTMLElement | null;
  html?: string;
  css?: string;
  js?: string;
  title: string;
  filename?: string;
}): Promise<void> {
  const filename = opts.filename || safeFilename(opts.title, 'pdf');
  let host: HTMLElement | null = opts.element || null;
  let created = false;

  // عناصر داخل iframe — نستنسخها للصفحة الأم لضمان html2canvas + CORS
  if (host && host.ownerDocument !== document) {
    const cloneHost = document.createElement('div');
    cloneHost.setAttribute('data-lab-pdf-export', '1');
    cloneHost.style.cssText =
      'position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;pointer-events:none;';
    const styles = Array.from(host.ownerDocument.querySelectorAll('style'))
      .map((s) => s.textContent || '')
      .join('\n');
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    cloneHost.appendChild(styleEl);
    const wrap = document.createElement('div');
    wrap.innerHTML = host.innerHTML;
    // إخفاء علامة مائية الموقع في التصدير إن وُجدت
    wrap.querySelectorAll('.___wm').forEach((n) => n.remove());
    cloneHost.appendChild(wrap);
    document.body.appendChild(cloneHost);
    host = cloneHost;
    created = true;
    await new Promise((r) => setTimeout(r, 150));
  }

  if (!host) {
    const doc = buildStandaloneLabHtml(opts.html || '', opts.css || '', opts.js || '', opts.title);
    host = document.createElement('div');
    host.setAttribute('data-lab-pdf-export', '1');
    host.style.cssText =
      'position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;pointer-events:none;';
    host.innerHTML = doc;
    // إن كان المستند كاملاً، استخرج body فقط للالتقاط
    const parsed = new DOMParser().parseFromString(doc, 'text/html');
    host.innerHTML = '';
    const style = document.createElement('style');
    style.textContent = `
      *,*::before,*::after{box-sizing:border-box;}
      body,div[data-lab-pdf-inner]{font-family:'Tajawal',system-ui,sans-serif;margin:0;padding:16px;direction:rtl;}
      ${opts.css || ''}
    `;
    const inner = document.createElement('div');
    inner.setAttribute('data-lab-pdf-inner', '1');
    inner.innerHTML = parsed.body.innerHTML;
    host.appendChild(style);
    host.appendChild(inner);
    document.body.appendChild(host);
    created = true;
    // انتظر الخطوط/الصور إن وُجدت
    await new Promise((r) => setTimeout(r, 120));
  }

  try {
    const html2pdf = window.html2pdf;
    if (!html2pdf) {
      // fallback طباعة
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(buildStandaloneLabHtml(opts.html || '', opts.css || '', opts.js || '', opts.title));
        w.document.close();
        w.focus();
        w.print();
      } else {
        throw new Error('html2pdf unavailable');
      }
      return;
    }

    const opt = {
      margin: 10,
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    };

    const worker = html2pdf().set(opt).from(host);
    // html2pdf 0.10: outputPdf('blob') — وإلا save() مباشرة ثم Blob يدوي إن أمكن
    try {
      if (typeof worker.outputPdf === 'function') {
        const blob = await worker.outputPdf('blob');
        if (blob instanceof Blob) {
          downloadViaBlob(blob, filename, 'application/pdf');
          return;
        }
      }
    } catch { /* fallback below */ }

    try {
      const blob = await worker.output('blob');
      if (blob instanceof Blob) {
        downloadViaBlob(blob, filename, 'application/pdf');
        return;
      }
    } catch { /* fallback below */ }

    await html2pdf().set(opt).from(host).save();
  } finally {
    if (created && host?.parentNode) host.parentNode.removeChild(host);
  }
}

/**
 * سكربت يُحقن داخل معاينة المختبر:
 * - يوفّر تنزيل Blob آمن
 * - يضيف useCORS لإعدادات html2pdf تلقائياً
 * - يُبلّغ الصفحة الأم عند طلب تنزيل يحتاج وساطة
 */
export function labPreviewDownloadBridgeScript(): string {
  return `
(function(){
  if (window.__labDlReady) return;
  window.__labDlReady = true;

  function downloadViaBlob(data, filename, mime) {
    try {
      var blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename || 'download';
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function(){ try { URL.revokeObjectURL(url); } catch(e){} }, 2500);
      return true;
    } catch (err) {
      try {
        parent.postMessage({ type: 'lab-download-blob', filename: filename || 'download', mime: mime || 'application/octet-stream', data: String(data) }, '*');
      } catch (e2) {}
      return false;
    }
  }
  window.__labDownload = downloadViaBlob;

  function mergeCors(opt) {
    opt = opt || {};
    opt.html2canvas = Object.assign({ scale: 2, useCORS: true, allowTaint: false, logging: false }, opt.html2canvas || {}, { useCORS: true });
    if (!opt.image) opt.image = { type: 'jpeg', quality: 0.98 };
    return opt;
  }

  function patchHtml2Pdf() {
    if (!window.html2pdf || window.html2pdf.__labPatched) return;
    var orig = window.html2pdf;
    function wrapped() {
      var w = orig.apply(this, arguments);
      if (w && typeof w.set === 'function') {
        var _set = w.set.bind(w);
        w.set = function(opt) { return _set(mergeCors(opt)); };
      }
      return w;
    }
    wrapped.__labPatched = true;
    try {
      Object.keys(orig).forEach(function(k){ try { wrapped[k] = orig[k]; } catch(e){} });
    } catch(e) {}
    window.html2pdf = wrapped;
  }

  patchHtml2Pdf();
  var n = 0;
  var t = setInterval(function(){
    patchHtml2Pdf();
    if (++n > 40) clearInterval(t);
  }, 250);

  // اعتراض روابط تنزيل ملفّات data: / blob:
  document.addEventListener('click', function(ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[download]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('blob:') === 0 || href.indexOf('data:') === 0) return; // المتصفح يتعامل معها مع allow-downloads
  }, true);
})();
`;
}

/** تخمين نوع المعاينة (جوال vs سطح مكتب) من HTML/CSS */
export function detectLabPreviewDevice(html: string, css: string): 'desktop' | 'mobile' {
  const combined = `${html}\n${css}`.toLowerCase();
  let mobile = 0;
  let desktop = 0;

  if (/viewport[^>]*device-width/i.test(combined)) mobile += 3;
  if (/safe-area-inset|env\(safe-area/i.test(combined)) mobile += 2;
  if (/bottom-nav|bottomnav|tab-bar|tabbar|mobile-nav/i.test(combined)) mobile += 2;
  if (/@media\s*\(\s*max-width\s*:\s*(3[0-9]{2}|4[0-3][0-9]|480|640|768)/i.test(css)) mobile += 2;
  if (/max-width\s*:\s*(3[0-9]{2}|4[0-2][0-9])px/i.test(css)) mobile += 2;
  if (/width\s*:\s*100vw/i.test(css) && !/max-width/i.test(css)) desktop += 1;
  if (/@media\s*\(\s*min-width/i.test(css)) desktop += 1;
  if (/grid-template-columns\s*:\s*repeat\s*\(\s*[3-9]/i.test(css)) desktop += 2;
  if (/min-width\s*:\s*(9[0-9]{2}|1[0-9]{3})px/i.test(css)) desktop += 2;

  return mobile > desktop ? 'mobile' : 'desktop';
}

/** بناء srcdoc للمعاينة الحية مع جسور التنزيل و html2pdf + useCORS */
export function buildLabPreviewSrcdoc(html: string, css: string, js = ''): string {
  const bridge = labPreviewDownloadBridgeScript();
  return `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; img-src * data: blob:; font-src * data:; style-src * 'unsafe-inline'; script-src * 'unsafe-inline' 'unsafe-eval' blob:;">
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"><\/script>
<style>*,*::before,*::after{box-sizing:border-box;}body{font-family:'Tajawal',sans-serif;padding:14px;padding-bottom:36px;margin:0;}
${css || ''}
.___wm{position:fixed;bottom:0;left:0;right:0;background:rgba(0,51,102,0.07);text-align:center;padding:4px 0;font-size:10px;color:#003366;font-weight:700;letter-spacing:0.5px;font-family:'Courier New',monospace;border-top:1px solid rgba(0,51,102,0.1);z-index:9999;}
</style></head><body>
${html || ''}
<div class="___wm">eng-alaa.com</div>
<script>${bridge}<\/script>
${js ? `<script>${js}<\/script>` : ''}
</body></html>`;
}
