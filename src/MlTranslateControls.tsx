import { useState } from 'react';
import type { ML } from './appData';
import { mergeMlTranslation, translateMlFieldsBatched, translateMlFieldsFromArabic, translateTextFromArabic } from './mlTranslate';

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '4px 10px',
  borderRadius: 6,
  border: '1px solid #7eb8ff',
  background: 'linear-gradient(135deg, #e8f2ff, #d4e8ff)',
  color: '#003366',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
};

const btnDarkStyle: React.CSSProperties = {
  ...btnStyle,
  border: '1px solid rgba(120,200,120,0.5)',
  background: 'rgba(80,160,80,0.2)',
  color: '#b8f0b8',
};

/** زر ترجمة نص عربي واحد */
export function MlTranslateButton({
  arabic,
  onTranslated,
  label = 'ترجمة تلقائية',
  dark,
  small,
  context,
  disabled,
}: {
  arabic: string;
  onTranslated: (tr: { en: string; de: string }) => void;
  label?: string;
  dark?: boolean;
  small?: boolean;
  context?: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function run() {
    setErr('');
    setLoading(true);
    try {
      const tr = await translateTextFromArabic(arabic, context);
      onTranslated(tr);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'فشلت الترجمة');
    } finally {
      setLoading(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
      <button type="button" disabled={disabled || loading || !arabic.trim()} onClick={run}
        style={{ ...dark ? btnDarkStyle : btnStyle, fontSize: small ? 10 : 11, padding: small ? '3px 8px' : btnStyle.padding, opacity: loading ? 0.7 : 1 }}
        title="يملأ الإنجليزية والألمانية من العربية — يمكنك التعديل بعدها">
        <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-language'}`} />
        {loading ? 'جاري الترجمة...' : label}
      </button>
      {err && <span style={{ fontSize: 10, color: '#e57373' }}>{err}</span>}
    </span>
  );
}

/** زر ترجمة كائن ML كامل من العربية */
export function MlObjectTranslateButton({
  value,
  onChange,
  dark,
  small,
  context,
  overwrite,
}: {
  value: ML;
  onChange: (v: ML) => void;
  dark?: boolean;
  small?: boolean;
  context?: string;
  overwrite?: boolean;
}) {
  return (
    <MlTranslateButton
      arabic={value.ar || ''}
      dark={dark}
      small={small}
      context={context}
      onTranslated={tr => onChange(mergeMlTranslation(value, tr, overwrite))}
    />
  );
}

/** ترجمة حقول ML متعددة (عنوان + وصف...) */
export function MlFieldsTranslateButton({
  fields,
  onFieldTranslated,
  label = 'ترجمة الكل من العربية',
  dark,
  htmlKeys,
  context,
}: {
  fields: Record<string, ML>;
  onFieldTranslated: (key: string, tr: { en: string; de: string }) => void;
  label?: string;
  dark?: boolean;
  htmlKeys?: string[];
  context?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const arFields: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v.ar?.trim()) arFields[k] = v.ar.trim();
  }

  async function run() {
    setErr('');
    setLoading(true);
    try {
      const tr = await translateMlFieldsFromArabic(arFields, { htmlKeys, context });
      for (const [key, t] of Object.entries(tr)) onFieldTranslated(key, t);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'فشلت الترجمة');
    } finally {
      setLoading(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
      <button type="button" disabled={loading || !Object.keys(arFields).length} onClick={run}
        style={{ ...(dark ? btnDarkStyle : btnStyle), opacity: loading ? 0.7 : 1 }}
        title="يملأ EN و DE من العربية لجميع الحقول">
        <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`} />
        {loading ? 'جاري الترجمة...' : label}
      </button>
      {err && <span style={{ fontSize: 10, color: dark ? '#ffb4b4' : '#c62828' }}>{err}</span>}
    </span>
  );
}

/** زر ترجمة شاملة — يترجم كل الحقول العربية دفعة واحدة (مع تقسيم تلقائي) */
export function MlBulkTranslateButton({
  fields,
  onComplete,
  label = 'ترجمة شاملة للكل',
  dark,
  htmlKeys,
  context,
}: {
  fields: Record<string, string>;
  onComplete: (translations: Record<string, { en: string; de: string }>) => void;
  label?: string;
  dark?: boolean;
  htmlKeys?: string[];
  context?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [err, setErr] = useState('');
  const count = Object.values(fields).filter(v => v.trim()).length;

  async function run() {
    setErr('');
    setProgress('');
    setLoading(true);
    try {
      const tr = await translateMlFieldsBatched(fields, {
        htmlKeys,
        context,
        onProgress: (done, total) => setProgress(`${done}/${total}`),
      });
      onComplete(tr);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'فشلت الترجمة الشاملة');
    } finally {
      setLoading(false);
      setProgress('');
    }
  }

  const bulkStyle: React.CSSProperties = {
    ...(dark ? btnDarkStyle : btnStyle),
    padding: '6px 14px',
    fontSize: 12,
    border: dark ? '1px solid rgba(120,200,120,0.6)' : '1px solid #003366',
    background: dark ? 'rgba(60,140,60,0.35)' : 'linear-gradient(135deg, #003366, #0055aa)',
    color: dark ? '#e8ffe8' : '#fff',
  };

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
      <button type="button" disabled={loading || count === 0} onClick={run} style={{ ...bulkStyle, opacity: loading ? 0.75 : 1 }}
        title="يترجم كل النصوص العربية ويملأ خانات EN و DE">
        <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-globe'}`} />
        {loading ? `جاري الترجمة ${progress ? `(${progress})` : '...'}` : label}
        {!loading && count > 0 && <span style={{ opacity: 0.85, fontWeight: 600 }}>({count})</span>}
      </button>
      {err && <span style={{ fontSize: 10, color: dark ? '#ffb4b4' : '#c62828' }}>{err}</span>}
    </span>
  );
}
