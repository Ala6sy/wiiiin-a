/** إعدادات خطوط مشتركة لشبكات العرض */
export interface GridFontSettings {
  titleFontSize: number;
  descFontSize: number;
  tagFontSize: number;
  autoScaleFont: boolean;
}

export const DEFAULT_GRID_FONTS: GridFontSettings = {
  titleFontSize: 13,
  descFontSize: 12,
  tagFontSize: 10,
  autoScaleFont: true,
};

/** تصغير الخط تلقائياً عند زيادة عدد الأعمدة */
export function effectiveFontSize(base: number, cols: number, autoScale: boolean): number {
  if (!autoScale || !base) return base;
  const scale = cols <= 2 ? 1 : cols <= 3 ? 0.95 : cols <= 5 ? 0.88 : cols <= 7 ? 0.8 : 0.72;
  return Math.max(4, Math.round(base * scale));
}

export function gridFontCssVars(
  g: GridFontSettings & { colsDesktop: number; colsMobile: number },
  prefix: string,
): Record<string, string> {
  const auto = g.autoScaleFont !== false;
  return {
    [`--${prefix}-title-d`]: `${effectiveFontSize(g.titleFontSize ?? 13, g.colsDesktop, auto)}px`,
    [`--${prefix}-title-m`]: `${effectiveFontSize(g.titleFontSize ?? 13, g.colsMobile, auto)}px`,
    [`--${prefix}-desc-d`]: `${effectiveFontSize(g.descFontSize ?? 12, g.colsDesktop, auto)}px`,
    [`--${prefix}-desc-m`]: `${effectiveFontSize(g.descFontSize ?? 12, g.colsMobile, auto)}px`,
    [`--${prefix}-tag-d`]: `${effectiveFontSize(g.tagFontSize ?? 10, g.colsDesktop, auto)}px`,
    [`--${prefix}-tag-m`]: `${effectiveFontSize(g.tagFontSize ?? 10, g.colsMobile, auto)}px`,
  };
}
