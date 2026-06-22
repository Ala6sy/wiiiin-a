import type { LangKey } from './appData';
import { callAiJson } from './mlTranslate';
import type { VisitorGpsLocation } from './visitorLocation';
import { locationLabel } from './visitorLocation';

export interface PlantAiAnswer {
  yes: boolean;
  answer: string;
  plantWhen?: string;
  plantWhere?: string;
}

export async function askCanPlantOrHarvest(
  plantName: string,
  loc: VisitorGpsLocation,
  lang: LangKey,
): Promise<PlantAiAnswer> {
  const region = locationLabel(loc, lang);
  const month = new Date().toLocaleString(
    lang === 'ar' ? 'ar-SY-u-nu-latn' : lang === 'de' ? 'de-DE' : 'en-US',
    { month: 'long' },
  );
  const langName = lang === 'ar' ? 'Arabic' : lang === 'de' ? 'German' : 'English';

  const prompt = `You are an agricultural expert. A visitor in "${region}" (lat ${loc.lat}, lon ${loc.lon}) asks:
"Can I PLANT or HARVEST "${plantName}" NOW (${month})?"

Reply in ${langName}.
Return ONLY valid JSON:
{
  "yes": true or false,
  "answer": "clear answer: can they plant and/or harvest now? (2-3 sentences)",
  "plantWhen": "if yes is false: best month/season to plant OR harvest; else empty string",
  "plantWhere": "if yes is false: nearest suitable region/climate zone/country area (be specific, e.g. coastal Levant, highlands, etc.); else empty string"
}
Be practical for local climate. If partially possible (plant yes harvest no or vice versa), explain in answer and set yes accordingly.`;

  const raw = await callAiJson<{
    yes?: boolean;
    answer?: string;
    plantWhen?: string;
    plantWhere?: string;
  }>(prompt);

  return {
    yes: !!raw.yes,
    answer: String(raw.answer || '').trim() || (lang === 'ar' ? 'لا توجد إجابة' : lang === 'de' ? 'Keine Antwort' : 'No answer'),
    plantWhen: String(raw.plantWhen || '').trim() || undefined,
    plantWhere: String(raw.plantWhere || '').trim() || undefined,
  };
}

/** @deprecated use askCanPlantOrHarvest */
export const askCanPlantNow = askCanPlantOrHarvest;
