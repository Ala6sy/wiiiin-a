import { callAiJson } from './mlTranslate';

function parseImproved(raw: unknown): string {
  if (typeof raw === 'string') return raw.trim();
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const s = String(o.improved ?? o.suggestion ?? o.text ?? o.ar ?? '').trim();
    if (s) return s;
  }
  throw new Error('لم يُرجع المساعد نصاً صالحاً — حاول مرة أخرى');
}

/** يقترح نصاً عربياً أفضل لحقل في السيرة الذاتية */
export async function improveCvArabicText(text: string, fieldHint?: string): Promise<string> {
  const ar = text.trim();
  if (!ar) throw new Error('أدخل النص بالعربية أولاً');
  const hint = fieldHint ? `\nField context: ${fieldHint}` : '';
  const prompt = `You are a professional CV writing assistant for an Arab agricultural engineer and designer.
Improve the following Arabic CV text: make it more professional, concise, and polished while preserving the exact meaning.
Do NOT invent facts or add information that was not in the original.${hint}
Return ONLY valid JSON (no markdown):
{"improved":"..."}

Arabic text:
${ar}`;
  const result = await callAiJson<unknown>(prompt);
  return parseImproved(result);
}
