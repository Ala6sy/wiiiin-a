import { useState } from 'react';
import type { ML } from './appData';
import { translateTextFromArabic } from './mlTranslate';
import { improveCvArabicText } from './cvAiImprove';

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #8d69bd',
  background: '#24143b',
  color: '#ffffff',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
};

/** مساعد AI — يقترح نصاً عربياً أفضل ثم يترجم للإنجليزية والألمانية */
export function CvAiImproveButton({
  arabic,
  onApplied,
  fieldHint,
  small,
  disabled,
}: {
  arabic: string;
  onApplied: (v: ML) => void;
  fieldHint?: string;
  small?: boolean;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [err, setErr] = useState('');

  async function run() {
    setErr('');
    setLoading(true);
    try {
      const improved = await improveCvArabicText(arabic, fieldHint);
      setSuggestion(improved);
      setOpen(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'فشل المساعد');
    } finally {
      setLoading(false);
    }
  }

  async function accept() {
    const ar = suggestion.trim();
    if (!ar) return;
    setLoading(true);
    setErr('');
    try {
      const tr = await translateTextFromArabic(ar, fieldHint ? `CV ${fieldHint}` : 'CV resume');
      onApplied({ ar, en: tr.en, de: tr.de });
      setOpen(false);
    } catch (e: unknown) {
      onApplied({ ar, en: '', de: '' });
      setErr(e instanceof Error ? e.message : 'تم حفظ العربية — أعد الترجمة يدوياً');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
        <button
          type="button"
          className="cv-ai-improve-btn"
          disabled={disabled || loading || !arabic.trim()}
          onClick={run}
          style={{
            ...btnStyle,
            fontSize: small ? 10 : 11,
            padding: small ? '3px 8px' : btnStyle.padding,
            opacity: loading && !open ? 0.7 : 1,
          }}
          title="يقترح نصاً عربياً أفضل — يمكنك تعديله قبل القبول، ثم يُترجم تلقائياً"
        >
          <i className={`fa-solid ${loading && !open ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`} />
          {loading && !open ? 'جاري التحسين...' : 'مساعد السيرة'}
        </button>
        {err && !open && <span style={{ fontSize: 10, color: '#e57373' }}>{err}</span>}
      </span>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="glass"
            style={{
              width: 'min(520px, 100%)',
              padding: 20,
              borderRadius: 14,
              direction: 'rtl',
              boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h4 style={{ margin: '0 0 8px', fontSize: 16, color: '#4a148c' }}>
              <i className="fa-solid fa-wand-magic-sparkles" style={{ marginInlineEnd: 8 }} />
              اقتراح المساعد — عدّل النص ثم اضغط قبول
            </h4>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#666' }}>
              سيُحفظ النص العربي ويُترجم تلقائياً للإنجليزية والألمانية.
            </p>
            <textarea
              rows={5}
              value={suggestion}
              onChange={e => setSuggestion(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: 10,
                borderRadius: 8,
                border: '1px solid #ccc',
                fontFamily: 'inherit',
                fontSize: 14,
                direction: 'rtl',
                resize: 'vertical',
              }}
            />
            {err && <p style={{ margin: '8px 0 0', fontSize: 11, color: '#e57373' }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-outline-sm"
                disabled={loading}
                onClick={() => setOpen(false)}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="btn-primary-sm"
                disabled={loading || !suggestion.trim()}
                onClick={accept}
                style={{ background: '#4a148c', borderColor: '#4a148c' }}
              >
                {loading ? (
                  <><i className="fa-solid fa-spinner fa-spin" /> جاري الحفظ والترجمة...</>
                ) : (
                  <><i className="fa-solid fa-check" /> قبول وترجمة</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
