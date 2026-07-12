import {
  CvContinuedPages, CvDoc, CvFooterLayout, CvHeaderStyle, CvSection, LangKey, pickML,
} from './appData';
import { cvLayout } from './cvPdfExport';

export type { CvHeaderStyle };

export type ResolvedPageBands = {
  hideHeader: boolean;
  hideFooter: boolean;
  useFirstPageHeader: boolean;
  useFirstPageFooter: boolean;
  headerText: string;
  headerBg: string;
  headerStyle: CvHeaderStyle;
  headerBarWidthPct: number;
  headerHeightMm: number;
  footerBg: string;
  footerTxt: string;
  footerLayout: CvFooterLayout;
  footerBarWidthPct: number;
  footerTextInside: boolean;
  footerHeightMm: number;
};

export function mergeContinuedPages(base: CvContinuedPages, override?: CvContinuedPages): CvContinuedPages {
  if (!override) return { ...base };
  return { ...base, ...override };
}

/** إعدادات الصفحة 2+ — فهرس 0 = الصفحة 2 */
export function contSettingsForPage(pageIndex: number, doc: CvDoc, fallback?: CvContinuedPages): CvContinuedPages {
  const base = fallback ?? doc.continuedPages ?? {};
  if (pageIndex <= 0) return base;
  return mergeContinuedPages(base, doc.pageOverrides?.[pageIndex - 1]);
}

export function resolvePageBands(pageIndex: number, doc: CvDoc, lang: LangKey): ResolvedPageBands {
  const layout = cvLayout(doc);
  const accent = doc.globalColor || doc.accent || '#003366';
  const page1FooterBg = doc.footerBgColor || '#003366';
  const page1FooterTxt = pickML(doc.footerText, lang) || 'eng-alaa.com';
  const page1Layout = doc.footerLayout ?? 'content-full';
  const page1BarW = doc.footerBarWidthPct ?? 55;
  const page1TextIn = doc.footerTextInside === true;

  if (pageIndex <= 0) {
    return {
      hideHeader: false,
      hideFooter: false,
      useFirstPageHeader: true,
      useFirstPageFooter: true,
      headerText: '',
      headerBg: accent,
      headerStyle: 'line',
      headerBarWidthPct: 55,
      headerHeightMm: layout.headerHeightMm,
      footerBg: page1FooterBg,
      footerTxt: page1FooterTxt,
      footerLayout: page1Layout,
      footerBarWidthPct: page1BarW,
      footerTextInside: page1TextIn,
      footerHeightMm: layout.footerHeightMm,
    };
  }

  const cont = contSettingsForPage(pageIndex, doc);
  const useFirstPageHeader = cont.useFirstPageHeader === true;
  const useFirstPageFooter = cont.useFirstPageFooter === true;
  const headerStyle = (['line', 'bar', 'full-bleed'] as CvHeaderStyle[]).includes(cont.headerStyle as CvHeaderStyle)
    ? (cont.headerStyle as CvHeaderStyle)
    : 'line';

  return {
    hideHeader: cont.hideHeader === true,
    hideFooter: cont.hideFooter === true,
    useFirstPageHeader,
    useFirstPageFooter,
    headerText: pickML(cont.headerText, lang) || pickML(doc.fullName, lang) || '',
    headerBg: cont.headerBgColor || accent,
    headerStyle,
    headerBarWidthPct: Math.min(100, Math.max(25, cont.headerBarWidthPct ?? 55)),
    headerHeightMm: cont.headerHeightMm ?? layout.headerHeightMm,
    footerBg: useFirstPageFooter ? page1FooterBg : (cont.footerBgColor || page1FooterBg),
    footerTxt: useFirstPageFooter ? page1FooterTxt : (pickML(cont.footerText, lang) || page1FooterTxt),
    footerLayout: useFirstPageFooter ? page1Layout : (cont.footerLayout ?? page1Layout),
    footerBarWidthPct: useFirstPageFooter ? page1BarW : (cont.footerBarWidthPct ?? page1BarW),
    footerTextInside: useFirstPageFooter ? page1TextIn : (cont.footerTextInside ?? page1TextIn),
    footerHeightMm: cont.footerHeightMm ?? layout.footerHeightMm,
  };
}

export function needsFullHeaderMeasure(doc: CvDoc): boolean {
  if (doc.continuedPages?.useFirstPageHeader) return true;
  return (doc.pageOverrides ?? []).some(o => o?.useFirstPageHeader);
}

/** تقدير الصفحة التي يبدأ فيها كل قسم (للمحرر) */
export function computeSectionPages(sections: CvSection[]): Map<string, number> {
  const map = new Map<string, number>();
  let autoPage = 1;
  for (const sec of sections) {
    if (sec.kind === 'header') continue;
    if (!sec.visible) continue;
    if (typeof sec.editorPage === 'number' && sec.editorPage >= 1) {
      map.set(sec.id, sec.editorPage);
      continue;
    }
    if (sec.pageBreakBefore && map.size > 0) autoPage += 1;
    map.set(sec.id, autoPage);
  }
  return map;
}

export function sectionBelongsToEditorPage(
  sec: CvSection,
  editorPageNum: number,
  sectionPages: Map<string, number>,
): boolean {
  const p = sec.editorPage ?? sectionPages.get(sec.id) ?? 1;
  return p === editorPageNum;
}
