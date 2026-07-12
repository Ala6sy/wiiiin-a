import type { CvDoc } from './appData';

export {
  CV_EXPORT_PX,
  CV_EXPORT_SCALE,
  CV_PAGE_H_PX,
  CV_SHEET_INNER_H,
} from './cvConstants';

export function cvLayout(doc: CvDoc) {
  return {
    headerHeightMm: Math.min(55, Math.max(18, doc.headerHeightMm ?? 32)),
    footerHeightMm: Math.min(30, Math.max(8, doc.footerHeightMm ?? 14)),
    headerPhotoSize: Math.min(100, Math.max(40, doc.headerPhotoSize ?? 72)),
    continuedPages: doc.continuedPages ?? {},
  };
}
