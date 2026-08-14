import { useState } from 'react';
import type { GfxCategory, GfxProjectItem, GfxSubCategory, ML, Skill } from './appData';
import { suggestGfxProject } from './aiGfxProjectSuggest';
import {
  createGfxSeedProject,
  getSuggestedFileLabelForSub,
  getSuggestedToolsForSub,
} from './gfxProjectSeeds';

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #e8eef8, #f0f4ff)',
  border: '1px solid #90a8d8',
  borderRadius: 10,
  padding: 12,
  marginBottom: 12,
};

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 14px',
  borderRadius: 8,
  border: 'none',
  background: 'linear-gradient(135deg, #003366, #1a5490)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

function matchSkillIds(tools: string[], skills: Skill[]): string[] {
  const ids: string[] = [];
  for (const tool of tools) {
    const key = tool.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const hit = skills.find(s => {
      const n = (s.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      return n && (n.includes(key) || key.includes(n));
    });
    if (hit && !ids.includes(hit.id)) ids.push(hit.id);
  }
  return ids;
}

function appendDesignNotes(desc: ML, notes: ML): ML {
  const join = (base: string, extra: string) => {
    const b = (base || '').trim();
    const e = (extra || '').trim();
    if (!e) return b;
    if (!b) return e;
    if (b.includes(e)) return b;
    return `${b}\n\n— ${e}`;
  };
  return { ar: join(desc.ar, notes.ar), en: join(desc.en, notes.en), de: join(desc.de, notes.de) };
}

/** اقتراح سريع للعنوان والوصف والأدوات — AI أو قالب محلي */
export function GfxAiSuggestPanel({
  project,
  category,
  subCategory,
  skills,
  onSuggested,
}: {
  project: GfxProjectItem;
  category: GfxCategory | undefined;
  subCategory: GfxSubCategory | undefined;
  skills: Skill[];
  onSuggested: (patch: Partial<GfxProjectItem>) => void;
}) {
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function runAi() {
    if (!category || !subCategory) {
      setErr('اختر تصنيفاً وفرعاً أولاً');
      return;
    }
    const hasContent = !!(project.title.ar?.trim() || project.desc.ar?.trim());
    if (hasContent && !confirm('سيستبدل العنوان والوصف الحاليين. متابعة؟')) return;

    setErr('');
    setLoading(true);
    try {
      const gen = await suggestGfxProject({
        categoryAr: category.name.ar,
        categoryEn: category.name.en,
        categoryDe: category.name.de,
        subAr: subCategory.name.ar,
        subEn: subCategory.name.en,
        subDe: subCategory.name.de,
        customHint: hint,
        existingTitle: project.title.ar,
      });
      onSuggested({
        title: gen.title,
        desc: appendDesignNotes(gen.desc, gen.designNotes),
        sourceFileLabel: gen.sourceFileLabel,
        usedSkillsIds: matchSkillIds(gen.suggestedTools, skills),
      });
      setHint('');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'فشل الاقتراح بالذكاء الاصطناعي');
    } finally {
      setLoading(false);
    }
  }

  function runLocal() {
    if (!category || !subCategory) {
      setErr('اختر تصنيفاً وفرعاً أولاً');
      return;
    }
    const index = subCategory.items.findIndex(i => i.id === project.id);
    const seed = createGfxSeedProject(category, subCategory, index >= 0 ? index : subCategory.items.length);
    const tools = getSuggestedToolsForSub(subCategory.id);
    onSuggested({
      title: seed.title,
      desc: seed.desc,
      sourceFileLabel: getSuggestedFileLabelForSub(subCategory.id),
      usedSkillsIds: matchSkillIds(tools, skills),
    });
    setErr('');
  }

  return (
    <div className="admin-light-panel" style={panelStyle}>
      <div style={{ fontWeight: 800, fontSize: 12, color: '#003366', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="fa-solid fa-wand-magic-sparkles" /> اقتراح العنوان والتصميم والوصف
      </div>
      <p style={{ fontSize: 11, color: '#555', margin: '0 0 8px', lineHeight: 1.55 }}>
        يملأ العنوان والوصف بالعربية والإنجليزية والألمانية، ويقترح نوع ملف التصميم (PSD/DWG…) والبرامج المستخدمة.
        {category && subCategory ? (
          <> التصنيف: <strong>{category.name.ar}</strong> → <strong>{subCategory.name.ar}</strong>.</>
        ) : ' اختر تصنيفاً وفرعاً.'}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch', marginBottom: 8 }}>
        <input
          type="text"
          value={hint}
          onChange={e => setHint(e.target.value)}
          placeholder="توجيه اختياري — مثال: فيلا فاخرة بحديقة مسبح، أو بزنس كارد لشركة هندسية"
          dir="rtl"
          style={{
            flex: '1 1 200px',
            padding: '7px 10px',
            borderRadius: 8,
            border: '1px solid #b0c4e8',
            fontFamily: 'inherit',
            fontSize: 12,
            color: '#0a1a2e',
            background: '#fff',
          }}
        />
        <button type="button" disabled={loading || !category || !subCategory} onClick={runAi} style={{ ...btnStyle, opacity: loading || !category || !subCategory ? 0.65 : 1 }}>
          <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-robot'}`} />
          {loading ? 'جاري الاقتراح...' : 'اقتراح بالذكاء الاصطناعي'}
        </button>
        <button type="button" disabled={!category || !subCategory} onClick={runLocal}
          style={{ ...btnStyle, background: 'linear-gradient(135deg, #6a0dad, #8e44cc)', opacity: !category || !subCategory ? 0.65 : 1 }}>
          <i className="fa-solid fa-bolt" /> اقتراح سريع (قالب)
        </button>
      </div>
      {err && <p style={{ fontSize: 11, color: '#c62828', margin: 0 }}>{err}</p>}
    </div>
  );
}
