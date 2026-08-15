import { useState, useRef, useEffect, useCallback } from 'react';
import {
  AppData, AgriArticle, AgriBook, ArticleCategory, LibraryNode, BookKind, LibraryView, GfxCategory, GfxSubCategory, GfxProjectItem,
  SoftwareSnippet, SiteSettings, SocialLink, NavItem, SoilRow, ReportTemplate,
  AgriVideo, PublicReport, WebProject, BookGridSettings, DEFAULT_BOOK_GRID,
  ArticleGridSettings, DEFAULT_ARTICLE_GRID,
  normalizeImageUrlForStorage, normalizeVideoUrlForStorage,
  WebGridSettings, DEFAULT_WEB_GRID, GfxGridSettings, DEFAULT_GFX_GRID,
  ml, pickML, flattenLibrary, LangKey, uid, ML, normML,
  uploadMediaFile, readFileAsDataUrl, compressImageFileForStorage, getApiToken,
  AgriWalkthroughSettings, WalkthroughStepSettings, WALKTHROUGH_SPEED_OPTIONS,
} from './appData';
import AgriWalkthrough, { WALKTHROUGH_STEPS, buildOrderedWalkthroughSteps } from './AgriWalkthrough';
import { CustomerReportsAdmin } from './CustomerReports';
import { videoEmbed } from './SoilRequest';
import { RichEditor } from './RichEditor';
import { AiArticleGeneratePanel } from './AiArticleGeneratePanel';
import { GfxAiSuggestPanel } from './GfxAiSuggestPanel';
import { ensureGfxSeedProjects, createGfxSeedProject, addGfxSeedProjects, fillGfxSubToCount, fillGfxCategorySubs, getSuggestedFileLabelForSub, getSuggestedToolsForSub } from './gfxProjectSeeds';
import { KNOWN_GFX_FILE_TYPES, parseSourceFileLabels, joinSourceFileLabels } from './gfxFileTypes';
import {
  SITE_FONT_OPTIONS,
  resolveBodyTextColor, resolveMutedTextColor, resolveHeadingTextColor,
} from './siteThemeOptions';
import { ThemeColorPicker, DEFAULT_THEME_COLOR_FIELDS } from './ThemeColorPicker';
import { SkillIcon } from './SkillIcon';
import type { Skill } from './appData';
import { MlBulkTranslateButton, MlFieldsTranslateButton, MlObjectTranslateButton } from './MlTranslateControls';
import { mergeMlTranslation } from './mlTranslate';
import { restoreDefaultArticleCategories } from './defaultCatalog';
import { resolveImageSrc, resolveReportDisplay, resolveAboutHeroMedia, isVideoMediaUrl, resolveVideoPlaybackSrc } from './mediaUrl';
import { HeroNameDisplay } from './HeroNameDisplay';
import { normalizeExternalUrl, isUsableProjectLink } from './webProjectUtils';
import { hasUsableGfxModelUrl } from './gfxMedia';
import { GfxMediaEditor } from './GfxMediaEditor';
import { GfxModel3dAdmin } from './GfxModel3dAdmin';
import { mergeGfxModel3dViewSettings, prepareGlbViewSettingsForStorage, type GfxModel3dSettings } from './gfxModel3d';
import { GfxDownloadLinksEditor } from './GfxDownloadLinksEditor';
import { getGfxDownloadLinks, getGfxDownloadLinksForEdit, applyGfxDownloadLinks } from './gfxDownloadLinks';
import {
  approveLabSubmission,
  fetchPendingLabSubmissions,
  rejectLabSubmission,
  type LabSubmissionRow,
} from './labVisitorSubmissions';
import { GridFontControls, BookActionFontControls, bookGridStyle, articleGridStyle, gfxGridStyle, webGridStyle } from './GridFontControls';
import { BookAccessRibbon, BookRibbonControls, BookCover } from './BookAccessRibbon';
import { BookCoverGenerator } from './BookCoverGenerator';
import type { CoverOverlaySettings } from './BookCoverGenerator';

function moveItem<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [row] = next.splice(index, 1);
  next.splice(to, 0, row);
  return next;
}

function ReorderBtns({ index, total, onMove }: { index: number; total: number; onMove: (dir: -1 | 1) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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

export function SourceFileLabelPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = parseSourceFileLabels(value);
  const [customDraft, setCustomDraft] = useState('');
  const knownIds = new Set(KNOWN_GFX_FILE_TYPES.map(t => t.id));
  const customSelected = selected.filter(id => !knownIds.has(id));

  const setSelected = (next: string[]) => onChange(joinSourceFileLabels(next));

  const toggleKnown = (id: string) => {
    setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  };

  const addCustom = () => {
    const c = customDraft.trim().toUpperCase().replace(/[^A-Z0-9._-]/g, '').slice(0, 12);
    if (!c || selected.includes(c)) return;
    setSelected([...selected, c]);
    setCustomDraft('');
  };

  const removeCustom = (id: string) => setSelected(selected.filter(x => x !== id));

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {KNOWN_GFX_FILE_TYPES.map(t => (
          <label key={t.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 600, cursor: 'pointer',
            padding: '4px 8px', borderRadius: 8, border: `1.5px solid ${selected.includes(t.id) ? '#4a2a8a' : '#d4c8f5'}`,
            background: selected.includes(t.id) ? '#ede8ff' : '#fff', color: selected.includes(t.id) ? '#4a2a8a' : '#555',
          }}>
            <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggleKnown(t.id)} style={{ accentColor: '#4a2a8a' }} />
            {t.label}
          </label>
        ))}
      </div>
      {customSelected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {customSelected.map(id => (
            <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 8, padding: '3px 8px', fontWeight: 700, color: '#996600' }}>
              {id}
              <button type="button" onClick={() => removeCustom(id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#cc6600', padding: 0, fontSize: 11 }}><i className="fa-solid fa-xmark" /></button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="text" value={customDraft} placeholder="لاحقة أخرى — مثل: OBJ"
          style={{ flex: 1, fontSize: 11, direction: 'ltr', textTransform: 'uppercase' }}
          onChange={e => setCustomDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())} />
        <button type="button" className="btn-outline-sm" style={{ fontSize: 10, flexShrink: 0 }} onClick={addCustom}>
          <i className="fa-solid fa-plus" /> إضافة
        </button>
      </div>
      {selected.length > 0 && (
        <p style={{ fontSize: 9.5, color: '#3d4f63', margin: '6px 0 0' }}>
          يظهر للزائر: <strong style={{ color: '#4a2a8a' }}>{joinSourceFileLabels(selected)}</strong>
        </p>
      )}
    </div>
  );
}

function GfxSkillsPicker({ skills, selectedIds, onChange }: { skills: Skill[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('');
  if (!skills.length) {
    return <p style={{ fontSize: 10, color: '#445566', margin: 0 }}>لا مهارات في «إدارة المهارات» — أضف برامج هناك أولاً.</p>;
  }
  const filtered = skills.filter(sk => {
    const hay = `${sk.name} ${sk.icon}`.toLowerCase();
    return !q.trim() || hay.includes(q.trim().toLowerCase());
  });
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };
  const iconSize = skills[0]?.size || 24;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="بحث برنامج…"
          style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid #aac4ee', fontSize: 11 }} />
        <span style={{ fontSize: 9, color: '#556677', whiteSpace: 'nowrap' }}>
          {selectedIds.length} / {skills.length}
        </span>
      </div>
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8,
        maxHeight: 240, overflowY: 'auto', padding: '4px 2px',
        border: '1px solid #dde8f5', borderRadius: 8, background: '#fafcff',
      }}>
        {filtered.length === 0 ? (
          <p style={{ fontSize: 10, color: '#8899aa', margin: '8px auto', width: '100%', textAlign: 'center' }}>لا نتائج</p>
        ) : filtered.map(sk => (
          <label key={sk.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', padding: '6px 10px', borderRadius: 10,
            border: `1.5px solid ${selectedIds.includes(sk.id) ? '#003366' : '#cde'}`,
            background: selectedIds.includes(sk.id) ? '#e8f0ff' : '#fff', minWidth: 0, flex: '1 1 120px',
          }}>
            <input type="checkbox" checked={selectedIds.includes(sk.id)} onChange={() => toggle(sk.id)} style={{ accentColor: '#003366' }} />
            <SkillIcon icon={sk.icon} name={sk.name} size={iconSize} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#003366' }}>{sk.name}</span>
          </label>
        ))}
      </div>
      <p style={{ fontSize: 9, color: '#667788', margin: '6px 0 0' }}>
        كل البرامج من «إدارة المهارات» — أضف برنامجاً جديداً هناك فيظهر هنا تلقائياً.
      </p>
    </div>
  );
}

function MlNameInputs({ value, onChange, dark, stacked, showTranslate }: { value: ML; onChange: (v: ML) => void; dark?: boolean; stacked?: boolean; showTranslate?: boolean }) {
  const bg = dark ? 'rgba(0,0,0,0.3)' : '#fff';
  const color = dark ? '#e8f5e8' : '#333';
  const border = dark ? 'rgba(255,255,255,0.15)' : '#ccd6e4';
  const inputStyle: React.CSSProperties = {
    border: `1px solid ${border}`,
    borderRadius: 6,
    padding: '5px 8px',
    fontFamily: 'inherit',
    fontSize: 12,
    background: bg,
    color,
    boxSizing: 'border-box',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    width: stacked ? '100%' : undefined,
    flex: stacked ? undefined : '1 1 80px',
    minWidth: stacked ? undefined : 0,
    maxWidth: '100%',
  };
  return (
    <div style={{ minWidth: 0, maxWidth: '100%' }}>
      {showTranslate !== false && (
        <div style={{ marginBottom: stacked ? 4 : 6 }}>
          <MlObjectTranslateButton value={value} onChange={onChange} dark={dark} small />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: stacked ? 'column' : 'row', gap: stacked ? 4 : 6, flexWrap: stacked ? undefined : 'wrap', minWidth: 0 }}>
        {(['ar', 'en', 'de'] as LangKey[]).map(lk => (
          <input key={lk} value={value[lk] || ''} placeholder={lk === 'ar' ? 'العربية' : lk === 'en' ? 'English' : 'Deutsch'}
            onChange={e => onChange({ ...value, [lk]: e.target.value })}
            dir={lk === 'ar' ? 'rtl' : 'ltr'}
            title={value[lk] || ''}
            style={{ ...inputStyle, direction: lk === 'ar' ? 'rtl' : 'ltr' }} />
        ))}
      </div>
    </div>
  );
}

/** اسم مختصر للقوائم — العربية فقط مع قص النص */
function shortCatLabel(name: ML): string {
  return (name.ar || name.en || name.de || '—').trim();
}

function formatCatLabel(name: ML): string {
  return [name.ar, name.en, name.de].filter(Boolean).join(' · ') || '—';
}

const catListBtnStyle = (active: boolean, accent: string): React.CSSProperties => ({
  flex: 1,
  minWidth: 0,
  padding: '5px 8px',
  borderRadius: 7,
  border: `1px solid ${active ? accent : '#cde'}`,
  background: active ? accent : '#fff',
  color: active ? '#fff' : '#333',
  fontSize: 11,
  cursor: 'pointer',
  textAlign: 'right',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  display: 'block',
});

function collectGfxMlFields(cats: GfxCategory[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const cat of cats) {
    if (cat.name.ar?.trim()) fields[`c_${cat.id}`] = cat.name.ar.trim();
    for (const sub of cat.subCategories) {
      if (sub.name.ar?.trim()) fields[`s_${sub.id}`] = sub.name.ar.trim();
      for (const item of sub.items) {
        if (item.title.ar?.trim()) fields[`t_${item.id}`] = item.title.ar.trim();
        if (item.desc.ar?.trim()) fields[`d_${item.id}`] = item.desc.ar.trim();
      }
    }
  }
  return fields;
}

function applyGfxBulkTranslations(cats: GfxCategory[], tr: Record<string, { en: string; de: string }>): GfxCategory[] {
  return cats.map(cat => ({
    ...cat,
    name: tr[`c_${cat.id}`] ? mergeMlTranslation(cat.name, tr[`c_${cat.id}`]) : cat.name,
    subCategories: cat.subCategories.map(sub => ({
      ...sub,
      name: tr[`s_${sub.id}`] ? mergeMlTranslation(sub.name, tr[`s_${sub.id}`]) : sub.name,
      items: sub.items.map(item => ({
        ...item,
        title: tr[`t_${item.id}`] ? mergeMlTranslation(item.title, tr[`t_${item.id}`]) : item.title,
        desc: tr[`d_${item.id}`] ? mergeMlTranslation(item.desc, tr[`d_${item.id}`]) : item.desc,
      })),
    })),
  }));
}

function collectAgriArticleMlFields(artCats: ArticleCategory[], articles: AgriArticle[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const c of artCats) {
    if (c.name.ar?.trim()) fields[`cat_${c.id}`] = c.name.ar.trim();
  }
  for (const a of articles) {
    if (a.title.ar?.trim()) fields[`art_t_${a.id}`] = a.title.ar.trim();
    if (a.content.ar?.trim()) fields[`art_c_${a.id}`] = a.content.ar.trim();
    if (a.reference.ar?.trim()) fields[`art_r_${a.id}`] = a.reference.ar.trim();
  }
  return fields;
}

function applyAgriArticleBulkTranslations(
  artCats: ArticleCategory[],
  articles: AgriArticle[],
  tr: Record<string, { en: string; de: string }>,
): { artCats: ArticleCategory[]; articles: AgriArticle[] } {
  return {
    artCats: artCats.map(c => ({
      ...c,
      name: tr[`cat_${c.id}`] ? mergeMlTranslation(c.name, tr[`cat_${c.id}`]) : c.name,
    })),
    articles: articles.map(a => ({
      ...a,
      title: tr[`art_t_${a.id}`] ? mergeMlTranslation(a.title, tr[`art_t_${a.id}`]) : a.title,
      content: tr[`art_c_${a.id}`] ? mergeMlTranslation(a.content, tr[`art_c_${a.id}`]) : a.content,
      reference: tr[`art_r_${a.id}`] ? mergeMlTranslation(a.reference, tr[`art_r_${a.id}`]) : a.reference,
    })),
  };
}

/* ── AI Key Panel ── */
function AiKeyPanel({ aiEnabled, onToggle }: { aiEnabled: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div>
      {/* Enable/Disable toggle */}
      <div className="admin-light-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0f8f0', border: '1px solid #c8e6c9', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, color: '#2a7a2a' }}><i className="fa-solid fa-brain" /> وحدة التشخيص الزراعي الذكي</div>
          <div style={{ fontSize: 12, color: '#334455', marginTop: 2 }}>تفعيل الوحدة يتيح للزوار رفع صور النباتات للتشخيص</div>
        </div>
        <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={aiEnabled} onChange={e => onToggle(e.target.checked)} style={{ display: 'none' }} />
          <div style={{ width: 48, height: 24, borderRadius: 12, background: aiEnabled ? '#2a7a2a' : '#ccc', transition: 'background 0.3s', position: 'relative' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: aiEnabled ? 26 : 2, transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          </div>
          <span style={{ marginInlineStart: 8, fontSize: 13, fontWeight: 700, color: aiEnabled ? '#2a7a2a' : '#888' }}>{aiEnabled ? 'مفعّل' : 'معطّل'}</span>
        </label>
      </div>

      {/* Proxy info */}
      <div className="admin-light-panel" style={{ background: '#f8fdf8', border: '1px solid #c8e6c9', borderRadius: 12, padding: 16, fontSize: 13, color: '#2a5c2a', lineHeight: 1.9 }}>
        <div style={{ fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fa-solid fa-server" style={{ color: '#2a7a2a' }} /> مفتاح API محفوظ داخل السيرفر
        </div>
        <div style={{ color: '#223344' }}>
          الطلبات تُرسَل عبر ملف <code style={{ background: '#e8f5e9', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12 }}>ai_proxy.php</code> — المفتاح مخفي تماماً عن المتصفح.
        </div>
      </div>
    </div>
  );
}

type Mode = 'agri' | 'tour' | 'gfx' | 'lab' | 'site';
interface Props {
  mode: Mode;
  data: AppData;
  onSave: (u: Partial<AppData>) => void | Promise<boolean>;
  onSiteApply?: (u: Partial<AppData>) => void;
  onSitePersist?: () => Promise<boolean>;
  serverConnected?: boolean;
  serverSyncing?: boolean;
  onServerConnect?: (username: string, password: string) => Promise<boolean>;
  onServerDisconnect?: () => void;
}

const LANGS: { code: LangKey; flag: string; label: string }[] = [
  { code: 'ar', flag: '🇸🇾', label: 'AR' },
  { code: 'en', flag: '🇺🇸', label: 'EN' },
  { code: 'de', flag: '🇩🇪', label: 'DE' },
];

/* ── Tab Bar helper ─────────────────────────────────── */
function TabBar({ tabs, active, color, onChange }: { tabs: [string, string][]; active: string; color: string; onChange: (t: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
      {tabs.map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)}
          style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${active === key ? color : 'rgba(180,205,235,0.38)'}`, background: active === key ? color : 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          {label}
        </button>
      ))}
    </div>
  );
}

/* ── Library tree helpers (immutable) ───────────────── */
function treeAddChild(nodes: LibraryNode[], parentId: string | null, node: LibraryNode): LibraryNode[] {
  if (!parentId) return [...nodes, node];
  return nodes.map(n => n.id === parentId
    ? { ...n, children: [...n.children, node] }
    : { ...n, children: treeAddChild(n.children, parentId, node) });
}
function treeUpdate(nodes: LibraryNode[], id: string, patch: Partial<LibraryNode>): LibraryNode[] {
  return nodes.map(n => n.id === id
    ? { ...n, ...patch }
    : { ...n, children: treeUpdate(n.children, id, patch) });
}
function treeRemove(nodes: LibraryNode[], id: string): LibraryNode[] {
  return nodes.filter(n => n.id !== id).map(n => ({ ...n, children: treeRemove(n.children, id) }));
}

/* ── Recursive library tree editor ──────────────────── */
function LibraryTreeEditor({ tree, lang, onChange }: { tree: LibraryNode[]; lang: LangKey; onChange: (t: LibraryNode[]) => void }) {
  const [newRoot, setNewRoot] = useState('');
  const addRoot = () => {
    const name = newRoot.trim(); if (!name) return;
    onChange([...tree, { id: uid(), name: ml(name, name, name), children: [] }]);
    setNewRoot('');
  };
  const renderNodes = (nodes: LibraryNode[]): JSX.Element => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {nodes.map(n => (
        <div key={n.id}>
          <div className="library-tree-node" style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#f5fbf5', border: '1px solid #c8e6c9', borderRadius: 8, padding: '6px 8px' }}>
            <i className="fa-solid fa-folder" style={{ color: '#2a7a2a' }} />
            <input value={n.name[lang] || ''} placeholder={`الاسم (${lang.toUpperCase()})`}
              onChange={e => onChange(treeUpdate(tree, n.id, { name: { ...n.name, [lang]: e.target.value } }))}
              style={{ flex: 1, border: '1px solid #ddd', borderRadius: 6, padding: '4px 8px', fontSize: 13, fontFamily: 'inherit' }} />
            <MlObjectTranslateButton value={n.name} onChange={name => onChange(treeUpdate(tree, n.id, { name }))} small />
            <button className="btn-outline-sm" title="إضافة فرع داخلي" onClick={() => onChange(treeAddChild(tree, n.id, { id: uid(), name: ml('', '', ''), children: [] }))}><i className="fa-solid fa-plus" /></button>
            <button className="btn-danger-sm" title="حذف" onClick={() => confirm('حذف هذا الفرع وكل ما يندرج تحته؟') && onChange(treeRemove(tree, n.id))}><i className="fa-solid fa-trash-can" /></button>
          </div>
          {n.children.length > 0 && <div style={{ marginInlineStart: 18, marginTop: 6, borderInlineStart: '2px solid #d7ecd7', paddingInlineStart: 8 }}>{renderNodes(n.children)}</div>}
        </div>
      ))}
    </div>
  );
  return (
    <div>
      <p style={{ fontSize: 12, color: '#334455', marginBottom: 10, lineHeight: 1.7 }}>
        ابنِ شجرة المكتبة: المكتبة الرئيسية ← الفرعية (مثل «مكتبة الجامعة») ← السنة الدراسية ← الفصل ← المادة. استخدم زر <i className="fa-solid fa-plus" /> لإضافة فرع داخلي، ثم أسنِد الكتب إلى الفروع من تبويب «الكتب».
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <input value={newRoot} placeholder="اسم مكتبة رئيسية جديدة" onChange={e => setNewRoot(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRoot()}
          className="library-tree-root-input"
          style={{ flex: 1, border: '1px solid #c8e6c9', borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13 }} />
        <button className="btn-prime" onClick={addRoot}><i className="fa-solid fa-plus" /> مكتبة رئيسية</button>
      </div>
      {tree.length === 0 ? <p style={{ color: '#3d4f63', fontSize: 13 }}>لا توجد فروع بعد.</p> : renderNodes(tree)}
    </div>
  );
}

/* صف إعداد فيديو توضيحي — ملصق + تشغيل تلقائي/ضغط + التقاط إطار */
function AgriVideoAdminRow({
  video,
  lang,
  onChange,
  onDelete,
}: {
  video: AgriVideo;
  lang: LangKey;
  onChange: (v: AgriVideo) => void;
  onDelete: () => void;
}) {
  const captureRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [seekSec, setSeekSec] = useState(video.posterTimeSec || 1);
  const [duration, setDuration] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const playSrc = video.url.trim() && videoEmbed(video.url)?.kind === 'video'
    ? resolveVideoPlaybackSrc(video.url)
    : '';
  const posterPreview = (video.poster || '').trim()
    ? (video.poster!.startsWith('data:') ? video.poster! : resolveImageSrc(video.poster!))
    : '';
  const loopOn = video.loop !== false;

  const captureFrame = async () => {
    const el = captureRef.current;
    if (!el || !playSrc) return;
    setCapturing(true);
    try {
      el.pause();
      el.currentTime = Math.min(Math.max(0, seekSec), el.duration || seekSec);
      await new Promise<void>((resolve, reject) => {
        const ok = () => { el.removeEventListener('seeked', ok); resolve(); };
        el.addEventListener('seeked', ok);
        setTimeout(() => reject(new Error('seek')), 8000);
      }).catch(() => undefined);
      const w = el.videoWidth || 1280;
      const h = el.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(el, 0, 0, w, h);
      /* قص الشريط الأسود أعلى/أسفل إن وُجد داخل الإطار */
      let dataUrl: string;
      try {
        const { data } = ctx.getImageData(0, 0, w, h);
        const rowIsBlack = (y: number) => {
          let dark = 0;
          let n = 0;
          const step = Math.max(1, Math.floor(w / 48));
          for (let x = 0; x < w; x += step) {
            const i = (y * w + x) * 4;
            if (data[i]! + data[i + 1]! + data[i + 2]! < 48) dark++;
            n++;
          }
          return n > 0 && dark / n > 0.88;
        };
        let top = 0;
        let bottom = h - 1;
        while (top < h - 2 && rowIsBlack(top)) top++;
        while (bottom > top + 2 && rowIsBlack(bottom)) bottom--;
        const ch = bottom - top + 1;
        if (ch < h * 0.92 && ch >= h * 0.35) {
          const out = document.createElement('canvas');
          out.width = w;
          out.height = ch;
          out.getContext('2d')!.drawImage(canvas, 0, top, w, ch, 0, 0, w, ch);
          dataUrl = out.toDataURL('image/jpeg', 0.9);
        } else {
          dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        }
      } catch {
        dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      }
      onChange({ ...video, poster: dataUrl, posterTimeSec: seekSec });
      setCaptureOpen(false);
    } finally {
      setCapturing(false);
    }
  };

  const uploadVideoFile = async (file: File) => {
    if (file.size > 40 * 1024 * 1024) {
      alert('الملف أكبر من 40MB. ارفعه إلى Google Drive والصق الرابط، أو صغّر WebM.');
      return;
    }
    setUploading(true);
    try {
      let url = getApiToken() ? await uploadMediaFile(file, 'general') : null;
      if (!url) {
        if (file.size > 8 * 1024 * 1024) {
          alert('تعذّر الرفع للسيرفر والملف كبير للتخزين المحلي. سجّل دخول الأدمن للسيرفر أو استخدم Drive.');
          return;
        }
        if (!confirm('تعذّر الرفع للسيرفر. هل تحفظ الملف محلياً؟')) return;
        url = await readFileAsDataUrl(file);
      }
      if (url) {
        onChange({
          ...video,
          url,
          loop: true,
          muted: true,
          autoplay: true,
        });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ border: '1px solid #c8e6c9', borderRadius: 10, padding: 12, background: '#f8fdf8' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <input
          placeholder={`عنوان الفيديو (${lang.toUpperCase()})`}
          value={video.title[lang] || ''}
          onChange={e => onChange({ ...video, title: { ...video.title, [lang]: e.target.value } })}
          style={{ padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }}
        />
        <input
          placeholder="رابط الفيديو (Drive / YouTube / WebM مباشر)"
          value={video.url}
          style={{ direction: 'ltr', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }}
          onChange={e => onChange({ ...video, url: e.target.value })}
          onBlur={e => {
            const n = normalizeVideoUrlForStorage(e.target.value.trim());
            if (n && n !== e.target.value.trim()) onChange({ ...video, url: n });
          }}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <input
          ref={fileRef}
          type="file"
          accept="video/webm,video/mp4,video/quicktime,image/gif,.webm,.mp4,.mov,.gif"
          style={{ display: 'none' }}
          onChange={e => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void uploadVideoFile(f);
          }}
        />
        <button type="button" className="btn-outline-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <i className={`fa-solid ${uploading ? 'fa-spinner fa-spin' : 'fa-upload'}`} />
          {uploading ? ' جاري الرفع…' : ' رفع WebM / فيديو'}
        </button>
        <span style={{ fontSize: 11, color: '#556677' }}>WebM متحرك أو MP4 — حتى 40MB · التكرار المستمر مفعّل تلقائياً</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, marginBottom: 10, alignItems: 'start' }}>
        <div style={{
          width: 120, height: 68, borderRadius: 8, border: '1px solid #ccc', background: '#111',
          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {posterPreview
            ? <img src={posterPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : playSrc
              ? <video src={playSrc} muted loop autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: '#889', fontSize: 10, textAlign: 'center', padding: 4 }}>بدون ملصق</span>}
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#2a7a2a', display: 'block', marginBottom: 4 }}>
            صورة مصغّرة (رابط Google Drive أو التقاط إطار)
          </label>
          <input
            placeholder="https://drive.google.com/... (صورة)"
            value={(video.poster || '').startsWith('data:') ? '' : (video.poster || '')}
            style={{ width: '100%', boxSizing: 'border-box', direction: 'ltr', padding: '7px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, marginBottom: 6 }}
            onChange={e => onChange({ ...video, poster: e.target.value })}
            onBlur={e => {
              const n = normalizeImageUrlForStorage(e.target.value.trim());
              if (n && n !== e.target.value.trim()) onChange({ ...video, poster: n });
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button
              type="button"
              className="btn-outline-sm"
              style={{ fontSize: 11 }}
              disabled={!playSrc}
              onClick={() => { setCaptureOpen(o => !o); setSeekSec(video.posterTimeSec || 1); }}
            >
              <i className="fa-solid fa-camera" /> التقاط إطار من الفيديو
            </button>
            {(video.poster || '') && (
              <button type="button" className="btn-outline-sm" style={{ fontSize: 11 }}
                onClick={() => onChange({ ...video, poster: '', posterTimeSec: undefined })}>
                مسح الملصق
              </button>
            )}
          </div>
        </div>
      </div>

      {captureOpen && playSrc && (
        <div style={{ background: '#fff', border: '1px solid #c8e6c9', borderRadius: 10, padding: 10, marginBottom: 10 }}>
          <video
            ref={captureRef}
            src={playSrc}
            controls
            playsInline
            preload="metadata"
            style={{ width: '100%', maxHeight: 220, background: '#000', borderRadius: 8 }}
            onLoadedMetadata={e => {
              const d = e.currentTarget.duration;
              if (isFinite(d)) setDuration(d);
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#2a7a2a' }}>الثانية: {seekSec.toFixed(1)}</label>
            <input
              type="range"
              min={0}
              max={Math.max(1, duration || 60)}
              step={0.1}
              value={Math.min(seekSec, duration || seekSec)}
              onChange={e => {
                const t = Number(e.target.value);
                setSeekSec(t);
                const el = captureRef.current;
                if (el) el.currentTime = t;
              }}
              style={{ flex: 1, minWidth: 120, accentColor: '#2a7a2a' }}
            />
            <button type="button" className="btn-prime" style={{ fontSize: 12 }} disabled={capturing} onClick={() => void captureFrame()}>
              {capturing ? 'جارٍ الالتقاط…' : 'استخدام هذا الإطار'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <MlObjectTranslateButton small value={video.title}
          onChange={title => onChange({ ...video, title })} />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: video.visible ? '#2a7a2a' : '#999', cursor: 'pointer' }}>
          <input type="checkbox" checked={video.visible} onChange={e => onChange({ ...video, visible: e.target.checked })} />
          {video.visible ? 'ظاهر للزوار' : 'مخفي'}
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#003366', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!video.autoplay} onChange={e => {
            const on = e.target.checked;
            onChange({ ...video, autoplay: on, muted: on ? true : video.muted });
          }} />
          {video.autoplay ? 'تشغيل تلقائي' : 'تشغيل بالضغط'}
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#2a7a2a', cursor: 'pointer' }}>
          <input type="checkbox" checked={loopOn} onChange={e => onChange({ ...video, loop: e.target.checked })} />
          تكرار مستمر (تحريك دائم)
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#556', cursor: 'pointer' }}>
          <input type="checkbox" checked={!!video.muted} onChange={e => onChange({ ...video, muted: e.target.checked })} />
          بدون صوت
        </label>
        {videoEmbed(video.url)
          ? <span style={{ fontSize: 11.5, color: '#2a7a2a' }}><i className="fa-solid fa-circle-check" /> جاهز</span>
          : video.url ? <span style={{ fontSize: 11.5, color: '#c0392b' }}><i className="fa-solid fa-triangle-exclamation" /> تحقق من الرابط</span> : null}
        <button className="btn-danger-sm" style={{ marginInlineStart: 'auto' }} onClick={onDelete}><i className="fa-solid fa-trash-can" /></button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   AGRI ADMIN
══════════════════════════════════════════════════════ */
function WalkthroughAdmin({
  data,
  onSave,
}: {
  data: AppData;
  onSave: (u: Partial<AppData>) => void;
}) {
  const [lang, setLang] = useState<LangKey>('ar');
  const [settings, setSettings] = useState<AgriWalkthroughSettings>(data.agriWalkthrough || {});
  const [uploading, setUploading] = useState('');
  const [message, setMessage] = useState('');
  const [previewPlaying, setPreviewPlaying] = useState(false);

  useEffect(() => {
    setSettings(data.agriWalkthrough || {});
  }, [data.agriWalkthrough]);

  const commit = (next: AgriWalkthroughSettings) => {
    setSettings(next);
    onSave({ agriWalkthrough: next });
  };

  const orderedIds = (() => {
    const order = settings.stepOrder?.filter(Boolean) || [];
    if (!order.length) return WALKTHROUGH_STEPS.map(step => step.id);
    const seen = new Set<string>();
    const next: string[] = [];
    for (const id of order) {
      if (!WALKTHROUGH_STEPS.some(step => step.id === id) || seen.has(id)) continue;
      next.push(id);
      seen.add(id);
    }
    for (const step of WALKTHROUGH_STEPS) {
      if (!seen.has(step.id)) next.push(step.id);
    }
    return next;
  })();

  const overrides = new Map((settings.steps || []).map(step => [step.id, step]));
  const effectiveStep = (id: string): WalkthroughStepSettings => {
    const base = WALKTHROUGH_STEPS.find(step => step.id === id)!;
    const custom = overrides.get(id);
    return {
      id,
      enabled: custom?.enabled !== false,
      title: {
        ar: custom?.title?.ar || base.title.ar,
        en: custom?.title?.en || base.title.en,
        de: custom?.title?.de || base.title.de,
      },
      body: {
        ar: custom?.body?.ar || base.body.ar,
        en: custom?.body?.en || base.body.en,
        de: custom?.body?.de || base.body.de,
      },
      durationMs: custom?.durationMs || 5200,
      speedMultiplier: custom?.speedMultiplier || 1,
      audio: custom?.audio || {},
    };
  };

  const updateStep = (id: string, patch: Partial<WalkthroughStepSettings>) => {
    const nextStep = { ...effectiveStep(id), ...patch, id };
    const current = settings.steps || [];
    const nextSteps = current.some(step => step.id === id)
      ? current.map(step => step.id === id ? nextStep : step)
      : [...current, nextStep];
    commit({ ...settings, steps: nextSteps });
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    commit({ ...settings, stepOrder: moveItem(orderedIds, index, dir) });
  };

  const previewStepId = settings.previewStepId || orderedIds[0] || 'home';
  const previewIndex = Math.max(0, orderedIds.indexOf(previewStepId));
  const liveData: AppData = { ...data, agriWalkthrough: { ...settings, enabled: true, autoplay: false } };
  const enabledPreviewSteps = buildOrderedWalkthroughSteps(settings);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3500);
  };

  const uploadAudio = async (id: string, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('audio/') && !/\.(mp3|wav|m4a|aac|ogg|opus)$/i.test(file.name)) {
      flash('اختر ملفاً صوتياً MP3 أو WAV أو M4A');
      return;
    }
    setUploading(`audio-${id}-${lang}`);
    try {
      const url = await uploadMediaFile(file, 'walkthrough');
      if (!url) {
        flash('تعذّر الرفع — تأكد من تسجيل الدخول إلى السيرفر');
        return;
      }
      const step = effectiveStep(id);
      updateStep(id, { audio: { ...(step.audio || {}), [lang]: url } });
      flash('تم رفع صوت الشرح وحفظه ✓');
    } finally {
      setUploading('');
    }
  };

  const uploadPlantImage = async (index: number, file?: File) => {
    if (!file) return;
    setUploading(`plant-${index}`);
    try {
      const url = await uploadMediaFile(file, 'walkthrough');
      if (!url) {
        flash('تعذّر رفع الصورة');
        return;
      }
      const images = [...(settings.plantImages || [])];
      images[index] = url;
      commit({ ...settings, plantImages: images });
      flash('تم رفع صورة النبات ✓');
    } finally {
      setUploading('');
    }
  };

  const sectionLabel = (id: string) => {
    const base = WALKTHROUGH_STEPS.find(step => step.id === id);
    const section = base?.section || (
      id.startsWith('design') || id === 'open-design' ? 'design'
        : id.startsWith('dev') || id === 'open-dev' ? 'dev'
          : id.startsWith('cv') || id === 'open-cv' ? 'cv'
            : id === 'done' ? 'done'
              : id === 'home' || id.startsWith('nav-') || id === 'tap-agri' ? 'home'
                : 'agri'
    );
    return ({
      home: 'الرئيسية',
      agri: 'الزراعة',
      design: 'التصاميم',
      dev: 'البرمجة',
      cv: 'السيرة',
      done: 'الختام',
    } as Record<string, string>)[section] || section;
  };

  return (
    <div>
      <div className="admin-light-panel" style={{ padding: 16, borderRadius: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <b><i className="fa-solid fa-mobile-screen-button" /> صفحة الجولة على الموقع</b>
            <div style={{ opacity: .78, fontSize: 11, marginTop: 4 }}>
              تحكم كامل بالخطوات والمؤثرات مع معاينة جوال حية تتحدث فور كل تغيير.
            </div>
          </div>
          <a href="/#site-walkthrough" target="_blank" rel="noreferrer" className="btn-outline-sm" style={{ textDecoration: 'none' }}>
            <i className="fa-solid fa-arrow-up-right-from-square" /> معاينة في الرئيسية
          </a>
        </div>
        {message && <div style={{ color: '#7dffa8', fontWeight: 800, fontSize: 12, marginTop: 10 }}>{message}</div>}
      </div>

      <div className="tour-admin-layout">
        <div>
          <div className="admin-light-panel" style={{ padding: 14, borderRadius: 12, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, alignItems: 'end' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, fontWeight: 800 }}>
                <input type="checkbox" checked={settings.enabled !== false} onChange={e => commit({ ...settings, enabled: e.target.checked })} />
                إظهار جوال الجولة في الصفحة الرئيسية
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, fontWeight: 800 }}>
                <input type="checkbox" checked={settings.autoplay === true} onChange={e => commit({ ...settings, autoplay: e.target.checked })} />
                تشغيل تلقائي للزائر
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                سرعة الإدارة الأساسية
                <select value={settings.defaultSpeed || 1} onChange={e => commit({ ...settings, defaultSpeed: Number(e.target.value) })}
                  style={{ width: '100%', padding: 7, marginTop: 5, borderRadius: 8 }}>
                  {WALKTHROUGH_SPEED_OPTIONS.map(value => <option key={value} value={value}>{value}×</option>)}
                </select>
                <small style={{ display: 'block', opacity: .68, marginTop: 4 }}>
                  اختيار الزائر يُضرب بهذه السرعة
                </small>
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                خطوة المعاينة السريعة
                <select
                  value={previewStepId}
                  onChange={e => { commit({ ...settings, previewStepId: e.target.value }); setPreviewPlaying(false); }}
                  style={{ width: '100%', padding: 7, marginTop: 5, borderRadius: 8 }}
                >
                  {orderedIds.map((id, index) => {
                    const step = effectiveStep(id);
                    return <option key={id} value={id}>{index + 1}. {step.title?.[lang] || id}</option>;
                  })}
                </select>
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                درجة التعتيم: {Math.round((settings.dimOpacity ?? 0.6) * 100)}%
                <input type="range" min={0} max={0.9} step={0.05} value={settings.dimOpacity ?? 0.6}
                  onChange={e => commit({ ...settings, dimOpacity: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 9 }} />
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                قوة الفوكس: {(settings.focusIntensity ?? 1).toFixed(1)}×
                <input type="range" min={0} max={2} step={0.1} value={settings.focusIntensity ?? 1}
                  onChange={e => commit({ ...settings, focusIntensity: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 9 }} />
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                قوة شعاع الضغط: {(settings.beamIntensity ?? 1).toFixed(1)}×
                <input type="range" min={0} max={2} step={0.1} value={settings.beamIntensity ?? 1}
                  onChange={e => commit({ ...settings, beamIntensity: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 9 }} />
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                توهج الزر: {(settings.buttonGlow ?? 1).toFixed(1)}×
                <input type="range" min={0} max={2} step={0.1} value={settings.buttonGlow ?? 1}
                  onChange={e => commit({ ...settings, buttonGlow: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 9 }} />
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                مدة حركة الضغط: {Math.round((settings.pressDurationMs ?? 420) / 10) / 100} ثانية
                <input type="range" min={150} max={1600} step={50} value={settings.pressDurationMs ?? 420}
                  onChange={e => commit({ ...settings, pressDurationMs: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 9 }} />
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, fontWeight: 800 }}>
                <input type="checkbox" checked={settings.showHand !== false} onChange={e => commit({ ...settings, showHand: e.target.checked })} />
                إظهار يد الإصبع عند الضغط
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                حجم الإصبع: {(settings.handSize ?? 1).toFixed(1)}×
                <input type="range" min={0.5} max={2} step={0.05} value={settings.handSize ?? 1}
                  onChange={e => commit({ ...settings, handSize: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 9 }} />
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                حركة الإصبع: {(settings.handMotion ?? 1).toFixed(1)}×
                <input type="range" min={0} max={2} step={0.05} value={settings.handMotion ?? 1}
                  onChange={e => commit({ ...settings, handMotion: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 9 }} />
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                لون اليد والإصبع
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                  <input
                    type="color"
                    value={settings.handColor || '#69b8ff'}
                    onChange={e => commit({ ...settings, handColor: e.target.value })}
                    style={{ width: 46, height: 32, padding: 2, borderRadius: 8, cursor: 'pointer' }}
                  />
                  <select
                    value={(settings.handColor || '#69b8ff').toLowerCase()}
                    onChange={e => commit({ ...settings, handColor: e.target.value })}
                    style={{ flex: 1, padding: 7, borderRadius: 8 }}
                  >
                    {!['#69b8ff', '#ffffff', '#79e6ff'].includes((settings.handColor || '#69b8ff').toLowerCase()) && (
                      <option value={(settings.handColor || '#69b8ff').toLowerCase()}>لون مخصص</option>
                    )}
                    <option value="#69b8ff">أزرق مشع</option>
                    <option value="#ffffff">أبيض مشع</option>
                    <option value="#79e6ff">سماوي مشع</option>
                  </select>
                </span>
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                إزاحة الإصبع أفقياً: {settings.handOffsetX ?? 0}px
                <input type="range" min={-40} max={40} step={1} value={settings.handOffsetX ?? 0}
                  onChange={e => commit({ ...settings, handOffsetX: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 9 }} />
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                إزاحة الإصبع عمودياً: {settings.handOffsetY ?? 0}px
                <input type="range" min={-40} max={40} step={1} value={settings.handOffsetY ?? 0}
                  onChange={e => commit({ ...settings, handOffsetY: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 9 }} />
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                مدة تمرير معرض التصاميم: {((settings.designScrollDurationMs ?? 5200) / 1000).toFixed(1)} ث
                <input
                  type="range"
                  min={1500}
                  max={15000}
                  step={250}
                  value={settings.designScrollDurationMs ?? 5200}
                  onChange={e => commit({ ...settings, designScrollDurationMs: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 9 }}
                />
                <small style={{ display: 'block', opacity: .68, marginTop: 3 }}>يبدأ بطيئاً ثم يتسارع حتى أسفل المعرض</small>
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                حجم اسم المهندس: {(settings.homeNameScale ?? 1).toFixed(2)}×
                <input type="range" min={0.5} max={1.8} step={0.05} value={settings.homeNameScale ?? 1}
                  onChange={e => commit({ ...settings, homeNameScale: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 9 }} />
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                حجم صورة المهندس: {(settings.homePhotoScale ?? 1).toFixed(2)}×
                <input type="range" min={0.5} max={1.8} step={0.05} value={settings.homePhotoScale ?? 1}
                  onChange={e => commit({ ...settings, homePhotoScale: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 9 }} />
              </label>
              <label style={{ fontSize: 11, fontWeight: 800 }}>
                مقياس محتوى الرئيسية: {(settings.homeContentScale ?? 1).toFixed(2)}×
                <input type="range" min={0.7} max={1.25} step={0.01} value={settings.homeContentScale ?? 1}
                  onChange={e => commit({ ...settings, homeContentScale: Number(e.target.value) })}
                  style={{ width: '100%', marginTop: 9 }} />
              </label>
            </div>
          </div>

          <div className="admin-light-panel" style={{ padding: 14, borderRadius: 12, marginBottom: 14 }}>
            <b style={{ fontSize: 12 }}><i className="fa-solid fa-leaf" /> صور نبات حليب الشوك المستخدمة في التصوير والتقرير</b>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, marginTop: 10 }}>
              {[0, 1].map(index => {
                const src = settings.plantImages?.[index] || '';
                return (
                  <div key={index} style={{ border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, padding: 8 }}>
                    {src && <img src={resolveImageSrc(src)} alt="" style={{ width: '100%', height: 105, objectFit: 'cover', borderRadius: 7, marginBottom: 7 }} />}
                    <input value={src} placeholder="رابط الصورة" onChange={e => {
                      const images = [...(settings.plantImages || [])];
                      images[index] = e.target.value;
                      commit({ ...settings, plantImages: images });
                    }} style={{ width: '100%', padding: 7, borderRadius: 7, direction: 'ltr', fontSize: 10 }} />
                    <label className="btn-outline-sm" style={{ display: 'block', textAlign: 'center', marginTop: 7, cursor: 'pointer' }}>
                      <i className={`fa-solid ${uploading === `plant-${index}` ? 'fa-spinner fa-spin' : 'fa-upload'}`} /> رفع صورة
                      <input type="file" accept="image/*" hidden onChange={e => void uploadPlantImage(index, e.target.files?.[0])} />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap' }}>
            {LANGS.map(item => (
              <button key={item.code} type="button" onClick={() => setLang(item.code)}
                style={{ padding: '6px 12px', borderRadius: 16, border: `1px solid ${lang === item.code ? '#2a7a2a' : 'rgba(255,255,255,.2)'}`, background: lang === item.code ? '#2a7a2a' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 800 }}>
                {item.flag} {item.code.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orderedIds.map((id, index) => {
              const base = WALKTHROUGH_STEPS.find(step => step.id === id)!;
              const step = effectiveStep(id);
              const audio = step.audio?.[lang] || '';
              const isPreview = previewStepId === id;
              return (
                <details key={id} className="admin-light-panel" open={isPreview} style={{ borderRadius: 11, overflow: 'hidden', opacity: step.enabled === false ? .72 : 1 }}>
                  <summary style={{ padding: '11px 13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9 }}>
                    <ReorderBtns index={index} total={orderedIds.length} onMove={dir => moveStep(index, dir)} />
                    <span style={{ width: 27, height: 27, borderRadius: 8, background: isPreview ? '#318ce3' : '#2a7a2a', color: '#fff', display: 'inline-grid', placeItems: 'center', fontSize: 10, fontWeight: 900 }}>{index + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ display: 'block', fontSize: 12 }}>{step.title?.[lang]}</b>
                      <small style={{ opacity: .7 }}>
                        القسم: {sectionLabel(id)} · الشاشة: {base.screen}
                        {base.action ? ` · الزر: ${base.action}` : ''}
                        {` · السرعة: ×${step.speedMultiplier || 1}`}
                      </small>
                    </div>
                    {audio && <i className="fa-solid fa-volume-high" style={{ color: '#7dffa8' }} />}
                    <button
                      type="button"
                      className="btn-outline-sm"
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        commit({ ...settings, previewStepId: id });
                        setPreviewPlaying(false);
                      }}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      <i className="fa-solid fa-eye" /> معاينة
                    </button>
                    <label onClick={e => e.stopPropagation()} style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <input type="checkbox" checked={step.enabled !== false} onChange={e => updateStep(id, { enabled: e.target.checked })} /> ظاهر
                    </label>
                  </summary>
                  <div style={{ padding: 13, borderTop: '1px solid rgba(255,255,255,.08)', display: 'grid', gap: 9 }}>
                    <label style={{ fontSize: 10, fontWeight: 800 }}>عنوان الخطوة ({lang.toUpperCase()})
                      <input value={step.title?.[lang] || ''} onChange={e => updateStep(id, { title: { ...(step.title || ml('', '', '')), [lang]: e.target.value } })}
                        style={{ width: '100%', padding: 8, borderRadius: 7, marginTop: 4 }} />
                    </label>
                    <label style={{ fontSize: 10, fontWeight: 800 }}>نص الشرح ({lang.toUpperCase()})
                      <textarea value={step.body?.[lang] || ''} rows={3} onChange={e => updateStep(id, { body: { ...(step.body || ml('', '', '')), [lang]: e.target.value } })}
                        style={{ width: '100%', padding: 8, borderRadius: 7, marginTop: 4, resize: 'vertical' }} />
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 120px minmax(180px,1fr) auto', gap: 8, alignItems: 'end' }}>
                      <label style={{ fontSize: 10, fontWeight: 800 }}>المدة بالثواني
                        <input type="number" min={1.5} max={30} step={0.5} value={(step.durationMs || 5200) / 1000}
                          onChange={e => updateStep(id, { durationMs: Math.round(Number(e.target.value) * 1000) })}
                          style={{ width: '100%', padding: 7, borderRadius: 7, marginTop: 4 }} />
                      </label>
                      <label style={{ fontSize: 10, fontWeight: 800 }}>سرعة الخطوة
                        <select
                          value={step.speedMultiplier || 1}
                          onChange={e => updateStep(id, { speedMultiplier: Number(e.target.value) })}
                          style={{ width: '100%', padding: 7, borderRadius: 7, marginTop: 4 }}
                        >
                          {[0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 10].map(value => (
                            <option key={value} value={value}>×{value}</option>
                          ))}
                        </select>
                      </label>
                      <label style={{ fontSize: 10, fontWeight: 800 }}>رابط صوت الشرح ({lang.toUpperCase()})
                        <input value={audio} placeholder="MP3 / WAV / M4A" onChange={e => updateStep(id, { audio: { ...(step.audio || {}), [lang]: e.target.value } })}
                          style={{ width: '100%', padding: 7, borderRadius: 7, marginTop: 4, direction: 'ltr' }} />
                      </label>
                      <label className="btn-outline-sm" style={{ cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <i className={`fa-solid ${uploading === `audio-${id}-${lang}` ? 'fa-spinner fa-spin' : 'fa-microphone-lines'}`} /> رفع صوت
                        <input type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus" hidden onChange={e => void uploadAudio(id, e.target.files?.[0])} />
                      </label>
                    </div>
                    {audio && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <audio controls src={resolveImageSrc(audio)} style={{ height: 32, flex: 1 }} />
                        <button type="button" className="btn-danger-sm" onClick={() => updateStep(id, { audio: { ...(step.audio || {}), [lang]: '' } })}><i className="fa-solid fa-trash" /></button>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </div>

        <aside className="admin-light-panel tour-admin-preview-sticky" style={{ padding: 12, borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <b style={{ fontSize: 12 }}><i className="fa-solid fa-mobile-screen" /> معاينة حية</b>
            <span style={{ fontSize: 10, opacity: .75 }}>{enabledPreviewSteps.length} خطوة ظاهرة</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn-outline-sm" disabled={previewIndex <= 0} onClick={() => {
              const prev = orderedIds[previewIndex - 1];
              if (prev) commit({ ...settings, previewStepId: prev });
              setPreviewPlaying(false);
            }}><i className="fa-solid fa-backward-step" /></button>
            <button type="button" className="btn-outline-sm" onClick={() => setPreviewPlaying(v => !v)}>
              <i className={`fa-solid ${previewPlaying ? 'fa-pause' : 'fa-play'}`} /> {previewPlaying ? 'إيقاف' : 'تشغيل'}
            </button>
            <button type="button" className="btn-outline-sm" disabled={previewIndex >= orderedIds.length - 1} onClick={() => {
              const next = orderedIds[previewIndex + 1];
              if (next) commit({ ...settings, previewStepId: next });
              setPreviewPlaying(false);
            }}><i className="fa-solid fa-forward-step" /></button>
          </div>
          <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
            {LANGS.map(item => (
              <button key={item.code} type="button" onClick={() => setLang(item.code)}
                style={{ flex: 1, padding: '5px 0', borderRadius: 8, border: `1px solid ${lang === item.code ? '#318ce3' : 'rgba(255,255,255,.18)'}`, background: lang === item.code ? '#1b4f86' : 'transparent', color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 10 }}>
                {item.code.toUpperCase()}
              </button>
            ))}
          </div>
          <AgriWalkthrough
            key={`${previewStepId}-${lang}-${settings.defaultSpeed || 1}-${previewPlaying ? 'play' : 'pause'}`}
            previewMode={!previewPlaying}
            phoneOnly
            forceStepId={previewPlaying ? undefined : previewStepId}
            initialData={{
              ...liveData,
              agriWalkthrough: {
                ...liveData.agriWalkthrough,
                autoplay: previewPlaying,
                previewStepId,
              },
            }}
            initialLang={lang}
            className="admin-tour-preview"
          />
          <div style={{ fontSize: 11, opacity: .78, marginTop: 8, lineHeight: 1.6 }}>
            المعاينة تستخدم بيانات الموقع الفعلية. أي تعديل على المقاييس أو الخطوة يظهر هنا مباشرة.
          </div>
        </aside>
      </div>
    </div>
  );
}

function AgriAdmin({ data, onSave }: { data: AppData; onSave: (u: Partial<AppData>) => void }) {
  type TplImgKey = 'headerLogo' | 'engSignature' | 'engStamp' | 'paidStamp';
  const [tab, setTab] = useState('articles');
  const [lang, setLang] = useState<LangKey>('ar');
  const [artCats, setArtCats] = useState<ArticleCategory[]>(data.articleCategories || []);
  const [articles, setArticles] = useState<AgriArticle[]>(data.agriArticles || []);
  const [tree, setTree] = useState<LibraryNode[]>(data.libraryTree || []);
  const [libView, setLibView] = useState<LibraryView>(data.libraryView || 'tree');
  const [books, setBooks] = useState<AgriBook[]>(data.agriBooks || []);
  const [aiEnabled, setAiEnabled] = useState(data.aiDiagnosticsEnabled !== false);
  const [soilRows, setSoilRows] = useState<SoilRow[]>(data.soilAnalysis || []);
  const [tpl, setTpl] = useState<ReportTemplate>(data.reportTemplate);
  const [tplImgUploading, setTplImgUploading] = useState<Partial<Record<TplImgKey, boolean>>>({});
  const [tplUrlDraft, setTplUrlDraft] = useState<Partial<Record<TplImgKey, string>>>({});
  const [tplImgMsg, setTplImgMsg] = useState('');
  const [videos, setVideos] = useState<AgriVideo[]>(data.agriVideos || []);
  const [pubReports, setPubReports] = useState<PublicReport[]>(data.publicReports || []);
  const [currency, setCurrency] = useState<string>(data.currency || '');
  const tplRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const reportThumbRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [editArticle, setEditArticle] = useState<AgriArticle | null>(null);
  const [editBook, setEditBook] = useState<AgriBook | null>(null);
  const [showCoverGen, setShowCoverGen] = useState(false);
  const [coverGenSettings, setCoverGenSettings] = useState<Partial<CoverOverlaySettings>>(data.bookGridSettings?.coverGeneratorSettings || {});
  const [bookGrid, setBookGrid] = useState<BookGridSettings>({ ...DEFAULT_BOOK_GRID, ...(data.bookGridSettings || {}) });
  const [showGridSettings, setShowGridSettings] = useState(false);
  const [articleGrid, setArticleGrid] = useState<ArticleGridSettings>({ ...DEFAULT_ARTICLE_GRID, ...(data.articleGridSettings || {}) });
  const [showArticleGrid, setShowArticleGrid] = useState(false);
  const saveBookGrid = (g: BookGridSettings) => { setBookGrid(g); onSave({ bookGridSettings: g }); };
  const saveArticleGrid = (g: ArticleGridSettings) => { setArticleGrid(g); onSave({ articleGridSettings: g }); };
  useEffect(() => {
    setBookGrid({ ...DEFAULT_BOOK_GRID, ...(data.bookGridSettings || {}) });
  }, [data.bookGridSettings]);
  useEffect(() => {
    setCoverGenSettings(data.bookGridSettings?.coverGeneratorSettings || {});
  }, [data.bookGridSettings]);
  useEffect(() => {
    setArticleGrid({ ...DEFAULT_ARTICLE_GRID, ...(data.articleGridSettings || {}) });
  }, [data.articleGridSettings]);

  const bookGridVars = (g: BookGridSettings) => bookGridStyle(g);
  const articleGridVars = (g: ArticleGridSettings) => articleGridStyle(g);

  const previewBooks = (count: number) => (
    books.length > 0
      ? books.slice(0, count)
      : Array.from({ length: count }, (_, i) => ({
          id: String(i),
          title: { ar: `كتاب ${i + 1}`, en: `Book ${i + 1}`, de: `Buch ${i + 1}` },
          author: { ar: 'المؤلف', en: 'Author', de: 'Autor' },
          thumbnail: '',
          pages: '200',
          kind: 'both' as BookKind,
          isPaid: i === 0,
          price: i === 0 ? '500' : '',
          currency: 'SYP',
          driveUrl: '',
          nodeId: '',
          languages: [],
        }))
  );

  const renderBookPreviewCard = (b: AgriBook, i: number) => (
    <div key={b.id || i} className="book-grid-card" style={{ background: '#f5fbf5', border: '1px solid #c8e6c9', borderRadius: 8, overflow: 'hidden', fontSize: 11, position: 'relative' }}>
      {b.isPaid !== undefined && (
        <BookAccessRibbon isPaid={!!b.isPaid} freeLabel="مجاني" paidLabel="مدفوع" grid={bookGrid} />
      )}
      <BookCover src={b.thumbnail ? resolveImageSrc(b.thumbnail) : undefined} alt={pickML(b.title, lang)} />
      <div style={{ padding: '5px 6px' }}>
        <div className="book-card-title" style={{ fontWeight: 700, color: '#003366', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pickML(b.title, lang)}</div>
        <div className="book-card-author" style={{ color: '#3d4f63' }}>{pickML(b.author, lang)}</div>
        {b.isPaid && b.price && <div style={{ color: '#f0a030', fontWeight: 700, marginTop: 2 }}>{b.price} {b.currency}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          <button type="button" className="book-btn-preview" style={{ background: '#003366', color: '#fff', border: 'none' }}>
            <i className="fa-solid fa-eye" /> معاينة
          </button>
          <button type="button" className="book-btn-download" style={{ background: '#003366', color: '#fff', border: 'none' }}>
            <i className="fa-solid fa-download" /> تحميل
          </button>
        </div>
      </div>
    </div>
  );

  const saveArtCats = (c: ArticleCategory[]) => { setArtCats(c); onSave({ articleCategories: c }); };
  const saveArticles = (a: AgriArticle[]) => { setArticles(a); onSave({ agriArticles: a }); };
  const saveTree = (t: LibraryNode[]) => { setTree(t); onSave({ libraryTree: t }); };
  const saveLibView = (v: LibraryView) => { setLibView(v); onSave({ libraryView: v }); };
  const saveBooks = (b: AgriBook[]) => { setBooks(b); onSave({ agriBooks: b }); };
  const saveSoil = (rows: SoilRow[]) => { setSoilRows(rows); onSave({ soilAnalysis: rows }); };
  const saveVideos = (v: AgriVideo[]) => { setVideos(v); onSave({ agriVideos: v }); };
  const savePubReports = (r: PublicReport[]) => { setPubReports(r); onSave({ publicReports: r }); };
  const saveCurrency = (c: string) => { setCurrency(c); onSave({ currency: c }); };
  const uploadReportThumb = (id: string, files: FileList | null) => {
    if (!files || !files[0]) return;
    const r = new FileReader();
    r.onload = ev => savePubReports(pubReports.map(p => p.id === id ? { ...p, thumbnail: ev.target?.result as string } : p));
    r.readAsDataURL(files[0]);
  };
  const saveTpl = (u: Partial<ReportTemplate>) => { const next = { ...tpl, ...u }; setTpl(next); onSave({ reportTemplate: next }); };

  const flashTplImgMsg = (msg: string) => {
    setTplImgMsg(msg);
    setTimeout(() => setTplImgMsg(''), 3500);
  };

  const applyTplImgUrl = (key: TplImgKey) => {
    const url = (tplUrlDraft[key] ?? tpl[key] ?? '').trim();
    if (!url) return;
    const normalized = normalizeImageUrlForStorage(url);
    saveTpl({ [key]: normalized });
    setTplUrlDraft(prev => ({ ...prev, [key]: normalized }));
    flashTplImgMsg('تم حفظ الرابط ✓');
  };

  const uploadTplImg = async (key: TplImgKey, files: FileList | null) => {
    if (!files?.[0]) return;
    setTplImgUploading(prev => ({ ...prev, [key]: true }));
    try {
      const file = files[0];
      const serverUrl = getApiToken() ? await uploadMediaFile(file, 'reports') : null;
      if (serverUrl) {
        saveTpl({ [key]: serverUrl });
        setTplUrlDraft(prev => ({ ...prev, [key]: serverUrl }));
        flashTplImgMsg('تم الرفع والحفظ على السيرفر ✓');
        return;
      }
      const dataUrl = await compressImageFileForStorage(file, 900, 'image/png');
      saveTpl({ [key]: dataUrl });
      setTplUrlDraft(prev => ({ ...prev, [key]: '' }));
      flashTplImgMsg(getApiToken() ? 'تم الحفظ محلياً' : 'تم الحفظ محلياً — للثبات الدائم سجّل دخول السيرفر أو الصق رابط Google Drive');
    } catch {
      flashTplImgMsg('تعذّر رفع الصورة');
    } finally {
      setTplImgUploading(prev => ({ ...prev, [key]: false }));
    }
  };

  const emptyArticle = (): AgriArticle => ({ id: uid(), categoryId: artCats[0]?.id || '', title: ml('', '', ''), content: ml('', '', ''), images: [], reference: ml('', '', ''), date: new Date().toISOString().split('T')[0] });
  const emptyBook = (): AgriBook => ({ id: uid(), nodeId: '', title: ml('', '', ''), author: ml('', '', ''), thumbnail: '', driveUrl: '', previewUrl: '', isPaid: false, price: '', currency: '', pages: '', kind: 'both', languages: [] });

  const soilTotal = soilRows.reduce((acc, r) => acc + (parseFloat(r.price) || 0) * (1 + (parseFloat(r.tax) || 0) / 100), 0);

  return (
    <div>
      <h4 style={{ margin: '0 0 14px' }}><i className="fa-solid fa-seedling" style={{ color: '#2a7a2a' }} /> محتوى الزراعة</h4>
      <div className="admin-light-panel" style={{ marginBottom: 14, padding: '10px 14px', background: '#f0faf0', borderRadius: 10, border: '1px solid #c8e6c9', fontSize: 12, color: '#223344' }}>
        <i className="fa-solid fa-circle-info" style={{ color: '#2a7a2a', marginInlineEnd: 6 }} />
        ظهور أزرار السيرة الذاتية يُدار من <strong>محرر السيرة الذاتية</strong> — يمكن إخفاؤها من هنا أو إظهارها في «نبذة عني» فقط.
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <TabBar tabs={[['articles','المقالات'],['tree','هيكل المكتبة'],['books','الكتب'],['ai','تشخيص AI'],['media','الفيديو والتقارير'],['soil','تحليل التربة'],['template','إعدادات التقرير'],['reports','تقارير العملاء']]} active={tab} color="#2a7a2a" onChange={setTab} />
        {(tab === 'articles' || tab === 'tree' || tab === 'books' || tab === 'template' || tab === 'media' || tab === 'soil') && (
          <div style={{ display: 'flex', gap: 4 }}>
            {LANGS.map(l => (
              <button key={l.code} onClick={() => setLang(l.code)}
                style={{ padding: '4px 8px', borderRadius: 12, border: `1px solid ${lang === l.code ? '#2a7a2a' : '#ccc'}`, background: lang === l.code ? '#2a7a2a' : '#fff', color: lang === l.code ? '#fff' : '#555', fontSize: 11, cursor: 'pointer' }}>
                {l.flag}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'articles' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <button onClick={() => setShowArticleGrid(s => !s)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: showArticleGrid ? '#2a7a2a' : '#f0f7f0', color: showArticleGrid ? '#fff' : '#2a7a2a', border: '1px solid #c8e6c9', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              <i className="fa-solid fa-table-cells" /> إعدادات شبكة العرض
            </button>
            <MlBulkTranslateButton
              dark
              context="agriculture articles and categories"
              htmlKeys={articles.filter(a => a.content.ar?.trim()).map(a => `art_c_${a.id}`)}
              fields={collectAgriArticleMlFields(artCats, articles)}
              label="ترجمة شاملة — كل المقالات والتصنيفات"
              onComplete={tr => {
                const next = applyAgriArticleBulkTranslations(artCats, articles, tr);
                saveArtCats(next.artCats);
                saveArticles(next.articles);
              }}
            />
          </div>
          {showArticleGrid && (
            <div className="admin-light-panel" style={{ background: '#f0f7f0', border: '1px solid #a5d6a7', borderRadius: 14, padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#2a7a2a', marginBottom: 14 }}><i className="fa-solid fa-sliders" /> إعدادات شبكة عرض المقالات</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>📱 عدد المقالات في السطر (جوال)</label>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {[1,2,3,4].map(n => (
                      <button key={n} onClick={() => saveArticleGrid({ ...articleGrid, colsMobile: n })}
                        style={{ flex: '1 0 calc(25% - 4px)', minWidth: 32, padding: '7px 0', borderRadius: 8, border: `2px solid ${articleGrid.colsMobile === n ? '#2a7a2a' : '#c8e6c9'}`, background: articleGrid.colsMobile === n ? '#2a7a2a' : '#fff', color: articleGrid.colsMobile === n ? '#fff' : '#2a7a2a', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{n}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>🖥️ عدد المقالات في السطر (ويب)</label>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {[1,2,3,4,5,6].map(n => (
                      <button key={n} onClick={() => saveArticleGrid({ ...articleGrid, colsDesktop: n })}
                        style={{ flex: '1 0 calc(16% - 4px)', minWidth: 32, padding: '7px 0', borderRadius: 8, border: `2px solid ${articleGrid.colsDesktop === n ? '#2a7a2a' : '#c8e6c9'}`, background: articleGrid.colsDesktop === n ? '#2a7a2a' : '#fff', color: articleGrid.colsDesktop === n ? '#fff' : '#2a7a2a', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{n}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>↔️ المسافة بين البطاقات: <span style={{ color: '#2a7a2a' }}>{articleGrid.gap}px</span></label>
                  <input type="range" min={4} max={40} value={articleGrid.gap} onChange={e => saveArticleGrid({ ...articleGrid, gap: Number(e.target.value) })} style={{ width: '100%', accentColor: '#2a7a2a' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>📐 هامش الجانبين (جوال): <span style={{ color: '#2a7a2a' }}>{articleGrid.paddingMobile}px</span></label>
                  <input type="range" min={0} max={32} value={articleGrid.paddingMobile} onChange={e => saveArticleGrid({ ...articleGrid, paddingMobile: Number(e.target.value) })} style={{ width: '100%', accentColor: '#2a7a2a' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>🖼️ ارتفاع صورة المقالة: <span style={{ color: '#2a7a2a' }}>{articleGrid.imgHeight}px</span></label>
                  <input type="range" min={80} max={400} value={articleGrid.imgHeight} onChange={e => saveArticleGrid({ ...articleGrid, imgHeight: Number(e.target.value) })} style={{ width: '100%', accentColor: '#2a7a2a' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>📄 أسطر المقتطف: <span style={{ color: '#2a7a2a' }}>{articleGrid.excerptLines}</span></label>
                  <input type="range" min={1} max={8} value={articleGrid.excerptLines} onChange={e => saveArticleGrid({ ...articleGrid, excerptLines: Number(e.target.value) })} style={{ width: '100%', accentColor: '#2a7a2a' }} />
                </div>
                <GridFontControls value={articleGrid} onChange={patch => saveArticleGrid({ ...articleGrid, ...patch })} accent="#2a7a2a" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12 }}>
                <div style={{ background: '#fff', border: '1px dashed #a5d6a7', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#2a7a2a', marginBottom: 8 }}><i className="fa-solid fa-desktop" /> معاينة الويب ({articleGrid.colsDesktop} مقالة/سطر)</div>
                  <div className="articles-dynamic-grid articles-preview-desktop" style={articleGridVars(articleGrid)}>
                    {Array.from({ length: Math.min(articleGrid.colsDesktop, 6) }, (_, i) => (
                      <div key={i} className="card" style={{ background: '#f5fbf5', border: '1px solid #c8e6c9', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ height: articleGrid.imgHeight, background: 'linear-gradient(135deg,#c8e6c9,#a5d6a7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📰</div>
                        <div className="card-body" style={{ padding: '8px 10px' }}>
                          <span className="card-tag">2025-01-01</span>
                          <div className="card-title">مقالة {i + 1}</div>
                          <p className="card-desc">مقتطف من المحتوى يظهر هنا للمعاينة...</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background: '#fff', border: '1px dashed #a5d6a7', borderRadius: 10, padding: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#2a7a2a', marginBottom: 8 }}><i className="fa-solid fa-mobile-screen" /> معاينة الجوال ({articleGrid.colsMobile} مقالة/سطر)</div>
                  <div style={{ maxWidth: 260, margin: '0 auto', border: '2px solid #d4ead4', borderRadius: 14, padding: 6, background: '#fafcfa' }}>
                    <div className="articles-dynamic-grid articles-preview-mobile" style={articleGridVars(articleGrid)}>
                      {Array.from({ length: Math.min(articleGrid.colsMobile * 2, 6) }, (_, i) => (
                        <div key={i} className="card" style={{ background: '#f5fbf5', border: '1px solid #c8e6c9', borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{ height: Math.max(50, articleGrid.imgHeight * 0.35), background: '#c8e6c9' }} />
                          <div className="card-body" style={{ padding: '6px 8px' }}>
                            <div className="card-title">مقالة {i + 1}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* ── Article categories manager ── */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(100,220,100,0.25)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#7ee87e', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span><i className="fa-solid fa-tags" /> تصنيفات المقالات</span>
              <button type="button" className="btn-outline-sm" style={{ fontSize: 11 }}
                onClick={() => { if (confirm('استعادة التصنيفات الافتراضية مع ترجماتها؟ (يُحذف التصنيفات المخصصة)')) saveArtCats(restoreDefaultArticleCategories()); }}>
                <i className="fa-solid fa-rotate-left" /> استعادة الافتراضي
              </button>
            </div>
            {artCats.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {artCats.map((c, idx) => (
                  <div key={c.id} className="art-cat-card" style={{ border: '1px solid rgba(100,220,100,0.2)', borderRadius: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr auto auto', gap: 6, alignItems: 'center' }}>
                      <ReorderBtns index={idx} total={artCats.length} onMove={dir => saveArtCats(moveItem(artCats, idx, dir))} />
                      {(['ar', 'en', 'de'] as LangKey[]).map(lk => (
                        <input key={lk} value={c.name[lk] || ''} placeholder={lk === 'ar' ? 'العربية' : lk === 'en' ? 'English' : 'Deutsch'}
                          onChange={e => saveArtCats(artCats.map(x => x.id === c.id ? { ...x, name: { ...x.name, [lk]: e.target.value } } : x))}
                          style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '5px 8px', fontFamily: 'inherit', fontSize: 12, direction: lk === 'ar' ? 'rtl' : 'ltr', background: 'rgba(0,0,0,0.3)', color: '#e8f5e8' }} />
                      ))}
                      <MlObjectTranslateButton dark small value={c.name}
                        onChange={name => saveArtCats(artCats.map(x => x.id === c.id ? { ...x, name } : x))} />
                      <button className="btn-danger-sm" onClick={() => confirm('حذف التصنيف؟ ستبقى مقالاته بدون تصنيف.') && saveArtCats(artCats.filter(x => x.id !== c.id))}><i className="fa-solid fa-trash-can" /></button>
                    </div>
                    <div className="art-cat-label" style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, paddingInlineStart: 2 }}>AR · EN · DE — تصنيف واحد بثلاث لغات</div>
                  </div>
                ))}
              </div>
            )}
            <button className="btn-outline-sm" style={{ marginTop: artCats.length ? 8 : 0 }} onClick={() => saveArtCats([...artCats, { id: uid(), name: ml('', '', '') }])}><i className="fa-solid fa-plus" /> تصنيف جديد</button>
          </div>

          {editArticle ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <h4 style={{ margin: 0 }}>{articles.find(a => a.id === editArticle.id) ? 'تعديل مقالة' : 'مقالة جديدة'}</h4>
                <button className="btn-cancel" onClick={() => setEditArticle(null)}>✕ إلغاء</button>
              </div>
              <div className="form-group"><label>التصنيف</label>
                <select value={editArticle.categoryId} onChange={e => setEditArticle({ ...editArticle, categoryId: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: '#fff' }}>
                  <option value="">— بدون تصنيف —</option>
                  {artCats.map(c => <option key={c.id} value={c.id}>{formatCatLabel(c.name)}</option>)}
                </select>
              </div>

              <AiArticleGeneratePanel
                article={editArticle}
                categories={artCats}
                onGenerated={patch => setEditArticle(a => a ? { ...a, ...patch } : a)}
              />

              {/* Language tabs for content entry */}
              <div style={{ background: '#f0f7f0', border: '1px solid #c8e6c9', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#2a7a2a' }}>
                    <i className="fa-solid fa-language" /> محتوى المقالة بحسب اللغة — اختر لغة لتعديلها
                  </div>
                  <MlFieldsTranslateButton
                    dark={false}
                    htmlKeys={['content']}
                    context="agriculture article"
                    fields={{ title: editArticle.title, content: editArticle.content, reference: editArticle.reference }}
                    onFieldTranslated={(key, tr) => {
                      if (key === 'title') setEditArticle(a => a ? { ...a, title: mergeMlTranslation(a.title, tr) } : a);
                      else if (key === 'content') setEditArticle(a => a ? { ...a, content: mergeMlTranslation(a.content, tr) } : a);
                      else if (key === 'reference') setEditArticle(a => a ? { ...a, reference: mergeMlTranslation(a.reference, tr) } : a);
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                  {LANGS.map(l => (
                    <button key={l.code} onClick={() => setLang(l.code)}
                      style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: `2px solid ${lang === l.code ? '#2a7a2a' : '#ccc'}`, background: lang === l.code ? '#2a7a2a' : '#fff', color: lang === l.code ? '#fff' : '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      {l.flag} {l.code === 'ar' ? 'العربية' : l.code === 'en' ? 'English' : 'Deutsch'}
                    </button>
                  ))}
                </div>
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label>العنوان ({lang.toUpperCase()}) {editArticle.title[lang] ? '✓' : <span style={{ color: '#c62828' }}>فارغ</span>}</label>
                  <input type="text" value={editArticle.title[lang] || ''} placeholder={`أدخل العنوان بـ${lang === 'ar' ? 'العربية' : lang === 'en' ? 'الإنجليزية' : 'الألمانية'}`}
                    onChange={e => setEditArticle({ ...editArticle, title: { ...editArticle.title, [lang]: e.target.value } })} />
                </div>
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label>المحتوى ({lang.toUpperCase()}) {editArticle.content[lang] ? '✓' : <span style={{ color: '#c62828' }}>فارغ</span>}</label>
                  <RichEditor
                    value={editArticle.content[lang] || ''}
                    dir={lang === 'ar' ? 'rtl' : 'ltr'}
                    placeholder={`أدخل المحتوى بـ${lang === 'ar' ? 'العربية' : lang === 'en' ? 'الإنجليزية' : 'الألمانية'}`}
                    onChange={html => setEditArticle({ ...editArticle, content: { ...editArticle.content, [lang]: html } })}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>المرجع ({lang.toUpperCase()})</label>
                  <input type="text" value={editArticle.reference[lang] || ''} placeholder="اسم المرجع / رابط المصدر"
                    onChange={e => setEditArticle({ ...editArticle, reference: { ...editArticle.reference, [lang]: e.target.value } })} />
                </div>
              </div>

              <div className="form-group"><label>التاريخ</label>
                <input type="date" value={editArticle.date} onChange={e => setEditArticle({ ...editArticle, date: e.target.value })} /></div>
              <div className="form-group"><label>روابط الصور (متعددة)</label>
                <p style={{ fontSize: 11, color: '#334455', margin: '0 0 8px' }}>يدعم روابط Google Drive — الصق رابط المشاركة /view كما هو من «نسخ الرابط»</p>
                {editArticle.images.map((img, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input type="url" value={img} style={{ direction: 'ltr', flex: 1 }} placeholder="https://drive.google.com/file/d/.../view أو أي رابط صورة"
                      onChange={e => setEditArticle({ ...editArticle, images: editArticle.images.map((x, xi) => xi === i ? e.target.value : x) })}
                      onBlur={e => {
                        const norm = normalizeImageUrlForStorage(e.target.value);
                        if (norm && norm !== e.target.value) {
                          setEditArticle({ ...editArticle, images: editArticle.images.map((x, xi) => xi === i ? norm : x) });
                        }
                      }} />
                    {img && <img src={resolveImageSrc(img)} alt="" style={{ width: 48, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />}
                    <button className="btn-danger-sm" onClick={() => setEditArticle({ ...editArticle, images: editArticle.images.filter((_, xi) => xi !== i) })}><i className="fa-solid fa-xmark" /></button>
                  </div>
                ))}
                <button className="btn-outline-sm" onClick={() => setEditArticle({ ...editArticle, images: [...editArticle.images, ''] })}><i className="fa-solid fa-plus" /> إضافة صورة</button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-prime" onClick={() => {
                  const clean = {
                    ...editArticle,
                    images: editArticle.images.map(s => normalizeImageUrlForStorage(s.trim())).filter(Boolean),
                  };
                  const idx = articles.findIndex(a => a.id === clean.id);
                  saveArticles(idx >= 0 ? articles.map((a, i) => i === idx ? clean : a) : [...articles, clean]);
                  setEditArticle(null);
                }}>
                  <i className="fa-solid fa-floppy-disk" /> حفظ
                </button>
                <button className="btn-cancel" onClick={() => setEditArticle(null)}>إلغاء</button>
              </div>
            </div>
          ) : (
            <>
              <button className="btn-prime" style={{ marginBottom: 14 }} onClick={() => setEditArticle(emptyArticle())}><i className="fa-solid fa-plus" /> إضافة مقالة</button>
              <button className="btn-outline-sm" style={{ marginBottom: 14, marginInlineStart: 8 }} onClick={() => {
                const a = emptyArticle();
                if (artCats[0]) a.categoryId = artCats[0].id;
                setEditArticle(a);
              }}><i className="fa-solid fa-robot" /> مقالة جديدة + توليد AI</button>
              {articles.length === 0 ? <p style={{ color: '#3d4f63', fontSize: 13 }}>لا توجد مقالات بعد.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {articles.map(a => {
                    const cat = artCats.find(c => c.id === a.categoryId);
                    return (
                    <div key={a.id} style={{ background: '#f5fbf5', border: '1px solid #c8e6c9', borderRadius: 10, padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      {a.images[0] && <img src={resolveImageSrc(a.images[0])} alt="" style={{ width: 70, height: 60, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>{pickML(a.title, lang)}</div>
                        <div style={{ fontSize: 12, color: '#3d4f63', marginTop: 2 }}>{a.date}{cat ? ` — ${pickML(cat.name, lang)}` : ' — بدون تصنيف'}{a.images.length > 1 ? ` — ${a.images.length} صور` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-outline-sm" title="توليد بالذكاء الاصطناعي" onClick={() => setEditArticle({ ...a, images: [...a.images] })} style={{ color: '#2a7a2a', borderColor: '#81c784' }}>
                          <i className="fa-solid fa-robot" />
                        </button>
                        <button className="btn-outline-sm" onClick={() => setEditArticle(a)}><i className="fa-solid fa-pen" /></button>
                        <button className="btn-danger-sm" onClick={() => confirm('حذف؟') && saveArticles(articles.filter(x => x.id !== a.id))}><i className="fa-solid fa-trash-can" /></button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === 'tree' && (
        <>
          <div style={{ background: '#f8fdf8', border: '1px solid #c8e6c9', borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#2a7a2a', marginBottom: 8 }}><i className="fa-solid fa-eye" /> طريقة عرض المكتبة للزائر</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => saveLibView('tree')}
                style={{ flex: '1 1 200px', textAlign: 'start', cursor: 'pointer', borderRadius: 8, padding: '10px 12px', border: libView === 'tree' ? '2px solid #2a7a2a' : '1px solid #cfe3cf', background: libView === 'tree' ? '#eaf7ea' : '#fff', fontFamily: 'inherit' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}><i className="fa-solid fa-folder-tree" /> شجرة قابلة للطي</div>
                <div style={{ fontSize: 11, color: '#3d4f63', marginTop: 3 }}>يفتح الزائر الفروع بالنقر — مناسب للمكتبات الكبيرة.</div>
              </button>
              <button onClick={() => saveLibView('expanded')}
                style={{ flex: '1 1 200px', textAlign: 'start', cursor: 'pointer', borderRadius: 8, padding: '10px 12px', border: libView === 'expanded' ? '2px solid #2a7a2a' : '1px solid #cfe3cf', background: libView === 'expanded' ? '#eaf7ea' : '#fff', fontFamily: 'inherit' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}><i className="fa-solid fa-table-cells-large" /> عرض كامل موسّع</div>
                <div style={{ fontSize: 11, color: '#3d4f63', marginTop: 3 }}>كل الكتب ظاهرة، الفصول جنباً إلى جنب تحت كل سنة.</div>
              </button>
            </div>
          </div>
          <LibraryTreeEditor tree={tree} lang={lang} onChange={saveTree} />
        </>
      )}

      {tab === 'books' && (() => {
        const paths = flattenLibrary(tree, lang);
        const pathOf = (id: string) => paths.find(p => p.id === id)?.path || '';
        const kindLabel = (k: BookKind) => k === 'theory' ? 'نظري' : k === 'practical' ? 'عملي' : 'نظري وعملي';
        return (
        <>
          {editBook ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <h4 style={{ margin: 0 }}>{books.find(b => b.id === editBook.id) ? 'تعديل كتاب' : 'كتاب جديد'}</h4>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <MlFieldsTranslateButton
                    fields={{ title: editBook.title, author: editBook.author }}
                    context="library book"
                    onFieldTranslated={(key, tr) => {
                      if (key === 'title') setEditBook(b => b ? { ...b, title: mergeMlTranslation(b.title, tr) } : b);
                      else if (key === 'author') setEditBook(b => b ? { ...b, author: mergeMlTranslation(b.author, tr) } : b);
                    }}
                  />
                  <button className="btn-cancel" onClick={() => setEditBook(null)}>✕</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group"><label>عنوان الكتاب ({lang.toUpperCase()})</label>
                  <input type="text" value={editBook.title[lang] || ''} onChange={e => setEditBook({ ...editBook, title: { ...editBook.title, [lang]: e.target.value } })} /></div>
                <div className="form-group"><label>المؤلف ({lang.toUpperCase()})</label>
                  <input type="text" value={editBook.author[lang] || ''} onChange={e => setEditBook({ ...editBook, author: { ...editBook.author, [lang]: e.target.value } })} /></div>
                <div className="form-group"><label>عدد الصفحات</label>
                  <input type="text" value={editBook.pages} onChange={e => setEditBook({ ...editBook, pages: e.target.value })} /></div>
                <div className="form-group"><label>نوع الكتاب</label>
                  <select value={editBook.kind} onChange={e => setEditBook({ ...editBook, kind: e.target.value as BookKind })}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: '#fff' }}>
                    <option value="theory">نظري</option>
                    <option value="practical">عملي</option>
                    <option value="both">نظري وعملي</option>
                  </select>
                </div>
                <div className="form-group"><label>🔒 رابط التحميل الكامل (يُخفى عن الزوار إذا مدفوع)</label>
                  <input type="url" value={editBook.driveUrl} style={{ direction: 'ltr' }} placeholder="https://drive.google.com/file/d/.../view" onChange={e => setEditBook({ ...editBook, driveUrl: e.target.value })} /></div>
                <div className="form-group">
                  <label>رابط صورة الغلاف</label>
                  <p style={{ fontSize: 10, color: '#3d4f63', margin: '0 0 6px' }}>يدعم Google Drive — الصق رابط /view مباشرة</p>
                  <input type="url" value={editBook.thumbnail.startsWith('data:') ? '' : editBook.thumbnail} style={{ direction: 'ltr', width: '100%' }} placeholder="https://drive.google.com/file/d/.../view"
                    onChange={e => setEditBook({ ...editBook, thumbnail: e.target.value })}
                    onBlur={e => { const n = normalizeImageUrlForStorage(e.target.value); if (n && n !== e.target.value) setEditBook({ ...editBook, thumbnail: n }); }} />
                  {/* معاينة الصورة الحالية */}
                  {editBook.thumbnail && (
                    <img src={editBook.thumbnail.startsWith('data:') ? editBook.thumbnail : resolveImageSrc(editBook.thumbnail)} alt="" style={{ marginTop: 8, width: 80, height: 100, objectFit: 'cover', borderRadius: 6, border: '1px solid #ccc' }} onError={e => (e.currentTarget.style.display = 'none')} />
                  )}
                  {/* زر مولّد الغلاف */}
                  <button
                    type="button"
                    onClick={() => setShowCoverGen(true)}
                    style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'linear-gradient(135deg,rgba(99,179,237,0.2),rgba(159,122,234,0.2))', border: '1px solid rgba(99,179,237,0.4)', color: '#90cdf4', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                    🎨 توليد غلاف تلقائي
                  </button>
                  <p style={{ fontSize: 10, color: '#7a9cc0', margin: '4px 0 0' }}>ارفع صورة واحدة (لوغو/شعار) ويُكتب عنوان الكتاب تلقائياً على الغلاف</p>
                </div>
              </div>

              {/* Paid / Free toggle + Preview URL + Price */}
              <div style={{ background: 'rgba(255,160,0,0.07)', border: '1.5px solid rgba(255,160,0,0.25)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: '#f0a030' }}>
                    <i className="fa-solid fa-tag" /> نوع الوصول
                  </span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <span style={{ fontSize: 12, color: editBook.isPaid ? '#aaa' : '#22c55e', fontWeight: 700 }}>🆓 مجاني</span>
                    <div
                      onClick={() => setEditBook({ ...editBook, isPaid: !editBook.isPaid })}
                      style={{ position: 'relative', width: 46, height: 24, borderRadius: 12, background: editBook.isPaid ? '#f0a030' : 'rgba(34,197,94,0.3)', cursor: 'pointer', transition: 'background .25s', border: '1.5px solid rgba(255,255,255,0.2)', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 2, transition: 'left .25s', left: editBook.isPaid ? 22 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                    </div>
                    <span style={{ fontSize: 12, color: editBook.isPaid ? '#f0a030' : '#aaa', fontWeight: 700 }}>💰 مدفوع</span>
                  </label>
                </div>
                {/* Price & Currency — shown when paid */}
                {editBook.isPaid && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>💵 سعر الكتاب</label>
                      <input type="text" value={editBook.price || ''} placeholder="مثال: 500"
                        onChange={e => setEditBook({ ...editBook, price: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>🏦 العملة</label>
                      <select value={editBook.currency || ''} onChange={e => setEditBook({ ...editBook, currency: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: '#fff' }}>
                        <option value="">— اختر العملة —</option>
                        <option value="SYP">🇸🇾 ليرة سورية (SYP)</option>
                        <option value="USD">🇺🇸 دولار أمريكي (USD)</option>
                        <option value="EUR">🇪🇺 يورو (EUR)</option>
                        <option value="AED">🇦🇪 درهم إماراتي (AED)</option>
                        <option value="SAR">🇸🇦 ريال سعودي (SAR)</option>
                        <option value="IQD">🇮🇶 دينار عراقي (IQD)</option>
                        <option value="JOD">🇯🇴 دينار أردني (JOD)</option>
                        <option value="EGP">🇪🇬 جنيه مصري (EGP)</option>
                        <option value="TRY">🇹🇷 ليرة تركية (TRY)</option>
                        <option value="GBP">🇬🇧 جنيه إسترليني (GBP)</option>
                      </select>
                    </div>
                  </div>
                )}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>🔍 رابط المعاينة (Google Drive Preview — يُعرض للجميع)</label>
                  <input type="url" value={editBook.previewUrl || ''} style={{ direction: 'ltr' }} placeholder="https://drive.google.com/file/d/.../preview"
                    onChange={e => setEditBook({ ...editBook, previewUrl: e.target.value })} />
                  <div style={{ fontSize: 10, color: '#f0a030', marginTop: 5, lineHeight: 1.5 }}>
                    💡 ابدّل <code style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 3, padding: '1px 4px' }}>/view</code> بـ <code style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 3, padding: '1px 4px' }}>/preview</code> في رابط Google Drive للعرض بدون زر التحميل.
                    {editBook.isPaid && <> للصفحات الـ10 الأولى فقط، ارفع نسخة مختصرة على Drive وضع رابطها هنا.</>}
                  </div>
                </div>
              </div>
              <div className="form-group"><label>مسار التصنيف الشجري</label>
                <select value={editBook.nodeId} onChange={e => setEditBook({ ...editBook, nodeId: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, background: '#fff' }}>
                  <option value="">— غير محدد —</option>
                  {paths.map(p => <option key={p.id} value={p.id}>{p.path}</option>)}
                </select>
                {paths.length === 0 && <div style={{ fontSize: 12, color: '#c62828', marginTop: 4 }}>لا يوجد هيكل بعد — أنشئ فروع المكتبة من تبويب «هيكل المكتبة».</div>}
              </div>

              {/* Language Visibility */}
              <div style={{ background: '#f0f7f0', border: '1px solid #c8e6c9', borderRadius: 10, padding: 12, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#2a7a2a', marginBottom: 8 }}>
                  <i className="fa-solid fa-eye" /> إظهار الكتاب في اللغات (Language Visibility)
                </div>
                <div style={{ fontSize: 11, color: '#334455', marginBottom: 10 }}>اتركه فارغاً لإظهاره في جميع اللغات. حدّد لغات معينة لتقييد الظهور.</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {LANGS.map(l => {
                    const checked = (editBook.languages || []).includes(l.code);
                    return (
                      <label key={l.code} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        <input type="checkbox" checked={checked}
                          onChange={() => {
                            const current = editBook.languages || [];
                            const next = checked ? current.filter(x => x !== l.code) : [...current, l.code];
                            setEditBook({ ...editBook, languages: next });
                          }}
                          style={{ width: 16, height: 16, cursor: 'pointer' }} />
                        {l.flag} {l.code === 'ar' ? 'العربية' : l.code === 'en' ? 'English' : 'Deutsch'}
                      </label>
                    );
                  })}
                </div>
                {(editBook.languages || []).length === 0 && (
                  <div style={{ fontSize: 11, color: '#2a7a2a', marginTop: 6 }}>✓ يظهر في جميع اللغات (الوضع الافتراضي)</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-prime" onClick={() => { const idx = books.findIndex(b => b.id === editBook.id); saveBooks(idx >= 0 ? books.map((b, i) => i === idx ? editBook : b) : [...books, editBook]); setEditBook(null); }}>
                  <i className="fa-solid fa-floppy-disk" /> حفظ
                </button>
                <button className="btn-cancel" onClick={() => setEditBook(null)}>إلغاء</button>
              </div>

              {/* مولّد الغلاف التلقائي */}
              {showCoverGen && editBook && (
                <BookCoverGenerator
                  initialSettings={coverGenSettings}
                  bookTitle={editBook.title[lang] || editBook.title.ar || ''}
                  lang={lang}
                  onApply={(dataUrl, settings) => {
                    setEditBook({ ...editBook, thumbnail: dataUrl });
                    setCoverGenSettings(settings);
                    const nextGrid: BookGridSettings = {
                      ...bookGrid,
                      coverGeneratorSettings: {
                        ...settings,
                        // لا نخزّن Data URL كبيرة في DB
                        bgUrl: settings.bgUrl?.startsWith('data:') ? '' : settings.bgUrl,
                      },
                    };
                    setBookGrid(nextGrid);
                    onSave({ bookGridSettings: nextGrid });
                    setShowCoverGen(false);
                  }}
                  onClose={() => setShowCoverGen(false)}
                />
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn-prime" onClick={() => setEditBook(emptyBook())}><i className="fa-solid fa-plus" /> إضافة كتاب</button>
                <button onClick={() => setShowGridSettings(s => !s)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: showGridSettings ? '#2a7a2a' : '#f0f7f0', color: showGridSettings ? '#fff' : '#2a7a2a', border: '1px solid #c8e6c9', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <i className="fa-solid fa-table-cells" /> إعدادات العرض
                </button>
              </div>

              {/* ── Grid Settings Panel ── */}
              {showGridSettings && (
                <div style={{ background: '#f0f7f0', border: '1px solid #a5d6a7', borderRadius: 14, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#2a7a2a', marginBottom: 14 }}><i className="fa-solid fa-sliders" /> إعدادات شبكة عرض الكتب</div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                    {/* Columns Mobile */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>📱 عدد الكتب في السطر (جوال)</label>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {[2,3,4,5,6,7].map(n => (
                          <button key={n} onClick={() => saveBookGrid({ ...bookGrid, colsMobile: n })}
                            style={{ flex: '1 0 calc(16% - 4px)', minWidth: 32, padding: '7px 0', borderRadius: 8, border: `2px solid ${bookGrid.colsMobile === n ? '#2a7a2a' : '#c8e6c9'}`, background: bookGrid.colsMobile === n ? '#2a7a2a' : '#fff', color: bookGrid.colsMobile === n ? '#fff' : '#2a7a2a', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Columns Desktop */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>🖥️ عدد الكتب في السطر (ويب)</label>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {[2,3,4,5,6,7].map(n => (
                          <button key={n} onClick={() => saveBookGrid({ ...bookGrid, colsDesktop: n })}
                            style={{ flex: '1 0 calc(16% - 4px)', minWidth: 32, padding: '7px 0', borderRadius: 8, border: `2px solid ${bookGrid.colsDesktop === n ? '#2a7a2a' : '#c8e6c9'}`, background: bookGrid.colsDesktop === n ? '#2a7a2a' : '#fff', color: bookGrid.colsDesktop === n ? '#fff' : '#2a7a2a', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Gap */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>↔️ المسافة بين الكتب: <span style={{ color: '#2a7a2a' }}>{bookGrid.gap}px</span></label>
                      <input type="range" min={2} max={32} value={bookGrid.gap}
                        onChange={e => saveBookGrid({ ...bookGrid, gap: Number(e.target.value) })}
                        style={{ width: '100%', accentColor: '#2a7a2a' }} />
                    </div>
                    {/* Padding Mobile */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>📐 هامش الجانبين (جوال): <span style={{ color: '#2a7a2a' }}>{bookGrid.paddingMobile}px</span></label>
                      <input type="range" min={0} max={24} value={bookGrid.paddingMobile}
                        onChange={e => saveBookGrid({ ...bookGrid, paddingMobile: Number(e.target.value) })}
                        style={{ width: '100%', accentColor: '#2a7a2a' }} />
                    </div>
                    {/* Image Height */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>📐 ارتفاع غلاف A4 (شاقولي): <span style={{ color: '#2a7a2a' }}>{bookGrid.imgHeight}px</span></label>
                      <input type="range" min={80} max={320} value={bookGrid.imgHeight}
                        onChange={e => saveBookGrid({ ...bookGrid, imgHeight: Number(e.target.value) })}
                        style={{ width: '100%', accentColor: '#2a7a2a' }} />
                    </div>
                    {/* Card Width */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>📏 عرض البطاقة: <span style={{ color: '#2a7a2a' }}>{bookGrid.cardWidth ?? 100}px</span></label>
                      <input type="range" min={48} max={200} value={bookGrid.cardWidth ?? 100}
                        onChange={e => saveBookGrid({ ...bookGrid, cardWidth: Number(e.target.value) })}
                        style={{ width: '100%', accentColor: '#2a7a2a' }} />
                    </div>
                    <GridFontControls value={{ ...bookGrid, titleFontSize: bookGrid.titleFontSize ?? 13, descFontSize: bookGrid.descFontSize ?? 11, tagFontSize: bookGrid.tagFontSize ?? 10, autoScaleFont: bookGrid.autoScaleFont !== false }} onChange={patch => saveBookGrid({ ...bookGrid, ...patch })} accent="#2a7a2a" />
                    <BookActionFontControls value={{ ...bookGrid, previewBtnFontSize: bookGrid.previewBtnFontSize ?? 12, downloadBtnFontSize: bookGrid.downloadBtnFontSize ?? 12, autoScaleFont: bookGrid.autoScaleFont !== false }} onChange={patch => saveBookGrid({ ...bookGrid, ...patch })} accent="#2a7a2a" />
                    <BookRibbonControls grid={bookGrid} onChange={patch => saveBookGrid({ ...bookGrid, ...patch })} accent="#2a7a2a" />
                  </div>

                  {/* Dual Preview: Web + Mobile */}
                  <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12 }}>
                    <div style={{ background: '#fff', border: '1px dashed #a5d6a7', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#2a7a2a', marginBottom: 8 }}>
                        <i className="fa-solid fa-desktop" /> معاينة الويب ({bookGrid.colsDesktop} كتب/سطر)
                      </div>
                      <div className="books-dynamic-grid books-preview-desktop" style={bookGridVars(bookGrid)}>
                        {previewBooks(bookGrid.colsDesktop).map(renderBookPreviewCard)}
                      </div>
                    </div>
                    <div style={{ background: '#fff', border: '1px dashed #a5d6a7', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#2a7a2a', marginBottom: 8 }}>
                        <i className="fa-solid fa-mobile-screen" /> معاينة الجوال ({bookGrid.colsMobile} كتب/سطر)
                      </div>
                      <div style={{ maxWidth: 260, margin: '0 auto', border: '2px solid #d4ead4', borderRadius: 14, padding: 6, background: '#fafcfa' }}>
                        <div className="books-dynamic-grid books-preview-mobile" style={bookGridVars(bookGrid)}>
                          {previewBooks(bookGrid.colsMobile * 2).map(renderBookPreviewCard)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#445566', marginTop: 6, textAlign: 'center' }}>↑ معاينة تقريبية — تُطبَّق على الموقع حسب الجوال أو الويب</div>
                </div>
              )}

              {books.length === 0 ? <p style={{ color: '#3d4f63', fontSize: 13 }}>لا توجد كتب بعد.</p> : (
                <div className="books-dynamic-grid books-preview-desktop" style={bookGridVars(bookGrid)}>
                  {books.map(b => (
                    <div key={b.id} className="book-grid-card" style={{ background: '#f5fbf5', border: '1px solid #c8e6c9', borderRadius: 10, overflow: 'hidden', position: 'relative' }}>
                      {b.isPaid !== undefined && (
                        <BookAccessRibbon isPaid={!!b.isPaid} freeLabel="مجاني" paidLabel="مدفوع" grid={bookGrid} />
                      )}
                      <BookCover src={b.thumbnail ? resolveImageSrc(b.thumbnail) : undefined} alt={pickML(b.title, lang)} />
                      <div style={{ padding: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{pickML(b.title, lang)}</div>
                        <div style={{ fontSize: 11, color: '#3d4f63' }}>{pickML(b.author, lang)}</div>
                        <div style={{ fontSize: 10, color: '#2a7a2a', marginTop: 2 }}>{kindLabel(b.kind)}{b.pages ? ` • ${b.pages} ص` : ''}</div>
                        {b.isPaid && b.price && <div style={{ fontSize: 11, color: '#f0a030', fontWeight: 700, marginTop: 2 }}>💰 {b.price} {b.currency}</div>}
                        <div style={{ fontSize: 10, color: '#445566', marginTop: 2 }}>{pathOf(b.nodeId) || 'بدون تصنيف'}</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                          <button className="btn-outline-sm" onClick={() => setEditBook(b)}><i className="fa-solid fa-pen" /></button>
                          <button className="btn-danger-sm" onClick={() => confirm('حذف؟') && saveBooks(books.filter(x => x.id !== b.id))}><i className="fa-solid fa-trash-can" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
        );
      })()}

      {tab === 'ai' && <AiKeyPanel aiEnabled={aiEnabled} onToggle={v => { setAiEnabled(v); onSave({ aiDiagnosticsEnabled: v }); }} />}

      {tab === 'media' && (
        <div>
          {/* ── Instructional videos ── */}
          <h4 style={{ margin: '0 0 6px' }}><i className="fa-solid fa-clapperboard" style={{ color: '#2a7a2a' }} /> الفيديو التوضيحي</h4>
          <p style={{ fontSize: 12, color: '#334455', marginBottom: 12 }}>
            الصق رابط الفيديو (جوجل درايف مفضّل للدقة الأصلية / يوتيوب / فيميو). التشغيل يتم بالملف الأصلي عبر الخادم — وليس مشغّل Drive الضعيف.
            الصورة المصغّرة: رابط Drive لصورة، أو التقاط إطار من الفيديو. التشغيل: تلقائي أو بالضغط.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {videos.map(v => (
              <AgriVideoAdminRow
                key={v.id}
                video={v}
                lang={lang}
                onChange={next => saveVideos(videos.map(x => x.id === v.id ? next : x))}
                onDelete={() => saveVideos(videos.filter(x => x.id !== v.id))}
              />
            ))}
          </div>
          <button className="btn-outline-sm" onClick={() => saveVideos([...videos, { id: uid(), title: ml('', '', ''), url: '', visible: true, poster: '', autoplay: true, loop: true, muted: true }])}><i className="fa-solid fa-plus" /> إضافة فيديو</button>

          {/* ── Public client reports ── */}
          <h4 style={{ margin: '26px 0 6px' }}><i className="fa-solid fa-folder-open" style={{ color: '#2a7a2a' }} /> تقارير العملاء (المعروضة للزوار)</h4>
          <p style={{ fontSize: 12, color: '#334455', marginBottom: 12 }}>
            الصورة المصغّرة: اتركها فارغة لعرض معاينة حيّة للتقرير حسب لغة الموقع، أو الصق رابط Google Drive لصورة ثابتة.
            رابط التقرير يمكن أن يكون <code style={{ fontSize: 11 }}>customer-report:معرّف</code> أو PDF من Drive.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, marginBottom: 12 }}>
            {pubReports.map(r => (
              <div key={r.id} style={{ border: '1px solid #c8e6c9', borderRadius: 10, padding: 12, background: '#f8fdf8' }}>
                <div onClick={() => reportThumbRefs.current[r.id]?.click()} style={{ cursor: 'pointer', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #bbb', borderRadius: 8, background: '#fff', marginBottom: 8, overflow: 'hidden' }}>
                  {r.thumbnail
                    ? <img src={r.thumbnail.startsWith('data:') ? r.thumbnail : resolveImageSrc(r.thumbnail)} alt="" style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }} />
                    : <span style={{ color: '#556677', fontSize: 12, textAlign: 'center', padding: 8, lineHeight: 1.5 }}><i className="fa-solid fa-file-lines" /><br />معاينة حيّة للتقرير</span>}
                </div>
                <input ref={el => { reportThumbRefs.current[r.id] = el; }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { uploadReportThumb(r.id, e.target.files); e.target.value = ''; }} />
                <input
                  placeholder="رابط صورة مصغرة Google Drive (اختياري)"
                  value={r.thumbnail.startsWith('data:') ? '' : r.thumbnail}
                  style={{ width: '100%', boxSizing: 'border-box', direction: 'ltr', padding: '7px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 12, marginBottom: 6 }}
                  onChange={e => savePubReports(pubReports.map(x => x.id === r.id ? { ...x, thumbnail: e.target.value } : x))}
                  onBlur={e => {
                    const n = normalizeImageUrlForStorage(e.target.value.trim());
                    if (n && n !== e.target.value.trim()) {
                      savePubReports(pubReports.map(x => x.id === r.id ? { ...x, thumbnail: n } : x));
                    }
                  }}
                />
                {r.thumbnail && (
                  <button type="button" className="btn-outline-sm" style={{ marginBottom: 8, fontSize: 11 }}
                    onClick={() => savePubReports(pubReports.map(x => x.id === r.id ? { ...x, thumbnail: '' } : x))}>
                    <i className="fa-solid fa-rotate-left" /> استخدام معاينة التقرير الحية
                  </button>
                )}
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input placeholder={`عنوان التقرير (${lang.toUpperCase()})`} value={r.title[lang] || ''}
                    onChange={e => savePubReports(pubReports.map(x => x.id === r.id ? { ...x, title: { ...x.title, [lang]: e.target.value } } : x))}
                    style={{ flex: 1, boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 12.5 }} />
                  <MlObjectTranslateButton small value={r.title}
                    onChange={title => savePubReports(pubReports.map(x => x.id === r.id ? { ...x, title } : x))} />
                </div>
                <input placeholder="رابط التقرير (customer-report:id أو Google Drive PDF)" value={r.url} style={{ width: '100%', boxSizing: 'border-box', direction: 'ltr', padding: '7px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 12.5, marginBottom: 4 }}
                  onChange={e => savePubReports(pubReports.map(x => x.id === r.id ? { ...x, url: e.target.value } : x))}
                  onBlur={e => {
                    const url = e.target.value.trim();
                    if (!url || /^customer-report:/i.test(url)) {
                      savePubReports(pubReports.map(x => x.id === r.id ? { ...x, url } : x));
                      return;
                    }
                    const disp = resolveReportDisplay(url, r.thumbnail);
                    savePubReports(pubReports.map(x => x.id === r.id ? {
                      ...x,
                      url,
                      /* لا تملأ المصغّرة تلقائياً إن أراد المستخدم المعاينة الحية */
                      thumbnail: x.thumbnail || '',
                    } : x));
                    void disp;
                  }} />
                {r.url && resolveReportDisplay(r.url, r.thumbnail).useModal && (
                  <span style={{ fontSize: 11, color: '#2a7a2a', display: 'block', marginBottom: 8 }}><i className="fa-solid fa-file-pdf" /> PDF — يُعرض للقراءة داخل الموقع</span>
                )}
                {/^customer-report:/i.test(r.url || '') && (
                  <span style={{ fontSize: 11, color: '#2a7a2a', display: 'block', marginBottom: 8 }}><i className="fa-solid fa-file-lines" /> تقرير A4 داخلي — مصغّرة حيّة حسب اللغة</span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: r.visible ? '#2a7a2a' : '#999', cursor: 'pointer' }}>
                    <input type="checkbox" checked={r.visible} onChange={e => savePubReports(pubReports.map(x => x.id === r.id ? { ...x, visible: e.target.checked } : x))} />
                    {r.visible ? 'ظاهر' : 'مخفي'}
                  </label>
                  <button className="btn-danger-sm" style={{ marginInlineStart: 'auto' }} onClick={() => savePubReports(pubReports.filter(x => x.id !== r.id))}><i className="fa-solid fa-trash-can" /></button>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-outline-sm" onClick={() => savePubReports([...pubReports, { id: uid(), title: ml('', '', ''), thumbnail: '', url: '', visible: true }])}><i className="fa-solid fa-plus" /> إضافة تقرير</button>
        </div>
      )}

      {tab === 'soil' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap', background: '#f8fdf8', border: '1px solid #c8e6c9', borderRadius: 10, padding: '12px 14px' }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#2a7a2a' }}><i className="fa-solid fa-coins" /> عملة التسعير (حسب الدولة)</label>
            <input value={currency} onChange={e => saveCurrency(e.target.value)} placeholder="مثال: د.إ / $ / ر.س / €"
              style={{ width: 180, padding: '7px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }} />
            <span style={{ fontSize: 11.5, color: '#3d4f63' }}>تظهر بجانب الأسعار في تقارير العملاء.</span>
          </div>
          <h4 style={{ margin: '0 0 14px' }}><i className="fa-solid fa-vials" /> جدول تحليل التربة</h4>
          <div className="soil-table-wrap" style={{ overflowX: 'auto', marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#2a7a2a', color: '#fff' }}>
                  {['الاختبار', 'المثالي', 'الفعلي', 'السعر', 'الضريبة %', 'الإجمالي', ''].map((h, i) => (
                    <th key={i} style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {soilRows.map((row, i) => {
                  const total = ((parseFloat(row.price) || 0) * (1 + (parseFloat(row.tax) || 0) / 100)).toFixed(2);
                  const nameML = typeof row.name === 'string' ? ml(row.name, row.name, row.name) : row.name as import('./appData').ML;
                  return (
                    <tr key={row.id} style={{ background: i % 2 === 0 ? '#f5fbf5' : '#fff' }}>
                      <td style={{ padding: '5px 8px', borderBottom: '1px solid #e8f5e9', minWidth: 160 }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input value={nameML[lang] || ''} placeholder={`الاسم (${lang.toUpperCase()})`}
                            onChange={e => saveSoil(soilRows.map((r, j) => j === i ? { ...r, name: { ...nameML, [lang]: e.target.value } } : r))}
                            style={{ border: 'none', background: 'transparent', flex: 1, fontFamily: 'inherit', fontSize: 12 }} />
                          <MlObjectTranslateButton small value={nameML}
                            onChange={name => saveSoil(soilRows.map((r, j) => j === i ? { ...r, name } : r))} />
                        </div>
                      </td>
                      {(['ideal','actual','price','tax'] as const).map(field => (
                        <td key={field} style={{ padding: '5px 8px', borderBottom: '1px solid #e8f5e9' }}>
                          <input value={row[field]} onChange={e => saveSoil(soilRows.map((r, j) => j === i ? { ...r, [field]: e.target.value } : r))}
                            style={{ border: 'none', background: 'transparent', width: 60, fontFamily: 'inherit', fontSize: 12, direction: 'ltr' }} />
                        </td>
                      ))}
                      <td style={{ padding: '5px 8px', fontWeight: 700, color: '#2a7a2a', direction: 'ltr' }}>{total}</td>
                      <td><button className="btn-danger-sm" onClick={() => saveSoil(soilRows.filter((_, j) => j !== i))}><i className="fa-solid fa-trash-can" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#e8f5e9' }}>
                  <td colSpan={5} style={{ padding: '8px 10px', fontWeight: 700 }}>الإجمالي الكلي:</td>
                  <td style={{ padding: '8px 10px', fontWeight: 900, color: '#2a7a2a', direction: 'ltr' }}>{soilTotal.toFixed(2)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-outline-sm" onClick={() => saveSoil([...soilRows, { id: uid(), name: ml('اختبار جديد', 'New Test', 'Neuer Test'), ideal: '', actual: '', price: '', tax: '5' }])}><i className="fa-solid fa-plus" /> إضافة اختبار</button>
          </div>
          <p style={{ fontSize: 12, color: '#3d4f63', marginTop: 10 }}><i className="fa-solid fa-circle-info" /> يظهر هذا الجدول في تقرير الـ PDF فقط عند إدخال بيانات. إذا تُرك فارغاً يُخفى تلقائياً من التقرير.</p>
        </div>
      )}

      {tab === 'template' && (
        <div>
          <h4 style={{ margin: '0 0 6px' }}><i className="fa-solid fa-file-invoice" style={{ color: '#7ee87e' }} /> إعدادات قالب التقرير</h4>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>تتحكم هذه الإعدادات بشكل تقرير الـ PDF (الألوان، الشعار، الهوامش، النصوص، التوقيع والختم).</p>

          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(100,220,100,0.25)', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#7ee87e' }}>
              <input
                type="checkbox"
                checked={data.siteSettings?.reportGalleryShowCustomerName !== false}
                onChange={e => onSave({
                  siteSettings: {
                    ...data.siteSettings,
                    reportGalleryShowCustomerName: e.target.checked,
                  },
                })}
              />
              إظهار اسم العميل تحت بطاقة التقرير في المعرض
            </label>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 6, lineHeight: 1.5 }}>
              إن أُلغي التحديد يبقى سطر «تحليل التربة — النبات» فقط بدون اسم العميل.
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(100,220,100,0.25)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#7ee87e', marginBottom: 10 }}>
              <i className="fa-solid fa-table-cells" /> شبكة معرض التقارير (جوال / ويب)
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 12, lineHeight: 1.5 }}>
              مثل المقالات والتصاميم: اختر كم تقريراً يظهر في الصف الواحد.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#7ee87e', display: 'block', marginBottom: 8 }}>
                  <i className="fa-solid fa-mobile-screen" /> جوال ({data.siteSettings?.reportGalleryColsMobile ?? 2} / صف)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[1, 2, 3, 4].map(n => (
                    <button
                      key={`rg-m-${n}`}
                      type="button"
                      onClick={() => onSave({
                        siteSettings: { ...data.siteSettings, reportGalleryColsMobile: n },
                      })}
                      style={{
                        flex: '1 0 calc(25% - 5px)', minWidth: 36, padding: '7px 0', borderRadius: 8,
                        border: `2px solid ${(data.siteSettings?.reportGalleryColsMobile ?? 2) === n ? '#7ee87e' : 'rgba(255,255,255,0.15)'}`,
                        background: (data.siteSettings?.reportGalleryColsMobile ?? 2) === n ? 'rgba(100,220,100,0.2)' : 'rgba(0,0,0,0.25)',
                        color: (data.siteSettings?.reportGalleryColsMobile ?? 2) === n ? '#7ee87e' : 'rgba(255,255,255,0.65)',
                        fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#7ee87e', display: 'block', marginBottom: 8 }}>
                  <i className="fa-solid fa-desktop" /> ويب ({data.siteSettings?.reportGalleryColsDesktop ?? 3} / صف)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[1, 2, 3, 4, 5, 6].map(n => (
                    <button
                      key={`rg-d-${n}`}
                      type="button"
                      onClick={() => onSave({
                        siteSettings: { ...data.siteSettings, reportGalleryColsDesktop: n },
                      })}
                      style={{
                        flex: '1 0 calc(16% - 5px)', minWidth: 36, padding: '7px 0', borderRadius: 8,
                        border: `2px solid ${(data.siteSettings?.reportGalleryColsDesktop ?? 3) === n ? '#7ee87e' : 'rgba(255,255,255,0.15)'}`,
                        background: (data.siteSettings?.reportGalleryColsDesktop ?? 3) === n ? 'rgba(100,220,100,0.2)' : 'rgba(0,0,0,0.25)',
                        color: (data.siteSettings?.reportGalleryColsDesktop ?? 3) === n ? '#7ee87e' : 'rgba(255,255,255,0.65)',
                        fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >{n}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* colors row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            {([
              ['themeColor',   'لون التقرير الأساسي',    'fa-palette'],
              ['engNameColor', 'لون اسم المهندس',         'fa-font'],
              ['pageBgColor',  'لون خلفية الصفحة',        'fa-fill-drip'],
            ] as const).map(([key, label, icon]) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(100,220,100,0.25)', borderRadius: 10, padding: '10px 12px' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#7ee87e' }}><i className={`fa-solid ${icon}`} /> {label}</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="color" value={tpl[key]} onChange={e => saveTpl({ [key]: e.target.value } as Partial<ReportTemplate>)} style={{ width: 40, height: 30, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, cursor: 'pointer', background: 'transparent', padding: 2, flexShrink: 0 }} />
                  <input value={tpl[key]} onChange={e => saveTpl({ [key]: e.target.value } as Partial<ReportTemplate>)} style={{ flex: 1, padding: '5px 8px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, direction: 'ltr', fontSize: 11, fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', color: '#e8f5e8', minWidth: 0 }} />
                </div>
              </div>
            ))}
          </div>

          {/* engineer name */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(100,220,100,0.25)', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#7ee87e', display: 'block', marginBottom: 8 }}><i className="fa-solid fa-user-tie" /> اسم المهندس في التقرير ({lang.toUpperCase()})</label>
            <input value={tpl.engName[lang]} onChange={e => saveTpl({ engName: { ...tpl.engName, [lang]: e.target.value } })}
              style={{ width: '100%', padding: '7px 10px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', color: '#e8f5e8', direction: lang === 'ar' ? 'rtl' : 'ltr' }} />
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>استخدم أزرار اللغة بالأعلى لتعبئة الاسم بكل اللغات</div>
          </div>

          {/* stamp alignment */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(100,220,100,0.25)', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#7ee87e', display: 'block', marginBottom: 8 }}><i className="fa-solid fa-stamp" /> موضع التوقيع والختم</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([['right','يمين','fa-align-right'],['center','وسط','fa-align-center'],['left','يسار','fa-align-left']] as const).map(([val, lbl, ic]) => (
                <button key={val} onClick={() => saveTpl({ stampAlign: val })}
                  style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: `2px solid ${tpl.stampAlign === val ? '#7ee87e' : 'rgba(255,255,255,0.15)'}`, background: tpl.stampAlign === val ? 'rgba(100,220,100,0.15)' : 'rgba(0,0,0,0.2)', color: tpl.stampAlign === val ? '#7ee87e' : 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: tpl.stampAlign === val ? 700 : 400, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <i className={`fa-solid ${ic}`} /> {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* margins */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(100,220,100,0.25)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#7ee87e', marginBottom: 12 }}>
              <i className="fa-solid fa-border-all" /> هوامش الصفحة (بالملليمتر)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {([
                ['marginTop',    'أعلى',  10, 50] as const,
                ['marginBottom', 'أسفل',  10, 50] as const,
                ['marginRight',  'يمين',   5, 40] as const,
                ['marginLeft',   'يسار',   5, 40] as const,
              ]).map(([key, label, min, max]) => (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{label}</label>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#7ee87e', direction: 'ltr' }}>{tpl[key]} mm</span>
                  </div>
                  <input type="range" min={min} max={max} value={tpl[key]}
                    onChange={e => saveTpl({ [key]: parseInt(e.target.value) } as Partial<ReportTemplate>)}
                    style={{ width: '100%', accentColor: '#2a7a2a', cursor: 'pointer' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.3)', direction: 'ltr' }}>
                    <span>{min}</span><span>{max}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* image uploads */}
          <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginBottom: 10, lineHeight: 1.6 }}>
            <i className="fa-solid fa-circle-info" style={{ marginInlineEnd: 6 }} />
            ارفع الصورة من جهازك أو الصق رابط Google Drive مباشر — يُحفظ الرابط على السيرفر عند تسجيل الدخول.
            {tplImgMsg && <span style={{ display: 'block', marginTop: 6, color: '#7ee87e', fontWeight: 700 }}>{tplImgMsg}</span>}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, marginBottom: 14 }}>
            {([
              ['headerLogo', 'شعار رأس التقرير', 'fa-image'],
              ['engSignature', 'توقيع المهندس', 'fa-signature'],
              ['engStamp', 'ختم المهندس', 'fa-stamp'],
              ['paidStamp', 'ختم الدفع (مدفوع)', 'fa-circle-check'],
            ] as const).map(([key, label, icon]) => {
              const src = tpl[key] ? resolveImageSrc(tpl[key]) : '';
              const uploading = !!tplImgUploading[key];
              return (
              <div key={key} style={{ border: '1px solid rgba(100,220,100,0.2)', borderRadius: 10, padding: 12, textAlign: 'center', background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#7ee87e', marginBottom: 8 }}><i className={`fa-solid ${icon}`} /> {label}</div>
                <div onClick={() => !uploading && tplRefs.current[key]?.click()} style={{ cursor: uploading ? 'wait' : 'pointer', minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255,255,255,0.2)', borderRadius: 8, background: 'rgba(0,0,0,0.2)', marginBottom: 8 }}>
                  {uploading
                    ? <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}><i className="fa-solid fa-spinner fa-spin" /> جاري الرفع…</span>
                    : src
                      ? <img src={src} alt="" style={{ maxWidth: '100%', maxHeight: 90, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.opacity = '0.35'; }} />
                      : <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}><i className="fa-solid fa-upload" /> رفع صورة</span>}
                </div>
                <input
                  type="url"
                  value={tplUrlDraft[key] ?? tpl[key] ?? ''}
                  placeholder="رابط Google Drive أو رابط مباشر"
                  dir="ltr"
                  style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#e8f5e8', fontSize: 11 }}
                  onChange={e => setTplUrlDraft(prev => ({ ...prev, [key]: e.target.value }))}
                  onBlur={() => applyTplImgUrl(key)}
                  onKeyDown={e => { if (e.key === 'Enter') applyTplImgUrl(key); }}
                />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-outline-sm" disabled={uploading} onClick={() => tplRefs.current[key]?.click()}><i className="fa-solid fa-image" /> رفع</button>
                  <button type="button" className="btn-outline-sm" disabled={uploading || !(tplUrlDraft[key] ?? tpl[key])?.trim()} onClick={() => applyTplImgUrl(key)}><i className="fa-solid fa-link" /> حفظ الرابط</button>
                  {tpl[key] && <button type="button" className="btn-danger-sm" onClick={() => { saveTpl({ [key]: '' }); setTplUrlDraft(prev => ({ ...prev, [key]: '' })); }}><i className="fa-solid fa-trash-can" /></button>}
                </div>
                <input ref={el => { tplRefs.current[key] = el; }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { void uploadTplImg(key, e.target.files); e.target.value = ''; }} />
              </div>
            );})}
          </div>

          {/* header & footer text (per selected language) */}
          <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#7ee87e', display: 'block', marginBottom: 4 }}>نص رأس التقرير ({lang.toUpperCase()})</label>
              <input value={tpl.headerText[lang]} onChange={e => saveTpl({ headerText: { ...tpl.headerText, [lang]: e.target.value } })} style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', color: '#e8f5e8' }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#7ee87e', display: 'block', marginBottom: 4 }}>نص تذييل التقرير ({lang.toUpperCase()})</label>
              <input value={tpl.footerText[lang]} onChange={e => saveTpl({ footerText: { ...tpl.footerText, [lang]: e.target.value } })} style={{ width: '100%', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', color: '#e8f5e8' }} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}><i className="fa-solid fa-language" /> استخدم أزرار اللغة بالأعلى لتعبئة النصوص بكل اللغات (عربي / إنجليزي / ألماني).</p>

          {/* ── Live letterhead preview ── */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(100,220,100,0.25)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#7ee87e', marginBottom: 12 }}>
              <i className="fa-solid fa-eye" /> معاينة الترويسة — كيف سيبدو التقرير
            </div>
            {/* A4 mini preview — 794px natural width scaled down to fit */}
            <div style={{ overflowX: 'auto', direction: 'ltr' }}>
              <div style={{
                width: 794,
                transformOrigin: '0 0',
                transform: 'scale(0.45)',
                marginBottom: Math.round(1123 * (0.45 - 1)),
                background: tpl.pageBgColor || '#fff',
                fontFamily: 'Tajawal, Arial, sans-serif',
                color: '#222',
                position: 'relative',
              }}>
                {/* page content with margins */}
                <div style={{
                  paddingTop:    tpl.marginTop    * 3.779,
                  paddingRight:  tpl.marginRight  * 3.779,
                  paddingBottom: tpl.marginBottom * 3.779,
                  paddingLeft:   tpl.marginLeft   * 3.779,
                  minHeight: 1123,
                  display: 'flex', flexDirection: 'column',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `3px solid ${tpl.themeColor}`, paddingBottom: 14, marginBottom: 18, gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {tpl.headerLogo
                        ? <img src={resolveImageSrc(tpl.headerLogo)} alt="" style={{ height: 58, objectFit: 'contain' }} />
                        : <div style={{ width: 58, height: 58, borderRadius: 8, background: tpl.themeColor, opacity: 0.15, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: tpl.themeColor }}>
                            <i className="fa-solid fa-seedling" style={{ color: tpl.themeColor, opacity: 1 }} />
                          </div>
                      }
                      <div>
                        <div style={{ fontWeight: 800, color: tpl.engNameColor || '#003366', fontSize: 14 }}>{tpl.engName[lang] || 'م.علاء أحمد المصري'}</div>
                        {tpl.headerText[lang] && <div style={{ fontWeight: 600, color: tpl.themeColor, fontSize: 12, marginTop: 2 }}>{tpl.headerText[lang]}</div>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 900, color: tpl.themeColor, fontSize: 17 }}>تقرير التشخيص الزراعي</div>
                      <div style={{ fontSize: 12, color: '#3d4f63', marginTop: 4 }}>التاريخ: {new Date().toLocaleDateString('en-GB')}</div>
                    </div>
                  </div>

                  {/* Content placeholder lines */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 20 }}>
                    {[80,60,90,45,75,55,85,40,70,65,50,80,60].map((w, i) => (
                      <div key={i} style={{ height: i % 4 === 0 ? 18 : 12, background: i % 4 === 0 ? tpl.themeColor + '22' : '#f0f0f0', borderRadius: 4, width: `${w}%`, borderInlineStart: i % 4 === 0 ? `4px solid ${tpl.themeColor}` : 'none' }} />
                    ))}
                  </div>

                  {/* Footer */}
                  <div style={{ borderTop: `2px solid ${tpl.themeColor}`, paddingTop: 16, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18 }}>
                    <div style={{ fontSize: 11, color: '#334455', maxWidth: '46%', lineHeight: 1.7 }}>
                      {tpl.footerText[lang] || <span style={{ color: '#bbb', fontStyle: 'italic' }}>نص التذييل…</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
                      <div style={{ textAlign: 'center', minWidth: 120 }}>
                        {tpl.engSignature
                          ? <img src={resolveImageSrc(tpl.engSignature)} alt="" style={{ maxHeight: 56, maxWidth: 130, objectFit: 'contain' }} />
                          : <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ width: 110, borderBottom: `1px dashed ${tpl.themeColor}` }} />
                            </div>}
                        <div style={{ borderTop: '1px solid #999', marginTop: 4, paddingTop: 5, fontSize: 11, fontWeight: 700, color: '#444' }}>توقيع المهندس</div>
                      </div>
                      {tpl.engStamp && (
                        <div>
                          <img src={resolveImageSrc(tpl.engStamp)} alt="" style={{ maxHeight: 72, maxWidth: 110, objectFit: 'contain' }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* margin guides overlay */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
                  borderTop:    `${tpl.marginTop    * 3.779}px solid rgba(100,200,100,0.08)`,
                  borderRight:  `${tpl.marginRight  * 3.779}px solid rgba(100,200,100,0.08)`,
                  borderBottom: `${tpl.marginBottom * 3.779}px solid rgba(100,200,100,0.08)`,
                  borderLeft:   `${tpl.marginLeft   * 3.779}px solid rgba(100,200,100,0.08)`,
                }} />
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
              <i className="fa-solid fa-circle-info" /> المعاينة تقريبية — الأبعاد الحقيقية تظهر عند توليد PDF على السيرفر
            </p>
          </div>
        </div>
      )}

      {tab === 'reports' && <CustomerReportsAdmin data={data} onSave={onSave} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   GFX ADMIN (3-TIER)
══════════════════════════════════════════════════════ */
function mergeGfxProjectForSave(stored: GfxProjectItem, draft: GfxProjectItem): GfxProjectItem {
  const mergedView = prepareGlbViewSettingsForStorage(
    mergeGfxModel3dViewSettings(stored.glbViewSettings, draft.glbViewSettings),
  );
  return {
    ...stored,
    ...draft,
    ...(mergedView ? { glbViewSettings: mergedView } : {}),
  };
}

function GfxAdmin({ data, onSave }: { data: AppData; onSave: (u: Partial<AppData>) => void }) {
  const [lang, setLang] = useState<LangKey>('ar');
  const [cats, setCats] = useState<GfxCategory[]>(data.gfxCategories || []);
  const [watermarkImg, setWatermarkImg] = useState(data.watermarkImg || '');
  const [watermarkOpacity, setWatermarkOpacity] = useState(data.watermarkOpacity ?? 0.15);
  const [selCatId, setSelCatId] = useState(cats[0]?.id || '');
  const [selSubId, setSelSubId] = useState(cats[0]?.subCategories[0]?.id || '');
  const [tab, setTab] = useState('categories');
  const [editItem, setEditItem] = useState<GfxProjectItem | null>(null);
  const editItemRef = useRef<GfxProjectItem | null>(null);
  editItemRef.current = editItem;
  const [selectedProjIds, setSelectedProjIds] = useState<Set<string>>(new Set());
  const [fillMsg, setFillMsg] = useState('');
  const wmRef = useRef<HTMLInputElement>(null);
  const [gfxGrid, setGfxGrid] = useState<GfxGridSettings>({ ...DEFAULT_GFX_GRID, ...(data.gfxGridSettings || {}) });
  const saveGfxGrid = (g: GfxGridSettings) => { setGfxGrid(g); onSave({ gfxGridSettings: g }); };
  useEffect(() => {
    setGfxGrid({ ...DEFAULT_GFX_GRID, ...(data.gfxGridSettings || {}) });
  }, [data.gfxGridSettings]);

  useEffect(() => {
    setSelectedProjIds(new Set());
  }, [selCatId, selSubId]);

  const gfxGridVars = (g: GfxGridSettings) => gfxGridStyle(g);

  const selCat = cats.find(c => c.id === selCatId);
  const selSub = selCat?.subCategories.find(s => s.id === selSubId);

  const openGfxProject = (id: string) => {
    for (const c of cats) {
      for (const s of c.subCategories) {
        const fresh = s.items.find(i => i.id === id);
        if (fresh) {
          setEditItem({ ...fresh });
          return;
        }
      }
    }
  };

  const commitCats = (next: GfxCategory[]) => { setCats(next); onSave({ gfxCategories: next }); };
  const commitWm = (img: string, op: number) => { onSave({ watermarkImg: img, watermarkOpacity: op }); };

  const showFillMsg = (msg: string) => {
    setFillMsg(msg);
    window.setTimeout(() => setFillMsg(''), 3500);
  };

  const mutCat = (catId: string, fn: (c: GfxCategory) => GfxCategory) => {
    setCats(prev => {
      const next = prev.map(c => c.id === catId ? fn(c) : c);
      onSave({ gfxCategories: next });
      return next;
    });
  };
  const mutSub = (catId: string, subId: string, fn: (s: GfxSubCategory) => GfxSubCategory) => mutCat(catId, c => ({ ...c, subCategories: c.subCategories.map(s => s.id === subId ? fn(s) : s) }));

  const persistGfxItem = (item: GfxProjectItem) => {
    mutSub(selCatId, selSubId, sub => ({
      ...sub,
      items: sub.items.map(it => (it.id === item.id ? mergeGfxProjectForSave(it, item) : it)),
    }));
  };

  /** حفظ صارم للمنظور — فوري في القائمة + قاعدة البيانات دون انتظار زر الحفظ */
  const persistPoseStrict = (itemId: string, viewSettings: GfxModel3dSettings) => {
    setCats(prev => {
      const next = prev.map(c => c.id !== selCatId ? c : ({
        ...c,
        subCategories: c.subCategories.map(s => s.id !== selSubId ? s : ({
          ...s,
          items: s.items.map(it => it.id !== itemId ? it : { ...it, glbViewSettings: viewSettings }),
        })),
      }));
      onSave({ gfxCategories: next });
      return next;
    });
    setEditItem(it => (it?.id === itemId ? { ...it, glbViewSettings: viewSettings } : it));
  };

  const toggleProjSel = (id: string) => {
    setSelectedProjIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const deleteSelectedProjects = () => {
    if (!selCatId || !selSubId || selectedProjIds.size === 0) return;
    if (!confirm(`حذف ${selectedProjIds.size} مشروع محدد؟`)) return;
    const ids = selectedProjIds;
    mutSub(selCatId, selSubId, s => ({ ...s, items: s.items.filter(it => !ids.has(it.id)) }));
    if (editItem && ids.has(editItem.id)) setEditItem(null);
    setSelectedProjIds(new Set());
  };

  const fillSubProjects = (count: number, mode: 'add' | 'target') => {
    if (!selCatId || !selSubId) return;
    const beforeN = cats.find(c => c.id === selCatId)?.subCategories.find(s => s.id === selSubId)?.items.length ?? 0;
    mutCat(selCatId, cat => ({
      ...cat,
      subCategories: cat.subCategories.map(s => s.id !== selSubId ? s : {
        ...s,
        items: mode === 'add'
          ? addGfxSeedProjects(cat, s, count)
          : fillGfxSubToCount(cat, s, count),
      }),
    }));
    const added = mode === 'add' ? count : Math.max(0, count - beforeN);
    showFillMsg(added > 0 ? `تم إضافة ${added} مشروع — يمكنك التعديل أو الحذف` : 'لا مشاريع جديدة (العدد مكتمل)');
  };

  const fillAllSubs = (count: number, mode: 'add' | 'target') => {
    if (!selCatId) return;
    const before = cats.find(c => c.id === selCatId);
    if (!before?.subCategories.length) return;
    mutCat(selCatId, c => fillGfxCategorySubs(c, count, mode));
    const subs = before.subCategories.length;
    showFillMsg(
      mode === 'add'
        ? `تم إضافة ${count} مشروع لكل فرع (${subs} فروع) — المجموع +${count * subs}`
        : `تم إكمال الفروع إلى ${count} مشاريع لكل فرع`,
    );
  };

  const newProject = (): GfxProjectItem => ({ id: uid(), title: ml('', '', ''), desc: ml('', '', ''), mainImg: '', images: [], videoUrl: '', usedSkillsIds: [], cvSettings: { isFeatured: false, imgSize: 100, showDesc: true, showTools: true } });

  return (
    <div>
      <h4 style={{ margin: '0 0 14px' }}><i className="fa-solid fa-bezier-curve" style={{ color: '#003366' }} /> معرض التصاميم</h4>
      <div className="admin-light-panel" style={{ marginBottom: 14, padding: '10px 14px', background: '#f0f4fa', borderRadius: 10, border: '1px solid #c0d4f0', fontSize: 12, color: '#223344' }}>
        <i className="fa-solid fa-circle-info" style={{ color: '#003366', marginInlineEnd: 6 }} />
        ظهور أزرار السيرة الذاتية يُدار من <strong>محرر السيرة الذاتية</strong>.
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <TabBar tabs={[['categories','🗂 التصنيفات'],['grid','⚙️ إعدادات العرض'],['pending','⏳ ترجمات معلقة'],['watermark','🔒 العلامة المائية']]} active={tab} color="#003366" onChange={setTab} />
        <div style={{ display: 'flex', gap: 4 }}>
          {LANGS.map(l => <button key={l.code} onClick={() => setLang(l.code)} style={{ padding: '4px 8px', borderRadius: 12, border: `1px solid ${lang === l.code ? '#003366' : '#ccc'}`, background: lang === l.code ? '#003366' : '#fff', color: lang === l.code ? '#fff' : '#555', fontSize: 11, cursor: 'pointer' }}>{l.flag}</button>)}
        </div>
      </div>

      {tab === 'categories' && (
        <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#c8daf0' }}>كل الفروع في التصنيف الحالي:</span>
          {[1, 5, 10].map(n => (
            <button key={`all-add-${n}`} type="button" className="btn-outline-sm" style={{ fontSize: 10 }}
              disabled={!selCat || !selCat.subCategories.length}
              onClick={() => fillAllSubs(n, 'add')}>
              +{n} لكل فرع
            </button>
          ))}
          <button type="button" className="btn-outline-sm" style={{ fontSize: 10 }}
            disabled={!selCat || !selCat.subCategories.length}
            onClick={() => {
              if (!confirm('إكمال كل الفروع في هذا التصنيف إلى 10 مشاريع؟')) return;
              fillAllSubs(10, 'target');
            }}>
            <i className="fa-solid fa-layer-group" /> إكمال 10 لكل فرع
          </button>
          <button type="button" className="btn-outline-sm" style={{ fontSize: 10 }}
            onClick={() => {
              if (!confirm('إكمال 10 مشاريع لكل فرع في (لاندسكيب، ديكور، مطبوعات، شاشات)؟')) return;
              setCats(prev => {
                const next = ensureGfxSeedProjects(prev);
                onSave({ gfxCategories: next });
                showFillMsg('تم إكمال المشاريع في التصنيفات الرئيسية');
                return next;
              });
            }}>
            <i className="fa-solid fa-globe" /> 10 لكل التصنيفات الأربعة
          </button>
          <MlBulkTranslateButton
            context="design gallery categories and projects"
            htmlKeys={cats.flatMap(c => c.subCategories.flatMap(s => s.items.filter(i => i.desc.ar?.trim()).map(i => `d_${i.id}`)))}
            fields={collectGfxMlFields(cats)}
            label="ترجمة شاملة — كل التصنيفات والمشاريع"
            onComplete={tr => commitCats(applyGfxBulkTranslations(cats, tr))}
          />
        </div>
        {fillMsg && (
          <div style={{ marginBottom: 10, padding: '8px 12px', background: '#e8f5e9', border: '1px solid #81c784', borderRadius: 8, fontSize: 11, color: '#1b5e20', fontWeight: 600 }}>
            <i className="fa-solid fa-circle-check" style={{ marginInlineEnd: 6 }} />{fillMsg}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,170px) minmax(0,170px) minmax(0,1fr)', gap: 10 }}>
          {/* LEVEL 1 */}
          <div className="admin-light-panel" style={{ background: '#f0f4ff', borderRadius: 10, padding: 8, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#003366', marginBottom: 6, padding: '0 0 6px', borderBottom: '1px solid #cde' }}>تصنيفات</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {cats.map((c, ci) => (
                <div key={c.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <ReorderBtns index={ci} total={cats.length} onMove={dir => commitCats(moveItem(cats, ci, dir))} />
                  <button type="button" onClick={() => { setSelCatId(c.id); setSelSubId(c.subCategories[0]?.id || ''); setEditItem(null); }}
                    title={formatCatLabel(c.name)}
                    style={catListBtnStyle(selCatId === c.id, '#003366')}>
                    <i className={`fa-solid ${c.icon || 'fa-folder'}`} style={{ marginInlineEnd: 4 }} />{shortCatLabel(c.name)}
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-outline-sm" style={{ width: '100%', fontSize: 11 }}
              onClick={() => { const nc: GfxCategory = { id: uid(), name: ml('', '', ''), icon: 'fa-folder', subCategories: [] }; commitCats([...cats, nc]); setSelCatId(nc.id); }}>
              <i className="fa-solid fa-plus" /> إضافة
            </button>
            {selCat && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#003366' }}>اسم التصنيف — AR · EN · DE</div>
                <MlNameInputs stacked value={selCat.name} onChange={name => mutCat(selCatId, c => ({ ...c, name }))} />
                <input type="text" value={selCat.icon} placeholder="fa-icon" style={{ direction: 'ltr', padding: '4px 8px', borderRadius: 6, border: '1px solid #cde', fontSize: 11, width: '100%' }}
                  onChange={e => mutCat(selCatId, c => ({ ...c, icon: e.target.value }))} />
                <button className="btn-danger-sm" style={{ fontSize: 11 }}
                  onClick={() => { if (!confirm('حذف التصنيف؟')) return; const next = cats.filter(c => c.id !== selCatId); commitCats(next); setSelCatId(next[0]?.id || ''); }}>
                  <i className="fa-solid fa-trash-can" /> حذف
                </button>
              </div>
            )}
          </div>

          {/* LEVEL 2 */}
          <div className="admin-light-panel" style={{ background: '#f5f0ff', borderRadius: 10, padding: 8, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#6a0dad', marginBottom: 6, padding: '0 0 6px', borderBottom: '1px solid #dce' }}>فرعية</div>
            {selCat ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {selCat.subCategories.map((s, si) => (
                    <div key={s.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <ReorderBtns index={si} total={selCat.subCategories.length}
                        onMove={dir => mutCat(selCatId, c => ({ ...c, subCategories: moveItem(c.subCategories, si, dir) }))} />
                      <button type="button" onClick={() => { setSelSubId(s.id); setEditItem(null); }}
                        title={formatCatLabel(s.name)}
                        style={catListBtnStyle(selSubId === s.id, '#6a0dad')}>
                        {shortCatLabel(s.name)} ({s.items.length})
                      </button>
                    </div>
                  ))}
                </div>
                <button className="btn-outline-sm" style={{ width: '100%', fontSize: 11 }}
                  onClick={() => { const ns: GfxSubCategory = { id: uid(), name: ml('', '', ''), items: [] }; mutCat(selCatId, c => ({ ...c, subCategories: [...c.subCategories, ns] })); setSelSubId(ns.id); }}>
                  <i className="fa-solid fa-plus" /> إضافة
                </button>
                {selSub && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#6a0dad' }}>اسم الفرعي — AR · EN · DE</div>
                    <MlNameInputs stacked value={selSub.name} onChange={name => mutSub(selCatId, selSubId, s => ({ ...s, name }))} />
                    {selSub && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 9.5, color: '#6a0dad', fontWeight: 700 }}>ملء مشاريع هذا الفرع:</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          <button type="button" className="btn-outline-sm" style={{ fontSize: 10, flex: 1 }} onClick={() => fillSubProjects(1, 'add')}>+1</button>
                          <button type="button" className="btn-outline-sm" style={{ fontSize: 10, flex: 1 }} onClick={() => fillSubProjects(5, 'add')}>+5</button>
                          <button type="button" className="btn-outline-sm" style={{ fontSize: 10, flex: 1 }} onClick={() => fillSubProjects(10, 'target')}>10</button>
                        </div>
                      </div>
                    )}
                    <button className="btn-danger-sm" style={{ fontSize: 11 }}
                      onClick={() => { if (!confirm('حذف؟')) return; mutCat(selCatId, c => ({ ...c, subCategories: c.subCategories.filter(s => s.id !== selSubId) })); setSelSubId(''); }}>
                      <i className="fa-solid fa-trash-can" /> حذف
                    </button>
                  </div>
                )}
              </>
            ) : <p style={{ fontSize: 11, color: '#3d4f63' }}>اختر تصنيفاً</p>}
          </div>

          {/* LEVEL 3 */}
          <div className="admin-light-panel" style={{ background: '#fffaf0', borderRadius: 10, padding: 8, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#b8860b', marginBottom: 6, padding: '0 0 6px', borderBottom: '1px solid #ede', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {selSub && selSub.items.length > 0 && !editItem && (
                  <input
                    type="checkbox"
                    checked={selSub.items.length > 0 && selSub.items.every(it => selectedProjIds.has(it.id))}
                    onChange={e => {
                      if (e.target.checked) setSelectedProjIds(new Set(selSub.items.map(it => it.id)));
                      else setSelectedProjIds(new Set());
                    }}
                    title="تحديد الكل"
                    style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#b8860b' }}
                  />
                )}
                مشاريع
                {selectedProjIds.size > 0 && <span style={{ fontSize: 9, color: '#996600' }}>({selectedProjIds.size})</span>}
              </span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                {selSub && selectedProjIds.size > 0 && !editItem && (
                  <button type="button" className="btn-danger-sm" style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={deleteSelectedProjects}>
                    <i className="fa-solid fa-trash-can" /> حذف المحدد
                  </button>
                )}
                {selSub && (
                  <>
                    <button type="button" className="btn-outline-sm" style={{ fontSize: 10, padding: '2px 6px' }} title="إضافة مشروع واحد باسم جاهز" onClick={() => fillSubProjects(1, 'add')}>+1</button>
                    <button type="button" className="btn-outline-sm" style={{ fontSize: 10, padding: '2px 6px' }} title="إضافة 5 مشاريع" onClick={() => fillSubProjects(5, 'add')}>+5</button>
                    <button type="button" className="btn-outline-sm" style={{ fontSize: 10, padding: '2px 6px' }} title="إكمال إلى 10 مشاريع" onClick={() => fillSubProjects(10, 'target')}>10</button>
                  </>
                )}
                {selSub && <button className="btn-outline-sm" style={{ fontSize: 11 }} onClick={() => { const np = newProject(); mutSub(selCatId, selSubId, s => ({ ...s, items: [...s.items, np] })); setEditItem(np); }}><i className="fa-solid fa-plus" /></button>}
              </div>
            </div>
            {selSub ? (
              editItem ? (
                <div style={{ overflowY: 'auto', maxHeight: '60vh' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <strong style={{ fontSize: 12, color: '#003366' }}>✏️ تعديل مشروع</strong>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <MlFieldsTranslateButton small htmlKeys={['desc']} context="design portfolio project"
                        fields={{ title: editItem.title, desc: editItem.desc }}
                        onFieldTranslated={(key, tr) => {
                          if (key === 'title') setEditItem(it => it ? { ...it, title: mergeMlTranslation(it.title, tr) } : it);
                          else if (key === 'desc') setEditItem(it => it ? { ...it, desc: mergeMlTranslation(it.desc, tr) } : it);
                        }}
                      />
                      <button className="btn-cancel btn-sm" style={{ fontSize: 11 }} onClick={() => setEditItem(null)}>✕</button>
                    </div>
                  </div>

                  <GfxAiSuggestPanel
                    project={editItem}
                    category={selCat}
                    subCategory={selSub}
                    skills={data.skills || []}
                    onSuggested={patch => setEditItem(it => it ? { ...it, ...patch } : it)}
                  />

                  {/* ── Language inputs side-by-side ── */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>العنوان — بالثلاث لغات</label>
                    {LANGS.map(l => (
                      <div key={l.code} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                        <span style={{ fontSize: 16, flexShrink: 0, width: 24, textAlign: 'center' }}>{l.flag}</span>
                        <input type="text" value={editItem.title[l.code] || ''} placeholder={`${l.label}...`}
                          style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: `1px solid ${editItem.title[l.code] ? '#a0c0e0' : '#dde'}`, fontSize: 11, direction: l.code === 'ar' ? 'rtl' : 'ltr', background: editItem.title[l.code] ? '#f0f6ff' : '#fff', color: '#003366' }}
                          onChange={e => setEditItem({ ...editItem, title: { ...editItem.title, [l.code]: e.target.value } })} />
                        {editItem.title[l.code] ? <i className="fa-solid fa-circle-check" style={{ color: '#4caf50', fontSize: 11, flexShrink: 0 }} /> : <i className="fa-solid fa-circle-exclamation" style={{ color: '#e0a040', fontSize: 11, flexShrink: 0 }} />}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>الوصف — بالثلاث لغات</label>
                    {LANGS.map(l => (
                      <div key={l.code} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                          <span style={{ fontSize: 14 }}>{l.flag}</span>
                          <span style={{ fontSize: 10, color: '#3d4f63' }}>{l.label}</span>
                          {editItem.desc[l.code] ? <i className="fa-solid fa-circle-check" style={{ color: '#4caf50', fontSize: 10 }} /> : <i className="fa-solid fa-circle-exclamation" style={{ color: '#e0a040', fontSize: 10 }} />}
                        </div>
                        <textarea rows={2} value={editItem.desc[l.code] || ''} placeholder={`${l.label}...`}
                          style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: `1px solid ${editItem.desc[l.code] ? '#a0c0e0' : '#dde'}`, fontSize: 11, direction: l.code === 'ar' ? 'rtl' : 'ltr', resize: 'vertical', background: editItem.desc[l.code] ? '#f0f6ff' : '#fff', color: '#333', fontFamily: 'inherit' }}
                          onChange={e => setEditItem({ ...editItem, desc: { ...editItem.desc, [l.code]: e.target.value } })} />
                      </div>
                    ))}
                  </div>

                  <GfxMediaEditor item={editItem} onChange={setEditItem} />

                  {/* Video URL */}
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#223344' }}>🎬 رابط فيديو YouTube (اختياري)</label>
                    <input type="url" value={editItem.videoUrl} placeholder="YouTube أو Google Drive فيديو /view" style={{ direction: 'ltr', fontSize: 11, color: '#003366', background: '#f8faff' }}
                      onChange={e => setEditItem({ ...editItem, videoUrl: e.target.value })}
                      onBlur={e => { const n = normalizeVideoUrlForStorage(e.target.value); if (n && n !== e.target.value) setEditItem({ ...editItem, videoUrl: n }); }} />
                  </div>

                  <GfxDownloadLinksEditor
                    links={getGfxDownloadLinksForEdit(editItem)}
                    skills={data.skills || []}
                    onChange={links => setEditItem(applyGfxDownloadLinks(editItem, links))}
                  />

                  {/* Software / tools used — moved up; source file section replaced by download links */}
                  <div style={{ marginBottom: 10, background: '#f0f4ff', borderRadius: 10, padding: '10px 12px', border: '1px solid #aac4ee' }}>
                    <div style={{ fontWeight: 700, fontSize: 11, color: '#003366', marginBottom: 8 }}>
                      <i className="fa-solid fa-palette" /> البرامج المستخدمة في التصميم
                    </div>
                    <p style={{ fontSize: 10, color: '#3d4f63', margin: '0 0 8px', lineHeight: 1.5 }}>
                      اختر من أيقونات «إدارة المهارات» — تظهر أسفل التصميم للزائر.
                    </p>
                    <GfxSkillsPicker
                      skills={data.skills || []}
                      selectedIds={editItem.usedSkillsIds}
                      onChange={ids => setEditItem({ ...editItem, usedSkillsIds: ids })}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginTop: 10, cursor: 'pointer', fontWeight: 600, color: editItem.cvSettings.showTools !== false ? '#2a7a2a' : '#999' }}>
                      <input type="checkbox" checked={editItem.cvSettings.showTools !== false}
                        onChange={e => setEditItem({ ...editItem, cvSettings: { ...editItem.cvSettings, showTools: e.target.checked } })} />
                      {editItem.cvSettings.showTools !== false ? '👁️ إظهار البرامج للزوار' : '🚫 مخفي — لا تظهر البرامج للزوار'}
                    </label>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={editItem.cvSettings.isFeatured} onChange={e => setEditItem({ ...editItem, cvSettings: { ...editItem.cvSettings, isFeatured: e.target.checked } })} />
                    ★ مميز في السيرة الذاتية
                  </label>

                  {/* 3D model — الرابط يكفي لإظهار المعاينة؛ يمكن إخفاؤها يدوياً */}
                  {(() => {
                    const modelDriveUrl = (editItem.glbUrl || '').trim();
                    const usable = hasUsableGfxModelUrl(modelDriveUrl);
                    const enabled = editItem.glbViewSettings?.previewEnabled !== false;
                    return (
                      <div style={{ marginBottom: 12, paddingTop: 10, borderTop: '1px dashed #c5d4ea' }}>
                        <div className="form-group" style={{ marginBottom: 8 }}>
                          <label style={{ fontSize: 10, color: '#223344' }}>
                            <i className="fa-solid fa-cube" style={{ marginInlineEnd: 4 }} />
                            رابط Google Drive لملف GLB / FBX / STL (رابط /view فيه معرّف الملف)
                          </label>
                          <input
                            type="url"
                            value={editItem.glbUrl || ''}
                            placeholder="https://drive.google.com/file/d/XXXX/view?usp=sharing"
                            style={{ direction: 'ltr', fontSize: 11, color: '#003366', background: '#fff' }}
                            onChange={e => {
                              const v = e.target.value;
                              const ok = hasUsableGfxModelUrl(v);
                              setEditItem({
                                ...editItem,
                                glbUrl: v,
                                glbViewSettings: mergeGfxModel3dViewSettings(editItem.glbViewSettings, {
                                  ...(ok ? { previewEnabled: true } : {}),
                                }),
                              });
                            }}
                          />
                          <p style={{ fontSize: 9.5, color: '#556677', margin: '4px 0 0' }}>
                            ضع رابط مشاركة ملف المجسم فقط. بمجرّد الرابط الصالح تظهر المعاينة للزائر أسفل صفحة المشروع.
                          </p>
                          {modelDriveUrl && !usable && (
                            <p style={{ fontSize: 10, color: '#c62828', margin: '6px 0 0', fontWeight: 600 }}>
                              الرابط غير مكتمل — الصق رابطاً يحتوي على /file/d/… ثم احفظ.
                            </p>
                          )}
                        </div>

                        {usable && (
                          <>
                            <label style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                              padding: '10px 12px', borderRadius: 10, marginBottom: 10, cursor: 'pointer',
                              background: enabled ? '#e8f0ff' : '#f4f6f8',
                              border: `1px solid ${enabled ? '#9bbcff' : '#dde3ea'}`,
                            }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: enabled ? '#003366' : '#556677' }}>
                                إظهار المعاينة ثلاثية الأبعاد للزوار
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: enabled ? '#1a5fb4' : '#888' }}>
                                  {enabled ? 'ظاهرة' : 'مخفية'}
                                </span>
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  onChange={e => setEditItem({
                                    ...editItem,
                                    glbViewSettings: mergeGfxModel3dViewSettings(editItem.glbViewSettings, {
                                      previewEnabled: e.target.checked,
                                    }),
                                  })}
                                  style={{ width: 18, height: 18, accentColor: '#003366', cursor: 'pointer' }}
                                />
                              </span>
                            </label>

                            <GfxModel3dAdmin
                              url={modelDriveUrl}
                              settings={editItem.glbViewSettings || {}}
                              onChange={s => setEditItem(it => it ? { ...it, glbViewSettings: mergeGfxModel3dViewSettings(it.glbViewSettings, s) } : it)}
                              onPosePersist={stored => {
                                const cur = editItemRef.current;
                                if (!cur || !stored) return;
                                persistPoseStrict(cur.id, stored);
                              }}
                            />
                          </>
                        )}
                      </div>
                    );
                  })()}

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-prime btn-sm" style={{ fontSize: 11 }}
                      onClick={() => {
                        const draft = editItemRef.current;
                        if (!draft) return;
                        persistGfxItem(draft);
                        setEditItem(null);
                      }}>
                      <i className="fa-solid fa-floppy-disk" /> حفظ
                    </button>
                    <button className="btn-danger-sm" style={{ fontSize: 11 }}
                      onClick={() => { if (!confirm('حذف؟')) return; mutSub(selCatId, selSubId, s => ({ ...s, items: s.items.filter(x => x.id !== editItem.id) })); setEditItem(null); }}>
                      <i className="fa-solid fa-trash-can" />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                  {selSub.items.map((item, pi) => {
                    const missingLangs = LANGS.filter(l => !item.title[l.code] || !item.desc[l.code]);
                    return (
                      <div key={item.id} style={{ display: 'flex', gap: 4, alignItems: 'stretch', minWidth: 0 }}>
                      <ReorderBtns index={pi} total={selSub.items.length}
                        onMove={dir => mutSub(selCatId, selSubId, s => ({ ...s, items: moveItem(s.items, pi, dir) }))} />
                      <input
                        type="checkbox"
                        checked={selectedProjIds.has(item.id)}
                        onChange={() => toggleProjSel(item.id)}
                        title="تحديد للحذف"
                        style={{ width: 14, height: 14, flexShrink: 0, cursor: 'pointer', accentColor: '#b8860b', marginTop: 10 }}
                      />
                      <div className="gfx-proj-row" style={{
                        flex: 1, minWidth: 0, display: 'flex', gap: 4, alignItems: 'center',
                        background: '#081d31', border: '1px solid rgba(137,180,225,0.3)', borderRadius: 7, padding: '4px 5px', overflow: 'hidden',
                        color: '#ffffff',
                      }}>
                      <div
                        role="button"
                        tabIndex={0}
                        className="gfx-proj-open-btn"
                        onClick={() => openGfxProject(item.id)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGfxProject(item.id); } }}
                        style={{
                          flex: 1, minWidth: 0, display: 'flex', gap: 6, alignItems: 'center',
                          background: 'transparent', border: 'none', borderRadius: 4, padding: '2px 4px',
                          cursor: 'pointer', textAlign: 'right', color: '#000000',
                          fontFamily: 'inherit',
                        }}
                      >
                        {item.mainImg
                          ? <img src={resolveImageSrc(item.mainImg)} alt="" style={{ width: 40, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                          : <div style={{ width: 40, height: 36, background: '#eee', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#556677' }}><i className="fa-solid fa-image" style={{ fontSize: 12, color: '#556677' }} /></div>}
                        <span className="gfx-proj-title" style={{
                          flex: 1, minWidth: 0, fontSize: 12, fontWeight: 800, lineHeight: 1.35,
                          color: '#ffffff', WebkitTextFillColor: '#ffffff',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{pickML(item.title, lang) || '—'}</span>
                        {missingLangs.length > 0 && <span className="gfx-proj-badge" style={{ fontSize: 9, background: '#ff9800', color: '#fff', WebkitTextFillColor: '#fff', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>⚠ {missingLangs.map(l => l.code.toUpperCase()).join('/')}</span>}
                        {item.cvSettings.isFeatured && <span className="gfx-proj-badge" style={{ fontSize: 9, background: '#003366', color: '#fff', WebkitTextFillColor: '#fff', borderRadius: 4, padding: '1px 4px', flexShrink: 0 }}>★</span>}
                        {getGfxDownloadLinks(item).filter(l => l.visible !== false).length > 0 && (
                          <span className="gfx-proj-badge" style={{ fontSize: 9, background: '#006644', color: '#fff', WebkitTextFillColor: '#fff', borderRadius: 4, padding: '1px 4px', flexShrink: 0 }}>
                            📥 {getGfxDownloadLinks(item).filter(l => l.visible !== false).length}
                          </span>
                        )}
                      </div>
                      <button type="button" title="اقتراح سريع للعنوان والوصف"
                        style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 6, border: '1px solid #90a8d8', background: '#e8eef8', color: '#003366', cursor: 'pointer', fontSize: 11 }}
                        onClick={() => {
                          if (!selCat || !selSub) return;
                          const idx = selSub.items.findIndex(i => i.id === item.id);
                          const seed = createGfxSeedProject(selCat, selSub, idx >= 0 ? idx : 0);
                          const tools = getSuggestedToolsForSub(selSub.id, selSub);
                          const toolIds = (data.skills || []).filter(s => tools.some(t => (s.name || '').toLowerCase().includes(t.toLowerCase().split(' ')[0]))).map(s => s.id);
                          const patch: GfxProjectItem = {
                            ...item,
                            title: seed.title,
                            desc: seed.desc,
                            sourceFileLabel: getSuggestedFileLabelForSub(selSub.id, selSub),
                            usedSkillsIds: toolIds.length ? toolIds : item.usedSkillsIds,
                          };
                          mutSub(selCatId, selSubId, s => ({ ...s, items: s.items.map(it => it.id === item.id ? patch : it) }));
                        }}>
                        <i className="fa-solid fa-wand-magic-sparkles" />
                      </button>
                      </div>
                      </div>
                    );
                  })}
                  {selSub.items.length === 0 && <p style={{ color: '#3d4f63', fontSize: 11 }}>لا مشاريع بعد</p>}
                </div>
              )
            ) : <p style={{ fontSize: 11, color: '#3d4f63' }}>اختر فرعياً</p>}
          </div>
        </div>
        </>
      )}

      {tab === 'grid' && (
        <div className="admin-light-panel" style={{ background: '#f0f4ff', border: '1px solid #aac4ee', borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#003366', marginBottom: 16 }}><i className="fa-solid fa-sliders" /> ضبط شبكة معرض التصاميم</div>

          <div style={{ marginBottom: 18, padding: '12px 14px', background: '#fff', borderRadius: 10, border: '1px solid #cde' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#003366', marginBottom: 4 }}>🖼️ الوضع الافتراضي لمركز التصاميم عند فتح الصفحة</div>
            <div style={{ fontSize: 11, color: '#334455', marginBottom: 8 }}>يمكن للزائر التبديل بين «عرض الكل» و«حسب التصنيف» من زر أعلى الصفحة — هذا الإعداد يحدد ما يظهر أولاً فقط.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([
                ['all', 'عرض الكل — كل التصنيفات والفروع والمشاريع في صفحة واحدة'],
                ['byCategory', 'عرض حسب التصنيف — قائمة منسدلة للتصنيف ثم للفروع'],
              ] as const).map(([mode, label]) => (
                <button key={mode} type="button" onClick={() => saveGfxGrid({ ...gfxGrid, galleryBrowseMode: mode })}
                  style={{
                    flex: '1 1 220px', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, textAlign: 'start',
                    border: `2px solid ${(gfxGrid.galleryBrowseMode ?? 'all') === mode ? '#003366' : '#cde'}`,
                    background: (gfxGrid.galleryBrowseMode ?? 'all') === mode ? '#003366' : '#fff',
                    color: (gfxGrid.galleryBrowseMode ?? 'all') === mode ? '#fff' : '#003366',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Cols Mobile */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>📱 عدد البطاقات في السطر (جوال)</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[1,2,3,4].map(n => (
                  <button key={n} onClick={() => saveGfxGrid({ ...gfxGrid, colsMobile: n })}
                    style={{ flex: '1 0 calc(25% - 4px)', minWidth: 32, padding: '7px 0', borderRadius: 8, border: `2px solid ${gfxGrid.colsMobile === n ? '#003366' : '#cde'}`, background: gfxGrid.colsMobile === n ? '#003366' : '#fff', color: gfxGrid.colsMobile === n ? '#fff' : '#003366', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{n}</button>
                ))}
              </div>
            </div>
            {/* Cols Desktop */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>🖥️ عدد البطاقات في السطر (ويب)</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[1,2,3,4,5,6].map(n => (
                  <button key={n} onClick={() => saveGfxGrid({ ...gfxGrid, colsDesktop: n })}
                    style={{ flex: '1 0 calc(16% - 4px)', minWidth: 32, padding: '7px 0', borderRadius: 8, border: `2px solid ${gfxGrid.colsDesktop === n ? '#003366' : '#cde'}`, background: gfxGrid.colsDesktop === n ? '#003366' : '#fff', color: gfxGrid.colsDesktop === n ? '#fff' : '#003366', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{n}</button>
                ))}
              </div>
            </div>
            {/* Gap */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>↔️ المسافة بين البطاقات: <span style={{ color: '#003366' }}>{gfxGrid.gap}px</span></label>
              <input type="range" min={2} max={40} value={gfxGrid.gap} onChange={e => saveGfxGrid({ ...gfxGrid, gap: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
            </div>
            {/* Padding Mobile */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>📐 هامش الجانبين (جوال): <span style={{ color: '#003366' }}>{gfxGrid.paddingMobile ?? 8}px</span></label>
              <input type="range" min={0} max={32} value={gfxGrid.paddingMobile ?? 8} onChange={e => saveGfxGrid({ ...gfxGrid, paddingMobile: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
            </div>
            {/* Image Height */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>🖼️ ارتفاع صورة التصميم: <span style={{ color: '#003366' }}>{gfxGrid.imgHeight ?? 195}px</span></label>
              <input type="range" min={80} max={400} value={gfxGrid.imgHeight ?? 195} onChange={e => saveGfxGrid({ ...gfxGrid, imgHeight: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
            </div>
            {/* Card Min Width */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>📏 الحد الأدنى لعرض البطاقة: <span style={{ color: '#003366' }}>{gfxGrid.cardMinWidth ?? 200}px</span></label>
              <input type="range" min={100} max={500} value={gfxGrid.cardMinWidth ?? 200} onChange={e => saveGfxGrid({ ...gfxGrid, cardMinWidth: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
            </div>
            <GridFontControls value={{ ...gfxGrid, titleFontSize: gfxGrid.titleFontSize ?? 14, descFontSize: gfxGrid.descFontSize ?? 12, tagFontSize: gfxGrid.tagFontSize ?? 10, autoScaleFont: gfxGrid.autoScaleFont !== false }} onChange={patch => saveGfxGrid({ ...gfxGrid, ...patch })} accent="#003366" />
          </div>

          {/* Dual Preview: Desktop + Mobile — same CSS as live site */}
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12 }}>
            <div style={{ background: '#fff', border: '1px dashed #aac4ee', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#003366', marginBottom: 8 }}><i className="fa-solid fa-desktop" /> معاينة الويب ({gfxGrid.colsDesktop} بطاقات/سطر)</div>
              <div className="gfx-dyn-grid gfx-preview-desktop" style={gfxGridVars(gfxGrid)}>
                {Array.from({ length: Math.min(gfxGrid.colsDesktop, 6) }, (_, i) => (
                  <div key={i} style={{ background: 'linear-gradient(135deg,#e0e8ff,#c8d8f8)', borderRadius: 8, overflow: 'hidden' }}>
                    <div className="card-img" style={{ background: 'linear-gradient(135deg,#c8d8f8,#a0b8e8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎨</div>
                    <div style={{ padding: '4px 6px', fontSize: 9, fontWeight: 700, color: '#003366' }}>تصميم {i + 1}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#fff', border: '1px dashed #aac4ee', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#003366', marginBottom: 8 }}><i className="fa-solid fa-mobile-screen" /> معاينة الجوال ({gfxGrid.colsMobile} بطاقات/سطر)</div>
              <div style={{ maxWidth: 260, margin: '0 auto', border: '2px solid #d4e4ff', borderRadius: 14, padding: 6, background: '#fafcff' }}>
                <div className="gfx-dyn-grid gfx-preview-mobile" style={gfxGridVars(gfxGrid)}>
                  {Array.from({ length: Math.min(gfxGrid.colsMobile * 2, 8) }, (_, i) => (
                    <div key={i} style={{ background: 'linear-gradient(135deg,#e0e8ff,#c8d8f8)', borderRadius: 6, overflow: 'hidden' }}>
                      <div className="card-img" style={{ height: Math.max(36, (gfxGrid.imgHeight ?? 195) * 0.22), background: 'linear-gradient(135deg,#c8d8f8,#a0b8e8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🎨</div>
                      <div style={{ padding: '3px 5px', fontSize: 8, fontWeight: 700, color: '#003366' }}>تصميم {i + 1}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#445566', marginTop: 6, textAlign: 'center' }}>↑ تُطبَّق على الموقع — ويب للشاشات العريضة، جوال لعرض ≤768px</div>
        </div>
      )}

      {tab === 'pending' && (() => {
        const allItems: { item: GfxProjectItem; catName: string; subName: string }[] = [];
        cats.forEach(cat => cat.subCategories.forEach(sub => sub.items.forEach(item => {
          const missing = LANGS.some(l => !item.title[l.code] || !item.desc[l.code]);
          if (missing) allItems.push({ item, catName: pickML(cat.name, lang), subName: pickML(sub.name, lang) });
        })));
        return (
          <div>
            <div style={{ marginBottom: 12, padding: '10px 14px', background: '#fff8e7', borderRadius: 10, border: '1px solid #f5d77a', fontSize: 12, color: '#7a5c00' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginInlineEnd: 6 }} />
              {allItems.length === 0 ? '✅ جميع المشاريع مترجمة بالكامل!' : `${allItems.length} مشروع يحتاج ترجمة ناقصة`}
            </div>
            {allItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allItems.map(({ item, catName, subName }) => {
                  const missingLangs = LANGS.filter(l => !item.title[l.code] || !item.desc[l.code]);
                  return (
                    <div key={item.id} style={{ background: '#fff', border: '1px solid #f0d8a0', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
                      {item.mainImg ? <img src={resolveImageSrc(item.mainImg)} alt="" style={{ width: 52, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} /> : <div style={{ width: 52, height: 44, background: '#eee', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-image" style={{ color: '#556677' }} /></div>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#003366' }}>{pickML(item.title, lang) || '(بدون عنوان)'}</div>
                        <div style={{ fontSize: 10, color: '#3d4f63' }}>{catName} › {subName}</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                          {missingLangs.map(l => (
                            <span key={l.code} style={{ fontSize: 9, background: '#ff9800', color: '#fff', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>
                              {l.flag} {l.code.toUpperCase()} ناقص
                            </span>
                          ))}
                        </div>
                      </div>
                      <button className="btn-outline-sm" style={{ fontSize: 10, flexShrink: 0 }}
                        onClick={() => { setTab('categories'); setEditItem(item); }}>
                        <i className="fa-solid fa-pen" /> تعديل
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {tab === 'watermark' && (
        <div>
          <h4 style={{ margin: '0 0 12px' }}><i className="fa-solid fa-shield-halved" /> العلامة المائية</h4>
          <div className="form-group"><label>رابط صورة العلامة المائية</label>
            <input type="url" value={watermarkImg} style={{ direction: 'ltr' }} placeholder="https://..."
              onChange={e => { setWatermarkImg(e.target.value); commitWm(e.target.value, watermarkOpacity); }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button className="btn-outline-sm" onClick={() => wmRef.current?.click()}><i className="fa-solid fa-upload" /> رفع صورة</button>
              {watermarkImg && <button className="btn-cancel btn-sm" onClick={() => { setWatermarkImg(''); commitWm('', watermarkOpacity); }}><i className="fa-solid fa-trash-can" /></button>}
              <input ref={wmRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { const d = ev.target?.result as string; setWatermarkImg(d); commitWm(d, watermarkOpacity); }; r.readAsDataURL(f); }} />
            </div>
          </div>
          <div className="form-group"><label>مستوى الشفافية: {Math.round(watermarkOpacity * 100)}%</label>
            <input type="range" min={0} max={100} value={Math.round(watermarkOpacity * 100)}
              onChange={e => { const op = Number(e.target.value) / 100; setWatermarkOpacity(op); commitWm(watermarkImg, op); }} />
          </div>
          {watermarkImg && (
            <div style={{ position: 'relative', display: 'inline-block', border: '1px solid #dde', borderRadius: 10, overflow: 'hidden', marginTop: 8 }}>
              <div style={{ width: 200, height: 140, background: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#556677', fontSize: 12 }}>معاينة</div>
              <img src={watermarkImg} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: watermarkOpacity, pointerEvents: 'none' }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   WEB PROJECT ADMIN
══════════════════════════════════════════════════════ */
function WebProjAdmin({ data, onSave }: { data: AppData; onSave: (u: Partial<AppData>) => void }) {
  const [projects, setProjects] = useState<WebProject[]>(data.webProjects || []);
  const [sel, setSel] = useState<number | null>(null);
  const [draft, setDraft] = useState<WebProject | null>(null);
  const [editLang, setEditLang] = useState<LangKey>('ar');
  const [newImg, setNewImg] = useState('');
  const [webGrid, setWebGrid] = useState<WebGridSettings>({ ...DEFAULT_WEB_GRID, ...(data.webGridSettings || {}) });
  const [showWebGrid, setShowWebGrid] = useState(false);

  const commit = (next: WebProject[]) => { setProjects(next); onSave({ webProjects: next }); };
  const saveWebGrid = (g: WebGridSettings) => { setWebGrid(g); onSave({ webGridSettings: g }); };
  useEffect(() => {
    setWebGrid({ ...DEFAULT_WEB_GRID, ...(data.webGridSettings || {}) });
  }, [data.webGridSettings]);

  const webGridVars = (g: WebGridSettings) => webGridStyle(g);
  const emptyProj = (): WebProject => ({
    id: uid(), title: ml(''), desc: ml(''), mainImg: '', images: [],
    videoUrl: '', liveUrl: '', googlePlayUrl: '', appleStoreUrl: '',
    googlePlayVisible: true, appleStoreVisible: true,
    githubUrl: '', githubVisible: true, tags: [], thumbSize: 220, textColor: '', imgBgColor: '',
  });

  const setDraftML = (field: 'title' | 'desc', lang: LangKey, val: string) => {
    if (!draft) return;
    setDraft({ ...draft, [field]: { ...draft[field], [lang]: val } });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <h4 style={{ margin: 0 }}>
          <i className="fa-solid fa-globe" style={{ color: '#003366' }} /> إدارة المشاريع البرمجية
        </h4>
        <MlBulkTranslateButton
          context="web development projects"
          fields={Object.fromEntries(projects.flatMap(p => {
            const rows: [string, string][] = [];
            if (p.title.ar?.trim()) rows.push([`t_${p.id}`, p.title.ar.trim()]);
            if (p.desc.ar?.trim()) rows.push([`d_${p.id}`, p.desc.ar.trim()]);
            return rows;
          }))}
          label="ترجمة شاملة — كل المشاريع"
          onComplete={tr => {
            const next = projects.map(p => ({
              ...p,
              title: tr[`t_${p.id}`] ? mergeMlTranslation(p.title, tr[`t_${p.id}`]) : p.title,
              desc: tr[`d_${p.id}`] ? mergeMlTranslation(p.desc, tr[`d_${p.id}`]) : p.desc,
            }));
            commit(next);
            if (draft && sel !== null && next[sel]) setDraft({ ...next[sel], images: [...next[sel].images] });
          }}
        />
      </div>
      {/* ── WebGrid Settings Panel ── */}
      <div style={{ marginBottom: 14 }}>
        <button onClick={() => setShowWebGrid(s => !s)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: showWebGrid ? '#003366' : '#f0f4ff', color: showWebGrid ? '#fff' : '#003366', border: '1px solid #cde', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: showWebGrid ? 10 : 0 }}>
          <i className="fa-solid fa-table-cells" /> إعدادات شبكة العرض
        </button>
        {showWebGrid && (
          <div className="admin-light-panel" style={{ background: '#f0f4ff', border: '1px solid #aac4ee', borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#003366', marginBottom: 14 }}><i className="fa-solid fa-sliders" /> ضبط شبكة المشاريع البرمجية</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Cols Mobile */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>📱 عدد المشاريع في السطر (جوال)</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[1,2,3,4].map(n => (
                    <button key={n} onClick={() => saveWebGrid({ ...webGrid, colsMobile: n })}
                      style={{ flex: '1 0 calc(25% - 4px)', minWidth: 32, padding: '7px 0', borderRadius: 8, border: `2px solid ${webGrid.colsMobile === n ? '#003366' : '#cde'}`, background: webGrid.colsMobile === n ? '#003366' : '#fff', color: webGrid.colsMobile === n ? '#fff' : '#003366', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{n}</button>
                  ))}
                </div>
              </div>
              {/* Cols Desktop */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>🖥️ عدد المشاريع في السطر (ويب)</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6].map(n => (
                    <button key={n} onClick={() => saveWebGrid({ ...webGrid, colsDesktop: n })}
                      style={{ flex: '1 0 calc(16% - 4px)', minWidth: 32, padding: '7px 0', borderRadius: 8, border: `2px solid ${webGrid.colsDesktop === n ? '#003366' : '#cde'}`, background: webGrid.colsDesktop === n ? '#003366' : '#fff', color: webGrid.colsDesktop === n ? '#fff' : '#003366', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{n}</button>
                  ))}
                </div>
              </div>
              {/* Gap */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>↔️ المسافة بين البطاقات: <span style={{ color: '#003366' }}>{webGrid.gap}px</span></label>
                <input type="range" min={4} max={40} value={webGrid.gap} onChange={e => saveWebGrid({ ...webGrid, gap: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
              </div>
              {/* Padding Mobile */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>📐 هامش الجانبين (جوال): <span style={{ color: '#003366' }}>{webGrid.paddingMobile ?? 8}px</span></label>
                <input type="range" min={0} max={32} value={webGrid.paddingMobile ?? 8} onChange={e => saveWebGrid({ ...webGrid, paddingMobile: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
              </div>
              {/* Card Min Width */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>📏 الحد الأدنى لعرض البطاقة: <span style={{ color: '#003366' }}>{webGrid.cardMinWidth}px</span></label>
                <input type="range" min={160} max={500} value={webGrid.cardMinWidth} onChange={e => saveWebGrid({ ...webGrid, cardMinWidth: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
              </div>
              {/* Image/Thumb Height */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#223344', display: 'block', marginBottom: 6 }}>🖼️ ارتفاع صورة الغلاف: <span style={{ color: '#003366' }}>{webGrid.imgHeight ?? 220}px</span></label>
                <input type="range" min={80} max={500} value={webGrid.imgHeight ?? 220} onChange={e => saveWebGrid({ ...webGrid, imgHeight: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
              </div>
              <GridFontControls value={{ ...webGrid, titleFontSize: webGrid.titleFontSize ?? 15, descFontSize: webGrid.descFontSize ?? 13, tagFontSize: webGrid.tagFontSize ?? 11, autoScaleFont: webGrid.autoScaleFont !== false }} onChange={patch => saveWebGrid({ ...webGrid, ...patch })} accent="#003366" />
            </div>

            {/* Dual Preview — same CSS as live site */}
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12 }}>
              <div style={{ background: '#fff', border: '1px dashed #aac4ee', borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#003366', marginBottom: 8 }}><i className="fa-solid fa-desktop" /> معاينة الويب ({webGrid.colsDesktop} مشروع/سطر)</div>
                <div className="web-proj-grid web-preview-desktop" style={{ ...webGridVars(webGrid), marginBottom: 0 }}>
                  {Array.from({ length: Math.min(webGrid.colsDesktop, 6) }, (_, i) => (
                    <div key={i} style={{ background: '#f0f4ff', border: '1px solid #cde', borderRadius: 8, overflow: 'hidden' }}>
                      <div className="card-thumb-placeholder" style={{ background: 'linear-gradient(135deg,#003366,#1a5276)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-globe" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }} /></div>
                      <div style={{ padding: '4px 6px' }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#003366', marginBottom: 2 }}>عنوان المشروع</div>
                        <div style={{ fontSize: 8, color: '#3d4f63' }}>وصف قصير...</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: '#fff', border: '1px dashed #aac4ee', borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#003366', marginBottom: 8 }}><i className="fa-solid fa-mobile-screen" /> معاينة الجوال ({webGrid.colsMobile} مشروع/سطر)</div>
                <div style={{ maxWidth: 260, margin: '0 auto', border: '2px solid #d4e4ff', borderRadius: 14, padding: 6, background: '#fafcff' }}>
                  <div className="web-proj-grid web-preview-mobile" style={{ ...webGridVars(webGrid), marginBottom: 0 }}>
                    {Array.from({ length: Math.min(webGrid.colsMobile * 2, 8) }, (_, i) => (
                      <div key={i} style={{ background: '#f0f4ff', border: '1px solid #cde', borderRadius: 6, overflow: 'hidden' }}>
                        <div className="card-thumb-placeholder" style={{ height: Math.max(28, (webGrid.imgHeight ?? 220) * 0.2), background: 'linear-gradient(135deg,#003366,#1a5276)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-globe" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }} /></div>
                        <div style={{ padding: '3px 5px' }}>
                          <div style={{ fontSize: 8, fontWeight: 800, color: '#003366' }}>عنوان</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#445566', marginTop: 6, textAlign: 'center' }}>↑ تُطبَّق على الموقع — ويب للشاشات العريضة، جوال لعرض ≤768px</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 14, minHeight: 400 }}>
        {/* Project list */}
        <div>
          <button className="btn-prime btn-sm" style={{ marginBottom: 10, width: '100%' }}
            onClick={() => { const p = emptyProj(); const next = [...projects, p]; commit(next); setSel(next.length - 1); setDraft(p); }}>
            <i className="fa-solid fa-plus" /> مشروع جديد
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {projects.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <ReorderBtns index={i} total={projects.length} onMove={dir => {
                  const next = moveItem(projects, i, dir);
                  commit(next);
                  if (sel === i) setSel(i + dir);
                  else if (sel !== null) {
                    if (dir === -1 && sel === i - 1) setSel(i);
                    else if (dir === 1 && sel === i + 1) setSel(i);
                  }
                }} />
                <button type="button" onClick={() => { setSel(i); setDraft({ ...p, images: [...p.images] }); }}
                  style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: 10, border: `1px solid ${sel === i ? '#003366' : '#dde'}`, background: sel === i ? '#003366' : '#fff', color: sel === i ? '#fff' : '#333', fontSize: 12, cursor: 'pointer', textAlign: 'right', display: 'flex', gap: 8, alignItems: 'center' }}>
                  {p.mainImg && <img src={resolveImageSrc(p.mainImg)} alt="" style={{ width: 32, height: 32, objectFit: 'contain', background: '#fff', borderRadius: 6, flexShrink: 0 }} />}
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title.ar || p.title.en || '(بلا عنوان)'}</div>
                    {p.tags.length > 0 && <div style={{ fontSize: 10, opacity: 0.7 }}>{p.tags.slice(0,2).join(', ')}</div>}
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div>
          {draft !== null && sel !== null ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['ar','en','de'] as LangKey[]).map(l => (
                    <button key={l} onClick={() => setEditLang(l)}
                      style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${editLang === l ? '#003366' : '#dde'}`, background: editLang === l ? '#003366' : '#fff', color: editLang === l ? '#fff' : '#333', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      {l.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <MlFieldsTranslateButton small context="web development project"
                    fields={{ title: draft.title, desc: draft.desc }}
                    onFieldTranslated={(key, tr) => {
                      if (!draft) return;
                      if (key === 'title') setDraft({ ...draft, title: mergeMlTranslation(draft.title, tr) });
                      else if (key === 'desc') setDraft({ ...draft, desc: mergeMlTranslation(draft.desc, tr) });
                    }}
                  />
                  <button className="btn-danger-sm"
                    onClick={() => { if (!confirm('حذف المشروع؟')) return; const next = projects.filter((_, i) => i !== sel); commit(next); setSel(null); setDraft(null); }}>
                    <i className="fa-solid fa-trash-can" /> حذف
                  </button>
                </div>
              </div>

              {/* Tri-lang title + desc */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="form-group">
                  <label>العنوان ({editLang.toUpperCase()})</label>
                  <input type="text" value={draft.title[editLang]} onChange={e => setDraftML('title', editLang, e.target.value)} dir={editLang === 'ar' ? 'rtl' : 'ltr'} />
                </div>
                <div className="form-group">
                  <label>الحجم المصغر (بكسل)</label>
                  <input type="number" min={120} max={500} value={draft.thumbSize || 220} onChange={e => setDraft({ ...draft, thumbSize: Number(e.target.value) })} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label>الوصف ({editLang.toUpperCase()})</label>
                <textarea rows={3} value={draft.desc[editLang]} onChange={e => setDraftML('desc', editLang, e.target.value)} dir={editLang === 'ar' ? 'rtl' : 'ltr'} />
              </div>

              {/* URLs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="form-group">
                  <label><i className="fa-solid fa-image" /> الصورة الرئيسية (URL)</label>
                  <input type="url" value={draft.mainImg} onChange={e => setDraft({ ...draft, mainImg: e.target.value })}
                    onBlur={e => { const n = normalizeImageUrlForStorage(e.target.value); if (n && n !== e.target.value) setDraft({ ...draft!, mainImg: n }); }} dir="ltr" placeholder="https://drive.google.com/file/d/.../view" />
                </div>
                <div className="form-group">
                  <label><i className="fa-solid fa-arrow-up-right-from-square" /> رابط الموقع المباشر</label>
                  <input type="text" value={draft.liveUrl} onChange={e => setDraft({ ...draft, liveUrl: e.target.value })}
                    onBlur={e => { const n = normalizeExternalUrl(e.target.value); if (n && n !== e.target.value) setDraft({ ...draft!, liveUrl: n }); }}
                    dir="ltr" placeholder="https://example.com أو www.example.com" />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label><i className="fa-brands fa-youtube" /> رابط الفيديو</label>
                <input type="url" value={draft.videoUrl} onChange={e => setDraft({ ...draft, videoUrl: e.target.value })}
                  onBlur={e => { const n = normalizeVideoUrlForStorage(e.target.value); if (n && n !== e.target.value) setDraft({ ...draft!, videoUrl: n }); }}
                  dir="ltr" placeholder="YouTube أو Google Drive فيديو" />
              </div>

              {/* App Store Links */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label><i className="fa-brands fa-google-play" style={{ color: '#01875f' }} /> رابط Google Play</label>
                  <input type="text" value={draft.googlePlayUrl || ''} onChange={e => setDraft({ ...draft, googlePlayUrl: e.target.value })}
                    onBlur={e => { const n = normalizeExternalUrl(e.target.value); if (n && n !== e.target.value) setDraft({ ...draft!, googlePlayUrl: n }); }}
                    dir="ltr" placeholder="https://play.google.com/store/apps/details?id=..." />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', marginTop: 8, fontSize: 12, fontWeight: 700, color: draft.googlePlayVisible !== false ? '#1a7f37' : '#888' }}>
                    <input type="checkbox" checked={draft.googlePlayVisible !== false} onChange={e => setDraft({ ...draft, googlePlayVisible: e.target.checked })} style={{ accentColor: '#1a7f37', width: 15, height: 15 }} />
                    {draft.googlePlayVisible !== false ? '👁 إظهار زر Google Play (نافذة قريباً إن لم يُضف رابط)' : '🙈 إخفاء زر Google Play'}
                  </label>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label><i className="fa-brands fa-apple" style={{ color: '#223344' }} /> رابط App Store</label>
                  <input type="text" value={draft.appleStoreUrl || ''} onChange={e => setDraft({ ...draft, appleStoreUrl: e.target.value })}
                    onBlur={e => { const n = normalizeExternalUrl(e.target.value); if (n && n !== e.target.value) setDraft({ ...draft!, appleStoreUrl: n }); }}
                    dir="ltr" placeholder="https://apps.apple.com/app/..." />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', marginTop: 8, fontSize: 12, fontWeight: 700, color: draft.appleStoreVisible !== false ? '#1a7f37' : '#888' }}>
                    <input type="checkbox" checked={draft.appleStoreVisible !== false} onChange={e => setDraft({ ...draft, appleStoreVisible: e.target.checked })} style={{ accentColor: '#1a7f37', width: 15, height: 15 }} />
                    {draft.appleStoreVisible !== false ? '👁 إظهار زر App Store (نافذة قريباً إن لم يُضف رابط)' : '🙈 إخفاء زر App Store'}
                  </label>
                </div>
              </div>

              {/* GitHub */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 10, alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label><i className="fa-brands fa-github" /> رابط GitHub (للتوثيق)</label>
                  <input type="url" value={draft.githubUrl || ''} onChange={e => setDraft({ ...draft, githubUrl: e.target.value })} dir="ltr" placeholder="https://github.com/username/repo" />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', padding: '10px 14px', borderRadius: 9, border: `2px solid ${draft.githubVisible !== false ? '#1a7f37' : '#dde'}`, background: draft.githubVisible !== false ? 'rgba(26,127,55,0.1)' : 'transparent', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, color: draft.githubVisible !== false ? '#1a7f37' : '#888', userSelect: 'none' }}>
                  <input type="checkbox" checked={draft.githubVisible !== false} onChange={e => setDraft({ ...draft, githubVisible: e.target.checked })} style={{ accentColor: '#1a7f37', width: 15, height: 15 }} />
                  {draft.githubVisible !== false ? '👁 ظاهر' : '🙈 مخفي'}
                </label>
              </div>

              {/* Text + image background colors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label><i className="fa-solid fa-palette" /> لون النص في البطاقة</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={draft.textColor || '#ffffff'} onChange={e => setDraft({ ...draft, textColor: e.target.value })}
                      style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid #dde', cursor: 'pointer', padding: 2 }} />
                    <input type="text" value={draft.textColor || ''} onChange={e => setDraft({ ...draft, textColor: e.target.value })}
                      placeholder="#ffffff أو فارغ للافتراضي" dir="ltr" style={{ flex: 1, fontSize: 12 }} />
                    {draft.textColor && <button className="btn-cancel btn-sm" onClick={() => setDraft({ ...draft, textColor: '' })} title="إزالة اللون"><i className="fa-solid fa-xmark" /></button>}
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label><i className="fa-solid fa-fill-drip" /> لون خلفية الصورة</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={draft.imgBgColor || '#f0f4ff'} onChange={e => setDraft({ ...draft, imgBgColor: e.target.value })}
                      style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid #dde', cursor: 'pointer', padding: 2 }} />
                    <input type="text" value={draft.imgBgColor || ''} onChange={e => setDraft({ ...draft, imgBgColor: e.target.value })}
                      placeholder="#f0f4ff — مفيد للصور الشفافة" dir="ltr" style={{ flex: 1, fontSize: 12 }} />
                    {draft.imgBgColor && <button className="btn-cancel btn-sm" onClick={() => setDraft({ ...draft, imgBgColor: '' })} title="إزالة اللون"><i className="fa-solid fa-xmark" /></button>}
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 10 }}>
                <label>الوسوم (مفصولة بفاصلة)</label>
                <input type="text" value={draft.tags.join(', ')} onChange={e => setDraft({ ...draft, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} dir="ltr" />
              </div>

              {/* Additional images */}
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label>صور إضافية (أضف رابط وانقر +)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="url" value={newImg} onChange={e => setNewImg(e.target.value)} dir="ltr" placeholder="https://..." style={{ flex: 1 }} />
                  <button className="btn-prime btn-sm" onClick={() => { if (!newImg.trim()) return; setDraft({ ...draft, images: [...draft.images, newImg.trim()] }); setNewImg(''); }}>
                    <i className="fa-solid fa-plus" />
                  </button>
                </div>
                {draft.images.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {draft.images.map((img, ii) => (
                      <div key={ii} style={{ position: 'relative' }}>
                        <img src={img} style={{ width: 70, height: 50, objectFit: 'cover', borderRadius: 8 }} />
                        <button onClick={() => setDraft({ ...draft, images: draft.images.filter((_, x) => x !== ii) })}
                          style={{ position: 'absolute', top: -6, insetInlineEnd: -6, background: '#c00', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', color: '#fff', fontSize: 10, lineHeight: '18px', textAlign: 'center', padding: 0 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview strip */}
              {draft.mainImg && (
                <div style={{ marginBottom: 14 }}>
                  <div className="web-proj-thumb-wrap" style={{ background: draft.imgBgColor || '#ffffff', borderRadius: 10, overflow: 'hidden', minHeight: 100, height: 120 }}>
                    <img src={resolveImageSrc(draft.mainImg)} alt="" style={{ height: '100%', width: '100%', objectFit: 'contain', objectPosition: 'center', display: 'block' }} />
                  </div>
                </div>
              )}

              <button className="btn-prime" onClick={() => {
                if (!draft) return;
                const cleaned: WebProject = {
                  ...draft,
                  liveUrl: normalizeExternalUrl(draft.liveUrl),
                  googlePlayUrl: isUsableProjectLink(draft.googlePlayUrl || '') ? normalizeExternalUrl(draft.googlePlayUrl || '') : '',
                  appleStoreUrl: isUsableProjectLink(draft.appleStoreUrl || '') ? normalizeExternalUrl(draft.appleStoreUrl || '') : '',
                  githubUrl: draft.githubUrl ? normalizeExternalUrl(draft.githubUrl) : '',
                };
                setDraft(cleaned);
                commit(projects.map((p, i) => i === sel ? cleaned : p));
                alert('تم الحفظ ✓');
              }}>
                <i className="fa-solid fa-floppy-disk" /> حفظ المشروع
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#556677', flexDirection: 'column', gap: 10 }}>
              <i className="fa-solid fa-globe" style={{ fontSize: 36 }} />
              <span>اختر مشروعاً للتعديل</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   LAB PENDING (VISITOR SUBMISSIONS)
══════════════════════════════════════════════════════ */
function LabPendingAdmin({
  data,
  onSave,
}: {
  data: AppData;
  onSave: (u: Partial<AppData>) => void;
}) {
  const [items, setItems] = useState<LabSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const token = getApiToken();
    if (!token) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const list = await fetchPendingLabSubmissions(token);
    setItems(list);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleApprove = async (row: LabSubmissionRow) => {
    const token = getApiToken();
    if (!token) return;
    setBusyId(row.id);
    const res = await approveLabSubmission(token, row.id);
    if (res.ok && res.snippet) {
      const next = [...(data.softwareSnippets || []), {
        id: res.snippet.id,
        title: normML(res.snippet.title),
        desc: normML(res.snippet.desc),
        codeHtml: res.snippet.codeHtml,
        codeCss: res.snippet.codeCss,
        codeJs: res.snippet.codeJs,
        category: res.snippet.category,
      }];
      await onSave({ softwareSnippets: next });
      setItems((prev) => prev.filter((x) => x.id !== row.id));
    } else {
      alert(res.error || 'تعذّر القبول');
    }
    setBusyId(null);
  };

  const handleReject = async (row: LabSubmissionRow) => {
    const token = getApiToken();
    if (!token) return;
    if (!confirm('رفض هذا المشروع؟')) return;
    setBusyId(row.id);
    const note = rejectNote[row.id] || '';
    const res = await rejectLabSubmission(token, row.id, note);
    if (res.ok) {
      setItems((prev) => prev.filter((x) => x.id !== row.id));
    } else {
      alert(res.error || 'تعذّر الرفض');
    }
    setBusyId(null);
  };

  if (loading) {
    return <p style={{ fontSize: 13, color: '#556' }}><i className="fa-solid fa-spinner fa-spin" /> جاري التحميل…</p>;
  }

  if (!getApiToken()) {
    return (
      <div style={{ padding: 14, background: '#fff8e7', borderRadius: 10, border: '1px solid #f5d77a', fontSize: 13 }}>
        سجّل الدخول للخادم لعرض طلبات الزوار.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#556', background: '#f5f7fa', borderRadius: 12 }}>
        <i className="fa-solid fa-inbox" style={{ fontSize: 28, opacity: 0.4, display: 'block', marginBottom: 10 }} />
        لا توجد طلبات معلّقة من الزوار
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button className="btn-outline-sm" onClick={() => void load()} style={{ alignSelf: 'flex-start' }}>
        <i className="fa-solid fa-rotate" /> تحديث
      </button>
      {items.map((row) => (
        <div key={row.id} style={{ background: '#fff', border: '1px solid #dde', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#003366' }}>{row.title}</div>
              <div style={{ fontSize: 12, color: '#556', marginTop: 4 }}>{row.desc}</div>
              {row.category && <span style={{ fontSize: 10, background: '#e8f0ff', color: '#003366', borderRadius: 6, padding: '2px 8px', marginTop: 6, display: 'inline-block' }}>{row.category}</span>}
            </div>
            <div style={{ fontSize: 11, color: '#888', textAlign: 'left' }}>
              {row.visitorName && <div><i className="fa-solid fa-user" /> {row.visitorName}</div>}
              {row.visitorContact && <div dir="ltr">{row.visitorContact}</div>}
              <div>{row.createdAt}</div>
            </div>
          </div>
          <details style={{ marginBottom: 10 }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#003366' }}>معاينة الكود</summary>
            <pre style={{ marginTop: 8, padding: 10, background: '#111', color: '#b3e0ff', borderRadius: 8, fontSize: 11, maxHeight: 180, overflow: 'auto', direction: 'ltr' }}>{row.codeHtml.slice(0, 2000)}{row.codeHtml.length > 2000 ? '…' : ''}</pre>
          </details>
          <input
            type="text"
            placeholder="ملاحظة للزائر عند الرفض (اختياري)"
            value={rejectNote[row.id] || ''}
            onChange={(e) => setRejectNote((n) => ({ ...n, [row.id]: e.target.value }))}
            style={{ width: '100%', marginBottom: 10, padding: '8px 10px', borderRadius: 8, border: '1px solid #dde', fontSize: 12 }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn-prime btn-sm"
              disabled={busyId === row.id}
              onClick={() => void handleApprove(row)}
            >
              <i className={`fa-solid ${busyId === row.id ? 'fa-spinner fa-spin' : 'fa-check'}`} /> قبول ونشر
            </button>
            <button
              className="btn-danger-sm"
              disabled={busyId === row.id}
              onClick={() => void handleReject(row)}
            >
              <i className="fa-solid fa-xmark" /> رفض
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   LAB ADMIN (CODE SNIPPETS)
══════════════════════════════════════════════════════ */
function LabAdmin({ data, onSave }: { data: AppData; onSave: (u: Partial<AppData>) => void }) {
  const [subTab, setSubTab] = useState<'webproj' | 'snippets' | 'pending'>('webproj');
  const [snippets, setSnippets] = useState<SoftwareSnippet[]>(data.softwareSnippets || []);
  const [sel, setSel] = useState<number | null>(null);
  const [draft, setDraft] = useState<SoftwareSnippet | null>(null);
  const [codeLang, setCodeLang] = useState<'html' | 'css' | 'js'>('html');
  const [editLang, setEditLang] = useState<LangKey>('ar');

  const commit = (next: SoftwareSnippet[]) => { setSnippets(next); onSave({ softwareSnippets: next }); };
  const empty = (): SoftwareSnippet => ({ title: ml(''), desc: ml(''), category: '', codeHtml: '', codeCss: '', codeJs: '' });

  const setDraftML = (field: 'title' | 'desc', lang: LangKey, val: string) => {
    if (!draft) return;
    setDraft({ ...draft, [field]: { ...draft[field], [lang]: val } });
  };

  return (
    <div>
      <h4 style={{ margin: '0 0 14px' }}><i className="fa-solid fa-code" style={{ color: '#003366' }} /> برمجة المواقع والتطبيقات</h4>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { id: 'webproj', label: 'المشاريع البرمجية', icon: 'fa-globe' },
          { id: 'snippets', label: 'مختبرات الأكواد', icon: 'fa-flask' },
          { id: 'pending', label: 'طلبات الزوار', icon: 'fa-inbox' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id as 'webproj' | 'snippets' | 'pending')}
            style={{ padding: '7px 16px', borderRadius: 10, border: `1px solid ${subTab === tab.id ? '#003366' : '#dde'}`, background: subTab === tab.id ? '#003366' : '#f5f7fa', color: subTab === tab.id ? '#fff' : '#333', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className={`fa-solid ${tab.icon}`} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Web Projects */}
      {subTab === 'webproj' && <WebProjAdmin data={data} onSave={onSave} />}

      {subTab === 'pending' && <LabPendingAdmin data={data} onSave={onSave} />}

      {/* Code Snippets */}
      {subTab === 'snippets' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <MlBulkTranslateButton
              context="code lab snippets"
              fields={Object.fromEntries(snippets.flatMap((s, i) => {
                const rows: [string, string][] = [];
                const id = s.id || String(i);
                if (s.title.ar?.trim()) rows.push([`t_${id}`, s.title.ar.trim()]);
                if (s.desc.ar?.trim()) rows.push([`d_${id}`, s.desc.ar.trim()]);
                return rows;
              }))}
              label="ترجمة شاملة — كل المقتطفات"
              onComplete={tr => {
                const next = snippets.map((s, i) => {
                  const id = s.id || String(i);
                  return {
                    ...s,
                    title: tr[`t_${id}`] ? mergeMlTranslation(s.title, tr[`t_${id}`]) : s.title,
                    desc: tr[`d_${id}`] ? mergeMlTranslation(s.desc, tr[`d_${id}`]) : s.desc,
                  };
                });
                commit(next);
                if (draft && sel !== null && next[sel]) setDraft({ ...next[sel] });
              }}
            />
          </div>
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 14, minHeight: 360 }}>
          <div>
            <button className="btn-prime btn-sm" style={{ marginBottom: 10, width: '100%' }}
              onClick={() => { const s = empty(); const next = [...snippets, s]; commit(next); setSel(next.length - 1); setDraft(s); }}>
              <i className="fa-solid fa-plus" /> مقتطف جديد
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {snippets.map((s, i) => (
                <button key={i} onClick={() => { setSel(i); setDraft({ ...s }); setCodeLang('html'); }}
                  style={{ padding: '7px 10px', borderRadius: 10, border: `1px solid ${sel === i ? '#003366' : '#dde'}`, background: sel === i ? '#003366' : '#fff', color: sel === i ? '#fff' : '#333', fontSize: 12, cursor: 'pointer', textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pickML(s.title, 'ar') || '(بلا عنوان)'}</div>
                  {s.category && <div style={{ fontSize: 10, opacity: 0.7 }}>{s.category}</div>}
                </button>
              ))}
            </div>
          </div>
          <div>
            {draft !== null && sel !== null ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <strong>تعديل المقتطف</strong>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {(['ar','en','de'] as LangKey[]).map(l => (
                      <button key={l} type="button" onClick={() => setEditLang(l)}
                        style={{ padding: '4px 12px', borderRadius: 8, border: `1px solid ${editLang === l ? '#003366' : '#dde'}`, background: editLang === l ? '#003366' : '#fff', color: editLang === l ? '#fff' : '#333', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        {l.toUpperCase()}
                      </button>
                    ))}
                    <MlFieldsTranslateButton small context="code lab snippet"
                      fields={{ title: draft.title, desc: draft.desc }}
                      onFieldTranslated={(key, tr) => {
                        if (!draft) return;
                        if (key === 'title') setDraft({ ...draft, title: mergeMlTranslation(draft.title, tr) });
                        else if (key === 'desc') setDraft({ ...draft, desc: mergeMlTranslation(draft.desc, tr) });
                      }}
                    />
                    <button className="btn-danger-sm"
                      onClick={() => { if (!confirm('حذف؟')) return; const next = snippets.filter((_, i) => i !== sel); commit(next); setSel(null); setDraft(null); }}>
                      <i className="fa-solid fa-trash-can" /> حذف
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div className="form-group"><label>العنوان ({editLang.toUpperCase()})</label>
                    <input type="text" value={draft.title[editLang]} onChange={e => setDraftML('title', editLang, e.target.value)} dir={editLang === 'ar' ? 'rtl' : 'ltr'} /></div>
                  <div className="form-group"><label>الفئة / اللغة</label>
                    <input type="text" value={draft.category || ''} onChange={e => setDraft({ ...draft, category: e.target.value })} /></div>
                </div>
                <div className="form-group" style={{ marginBottom: 10 }}><label>الوصف ({editLang.toUpperCase()})</label>
                  <input type="text" value={draft.desc[editLang]} onChange={e => setDraftML('desc', editLang, e.target.value)} dir={editLang === 'ar' ? 'rtl' : 'ltr'} /></div>

                {/* Code language tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {(['html','css','js'] as const).map(lang => (
                    <button key={lang} onClick={() => setCodeLang(lang)}
                      style={{ padding: '4px 14px', borderRadius: 8, border: `1px solid ${codeLang === lang ? (lang==='html'?'#e34f26':lang==='css'?'#1572b6':'#f7df1e') : '#dde'}`,
                        background: codeLang === lang ? (lang==='html'?'#e34f26':lang==='css'?'#1572b6':'#f7df1e') : '#f5f7fa',
                        color: codeLang === lang ? (lang==='js'?'#333':'#fff') : '#333', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      <i className={`fa-brands fa-${lang==='js'?'js':lang==='html'?'html5':'css3-alt'}`} style={{ marginInlineEnd: 4 }} />
                      {lang.toUpperCase()}
                    </button>
                  ))}
                </div>

                {codeLang === 'html' && (
                  <div className="form-group">
                    <textarea rows={12} value={draft.codeHtml} style={{ direction: 'ltr', fontFamily: 'monospace', fontSize: 12 }}
                      onChange={e => setDraft({ ...draft, codeHtml: e.target.value })} />
                  </div>
                )}
                {codeLang === 'css' && (
                  <div className="form-group">
                    <textarea rows={12} value={draft.codeCss} style={{ direction: 'ltr', fontFamily: 'monospace', fontSize: 12 }}
                      onChange={e => setDraft({ ...draft, codeCss: e.target.value })} />
                  </div>
                )}
                {codeLang === 'js' && (
                  <div className="form-group">
                    <textarea rows={12} value={draft.codeJs || ''} style={{ direction: 'ltr', fontFamily: 'monospace', fontSize: 12 }}
                      onChange={e => setDraft({ ...draft, codeJs: e.target.value })} placeholder="// JavaScript code here" />
                  </div>
                )}

                <button className="btn-prime" onClick={() => { commit(snippets.map((s, i) => i === sel ? draft! : s)); alert('تم الحفظ ✓'); }}>
                  <i className="fa-solid fa-floppy-disk" /> حفظ
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#556677', flexDirection: 'column', gap: 10 }}>
                <i className="fa-solid fa-code" style={{ fontSize: 32 }} /><span>اختر مقتطفاً للتعديل</span>
              </div>
            )}
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SITE SETTINGS ADMIN
══════════════════════════════════════════════════════ */
function AiKeyManager() {
  return (
    <div className="admin-light-panel" style={{ background: '#f0f4ff', border: '2px solid #c5d3f0', borderRadius: 12, padding: 18, marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <i className="fa-solid fa-server" style={{ color: '#0055cc', fontSize: 22, marginTop: 2 }} />
      <div>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#003366', marginBottom: 4 }}>
          مفتاح الذكاء الاصطناعي — محفوظ داخل السيرفر
        </div>
        <div style={{ fontSize: 12, color: '#446', lineHeight: 1.9 }}>
          الطلبات تمر عبر ملف <code style={{ background: '#dce8ff', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>ai_proxy.php</code> على السيرفر.
          المفتاح مخفي تماماً عن المتصفح ولا يظهر في أي طلب شبكي.
          لتغيير المفتاح، افتح <code style={{ background: '#dce8ff', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>config.php</code> على Hostinger وعدّل:
          <br />
          <code style={{ background: '#eef2ff', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', direction: 'ltr', display: 'inline-block', marginTop: 6 }}>
            define('GEMINI_API_KEY', 'AQ....أو AIza...');
          </code>
          <br />
          مفاتيح Google الجديدة تبدأ غالباً بـ <b>AQ.</b> — ضعها في الملف ثم احفظه. لا يكفي لصق المفتاح هنا في لوحة التحكم.
        </div>
      </div>
    </div>
  );
}

function SiteSettingsAdmin({
  data, onApply, onPersist, serverConnected, serverSyncing, onServerConnect, onServerDisconnect,
}: {
  data: AppData;
  onApply: (u: Partial<AppData>) => void;
  onPersist: () => Promise<boolean>;
  serverConnected?: boolean;
  serverSyncing?: boolean;
  onServerConnect?: (username: string, password: string) => Promise<boolean>;
  onServerDisconnect?: () => void;
}) {
  const [lang, setLang] = useState<LangKey>('ar');
  const [settings, setSettings] = useState<SiteSettings>(data.siteSettings || {
    logoType: 'text', logoImg: '', logoText: ml('المهندس علاء', 'ENG. ALAA', 'ING. ALAA'),
    footerBg: '#003366', footerText: ml('© جميع الحقوق محفوظة', '© All Rights Reserved', '© Alle Rechte vorbehalten'),
    socialLinks: [], navItems: [], themeMode: 'dark', accentColor: '#003366', menuTextColor: '',
    buttonBgColor: '', buttonTextColor: '', gfxFreeDownloadBtnColor: '',
    siteFontFamily: 'Tajawal', baseFontSize: 16, bodyTextColor: '', headingTextColor: '', mutedTextColor: '',
    glassOpacity: 0.5,
    visitorGpsPromptEnabled: false,
    aboutHeroMedia: '',
    aboutHeroKind: 'auto',
    aboutNameBadgeVisible: true,
    aboutNameBadgeBottomDesktop: 22,
    aboutNameBadgeBottomMobile: 8,
    aboutNameBadgePadY: 6,
    homeIntroVideo: '',
    reportGalleryShowCustomerName: true,
    reportGalleryColsMobile: 2,
    reportGalleryColsDesktop: 3,
  });
  const aboutHeroFileRef = useRef<HTMLInputElement>(null);
  const homeIntroVideoFileRef = useRef<HTMLInputElement>(null);
  const [badgePreviewMode, setBadgePreviewMode] = useState<'desktop' | 'mobile'>('mobile');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'local' | 'server' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState('');
  const persistTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [srvUser, setSrvUser] = useState('');
  const [srvPass, setSrvPass] = useState('');
  const [srvError, setSrvError] = useState('');
  const [srvSuccess, setSrvSuccess] = useState('');

  const flushPersist = useCallback(async () => {
    setSyncStatus('saving');
    setSyncMsg('جارٍ الحفظ والرفع...');
    try {
      const ok = await onPersist();
      if (ok) {
        setSyncStatus('server');
        setSyncMsg('✓ محفوظ ومرفوع للسيرفر — يظهر للزوار خلال ثوانٍ');
      } else if (serverConnected) {
        setSyncStatus('error');
        setSyncMsg('⚠ محفوظ محلياً — فشل الرفع، جرّب «رفع البيانات الآن»');
      } else {
        setSyncStatus('local');
        setSyncMsg('✓ محفوظ محلياً — اتصل بالسيرفر ليظهر للجميع');
      }
    } catch {
      setSyncStatus('error');
      setSyncMsg('⚠ فشل الحفظ');
    }
  }, [onPersist, serverConnected]);

  const schedulePersist = useCallback(() => {
    clearTimeout(persistTimerRef.current);
    setSyncStatus('saving');
    setSyncMsg('جارٍ الحفظ...');
    persistTimerRef.current = setTimeout(() => { void flushPersist(); }, 700);
  }, [flushPersist]);

  useEffect(() => () => clearTimeout(persistTimerRef.current), []);

  useEffect(() => {
    if (data.siteSettings) setSettings(data.siteSettings);
  }, [data.siteSettings]);

  const commit = (next: SiteSettings) => {
    setSettings(next);
    onApply({ siteSettings: next });
    schedulePersist();
  };

  const newSocial = (): SocialLink => ({ id: uid(), icon: 'fa-solid fa-link', url: '' });
  const newNav = (): NavItem => ({ id: uid(), label: ml('', '', ''), url: '#', parentId: '', order: settings.navItems.length + 1 });

  async function connectServer() {
    setSrvError('');
    setSrvSuccess('');
    if (!srvUser.trim() || !srvPass.trim()) { setSrvError('أدخل اسم المستخدم وكلمة المرور'); return; }
    const ok = await onServerConnect?.(srvUser.trim(), srvPass.trim());
    if (ok) {
      setSrvSuccess('✅ تم الاتصال ونقل البيانات إلى قاعدة البيانات بنجاح!');
      setSrvUser(''); setSrvPass('');
    } else {
      setSrvError('❌ فشل الاتصال — تحقق من بيانات المستخدم أو اتصال الخادم');
    }
  }

  return (
    <div>
      <h4 style={{ margin: '0 0 14px' }}><i className="fa-solid fa-globe" style={{ color: '#003366' }} /> إعدادات الموقع العامة</h4>
      {syncMsg && (
        <div style={{
          background: syncStatus === 'server' ? '#e8f5e9' : syncStatus === 'error' ? '#fff3f3' : syncStatus === 'saving' ? '#eef4ff' : '#fff8e1',
          border: `1px solid ${syncStatus === 'server' ? '#c8e6c9' : syncStatus === 'error' ? '#ffcdd2' : syncStatus === 'saving' ? '#c5d3f0' : '#ffe082'}`,
          borderRadius: 8, padding: '8px 14px', marginBottom: 12,
          color: syncStatus === 'server' ? '#2a7a2a' : syncStatus === 'error' ? '#c62828' : syncStatus === 'saving' ? '#003366' : '#795548',
          fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
        }}>
          <span>
            {syncStatus === 'saving' && <i className="fa-solid fa-spinner fa-spin" style={{ marginInlineEnd: 6 }} />}
            {syncMsg}
          </span>
          {syncStatus === 'error' && (
            <button type="button" className="btn-outline-sm" onClick={() => void flushPersist()} style={{ fontSize: 11 }}>
              <i className="fa-solid fa-rotate" /> إعادة المحاولة
            </button>
          )}
        </div>
      )}

      {/* ── بطاقة مزامنة الخادم ──────────────────────────────── */}
      <div style={{ background: serverConnected ? '#f0fff4' : '#fff8e1', border: `1px solid ${serverConnected ? '#a5d6a7' : '#ffe082'}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: serverConnected ? 0 : 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            <i className={`fa-solid ${serverConnected ? 'fa-circle-check' : 'fa-circle-xmark'}`} style={{ color: serverConnected ? '#2a7a2a' : '#e67e22', marginInlineEnd: 6 }} />
            مزامنة قاعدة البيانات (Hostinger MySQL)
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: serverConnected ? '#c8e6c9' : '#ffecb3', color: serverConnected ? '#1b5e20' : '#795548' }}>
            {serverConnected ? 'متصل ✔' : 'غير متصل'}
          </span>
        </div>

        {serverConnected ? (
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220, color: '#23733a', fontWeight: 700, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 7 }}>
              <i className={`fa-solid ${serverSyncing ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`} />
              {serverSyncing ? 'جارٍ الاتصال والمزامنة التلقائية...' : 'المزامنة التلقائية مفعّلة — يُرفع كل تغيير فور حفظه دون الضغط على أي زر'}
            </div>
            <button
              onClick={() => onServerDisconnect?.()}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e74c3c', background: '#fff', color: '#e74c3c', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
            >
              <i className="fa-solid fa-plug-circle-xmark" /> قطع الاتصال
            </button>
            {srvSuccess && <div style={{ color: '#2a7a2a', fontWeight: 700, alignSelf: 'center', fontSize: 13 }}>{srvSuccess}</div>}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: '#334455', marginBottom: 10, lineHeight: 1.7 }}>
              <i className="fa-solid fa-circle-info" style={{ color: '#e67e22', marginInlineEnd: 4 }} />
              سجّل الدخول مرة واحدة فقط لتفعيل جلسة آمنة متجددة. بعد ذلك يُستعاد الاتصال تلقائياً عند فتح اللوحة، وكل تغيير يُحفظ مباشرة في قاعدة البيانات دون زر مزامنة.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                placeholder="اسم المستخدم (username)"
                value={srvUser}
                style={{ direction: 'ltr', padding: '8px 10px', borderRadius: 8, border: '1px solid #ffe082', fontSize: 13 }}
                onChange={e => setSrvUser(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && connectServer()}
              />
              <input
                type="password"
                placeholder="كلمة المرور"
                value={srvPass}
                style={{ direction: 'ltr', padding: '8px 10px', borderRadius: 8, border: '1px solid #ffe082', fontSize: 13 }}
                onChange={e => setSrvPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && connectServer()}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={connectServer}
                disabled={serverSyncing}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 8, border: 'none', background: '#003366', color: '#fff', cursor: serverSyncing ? 'wait' : 'pointer', fontWeight: 700, fontSize: 13 }}
              >
                <i className={`fa-solid ${serverSyncing ? 'fa-spinner fa-spin' : 'fa-plug'}`} />
                {serverSyncing ? 'جارٍ الاتصال...' : 'اتصال ومزامنة'}
              </button>
              {srvError && <div style={{ color: '#c0392b', fontWeight: 700, fontSize: 12 }}>{srvError}</div>}
              {srvSuccess && <div style={{ color: '#2a7a2a', fontWeight: 700, fontSize: 13 }}>{srvSuccess}</div>}
            </div>
          </div>
        )}
      </div>

      <AiKeyManager />

      {/* VISITOR GPS CONSENT */}
      <div style={{
        background: settings.visitorGpsPromptEnabled ? '#eefbf3' : '#f8f9ff',
        border: `2px solid ${settings.visitorGpsPromptEnabled ? '#69b987' : '#dde'}`,
        borderRadius: 12, padding: 16, marginBottom: 14,
      }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.visitorGpsPromptEnabled === true}
            onChange={e => commit({ ...settings, visitorGpsPromptEnabled: e.target.checked })}
            style={{ marginTop: 3, width: 18, height: 18 }}
          />
          <span>
            <strong style={{ display: 'block', color: '#003366', marginBottom: 5 }}>
              <i className="fa-solid fa-location-crosshairs" /> طلب موقع GPS الدقيق من الزائر
            </strong>
            <span style={{ display: 'block', fontSize: 12, color: '#445566', lineHeight: 1.7 }}>
              عند التفعيل يظهر للزائر طلب موافقة واضح، ثم يعرض المتصفح نافذة إذن الموقع.
              لا يمكن الحصول على GPS الدقيق إذا رفض الزائر. عند التعطيل يبقى تحديد البلد والمدينة التقريبي عبر IP فقط.
            </span>
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {LANGS.map(l => <button key={l.code} onClick={() => setLang(l.code)} style={{ padding: '4px 8px', borderRadius: 12, border: `1px solid ${lang === l.code ? '#003366' : '#ccc'}`, background: lang === l.code ? '#003366' : '#fff', color: lang === l.code ? '#fff' : '#555', fontSize: 11, cursor: 'pointer' }}>{l.flag} {l.label}</button>)}
      </div>

      {/* THEME MODE */}
      <div className="admin-light-panel" style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}><i className="fa-solid fa-circle-half-stroke" /> وضع العرض / Theme</div>
        <div style={{ display: 'flex', gap: 10 }}>
          {([
            ['dark', 'الوضع الليلي (معتم + حركة)', 'fa-moon'],
            ['light', 'الوضع النهاري (أبيض + حركة)', 'fa-sun'],
          ] as const).map(([mode, label, icon]) => {
            const active = (settings.themeMode || 'dark') === mode;
            return (
              <button
                key={mode}
                onClick={() => commit({ ...settings, themeMode: mode })}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  border: `2px solid ${active ? '#003366' : '#dde'}`,
                  background: active ? '#003366' : '#fff',
                  color: active ? '#fff' : '#556',
                }}
              >
                <i className={`fa-solid ${icon}`} /> {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SITE COLORS — accent + menu text + glass transparency (whole site) */}
      <div className="admin-light-panel" style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <div className="admin-surface-title"><i className="fa-solid fa-palette" /> ألوان الموقع والقوائم</div>
          <button
            type="button"
            className="btn-danger-sm"
            onClick={() => commit({
              ...settings,
              ...DEFAULT_THEME_COLOR_FIELDS,
            })}
            style={{ fontSize: 12 }}
          >
            <i className="fa-solid fa-rotate-left" /> إعادة كل الألوان للوضع الافتراضي
          </button>
        </div>
        <div className="admin-surface-hint" style={{ marginBottom: 12 }}>
          كل تغيير لون يُطبَّق فوراً على الموقع ويُحفظ تلقائياً. إذا كان السيرفر متصلاً يُرفع مباشرة لقاعدة البيانات فيظهر للزوار خلال ثوانٍ.
        </div>

        <ThemeColorPicker
          label="اللون الأساسي للموقع"
          value={settings.accentColor || '#003366'}
          defaultValue={DEFAULT_THEME_COLOR_FIELDS.accentColor}
          onChange={v => commit({ ...settings, accentColor: v })}
          previewWhenAuto="#003366"
        />

        <ThemeColorPicker
          label="لون خط القوائم والأزرار"
          hint="يظهر على أزرار الموقع (الرئيسية / السيرة / اللغة) وعناصر القائمة الجانبية في لوحة التحكم."
          value={settings.menuTextColor || ''}
          defaultValue={DEFAULT_THEME_COLOR_FIELDS.menuTextColor}
          onChange={v => commit({ ...settings, menuTextColor: v })}
          allowAuto
          previewWhenAuto={settings.accentColor || '#003366'}
        />

        <ThemeColorPicker
          label="لون خلفية الأزرار"
          hint="أزرار العودة، التالي/السابق، الحفظ، والتبويبات النشطة في الموقع."
          value={settings.buttonBgColor || ''}
          defaultValue={DEFAULT_THEME_COLOR_FIELDS.buttonBgColor}
          onChange={v => commit({ ...settings, buttonBgColor: v })}
          allowAuto
          previewWhenAuto={settings.accentColor || '#003366'}
        />

        <ThemeColorPicker
          label="لون خط الأزرار"
          hint="لون النص داخل الأزرار الملوّنة. اترك «تلقائي» للأبيض."
          value={settings.buttonTextColor || ''}
          defaultValue={DEFAULT_THEME_COLOR_FIELDS.buttonTextColor}
          onChange={v => commit({ ...settings, buttonTextColor: v })}
          allowAuto
          previewWhenAuto="#ffffff"
        />

        <ThemeColorPicker
          label="لون زر التنزيل المجاني (التصاميم)"
          hint="أزرار «تنزيل مجاني» في صفحة مشروع التصميم. اترك «تلقائي» للكحلي (#003366)."
          value={settings.gfxFreeDownloadBtnColor || ''}
          defaultValue={DEFAULT_THEME_COLOR_FIELDS.gfxFreeDownloadBtnColor}
          onChange={v => commit({ ...settings, gfxFreeDownloadBtnColor: v })}
          allowAuto
          previewWhenAuto="#003366"
        />

        <div style={{
          marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        }}>
          <span className="admin-surface-hint" style={{ fontSize: 12, fontWeight: 600 }}>معاينة الأزرار:</span>
          <button type="button" className="btn-back" style={{ pointerEvents: 'none' }}>
            <i className="fa-solid fa-arrow-right" /> عودة للمعرض
          </button>
          <button type="button" className="btn-prime" style={{ pointerEvents: 'none', width: 'auto', padding: '10px 18px' }}>
            <i className="fa-solid fa-floppy-disk" /> حفظ
          </button>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
            background: (settings.gfxFreeDownloadBtnColor || '').trim() || '#003366',
            color: (settings.buttonTextColor || '').trim() || '#fff',
            fontSize: 12, fontWeight: 700, pointerEvents: 'none',
          }}>
            <i className="fa-solid fa-download" /> تنزيل مجاني
          </span>
        </div>

        <div className="form-group">
          <label className="admin-surface-label">درجة شفافية القوائم الزجاجية ({Math.round((settings.glassOpacity ?? 0.5) * 100)}%)</label>
          <input type="range" min={5} max={95} step={5}
            value={Math.round((settings.glassOpacity ?? 0.5) * 100)}
            onChange={e => commit({ ...settings, glassOpacity: Number(e.target.value) / 100 })}
            style={{ width: '100%', accentColor: settings.accentColor || '#003366', cursor: 'pointer' }} />
          <div className="admin-surface-hint" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>أكثر شفافية (زجاجي)</span>
            <span>أكثر تعتيماً (صلب)</span>
          </div>
        </div>
      </div>

      {/* SITE TYPOGRAPHY — full font control */}
      <div className="admin-light-panel" style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div className="admin-surface-title"><i className="fa-solid fa-font" /> الخط والنصوص — الموقع بالكامل</div>
        <div className="admin-surface-hint" style={{ marginBottom: 12 }}>
          يتحكم بنوع الخط وحجمه وألوان النص العام والعناوين والنص الثانوي في كل صفحات الموقع (ليس لوحة التحكم).
        </div>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label style={{ color: '#003366', fontWeight: 700 }}>نوع الخط (Font Family)</label>
          <select
            value={settings.siteFontFamily || 'Tajawal'}
            onChange={e => commit({ ...settings, siteFontFamily: e.target.value })}
            style={{ width: '100%', padding: '9px 10px', borderRadius: 8, border: '1px solid #c5d0e0', fontSize: 13, color: '#0a1a2e', background: '#fff' }}
          >
            {SITE_FONT_OPTIONS.map(f => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <label style={{ color: '#003366', fontWeight: 700 }}>
            حجم الخط الأساسي: <span style={{ color: settings.accentColor || '#003366' }}>{settings.baseFontSize ?? 16}px</span>
          </label>
          <input
            type="range" min={12} max={22} step={1}
            value={settings.baseFontSize ?? 16}
            onChange={e => commit({ ...settings, baseFontSize: Number(e.target.value) })}
            style={{ width: '100%', accentColor: settings.accentColor || '#003366', cursor: 'pointer' }}
          />
          <div className="admin-surface-hint" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>12px — أصغر</span>
            <span>22px — أكبر</span>
          </div>
        </div>

        <ThemeColorPicker
          label="لون النص العام (فقرات ومحتوى)"
          value={settings.bodyTextColor || ''}
          defaultValue={DEFAULT_THEME_COLOR_FIELDS.bodyTextColor}
          onChange={v => commit({ ...settings, bodyTextColor: v })}
          allowAuto
          previewWhenAuto={(settings.themeMode || 'dark') === 'light' ? '#001F3F' : '#e7eefb'}
        />

        <ThemeColorPicker
          label="لون العناوين والعناوين الفرعية"
          value={settings.headingTextColor || ''}
          defaultValue={DEFAULT_THEME_COLOR_FIELDS.headingTextColor}
          onChange={v => commit({ ...settings, headingTextColor: v })}
          allowAuto
          previewWhenAuto={settings.accentColor || '#003366'}
        />

        <ThemeColorPicker
          label="لون النص الثانوي (الوصف والتفاصيل)"
          value={settings.mutedTextColor || ''}
          defaultValue={DEFAULT_THEME_COLOR_FIELDS.mutedTextColor}
          onChange={v => commit({ ...settings, mutedTextColor: v })}
          allowAuto
          previewWhenAuto={(settings.themeMode || 'dark') === 'light' ? '#556677' : '#9fb3cc'}
        />

        <div style={{
          marginTop: 8, padding: '12px 14px', borderRadius: 10, border: '1px solid #c5d0e0',
          background: (settings.themeMode || 'dark') === 'dark' ? '#0a1628' : '#fff',
          color: resolveBodyTextColor(settings.bodyTextColor, (settings.themeMode || 'dark') !== 'light'),
          fontFamily: `'${settings.siteFontFamily || 'Tajawal'}', sans-serif`,
          fontSize: settings.baseFontSize ?? 16,
        }}>
          <div style={{
            fontWeight: 800, fontSize: '1.15em', marginBottom: 6,
            color: resolveHeadingTextColor(settings.headingTextColor, settings.accentColor || '#003366'),
          }}>
            معاينة العنوان
          </div>
          <div style={{ marginBottom: 4 }}>هذا نص تجريبي يوضح شكل الخط والحجم على الموقع.</div>
          <div style={{
            fontSize: '0.9em',
            color: resolveMutedTextColor(settings.mutedTextColor, (settings.themeMode || 'dark') !== 'light'),
          }}>نص ثانوي — وصف أو تفاصيل إضافية</div>
        </div>
      </div>

      {/* LOGO */}
      <div className="admin-light-panel" style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}><i className="fa-solid fa-star" /> الشعار</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          {(['svg_alaa', 'text', 'image'] as const).map(type => (
            <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
              <input type="radio" name="logoType" value={type} checked={(settings.logoType || 'svg_alaa') === type}
                onChange={() => commit({ ...settings, logoType: type })} />
              {type === 'svg_alaa' ? '🖋️ شعار علاء (SVG)' : type === 'text' ? 'نص' : 'صورة'}
            </label>
          ))}
        </div>
        {(settings.logoType || 'svg_alaa') === 'svg_alaa' && (
          <div style={{ background: '#f0f4ff', border: '1px solid #c8d5f0', borderRadius: 8, padding: 10, fontSize: 12, color: '#223344', marginBottom: 8, lineHeight: 1.7 }}>
            <i className="fa-solid fa-circle-info" style={{ color: '#3355aa' }} /> يُستخدم الشعار الرسمي لـ م.علاء أحمد المصري. اللون أبيض على الخلفية المعتمة، وكحلي على الخلفية البيضاء تلقائياً.
          </div>
        )}
        {(settings.logoType || 'svg_alaa') === 'text' && (
          <div className="form-group"><label>نص الشعار ({lang.toUpperCase()})</label>
            <input type="text" value={settings.logoText[lang] || ''} onChange={e => commit({ ...settings, logoText: { ...settings.logoText, [lang]: e.target.value } })} /></div>
        )}
        {(settings.logoType || 'svg_alaa') === 'image' && (
          <div className="form-group"><label>رابط صورة الشعار</label>
            <input type="url" value={settings.logoImg} style={{ direction: 'ltr' }} placeholder="https://..." onChange={e => commit({ ...settings, logoImg: e.target.value })} /></div>
        )}
        <ThemeColorPicker
          label="تخصيص لون الشعار"
          hint="اترك «تلقائي» ليصبح أبيض ليلاً وكحلياً نهاراً."
          value={settings.logoColor || ''}
          defaultValue={DEFAULT_THEME_COLOR_FIELDS.logoColor}
          onChange={v => commit({ ...settings, logoColor: v })}
          allowAuto
          previewWhenAuto={(settings.themeMode || 'dark') === 'light' ? (settings.accentColor || '#003366') : '#ffffff'}
        />
      </div>

      {/* ABOUT HERO MEDIA — صورة / فيديو / WebM في صفحة السيرة */}
      <div className="admin-light-panel" style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}><i className="fa-solid fa-id-badge" /> صورة السيرة (الجانب الأيمن)</div>
        <div style={{ fontSize: 12, color: '#445566', marginBottom: 12, lineHeight: 1.7 }}>
          ارفع صورة أو فيديو/WebM، أو الصق رابط Google Drive. اختر «فيديو / WebM» صراحةً لروابط Drive (بدون امتداد ملف).
          الملف يجب أن يكون «أي شخص لديه الرابط». العرض على الجوال والويب بـ object-fit: cover بدون تشويه.
          فارغ → <code style={{ background: '#eef2ff', padding: '1px 6px', borderRadius: 4 }}>alaa-photo.jpg</code>
          ثم اضغط «رفع البيانات الآن».
        </div>
        {(() => {
          const hero = resolveAboutHeroMedia(settings.aboutHeroMedia, settings.aboutHeroKind || 'auto');
          const hasCustom = !!(settings.aboutHeroMedia || '').trim();
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14, alignItems: 'start' }}>
              <div style={{
                width: 140, height: 180, borderRadius: 12, overflow: 'hidden',
                border: '1px solid #cde', background: '#0a0a12', position: 'relative',
              }}>
                {hero.kind === 'video' ? (
                  <video src={hero.src} muted loop autoPlay playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
                ) : (
                  <img src={hero.src} alt="about hero"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
                )}
                <div style={{
                  position: 'absolute', bottom: 0, insetInline: 0, padding: '4px 6px',
                  background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, fontWeight: 700, textAlign: 'center',
                }}>
                  {hasCustom ? (hero.kind === 'video' ? 'فيديو / WebM' : 'صورة مخصصة') : 'افتراضي'}
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  {([
                    ['auto', 'تلقائي'],
                    ['image', 'صورة'],
                    ['video', 'فيديو / WebM'],
                  ] as const).map(([k, label]) => (
                    <button key={k} type="button"
                      onClick={() => commit({ ...settings, aboutHeroKind: k })}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        border: `1.5px solid ${(settings.aboutHeroKind || 'auto') === k ? '#003366' : '#cde'}`,
                        background: (settings.aboutHeroKind || 'auto') === k ? '#003366' : '#fff',
                        color: (settings.aboutHeroKind || 'auto') === k ? '#fff' : '#003366',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="form-group" style={{ marginBottom: 10 }}>
                  <label>رابط Google Drive أو رابط مباشر</label>
                  <input
                    type="url"
                    value={(settings.aboutHeroMedia || '').startsWith('data:') ? '' : (settings.aboutHeroMedia || '')}
                    placeholder="https://drive.google.com/file/d/.../view أو https://…/clip.webm"
                    dir="ltr"
                    style={{ width: '100%' }}
                    onChange={e => commit({ ...settings, aboutHeroMedia: e.target.value })}
                    onBlur={e => {
                      const raw = e.target.value.trim();
                      if (!raw) return;
                      const kind = settings.aboutHeroKind || 'auto';
                      const asVideo = kind === 'video' || (kind !== 'image' && isVideoMediaUrl(raw));
                      const n = asVideo ? normalizeVideoUrlForStorage(raw) : normalizeImageUrlForStorage(raw);
                      if (n && n !== raw) commit({ ...settings, aboutHeroMedia: n });
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    ref={aboutHeroFileRef}
                    type="file"
                    accept="image/*,video/webm,video/mp4,video/quicktime,.webm,.mp4"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (!f) return;
                      void (async () => {
                        const isVid = f.type.startsWith('video/') || /\.(webm|mp4|mov|m4v)$/i.test(f.name);
                        if (isVid && f.size > 12 * 1024 * 1024) {
                          alert('الملف كبير (أكثر من 12MB). يُفضَّل رفعه إلى Google Drive ولصق الرابط هنا.');
                          return;
                        }
                        let url = await uploadMediaFile(f, 'cv');
                        if (!url) {
                          if (isVid) {
                            if (!confirm('تعذّر الرفع للسيرفر. هل تحفظ الملف محلياً؟ (قد يكون كبيراً)')) return;
                            url = await readFileAsDataUrl(f);
                          } else {
                            url = await compressImageFileForStorage(f, 1200, 'image/jpeg');
                          }
                        }
                        if (!url) return;
                        commit({
                          ...settings,
                          aboutHeroMedia: url,
                          aboutHeroKind: isVid ? 'video' : (settings.aboutHeroKind === 'video' ? 'image' : settings.aboutHeroKind || 'auto'),
                        });
                      })();
                    }}
                  />
                  <button type="button" className="btn-outline-sm" onClick={() => aboutHeroFileRef.current?.click()}>
                    <i className="fa-solid fa-upload" /> رفع صورة أو WebM/فيديو
                  </button>
                  {hasCustom && (
                    <button type="button" className="btn-danger-sm" onClick={() => commit({ ...settings, aboutHeroMedia: '', aboutHeroKind: 'auto' })}>
                      <i className="fa-solid fa-rotate-left" /> إعادة للافتراضي
                    </button>
                  )}
                </div>
                {(settings.aboutHeroMedia || '').startsWith('data:') && (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#795548' }}>
                    <i className="fa-solid fa-circle-info" /> محفوظ كملف مضمّن — للملفات الكبيرة استخدم رابط Drive.
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* البطاقة الزجاجية — تحكم + معاينة ويب/جوال */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed #c8d4ee' }}>
          <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span><i className="fa-solid fa-id-card" /> البطاقة الزجاجية التعريفية</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.aboutNameBadgeVisible !== false}
                onChange={e => commit({ ...settings, aboutNameBadgeVisible: e.target.checked })}
              />
              إظهار البطاقة على الموقع
            </label>
          </div>
          <div style={{ fontSize: 12, color: '#445566', marginBottom: 10, lineHeight: 1.6 }}>
            صغّر ارتفاع الزجاج عبر الحشو العمودي دون تصغير المخطوطة.
            البعد عن الأسفل من <b>−600</b> إلى <b>+600</b> بكسل (موجب = أعلى داخل الفيديو، سالب = أسفل الفيديو).
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#003366' }}>
              حشو البطاقة العمودي (ارتفاع الزجاج): {settings.aboutNameBadgePadY ?? 6}px
              <input
                type="range" min={2} max={20} step={1}
                value={settings.aboutNameBadgePadY ?? 6}
                onChange={e => commit({ ...settings, aboutNameBadgePadY: Number(e.target.value) })}
                style={{ width: '100%', marginTop: 6 }}
                disabled={settings.aboutNameBadgeVisible === false}
              />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#003366' }}>
              البعد عن الأسفل — ويب: {settings.aboutNameBadgeBottomDesktop ?? 22}px
              <input
                type="range" min={-600} max={600} step={1}
                value={settings.aboutNameBadgeBottomDesktop ?? 22}
                onChange={e => commit({ ...settings, aboutNameBadgeBottomDesktop: Number(e.target.value) })}
                style={{ width: '100%', marginTop: 6 }}
                disabled={settings.aboutNameBadgeVisible === false}
              />
              <input
                type="number" min={-600} max={600} step={1}
                value={settings.aboutNameBadgeBottomDesktop ?? 22}
                onChange={e => commit({ ...settings, aboutNameBadgeBottomDesktop: Number(e.target.value) })}
                style={{ width: '100%', marginTop: 6, direction: 'ltr' }}
                disabled={settings.aboutNameBadgeVisible === false}
              />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#003366' }}>
              البعد عن الأسفل — جوال: {settings.aboutNameBadgeBottomMobile ?? 8}px
              <input
                type="range" min={-600} max={600} step={1}
                value={settings.aboutNameBadgeBottomMobile ?? 8}
                onChange={e => commit({ ...settings, aboutNameBadgeBottomMobile: Number(e.target.value) })}
                style={{ width: '100%', marginTop: 6 }}
                disabled={settings.aboutNameBadgeVisible === false}
              />
              <input
                type="number" min={-600} max={600} step={1}
                value={settings.aboutNameBadgeBottomMobile ?? 8}
                onChange={e => commit({ ...settings, aboutNameBadgeBottomMobile: Number(e.target.value) })}
                style={{ width: '100%', marginTop: 6, direction: 'ltr' }}
                disabled={settings.aboutNameBadgeVisible === false}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {([
              ['mobile', 'معاينة الجوال'],
              ['desktop', 'معاينة الويب'],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setBadgePreviewMode(k)}
                style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1.5px solid ${badgePreviewMode === k ? '#003366' : '#cde'}`,
                  background: badgePreviewMode === k ? '#003366' : '#fff',
                  color: badgePreviewMode === k ? '#fff' : '#003366',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {(() => {
            const hero = resolveAboutHeroMedia(settings.aboutHeroMedia, settings.aboutHeroKind || 'auto');
            const isMobilePrev = badgePreviewMode === 'mobile';
            const frameW = isMobilePrev ? 280 : '100%';
            const frameH = isMobilePrev ? 220 : 260;
            const bottom = isMobilePrev
              ? (settings.aboutNameBadgeBottomMobile ?? 8)
              : (settings.aboutNameBadgeBottomDesktop ?? 22);
            const padY = settings.aboutNameBadgePadY ?? 6;
            const showBadge = settings.aboutNameBadgeVisible !== false;
            const extraBelow = bottom < 0 ? Math.min(180, Math.abs(bottom)) : 0;
            return (
              <div style={{
                width: frameW,
                maxWidth: '100%',
                height: frameH,
                marginInline: isMobilePrev ? 'auto' : 0,
                marginBottom: extraBelow,
                borderRadius: isMobilePrev ? 16 : 12,
                overflow: 'visible',
                border: '1px solid #b8c8e8',
                background: '#080808',
                position: 'relative',
                boxShadow: '0 8px 24px rgba(0,40,80,0.12)',
              }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 'inherit', overflow: 'hidden', zIndex: 0,
                }}>
                {hero.kind === 'video' ? (
                  <video src={hero.src} muted loop autoPlay playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                ) : (
                  <img src={hero.src} alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
                )}
                <div style={{
                  position: 'absolute', inset: 0, pointerEvents: 'none',
                  background: 'linear-gradient(to top, rgba(8,8,8,0.75) 0%, transparent 55%)',
                }} />
                </div>
                {showBadge && (
                  <div style={{
                    position: 'absolute',
                    left: isMobilePrev ? 12 : 20,
                    right: isMobilePrev ? 12 : 20,
                    bottom,
                    padding: `${padY}px 12px`,
                    borderRadius: 10,
                    textAlign: 'center',
                    background: 'rgba(8,12,24,0.52)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    lineHeight: 1.2,
                  }}>
                    <HeroNameDisplay
                      name={pickML(data.name, 'ar')}
                      display={data.nameDisplay}
                      logo={data.nameLogo}
                      logoColor={data.nameLogoColor}
                      shimmer={data.nameShimmer}
                      shimmerSpeed={data.nameShimmerSpeed}
                      shimmerColor={data.nameShimmerColor}
                      shimmerAngle={data.nameShimmerAngle}
                      shimmerMotion={data.nameShimmerMotion}
                      shimmerDirection={data.nameShimmerDirection}
                      shimmerWidth={data.nameShimmerWidth}
                      className="about-dark-name hero-name"
                      as="span"
                    />
                    <span style={{ display: 'block', fontSize: 10, color: 'rgba(180,210,255,0.75)', fontWeight: 600, marginTop: 2 }}>
                      مهندس • مصمم • مطور
                    </span>
                  </div>
                )}
                <div style={{
                  position: 'absolute', top: 8, insetInline: 8,
                  fontSize: 10, fontWeight: 800, color: '#fff',
                  background: 'rgba(0,0,0,0.45)', borderRadius: 6, padding: '3px 8px',
                  width: 'fit-content',
                }}>
                  {isMobilePrev ? 'جوال' : 'ويب'}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* فيديو تعريفي — الصفحة الرئيسية */}
      <div className="admin-light-panel" style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}><i className="fa-solid fa-circle-play" /> فيديو تعريفي — الصفحة الرئيسية</div>
        <div style={{ fontSize: 12, color: '#445566', marginBottom: 12, lineHeight: 1.7 }}>
          اختياري. إن تركت الحقل فارغاً تبقى الصفحة كما هي. عند إضافة رابط يظهر الفيديو تحت التعريف وعن أزرار الأقسام الثلاثة، ويمكن الضغط عليه لملء الشاشة.
          يدعم Google Drive / رابط مباشر / YouTube.
        </div>
        <div className="form-group" style={{ marginBottom: 10 }}>
          <label>رابط الفيديو</label>
          <input
            type="url"
            value={(settings.homeIntroVideo || '').startsWith('data:') ? '' : (settings.homeIntroVideo || '')}
            placeholder="https://drive.google.com/file/d/.../view أو https://…/intro.webm"
            dir="ltr"
            style={{ width: '100%' }}
            onChange={e => commit({ ...settings, homeIntroVideo: e.target.value })}
            onBlur={e => {
              const raw = e.target.value.trim();
              if (!raw) return;
              const n = normalizeVideoUrlForStorage(raw);
              if (n && n !== raw) commit({ ...settings, homeIntroVideo: n });
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            ref={homeIntroVideoFileRef}
            type="file"
            accept="video/webm,video/mp4,video/quicktime,.webm,.mp4"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              void (async () => {
                if (f.size > 12 * 1024 * 1024) {
                  alert('الملف كبير (أكثر من 12MB). ارفعه إلى Google Drive والصق الرابط.');
                  return;
                }
                let url = await uploadMediaFile(f, 'cv');
                if (!url) {
                  if (!confirm('تعذّر الرفع للسيرفر. هل تحفظ الملف محلياً؟')) return;
                  url = await readFileAsDataUrl(f);
                }
                if (url) commit({ ...settings, homeIntroVideo: url });
              })();
            }}
          />
          <button type="button" className="btn-outline-sm" onClick={() => homeIntroVideoFileRef.current?.click()}>
            <i className="fa-solid fa-upload" /> رفع فيديو
          </button>
          {(settings.homeIntroVideo || '').trim() && (
            <button type="button" className="btn-danger-sm" onClick={() => commit({ ...settings, homeIntroVideo: '' })}>
              <i className="fa-solid fa-trash" /> إزالة الفيديو
            </button>
          )}
        </div>
        {(settings.homeIntroVideo || '').trim() && (
          <div style={{ marginTop: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid #cde', background: '#0a0a12', maxWidth: 420 }}>
            {(() => {
              const hero = resolveAboutHeroMedia(settings.homeIntroVideo, 'video');
              return (
                <video
                  src={hero.src}
                  muted
                  loop
                  autoPlay
                  playsInline
                  style={{ width: '100%', display: 'block', maxHeight: 200, objectFit: 'cover' }}
                />
              );
            })()}
          </div>
        )}
      </div>

      {/* THREE.JS ANIMATION */}
      <div className="admin-light-panel" style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}><i className="fa-solid fa-atom" /> خلفية Three.js المتحركة</div>
        <div style={{ background: '#eef4ff', border: '1px solid #c8d8f5', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#3355aa', marginBottom: 12, lineHeight: 1.8, direction: 'ltr' }}>
          <i className="fa-solid fa-circle-info" style={{ marginLeft: 4 }} />
          <b>Current CDN:</b><br />
          <code style={{ fontSize: 11, wordBreak: 'break-all', color: '#003' }}>https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js</code>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>رابط مخصص لمكتبة Three.js (اتركه فارغاً للاستخدام الافتراضي)</label>
          <input type="url" value={(settings as any).threeScriptUrl || ''} placeholder="https://cdnjs.cloudflare.com/.../three.min.js"
            style={{ direction: 'ltr', fontSize: 12 }}
            onChange={e => commit({ ...settings, threeScriptUrl: e.target.value } as any)} />
          <div style={{ fontSize: 11, color: '#889', marginTop: 4 }}>سيُستخدم في الإصدارات القادمة للتبديل بين نسخ Three.js المختلفة</div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="admin-light-panel" style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}><i className="fa-solid fa-align-center" /> الفوتر</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label>لون خلفية الفوتر</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={settings.footerBg} onChange={e => commit({ ...settings, footerBg: e.target.value })} style={{ width: 48, height: 36, borderRadius: 6, border: '1px solid #dde', cursor: 'pointer' }} />
              <input type="text" value={settings.footerBg} style={{ direction: 'ltr', flex: 1 }} onChange={e => commit({ ...settings, footerBg: e.target.value })} />
            </div>
          </div>
          <div className="form-group"><label>نص الفوتر ({lang.toUpperCase()})</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="text" style={{ flex: 1 }} value={settings.footerText[lang] || ''} onChange={e => commit({ ...settings, footerText: { ...settings.footerText, [lang]: e.target.value } })} />
              <MlObjectTranslateButton small value={settings.footerText} onChange={footerText => commit({ ...settings, footerText })} />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 8, background: settings.footerBg, color: '#fff', borderRadius: 6, padding: '8px 14px', fontSize: 12, textAlign: 'center' }}>
          {settings.footerText[lang] || '—'}
        </div>
      </div>

      {/* SOCIAL LINKS */}
      <div className="admin-light-panel" style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><i className="fa-solid fa-share-nodes" /> روابط التواصل</span>
          <button className="btn-outline-sm" onClick={() => commit({ ...settings, socialLinks: [...settings.socialLinks, newSocial()] })}>
            <i className="fa-solid fa-plus" /> إضافة
          </button>
        </div>
        {settings.socialLinks.map((link, i) => (
          <div key={link.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input type="text" value={link.icon} placeholder="fa-solid fa-phone" style={{ direction: 'ltr', padding: '5px 8px', borderRadius: 6, border: '1px solid #dde', fontSize: 12 }}
              onChange={e => commit({ ...settings, socialLinks: settings.socialLinks.map((x, j) => j === i ? { ...x, icon: e.target.value } : x) })} />
            <input type="url" value={link.url} placeholder="https://..." style={{ direction: 'ltr', padding: '5px 8px', borderRadius: 6, border: '1px solid #dde', fontSize: 12 }}
              onChange={e => commit({ ...settings, socialLinks: settings.socialLinks.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} />
            <button className="btn-danger-sm" onClick={() => commit({ ...settings, socialLinks: settings.socialLinks.filter((_, j) => j !== i) })}><i className="fa-solid fa-trash-can" /></button>
          </div>
        ))}
      </div>

      {/* NAV ITEMS */}
      <div style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><i className="fa-solid fa-bars" /> عناصر التنقل الديناميكية</span>
          <button className="btn-outline-sm" onClick={() => commit({ ...settings, navItems: [...settings.navItems, newNav()] })}>
            <i className="fa-solid fa-plus" /> إضافة
          </button>
        </div>
        {settings.navItems.map((item, i) => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px auto auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input type="text" value={item.label[lang] || ''} placeholder={`الاسم (${lang.toUpperCase()})`} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #dde', fontSize: 12 }}
              onChange={e => commit({ ...settings, navItems: settings.navItems.map((x, j) => j === i ? { ...x, label: { ...x.label, [lang]: e.target.value } } : x) })} />
            <input type="text" value={item.url} placeholder="الرابط (#agri)" style={{ direction: 'ltr', padding: '5px 8px', borderRadius: 6, border: '1px solid #dde', fontSize: 12 }}
              onChange={e => commit({ ...settings, navItems: settings.navItems.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} />
            <input type="number" value={item.order} min={1} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #dde', fontSize: 12, direction: 'ltr' }}
              onChange={e => commit({ ...settings, navItems: settings.navItems.map((x, j) => j === i ? { ...x, order: Number(e.target.value) } : x) })} />
            <MlObjectTranslateButton small value={item.label}
              onChange={label => commit({ ...settings, navItems: settings.navItems.map((x, j) => j === i ? { ...x, label } : x) })} />
            <button className="btn-danger-sm" onClick={() => commit({ ...settings, navItems: settings.navItems.filter((_, j) => j !== i) })}><i className="fa-solid fa-trash-can" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════ */
export function ContentAdmin({ mode, data, onSave, onSiteApply, onSitePersist, serverConnected, serverSyncing, onServerConnect, onServerDisconnect }: Props) {
  if (mode === 'agri') return <AgriAdmin data={data} onSave={onSave} />;
  if (mode === 'tour') return <WalkthroughAdmin data={data} onSave={onSave} />;
  if (mode === 'gfx') return <GfxAdmin data={data} onSave={onSave} />;
  if (mode === 'site') return (
    <SiteSettingsAdmin
      data={data}
      onApply={onSiteApply ?? onSave}
      onPersist={onSitePersist ?? (() => Promise.resolve(false))}
      serverConnected={serverConnected}
      serverSyncing={serverSyncing}
      onServerConnect={onServerConnect}
      onServerDisconnect={onServerDisconnect}
    />
  );
  return <LabAdmin data={data} onSave={onSave} />;
}
