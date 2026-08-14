import type { ML } from './appData';

export function getAiProxyUrl(): string {
  return (import.meta.env.VITE_AI_PROXY_URL as string | undefined)
    || '/ai_proxy.php';
}

export async function callAiJson<T>(prompt: string): Promise<T> {
  const res = await fetch(getAiProxyUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  const raw = await res.text();
  let json: { ok?: boolean; error?: string; result?: T };
  try {
    json = JSON.parse(raw) as typeof json;
  } catch {
    if (raw.trimStart().startsWith('<?php') || raw.trimStart().startsWith('<!')) {
      throw new Error(
        import.meta.env.DEV
          ? 'تعذّر الاتصال بـ ai_proxy.php محلياً. أعد تشغيل Vite.'
          : 'خطأ في الخادم: تأكد من رفع ai_proxy.php و config.php.'
      );
    }
    throw new Error('استجابة غير صالحة من خادم الترجمة.');
  }
  if (!res.ok || !json.ok) throw new Error(json?.error || `خطأ في الاتصال (HTTP ${res.status})`);
  return json.result as T;
}

/** قيم افتراضية عند إنشاء تصنيف جديد — تُعتبر فارغة عند الترجمة */
const ML_PLACEHOLDER_VALUES = new Set([
  'new', 'neu', 'sub', 'general', 'allgemein', 'english', 'deutsch',
  'جديد', 'فرعي', 'عام', 'miscellaneous', 'verschiedenes',
]);

export function shouldReplaceTranslation(current: string, arabic: string): boolean {
  const t = (current || '').trim();
  if (!t) return true;
  const ar = (arabic || '').trim();
  if (ar && t === ar) return true;
  if (ML_PLACEHOLDER_VALUES.has(t.toLowerCase())) return true;
  return false;
}

export function mergeMlTranslation(current: ML, tr: { en: string; de: string }, overwrite = false): ML {
  if (overwrite) return { ar: current.ar, en: tr.en, de: tr.de };
  return {
    ar: current.ar,
    en: shouldReplaceTranslation(current.en, current.ar) ? tr.en : current.en,
    de: shouldReplaceTranslation(current.de, current.ar) ? tr.de : current.de,
  };
}

function parseEnDe(raw: unknown): { en: string; de: string } {
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (s.startsWith('{')) {
      try { return parseEnDe(JSON.parse(s)); } catch { /* fall through */ }
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('الترجمة غير مكتملة — حاول مرة أخرى');
  }
  const o = raw as Record<string, unknown>;
  const en = String(o.en ?? o.EN ?? o.english ?? o.English ?? '').trim();
  const de = String(o.de ?? o.DE ?? o.german ?? o.German ?? o.deutsch ?? '').trim();
  if (en && de) return { en, de };
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      try { return parseEnDe(v); } catch { /* try next */ }
    }
  }
  throw new Error('الترجمة غير مكتملة — حاول مرة أخرى');
}

/** ترجمة نص عربي واحد → إنجليزي + ألماني */
export async function translateTextFromArabic(ar: string, context?: string): Promise<{ en: string; de: string }> {
  const text = ar.trim();
  if (!text) throw new Error('أدخل النص بالعربية أولاً');
  const ctx = context ? `\nContext: ${context}` : '';
  const prompt = `You are a professional translator for an engineering/agriculture portfolio website.
Translate the Arabic text below to English (en) and German (de).${ctx}
Return ONLY valid JSON (no markdown fences):
{"en":"...","de":"..."}

Arabic:
${text}`;
  const result = await callAiJson<unknown>(prompt);
  return parseEnDe(result);
}

/** ترجمة حقول ML متعددة دفعة واحدة */
export async function translateMlFieldsFromArabic(
  fields: Record<string, string>,
  options?: { htmlKeys?: string[]; context?: string },
): Promise<Record<string, { en: string; de: string }>> {
  const entries = Object.entries(fields).filter(([, v]) => v.trim());
  if (!entries.length) throw new Error('أدخل النص بالعربية أولاً');
  const htmlKeys = new Set(options?.htmlKeys || []);
  const ctx = options?.context ? `\nContext: ${options.context}` : '';
  const fieldList = entries.map(([k, v]) => {
    const htmlNote = htmlKeys.has(k) ? ' (preserve ALL HTML tags exactly)' : '';
    return `"${k}": ${JSON.stringify(v)}${htmlNote}`;
  }).join('\n');
  const prompt = `Translate these Arabic fields to English and German for a professional website.${ctx}
For each field return {"en":"...","de":"..."}.
If a field contains HTML, keep every tag/attribute unchanged — translate visible text only.
Return ONLY valid JSON object keyed by field name:
{
  "fieldName": {"en":"...","de":"..."}
}

Fields:
${fieldList}`;
  const result = await callAiJson<unknown>(prompt);
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('استجابة ترجمة غير صالحة');
  }
  const map = result as Record<string, unknown>;
  const out: Record<string, { en: string; de: string }> = {};
  for (const [key] of entries) {
    const raw = map[key] ?? map[key.replace(/_/g, '-')] ?? map[key.replace(/-/g, '_')];
    if (!raw) throw new Error(`ترجمة غير مكتملة للحقل: ${key}`);
    out[key] = parseEnDe(raw);
  }
  return out;
}

const BATCH_SIZE = 18;

function chunkEntries<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** ترجمة دفعات كبيرة — يقسّم الطلب تلقائياً */
export async function translateMlFieldsBatched(
  fields: Record<string, string>,
  options?: { htmlKeys?: string[]; context?: string; onProgress?: (done: number, total: number) => void },
): Promise<Record<string, { en: string; de: string }>> {
  const entries = Object.entries(fields).filter(([, v]) => v.trim());
  if (!entries.length) throw new Error('لا توجد نصوص عربية للترجمة');
  const merged: Record<string, { en: string; de: string }> = {};
  const batches = chunkEntries(entries, BATCH_SIZE);
  for (let i = 0; i < batches.length; i++) {
    const part = await translateMlFieldsFromArabic(Object.fromEntries(batches[i]), options);
    Object.assign(merged, part);
    options?.onProgress?.(Math.min((i + 1) * BATCH_SIZE, entries.length), entries.length);
  }
  return merged;
}

export async function translateArticleFromArabic(
  title: string,
  content: string,
  reference: string,
): Promise<{ title: { en: string; de: string }; content: { en: string; de: string }; reference: { en: string; de: string } }> {
  const fields: Record<string, string> = {};
  if (title.trim()) fields.title = title.trim();
  if (content.trim()) fields.content = content.trim();
  if (reference.trim()) fields.reference = reference.trim();
  const tr = await translateMlFieldsFromArabic(fields, {
    htmlKeys: content.trim() ? ['content'] : [],
    context: 'agriculture article',
  });
  return {
    title: tr.title || { en: '', de: '' },
    content: tr.content || { en: '', de: '' },
    reference: tr.reference || { en: '', de: '' },
  };
}
