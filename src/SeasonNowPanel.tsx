import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppData, LangKey } from './appData';
import { pickML } from './appData';
import {
  getStoredVisitorLocation,
  requestVisitorLocation,
  plantsForVisitorLocation,
  harvestForVisitorLocation,
  seasonGuideText,
  locationLabel,
  ensureLocationInLang,
  type VisitorGpsLocation,
} from './visitorLocation';
import { groupPlantsByCategory } from './plantCategories';
import { fetchSeasonWeather, type SeasonWeather } from './seasonWeather';
import { askCanPlantOrHarvest, type PlantAiAnswer } from './seasonPlantAi';
import { formatWesternDate, formatWesternNum } from './formatLocale';
import { captureReportSnapshot } from './plantReportPdfExport';
import { SeasonReportDoc, type SeasonReportPayload } from './SeasonReportDoc';
import { ReportShareOverlay } from './AppPicker';

const PDF_ENDPOINT = '/generate_report.php';
const NAVY = '#003366';
const SEASON_PREVIEW_W = 680;

const L = {
  locHint: {
    ar: 'حدد موقعك حتى نحدد قائمة النباتات التي تزرع الآن وقائمة النباتات التي تحصد الآن',
    en: 'Share your location to see plants to sow and harvest now in your area',
    de: 'Standort freigeben für Anbau- und Erntelisten',
  },
  denied: {
    ar: 'لم يُسمح بالموقع — فعّله من إعدادات المتصفح ثم اضغط الزر مرة أخرى',
    en: 'Location denied — enable it in browser settings and try again',
    de: 'Standort verweigert — in Browsereinstellungen aktivieren',
  },
  btn: { ar: 'تحديد موقعي', en: 'Use my location', de: 'Standort freigeben' },
  loading: { ar: 'جاري تحديد موقعك…', en: 'Getting location…', de: 'Standort wird ermittelt…' },
  region: { ar: 'منطقتك', en: 'Your region', de: 'Ihre Region' },
  today: { ar: 'تاريخ اليوم', en: 'Today', de: 'Heute' },
  temp: { ar: 'الحرارة', en: 'Temp.', de: 'Temp.' },
  humidity: { ar: 'الرطوبة', en: 'Humidity', de: 'Feuchte' },
  wind: { ar: 'الرياح', en: 'Wind', de: 'Wind' },
  plantNow: { ar: 'تُزرع الآن', en: 'Plant now', de: 'Jetzt pflanzen' },
  harvestNow: { ar: 'تُحصد الآن', en: 'Harvest now', de: 'Jetzt ernten' },
  guide: { ar: 'إرشادات الزراعة والحصاد', en: 'Planting & harvest guide', de: 'Anbau- & Ernte-Tipps' },
  aiTitle: { ar: 'هل أستطيع زراعة أو حصاد ؟', en: 'Can I plant or harvest?', de: 'Kann ich pflanzen oder ernten?' },
  aiPlaceholder: { ar: 'اكتب اسم النبات…', en: 'Enter plant name…', de: 'Pflanzenname…' },
  aiAsk: { ar: 'اسألني ؟', en: 'Ask me?', de: 'Frag mich?' },
  aiYes: { ar: 'نعم', en: 'Yes', de: 'Ja' },
  aiNo: { ar: 'لا', en: 'No', de: 'Nein' },
  aiWhen: { ar: 'الموعد المناسب', en: 'Best time', de: 'Beste Zeit' },
  aiWhere: { ar: 'أقرب منطقة مناسبة', en: 'Nearest suitable region', de: 'Nächste geeignete Region' },
  map: { ar: 'الخريطة', en: 'Map', de: 'Karte' },
  previewTitle: { ar: 'معاينة التقرير', en: 'Report preview', de: 'Berichtsvorschau' },
  shareBtn: { ar: 'مشاركة', en: 'Share', de: 'Teilen' },
  printBtn: { ar: 'طباعة', en: 'Print', de: 'Drucken' },
  preparing: { ar: 'جاري التحضير…', en: 'Preparing…', de: 'Wird vorbereitet…' },
  shareModalTitle: { ar: 'معاينة التقرير ومشاركته', en: 'Preview & share report', de: 'Bericht ansehen & teilen' },
};

function t(m: Record<LangKey, string>, lang: LangKey) {
  return m[lang] || m.en;
}

function formatToday(lang: LangKey): string {
  return formatWesternDate(lang);
}

function formatNum(n: number, _lang: LangKey, maxFrac = 1): string {
  return formatWesternNum(n, maxFrac);
}

async function parsePdfResponse(res: Response): Promise<{ ok: boolean; pdf_base64?: string; file_url?: string; error?: string }> {
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Invalid PDF response');
  }
}

export function SeasonNowPanel({ data, lang, active }: { data: AppData; lang: LangKey; active: boolean }) {
  const [loc, setLoc] = useState<VisitorGpsLocation | null>(() => getStoredVisitorLocation());
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState<SeasonWeather | null>(null);
  const [plantQ, setPlantQ] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<PlantAiAnswer | null>(null);
  const [aiConsult, setAiConsult] = useState<{ plantName: string; result: PlantAiAnswer } | undefined>();
  const [locDenied, setLocDenied] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [shareModal, setShareModal] = useState<{ blobUrl: string; fileName: string; serverUrl: string } | null>(null);
  const [previewScale, setPreviewScale] = useState(() =>
    typeof window !== 'undefined' ? Math.min(1, (window.innerWidth - 24) / SEASON_PREVIEW_W) : 0.55,
  );
  const [previewNatH, setPreviewNatH] = useState(0);

  const previewWrapRef = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const exportSourceRef = useRef<HTMLDivElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);

  const loadWeather = useCallback(async (l: VisitorGpsLocation) => {
    setWeather(await fetchSeasonWeather(l.lat, l.lon));
  }, []);

  const enableLocation = useCallback(async () => {
    setLoading(true);
    setLocDenied(false);
    setAiResult(null);
    setAiConsult(undefined);
    setAiOpen(false);
    try {
      const l = await requestVisitorLocation();
      setLoc(l);
      await loadWeather(l);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'denied') setLocDenied(true);
    } finally {
      setLoading(false);
    }
  }, [loadWeather]);

  useEffect(() => {
    if (!active) return;
    const stored = getStoredVisitorLocation();
    if (stored) {
      setLoc(stored);
      loadWeather(stored);
    }
  }, [active, loadWeather]);

  /* ترجمة اسم المنطقة حسب لغة الواجهة (EN/DE لا تبقي عجمان بالعربية) */
  useEffect(() => {
    if (!loc || !active) return;
    let cancelled = false;
    void ensureLocationInLang(loc, lang).then(next => {
      if (cancelled) return;
      if (next !== loc && JSON.stringify(next.labels) !== JSON.stringify(loc.labels)) {
        setLoc(next);
      }
    });
    return () => { cancelled = true; };
  }, [loc, lang, active]);

  const weatherInput = weather
    ? { temperature: weather.temperature, humidity: weather.humidity, windSpeed: weather.windSpeed }
    : undefined;

  const plantNow = loc ? plantsForVisitorLocation(loc, lang, weatherInput) : [];
  const harvestNow = loc ? harvestForVisitorLocation(loc, lang, weatherInput) : [];
  const plantGroups = groupPlantsByCategory(plantNow, lang);
  const harvestGroups = groupPlantsByCategory(harvestNow, lang);
  const guide = loc ? seasonGuideText(loc, plantNow, harvestNow, lang, weatherInput) : '';

  const reportPayload: SeasonReportPayload | null = useMemo(() => {
    if (!loc) return null;
    return {
      loc,
      weather,
      plantGroups,
      harvestGroups,
      guide,
      aiConsult,
    };
  }, [loc, weather, plantGroups, harvestGroups, guide, aiConsult]);

  useEffect(() => {
    if (!reportPayload || shareModal) return;
    const measure = () => {
      const wrap = previewWrapRef.current;
      const avail = wrap && wrap.clientWidth > 0
        ? wrap.clientWidth - 24
        : window.innerWidth - 24;
      setPreviewScale(Math.min(1, Math.max(0.05, avail / SEASON_PREVIEW_W)));
      const content = previewContentRef.current;
      if (content) setPreviewNatH(content.scrollHeight);
    };
    measure();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(debounce);
      debounce = setTimeout(measure, 120);
    };
    window.addEventListener('resize', onResize);
    const raf = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(debounce);
      window.removeEventListener('resize', onResize);
    };
  }, [reportPayload, lang, aiConsult, shareModal]);

  const closeShareModal = () => {
    if (shareModal?.blobUrl) URL.revokeObjectURL(shareModal.blobUrl);
    setShareModal(null);
  };

  async function handleAiAsk() {
    if (!loc || !plantQ.trim()) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const result = await askCanPlantOrHarvest(plantQ.trim(), loc, lang);
      setAiResult(result);
      setAiConsult({ plantName: plantQ.trim(), result });
    } catch (e: unknown) {
      const err = { yes: false, answer: e instanceof Error ? e.message : 'Error' };
      setAiResult(err);
      setAiConsult({ plantName: plantQ.trim(), result: err });
    } finally {
      setAiLoading(false);
    }
  }

  async function exportSeasonPdf() {
    if (!reportPayload || exportBusy) return;
    setExportBusy(true);
    try {
      const reportEl = exportSourceRef.current?.querySelector('.season-report-print-root') as HTMLElement | null;
      if (!reportEl) throw new Error(t({ ar: 'تعذّر تحضير التقرير', en: 'Report not ready', de: 'Bericht nicht bereit' }, lang));

      const reportSnapshot = await captureReportSnapshot(reportEl);
      const fileName = `Season_Report_${lang}_${formatWesternDate(lang).replace(/\s+/g, '_')}.pdf`;
      const tpl = data.reportTemplate;

      let res: Response;
      try {
        res = await fetch(PDF_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lang,
            reportSnapshot,
            fileName,
            pageBgColor: tpl?.pageBgColor || '#ffffff',
          }),
        });
      } catch {
        throw new Error(
          lang === 'ar'
            ? 'تعذّر الاتصال بخادم PDF — استخدم زر الطباعة'
            : 'PDF server unreachable — use Print button',
        );
      }

      const json = await parsePdfResponse(res);
      if (!res.ok || !json.ok || !json.pdf_base64) {
        throw new Error(json.error || `PDF error ${res.status}`);
      }

      const byteStr = atob(json.pdf_base64);
      const bytes = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      setShareModal({ blobUrl, fileName, serverUrl: json.file_url || '' });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setExportBusy(false);
    }
  }

  function printReport() {
    const el = exportSourceRef.current?.querySelector('.season-report-print-root') as HTMLElement | null;
    if (!el) return;
    const themeColor = (data.reportTemplate?.themeColor || '#2a7a2a').trim();
    const footerRaw = pickML(data.reportTemplate?.footerText, lang) || '';
    const engName = lang === 'ar' ? 'م. علاء أحمد المصري' : lang === 'de' ? 'Ing. Alaa Ahmad Almasri' : 'Eng. Alaa Ahmad Almasri';
    const dateStr = formatWesternDate(lang);
    const win = window.open('', '_blank', 'width=900,height=750,menubar=yes,toolbar=yes');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html dir="${lang === 'ar' ? 'rtl' : 'ltr'}" lang="${lang}">
<head><meta charset="UTF-8"><title>Season Report</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<style>
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;900&display=swap');
body{margin:0;font-family:Tajawal,Arial,sans-serif}
.print-header-band{position:fixed;top:0;left:0;right:0;height:13mm;background:#fff;border-bottom:1.5px solid ${themeColor};display:flex;align-items:center;justify-content:space-between;padding:0 14mm;font-size:8pt;color:#003366;z-index:999}
.print-footer-band{position:fixed;bottom:0;left:0;right:0;height:11mm;background:#fff;border-top:1.5px solid ${themeColor};display:flex;align-items:center;justify-content:center;padding:0 14mm;font-size:7.5pt;color:#666;z-index:999;text-align:center}
.print-content{padding:13mm 0 11mm 0}
.pdf-section{break-inside:avoid;page-break-inside:avoid}
@page{size:A4 portrait;margin:15mm 12mm 13mm 12mm}
@media print{.print-header-band,.print-footer-band{position:fixed}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="print-header-band"><span style="font-weight:800">${engName}</span><span>${dateStr}</span></div>
<div class="print-content">${el.outerHTML}</div>
<div class="print-footer-band">${footerRaw}</div>
<script>window.onload=function(){setTimeout(function(){window.print()},600)}</script>
</body></html>`);
    win.document.close();
  }

  function ShareModal() {
    if (!shareModal) return null;
    const { blobUrl, fileName, serverUrl } = shareModal;
    const waHref = `https://wa.me/?text=${encodeURIComponent(serverUrl || blobUrl)}`;
    return (
      <ReportShareOverlay open onClose={closeShareModal}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: NAVY }}>
            <i className="fa-solid fa-file-pdf" style={{ color: '#c0392b', marginInlineEnd: 6 }} />
            {t(L.shareModalTitle, lang)}
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{fileName}</div>
        </div>
        <div className="season-share-pdf-frame">
          <iframe src={blobUrl} title="PDF Preview" style={{ width: '100%', height: 420, border: 'none', borderRadius: 10 }} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="season-share-wa">
            <i className="fa-brands fa-whatsapp" style={{ fontSize: 24 }} />
            {lang === 'de' ? 'WhatsApp' : 'واتساب'}
          </a>
          <button type="button" className="season-share-dl" onClick={() => {
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = fileName;
            a.click();
          }}>
            <i className="fa-solid fa-download" style={{ fontSize: 24 }} />
            PDF
          </button>
        </div>
        <button type="button" className="season-share-close" onClick={closeShareModal}>
          {lang === 'ar' ? 'إغلاق' : lang === 'de' ? 'Schließen' : 'Close'}
        </button>
      </ReportShareOverlay>
    );
  }

  if (!loc) {
    return (
      <div className="glass season-now-panel" style={{ padding: '24px 20px', borderRadius: 16, textAlign: 'center' }}>
        <div style={{ marginBottom: 14 }}>
          <i className="fa-solid fa-location-crosshairs" style={{ fontSize: 42, color: 'rgba(160,200,255,0.85)' }} />
        </div>
        <p className="season-loc-hint">{t(L.locHint, lang)}</p>
        {locDenied && (
          <p style={{ margin: '0 0 14px', fontSize: 12, color: '#ffb4b4', fontWeight: 600 }}>{t(L.denied, lang)}</p>
        )}
        <button type="button" className="btn-prime season-loc-btn" disabled={loading} onClick={enableLocation}>
          {loading ? <><i className="fa-solid fa-spinner fa-spin" /> {t(L.loading, lang)}</> : <><i className="fa-solid fa-location-crosshairs" /> {t(L.btn, lang)}</>}
        </button>
      </div>
    );
  }

  return (
    <div className="glass season-now-panel" style={{ padding: '18px 16px', borderRadius: 16, border: '1px solid rgba(100,160,255,0.2)' }}>
      <ShareModal />

      <div className="season-region-card">
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>
          <i className="fa-solid fa-map-pin" style={{ marginInlineEnd: 8, opacity: 0.85 }} />
          {t(L.region, lang)}: {locationLabel(loc, lang)}
        </div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>
          <i className="fa-regular fa-calendar" style={{ marginInlineEnd: 6 }} />
          {t(L.today, lang)}: {formatToday(lang)}
        </div>
        <div style={{ fontSize: 11, marginTop: 6, opacity: 0.75 }} className="cv-ltr">
          {formatNum(loc.lat, lang, 4)}° · {formatNum(loc.lon, lang, 4)}°
          {' · '}
          <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lon}&z=14`} target="_blank" rel="noreferrer">{t(L.map, lang)}</a>
        </div>
      </div>

      {weather && (
        <div className="season-weather-row">
          <div className="season-weather-cell">
            <i className="fa-solid fa-temperature-half" />
            <span>{t(L.temp, lang)}</span>
            <strong>{formatNum(weather.temperature, lang)}°C</strong>
          </div>
          <div className="season-weather-cell">
            <i className="fa-solid fa-droplet" />
            <span>{t(L.humidity, lang)}</span>
            <strong>{formatNum(weather.humidity, lang, 0)}%</strong>
          </div>
          <div className="season-weather-cell">
            <i className="fa-solid fa-wind" />
            <span>{t(L.wind, lang)}</span>
            <strong>{formatNum(weather.windSpeed, lang)} {weather.windUnit}</strong>
          </div>
        </div>
      )}

      {weather && reportPayload && (
        <div className="season-report-block" style={{ marginTop: 14 }}>
          <div
            ref={previewWrapRef}
            className="season-report-preview-wrap"
            style={{ background: data.reportTemplate?.pageBgColor || '#fff', padding: 12, overflow: 'hidden', borderRadius: 12 }}
          >
            <div
              ref={previewContentRef}
              className="season-report-scale-wrapper"
              style={{
                width: SEASON_PREVIEW_W,
                transformOrigin: '0 0',
                transform: `scale(${previewScale})`,
                marginBottom: previewNatH > 0 ? Math.round(previewNatH * (previewScale - 1)) : 0,
                boxShadow: '0 2px 16px rgba(0,51,102,0.13)',
              }}
            >
              <SeasonReportDoc data={data} lang={lang} report={reportPayload} docWidth={SEASON_PREVIEW_W} />
            </div>
          </div>

          <div className="season-report-actions">
            <button type="button" className="season-report-btn season-report-btn--print" onClick={printReport}>
              <i className="fa-solid fa-print" /> {t(L.printBtn, lang)}
            </button>
            <button type="button" className="season-report-btn season-report-btn--share" disabled={exportBusy} onClick={exportSeasonPdf}>
              {exportBusy ? <><i className="fa-solid fa-spinner fa-spin" /> {t(L.preparing, lang)}</> : <><i className="fa-solid fa-share-nodes" /> {t(L.shareBtn, lang)}</>}
            </button>
          </div>

          <div
            ref={exportSourceRef}
            aria-hidden="true"
            style={{ position: 'fixed', left: '-12000px', top: 0, width: 794, pointerEvents: 'none', visibility: 'hidden', overflow: 'visible' }}
          >
            <SeasonReportDoc data={data} lang={lang} report={reportPayload} docWidth={794} />
          </div>
        </div>
      )}

      <div className="season-ai-ask-card">
        <i className="fa-solid fa-leaf season-ai-ask-icon" aria-hidden />
        <p className="season-ai-ask-title">{t(L.aiTitle, lang)}</p>
        {aiOpen && (
          <input
            ref={aiInputRef}
            type="text"
            value={plantQ}
            onChange={e => setPlantQ(e.target.value)}
            placeholder={t(L.aiPlaceholder, lang)}
            className="season-ai-input season-ai-input--ask"
            onKeyDown={e => e.key === 'Enter' && plantQ.trim() && handleAiAsk()}
          />
        )}
        <button
          type="button"
          className="season-ai-ask-btn"
          disabled={aiLoading || (aiOpen && !plantQ.trim())}
          onClick={() => {
            if (!aiOpen) {
              setAiOpen(true);
              requestAnimationFrame(() => aiInputRef.current?.focus());
              return;
            }
            handleAiAsk();
          }}
        >
          {aiLoading ? <i className="fa-solid fa-spinner fa-spin" /> : t(L.aiAsk, lang)}
        </button>
        {aiResult && (
          <div className={`season-ai-result season-ai-result--ask${aiResult.yes ? ' yes' : ' no'}`}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>
              {aiResult.yes ? `✓ ${t(L.aiYes, lang)}` : `✗ ${t(L.aiNo, lang)}`}
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{aiResult.answer}</p>
            {!aiResult.yes && aiResult.plantWhen && (
              <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700 }}>
                {t(L.aiWhen, lang)}: {aiResult.plantWhen}
              </p>
            )}
            {!aiResult.yes && aiResult.plantWhere && (
              <p style={{ margin: '8px 0 0', fontSize: 12, fontWeight: 700 }}>
                {t(L.aiWhere, lang)}: {aiResult.plantWhere}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
