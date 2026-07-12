import type { Skill } from './appData';
import type { GfxDownloadLink } from './gfxDownloadLinks';
import { newGfxDownloadLink } from './gfxDownloadLinks';
import { SkillIcon } from './SkillIcon';

const QUICK_LABELS = ['GLB', 'STL', 'PSD', 'DWG', 'PDF', 'ZIP', 'C4D', 'ملف أصلي'];

function LinkRow({
  link, index, total, onChange, onRemove, onMove, skillLabels,
}: {
  link: GfxDownloadLink;
  index: number;
  total: number;
  onChange: (l: GfxDownloadLink) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  skillLabels: { name: string; icon: string }[];
}) {
  const chips = [
    ...QUICK_LABELS,
    ...skillLabels.map(s => s.name).filter(n => !QUICK_LABELS.some(q => q.toLowerCase() === n.toLowerCase())),
  ];

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #c8dff5', padding: '8px 10px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#003366', flex: 1 }}>
          <i className="fa-solid fa-link" /> رابط {index + 1}
        </span>
        <button type="button" className="btn-outline-sm" title="أعلى" disabled={index === 0}
          onClick={() => onMove(-1)} style={{ width: 26, height: 24, padding: 0, fontSize: 10 }}>
          <i className="fa-solid fa-chevron-up" />
        </button>
        <button type="button" className="btn-outline-sm" title="أسفل" disabled={index >= total - 1}
          onClick={() => onMove(1)} style={{ width: 26, height: 24, padding: 0, fontSize: 10 }}>
          <i className="fa-solid fa-chevron-down" />
        </button>
        <button type="button" className="btn-danger-sm" title="حذف" onClick={onRemove}
          style={{ width: 26, height: 24, padding: 0, fontSize: 10 }}>
          <i className="fa-solid fa-trash" />
        </button>
      </div>

      <div style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 10, color: '#223344' }}>اسم الملف (يظهر للزائر)</label>
        <input type="text" value={link.label} placeholder="مثال: GLB أو Cinema 4D"
          style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid #c8dff5', fontSize: 11 }}
          onChange={e => onChange({ ...link, label: e.target.value })} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, maxHeight: 72, overflowY: 'auto' }}>
          {chips.map(lbl => (
            <button key={lbl} type="button" onClick={() => onChange({ ...link, label: lbl })}
              style={{ fontSize: 9, padding: '2px 6px', borderRadius: 5, border: '1px solid #c8dff5', background: link.label === lbl ? '#e8f0ff' : '#fff', color: '#003366', cursor: 'pointer' }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 10, color: '#223344' }}>رابط Google Drive</label>
        <input type="url" value={link.url} placeholder="https://drive.google.com/file/d/.../view"
          style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid #c8dff5', fontSize: 11, direction: 'ltr', color: '#003366' }}
          onChange={e => onChange({ ...link, url: e.target.value })} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>
          <input type="checkbox" checked={!!link.isPaid} onChange={e => onChange({ ...link, isPaid: e.target.checked })} />
          {link.isPaid ? '💰 مدفوع' : '🎁 مجاني'}
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={link.visible !== false} onChange={e => onChange({ ...link, visible: e.target.checked })} />
          ظاهر للزوار
        </label>
      </div>

      {link.isPaid ? (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input type="text" value={link.price || ''} placeholder="السعر"
            style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #c8dff5', fontSize: 11 }}
            onChange={e => onChange({ ...link, price: e.target.value })} />
          <select value={link.currency || 'USD'} onChange={e => onChange({ ...link, currency: e.target.value })}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #c8dff5', fontSize: 11 }}>
            {['USD', 'EUR', 'SYP', 'SAR', 'AED', 'EGP', 'IQD', 'JOD', 'TRY', 'GBP'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label style={{ fontSize: 10, color: '#223344' }}>
          <i className="fa-solid fa-lock" /> كلمة سر (اختياري)
        </label>
        <input type="text" value={link.password || ''} placeholder="فارغ = تنزيل مباشر"
          style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid #c8dff5', fontSize: 11, fontFamily: 'monospace' }}
          onChange={e => onChange({ ...link, password: e.target.value })} />
      </div>
    </div>
  );
}

export function GfxDownloadLinksEditor({
  links,
  skills = [],
  onChange,
}: {
  links: GfxDownloadLink[];
  skills?: Skill[];
  onChange: (links: GfxDownloadLink[]) => void;
}) {
  const skillLabels = skills.map(s => ({ name: s.name, icon: s.icon }));

  const patch = (idx: number, next: GfxDownloadLink) => {
    const copy = [...links];
    copy[idx] = next;
    onChange(copy);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= links.length) return;
    const copy = [...links];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    onChange(copy);
  };

  const addLink = () => onChange([...links, newGfxDownloadLink()]);

  return (
    <div style={{ marginBottom: 10, background: '#f0f7ff', borderRadius: 10, padding: '10px 12px', border: '1px solid #c8dff5' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 11, color: '#003366' }}>
          <i className="fa-solid fa-download" /> روابط تحميل الملفات
          {links.length > 0 && <span style={{ fontWeight: 500, color: '#556677', marginInlineStart: 6 }}>({links.length})</span>}
        </div>
        <button type="button" className="btn-prime btn-sm" style={{ fontSize: 10, padding: '4px 10px' }}
          onClick={addLink}>
          <i className="fa-solid fa-plus" /> إضافة رابط
        </button>
      </div>
      <p style={{ fontSize: 10, color: '#556677', margin: '0 0 8px', lineHeight: 1.5 }}>
        أضف ملفات متعددة — مجانية أو مدفوعة. أسماء البرامج من «إدارة المهارات» تظهر كاختصارات سريعة.
      </p>

      {skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8, padding: '6px 8px', background: '#fff', borderRadius: 8, border: '1px dashed #c8dff5' }}>
          <span style={{ fontSize: 9, color: '#556677', width: '100%', marginBottom: 2 }}>برامج من إدارة المهارات:</span>
          {skills.map(sk => (
            <span key={sk.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, padding: '2px 6px', borderRadius: 5, background: '#f5f8ff', border: '1px solid #dde8f5', color: '#003366' }}>
              <SkillIcon icon={sk.icon} name={sk.name} size={14} />
              {sk.name}
            </span>
          ))}
        </div>
      )}

      {links.length === 0 && (
        <p style={{ fontSize: 10, color: '#8899aa', textAlign: 'center', padding: '12px 0', margin: 0 }}>
          لا توجد روابط — اضغط «إضافة رابط»
        </p>
      )}

      {links.map((link, i) => (
        <LinkRow
          key={link.id}
          link={link}
          index={i}
          total={links.length}
          skillLabels={skillLabels}
          onChange={l => patch(i, l)}
          onRemove={() => onChange(links.filter((_, j) => j !== i))}
          onMove={dir => move(i, dir)}
        />
      ))}
    </div>
  );
}
