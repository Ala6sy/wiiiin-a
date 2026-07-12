import type { LangKey } from './appData';
import type { CSSProperties } from 'react';
import type { ML } from './appData';
import { buildUnifiedSeasonRows, plantsInline, type UnifiedSeasonPlantRow } from './seasonPlantsTable';
import type { PlantsByCategory } from './plantCategories';

const L = {
  title: { ar: 'النباتات حسب التصنيف', en: 'Plants by category', de: 'Pflanzen nach Kategorie' },
  category: { ar: 'التصنيف', en: 'Category', de: 'Kategorie' },
  plantNow: { ar: 'يُزرع الآن', en: 'Plant now', de: 'Jetzt pflanzen' },
  harvestNow: { ar: 'يُحصد الآن', en: 'Harvest now', de: 'Jetzt ernten' },
};

function t(m: Record<LangKey, string>, lang: LangKey) {
  return m[lang] || m.en;
}

type Props = {
  lang: LangKey;
  plantGroups: PlantsByCategory[];
  harvestGroups: PlantsByCategory[];
  variant?: 'screen' | 'pdf';
  theme?: string;
  pickML?: (m: ML) => string;
};

function rowsFromProps(plantGroups: PlantsByCategory[], harvestGroups: PlantsByCategory[], lang: LangKey) {
  return buildUnifiedSeasonRows(plantGroups, harvestGroups, lang);
}

function ScreenTable({ rows, lang }: { rows: UnifiedSeasonPlantRow[]; lang: LangKey }) {
  if (!rows.length) return null;
  return (
    <div className="season-plant-table-wrap" style={{ marginBottom: 18 }}>
      <h4 className="season-section-title">
        <i className="fa-solid fa-table-list" />
        {t(L.title, lang)}
      </h4>
      <div className="season-plant-table-scroll">
        <table className="season-plant-table season-plant-table-unified">
          <thead>
            <tr>
              <th>{t(L.category, lang)}</th>
              <th>{t(L.plantNow, lang)}</th>
              <th>{t(L.harvestNow, lang)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.category}>
                <td className="season-plant-cat">{r.label}</td>
                <td className="season-plants-inline">{plantsInline(r.plantNow, lang)}</td>
                <td className="season-plants-inline">{plantsInline(r.harvestNow, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PdfTable({
  rows, lang, theme, Lml,
}: {
  rows: UnifiedSeasonPlantRow[];
  lang: LangKey;
  theme: string;
  Lml: (m: ML) => string;
}) {
  const isRtl = lang === 'ar';
  if (!rows.length) return null;
  const cell: CSSProperties = {
    padding: '8px 10px',
    lineHeight: 1.55,
    borderBottom: '1px solid #e0ece0',
    verticalAlign: 'top',
    fontSize: 11.5,
  };
  return (
    <div className="pdf-section" style={{ marginBottom: 16, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
      <div style={{ fontWeight: 900, color: theme, fontSize: 14, marginBottom: 8, paddingInlineStart: 8, borderInlineStart: `4px solid ${theme}` }}>
        {Lml({ ar: L.title.ar, en: L.title.en, de: L.title.de })}
      </div>
      <table dir={isRtl ? 'rtl' : 'ltr'} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
        <thead>
          <tr style={{ background: theme, color: '#fff' }}>
            <th style={{ ...cell, fontWeight: 800, width: '22%', color: '#fff', borderBottom: 'none' }}>{Lml({ ar: L.category.ar, en: L.category.en, de: L.category.de })}</th>
            <th style={{ ...cell, fontWeight: 800, width: '39%', color: '#fff', borderBottom: 'none' }}>{Lml({ ar: L.plantNow.ar, en: L.plantNow.en, de: L.plantNow.de })}</th>
            <th style={{ ...cell, fontWeight: 800, width: '39%', color: '#fff', borderBottom: 'none' }}>{Lml({ ar: L.harvestNow.ar, en: L.harvestNow.en, de: L.harvestNow.de })}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.category} style={{ background: i % 2 ? '#fff' : '#f6faf6' }}>
              <td style={{ ...cell, fontWeight: 800, color: theme }}>{r.label}</td>
              <td style={cell}>{plantsInline(r.plantNow, lang)}</td>
              <td style={cell}>{plantsInline(r.harvestNow, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SeasonPlantsUnifiedTable({
  lang, plantGroups, harvestGroups, variant = 'screen', theme = '#2a7a2a', pickML,
}: Props) {
  const rows = rowsFromProps(plantGroups, harvestGroups, lang);
  if (variant === 'pdf' && pickML) {
    return <PdfTable rows={rows} lang={lang} theme={theme} Lml={pickML} />;
  }
  return <ScreenTable rows={rows} lang={lang} />;
}

export { buildUnifiedSeasonRows, plantsInline };
