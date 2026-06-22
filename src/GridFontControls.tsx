import type { CSSProperties } from 'react';
import type { BookGridSettings, ArticleGridSettings, GfxGridSettings, WebGridSettings } from './appData';
import { gridFontCssVars, effectiveFontSize, type GridFontSettings } from './gridSettings';

export function GridFontControls({
  value,
  onChange,
  accent = '#2a7a2a',
}: {
  value: GridFontSettings & { colsDesktop: number; colsMobile: number };
  onChange: (patch: Partial<GridFontSettings>) => void;
  accent?: string;
}) {
  const title = value.titleFontSize ?? 13;
  const desc = value.descFontSize ?? 12;
  const tag = value.tagFontSize ?? 10;
  const auto = value.autoScaleFont !== false;
  return (
    <div style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.65)', borderRadius: 10, padding: 12, border: `1px solid ${accent}33` }}>
      <div style={{ fontWeight: 800, fontSize: 12, color: accent, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span><i className="fa-solid fa-font" /> أحجام الخطوط</span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#555', cursor: 'pointer' }}>
          <input type="checkbox" checked={auto} onChange={e => onChange({ autoScaleFont: e.target.checked })} />
          تصغير تلقائي عند زيادة الأعمدة
        </label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#555', display: 'block', marginBottom: 4 }}>عنوان: <span style={{ color: accent }}>{title}px</span></label>
          <input type="range" min={4} max={72} value={title} onChange={e => onChange({ titleFontSize: Number(e.target.value) })} style={{ width: '100%', accentColor: accent }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#555', display: 'block', marginBottom: 4 }}>وصف: <span style={{ color: accent }}>{desc}px</span></label>
          <input type="range" min={4} max={72} value={desc} onChange={e => onChange({ descFontSize: Number(e.target.value) })} style={{ width: '100%', accentColor: accent }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#555', display: 'block', marginBottom: 4 }}>شارات/وسوم: <span style={{ color: accent }}>{tag}px</span></label>
          <input type="range" min={4} max={72} value={tag} onChange={e => onChange({ tagFontSize: Number(e.target.value) })} style={{ width: '100%', accentColor: accent }} />
        </div>
      </div>
    </div>
  );
}

export function BookActionFontControls({
  value,
  onChange,
  accent = '#2a7a2a',
}: {
  value: Pick<BookGridSettings, 'previewBtnFontSize' | 'downloadBtnFontSize' | 'colsDesktop' | 'colsMobile' | 'autoScaleFont'>;
  onChange: (patch: Partial<BookGridSettings>) => void;
  accent?: string;
}) {
  const preview = value.previewBtnFontSize ?? 12;
  const download = value.downloadBtnFontSize ?? 12;
  return (
    <div style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.65)', borderRadius: 10, padding: 12, border: `1px solid ${accent}33` }}>
      <div style={{ fontWeight: 800, fontSize: 12, color: accent, marginBottom: 10 }}>
        <i className="fa-solid fa-hand-pointer" /> خط أزرار المعاينة والتحميل
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#555', display: 'block', marginBottom: 4 }}>معاينة الكتاب: <span style={{ color: accent }}>{preview}px</span></label>
          <input type="range" min={4} max={72} value={preview} onChange={e => onChange({ previewBtnFontSize: Number(e.target.value) })} style={{ width: '100%', accentColor: accent }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#555', display: 'block', marginBottom: 4 }}>تحميل الكتاب: <span style={{ color: accent }}>{download}px</span></label>
          <input type="range" min={4} max={72} value={download} onChange={e => onChange({ downloadBtnFontSize: Number(e.target.value) })} style={{ width: '100%', accentColor: accent }} />
        </div>
      </div>
    </div>
  );
}

export function responsiveGridColumns(colsDesktop: number, colsMobile: number, isMobile: boolean): string {
  const n = isMobile ? colsMobile : colsDesktop;
  return `repeat(${n}, minmax(0, 1fr))`;
}

function withResponsiveLayout(
  base: CSSProperties,
  colsDesktop: number,
  colsMobile: number,
  gap: number,
  paddingMobile: number,
  isMobile: boolean,
): CSSProperties {
  return {
    ...base,
    gridTemplateColumns: responsiveGridColumns(colsDesktop, colsMobile, isMobile),
    gap,
    ...(isMobile ? { paddingInline: paddingMobile } : {}),
  };
}

export function bookGridStyle(g: BookGridSettings): CSSProperties {
  return {
    '--bgs-cols-d': g.colsDesktop,
    '--bgs-cols-m': g.colsMobile,
    '--bgs-gap': `${g.gap}px`,
    '--bgs-pad': `${g.paddingMobile}px`,
    '--bgs-card-w': `${g.cardWidth ?? 100}px`,
    '--bgs-img-h': `${g.imgHeight}px`,
    '--bgs-btn-preview-d': `${effectiveFontSize(g.previewBtnFontSize ?? 12, g.colsDesktop, g.autoScaleFont !== false)}px`,
    '--bgs-btn-preview-m': `${effectiveFontSize(g.previewBtnFontSize ?? 12, g.colsMobile, g.autoScaleFont !== false)}px`,
    '--bgs-btn-download-d': `${effectiveFontSize(g.downloadBtnFontSize ?? 12, g.colsDesktop, g.autoScaleFont !== false)}px`,
    '--bgs-btn-download-m': `${effectiveFontSize(g.downloadBtnFontSize ?? 12, g.colsMobile, g.autoScaleFont !== false)}px`,
    '--rib-opacity': String(g.ribbonOpacity ?? 1),
    ...gridFontCssVars(g as GridFontSettings & { colsDesktop: number; colsMobile: number }, 'bgs'),
  } as CSSProperties;
}

export function bookGridStyleResponsive(g: BookGridSettings, isMobile: boolean): CSSProperties {
  return withResponsiveLayout(bookGridStyle(g), g.colsDesktop, g.colsMobile, g.gap, g.paddingMobile, isMobile);
}

export function articleGridStyle(g: ArticleGridSettings): CSSProperties {
  return {
    '--ags-cols-d': g.colsDesktop,
    '--ags-cols-m': g.colsMobile,
    '--ags-gap': `${g.gap}px`,
    '--ags-pad': `${g.paddingMobile}px`,
    '--ags-img-h': `${g.imgHeight}px`,
    '--ags-card-w': `${g.cardMinWidth}px`,
    '--ags-excerpt-lines': g.excerptLines ?? 3,
    ...gridFontCssVars(g, 'ags'),
  } as CSSProperties;
}

export function articleGridStyleResponsive(g: ArticleGridSettings, isMobile: boolean): CSSProperties {
  return withResponsiveLayout(articleGridStyle(g), g.colsDesktop, g.colsMobile, g.gap, g.paddingMobile, isMobile);
}

export function gfxGridStyle(g: GfxGridSettings): CSSProperties {
  return {
    '--gfx-cols-d': g.colsDesktop,
    '--gfx-cols-m': g.colsMobile,
    '--gfx-gap': `${g.gap}px`,
    '--gfx-pad': `${g.paddingMobile ?? 8}px`,
    '--gfx-img-h': `${g.imgHeight ?? 195}px`,
    '--gfx-card-w': `${g.cardMinWidth ?? 200}px`,
    ...gridFontCssVars(g as GridFontSettings & { colsDesktop: number; colsMobile: number }, 'gfx'),
  } as CSSProperties;
}

export function gfxGridStyleResponsive(g: GfxGridSettings, isMobile: boolean): CSSProperties {
  return withResponsiveLayout(
    gfxGridStyle(g),
    g.colsDesktop,
    g.colsMobile,
    g.gap,
    g.paddingMobile ?? 8,
    isMobile,
  );
}

export function webGridStyle(g: WebGridSettings): CSSProperties {
  return {
    '--wpg-cols-d': g.colsDesktop,
    '--wpg-cols-m': g.colsMobile,
    '--wpg-gap': `${g.gap}px`,
    '--wpg-pad': `${g.paddingMobile ?? 8}px`,
    '--wpg-min': `${g.cardMinWidth}px`,
    '--wpg-img-h': `${g.imgHeight ?? 220}px`,
    ...gridFontCssVars(g as GridFontSettings & { colsDesktop: number; colsMobile: number }, 'wpg'),
  } as CSSProperties;
}

export function webGridStyleResponsive(g: WebGridSettings, isMobile: boolean): CSSProperties {
  return withResponsiveLayout(
    webGridStyle(g),
    g.colsDesktop,
    g.colsMobile,
    g.gap,
    g.paddingMobile ?? 8,
    isMobile,
  );
}

export function bookRibbonVars(g: BookGridSettings): CSSProperties {
  return {
    '--rib-free-bg': g.ribbonFreeBg ?? '#22c55e',
    '--rib-free-color': g.ribbonFreeColor ?? '#ffffff',
    '--rib-paid-bg': g.ribbonPaidBg ?? '#f59e0b',
    '--rib-paid-color': g.ribbonPaidColor ?? '#1a1a1a',
    '--rib-fs': `${g.ribbonFontSize ?? 10}px`,
    '--rib-opacity': String(g.ribbonOpacity ?? 1),
  } as CSSProperties;
}
