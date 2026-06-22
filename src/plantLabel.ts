import type { LangKey } from './appData';
import type { PlantEntry } from './seasonPlantsExtended';

/** اسم النبات بلغة الواجهة — بدون خلط عربي/إنجليزي */
export function plantLabel(entry: PlantEntry, lang: LangKey): string {
  const v = entry[lang]?.trim();
  if (v) return v;
  if (lang === 'ar') return entry.ar?.trim() || entry.en?.trim() || '';
  if (lang === 'de') return entry.de?.trim() || entry.en?.trim() || entry.ar?.trim() || '';
  return entry.en?.trim() || entry.ar?.trim() || '';
}
