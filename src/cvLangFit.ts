import type { CvTypography } from './appData';
import { CV_TYPO_PX_MIN, mergeCvTypography } from './appData';

function scalePx(v: number, factor: number, min = CV_TYPO_PX_MIN): number {
  return Math.max(min, Math.round(v * factor * 2) / 2);
}

/** تصغير خطوط/مسافات السيرة لتقليل عدد الصفحات (en/de) */
export function scaleCvTypography(
  base: Required<CvTypography>,
  factor: number,
): Required<CvTypography> {
  const f = Math.max(0.65, Math.min(1, factor));
  if (f >= 0.999) return base;
  return {
    ...base,
    sectionTitlePx: scalePx(base.sectionTitlePx, f),
    bodyPx: scalePx(base.bodyPx, f),
    orgPx: scalePx(base.orgPx, f),
    entryTitlePx: scalePx(base.entryTitlePx, f),
    namePx: scalePx(base.namePx, f, 16),
    subtitlePx: scalePx(base.subtitlePx, f),
    datePx: scalePx(base.datePx, f, 8),
    sectionGapPx: scalePx(base.sectionGapPx, f, 6),
    dateTitleGapPx: scalePx(base.dateTitleGapPx, f, 2),
    titleOrgGapPx: scalePx(base.titleOrgGapPx, f, 2),
    entryDetailsGapPx: scalePx(base.entryDetailsGapPx, f, 2),
    entryGapPx: scalePx(base.entryGapPx, f, 4),
    sectionInnerGapPx: scalePx(base.sectionInnerGapPx, f, 3),
    skillIconNameGapPx: scalePx(base.skillIconNameGapPx, f, 2),
    skillNamePctGapPx: scalePx(base.skillNamePctGapPx, f, 2),
    skillHeaderBarGapPx: scalePx(base.skillHeaderBarGapPx, f, 1),
    skillRowGapPx: scalePx(base.skillRowGapPx, f, 2),
    sideLabelPx: scalePx(base.sideLabelPx, f),
    sideValuePx: scalePx(base.sideValuePx, f),
    tagsPx: scalePx(base.tagsPx, f, 8),
    contactGapPx: scalePx(base.contactGapPx, f, 3),
    tagsGapPx: scalePx(base.tagsGapPx, f, 3),
    lineHeight: Math.max(1.22, Math.round(base.lineHeight * (0.8 + f * 0.2) * 100) / 100),
  };
}

export function baseCvTypography(doc: { typography?: CvTypography }): Required<CvTypography> {
  return mergeCvTypography(doc.typography);
}

/** ضغط en/de حتى صفحة واحدة قدر الإمكان */
export function shouldCompressCvForLang(lang: string, pages: number, bodyH: number): boolean {
  if (lang === 'ar') return false;
  return pages > 1 && bodyH > 0;
}

export const CV_LANG_FIT_MIN = 0.65;
