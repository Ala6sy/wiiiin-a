import { useEffect, useRef, useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { isHexColor } from './siteThemeOptions';

/** ألوان سريعة للنقر — اختصار فقط، ليس قائمة ثابتة */
export const QUICK_SWATCHES = [
  '#003366', '#0b2a4a', '#2563eb', '#0ea5e9', '#0d9488', '#7c3aed',
  '#ffffff', '#f8fafc', '#e8f0ff', '#dfe9f8', '#5b9bff', '#111827',
] as const;

export type ThemeColorPickerProps = {
  label: string;
  value: string;
  defaultValue: string;
  onChange: (v: string) => void;
  hint?: string;
  /** عند true: يمكن ترك القيمة فارغة = تلقائي */
  allowAuto?: boolean;
  /** لون المعاينة عند الوضع التلقائي */
  previewWhenAuto?: string;
};

function normalizeHex(v: string, fallback: string): string {
  const t = (v || '').trim();
  if (isHexColor(t)) return t.length === 4
    ? `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`
    : t.toLowerCase();
  return fallback;
}

export function ThemeColorPicker({
  label, value, defaultValue, onChange, hint, allowAuto, previewWhenAuto = '#003366',
}: ThemeColorPickerProps) {
  const isAuto = allowAuto && !(value || '').trim();
  const displayHex = isAuto ? previewWhenAuto : normalizeHex(value, previewWhenAuto);
  const [hexInput, setHexInput] = useState(displayHex);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHexInput(isAuto ? '' : normalizeHex(value, previewWhenAuto));
  }, [value, isAuto, previewWhenAuto]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const applyHex = (raw: string) => {
    const t = raw.trim();
    if (isHexColor(t)) {
      const full = normalizeHex(t, previewWhenAuto);
      onChange(full);
      setHexInput(full);
    } else {
      setHexInput(t);
    }
  };

  const reset = () => {
    onChange(defaultValue);
    setHexInput(defaultValue || '');
    setOpen(false);
  };

  return (
    <div className="form-group theme-color-picker" style={{ marginBottom: 14 }} ref={wrapRef}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: hint ? 4 : 8 }}>
        <label className="admin-surface-label">{label}</label>
        <button
          type="button"
          className="btn-outline-sm admin-surface-btn"
          onClick={reset}
          title="إعادة هذا اللون للوضع الافتراضي"
          style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
        >
          <i className="fa-solid fa-rotate-left" /> افتراضي
        </button>
      </div>
      {hint && <div className="admin-surface-hint">{hint}</div>}

      {allowAuto && (
        <label className="admin-surface-auto-label">
          <input
            type="checkbox"
            checked={isAuto}
            onChange={e => {
              if (e.target.checked) onChange('');
              else onChange(displayHex);
            }}
            style={{ accentColor: '#003366', width: 16, height: 16 }}
          />
          تلقائي حسب الثيم (موصى به)
        </label>
      )}

      {!isAuto && (
        <>
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              title="فتح لوحة الألوان"
              style={{
                width: 52, height: 44, borderRadius: 10, flexShrink: 0, cursor: 'pointer',
                background: displayHex,
                border: '2px solid #b8c8dc',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)',
              }}
            />
            <input
              type="text"
              className="admin-surface-input"
              value={hexInput}
              placeholder="#003366"
              dir="ltr"
              onChange={e => {
                setHexInput(e.target.value);
                if (isHexColor(e.target.value.trim())) applyHex(e.target.value);
              }}
              onBlur={() => {
                if (isHexColor(hexInput.trim())) applyHex(hexInput);
                else setHexInput(displayHex);
              }}
            />
            <input
              type="color"
              value={isHexColor(displayHex) ? displayHex : previewWhenAuto}
              onChange={e => applyHex(e.target.value)}
              title="منتقي ألوان النظام"
              style={{ width: 44, height: 44, borderRadius: 8, border: '1px solid #c5d0e0', cursor: 'pointer', padding: 2 }}
            />
          </div>

          {open && (
            <div className="admin-surface-popover">
              <HexColorPicker
                color={displayHex}
                onChange={c => applyHex(c)}
                style={{ width: '100%', height: 160 }}
              />
              <div className="admin-surface-hint" style={{ marginTop: 8, textAlign: 'center' }}>
                اسحب داخل اللوحة أو على شريط التدرج لاختيار أي لون
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {QUICK_SWATCHES.map(c => (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => applyHex(c)}
                style={{
                  width: 22, height: 22, borderRadius: 6, background: c, cursor: 'pointer', padding: 0,
                  border: displayHex.toLowerCase() === c.toLowerCase() ? '2px solid #003366' : '1px solid #ccd6e4',
                  boxShadow: c === '#ffffff' || c === '#f8fafc' ? 'inset 0 0 0 1px #ccc' : undefined,
                }}
              />
            ))}
          </div>
        </>
      )}

      {isAuto && (
        <div className="admin-surface-auto-box">
          <span style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: previewWhenAuto, border: '1px solid #c5d0e0',
          }} />
          اللون يُحسب تلقائياً من الثيم — ألغِ «تلقائي» لتخصيصه يدوياً
        </div>
      )}
    </div>
  );
}

export const DEFAULT_THEME_COLOR_FIELDS = {
  accentColor: '#003366',
  menuTextColor: '',
  buttonBgColor: '',
  buttonTextColor: '',
  gfxFreeDownloadBtnColor: '',
  logoColor: '',
  bodyTextColor: '',
  headingTextColor: '',
  mutedTextColor: '',
} as const;
