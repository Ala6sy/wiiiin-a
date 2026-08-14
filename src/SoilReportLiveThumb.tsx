import { useLayoutEffect, useRef, useState } from 'react';
import type { AppData, CustomerReport, LangKey, ML } from './appData';
import { pickML, pickReportML } from './appData';
import { resolveImageSrc } from './mediaUrl';
import { AlaaLogo } from './AlaaLogo';

const TYPE_LBL = {
  soil: { ar: 'تحليل تربة', en: 'Soil analysis', de: 'Bodenanalyse' } as ML,
  disease: { ar: 'تحليل نبات', en: 'Plant analysis', de: 'Pflanzenanalyse' } as ML,
  insect: { ar: 'تحليل حشري', en: 'Insect analysis', de: 'Insektenanalyse' } as ML,
  water: { ar: 'تحليل ماء', en: 'Water analysis', de: 'Wasseranalyse' } as ML,
};

export function reportTypeLabel(reportType: string | undefined, lang: LangKey): string {
  const t = (reportType || 'soil') as keyof typeof TYPE_LBL;
  return pickML(TYPE_LBL[t] || TYPE_LBL.soil, lang);
}

/** اسم النبات للبطاقة — سطر واحد (بدون كسر الاسم العلمي على سطرين) */
export function reportPlantLabel(report: CustomerReport, lang: LangKey): string {
  return pickReportML(report.plantName, lang).replace(/\s+/g, ' ').trim();
}

/**
 * صورة مصغّرة: ورقة تقرير كاملة تُكبَّر لتملأ البطاقة (بدون فراغ أبيض)
 */
export function SoilReportLiveThumb({
  data,
  report,
  lang,
}: {
  data: AppData;
  report: CustomerReport;
  lang: LangKey;
}) {
  const isRtl = lang === 'ar';
  const tpl = data.reportTemplate;
  const theme = (tpl?.themeColor || '#2a7a2a').trim();
  const logoColor = (tpl?.engNameColor || '#0a2540').trim();
  const header = pickML(tpl?.headerText, lang) || '';
  const typeTxt = reportTypeLabel(report.reportType, lang);
  const plantTxt = reportPlantLabel(report, lang);
  const nameTxt = pickReportML(report.customerName, lang);
  const dateTxt = report.examDate || report.attendanceDate || '';
  const descTxt = pickReportML(report.description, lang).replace(/\s+/g, ' ').trim();
  const finalTxt = pickReportML(report.finalReport, lang).replace(/\s+/g, ' ').trim();
  const rows = (report.soilRows || []).slice(0, 10);
  const Ltest = pickML({ ar: 'العنصر', en: 'Item', de: 'Item' }, lang);
  const Lact = pickML({ ar: 'الفعلي', en: 'Actual', de: 'Ist' }, lang);
  const Lideal = pickML({ ar: 'المثالي', en: 'Ideal', de: 'Ideal' }, lang);
  const Lcust = pickML({ ar: 'بيانات العميل', en: 'Customer', de: 'Kunde' }, lang);
  const Ldesc = pickML({ ar: 'الوصف', en: 'Description', de: 'Beschreibung' }, lang);
  const Lsoil = pickML({ ar: 'تحليل التربة', en: 'Soil analysis', de: 'Bodenanalyse' }, lang);
  const sigSrc = tpl?.engSignature ? resolveImageSrc(tpl.engSignature) : '';
  const stampSrc = tpl?.engStamp ? resolveImageSrc(tpl.engStamp) : '';
  const paidSrc = tpl?.paidStamp ? resolveImageSrc(tpl.paidStamp) : '';
  const headerLogoSrc = tpl?.headerLogo ? resolveImageSrc(tpl.headerLogo) : '';

  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;

    const fit = () => {
      const wh = wrap.clientHeight;
      const ww = wrap.clientWidth;
      const ih = inner.scrollHeight;
      const iw = inner.scrollWidth || ww;
      if (wh < 8 || ih < 8) return;
      /* غطاء كامل للبطاقة — يملأ الارتفاع والعرض */
      const s = Math.max(wh / ih, ww / iw);
      setScale(Math.min(2.4, Math.max(0.85, s)));
    };

    fit();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(fit);
    });
    ro.observe(wrap);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [report.id, lang, rows.length, descTxt, finalTxt, nameTxt, plantTxt]);

  const sectionBar = (label: string) => (
    <div style={{
      fontWeight: 800, color: theme, fontSize: 7.5, margin: '6px 0 3px',
      paddingInlineStart: 4, borderInlineStart: `2.5px solid ${theme}`, lineHeight: 1.2,
    }}>
      {label}
    </div>
  );

  return (
    <div
      ref={wrapRef}
      className="soil-report-live-thumb"
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: '#fff',
        pointerEvents: 'none',
      }}
    >
      <div
        ref={innerRef}
        dir={isRtl ? 'rtl' : 'ltr'}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '8px 9px 10px',
          fontFamily: 'Tajawal, Arial, sans-serif',
          color: '#222',
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          willChange: 'transform',
        }}
      >
        {/* رأس */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          borderBottom: `2.5px solid ${theme}`,
          paddingBottom: 6,
          marginBottom: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, maxWidth: '44%', minWidth: 0 }}>
            {headerLogoSrc ? (
              <img src={headerLogoSrc} alt="" style={{ height: 18, width: 'auto', objectFit: 'contain', display: 'block', flexShrink: 0 }} />
            ) : (
              <AlaaLogo color={logoColor} size={18} style={{ display: 'block' }} />
            )}
            {header ? (
              <div style={{
                fontSize: 6.5, fontWeight: 700, color: theme, lineHeight: 1.2,
                overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {header}
              </div>
            ) : null}
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'end' }}>
            <div style={{
              fontSize: 9, fontWeight: 900, color: theme, lineHeight: 1.25,
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              marginBottom: 4,
            }}>
              {typeTxt}{nameTxt ? ` — ${nameTxt}` : ''}
            </div>
            <div style={{
              display: 'inline-block',
              background: theme,
              color: '#fff',
              fontSize: 6.5,
              fontWeight: 700,
              borderRadius: 8,
              padding: '3px 8px',
              lineHeight: 1.1,
            }}>
              {typeTxt}
            </div>
            {dateTxt ? (
              <div style={{ fontSize: 6, color: '#888', marginTop: 3 }}>{dateTxt}</div>
            ) : null}
          </div>
        </div>

        {sectionBar(Lcust)}
        <div style={{ fontSize: 7, lineHeight: 1.45 }}>
          {nameTxt ? <div><b style={{ color: theme }}>{pickML({ ar: 'الاسم', en: 'Name', de: 'Name' }, lang)}:</b> {nameTxt}</div> : null}
          {report.customerPhone ? (
            <div dir="ltr" style={{ textAlign: isRtl ? 'right' : 'left' }}>
              <b style={{ color: theme }}>{pickML({ ar: 'الهاتف', en: 'Phone', de: 'Tel' }, lang)}:</b> {report.customerPhone}
            </div>
          ) : null}
          {plantTxt ? <div><b style={{ color: theme }}>{pickML({ ar: 'النبات', en: 'Plant', de: 'Pflanze' }, lang)}:</b> {plantTxt}</div> : null}
        </div>

        {descTxt ? (
          <>
            {sectionBar(Ldesc)}
            <div style={{
              fontSize: 6.5, color: '#333', lineHeight: 1.4,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
            }}>
              {descTxt}
            </div>
          </>
        ) : null}

        {rows.length > 0 ? (
          <>
            {sectionBar(Lsoil)}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 6.5 }}>
              <thead>
                <tr style={{ background: theme, color: '#fff' }}>
                  <th style={{ padding: '4px 3px', textAlign: isRtl ? 'right' : 'left', fontWeight: 700 }}>{Ltest}</th>
                  <th style={{ padding: '4px 3px', textAlign: isRtl ? 'right' : 'left', fontWeight: 700 }}>{Lact}</th>
                  <th style={{ padding: '4px 3px', textAlign: isRtl ? 'right' : 'left', fontWeight: 700 }}>{Lideal}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id} style={{ background: i % 2 ? '#f6faf6' : '#fff' }}>
                    <td style={{ padding: '3px', borderBottom: '1px solid #e5efe5', fontWeight: 700 }}>
                      {pickReportML(row.test, lang)}
                    </td>
                    <td style={{ padding: '3px', borderBottom: '1px solid #e5efe5', color: theme, fontWeight: 600 }}>
                      {pickReportML(row.actual, lang)}
                    </td>
                    <td style={{ padding: '3px', borderBottom: '1px solid #e5efe5', color: '#555' }}>
                      {pickReportML(row.ideal, lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        {finalTxt ? (
          <div style={{
            fontSize: 6.5, color: '#333', lineHeight: 1.4, marginTop: 6,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          }}>
            {finalTxt}
          </div>
        ) : null}

        {/* تذييل مباشرة بعد المحتوى */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 6,
          borderTop: `2px solid ${theme}`,
          paddingTop: 6,
          marginTop: 8,
        }}>
          <div style={{ fontSize: 5.5, color: '#888', maxWidth: '40%', lineHeight: 1.3 }}>
            {pickML(tpl?.footerText, lang)}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
            {sigSrc ? (
              <img src={sigSrc} alt="" style={{ height: 16, maxWidth: 40, objectFit: 'contain', display: 'block' }} />
            ) : (
              <div style={{ width: 28, height: 10, borderTop: '1px solid #999' }} />
            )}
            {stampSrc ? (
              <img src={stampSrc} alt="" style={{ height: 22, maxWidth: 26, objectFit: 'contain', display: 'block' }} />
            ) : (
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${theme}`, opacity: 0.5 }} />
            )}
            {paidSrc ? (
              <img src={paidSrc} alt="" style={{ height: 20, maxWidth: 24, objectFit: 'contain', display: 'block' }} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
