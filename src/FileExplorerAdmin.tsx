import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FileNode, AppData, uid } from './appData';

interface Props {
  data: AppData;
  onSave: (partial: Partial<AppData>) => void;
}

const ICONS: Record<string, string> = {
  'image/jpeg': '🖼️', 'image/jpg': '🖼️', 'image/png': '🖼️',
  'image/webp': '🖼️', 'image/gif': '🖼️', 'image/svg+xml': '🖼️',
  'application/pdf': '📄', 'text/plain': '📝', 'text/html': '🌐',
  'application/zip': '🗜️', 'video/mp4': '🎬', 'video/webm': '🎬',
  'audio/mpeg': '🎵', 'audio/wav': '🎵',
};
const fileIcon = (mime?: string) => (mime && ICONS[mime]) || '📎';
const isImage  = (mime?: string) => !!mime && mime.startsWith('image/');
const fmtSize  = (b?: number) => {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
};
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });

/* ── Format bytes to human-readable string ── */
function fmtBytes(b: number): string {
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  if (b >= 1024)      return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}

/* ── localStorage fallback estimate ── */
function lsUsage(): { usedBytes: number; totalBytes: number } {
  let total = 0;
  try { for (const k in localStorage) total += localStorage[k]?.length ?? 0; } catch { /* */ }
  return { usedBytes: Math.round(total * 2), totalBytes: 5 * 1024 * 1024 }; // 5MB max
}

interface DiskInfo {
  usedBytes: number;
  totalBytes: number;
  uploadsBytes: number;
  pctUsed: number;
  source: 'server' | 'localStorage';
  loading: boolean;
  error: string | null;
}

/* ── Real server disk space hook ── */
function useStorageMonitor(): DiskInfo {
  const [info, setInfo] = useState<DiskInfo>(() => {
    const ls = lsUsage();
    return { ...ls, uploadsBytes: 0, pctUsed: ls.usedBytes / ls.totalBytes * 100, source: 'localStorage', loading: true, error: null };
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/storage_info.php', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        if (!d.ok) throw new Error(d.error || 'Server error');
        if (!cancelled) {
          setInfo({
            usedBytes: d.used_bytes,
            totalBytes: d.total_bytes,
            uploadsBytes: d.uploads_bytes ?? 0,
            pctUsed: d.pct_used,
            source: 'server',
            loading: false,
            error: null,
          });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const ls = lsUsage();
          setInfo({
            ...ls,
            uploadsBytes: 0,
            pctUsed: ls.totalBytes > 0 ? ls.usedBytes / ls.totalBytes * 100 : 0,
            source: 'localStorage',
            loading: false,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return info;
}

export function FileExplorerAdmin({ data, onSave }: Props) {
  const nodes = data.fileNodes ?? [];
  const commit = (next: FileNode[]) => onSave({ fileNodes: next });

  const [currentId, setCurrentId]   = useState<string | null>(null);
  const [viewMode, setViewMode]     = useState<'grid' | 'list'>('grid');
  const [search, setSearch]         = useState('');
  const [renameId, setRenameId]     = useState<string | null>(null);
  const [renameVal, setRenameVal]   = useState('');
  const [moveId, setMoveId]         = useState<string | null>(null);
  const [copiedId, setCopiedId]     = useState<string | null>(null);
  const [dragOver, setDragOver]     = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [ctxNode, setCtxNode]       = useState<FileNode | null>(null);
  const [ctxPos, setCtxPos]         = useState({ x: 0, y: 0 });
  const fileInput = useRef<HTMLInputElement>(null);

  /* breadcrumb */
  const buildCrumbs = (id: string | null): FileNode[] => {
    if (!id) return [];
    const node = nodes.find(n => n.id === id);
    if (!node) return [];
    return [...buildCrumbs(node.parentId), node];
  };
  const crumbs = buildCrumbs(currentId);

  /* children of current folder */
  const children = nodes.filter(n =>
    n.parentId === currentId &&
    (search === '' || n.name.toLowerCase().includes(search.toLowerCase()))
  );
  const folders = children.filter(n => n.kind === 'folder');
  const files   = children.filter(n => n.kind === 'file');

  /* all folders (for move dialog) */
  const allFolders = nodes.filter(n => n.kind === 'folder');

  /* ── actions ───────────────────────────────────────────── */
  const createFolder = () => {
    const name = newFolderName.trim() || 'مجلد جديد';
    const node: FileNode = { id: uid(), name, kind: 'folder', parentId: currentId, createdAt: new Date().toISOString() };
    commit([...nodes, node]);
    setNewFolderName('');
    setNewFolderMode(false);
  };

  const doUpload = useCallback(async (fileList: FileList) => {
    setUploading(true);
    const added: FileNode[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      const reader = new FileReader();
      await new Promise<void>(res => {
        reader.onload = () => {
          added.push({
            id: uid(), name: f.name, kind: 'file',
            parentId: currentId,
            url: reader.result as string,
            mimeType: f.type,
            sizeBytes: f.size,
            createdAt: new Date().toISOString(),
          });
          res();
        };
        reader.readAsDataURL(f);
      });
    }
    commit([...nodes, ...added]);
    setUploading(false);
  }, [nodes, currentId, commit]);

  const deleteNode = (id: string) => {
    const toDelete = new Set<string>();
    const collect = (nid: string) => {
      toDelete.add(nid);
      nodes.filter(n => n.parentId === nid).forEach(c => collect(c.id));
    };
    collect(id);
    commit(nodes.filter(n => !toDelete.has(n.id)));
    if (currentId && toDelete.has(currentId)) setCurrentId(null);
  };

  const saveRename = () => {
    if (!renameId || !renameVal.trim()) { setRenameId(null); return; }
    commit(nodes.map(n => n.id === renameId ? { ...n, name: renameVal.trim() } : n));
    setRenameId(null);
  };

  const doMove = (targetId: string | null) => {
    if (!moveId) return;
    commit(nodes.map(n => n.id === moveId ? { ...n, parentId: targetId } : n));
    setMoveId(null);
  };

  const copyUrl = (node: FileNode) => {
    const text = node.url ?? '';
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(node.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const openCtx = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    setCtxNode(node);
    setCtxPos({ x: e.clientX, y: e.clientY });
  };

  /* drag-and-drop onto area */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) doUpload(e.dataTransfer.files);
  };

  const disk = useStorageMonitor();
  const pct = Math.min(100, disk.pctUsed);
  const storageWarn = pct > 80;
  const barColor = pct > 90 ? '#f55' : pct > 80 ? '#f87' : pct > 60 ? '#fa4' : '#4a9';

  /* ── folder tree (sidebar) ──────────────────────────────── */
  const FolderTree = ({ parentId, depth }: { parentId: string | null; depth: number }) => {
    const subs = nodes.filter(n => n.kind === 'folder' && n.parentId === parentId);
    if (!subs.length && depth > 0) return null;
    return (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, paddingInlineStart: depth ? 14 : 0 }}>
        {depth === 0 && (
          <li>
            <button
              onClick={() => setCurrentId(null)}
              style={{ width: '100%', textAlign: 'start', background: currentId === null ? 'rgba(100,160,255,0.18)' : 'transparent', border: 'none', borderRadius: 7, padding: '6px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#aacbff', display: 'flex', alignItems: 'center', gap: 7 }}
            >
              🏠 الجذر (Root)
            </button>
          </li>
        )}
        {subs.map(f => (
          <li key={f.id}>
            <button
              onClick={() => setCurrentId(f.id)}
              style={{ width: '100%', textAlign: 'start', background: currentId === f.id ? 'rgba(100,160,255,0.18)' : 'transparent', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 12, color: currentId === f.id ? '#7db8ff' : '#b8cce8', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              📁 {f.name}
            </button>
            <FolderTree parentId={f.id} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 0, height: '100%', minHeight: 540, fontFamily: 'inherit' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 200, minWidth: 160, borderInlineEnd: '1px solid rgba(120,160,255,0.15)', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#7db8ff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>📂 المجلدات</div>
        <FolderTree parentId={null} depth={0} />

        {/* Storage Monitor */}
        <div style={{ marginTop: 'auto', paddingTop: 18, borderTop: '1px solid rgba(120,160,255,0.12)' }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#7db8ff', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              💾 مساحة السيرفر
            </span>
            {disk.source === 'server'
              ? <span style={{ fontSize: 8.5, color: '#4a9', fontWeight: 700 }}>● مباشر</span>
              : disk.loading
                ? <span style={{ fontSize: 8.5, color: '#aaa' }}>⏳</span>
                : <span style={{ fontSize: 8.5, color: '#fa4' }}>⚠ تقديري</span>
            }
          </div>

          {/* Progress bar */}
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 6, height: 8, overflow: 'hidden', marginBottom: 5, position: 'relative' }}>
            <div style={{
              width: disk.loading ? '0%' : `${pct}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
              borderRadius: 6,
              transition: 'width .6s ease, background .4s',
              boxShadow: `0 0 6px ${barColor}88`,
            }} />
          </div>

          {/* Stats row */}
          {disk.loading
            ? <div style={{ fontSize: 9.5, color: '#8ab', textAlign: 'center' }}>جارٍ القراءة...</div>
            : (
              <>
                <div style={{ fontSize: 10, color: storageWarn ? '#f87' : '#8ab', fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{fmtBytes(disk.usedBytes)} مستخدم</span>
                  <span style={{ color: '#6a9' }}>من {fmtBytes(disk.totalBytes)}</span>
                </div>
                <div style={{ fontSize: 9, color: pct > 80 ? '#f87' : '#6a8', marginTop: 3, textAlign: 'center', fontWeight: 600 }}>
                  {pct.toFixed(1)}% مستخدم · {fmtBytes(disk.totalBytes - disk.usedBytes)} متاح
                </div>
                {disk.source === 'server' && disk.uploadsBytes > 0 && (
                  <div style={{ fontSize: 9, color: '#7db8ff', marginTop: 2, textAlign: 'center' }}>
                    📁 مجلد uploads: {fmtBytes(disk.uploadsBytes)}
                  </div>
                )}
                {storageWarn && (
                  <div style={{ fontSize: 9, color: '#f87', marginTop: 5, lineHeight: 1.5, padding: '4px 6px', background: 'rgba(255,80,80,0.08)', borderRadius: 5 }}>
                    ⚠️ المساحة تقترب من حدها — يُنصح بالحذف أو استخدام روابط خارجية.
                  </div>
                )}
                {disk.source === 'localStorage' && disk.error && (
                  <div style={{ fontSize: 8.5, color: '#888', marginTop: 4, lineHeight: 1.4 }}>
                    (عرض تقديري — endpoint PHP غير متاح في بيئة التطوير)
                  </div>
                )}
              </>
            )
          }
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(120,160,255,0.12)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

          {/* Breadcrumb */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 13 }}>
            <button onClick={() => setCurrentId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7db8ff', padding: '2px 4px', borderRadius: 4, fontSize: 13 }}>🏠</button>
            {crumbs.map((c, i) => (
              <React.Fragment key={c.id}>
                <span style={{ color: '#446' }}>/</span>
                <button
                  onClick={() => setCurrentId(c.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: i === crumbs.length - 1 ? '#e7eefb' : '#7db8ff', padding: '2px 5px', borderRadius: 4, fontSize: 13 }}
                >{c.name}</button>
              </React.Fragment>
            ))}
          </div>

          {/* Search */}
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث..."
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(120,160,255,0.25)', borderRadius: 7, padding: '5px 10px', color: '#e7eefb', fontSize: 12, width: 120 }}
          />

          {/* Actions */}
          <button onClick={() => setNewFolderMode(true)} title="مجلد جديد"
            style={{ background: 'rgba(100,160,255,0.12)', border: '1px solid rgba(100,160,255,0.3)', borderRadius: 7, padding: '6px 12px', color: '#aacbff', cursor: 'pointer', fontSize: 12 }}>
            ➕ مجلد
          </button>
          <button onClick={() => fileInput.current?.click()} title="رفع ملفات"
            disabled={uploading}
            style={{ background: 'rgba(60,180,100,0.15)', border: '1px solid rgba(60,180,100,0.35)', borderRadius: 7, padding: '6px 12px', color: '#7de8a0', cursor: 'pointer', fontSize: 12 }}>
            {uploading ? '⏳' : '⬆️'} رفع
          </button>
          <input ref={fileInput} type="file" multiple style={{ display: 'none' }}
            onChange={e => e.target.files && doUpload(e.target.files)} />

          {/* View toggle */}
          <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: '1px solid rgba(120,160,255,0.2)' }}>
            {(['grid', 'list'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                style={{ background: viewMode === v ? 'rgba(100,160,255,0.22)' : 'transparent', border: 'none', padding: '5px 9px', cursor: 'pointer', color: viewMode === v ? '#aacbff' : '#668', fontSize: 13 }}>
                {v === 'grid' ? '⊞' : '☰'}
              </button>
            ))}
          </div>
        </div>

        {/* New folder input */}
        {newFolderMode && (
          <div style={{ padding: '10px 16px', background: 'rgba(100,160,255,0.07)', borderBottom: '1px solid rgba(120,160,255,0.12)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#aacbff' }}>📁 اسم المجلد:</span>
            <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setNewFolderMode(false); }}
              style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(120,160,255,0.35)', borderRadius: 6, padding: '5px 10px', color: '#e7eefb', fontSize: 13 }}
              placeholder="اسم المجلد الجديد"
            />
            <button onClick={createFolder}
              style={{ background: '#1a7f37', border: 'none', borderRadius: 6, padding: '5px 14px', color: '#fff', cursor: 'pointer', fontSize: 12 }}>إنشاء</button>
            <button onClick={() => setNewFolderMode(false)}
              style={{ background: 'rgba(255,60,60,0.15)', border: '1px solid rgba(255,60,60,0.3)', borderRadius: 6, padding: '5px 10px', color: '#f88', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
        )}

        {/* Drop zone + content */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{ flex: 1, overflowY: 'auto', padding: 16, position: 'relative', background: dragOver ? 'rgba(100,160,255,0.06)' : undefined, transition: 'background .2s' }}
          onClick={() => { setCtxNode(null); }}
        >
          {dragOver && (
            <div style={{ position: 'absolute', inset: 0, border: '2px dashed rgba(100,160,255,0.5)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 5 }}>
              <span style={{ fontSize: 20, color: '#7db8ff' }}>⬇️ أفلت الملفات هنا</span>
            </div>
          )}

          {folders.length === 0 && files.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: '#556' }}>
              <span style={{ fontSize: 48 }}>📂</span>
              <p style={{ fontSize: 14 }}>المجلد فارغ — ارفع ملفات أو أنشئ مجلداً فرعياً</p>
            </div>
          ) : viewMode === 'grid' ? (
            <GridView
              folders={folders} files={files}
              currentId={currentId}
              onOpenFolder={setCurrentId}
              onCtx={openCtx}
              onCopy={copyUrl}
              onDelete={deleteNode}
              onRename={(n) => { setRenameId(n.id); setRenameVal(n.name); }}
              onMove={(n) => setMoveId(n.id)}
              copiedId={copiedId}
              renameId={renameId} renameVal={renameVal}
              setRenameVal={setRenameVal} saveRename={saveRename}
              cancelRename={() => setRenameId(null)}
            />
          ) : (
            <ListView
              folders={folders} files={files}
              onOpenFolder={setCurrentId}
              onCtx={openCtx}
              onCopy={copyUrl}
              onDelete={deleteNode}
              onRename={(n) => { setRenameId(n.id); setRenameVal(n.name); }}
              onMove={(n) => setMoveId(n.id)}
              copiedId={copiedId}
              renameId={renameId} renameVal={renameVal}
              setRenameVal={setRenameVal} saveRename={saveRename}
              cancelRename={() => setRenameId(null)}
            />
          )}
        </div>
      </div>

      {/* ── Context Menu ── */}
      {ctxNode && (
        <div
          style={{ position: 'fixed', top: ctxPos.y, left: ctxPos.x, background: '#1a2540', border: '1px solid rgba(120,160,255,0.25)', borderRadius: 10, padding: 6, zIndex: 9999, minWidth: 160, boxShadow: '0 8px 30px rgba(0,0,0,0.5)' }}
          onClick={e => e.stopPropagation()}
        >
          {ctxNode.kind === 'folder' && (
            <CtxBtn icon="📂" label="فتح" onClick={() => { setCurrentId(ctxNode.id); setCtxNode(null); }} />
          )}
          {ctxNode.kind === 'file' && ctxNode.url && (
            <CtxBtn icon="🔗" label={copiedId === ctxNode.id ? '✓ تم النسخ!' : 'نسخ الرابط'} onClick={() => { copyUrl(ctxNode); setCtxNode(null); }} />
          )}
          <CtxBtn icon="✏️" label="إعادة التسمية" onClick={() => { setRenameId(ctxNode.id); setRenameVal(ctxNode.name); setCtxNode(null); }} />
          <CtxBtn icon="📦" label="نقل إلى..." onClick={() => { setMoveId(ctxNode.id); setCtxNode(null); }} />
          <div style={{ borderTop: '1px solid rgba(120,160,255,0.15)', margin: '4px 0' }} />
          <CtxBtn icon="🗑️" label="حذف" color="#f88" onClick={() => { deleteNode(ctxNode.id); setCtxNode(null); }} />
        </div>
      )}

      {/* ── Move Dialog ── */}
      {moveId && (
        <Modal title="نقل إلى مجلد" onClose={() => setMoveId(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
            <MoveBtn label="🏠 الجذر (Root)" onClick={() => doMove(null)} />
            {allFolders.filter(f => f.id !== moveId).map(f => (
              <MoveBtn key={f.id} label={`📁 ${f.name}`} onClick={() => doMove(f.id)} />
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

interface ItemActions {
  onOpenFolder: (id: string) => void;
  onCtx: (e: React.MouseEvent, n: FileNode) => void;
  onCopy: (n: FileNode) => void;
  onDelete: (id: string) => void;
  onRename: (n: FileNode) => void;
  onMove: (n: FileNode) => void;
  copiedId: string | null;
  renameId: string | null;
  renameVal: string;
  setRenameVal: (v: string) => void;
  saveRename: () => void;
  cancelRename: () => void;
  folders: FileNode[];
  files: FileNode[];
  currentId?: string | null;
}

function GridView({ folders, files, onOpenFolder, onCtx, onCopy, onDelete, onRename, onMove, copiedId, renameId, renameVal, setRenameVal, saveRename, cancelRename }: ItemActions) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
      {[...folders, ...files].map(node => (
        <GridCard key={node.id} node={node} onOpenFolder={onOpenFolder} onCtx={onCtx} onCopy={onCopy} onDelete={onDelete} onRename={onRename} onMove={onMove} copiedId={copiedId} renameId={renameId} renameVal={renameVal} setRenameVal={setRenameVal} saveRename={saveRename} cancelRename={cancelRename} />
      ))}
    </div>
  );
}

function GridCard({ node, onOpenFolder, onCtx, onCopy, onDelete, onRename, onMove, copiedId, renameId, renameVal, setRenameVal, saveRename, cancelRename }: { node: FileNode } & Omit<ItemActions, 'folders' | 'files' | 'currentId'>) {
  const isRenaming = renameId === node.id;
  return (
    <div
      onContextMenu={e => onCtx(e, node)}
      onDoubleClick={() => node.kind === 'folder' && onOpenFolder(node.id)}
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(120,160,255,0.15)', borderRadius: 10, padding: 10, cursor: node.kind === 'folder' ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, position: 'relative', transition: 'background .15s', userSelect: 'none' }}
      title={node.kind === 'folder' ? 'دبل-كليك للفتح' : node.name}
    >
      {/* Thumbnail / icon */}
      {node.kind === 'file' && isImage(node.mimeType) && node.url ? (
        <img src={node.url} alt={node.name} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6 }} />
      ) : (
        <div style={{ fontSize: 38, lineHeight: 1, marginBottom: 2 }}>
          {node.kind === 'folder' ? '📁' : fileIcon(node.mimeType)}
        </div>
      )}

      {/* Name */}
      {isRenaming ? (
        <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') cancelRename(); }}
          style={{ width: '100%', background: 'rgba(255,255,255,0.12)', border: '1px solid #5af', borderRadius: 5, padding: '3px 6px', color: '#e7eefb', fontSize: 11, textAlign: 'center' }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span style={{ fontSize: 11, color: '#c7d8f0', textAlign: 'center', wordBreak: 'break-word', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {node.name}
        </span>
      )}

      {/* Size */}
      {node.kind === 'file' && (
        <span style={{ fontSize: 10, color: '#667' }}>{fmtSize(node.sizeBytes)}</span>
      )}

      {/* Actions row */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
        {node.kind === 'folder' && (
          <ActionBtn title="فتح" color="#7db8ff" onClick={() => onOpenFolder(node.id)}>📂</ActionBtn>
        )}
        {node.kind === 'file' && node.url && (
          <ActionBtn title={copiedId === node.id ? 'تم!' : 'نسخ الرابط'} color={copiedId === node.id ? '#4d9' : '#7db8ff'} onClick={() => onCopy(node)}>
            {copiedId === node.id ? '✓' : '🔗'}
          </ActionBtn>
        )}
        <ActionBtn title="إعادة التسمية" color="#f0c040" onClick={() => onRename(node)}>✏️</ActionBtn>
        <ActionBtn title="نقل" color="#b0a0ff" onClick={() => onMove(node)}>📦</ActionBtn>
        <ActionBtn title="حذف" color="#f87" onClick={() => { if (confirm(`حذف "${node.name}"؟`)) onDelete(node.id); }}>🗑️</ActionBtn>
      </div>
    </div>
  );
}

function ListView({ folders, files, onOpenFolder, onCtx, onCopy, onDelete, onRename, onMove, copiedId, renameId, renameVal, setRenameVal, saveRename, cancelRename }: ItemActions) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: '1px solid rgba(120,160,255,0.18)' }}>
          {['الاسم', 'النوع', 'الحجم', 'التاريخ', 'الإجراءات'].map(h => (
            <th key={h} style={{ textAlign: 'start', padding: '6px 10px', color: '#7db8ff', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {[...folders, ...files].map(node => {
          const isRenaming = renameId === node.id;
          return (
            <tr key={node.id}
              onContextMenu={e => onCtx(e, node)}
              onDoubleClick={() => node.kind === 'folder' && onOpenFolder(node.id)}
              style={{ borderBottom: '1px solid rgba(120,160,255,0.08)', cursor: node.kind === 'folder' ? 'pointer' : 'default' }}
            >
              <td style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{node.kind === 'folder' ? '📁' : fileIcon(node.mimeType)}</span>
                {isRenaming ? (
                  <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') cancelRename(); }}
                    style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid #5af', borderRadius: 5, padding: '3px 8px', color: '#e7eefb', fontSize: 12 }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span style={{ color: '#d0e4ff' }}>{node.name}</span>
                )}
              </td>
              <td style={{ padding: '7px 10px', color: '#778', fontSize: 11 }}>
                {node.kind === 'folder' ? 'مجلد' : (node.mimeType ?? '—')}
              </td>
              <td style={{ padding: '7px 10px', color: '#778', fontSize: 11 }}>{fmtSize(node.sizeBytes)}</td>
              <td style={{ padding: '7px 10px', color: '#778', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDate(node.createdAt)}</td>
              <td style={{ padding: '7px 10px' }}>
                <div style={{ display: 'flex', gap: 5 }}>
                  {node.kind === 'folder' && (
                    <ActionBtn title="فتح" color="#7db8ff" onClick={() => onOpenFolder(node.id)}>📂</ActionBtn>
                  )}
                  {node.kind === 'file' && node.url && (
                    <ActionBtn title={copiedId === node.id ? 'تم!' : 'نسخ الرابط'} color={copiedId === node.id ? '#4d9' : '#7db8ff'} onClick={() => onCopy(node)}>
                      {copiedId === node.id ? '✓' : '🔗'}
                    </ActionBtn>
                  )}
                  <ActionBtn title="تسمية" color="#f0c040" onClick={() => onRename(node)}>✏️</ActionBtn>
                  <ActionBtn title="نقل" color="#b0a0ff" onClick={() => onMove(node)}>📦</ActionBtn>
                  <ActionBtn title="حذف" color="#f87" onClick={() => { if (confirm(`حذف "${node.name}"؟`)) onDelete(node.id); }}>🗑️</ActionBtn>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ActionBtn({ children, title, color, onClick }: { children: React.ReactNode; title: string; color: string; onClick: () => void }) {
  return (
    <button title={title} onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${color}30`, borderRadius: 6, padding: '3px 6px', cursor: 'pointer', fontSize: 13, color, lineHeight: 1 }}>
      {children}
    </button>
  );
}

function CtxBtn({ icon, label, onClick, color }: { icon: string; label: string; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick}
      style={{ width: '100%', textAlign: 'start', background: 'transparent', border: 'none', borderRadius: 7, padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: color ?? '#c7d8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon} {label}
    </button>
  );
}

function MoveBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ background: 'rgba(100,160,255,0.08)', border: '1px solid rgba(100,160,255,0.2)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#c7d8f0', textAlign: 'start', width: '100%' }}>
      {label}
    </button>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: '#1a2540', borderRadius: 14, padding: 22, minWidth: 280, maxWidth: 380, boxShadow: '0 12px 40px rgba(0,0,0,0.6)', border: '1px solid rgba(120,160,255,0.2)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#aacbff' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87', fontSize: 18 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
