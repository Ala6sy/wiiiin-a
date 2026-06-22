import type { AppData, CvDocPlacements, CvShowWhere } from './appData';
import {
  CV_PLACEMENT_LABELS,
  cvPlacementsActive,
  resolveAgriCvPlacements,
  resolveDesignCvPlacements,
} from './appData';

const WHERE_KEYS: CvShowWhere[] = ['agriPortal', 'designPortal', 'about', 'cvPage'];

type CvKind = 'agri' | 'design';

const PRESETS: { label: string; agri: CvDocPlacements; design: CvDocPlacements }[] = [
  {
    label: 'إخفاء الكل',
    agri: { agriPortal: false, designPortal: false, about: false, cvPage: false },
    design: { agriPortal: false, designPortal: false, about: false, cvPage: false },
  },
  {
    label: 'نبذة عني وصفحة السيرة فقط',
    agri: { agriPortal: false, designPortal: false, about: true, cvPage: true },
    design: { agriPortal: false, designPortal: false, about: true, cvPage: true },
  },
  {
    label: 'إظهار الكل',
    agri: { agriPortal: true, designPortal: false, about: true, cvPage: true },
    design: { agriPortal: false, designPortal: true, about: true, cvPage: true },
  },
];

function patchSave(
  onSave: (p: Partial<AppData>) => void,
  agri: CvDocPlacements,
  design: CvDocPlacements,
) {
  onSave({
    agriCvPlacements: agri,
    designCvPlacements: design,
    showAgriCv: cvPlacementsActive(agri),
    showDesignerCv: cvPlacementsActive(design),
  });
}

export function CvPlacementControls({
  data,
  onSave,
}: {
  data: AppData;
  onSave: (p: Partial<AppData>) => void;
}) {
  const agri = resolveAgriCvPlacements(data);
  const design = resolveDesignCvPlacements(data);

  const setCell = (kind: CvKind, where: CvShowWhere, checked: boolean) => {
    const base = kind === 'agri' ? { ...agri } : { ...design };
    base[where] = checked;
    if (kind === 'agri') patchSave(onSave, base, design);
    else patchSave(onSave, agri, base);
  };

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    patchSave(onSave, { ...preset.agri }, { ...preset.design });
  };

  const rows: { kind: CvKind; label: string; icon: string; color: string; placements: CvDocPlacements }[] = [
    { kind: 'agri', label: 'سيرة الزراعة', icon: 'fa-seedling', color: '#2a7a2a', placements: agri },
    { kind: 'design', label: 'سيرة التصاميم', icon: 'fa-compass-drafting', color: '#003366', placements: design },
  ];

  return (
    <div className="form-group" style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(0,51,102,0.06)', borderRadius: 10, border: '1px solid rgba(0,51,102,0.15)' }}>
      <label style={{ fontWeight: 800, display: 'block', marginBottom: 8 }}>
        <i className="fa-solid fa-eye" style={{ marginInlineEnd: 6 }} />
        إظهار أزرار السيرة للزوار
      </label>
      <p style={{ fontSize: 11, color: '#666', margin: '0 0 10px' }}>
        اختر أين يظهر كل زر — يمكن إخفاؤه من بوابات المحتوى وإظهاره في «نبذة عني» فقط، أو إخفاء الكل.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {PRESETS.map(p => (
          <button key={p.label} type="button" className="btn-outline-sm" onClick={() => applyPreset(p)}>
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 320 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #dde4ec' }}>السيرة</th>
              {WHERE_KEYS.map(w => (
                <th key={w} style={{ textAlign: 'center', padding: '6px 4px', borderBottom: '1px solid #dde4ec', fontSize: 11, fontWeight: 700, color: '#555' }}>
                  {CV_PLACEMENT_LABELS[w]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.kind}>
                <td style={{ padding: '8px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  <i className={`fa-solid ${row.icon}`} style={{ color: row.color, marginInlineEnd: 6 }} />
                  {row.label}
                </td>
                {WHERE_KEYS.map(w => (
                  <td key={w} style={{ textAlign: 'center', padding: '6px 4px' }}>
                    <input
                      type="checkbox"
                      checked={row.placements[w] === true}
                      onChange={e => setCell(row.kind, w, e.target.checked)}
                      aria-label={`${row.label} — ${CV_PLACEMENT_LABELS[w]}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
