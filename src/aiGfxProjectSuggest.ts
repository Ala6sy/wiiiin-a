import type { ML } from './appData';
import { ml } from './appData';
import { callAiJson } from './mlTranslate';

export interface GfxProjectSuggestion {
  title: ML;
  desc: ML;
  suggestedTools: string[];
  sourceFileLabel: string;
  designNotes: ML;
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

function parseSuggestion(raw: unknown): GfxProjectSuggestion {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('استجابة الاقتراح غير صالحة');
  }
  const o = raw as Record<string, unknown>;
  const title = parseMl(o.title);
  const desc = parseMl(o.desc ?? o.description);
  const designNotes = parseMl(o.designNotes ?? o.design ?? o.notes);
  if (!title.ar || !desc.ar) throw new Error('الاقتراح ناقص — حاول مرة أخرى');

  const toolsRaw = o.suggestedTools ?? o.tools ?? o.software;
  const suggestedTools = Array.isArray(toolsRaw)
    ? toolsRaw.map(t => String(t).trim()).filter(Boolean)
    : String(toolsRaw ?? '').split(/[,،|]/).map(s => s.trim()).filter(Boolean);

  const sourceFileLabel = String(o.sourceFileLabel ?? o.fileLabel ?? o.fileType ?? 'PSD').trim().slice(0, 12) || 'PSD';

  return { title, desc, designNotes, suggestedTools, sourceFileLabel };
}

/** اقتراح عنوان ووصف وتفاصيل تصميم لمشروع معرض التصاميم */
export async function suggestGfxProject(params: {
  categoryAr: string;
  categoryEn?: string;
  categoryDe?: string;
  subAr: string;
  subEn?: string;
  subDe?: string;
  customHint?: string;
  existingTitle?: string;
}): Promise<GfxProjectSuggestion> {
  const catLine = [
    `Arabic: ${params.categoryAr}`,
    params.categoryEn ? `English: ${params.categoryEn}` : '',
    params.categoryDe ? `German: ${params.categoryDe}` : '',
  ].filter(Boolean).join(' | ');

  const subLine = [
    `Arabic: ${params.subAr}`,
    params.subEn ? `English: ${params.subEn}` : '',
    params.subDe ? `German: ${params.subDe}` : '',
  ].filter(Boolean).join(' | ');

  const hint = params.customHint?.trim();
  const existing = params.existingTitle?.trim();

  const prompt = `You are a senior graphic/landscape/interior designer writing portfolio entries for eng-alaa.com.

Main category: ${catLine}
Sub-category: ${subLine}
${existing ? `Current draft title (improve or replace): "${existing}"` : ''}
${hint ? `Specific design direction from user:\n"${hint}"` : 'Suggest a distinctive, professional portfolio project for this sub-category.'}

Requirements:
1. title: object {ar, en, de} — concise portfolio project name (not generic).
2. desc: object {ar, en, de} — 2–4 sentences describing the design concept, materials, colors, and client/use case. Plain text (no HTML).
3. designNotes: object {ar, en, de} — brief bullet-style notes (as one paragraph) about layout, dimensions, deliverables, or visual style.
4. suggestedTools: array of 2–5 software names (e.g. Photoshop, Illustrator, AutoCAD, 3ds Max, Lumion, After Effects, Cinema 4D, InDesign, Figma).
5. sourceFileLabel: short file type label for the source design file (PSD, AI, DWG, MAX, C4D, AEP, SKP, FIG).

Return ONLY valid JSON:
{
  "title": {"ar":"...","en":"...","de":"..."},
  "desc": {"ar":"...","en":"...","de":"..."},
  "designNotes": {"ar":"...","en":"...","de":"..."},
  "suggestedTools": ["Photoshop","Illustrator"],
  "sourceFileLabel": "PSD"
}`;

  const result = await callAiJson<unknown>(prompt);
  return parseSuggestion(result);
}
