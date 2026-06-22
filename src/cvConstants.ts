/** A4 width at 96 CSS px/in — matches cvx-preview-a4 */
export const CV_EXPORT_PX = 794;

/** A4 height at export pixel width */
export const CV_PAGE_H_PX = Math.round(CV_EXPORT_PX * (297 / 210));

export const CV_PAD_Y_PX = Math.round((18 * 2 * 96) / 25.4);

/** Content area inside a4-page padding */
export const CV_SHEET_INNER_H = CV_PAGE_H_PX - CV_PAD_Y_PX;

export const CV_PAGE_STACK_GAP = 16;

/** دقة التصدير — 3 ≈ 300dpi — لقطة مطابقة للمعاينة */
export const CV_EXPORT_SCALE = 3;
