import type { ML } from './appData';
import { ml } from './appData';
import { normalizeImageUrlForStorage } from './mediaUrl';
import { callAiJson } from './mlTranslate';

export interface GeneratedArticle {
  title: ML;
  content: ML;
  reference: ML;
  images: string[];
}

function parseMl(raw: unknown): ML {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ml('', '', '');
  const o = raw as Record<string, unknown>;
  return ml(
    String(o.ar ?? o.AR ?? '').trim(),
    String(o.en ?? o.EN ?? o.english ?? '').trim(),
    String(o.de ?? o.DE ?? o.german ?? '').trim(),
  );
}

function normalizeHtml(s: string): string {
  const t = s.trim();
  if (!t) return '';
  if (t.startsWith('<')) return t;
  return `<p>${t.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
}

function parseGenerated(raw: unknown): GeneratedArticle {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('استجابة التوليد غير صالحة');
  }
  const o = raw as Record<string, unknown>;
  const title = parseMl(o.title);
  const content = parseMl(o.content);
  const reference = parseMl(o.reference);
  if (!title.ar || !content.ar) throw new Error('المقالة المُولَّدة ناقصة — حاول مرة أخرى');

  content.ar = normalizeHtml(content.ar);
  content.en = normalizeHtml(content.en);
  content.de = normalizeHtml(content.de);

  const imageUrl = String(o.imageUrl ?? o.image ?? o.image_url ?? '').trim();
  const images = imageUrl && /^https?:\/\//i.test(imageUrl)
    ? [imageUrl.includes('drive.google.com') ? normalizeImageUrlForStorage(imageUrl) : imageUrl]
    : [];

  return { title, content, reference, images };
}

/**
 * توليد مقالة زراعية كاملة (عنوان + محتوى HTML + مرجع + رابط صورة)
 * بالاعتماد على التصنيف وموضوع اختياري.
 */
export async function generateAgriArticle(params: {
  categoryAr: string;
  categoryEn?: string;
  categoryDe?: string;
  customTopic?: string;
}): Promise<GeneratedArticle> {
  const catAr = params.categoryAr.trim();
  if (!catAr) throw new Error('اختر تصنيفاً أولاً');

  const topic = params.customTopic?.trim();
  const catLine = [
    `Arabic: ${catAr}`,
    params.categoryEn ? `English: ${params.categoryEn}` : '',
    params.categoryDe ? `German: ${params.categoryDe}` : '',
  ].filter(Boolean).join(' | ');

  const prompt = `You are an expert agricultural engineer writing educational articles for eng-alaa.com portfolio.

Category: ${catLine}
${topic
    ? `Write specifically about this topic under the category:\n"${topic}"`
    : 'Write a comprehensive, informative article covering key aspects of this category.'}

Requirements:
1. Professional, accurate agricultural/scientific tone.
2. title: object with ar, en, de — concise and engaging.
3. content: object with ar, en, de — HTML only. Use <p>, <h3>, <ul>/<li>, <strong>.
   - Arabic content: 4–8 paragraphs with practical insights.
   - English and German: full translations (not summaries).
   - You may use inline style font-size on elements (e.g. <p style="font-size:14px">).
4. reference: object with ar, en, de — credible source name + URL (FAO, university, research).
5. imageUrl: if you know a Wikimedia Commons direct image URL use it; otherwise empty string (user will upload to Google Drive).

Return ONLY valid JSON (no markdown):
{
  "title": {"ar":"...","en":"...","de":"..."},
  "content": {"ar":"<p>...</p>","en":"<p>...</p>","de":"<p>...</p>"},
  "reference": {"ar":"اسم المصدر — https://...","en":"Source — https://...","de":"Quelle — https://..."},
  "imageUrl": "https://..."
}`;

  const result = await callAiJson<unknown>(prompt);
  return parseGenerated(result);
}
