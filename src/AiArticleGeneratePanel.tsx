import { useState } from 'react';
import type { AgriArticle, ArticleCategory } from './appData';
import { generateAgriArticle } from './aiArticleGenerate';

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #e8f5e9, #f1f8e9)',
  border: '1px solid #81c784',
  borderRadius: 10,
  padding: 14,
  marginBottom: 14,
};

const genBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 16px',
  borderRadius: 8,
  border: 'none',
  background: 'linear-gradient(135deg, #2a7a2a, #3d9a3d)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

export function AiArticleGeneratePanel({
  article,
  categories,
  onGenerated,
}: {
  article: AgriArticle;
  categories: ArticleCategory[];
  onGenerated: (patch: Partial<AgriArticle>) => void;
}) {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const cat = categories.find(c => c.id === article.categoryId);

  async function run() {
    if (!cat) { setErr('اختر تصنيفاً أولاً'); return; }
    const hasContent = !!(article.title.ar?.trim() || article.content.ar?.trim());
    if (hasContent && !confirm('سيستبدل العنوان والمحتوى والمرجع والصورة الحالية. متابعة؟')) return;

    setErr('');
    setLoading(true);
    try {
      const gen = await generateAgriArticle({
        categoryAr: cat.name.ar,
        categoryEn: cat.name.en,
        categoryDe: cat.name.de,
        customTopic: topic,
      });
      onGenerated({
        title: gen.title,
        content: gen.content,
        reference: gen.reference,
        images: gen.images.length ? gen.images : article.images,
      });
      setTopic('');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'فشل توليد المقالة');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 800, fontSize: 13, color: '#1b5e20', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="fa-solid fa-robot" /> توليد المقالة بالذكاء الاصطناعي
      </div>
      <p style={{ fontSize: 11.5, color: '#555', margin: '0 0 10px', lineHeight: 1.6 }}>
        التصنيفات تضعها أنت يدوياً. هنا يولّد الذكاء الاصطناعي <strong>العنوان والمحتوى والمرجع ورابط الصورة</strong> بالعربية والإنجليزية والألمانية — ثم يمكنك التعديل اليدوي.
        {cat ? <> التصنيف الحالي: <strong>{cat.name.ar}</strong>.</> : ' اختر تصنيفاً من القائمة أعلاه.'}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'stretch' }}>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="موضوع محدد (اختياري) — مثال: تقنيات الزراعة المائية في الصحراء"
          dir="rtl"
          style={{
            flex: '1 1 220px',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid #a5d6a7',
            fontFamily: 'inherit',
            fontSize: 13,
            background: '#fff',
          }}
        />
        <button type="button" disabled={loading || !cat} onClick={run} style={{ ...genBtnStyle, opacity: loading || !cat ? 0.65 : 1 }}>
          <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`} />
          {loading ? 'جاري التوليد...' : topic.trim() ? 'توليد عن هذا الموضوع' : 'توليد مقالة عن التصنيف'}
        </button>
      </div>
      {err && <p style={{ fontSize: 11, color: '#c62828', margin: '8px 0 0' }}>{err}</p>}
    </div>
  );
}
