import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AppData, CustomerReport, LangKey, pickML, pickReportML } from './appData';
import { CustomerReportDoc } from './CustomerReports';
import { ReportShareOverlay } from './AppPicker';
import {
  captureReportSnapshot,
  snapshotDataUrlToPdfBlob,
  waitForImages,
  rasterizeReportImagesForCapture,
} from './plantReportPdfExport';
import { exportLibsReady } from './pdfCaptureLibs';

const A4_W = 794;
const PDF_ENDPOINT = '/generate_report.php';

const LABELS = {
  ar: {
    close: 'إغلاق', save: 'حفظ PDF', share: 'مشاركة', print: 'طباعة',
    preparing: 'جاري التحضير…', shareTitle: 'مشاركة التقرير PDF',
  },
  en: {
    close: 'Close', save: 'Save PDF', share: 'Share', print: 'Print',
    preparing: 'Preparing…', shareTitle: 'Share report PDF',
  },
  de: {
    close: 'Schließen', save: 'PDF speichern', share: 'Teilen', print: 'Drucken',
    preparing: 'Wird vorbereitet…', shareTitle: 'Bericht-PDF teilen',
  },
};

export function parseCustomerReportUrl(url: string): string | null {
  const u = (url || '').trim();
  const m = u.match(/^customer-report:(.+)$/i);
  return m?.[1]?.trim() || null;
}

async function parsePdfResponse(res: Response): Promise<{ ok: boolean; pdf_base64?: string; file_url?: string; error?: string }> {
  const raw = await res.text();
  try {
    return JSON.parse(raw) as { ok: boolean; pdf_base64?: string; file_url?: string; error?: string };
  } catch {
    throw new Error('Invalid PDF response');
  }
}

function absUrl(src: string): string {
  const s = (src || '').trim();
  if (!s || s.startsWith('data:') || s.startsWith('blob:')) return s;
  try {
    return new URL(s, window.location.href).href;
  } catch {
    return s;
  }
}

function imgProxyUrl(src: string): string {
  const base = typeof window !== 'undefined' && window.location.pathname.includes('/api/')
    ? '../api/img-proxy.php'
    : '/api/img-proxy.php';
  return `${base}?url=${encodeURIComponent(src)}`;
}

async function rasterizeImgEl(img: HTMLImageElement): Promise<void> {
  const raw = img.getAttribute('src') || img.src || '';
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:')) return;
  const candidates = [absUrl(raw)];
  if (/^https?:\/\//i.test(raw) || /^https?:\/\//i.test(candidates[0])) {
    candidates.push(imgProxyUrl(candidates[0]));
  }
  for (const url of candidates) {
    try {
      const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('img'));
        i.src = url;
      });
      if (!loaded.naturalWidth) continue;
      const c = document.createElement('canvas');
      c.width = loaded.naturalWidth;
      c.height = loaded.naturalHeight;
      const ctx = c.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(loaded, 0, 0);
      img.src = c.toDataURL('image/png');
      img.style.visibility = 'visible';
      img.style.opacity = '1';
      return;
    } catch { /* try next */ }
  }
}

/** حوّل SVG الشعار إلى صورة حتى يظهر في لقطة PDF */
async function rasterizeInlineSvgs(root: HTMLElement): Promise<void> {
  const svgs = [...root.querySelectorAll('svg')];
  await Promise.all(svgs.map(async (svg) => {
    try {
      const xml = new XMLSerializer().serializeToString(svg);
      const svg64 = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
      const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('svg'));
        i.src = svg64;
      });
      const w = Math.max(loaded.naturalWidth || 116, svg.clientWidth || 58);
      const h = Math.max(loaded.naturalHeight || 116, svg.clientHeight || 58);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(loaded, 0, 0, w, h);
      const img = document.createElement('img');
      img.src = c.toDataURL('image/png');
      img.alt = 'logo';
      img.className = 'soil-report-header-logo';
      img.style.height = `${svg.getAttribute('height') || svg.clientHeight || 58}px`;
      img.style.width = 'auto';
      img.style.objectFit = 'contain';
      img.style.flexShrink = '0';
      img.style.display = 'inline-block';
      svg.replaceWith(img);
    } catch { /* keep svg */ }
  }));
}

/** تجهيز HTML الطباعة — صور مطلقة بدون transform */
function buildPrintHtml(el: HTMLElement, lang: LangKey, title: string, themeColor: string, footer: string): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src') || '';
    if (src) img.setAttribute('src', absUrl(src));
  });
  clone.style.transform = 'none';
  clone.style.width = `${A4_W}px`;
  clone.style.maxWidth = '100%';
  clone.style.margin = '0 auto';
  clone.style.boxShadow = 'none';
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  return `<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <title>${title.replace(/[<>&"]/g, '')}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;900&display=swap');
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #fff; font-family: Tajawal, Arial, sans-serif; }
    .print-sheet { width: ${A4_W}px; max-width: 100%; margin: 0 auto; background: #fff; }
    table { width: 100%; border-collapse: collapse; }
    img { max-width: 100%; page-break-inside: avoid; }
    tr, .pdf-section { page-break-inside: avoid; break-inside: avoid; }
    @page { size: A4 portrait; margin: 10mm 10mm 12mm 10mm; }
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>
  <div class="print-sheet">${clone.outerHTML}</div>
  ${footer ? `<div style="text-align:center;font-size:9pt;color:#888;margin-top:8px;border-top:1px solid ${themeColor};padding-top:6px">${footer.replace(/[<>]/g, '')}</div>` : ''}
  <script>
    window.onload = function () {
      Promise.resolve(document.fonts && document.fonts.ready).catch(function(){}).then(function(){
        setTimeout(function(){ window.print(); }, 500);
      });
    };
  </script>
</body>
</html>`;
}

/** عارض تقرير تربة — معاينة A4 + طباعة/PDF بنفس شكل الورقة */
export function SoilReportA4Viewer({
  data,
  report,
  onClose,
  initialLang = 'ar',
}: {
  data: AppData;
  report: CustomerReport;
  onClose: () => void;
  initialLang?: LangKey;
}) {
  const [lang, setLang] = useState<LangKey>(initialLang);
  const wrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const exportSourceRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [natH, setNatH] = useState(0);
  const [exportBusy, setExportBusy] = useState(false);
  const [shareModal, setShareModal] = useState<{ blobUrl: string; fileName: string; serverUrl: string } | null>(null);
  const L = LABELS[lang];
  const title = `${pickReportML(report.plantName, lang)} — ${pickReportML(report.customerName, lang)}`;
  const pageBg = data.reportTemplate?.pageBgColor || '#fff';
  const themeColor = (data.reportTemplate?.themeColor || '#2a7a2a').trim();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    let ro: ResizeObserver | null = null;
    const measure = () => {
      const wrap = wrapRef.current;
      const content = contentRef.current;
      if (!wrap || !content) return;
      const avail = Math.max(280, wrap.clientWidth - 16);
      const s = Math.min(1, Math.max(0.35, avail / A4_W));
      const h = content.scrollHeight;
      setScale(s);
      setNatH(h);
    };
    const raf = requestAnimationFrame(() => {
      measure();
      if (wrapRef.current) {
        ro = new ResizeObserver(measure);
        ro.observe(wrapRef.current);
      }
    });
    const t1 = window.setTimeout(measure, 350);
    const t2 = window.setTimeout(measure, 1000);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [lang, report.id]);

  function getPrintRoot(): HTMLElement | null {
    return exportSourceRef.current?.querySelector('.soil-report-print-root') as HTMLElement | null;
  }

  async function printReport() {
    const el = getPrintRoot();
    if (!el) {
      alert(lang === 'ar' ? 'التقرير غير جاهز للطباعة' : 'Report not ready');
      return;
    }
    try {
      await waitForImages(el);
      await rasterizeInlineSvgs(el);
      await Promise.all([...el.querySelectorAll('img')].map(img => rasterizeImgEl(img).catch(() => undefined)));
    } catch { /* */ }
    const footer = pickML(data.reportTemplate?.footerText, lang) || '';
    const html = buildPrintHtml(el, lang, title, themeColor, footer);
    const win = window.open('', '_blank', 'width=900,height=750,menubar=yes,toolbar=yes');
    if (!win) {
      alert(lang === 'ar' ? 'اسمح بالنوافذ المنبثقة للطباعة' : 'Allow pop-ups to print');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  async function buildPdfBlob(): Promise<{ blob: Blob; fileName: string; serverUrl: string }> {
    const el = getPrintRoot();
    if (!el) throw new Error(lang === 'ar' ? 'التقرير غير جاهز' : 'Report not ready');
    if (!exportLibsReady()) throw new Error(lang === 'ar' ? 'مكتبة PDF غير محمّلة' : 'PDF library not loaded');

    await waitForImages(el);
    await rasterizeInlineSvgs(el);
    await Promise.all([...el.querySelectorAll('img')].map(img => rasterizeImgEl(img).catch(() => undefined)));
    await rasterizeReportImagesForCapture(el).catch(() => undefined);
    const reportSnapshot = await captureReportSnapshot(el);
    const safeName = (pickReportML(report.customerName, lang) || 'soil-report')
      .replace(/[^\w\u0600-\u06FF-]+/g, '_')
      .slice(0, 40);
    const fileName = `Soil_Report_${safeName}_${lang}.pdf`;

    try {
      const res = await fetch(PDF_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang,
          reportSnapshot,
          fileName,
          pageBgColor: pageBg,
        }),
      });
      const json = await parsePdfResponse(res);
      if (res.ok && json.ok && json.pdf_base64) {
        const byteStr = atob(json.pdf_base64);
        const bytes = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
        return {
          blob: new Blob([bytes], { type: 'application/pdf' }),
          fileName,
          serverUrl: json.file_url || '',
        };
      }
    } catch { /* fallback client-side */ }

    const blob = await snapshotDataUrlToPdfBlob(reportSnapshot);
    return { blob, fileName, serverUrl: '' };
  }

  async function savePdf() {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const { blob, fileName } = await buildPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setExportBusy(false);
    }
  }

  async function sharePdf() {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const { blob, fileName, serverUrl } = await buildPdfBlob();
      const blobUrl = URL.createObjectURL(blob);
      const file = new File([blob], fileName, { type: 'application/pdf' });
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title, files: [file] });
          URL.revokeObjectURL(blobUrl);
          return;
        }
      } catch { /* open modal */ }
      setShareModal({ blobUrl, fileName, serverUrl });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setExportBusy(false);
    }
  }

  function closeShareModal() {
    if (shareModal?.blobUrl) URL.revokeObjectURL(shareModal.blobUrl);
    setShareModal(null);
  }

  const softBtn: CSSProperties = {
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    borderRadius: 999,
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    whiteSpace: 'nowrap',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(6, 14, 22, 0.92)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="soil-a4-toolbar" style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        flexWrap: 'wrap',
        padding: '8px 10px',
        background: 'rgba(8, 20, 32, 0.98)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{
          fontSize: 11.5, fontWeight: 800, color: '#e8f4ff',
          maxWidth: '34%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <i className="fa-solid fa-file-pdf" style={{ marginInlineEnd: 5 }} />
          {title}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {([
            ['ar', 'العربية'],
            ['en', 'EN'],
            ['de', 'DE'],
          ] as const).map(([code, label]) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              style={{
                ...softBtn,
                background: lang === code ? '#2a7a2a' : softBtn.background,
                borderColor: lang === code ? '#2a7a2a' : 'rgba(255,255,255,0.2)',
              }}
            >
              {label}
            </button>
          ))}
          <button type="button" onClick={onClose} style={{ ...softBtn, background: 'rgba(220,80,80,0.28)', borderColor: 'rgba(255,160,160,0.35)' }}>
            <i className="fa-solid fa-xmark" /> {L.close}
          </button>
        </div>
      </div>

      <div
        className="soil-a4-scroll"
        style={{
          flex: 1,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '10px 8px 8px',
          paddingBottom: 8,
        }}
      >
        <div
          ref={wrapRef}
          className="soil-report-preview-wrap"
          style={{
            background: pageBg,
            padding: 8,
            overflow: 'hidden',
            borderRadius: 12,
            direction: 'ltr',
            maxWidth: 820,
            margin: '0 auto',
          }}
        >
          <div
            ref={contentRef}
            className="soil-report-scale-wrapper season-report-scale-wrapper"
            style={{
              width: A4_W,
              transformOrigin: '0 0',
              transform: `scale(${scale || 0.01})`,
              marginBottom: natH > 0 && scale > 0 ? Math.round(natH * (scale - 1)) : 0,
              boxShadow: '0 8px 28px rgba(0, 40, 80, 0.28)',
              opacity: scale > 0 ? 1 : 0,
              background: '#fff',
            }}
          >
            <CustomerReportDoc data={data} report={report} lang={lang} forExport />
          </div>
        </div>

        <div className="soil-a4-actions" style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'center',
          flexWrap: 'wrap',
          marginTop: 12,
          marginBottom: 78,
          padding: '0 8px',
        }}>
          <button
            type="button"
            onClick={() => void printReport()}
            disabled={exportBusy}
            className="season-report-btn season-report-btn--print"
            style={{ flex: '1 1 120px', maxWidth: 180, minHeight: 40, fontSize: 13, padding: '8px 12px', borderRadius: 12 }}
          >
            <i className="fa-solid fa-print" /> {L.print}
          </button>
          <button
            type="button"
            onClick={() => void savePdf()}
            disabled={exportBusy}
            className="season-report-btn season-report-btn--share"
            style={{ flex: '1 1 120px', maxWidth: 180, minHeight: 40, fontSize: 13, padding: '8px 12px', borderRadius: 12, opacity: exportBusy ? 0.65 : 1 }}
          >
            {exportBusy
              ? <><i className="fa-solid fa-spinner fa-spin" /> {L.preparing}</>
              : <><i className="fa-solid fa-download" /> {L.save}</>}
          </button>
          <button
            type="button"
            onClick={() => void sharePdf()}
            disabled={exportBusy}
            className="season-report-btn season-report-btn--share"
            style={{ flex: '1 1 120px', maxWidth: 180, minHeight: 40, fontSize: 13, padding: '8px 12px', borderRadius: 12, background: '#1a3a5c', opacity: exportBusy ? 0.65 : 1 }}
          >
            {exportBusy
              ? <><i className="fa-solid fa-spinner fa-spin" /> {L.preparing}</>
              : <><i className="fa-solid fa-share-nodes" /> {L.share}</>}
          </button>
        </div>
      </div>

      {/* مصدر الطباعة/PDF — كامل الحجم خارج الشاشة (ليس display:none) */}
      <div
        ref={exportSourceRef}
        aria-hidden
        style={{
          position: 'fixed',
          left: '-12000px',
          top: 0,
          width: A4_W,
          pointerEvents: 'none',
          visibility: 'hidden',
          overflow: 'visible',
          zIndex: -1,
        }}
      >
        <div style={{ width: A4_W, background: '#fff' }}>
          <CustomerReportDoc data={data} report={report} lang={lang} forExport />
        </div>
      </div>

      {shareModal && (
        <ReportShareOverlay open onClose={closeShareModal}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#003366' }}>
              <i className="fa-solid fa-file-pdf" style={{ color: '#c0392b', marginInlineEnd: 6 }} />
              {L.shareTitle}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{shareModal.fileName}</div>
          </div>
          <div className="season-share-pdf-frame">
            <iframe src={shareModal.blobUrl} title="PDF" style={{ width: '100%', height: 420, border: 'none', borderRadius: 10 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareModal.serverUrl || shareModal.blobUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="season-share-wa"
            >
              <i className="fa-brands fa-whatsapp" style={{ fontSize: 24 }} />
              واتساب
            </a>
            <button
              type="button"
              className="season-share-dl"
              onClick={() => {
                const a = document.createElement('a');
                a.href = shareModal.blobUrl;
                a.download = shareModal.fileName;
                a.click();
              }}
            >
              <i className="fa-solid fa-download" style={{ fontSize: 24 }} />
              PDF
            </button>
          </div>
          <button type="button" className="season-share-close" onClick={closeShareModal}>
            {L.close}
          </button>
        </ReportShareOverlay>
      )}
    </div>
  );
}
