import type { CSSProperties, Ref } from 'react';
import type { AppData, LangKey, ML } from './appData';
import { ml, pickML } from './appData';
import { AlaaLogo } from './AlaaLogo';
import { formatWesternDate, formatWesternNum } from './formatLocale';
import type { PlantsByCategory } from './plantCategories';
import type { SeasonWeather } from './seasonWeather';
import type { VisitorGpsLocation } from './visitorLocation';
import { locationLabel } from './visitorLocation';
import type { PlantAiAnswer } from './seasonPlantAi';
import { SeasonPlantsUnifiedTable } from './SeasonPlantsUnifiedTable';
import { resolveImageSrc } from './mediaUrl';

const FALLBACK_GREEN = '#2a7a2a';

const LBL = {
  reportTitle: ml('تقرير موسمك الآن', 'Your Season Now Report', 'Saisonbericht'),
  region: ml('المنطقة', 'Region', 'Region'),
  coords: ml('الإحداثيات', 'Coordinates', 'Koordinaten'),
  weather: ml('الطقس الحالي', 'Current Weather', 'Aktuelles Wetter'),
  temp: ml('الحرارة', 'Temperature', 'Temperatur'),
  humidity: ml('الرطوبة', 'Humidity', 'Luftfeuchtigkeit'),
  wind: ml('الرياح', 'Wind', 'Wind'),
  guide: ml('إرشادات الزراعة والحصاد', 'Planting & harvest guidelines', 'Anbau- & Ernte-Hinweise'),
  consult: ml('الاستشارة الزراعية', 'Agricultural consultation', 'Landwirtschaftliche Beratung'),
  question: ml('السؤال', 'Question', 'Frage'),
  answer: ml('الإجابة', 'Answer', 'Antwort'),
  when: ml('الموعد المناسب', 'Best time', 'Beste Zeit'),
  where: ml('أقرب منطقة مناسبة', 'Nearest suitable region', 'Nächste geeignete Region'),
  date: ml('التاريخ', 'Date', 'Datum'),
  engSignature: ml('التوقيع', 'Signature', 'Unterschrift'),
};

export interface SeasonReportPayload {
  loc: VisitorGpsLocation;
  weather: SeasonWeather | null;
  plantGroups: PlantsByCategory[];
  harvestGroups: PlantsByCategory[];
  guide: string;
  aiConsult?: { plantName: string; result: PlantAiAnswer };
}

const a4Base: CSSProperties = {
  width: 794,
  background: '#fff',
  padding: 36,
  boxSizing: 'border-box',
  fontFamily: 'Tajawal, sans-serif',
  color: '#222',
};

function docBase(width: number): CSSProperties {
  return { ...a4Base, width };
}

export function SeasonReportDoc({
  data,
  lang,
  report,
  innerRef,
  forExport,
  docWidth = 794,
}: {
  data: AppData;
  lang: LangKey;
  report: SeasonReportPayload;
  innerRef?: Ref<HTMLDivElement>;
  forExport?: boolean;
  docWidth?: number;
}) {
  const isRtl = lang === 'ar';
  const L = (m: ML) => pickML(m, lang);
  const tpl = data.reportTemplate;
  const theme = (tpl?.themeColor || FALLBACK_GREEN).trim() || FALLBACK_GREEN;
  const headerText = pickML(tpl?.headerText, lang);
  const footerText = pickML(tpl?.footerText, lang);
  const engNameDisplay = pickML(tpl?.engName, lang)
    || (lang === 'de' ? 'Ing. Alaa Ahmad Almasri' : lang === 'ar' ? 'م. علاء أحمد المصري' : 'Eng. Alaa Ahmad Almasri');
  const engNameColor = tpl?.engNameColor || '#003366';
  const pageBg = tpl?.pageBgColor || '#ffffff';
  const stampAlign = tpl?.stampAlign || 'right';
  const st = data.siteSettings;
  const todayStr = formatWesternDate(lang);
  const { loc, weather, plantGroups, harvestGroups, guide, aiConsult } = report;

  const docStyle: CSSProperties = forExport
    ? { ...docBase(docWidth), background: pageBg }
    : { ...docBase(docWidth), background: pageBg, minHeight: docWidth >= 794 ? 1123 : Math.round(1123 * (docWidth / 794)), display: 'flex', flexDirection: 'column' };

  return (
    <div ref={innerRef} style={docStyle} dir={isRtl ? 'rtl' : 'ltr'} className="season-report-print-root">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `3px solid ${theme}`, paddingBottom: 14, marginBottom: 18, gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {tpl?.headerLogo
            ? <img className="plant-report-header-logo" src={resolveImageSrc(tpl.headerLogo)} alt="logo" style={{ height: 58, objectFit: 'contain' }} />
            : st?.logoType === 'svg_alaa' || (!st?.logoType && !st?.logoImg)
              ? <AlaaLogo className="plant-report-alaa-logo" color={engNameColor} size={58} />
              : st?.logoType === 'image' && st?.logoImg
                ? <img className="plant-report-header-logo" src={st.logoImg} alt="logo" style={{ height: 58, objectFit: 'contain' }} />
                : <div style={{ fontWeight: 900, color: engNameColor, fontSize: 22 }}>{pickML(st?.logoText, lang) || 'م. علاء'}</div>}
          <div>
            <div style={{ fontWeight: 800, color: engNameColor, fontSize: 14, lineHeight: 1.3 }}>{engNameDisplay}</div>
            {headerText && <div style={{ fontWeight: 600, color: theme, fontSize: 12, lineHeight: 1.4, marginTop: 2 }}>{headerText}</div>}
          </div>
        </div>
        <div style={{ textAlign: isRtl ? 'left' : 'right', flexShrink: 0 }}>
          <div style={{ fontWeight: 900, color: theme, fontSize: 17 }}>{L(LBL.reportTitle)}</div>
          <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>{L(LBL.date)}: {todayStr}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <Field label={L(LBL.region)} value={locationLabel(loc, lang)} icon="fa-map-pin" accent={theme} />
        <Field label={L(LBL.coords)} value={`${formatWesternNum(loc.lat, 4)}° · ${formatWesternNum(loc.lon, 4)}°`} icon="fa-location-crosshairs" accent={theme} ltr />
      </div>

      {weather && (
        <div className="pdf-section" style={{ marginBottom: 16, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <div style={{ fontWeight: 900, color: theme, fontSize: 14, marginBottom: 8 }}>
            <i className="fa-solid fa-cloud-sun" /> {L(LBL.weather)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <Field label={L(LBL.temp)} value={`${formatWesternNum(weather.temperature)}°C`} icon="fa-temperature-half" accent={theme} />
            <Field label={L(LBL.humidity)} value={`${formatWesternNum(weather.humidity, 0)}%`} icon="fa-droplet" accent={theme} />
            <Field label={L(LBL.wind)} value={`${formatWesternNum(weather.windSpeed)} ${weather.windUnit}`} icon="fa-wind" accent={theme} />
          </div>
        </div>
      )}

      <SeasonPlantsUnifiedTable
        lang={lang}
        plantGroups={plantGroups}
        harvestGroups={harvestGroups}
        variant="pdf"
        theme={theme}
        pickML={L}
      />

      {guide && (
        <div className="pdf-section" style={{ marginBottom: 16, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <div style={{ fontWeight: 900, color: theme, fontSize: 14, marginBottom: 8, paddingInlineStart: 8, borderInlineStart: `4px solid ${theme}` }}>
            {L(LBL.guide)}
          </div>
          <div style={{ background: '#f7faf7', border: '1px solid #e0ece0', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
            {guide}
          </div>
        </div>
      )}

      {aiConsult && (
        <div className="pdf-section" style={{ marginBottom: 16, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
          <div style={{ fontWeight: 900, color: theme, fontSize: 14, marginBottom: 8, paddingInlineStart: 8, borderInlineStart: `4px solid ${theme}` }}>
            <i className="fa-solid fa-leaf" /> {L(LBL.consult)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Field label={L(LBL.question)} value={aiConsult.plantName} icon="fa-seedling" accent={theme} />
            <Field
              label={L(LBL.answer)}
              value={`${aiConsult.result.yes ? '✓ ' : '✗ '}${aiConsult.result.answer}`}
              icon="fa-comment-dots"
              accent={theme}
            />
            {!aiConsult.result.yes && aiConsult.result.plantWhen && (
              <Field label={L(LBL.when)} value={aiConsult.result.plantWhen} icon="fa-calendar" accent={theme} />
            )}
            {!aiConsult.result.yes && aiConsult.result.plantWhere && (
              <Field label={L(LBL.where)} value={aiConsult.result.plantWhere} icon="fa-map-location-dot" accent={theme} />
            )}
          </div>
        </div>
      )}

      {(() => {
        const sigStamp = (
          <div style={{ display: 'flex', gap: 30, alignItems: 'flex-end' }}>
            <div style={{ textAlign: 'center', minWidth: 130 }}>
              {tpl?.engSignature
                ? <img src={resolveImageSrc(tpl.engSignature)} alt="" style={{ maxHeight: 64, maxWidth: 150, objectFit: 'contain' }} />
                : <div style={{ height: 64 }} />}
              <div style={{ borderTop: '1px solid #999', marginTop: 4, paddingTop: 5, fontSize: 11, fontWeight: 700, color: '#444' }}>{L(LBL.engSignature)}</div>
            </div>
            {tpl?.engStamp && (
              <div style={{ textAlign: 'center' }}>
                <img src={resolveImageSrc(tpl.engStamp)} alt="" style={{ maxHeight: 84, maxWidth: 120, objectFit: 'contain' }} />
              </div>
            )}
          </div>
        );
        const footerLine = <div style={{ fontSize: 11, color: '#666', maxWidth: '46%', lineHeight: 1.7 }}>{footerText}</div>;
        return (
          <div className="pdf-section" style={{
            marginTop: forExport ? 28 : 'auto',
            borderTop: `2px solid ${theme}`,
            paddingTop: 16,
            breakInside: 'avoid',
            pageBreakInside: 'avoid',
            display: 'flex',
            flexDirection: stampAlign === 'center' ? 'column' : 'row',
            alignItems: stampAlign === 'center' ? 'center' : 'flex-end',
            justifyContent: stampAlign === 'center' ? 'center' : (stampAlign === 'left' ? 'flex-start' : 'space-between'),
            gap: 18,
          }}>
            {stampAlign === 'center' ? <>{footerLine}{sigStamp}</> :
             stampAlign === 'left' ? <>{sigStamp}{footerLine}</> :
             <>{footerLine}{sigStamp}</>}
          </div>
        );
      })()}
    </div>
  );
}

function Field({ label, value, icon, accent, ltr }: { label: string; value?: string; icon: string; accent: string; ltr?: boolean }) {
  const display = value?.trim() || '—';
  return (
    <div style={{ background: '#f7faf7', border: '1px solid #e0ece0', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: '#8a9a8a', marginBottom: 3 }}>
        <i className={`fa-solid ${icon}`} style={{ color: accent }} /> {label}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1d3a1d', direction: ltr ? 'ltr' : undefined, wordBreak: 'break-word' }}>{display}</div>
    </div>
  );
}
