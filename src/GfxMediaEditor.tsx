import type { GfxProjectItem } from './appData';
import { normalizeImageUrlForStorage } from './appData';
import { resolveImageSrc, resolveVideoPlaybackSrc, isVideoMediaUrl } from './mediaUrl';
import {
  gfxItemToMediaRows,
  mediaRowsToGfxItem,
  moveMediaRow,
  setMainMediaRow,
  type GfxMediaRow,
} from './gfxMedia';

function ReorderBtns({ index, total, onMove }: { index: number; total: number; onMove: (dir: -1 | 1) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
      <button type="button" className="btn-outline-sm" disabled={index === 0} onClick={() => onMove(-1)} title="للأعلى"
        style={{ padding: '3px 7px', fontSize: 11, lineHeight: 1, color: '#003366', borderColor: 'rgba(0,51,102,0.45)', background: 'rgba(0,51,102,0.08)', fontWeight: 800 }}>
        <i className="fa-solid fa-chevron-up" />
      </button>
      <button type="button" className="btn-outline-sm" disabled={index === total - 1} onClick={() => onMove(1)} title="للأسفل"
        style={{ padding: '3px 7px', fontSize: 11, lineHeight: 1, color: '#003366', borderColor: 'rgba(0,51,102,0.45)', background: 'rgba(0,51,102,0.08)', fontWeight: 800 }}>
        <i className="fa-solid fa-chevron-down" />
      </button>
    </div>
  );
}

function MediaPreview({ row }: { row: GfxMediaRow }) {
  if (!row.url.trim()) return null;
  if (row.isVideo) {
    return (
      <video
        src={resolveVideoPlaybackSrc(row.url)}
        autoPlay
        loop
        muted
        playsInline
        style={{ width: '100%', height: 72, objectFit: 'cover', borderRadius: 6, marginTop: 4, background: '#000' }}
      />
    );
  }
  return (
    <img
      src={resolveImageSrc(row.url)}
      alt=""
      style={{ width: '100%', height: 72, objectFit: 'cover', borderRadius: 6, marginTop: 4 }}
    />
  );
}

export function GfxMediaEditor({ item, onChange }: { item: GfxProjectItem; onChange: (item: GfxProjectItem) => void }) {
  const rows = gfxItemToMediaRows(item);

  const applyRows = (nextRows: GfxMediaRow[]) => {
    onChange(mediaRowsToGfxItem(nextRows, item));
  };

  const updateRow = (idx: number, patch: Partial<GfxMediaRow>) => {
    applyRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: '#223344' }}>📸 صور المشروع</label>
        <button
          type="button"
          className="btn-outline-sm"
          style={{ fontSize: 10 }}
          onClick={() => applyRows([...rows, { url: '', noWm: false, isVideo: false, isMain: false }])}
        >
          <i className="fa-solid fa-plus" /> إضافة صورة
        </button>
      </div>
      <p style={{ fontSize: 10, color: '#556677', margin: '0 0 8px', lineHeight: 1.5 }}>
        رتّب بالأسهم ↑↓ — عيّن ★ رئيسية — WebM من Google Drive: فعّل «فيديو متحرك» للتكرار المستمر.
      </p>
      {rows.length === 0 && <p style={{ fontSize: 10, color: '#556677', margin: 0 }}>لا صور. اضغط + للإضافة.</p>}
      {rows.map((row, idx) => (
        <div
          key={idx}
          style={{
            marginBottom: 6,
            background: row.isMain ? '#eef5ff' : '#f8faff',
            borderRadius: 7,
            padding: '6px 7px',
            border: `1px solid ${row.isMain ? '#a0c0e0' : '#dde'}`,
          }}
        >
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 4 }}>
            <ReorderBtns index={idx} total={rows.length} onMove={dir => applyRows(moveMediaRow(rows, idx, dir))} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: '#3d4f63', flexShrink: 0, minWidth: 16 }}>{idx + 1}</span>
                {row.isMain && (
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#003366', background: '#c8dff5', padding: '2px 6px', borderRadius: 4 }}>
                    ★ رئيسية
                  </span>
                )}
                {!row.isMain && row.url.trim() && (
                  <button
                    type="button"
                    className="btn-outline-sm"
                    style={{ fontSize: 9, padding: '2px 6px' }}
                    onClick={() => applyRows(setMainMediaRow(rows, idx))}
                  >
                    تعيين رئيسية
                  </button>
                )}
                <input
                  type="url"
                  value={row.url}
                  placeholder="https://drive.google.com/file/d/.../view"
                  style={{
                    flex: 1,
                    minWidth: 120,
                    padding: '4px 7px',
                    borderRadius: 6,
                    border: `1px solid ${row.url ? '#a0c0e0' : '#dde'}`,
                    fontSize: 10,
                    direction: 'ltr',
                    color: '#003366',
                    background: row.url ? '#f0f6ff' : '#fff',
                  }}
                  onChange={e => updateRow(idx, { url: e.target.value })}
                  onBlur={e => {
                    const val = e.target.value.trim();
                    if (!val) return;
                    if (row.isVideo || isVideoMediaUrl(val)) {
                      if (!row.isVideo) updateRow(idx, { isVideo: true, url: val });
                      return;
                    }
                    const n = normalizeImageUrlForStorage(val);
                    if (n && n !== val) updateRow(idx, { url: n });
                  }}
                />
                <button
                  type="button"
                  onClick={() => applyRows(rows.filter((_, i) => i !== idx))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cc4444', fontSize: 13, flexShrink: 0, padding: '0 2px' }}
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, cursor: 'pointer', color: row.noWm ? '#cc4444' : '#888', marginBottom: 3 }}>
                <input type="checkbox" checked={row.noWm} onChange={e => updateRow(idx, { noWm: e.target.checked })} />
                {row.noWm ? '🚫 بدون علامة مائية' : '🔒 تطبيق العلامة المائية'}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, cursor: 'pointer', color: row.isVideo ? '#006644' : '#888' }}>
                <input type="checkbox" checked={row.isVideo} onChange={e => updateRow(idx, { isVideo: e.target.checked })} />
                {row.isVideo ? '🎬 WebM / فيديو (تكرار مستمر)' : '🎬 WebM / فيديو متحرك'}
              </label>
              <MediaPreview row={row} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
