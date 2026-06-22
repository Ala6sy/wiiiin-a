import type { CvDoc, LangKey } from './appData';
import { cvDocLabel } from './appData';
import { getCvPdfUrl, downloadCvPdfFile } from './cvPdfDownload';

/** نص نافذة اختيار لغة السيرة — حسب لغة الموقع */
export const CV_LANG_PICKER_PROMPT: Record<LangKey, string> = {
  ar: 'اختر لغة السيرة الذاتية للطباعة / PDF:',
  en: 'Choose the CV language to print / save as PDF:',
  de: 'Wählen Sie die Sprache des Lebenslaufs zum Drucken / PDF:',
};

export const CV_LANG_PICKER_CANCEL: Record<LangKey, string> = {
  ar: 'إلغاء',
  en: 'Cancel',
  de: 'Abbrechen',
};

/** دائماً نافذة اختيار اللغة (عربي · إنجليزي · ألماني) */
export function resolveVisitorCvDownloadLang(): 'picker' {
  return 'picker';
}

export function visitorCvFileName(doc: CvDoc, dlLang: LangKey): string {
  const safeName = (cvDocLabel(doc, dlLang) || doc.id || 'cv').replace(/\s+/g, '_');
  return `CV_${safeName}_${dlLang}.pdf`;
}

/** تنزيل PDF مرفوع أو من Google Drive — يُرجع false إن لم يوجد رابط */
export async function downloadVisitorCvPdf(doc: CvDoc, dlLang: LangKey): Promise<boolean> {
  const url = getCvPdfUrl(doc, dlLang);
  if (!url) return false;
  await downloadCvPdfFile(url, visitorCvFileName(doc, dlLang));
  return true;
}
