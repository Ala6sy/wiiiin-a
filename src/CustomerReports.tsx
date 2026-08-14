import { useEffect, useRef, useState } from 'react';
import { AppData, CustomerReport, CustomerReportRow, ReportType, ML, ml, pickML, pickReportML, LangKey, soilRowName } from './appData';
import { resolveImageSrc } from './mediaUrl';
import { AlaaLogo } from './AlaaLogo';
import { MlBulkTranslateButton, MlObjectTranslateButton } from './MlTranslateControls';
import { mergeMlTranslation } from './mlTranslate';

function uid() { return Math.random().toString(36).slice(2, 9); }

const FALLBACK_GREEN = '#2a7a2a';
const NAVY = '#003366';

const CR = {
  docTitle: ml('تقرير تحليل التربة', 'Soil Analysis Report', 'Bodenanalysebericht'),
  docTitleDisease: ml('تقرير مرض نباتي / فطري', 'Plant / Fungal Disease Report', 'Pflanzen- / Pilzkrankheitsbericht'),
  docTitleInsect: ml('تقرير إصابة حشرية', 'Insect Infestation Report', 'Insektenbefallsbericht'),
  typeSoil: ml('فحص تربة', 'Soil Test', 'Bodentest'),
  typeDisease: ml('مرض نباتي / فطري', 'Plant / Fungal Disease', 'Pflanzen- / Pilzkrankheit'),
  typeInsect: ml('إصابة حشرية', 'Insect Infestation', 'Insektenbefall'),
  examResults: ml('نتائج الفحص', 'Examination Results', 'Untersuchungsergebnisse'),
  pricingTitle: ml('التكلفة والخدمات', 'Costs & Services', 'Kosten & Leistungen'),
  priceItem: ml('البند', 'Item', 'Position'),
  price: ml('السعر', 'Price', 'Preis'),
  tax: ml('الضريبة %', 'Tax %', 'Steuer %'),
  total: ml('الإجمالي', 'Total', 'Gesamt'),
  grandTotal: ml('الإجمالي الكلي', 'Grand Total', 'Gesamtsumme'),
  date: ml('التاريخ', 'Date', 'Datum'),
  customer: ml('بيانات العميل', 'Customer Details', 'Kundendaten'),
  name: ml('اسم العميل', 'Customer Name', 'Kundenname'),
  phone: ml('رقم الهاتف', 'Phone', 'Telefon'),
  location: ml('الموقع', 'Location', 'Standort'),
  attendance: ml('تاريخ الحضور', 'Attendance Date', 'Anwesenheitsdatum'),
  exam: ml('تاريخ الفحص', 'Examination Date', 'Untersuchungsdatum'),
  plant: ml('النبات المزروع', 'Planted Crop', 'Angebaute Pflanze'),
  description: ml('الوصف', 'Description', 'Beschreibung'),
  soilTitle: ml('تحليل التربة', 'Soil Analysis', 'Bodenanalyse'),
  test: ml('عنصر الفحص', 'Test Item', 'Testkriterium'),
  actual: ml('النتيجة الفعلية', 'Actual Result', 'Istwert'),
  ideal: ml('التربة المثالية', 'Ideal / Target', 'Idealwert'),
  finalTitle: ml('التقرير النهائي الشامل', 'Final Comprehensive Report', 'Abschließender Gesamtbericht'),
  engSignature: ml('التوقيع', 'Signature', 'Unterschrift'),
  engStamp: ml('الختم', 'Stamp', 'Stempel'),
  paidStamp: ml('ختم الدفع', 'Payment Stamp', 'Zahlungsstempel'),
};

const td: React.CSSProperties = {
  padding: '7px 8px',
  borderBottom: '1px solid #e8f0e8',
  textAlign: 'start',
  verticalAlign: 'middle',
  lineHeight: 1.45,
};
const a4Base: React.CSSProperties = { width: 794, background: '#fff', padding: 36, boxSizing: 'border-box', fontFamily: 'Tajawal, sans-serif', color: '#222' };
const fluidBase: React.CSSProperties = { width: '100%', maxWidth: '100%', background: '#fff', padding: '18px 14px 28px', boxSizing: 'border-box', fontFamily: 'Tajawal, sans-serif', color: '#222' };

/* ════════════════════════════════════════════════════
   A4 DOCUMENT RENDERER
════════════════════════════════════════════════════ */
export function CustomerReportDoc({ data, report, lang, innerRef, forExport, fluid }: {
  data: AppData; report: CustomerReport; lang: LangKey; innerRef?: React.Ref<HTMLDivElement>; forExport?: boolean; fluid?: boolean;
}) {
  const isRtl = lang === 'ar';
  const L = (m: ML) => pickML(m, lang); /* تسميات الواجهة — دائماً مترجمة */
  const T = (m: ML | string | undefined) => pickReportML(m, lang); /* محتوى التقرير — لغة واحدة فقط */
  const tpl = data.reportTemplate;
  const theme = (tpl.themeColor || FALLBACK_GREEN).trim() || FALLBACK_GREEN;
  const headerText = pickML(tpl.headerText, lang);
  const footerText = pickML(tpl.footerText, lang);
  const engNameDisplay = pickML(tpl.engName, lang)
    || (lang === 'de' ? 'Ing. Alaa Ahmad Almasri' : lang === 'ar' ? 'م. علاء أحمد المصري' : 'Eng. Alaa Ahmad Almasri');
  const engNameColor = tpl.engNameColor || NAVY;
  const st = data.siteSettings;

  const sectionTitle: React.CSSProperties = { fontWeight: 900, color: theme, fontSize: fluid ? 14 : 15, marginBottom: 10, paddingInlineStart: 8, borderInlineStart: `4px solid ${theme}` };
  const docStyle: React.CSSProperties = fluid
    ? fluidBase
    : forExport
      ? a4Base
      : { ...a4Base, minHeight: 1123, display: 'flex', flexDirection: 'column', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' };
  const rType = report.reportType || 'soil';
  const docML = rType === 'disease' ? CR.docTitleDisease : rType === 'insect' ? CR.docTitleInsect : CR.docTitle;
  const typeML = rType === 'disease' ? CR.typeDisease : rType === 'insect' ? CR.typeInsect : CR.typeSoil;
  const custName = T(report.customerName);
  const title = custName ? `${L(docML)} — ${custName}` : L(docML);
  const imgs = (report.images || []).filter(Boolean);
  const rows = (report.soilRows || []).filter(r => T(r.test) || T(r.actual) || T(r.ideal));
  const rowsTitle = rType === 'soil' ? L(CR.soilTitle) : L(CR.examResults);
  const currency = (data.currency || '').trim();
  const priceRows = (data.soilAnalysis || []).filter(r => r.name || r.price || r.tax);
  const grand = priceRows.reduce((a, r) => a + (parseFloat(r.price) || 0) * (1 + (parseFloat(r.tax) || 0) / 100), 0);
  const withCur = (n: string) => currency ? `${n} ${currency}` : n;
  const descTxt = T(report.description);
  const finalTxt = T(report.finalReport);
  const plantTxt = T(report.plantName);

  const infoRows: { label: string; value: string; ltr?: boolean }[] = [
    { label: L(CR.name), value: custName },
    { label: L(CR.phone), value: report.customerPhone, ltr: true },
    { label: L(CR.location), value: T(report.customerLocation) },
    { label: L(CR.attendance), value: report.attendanceDate, ltr: true },
    { label: L(CR.exam), value: report.examDate, ltr: true },
  ].filter(r => r.value);

  /* شعار علاء دائماً في تقرير التربة؛ شعار مخصص فقط إن رُفع في قالب التقرير */
  const logoNode = tpl.headerLogo
    ? <img className="soil-report-header-logo" src={resolveImageSrc(tpl.headerLogo)} alt="logo" style={{ height: 56, width: 'auto', objectFit: 'contain', flexShrink: 0, display: 'block' }} />
    : <AlaaLogo color={engNameColor} size={56} style={{ display: 'block', flexShrink: 0 }} />;

  const portalLine = headerText || engNameDisplay;

  return (
    <div ref={innerRef} style={docStyle} dir={isRtl ? 'rtl' : 'ltr'} className="soil-report-print-root">
      {/* رأس التقرير: شعار علاء + اسم البوابة (منتصف عمودي) | عنوان التحليل */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        alignItems: 'center',
        gap: 14,
        borderBottom: `3px solid ${theme}`,
        paddingBottom: 14,
        marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {logoNode}
          <div style={{
            minWidth: 0,
            fontWeight: 700,
            color: theme,
            fontSize: 13,
            lineHeight: 1.35,
            display: 'flex',
            alignItems: 'center',
          }}>
            {portalLine}
          </div>
        </div>
        <div style={{ minWidth: 0, textAlign: 'end' }}>
          <div style={{ fontWeight: 900, color: theme, fontSize: 17, lineHeight: 1.4, wordBreak: 'break-word', marginBottom: 10 }}>
            {title}
          </div>
          <div
            className="soil-report-type-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: theme,
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              borderRadius: 20,
              padding: '6px 14px',
              lineHeight: 1,
              minHeight: 26,
              boxSizing: 'border-box',
            }}
          >
            {L(typeML)}
          </div>
          <div style={{ fontSize: 12, color: '#777', marginTop: 8 }}>
            {L(CR.date)}: {report.examDate || report.attendanceDate || ''}
          </div>
        </div>
      </div>

      {/* Customer info — تخطيط وثيقة A4 (بدون بطاقات مستطيلة) */}
      {infoRows.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={sectionTitle}>{L(CR.customer)}</div>
          <table className="soil-report-data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <tbody>
              {infoRows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5efe5' }}>
                  <td style={{ ...td, width: '34%', fontWeight: 700, color: theme, background: i % 2 ? '#fafcfa' : '#fff' }}>{row.label}</td>
                  <td style={{
                    ...td,
                    fontWeight: 600,
                    color: '#1d3a1d',
                    background: i % 2 ? '#fafcfa' : '#fff',
                    /* أرقام إنجليزية بالترتيب الصحيح، ومحاذاة مع بقية النص (يمين في العربية) */
                    ...(row.ltr ? { direction: 'ltr', unicodeBidi: 'isolate', textAlign: isRtl ? 'right' : 'left' } : {}),
                  }}>
                    {row.value}
                  </td>
                </tr>
              ))}
              {plantTxt && (
                <tr style={{ borderBottom: '1px solid #e5efe5' }}>
                  <td style={{ ...td, fontWeight: 700, color: theme }}>{L(CR.plant)}</td>
                  <td style={{ ...td, fontWeight: 700, color: '#1d3a1d' }}>{plantTxt}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Images */}
      {imgs.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {imgs.map((img, i) => (
            <img key={i} src={img} alt="" style={{ width: `calc((100% - ${8 * Math.max(0, Math.min(imgs.length, 4) - 1)}px) / ${Math.min(imgs.length, 4)})`, maxWidth: 170, height: 120, objectFit: 'cover', borderRadius: 8, border: `1.5px solid ${theme}` }} />
          ))}
        </div>
      )}

      {/* Description only (plant moved into info table) */}
      {descTxt && (
        <div style={{ marginBottom: 16 }}>
          <div style={sectionTitle}>{L(CR.description)}</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.9, color: '#333', whiteSpace: 'pre-wrap' }}>{descTxt}</div>
        </div>
      )}

      {/* Soil table */}
      {rows.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={sectionTitle}>{rowsTitle}</div>
          <table className="soil-report-data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: theme, color: '#fff' }}>
                {[CR.test, CR.actual, CR.ideal].map((h, i) => (
                  <th key={i} style={{ padding: '8px 8px', textAlign: isRtl ? 'right' : 'left', verticalAlign: 'middle', lineHeight: 1.45 }}>{L(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 ? '#fff' : '#f6faf6' }}>
                  <td style={{ ...td, fontWeight: 700, color: '#1d3a1d' }}>{T(r.test)}</td>
                  <td style={td}>{T(r.actual)}</td>
                  <td style={{ ...td, color: theme, fontWeight: 600 }}>{T(r.ideal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Final comprehensive report */}
      {finalTxt && (
        <div style={{ marginBottom: 16 }}>
          <div style={sectionTitle}>{L(CR.finalTitle)}</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.9, color: '#333', whiteSpace: 'pre-wrap' }}>{finalTxt}</div>
        </div>
      )}

      {/* Pricing & services */}
      {priceRows.length > 0 && (
        <div style={{ marginBottom: 16, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <div style={sectionTitle}>{L(CR.pricingTitle)}</div>
          <table className="soil-report-data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: theme, color: '#fff' }}>
                {[CR.priceItem, CR.price, CR.tax, CR.total].map((h, i) => (
                  <th key={i} style={{ padding: '8px 8px', textAlign: isRtl ? 'right' : 'left', whiteSpace: 'nowrap', verticalAlign: 'middle', lineHeight: 1.45 }}>{L(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {priceRows.map((r, i) => {
                const tot = ((parseFloat(r.price) || 0) * (1 + (parseFloat(r.tax) || 0) / 100)).toFixed(2);
                return (
                  <tr key={r.id} style={{ background: i % 2 ? '#fff' : '#f6faf6' }}>
                    <td style={{ ...td, fontWeight: 700, color: '#1d3a1d' }}>{soilRowName(r.name, lang)}</td>
                    <td style={{ ...td, direction: 'ltr' }}>{r.price ? withCur(r.price) : ''}</td>
                    <td style={{ ...td, direction: 'ltr' }}>{r.tax}</td>
                    <td style={{ ...td, direction: 'ltr', fontWeight: 700, color: theme }}>{withCur(tot)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#eef6ee' }}>
                <td colSpan={3} style={{ ...td, fontWeight: 800 }}>{L(CR.grandTotal)}</td>
                <td style={{ ...td, direction: 'ltr', fontWeight: 900, color: theme }}>{withCur(grand.toFixed(2))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Footer: signature + eng stamp + paid stamp */}
      <div style={{ marginTop: forExport ? 28 : 'auto', borderTop: `2px solid ${theme}`, paddingTop: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18 }}>
        <div style={{ fontSize: 11, color: '#666', maxWidth: '38%', lineHeight: 1.7 }}>{footerText}</div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'center', minWidth: 120 }}>
            {tpl.engSignature
              ? <img src={resolveImageSrc(tpl.engSignature)} alt="" style={{ maxHeight: 60, maxWidth: 140, objectFit: 'contain' }} />
              : <div style={{ height: 60 }} />}
            <div style={{ borderTop: '1px solid #999', marginTop: 4, paddingTop: 5, fontSize: 11, fontWeight: 700, color: '#444' }}>{L(CR.engSignature)}</div>
            {(pickML(tpl.engName, lang) || '').trim() && (
              <div style={{ fontSize: 11, fontWeight: 800, color: (tpl.engNameColor || NAVY), marginTop: 4 }}>
                {pickML(tpl.engName, lang)}
              </div>
            )}
          </div>
          {tpl.engStamp && (
            <div style={{ textAlign: 'center' }}>
              <img src={resolveImageSrc(tpl.engStamp)} alt="" style={{ maxHeight: 80, maxWidth: 110, objectFit: 'contain' }} />
              <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: '#444' }}>{L(CR.engStamp)}</div>
            </div>
          )}
          {tpl.paidStamp && (
            <div style={{ textAlign: 'center' }}>
              <img src={resolveImageSrc(tpl.paidStamp)} alt="" style={{ maxHeight: 80, maxWidth: 110, objectFit: 'contain' }} />
              <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: '#444' }}>{L(CR.paidStamp)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   ADMIN CRUD
════════════════════════════════════════════════════ */
const LANGS: { code: LangKey; flag: string }[] = [{ code: 'ar', flag: '🇸🇾' }, { code: 'en', flag: '🇺🇸' }, { code: 'de', flag: '🇩🇪' }];

function fileToDataUrl(file: File, max = 1100): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > max || height > max) { const r = Math.min(max / width, max / height); width = Math.round(width * r); height = Math.round(height * r); }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(reader.result as string); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const emptyReport = (): CustomerReport => ({
  id: uid(),
  customerName: ml('', '', ''),
  customerPhone: '',
  customerLocation: ml('', '', ''),
  attendanceDate: new Date().toISOString().split('T')[0],
  examDate: new Date().toISOString().split('T')[0],
  images: [],
  plantName: ml('', '', ''),
  description: ml('', '', ''),
  soilRows: [],
  finalReport: ml('', '', ''),
  reportType: 'soil',
  createdAt: new Date().toISOString(),
});

function collectReportArFields(r: CustomerReport): Record<string, string> {
  const f: Record<string, string> = {};
  if (r.customerName.ar?.trim()) f.customerName = r.customerName.ar.trim();
  if (r.customerLocation.ar?.trim()) f.customerLocation = r.customerLocation.ar.trim();
  if (r.plantName.ar?.trim()) f.plantName = r.plantName.ar.trim();
  if (r.description.ar?.trim()) f.description = r.description.ar.trim();
  if (r.finalReport.ar?.trim()) f.finalReport = r.finalReport.ar.trim();
  for (const row of r.soilRows) {
    if (row.test.ar?.trim()) f[`row.${row.id}.test`] = row.test.ar.trim();
    if (row.actual.ar?.trim()) f[`row.${row.id}.actual`] = row.actual.ar.trim();
    if (row.ideal.ar?.trim()) f[`row.${row.id}.ideal`] = row.ideal.ar.trim();
  }
  return f;
}

function applyReportTranslations(
  r: CustomerReport,
  tr: Record<string, { en: string; de: string }>,
): CustomerReport {
  const apply = (m: ML, key: string): ML => (tr[key] ? mergeMlTranslation(m, tr[key], true) : m);
  return {
    ...r,
    customerName: apply(r.customerName, 'customerName'),
    customerLocation: apply(r.customerLocation, 'customerLocation'),
    plantName: apply(r.plantName, 'plantName'),
    description: apply(r.description, 'description'),
    finalReport: apply(r.finalReport, 'finalReport'),
    soilRows: r.soilRows.map(row => ({
      ...row,
      test: apply(row.test, `row.${row.id}.test`),
      actual: apply(row.actual, `row.${row.id}.actual`),
      ideal: apply(row.ideal, `row.${row.id}.ideal`),
    })),
  };
}

export function CustomerReportsAdmin({ data, onSave }: { data: AppData; onSave: (u: Partial<AppData>) => void }) {
  const THEME = '#2a7a2a';
  const [reports, setReports] = useState<CustomerReport[]>(data.customerReports || []);
  const [edit, setEdit] = useState<CustomerReport | null>(null);
  const [lang, setLang] = useState<LangKey>('ar');
  const [printData, setPrintData] = useState<{ report: CustomerReport; lang: LangKey } | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const commit = (next: CustomerReport[]) => { setReports(next); onSave({ customerReports: next }); };

  /* ══════════════════════════════════════════════════════════════
     طباعة / تنزيل PDF — يستخدم محرك المتصفح مباشرةً
     النتيجة مثالية: عربي صحيح + هوامش A4 + ألوان دقيقة
     المستخدم يختار "حفظ كـ PDF" من قائمة الطباعة
  ══════════════════════════════════════════════════════════════ */
  function printReport(report: CustomerReport, pLang: LangKey) {
    setPrintData({ report, lang: pLang });

    /* ─── نُعطي React وقتاً للرسم ثم ننتظر تحميل الخطوط ─── */
    setTimeout(async () => {
      /* انتظر تحميل الخطوط — timeout 3s حتى لا ننتظر للأبد */
      try {
        await Promise.race([
          document.fonts.ready,
          new Promise<void>(r => setTimeout(r, 3000)),
        ]);
      } catch (_) { /* ignore */ }

      const st = document.createElement('style');
      st.id = '__cr_ps__';
      st.textContent = `
        /* تضمين Tajawal مباشرةً في CSS الطباعة كضمان إضافي */
        @font-face {
          font-family: 'Tajawal';
          font-style: normal;
          font-weight: 400 900;
          src: url('https://fonts.gstatic.com/s/tajawal/v4/Iura6YBj_oCad4k1nzaaGQRGVAo.woff2') format('woff2');
          unicode-range: U+0600-06FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE80-FEFC;
        }
        @media print {
          body > *:not(#__cr_p__) { display: none !important; }
          #__cr_p__ {
            display: block !important;
            position: fixed !important;
            left: 0 !important; top: 0 !important;
            right: 0 !important; bottom: 0 !important;
            visibility: visible !important;
            background: #fff !important;
            z-index: 2147483647 !important;
            transform: none !important;
            font-family: 'Tajawal', Arial, sans-serif !important;
          }
          #__cr_p__ * {
            font-family: 'Tajawal', Arial, sans-serif !important;
          }
          @page { size: A4 portrait; margin: 18mm 13mm 16mm 13mm; }
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `;
      document.head.appendChild(st);

      const cleanup = () => {
        st.remove();
        setPrintData(null);
        window.removeEventListener('afterprint', cleanup);
      };
      window.addEventListener('afterprint', cleanup);
      window.print();
      setTimeout(cleanup, 60_000);
    }, 600); /* 600ms: يكفي React للرسم + فرصة بداية تحميل الخط */
  }

  /* مشاركة واتساب — يستخدم navigator.share على الجوال */
  function shareWA(report: CustomerReport) {
    const name = pickML(report.customerName, 'ar') || 'تقرير';
    const text = `📋 ${name}\n${window.location.href}`;
    if (navigator.share) {
      navigator.share({ title: name, text }).catch(() =>
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
      );
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  }

  async function addImages(files: FileList | null) {
    if (!files || !edit) return;
    const slots = 6 - edit.images.length;
    const picked = Array.from(files).slice(0, Math.max(0, slots));
    const urls = await Promise.all(picked.map(f => fileToDataUrl(f)));
    setEdit({ ...edit, images: [...edit.images, ...urls].slice(0, 6) });
  }

  const setML = (key: 'customerName' | 'customerLocation' | 'plantName' | 'description' | 'finalReport', v: string) => {
    if (!edit) return;
    setEdit({ ...edit, [key]: { ...edit[key], [lang]: v } });
  };
  const setRow = (id: string, key: keyof CustomerReportRow, v: string) => {
    if (!edit) return;
    setEdit({ ...edit, soilRows: edit.soilRows.map(r => r.id === id ? { ...r, [key]: key === 'id' ? v : { ...(r[key] as ML), [lang]: v } } : r) });
  };
  const addRow = () => { if (edit) setEdit({ ...edit, soilRows: [...edit.soilRows, { id: uid(), test: ml('', '', ''), actual: ml('', '', ''), ideal: ml('', '', '') }] }); };
  const delRow = (id: string) => { if (edit) setEdit({ ...edit, soilRows: edit.soilRows.filter(r => r.id !== id) }); };

  const saveReport = () => {
    if (!edit) return;
    const idx = reports.findIndex(r => r.id === edit.id);
    commit(idx >= 0 ? reports.map((r, i) => i === idx ? edit : r) : [...reports, edit]);
    setEdit(null);
  };

  const langBtns = (
    <div style={{ display: 'flex', gap: 4 }}>
      {LANGS.map(l => (
        <button key={l.code} onClick={() => setLang(l.code)}
          style={{ padding: '4px 8px', borderRadius: 12, border: `1px solid ${lang === l.code ? THEME : '#ccc'}`, background: lang === l.code ? THEME : '#fff', color: lang === l.code ? '#fff' : '#555', fontSize: 11, cursor: 'pointer' }}>
          {l.flag}
        </button>
      ))}
    </div>
  );

  /* ── EDITOR ── */
  if (edit) {
    const uc = lang.toUpperCase();
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0 }}>{reports.find(r => r.id === edit.id) ? 'تعديل تقرير عميل' : 'تقرير عميل جديد'}</h4>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {langBtns}
            <MlBulkTranslateButton
              label="ترجمة الكل من العربية"
              context="agricultural soil analysis customer report"
              fields={collectReportArFields(edit)}
              onComplete={tr => setEdit(applyReportTranslations(edit, tr))}
            />
            <button className="btn-cancel" onClick={() => setEdit(null)}>✕ إلغاء</button>
          </div>
        </div>

        <div className="form-group">
          <label>نوع التقرير</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([['soil', 'فحص تربة', 'fa-vials'], ['disease', 'مرض نباتي / فطري', 'fa-disease'], ['insect', 'إصابة حشرية', 'fa-bug']] as [ReportType, string, string][]).map(([val, label, icon]) => {
              const on = (edit.reportType || 'soil') === val;
              return (
                <button key={val} type="button" onClick={() => setEdit({ ...edit, reportType: val })}
                  style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${on ? THEME : '#ccc'}`, background: on ? THEME : '#fff', color: on ? '#fff' : '#555', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <i className={`fa-solid ${icon}`} /> {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              اسم العميل ({uc})
              <MlObjectTranslateButton small value={edit.customerName} onChange={customerName => setEdit({ ...edit, customerName })} context="customer person name" />
            </label>
            <input value={edit.customerName[lang] || ''} onChange={e => setML('customerName', e.target.value)} />
          </div>
          <div className="form-group"><label>رقم الهاتف</label><input value={edit.customerPhone} style={{ direction: 'ltr' }} onChange={e => setEdit({ ...edit, customerPhone: e.target.value })} /></div>
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            الموقع / المكان ({uc})
            <MlObjectTranslateButton small value={edit.customerLocation} onChange={customerLocation => setEdit({ ...edit, customerLocation })} context="geographic location" />
          </label>
          <input value={edit.customerLocation[lang] || ''} onChange={e => setML('customerLocation', e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label>تاريخ الحضور</label><input type="date" value={edit.attendanceDate} onChange={e => setEdit({ ...edit, attendanceDate: e.target.value })} /></div>
          <div className="form-group"><label>تاريخ الفحص</label><input type="date" value={edit.examDate} onChange={e => setEdit({ ...edit, examDate: e.target.value })} /></div>
        </div>

        {/* images */}
        <div className="form-group">
          <label>صور التقرير</label>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {edit.images.map((img, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <img src={img} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: `2px solid ${THEME}` }} />
                <button onClick={() => setEdit({ ...edit, images: edit.images.filter((_, j) => j !== i) })} style={{ position: 'absolute', top: -7, insetInlineEnd: -7, background: '#c0392b', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 10 }}>✕</button>
              </div>
            ))}
            {edit.images.length < 6 && (
              <button onClick={() => imgRef.current?.click()} style={{ width: 80, height: 80, borderRadius: 8, border: `2px dashed ${THEME}`, background: '#e8f5e9', color: THEME, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                <i className="fa-solid fa-plus" style={{ display: 'block', fontSize: 18, marginBottom: 2 }} /> صورة
              </button>
            )}
            <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { addImages(e.target.files); e.target.value = ''; }} />
          </div>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            النبات المزروع ({uc})
            <MlObjectTranslateButton small value={edit.plantName} onChange={plantName => setEdit({ ...edit, plantName })} context="crop plant name" />
          </label>
          <input value={edit.plantName[lang] || ''} onChange={e => setML('plantName', e.target.value)} />
        </div>
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            الوصف ({uc})
            <MlObjectTranslateButton small value={edit.description} onChange={description => setEdit({ ...edit, description })} context="soil report description" />
          </label>
          <textarea rows={4} value={edit.description[lang] || ''} onChange={e => setML('description', e.target.value)} />
        </div>

        {/* soil rows */}
        <div className="form-group">
          <label>جدول تحليل التربة ({uc}) — العنصر / الفعلي / المثالي</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {edit.soilRows.map(r => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, alignItems: 'center' }}>
                <input placeholder="عنصر الفحص" value={r.test[lang] || ''} onChange={e => setRow(r.id, 'test', e.target.value)} />
                <input placeholder="النتيجة الفعلية" value={r.actual[lang] || ''} onChange={e => setRow(r.id, 'actual', e.target.value)} />
                <input placeholder="المثالية" value={r.ideal[lang] || ''} onChange={e => setRow(r.id, 'ideal', e.target.value)} />
                <button className="btn-danger-sm" onClick={() => delRow(r.id)}><i className="fa-solid fa-trash-can" /></button>
              </div>
            ))}
          </div>
          <button className="btn-outline-sm" style={{ marginTop: 8 }} onClick={addRow}><i className="fa-solid fa-plus" /> إضافة صف</button>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            التقرير النهائي الشامل ({uc})
            <MlObjectTranslateButton small value={edit.finalReport} onChange={finalReport => setEdit({ ...edit, finalReport })} context="final soil analysis recommendations" />
          </label>
          <textarea rows={6} value={edit.finalReport[lang] || ''} onChange={e => setML('finalReport', e.target.value)} />
        </div>

        <p style={{ fontSize: 12, color: '#888' }}>
          <i className="fa-solid fa-language" /> اكتب بالعربية أولاً ثم اضغط «ترجمة الكل من العربية» لملء الإنجليزية والألمانية تلقائياً (مثل باقي الموقع). عند عرض التقرير بلغة معيّنة يظهر نص تلك اللغة فقط — بدون خلط عربي/إنجليزي.
        </p>

        {/* live preview */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0 6px' }}>
          <span style={{ fontWeight: 700, color: THEME }}><i className="fa-solid fa-eye" /> معاينة ({uc})</span>
          <button className="btn-outline-sm" onClick={() => printReport(edit, lang)}>
            <i className="fa-solid fa-print" /> طباعة / PDF
          </button>
        </div>
        {/* التقرير مُصغَّر ليناسب شاشة الجوال مع الحفاظ على العرض الكامل A4 */}
        {(() => {
          const vw = Math.min(typeof window !== 'undefined' ? window.innerWidth : 794, 820);
          const sc = Math.min(1, (vw - 56) / 794);
          return (
            <div style={{ overflowX: 'hidden', background: '#e9eef3', borderRadius: 12, padding: 8 }}>
              <div style={{
                width: 794, transform: `scale(${sc})`, transformOrigin: 'top left',
                marginBottom: sc < 1 ? `${(sc - 1) * 1000}px` : 0,
              }}>
                <CustomerReportDoc data={data} report={edit} lang={lang} />
              </div>
            </div>
          );
        })()}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn-prime" onClick={saveReport}><i className="fa-solid fa-floppy-disk" /> حفظ</button>
          <button className="btn-cancel" onClick={() => setEdit(null)}>إلغاء</button>
        </div>
      </div>
    );
  }

  /* ── LIST ── */
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ margin: 0 }}><i className="fa-solid fa-folder-open" style={{ color: THEME }} /> تقارير العملاء ({reports.length})</h4>
        <button className="btn-prime" onClick={() => { setLang('ar'); setEdit(emptyReport()); }}><i className="fa-solid fa-plus" /> تقرير جديد</button>
      </div>

      {reports.length === 0 ? (
        <p style={{ color: '#888', fontSize: 13 }}>لا توجد تقارير عملاء بعد. أنشئ تقريراً جديداً وصدّره PDF بأي لغة.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
          {reports.map(r => (
            <div key={r.id} style={{ background: '#f5fbf5', border: '1px solid #c8e6c9', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {r.images[0] && <img src={r.images[0]} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: THEME, wordBreak: 'break-word' }}>{pickML(r.customerName, 'ar') || '—'}</div>
                  <div style={{ fontSize: 11, color: '#666', direction: 'ltr', textAlign: 'start' }}>{r.customerPhone}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{r.examDate}</div>
                  <div style={{ display: 'inline-block', marginTop: 4, background: THEME, color: '#fff', fontSize: 9.5, fontWeight: 700, borderRadius: 12, padding: '2px 8px' }}>
                    {pickML((r.reportType || 'soil') === 'disease' ? CR.typeDisease : (r.reportType || 'soil') === 'insect' ? CR.typeInsect : CR.typeSoil, 'ar')}
                  </div>
                </div>
              </div>
              {/* أزرار طباعة / PDF بكل لغة */}
              <div style={{ display: 'flex', gap: 4, marginTop: 10, flexWrap: 'wrap' }}>
                {LANGS.map(l => (
                  <button key={l.code} className="btn-outline-sm" disabled={!!printData} onClick={() => printReport(r, l.code)}
                    title={`طباعة / تنزيل PDF — ${l.code.toUpperCase()}`}>
                    <i className="fa-solid fa-print" /> {l.flag} {l.code.toUpperCase()}
                  </button>
                ))}
                <button className="btn-outline-sm" style={{ color: '#25D366', borderColor: '#25D366' }}
                  onClick={() => shareWA(r)} title="مشاركة عبر واتساب">
                  <i className="fa-brands fa-whatsapp" />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                <button className="btn-outline-sm" onClick={() => { setLang('ar'); setEdit({ ...r }); }}><i className="fa-solid fa-pen" /> تعديل</button>
                <button className="btn-danger-sm" onClick={() => { if (confirm('حذف هذا التقرير؟')) commit(reports.filter(x => x.id !== r.id)); }}><i className="fa-solid fa-trash-can" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── مؤشر تحميل أثناء تجهيز الطباعة ── */}
      {printData && (
        <div style={{
          position: 'fixed', bottom: 20, insetInlineEnd: 16, zIndex: 9999,
          background: THEME, color: '#fff', padding: '10px 18px', borderRadius: 12,
          fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 18px rgba(0,0,0,0.22)',
        }}>
          <i className="fa-solid fa-spinner fa-spin" />
          جاري تجهيز التقرير… اختر «حفظ كـ PDF» من نافذة الطباعة
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          حاوية الطباعة — خارج الشاشة (لا display:none) حتى
          يُحمِّل المتصفح خط Tajawal مسبقاً قبل فتح نافذة الطباعة
      ═══════════════════════════════════════════════════════════ */}
      {printData && (
        <div
          id="__cr_p__"
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: 0,
            left: -9999,
            width: 794,
            visibility: 'hidden',
            pointerEvents: 'none',
            zIndex: -1,
            fontFamily: 'Tajawal, sans-serif',
          }}
        >
          <CustomerReportDoc
            data={data}
            report={printData.report}
            lang={printData.lang}
            forExport={true}
          />
        </div>
      )}
    </div>
  );
}
