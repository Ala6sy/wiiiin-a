import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface AppPickerOption<T extends string = string> {
  value: T;
  label: string;
}

export function AppPicker<T extends string>({
  value,
  options,
  onChange,
  className = '',
  'aria-label': ariaLabel,
}: {
  value: T;
  options: AppPickerOption<T>[];
  onChange: (v: T) => void;
  className?: string;
  'aria-label'?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selected = options.find(o => o.value === value) || options[0];

  return (
    <div ref={rootRef} className={`app-picker${open ? ' open' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="app-picker-btn"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen(o => !o)}
      >
        <span className="app-picker-label">{selected?.label}</span>
        <i className={`fa-solid fa-chevron-${open ? 'up' : 'down'}`} aria-hidden />
      </button>
      {open && (
        <ul className="app-picker-menu" role="listbox">
          {options.map(o => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                className={`app-picker-option${o.value === value ? ' active' : ''}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** نافذة مشاركة ثابتة — لا تُحرّك الصفحة تحتها */
export function ReportShareOverlay({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    const sb = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (sb > 0) document.body.style.paddingRight = `${sb}px`;
    return () => {
      document.body.style.overflow = prev;
      document.body.style.paddingRight = prevPad;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="season-share-overlay" onClick={onClose} role="presentation">
      <div className="season-share-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>,
    document.body,
  );
}
