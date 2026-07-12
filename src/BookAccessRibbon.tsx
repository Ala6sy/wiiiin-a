import type { CSSProperties } from 'react';
import type { BookGridSettings, BookRibbonShape } from './appData';

const SHAPE_LABELS: Record<BookRibbonShape, string> = {
  badge: 'شارة',
  corner: 'شريط زاوية',
  pill: 'كبسولة',
  banner: 'شريط علوي',
};

/** شريط مجاني / مدفوع — شكل وألوان قابلة للتخصيص */
export function BookCover({
  src,
  alt,
  placeholderEmoji = '📚',
}: {
  src?: string;
  alt?: string;
  placeholderEmoji?: string;
}) {
  return (
    <div className="book-cover-portrait">
      {src ? (
        <img src={src} alt={alt || ''} loading="lazy" />
      ) : (
        <div className="book-cover-placeholder" aria-hidden>{placeholderEmoji}</div>
      )}
    </div>
  );
}

/** شريط مجاني / مدفوع — شكل وألوان قابلة للتخصيص */
export function BookAccessRibbon({
  isPaid,
  freeLabel,
  paidLabel,
  grid,
}: {
  isPaid: boolean;
  freeLabel: string;
  paidLabel: string;
  grid?: Partial<BookGridSettings>;
}) {
  if (grid?.ribbonVisible === false) return null;

  const shape = grid?.ribbonShape ?? 'badge';
  const opacity = grid?.ribbonOpacity ?? 1;
  const style: CSSProperties = {
    '--rib-free-bg': grid?.ribbonFreeBg ?? '#22c55e',
    '--rib-free-color': grid?.ribbonFreeColor ?? '#ffffff',
    '--rib-paid-bg': grid?.ribbonPaidBg ?? '#f59e0b',
    '--rib-paid-color': grid?.ribbonPaidColor ?? '#1a1a1a',
    '--rib-fs': `${grid?.ribbonFontSize ?? 10}px`,
    opacity,
  } as CSSProperties;

  return (
    <div className={`book-access-ribbon book-access-ribbon--${shape} ${isPaid ? 'is-paid' : 'is-free'}`} style={style} aria-hidden>
      <span className="book-access-ribbon__label">{isPaid ? paidLabel : freeLabel}</span>
    </div>
  );
}

/** لوحة تحكم الشريط في الإدارة */
export function BookRibbonControls({
  grid,
  onChange,
  accent = '#2a7a2a',
}: {
  grid: BookGridSettings;
  onChange: (patch: Partial<BookGridSettings>) => void;
  accent?: string;
}) {
  const shapes: BookRibbonShape[] = ['badge', 'corner', 'pill', 'banner'];
  const shape = grid.ribbonShape ?? 'badge';
  const ribbonVisible = grid.ribbonVisible !== false;
  const ribbonOpacity = grid.ribbonOpacity ?? 1;

  return (
    <div style={{ gridColumn: '1 / -1', background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: 12, border: `1px solid ${accent}33` }}>
      <div style={{ fontWeight: 800, fontSize: 12, color: accent, marginBottom: 10 }}>
        <i className="fa-solid fa-tag" /> شريط مجاني / مدفوع
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#555', cursor: 'pointer' }}>
          <input type="checkbox" checked={ribbonVisible} onChange={e => onChange({ ribbonVisible: e.target.checked })} />
          إظهار الشريط
        </label>
        <label style={{ flex: '1 1 180px', fontSize: 11, fontWeight: 700, color: '#555' }}>
          شفافية: <span style={{ color: accent }}>{Math.round(ribbonOpacity * 100)}%</span>
          <input type="range" min={0} max={100} value={Math.round(ribbonOpacity * 100)}
            onChange={e => onChange({ ribbonOpacity: Number(e.target.value) / 100 })}
            style={{ width: '100%', accentColor: accent, marginTop: 4 }} disabled={!ribbonVisible} />
        </label>
      </div>

      <label style={{ fontSize: 11, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>شكل الشريط</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {shapes.map(s => (
          <button key={s} type="button" onClick={() => onChange({ ribbonShape: s })}
            style={{ padding: '6px 12px', borderRadius: 8, border: `2px solid ${shape === s ? accent : '#ccc'}`, background: shape === s ? accent : '#fff', color: shape === s ? '#fff' : '#555', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            {SHAPE_LABELS[s]}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
        <ColorField label="خلفية مجاني" value={grid.ribbonFreeBg ?? '#22c55e'} onChange={v => onChange({ ribbonFreeBg: v })} />
        <ColorField label="نص مجاني" value={grid.ribbonFreeColor ?? '#ffffff'} onChange={v => onChange({ ribbonFreeColor: v })} />
        <ColorField label="خلفية مدفوع" value={grid.ribbonPaidBg ?? '#f59e0b'} onChange={v => onChange({ ribbonPaidBg: v })} />
        <ColorField label="نص مدفوع" value={grid.ribbonPaidColor ?? '#1a1a1a'} onChange={v => onChange({ ribbonPaidColor: v })} />
      </div>

      <label style={{ fontSize: 11, fontWeight: 700, color: '#555', display: 'block', marginBottom: 4 }}>
        حجم خط الشريط: <span style={{ color: accent }}>{grid.ribbonFontSize ?? 10}px</span>
      </label>
      <input type="range" min={4} max={72} value={grid.ribbonFontSize ?? 10}
        onChange={e => onChange({ ribbonFontSize: Number(e.target.value) })}
        style={{ width: '100%', accentColor: accent, marginBottom: 12 }} />

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', opacity: ribbonVisible ? ribbonOpacity : 0.35 }}>
        <RibbonPreview shape={shape} grid={grid} isPaid={false} label="مجاني" />
        <RibbonPreview shape={shape} grid={grid} isPaid paidLabel="مدفوع" freeLabel="مجاني" />
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 700, color: '#555', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: 36, height: 28, padding: 0, border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer' }} />
        <input type="text" value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1, padding: '4px 6px', border: '1px solid #ccc', borderRadius: 6, fontSize: 11, direction: 'ltr' }} />
      </div>
    </label>
  );
}

function RibbonPreview({
  shape,
  grid,
  isPaid,
  label,
  freeLabel = 'مجاني',
  paidLabel = 'مدفوع',
}: {
  shape: BookRibbonShape;
  grid: BookGridSettings;
  isPaid?: boolean;
  label?: string;
  freeLabel?: string;
  paidLabel?: string;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 72, height: 102, background: 'linear-gradient(135deg,#e8f5e9,#c8e6c9)', borderRadius: 6, overflow: 'hidden', margin: '0 auto 4px', border: '1px solid #a5d6a7' }}>
        <BookAccessRibbon isPaid={!!isPaid} freeLabel={freeLabel} paidLabel={paidLabel} grid={{ ...grid, ribbonShape: shape, ribbonVisible: true }} />
        <BookCover placeholderEmoji="📚" />
      </div>
      <span style={{ fontSize: 10, color: '#888' }}>{label ?? (isPaid ? 'مدفوع' : 'مجاني')}</span>
    </div>
  );
}
