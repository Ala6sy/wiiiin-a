import { useState, useRef, useEffect } from 'react';
import {
  AppData, AgriArticle, AgriBook, ArticleCategory, LibraryNode, BookKind, LibraryView, GfxCategory, GfxSubCategory, GfxProjectItem, soilRowName,
  AiVaultItem, SoftwareSnippet, SiteSettings, SocialLink, NavItem, SoilRow, ReportTemplate,
  AgriVideo, PublicReport, WebProject, BookGridSettings, DEFAULT_BOOK_GRID, driveThumb,
  WebGridSettings, DEFAULT_WEB_GRID, GfxGridSettings, DEFAULT_GFX_GRID,
  ml, pickML, flattenLibrary, LangKey, uid,
} from './appData';
import { CustomerReportsAdmin } from './CustomerReports';
import { videoEmbed } from './SoilRequest';
import { RichEditor } from './RichEditor';

/* ── AI Key Panel ── */
function AiKeyPanel({ aiEnabled, onToggle }: { aiEnabled: boolean; onToggle: (v: boolean) => void }) {
  return (
    <div>
      {/* Enable/Disable toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0f8f0', border: '1px solid #c8e6c9', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, color: '#2a7a2a' }}><i className="fa-solid fa-brain" /> وحدة التشخيص الزراعي الذكي</div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>تفعيل الوحدة يتيح للزوار رفع صور النباتات للتشخيص</div>
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
      <div style={{ background: '#f8fdf8', border: '1px solid #c8e6c9', borderRadius: 12, padding: 16, fontSize: 13, color: '#2a5c2a', lineHeight: 1.9 }}>
        <div style={{ fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fa-solid fa-server" style={{ color: '#2a7a2a' }} /> مفتاح API محفوظ داخل السيرفر
        </div>
        <div style={{ color: '#555' }}>
          الطلبات تُرسَل عبر ملف <code style={{ background: '#e8f5e9', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12 }}>ai_proxy.php</code> — المفتاح مخفي تماماً عن المتصفح.
        </div>
      </div>
    </div>
  );
}

type Mode = 'agri' | 'gfx' | 'lab' | 'site';
interface Props {
  mode: Mode;
  data: AppData;
  onSave: (u: Partial<AppData>) => void;
  serverConnected?: boolean;
  serverSyncing?: boolean;
  onServerConnect?: (username: string, password: string) => Promise<boolean>;
  onServerSync?: () => void;
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
          style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${active === key ? color : '#ccc'}`, background: active === key ? color : '#fff', color: active === key ? '#fff' : '#333', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
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
      <p style={{ fontSize: 12, color: '#666', marginBottom: 10, lineHeight: 1.7 }}>
        ابنِ شجرة المكتبة: المكتبة الرئيسية ← الفرعية (مثل «مكتبة الجامعة») ← السنة الدراسية ← الفصل ← المادة. استخدم زر <i className="fa-solid fa-plus" /> لإضافة فرع داخلي، ثم أسنِد الكتب إلى الفروع من تبويب «الكتب».
      </p>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <input value={newRoot} placeholder="اسم مكتبة رئيسية جديدة" onChange={e => setNewRoot(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRoot()}
          className="library-tree-root-input"
          style={{ flex: 1, border: '1px solid #c8e6c9', borderRadius: 8, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13 }} />
        <button className="btn-prime" onClick={addRoot}><i className="fa-solid fa-plus" /> مكتبة رئيسية</button>
      </div>
      {tree.length === 0 ? <p style={{ color: '#888', fontSize: 13 }}>لا توجد فروع بعد.</p> : renderNodes(tree)}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   AGRI ADMIN
══════════════════════════════════════════════════════ */
function AgriAdmin({ data, onSave }: { data: AppData; onSave: (u: Partial<AppData>) => void }) {
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
  const [videos, setVideos] = useState<AgriVideo[]>(data.agriVideos || []);
  const [pubReports, setPubReports] = useState<PublicReport[]>(data.publicReports || []);
  const [currency, setCurrency] = useState<string>(data.currency || '');
  const tplRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const reportThumbRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [editArticle, setEditArticle] = useState<AgriArticle | null>(null);
  const [editBook, setEditBook] = useState<AgriBook | null>(null);
  const [bookGrid, setBookGrid] = useState<BookGridSettings>({ ...DEFAULT_BOOK_GRID, ...(data.bookGridSettings || {}) });
  const [showGridSettings, setShowGridSettings] = useState(false);
  const saveBookGrid = (g: BookGridSettings) => { setBookGrid(g); onSave({ bookGridSettings: g }); };

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
  const uploadTplImg = (key: 'headerLogo' | 'engSignature' | 'engStamp' | 'paidStamp', files: FileList | null) => {
    if (!files || !files[0]) return;
    const r = new FileReader();
    r.onload = ev => saveTpl({ [key]: ev.target?.result as string });
    r.readAsDataURL(files[0]);
  };

  const emptyArticle = (): AgriArticle => ({ id: uid(), categoryId: artCats[0]?.id || '', title: ml('', '', ''), content: ml('', '', ''), images: [], reference: ml('', '', ''), date: new Date().toISOString().split('T')[0] });
  const emptyBook = (): AgriBook => ({ id: uid(), nodeId: '', title: ml('', '', ''), author: ml('', '', ''), thumbnail: '', driveUrl: '', previewUrl: '', isPaid: false, price: '', currency: '', pages: '', kind: 'both', languages: [] });

  const soilTotal = soilRows.reduce((acc, r) => acc + (parseFloat(r.price) || 0) * (1 + (parseFloat(r.tax) || 0) / 100), 0);

  return (
    <div>
      <h4 style={{ margin: '0 0 14px' }}><i className="fa-solid fa-seedling" style={{ color: '#2a7a2a' }} /> محتوى الزراعة</h4>
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
          {/* ── Article categories manager ── */}
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(100,220,100,0.25)', borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#7ee87e', marginBottom: 8 }}><i className="fa-solid fa-tags" /> تصنيفات المقالات</div>
            {artCats.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {artCats.map(c => (
                  <div key={c.id} className="art-cat-card" style={{ border: '1px solid rgba(100,220,100,0.2)', borderRadius: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6, alignItems: 'center' }}>
                      {(['ar','en','de'] as LangKey[]).map(lk => (
                        <input key={lk} value={c.name[lk] || ''} placeholder={lk === 'ar' ? 'العربية' : lk === 'en' ? 'English' : 'Deutsch'}
                          onChange={e => saveArtCats(artCats.map(x => x.id === c.id ? { ...x, name: { ...x.name, [lk]: e.target.value } } : x))}
                          style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '5px 8px', fontFamily: 'inherit', fontSize: 12, direction: lk === 'ar' ? 'rtl' : 'ltr', background: 'rgba(0,0,0,0.3)', color: '#e8f5e8' }} />
                      ))}
                      <button className="btn-danger-sm" onClick={() => confirm('حذف التصنيف؟ ستبقى مقالاته بدون تصنيف.') && saveArtCats(artCats.filter(x => x.id !== c.id))}><i className="fa-solid fa-trash-can" /></button>
                    </div>
                    <div className="art-cat-label" style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, paddingInlineStart: 2 }}>AR · EN · DE</div>
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
                  {artCats.map(c => <option key={c.id} value={c.id}>{pickML(c.name, lang) || '—'}</option>)}
                </select>
              </div>

              {/* Language tabs for content entry */}
              <div style={{ background: '#f0f7f0', border: '1px solid #c8e6c9', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#2a7a2a', marginBottom: 10 }}>
                  <i className="fa-solid fa-language" /> محتوى المقالة بحسب اللغة — اختر لغة لتعديلها
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
                {editArticle.images.map((img, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                    <input type="url" value={img} style={{ direction: 'ltr', flex: 1 }} placeholder="https://..." onChange={e => setEditArticle({ ...editArticle, images: editArticle.images.map((x, xi) => xi === i ? e.target.value : x) })} />
                    <button className="btn-danger-sm" onClick={() => setEditArticle({ ...editArticle, images: editArticle.images.filter((_, xi) => xi !== i) })}><i className="fa-solid fa-xmark" /></button>
                  </div>
                ))}
                <button className="btn-outline-sm" onClick={() => setEditArticle({ ...editArticle, images: [...editArticle.images, ''] })}><i className="fa-solid fa-plus" /> إضافة صورة</button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-prime" onClick={() => { const clean = { ...editArticle, images: editArticle.images.map(s => s.trim()).filter(Boolean) }; const idx = articles.findIndex(a => a.id === clean.id); saveArticles(idx >= 0 ? articles.map((a, i) => i === idx ? clean : a) : [...articles, clean]); setEditArticle(null); }}>
                  <i className="fa-solid fa-floppy-disk" /> حفظ
                </button>
                <button className="btn-cancel" onClick={() => setEditArticle(null)}>إلغاء</button>
              </div>
            </div>
          ) : (
            <>
              <button className="btn-prime" style={{ marginBottom: 14 }} onClick={() => setEditArticle(emptyArticle())}><i className="fa-solid fa-plus" /> إضافة مقالة</button>
              {articles.length === 0 ? <p style={{ color: '#888', fontSize: 13 }}>لا توجد مقالات بعد.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {articles.map(a => {
                    const cat = artCats.find(c => c.id === a.categoryId);
                    return (
                    <div key={a.id} style={{ background: '#f5fbf5', border: '1px solid #c8e6c9', borderRadius: 10, padding: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      {a.images[0] && <img src={a.images[0]} alt="" style={{ width: 70, height: 60, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>{pickML(a.title, lang)}</div>
                        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{a.date}{cat ? ` — ${pickML(cat.name, lang)}` : ' — بدون تصنيف'}{a.images.length > 1 ? ` — ${a.images.length} صور` : ''}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
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
                <div style={{ fontSize: 11, color: '#777', marginTop: 3 }}>يفتح الزائر الفروع بالنقر — مناسب للمكتبات الكبيرة.</div>
              </button>
              <button onClick={() => saveLibView('expanded')}
                style={{ flex: '1 1 200px', textAlign: 'start', cursor: 'pointer', borderRadius: 8, padding: '10px 12px', border: libView === 'expanded' ? '2px solid #2a7a2a' : '1px solid #cfe3cf', background: libView === 'expanded' ? '#eaf7ea' : '#fff', fontFamily: 'inherit' }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}><i className="fa-solid fa-table-cells-large" /> عرض كامل موسّع</div>
                <div style={{ fontSize: 11, color: '#777', marginTop: 3 }}>كل الكتب ظاهرة، الفصول جنباً إلى جنب تحت كل سنة.</div>
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
                <button className="btn-cancel" onClick={() => setEditBook(null)}>✕</button>
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
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input type="url" value={editBook.thumbnail} style={{ direction: 'ltr', flex: 1 }} placeholder="https://... أو رابط Google Drive مشاركة"
                      onChange={e => setEditBook({ ...editBook, thumbnail: e.target.value })} />
                    {editBook.thumbnail && editBook.thumbnail.includes('drive.google.com') && !editBook.thumbnail.includes('thumbnail?id') && (
                      <button type="button" title="تحويل رابط Drive لصورة مباشرة"
                        onClick={() => setEditBook({ ...editBook, thumbnail: driveThumb(editBook.thumbnail) })}
                        style={{ background: '#4285f4', color: '#fff', border: 'none', borderRadius: 8, padding: '0 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <i className="fa-brands fa-google-drive" /> تحويل
                      </button>
                    )}
                  </div>
                  {editBook.thumbnail && editBook.thumbnail.includes('thumbnail?id') && (
                    <div style={{ fontSize: 11, color: '#2a7a2a', marginTop: 4 }}>✓ تم تحويل رابط Drive بنجاح</div>
                  )}
                  {editBook.thumbnail && (
                    <img src={editBook.thumbnail} alt="" style={{ marginTop: 8, width: 80, height: 100, objectFit: 'cover', borderRadius: 6, border: '1px solid #ccc' }} onError={e => (e.currentTarget.style.display = 'none')} />
                  )}
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
                <div style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>اتركه فارغاً لإظهاره في جميع اللغات. حدّد لغات معينة لتقييد الظهور.</div>
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
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>📱 عدد الكتب في السطر (جوال)</label>
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
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>🖥️ عدد الكتب في السطر (ويب)</label>
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
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>↔️ المسافة بين الكتب: <span style={{ color: '#2a7a2a' }}>{bookGrid.gap}px</span></label>
                      <input type="range" min={2} max={32} value={bookGrid.gap}
                        onChange={e => saveBookGrid({ ...bookGrid, gap: Number(e.target.value) })}
                        style={{ width: '100%', accentColor: '#2a7a2a' }} />
                    </div>
                    {/* Padding Mobile */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>📐 هامش الجانبين (جوال): <span style={{ color: '#2a7a2a' }}>{bookGrid.paddingMobile}px</span></label>
                      <input type="range" min={0} max={24} value={bookGrid.paddingMobile}
                        onChange={e => saveBookGrid({ ...bookGrid, paddingMobile: Number(e.target.value) })}
                        style={{ width: '100%', accentColor: '#2a7a2a' }} />
                    </div>
                    {/* Image Height */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>🖼️ ارتفاع صورة الغلاف: <span style={{ color: '#2a7a2a' }}>{bookGrid.imgHeight}px</span></label>
                      <input type="range" min={50} max={300} value={bookGrid.imgHeight}
                        onChange={e => saveBookGrid({ ...bookGrid, imgHeight: Number(e.target.value) })}
                        style={{ width: '100%', accentColor: '#2a7a2a' }} />
                    </div>
                    {/* Card Width */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>📏 عرض الكتاب: <span style={{ color: '#2a7a2a' }}>{bookGrid.cardWidth ?? 130}px</span></label>
                      <input type="range" min={60} max={280} value={bookGrid.cardWidth ?? 130}
                        onChange={e => saveBookGrid({ ...bookGrid, cardWidth: Number(e.target.value) })}
                        style={{ width: '100%', accentColor: '#2a7a2a' }} />
                    </div>
                  </div>

                  {/* Live Preview */}
                  <div style={{ background: '#fff', border: '1px dashed #a5d6a7', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#2a7a2a', marginBottom: 8 }}><i className="fa-solid fa-eye" /> معاينة التصميم</div>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bookGrid.colsDesktop}, 1fr)`, gap: bookGrid.gap }}>
                      {(books.length > 0 ? books.slice(0, bookGrid.colsDesktop) : Array.from({ length: bookGrid.colsDesktop }, (_, i) => ({ id: String(i), title: { ar: `كتاب ${i+1}`, en: '', de: '' }, author: { ar: 'المؤلف', en: '', de: '' }, thumbnail: '', pages: '200', kind: 'both' as BookKind, isPaid: i===0, price: i===0 ? '500' : '', currency: 'SYP', driveUrl: '', nodeId: '', languages: [] }))).map((b, i) => (
                        <div key={b.id || i} style={{ background: '#f5fbf5', border: '1px solid #c8e6c9', borderRadius: 8, overflow: 'hidden', fontSize: 11 }}>
                          {b.thumbnail
                            ? <img src={b.thumbnail} alt="" style={{ width: '100%', height: bookGrid.imgHeight, objectFit: 'cover', display: 'block' }} />
                            : <div style={{ width: '100%', height: bookGrid.imgHeight, background: 'linear-gradient(135deg,#c8e6c9,#a5d6a7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(20, bookGrid.imgHeight * 0.22) }}>📚</div>}
                          <div style={{ padding: '5px 6px' }}>
                            <div style={{ fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pickML(b.title, lang)}</div>
                            <div style={{ fontSize: 10, color: '#888' }}>{pickML(b.author, lang)}</div>
                            {b.isPaid && b.price && <div style={{ fontSize: 10, color: '#f0a030', fontWeight: 700, marginTop: 2 }}>{b.price} {b.currency}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: '#999', marginTop: 6, textAlign: 'center' }}>↑ هذه معاينة — التصميم الفعلي للموقع أجمل</div>
                  </div>
                </div>
              )}

              {books.length === 0 ? <p style={{ color: '#888', fontSize: 13 }}>لا توجد كتب بعد.</p> : (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${bookGrid.colsDesktop}, 1fr)`, gap: bookGrid.gap }}>
                  {books.map(b => (
                    <div key={b.id} style={{ background: '#f5fbf5', border: '1px solid #c8e6c9', borderRadius: 10, overflow: 'hidden' }}>
                      {b.thumbnail ? <img src={b.thumbnail} alt="" style={{ width: '100%', height: bookGrid.imgHeight, objectFit: 'cover', display: 'block' }} /> : <div style={{ width: '100%', height: bookGrid.imgHeight, background: '#c8e6c9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>📚</div>}
                      <div style={{ padding: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{pickML(b.title, lang)}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>{pickML(b.author, lang)}</div>
                        <div style={{ fontSize: 10, color: '#2a7a2a', marginTop: 2 }}>{kindLabel(b.kind)}{b.pages ? ` • ${b.pages} ص` : ''}</div>
                        {b.isPaid && b.price && <div style={{ fontSize: 11, color: '#f0a030', fontWeight: 700, marginTop: 2 }}>💰 {b.price} {b.currency}</div>}
                        <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{pathOf(b.nodeId) || 'بدون تصنيف'}</div>
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
          <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>الصق رابط الفيديو (يوتيوب / جوجل درايف / فيميو / رابط مباشر). يظهر في أعلى تبويب "تحليل التربة والنبات". لا يتم تخزين الفيديو على الموقع — فقط الرابط.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
            {videos.map(v => (
              <div key={v.id} style={{ border: '1px solid #c8e6c9', borderRadius: 10, padding: 12, background: '#f8fdf8' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <input placeholder={`عنوان الفيديو (${lang.toUpperCase()})`} value={v.title[lang] || ''}
                    onChange={e => saveVideos(videos.map(x => x.id === v.id ? { ...x, title: { ...x.title, [lang]: e.target.value } } : x))}
                    style={{ padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }} />
                  <input placeholder="رابط الفيديو" value={v.url} style={{ direction: 'ltr', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }}
                    onChange={e => saveVideos(videos.map(x => x.id === v.id ? { ...x, url: e.target.value } : x))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: v.visible ? '#2a7a2a' : '#999', cursor: 'pointer' }}>
                    <input type="checkbox" checked={v.visible} onChange={e => saveVideos(videos.map(x => x.id === v.id ? { ...x, visible: e.target.checked } : x))} />
                    {v.visible ? 'ظاهر للزوار' : 'مخفي'}
                  </label>
                  {videoEmbed(v.url) ? <span style={{ fontSize: 11.5, color: '#2a7a2a' }}><i className="fa-solid fa-circle-check" /> رابط صالح</span>
                    : v.url ? <span style={{ fontSize: 11.5, color: '#c0392b' }}><i className="fa-solid fa-triangle-exclamation" /> تحقق من الرابط</span> : null}
                  <button className="btn-danger-sm" style={{ marginInlineStart: 'auto' }} onClick={() => saveVideos(videos.filter(x => x.id !== v.id))}><i className="fa-solid fa-trash-can" /></button>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-outline-sm" onClick={() => saveVideos([...videos, { id: uid(), title: ml('', '', ''), url: '', visible: true }])}><i className="fa-solid fa-plus" /> إضافة فيديو</button>

          {/* ── Public client reports ── */}
          <h4 style={{ margin: '26px 0 6px' }}><i className="fa-solid fa-folder-open" style={{ color: '#2a7a2a' }} /> تقارير العملاء (المعروضة للزوار)</h4>
          <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>ارفع صورة مصغرة للتقرير وضع رابطه (جوجل درايف أو أي موقع). تظهر كصور صغيرة أسفل تبويب "تحليل التربة والنبات"، ويمكنك إظهار أو إخفاء كل تقرير.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12, marginBottom: 12 }}>
            {pubReports.map(r => (
              <div key={r.id} style={{ border: '1px solid #c8e6c9', borderRadius: 10, padding: 12, background: '#f8fdf8' }}>
                <div onClick={() => reportThumbRefs.current[r.id]?.click()} style={{ cursor: 'pointer', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed #bbb', borderRadius: 8, background: '#fff', marginBottom: 8, overflow: 'hidden' }}>
                  {r.thumbnail ? <img src={r.thumbnail} alt="" style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain' }} /> : <span style={{ color: '#aaa', fontSize: 12 }}><i className="fa-solid fa-upload" /> صورة مصغرة</span>}
                </div>
                <input ref={el => { reportThumbRefs.current[r.id] = el; }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { uploadReportThumb(r.id, e.target.files); e.target.value = ''; }} />
                <input placeholder={`عنوان التقرير (${lang.toUpperCase()})`} value={r.title[lang] || ''}
                  onChange={e => savePubReports(pubReports.map(x => x.id === r.id ? { ...x, title: { ...x.title, [lang]: e.target.value } } : x))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 12.5, marginBottom: 6 }} />
                <input placeholder="رابط التقرير" value={r.url} style={{ width: '100%', boxSizing: 'border-box', direction: 'ltr', padding: '7px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 12.5, marginBottom: 8 }}
                  onChange={e => savePubReports(pubReports.map(x => x.id === r.id ? { ...x, url: e.target.value } : x))} />
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
            <span style={{ fontSize: 11.5, color: '#888' }}>تظهر بجانب الأسعار في تقارير العملاء.</span>
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
                        <input value={nameML[lang] || ''} placeholder={`الاسم (${lang.toUpperCase()})`}
                          onChange={e => saveSoil(soilRows.map((r, j) => j === i ? { ...r, name: { ...nameML, [lang]: e.target.value } } : r))}
                          style={{ border: 'none', background: 'transparent', width: '100%', fontFamily: 'inherit', fontSize: 12 }} />
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
          <p style={{ fontSize: 12, color: '#888', marginTop: 10 }}><i className="fa-solid fa-circle-info" /> يظهر هذا الجدول في تقرير الـ PDF فقط عند إدخال بيانات. إذا تُرك فارغاً يُخفى تلقائياً من التقرير.</p>
        </div>
      )}

      {tab === 'template' && (
        <div>
          <h4 style={{ margin: '0 0 6px' }}><i className="fa-solid fa-file-invoice" style={{ color: '#7ee87e' }} /> إعدادات قالب التقرير</h4>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>تتحكم هذه الإعدادات بشكل تقرير الـ PDF (الألوان، الشعار، الهوامش، النصوص، التوقيع والختم).</p>

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
                  <input type="color" value={(tpl as Record<string,string>)[key]} onChange={e => saveTpl({ [key]: e.target.value } as Partial<import('./appData').ReportTemplate>)} style={{ width: 40, height: 30, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, cursor: 'pointer', background: 'transparent', padding: 2, flexShrink: 0 }} />
                  <input value={(tpl as Record<string,string>)[key]} onChange={e => saveTpl({ [key]: e.target.value } as Partial<import('./appData').ReportTemplate>)} style={{ flex: 1, padding: '5px 8px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, direction: 'ltr', fontSize: 11, fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', color: '#e8f5e8', minWidth: 0 }} />
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
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#7ee87e', direction: 'ltr' }}>{(tpl as Record<string,number>)[key]} mm</span>
                  </div>
                  <input type="range" min={min} max={max} value={(tpl as Record<string,number>)[key]}
                    onChange={e => saveTpl({ [key]: parseInt(e.target.value) } as Partial<import('./appData').ReportTemplate>)}
                    style={{ width: '100%', accentColor: '#2a7a2a', cursor: 'pointer' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.3)', direction: 'ltr' }}>
                    <span>{min}</span><span>{max}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* image uploads */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 14 }}>
            {([
              ['headerLogo', 'شعار رأس التقرير', 'fa-image'],
              ['engSignature', 'توقيع المهندس', 'fa-signature'],
              ['engStamp', 'ختم المهندس', 'fa-stamp'],
              ['paidStamp', 'ختم الدفع (مدفوع)', 'fa-circle-check'],
            ] as const).map(([key, label, icon]) => (
              <div key={key} style={{ border: '1px solid rgba(100,220,100,0.2)', borderRadius: 10, padding: 12, textAlign: 'center', background: 'rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#7ee87e', marginBottom: 8 }}><i className={`fa-solid ${icon}`} /> {label}</div>
                <div onClick={() => tplRefs.current[key]?.click()} style={{ cursor: 'pointer', minHeight: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255,255,255,0.2)', borderRadius: 8, background: 'rgba(0,0,0,0.2)', marginBottom: 8 }}>
                  {tpl[key] ? <img src={tpl[key]} alt="" style={{ maxWidth: '100%', maxHeight: 90, objectFit: 'contain' }} /> : <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}><i className="fa-solid fa-upload" /> رفع صورة</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button className="btn-outline-sm" onClick={() => tplRefs.current[key]?.click()}><i className="fa-solid fa-image" /> رفع</button>
                  {tpl[key] && <button className="btn-danger-sm" onClick={() => saveTpl({ [key]: '' })}><i className="fa-solid fa-trash-can" /></button>}
                </div>
                <input ref={el => { tplRefs.current[key] = el; }} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { uploadTplImg(key, e.target.files); e.target.value = ''; }} />
              </div>
            ))}
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
                        ? <img src={tpl.headerLogo} alt="" style={{ height: 58, objectFit: 'contain' }} />
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
                      <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>التاريخ: {new Date().toLocaleDateString('en-GB')}</div>
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
                    <div style={{ fontSize: 11, color: '#666', maxWidth: '46%', lineHeight: 1.7 }}>
                      {tpl.footerText[lang] || <span style={{ color: '#bbb', fontStyle: 'italic' }}>نص التذييل…</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
                      <div style={{ textAlign: 'center', minWidth: 120 }}>
                        {tpl.engSignature
                          ? <img src={tpl.engSignature} alt="" style={{ maxHeight: 56, maxWidth: 130, objectFit: 'contain' }} />
                          : <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <div style={{ width: 110, borderBottom: `1px dashed ${tpl.themeColor}` }} />
                            </div>}
                        <div style={{ borderTop: '1px solid #999', marginTop: 4, paddingTop: 5, fontSize: 11, fontWeight: 700, color: '#444' }}>توقيع المهندس</div>
                      </div>
                      {tpl.engStamp && (
                        <div>
                          <img src={tpl.engStamp} alt="" style={{ maxHeight: 72, maxWidth: 110, objectFit: 'contain' }} />
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
function GfxAdmin({ data, onSave }: { data: AppData; onSave: (u: Partial<AppData>) => void }) {
  const [lang, setLang] = useState<LangKey>('ar');
  const [cats, setCats] = useState<GfxCategory[]>(data.gfxCategories || []);
  const [aiVault, setAiVault] = useState<AiVaultItem[]>(data.aiVault || []);
  const [watermarkImg, setWatermarkImg] = useState(data.watermarkImg || '');
  const [watermarkOpacity, setWatermarkOpacity] = useState(data.watermarkOpacity ?? 0.15);
  const [selCatId, setSelCatId] = useState(cats[0]?.id || '');
  const [selSubId, setSelSubId] = useState(cats[0]?.subCategories[0]?.id || '');
  const [tab, setTab] = useState('categories');
  const [editItem, setEditItem] = useState<GfxProjectItem | null>(null);
  const wmRef = useRef<HTMLInputElement>(null);
  const [gfxGrid, setGfxGrid] = useState<GfxGridSettings>({ ...DEFAULT_GFX_GRID, ...(data.gfxGridSettings || {}) });
  const saveGfxGrid = (g: GfxGridSettings) => { setGfxGrid(g); onSave({ gfxGridSettings: g }); };

  const selCat = cats.find(c => c.id === selCatId);
  const selSub = selCat?.subCategories.find(s => s.id === selSubId);

  const commitCats = (next: GfxCategory[]) => { setCats(next); onSave({ gfxCategories: next }); };
  const commitVault = (next: AiVaultItem[]) => { setAiVault(next); onSave({ aiVault: next }); };
  const commitWm = (img: string, op: number) => { onSave({ watermarkImg: img, watermarkOpacity: op }); };

  const mutCat = (catId: string, fn: (c: GfxCategory) => GfxCategory) => commitCats(cats.map(c => c.id === catId ? fn(c) : c));
  const mutSub = (catId: string, subId: string, fn: (s: GfxSubCategory) => GfxSubCategory) => mutCat(catId, c => ({ ...c, subCategories: c.subCategories.map(s => s.id === subId ? fn(s) : s) }));

  const newProject = (): GfxProjectItem => ({ id: uid(), title: ml('', '', ''), desc: ml('', '', ''), mainImg: '', images: [], videoUrl: '', usedSkillsIds: [], cvSettings: { isFeatured: false, imgSize: 100, showDesc: true, showTools: true } });

  return (
    <div>
      <h4 style={{ margin: '0 0 14px' }}><i className="fa-solid fa-bezier-curve" style={{ color: '#003366' }} /> معرض التصاميم</h4>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <TabBar tabs={[['categories','🗂 التصنيفات'],['grid','⚙️ إعدادات العرض'],['pending','⏳ ترجمات معلقة'],['watermark','🔒 العلامة المائية']]} active={tab} color="#003366" onChange={setTab} />
        <div style={{ display: 'flex', gap: 4 }}>
          {LANGS.map(l => <button key={l.code} onClick={() => setLang(l.code)} style={{ padding: '4px 8px', borderRadius: 12, border: `1px solid ${lang === l.code ? '#003366' : '#ccc'}`, background: lang === l.code ? '#003366' : '#fff', color: lang === l.code ? '#fff' : '#555', fontSize: 11, cursor: 'pointer' }}>{l.flag}</button>)}
        </div>
      </div>

      {tab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: '170px 170px 1fr', gap: 10 }}>
          {/* LEVEL 1 */}
          <div style={{ background: '#f0f4ff', borderRadius: 10, padding: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#003366', marginBottom: 6, padding: '0 0 6px', borderBottom: '1px solid #cde' }}>تصنيفات</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {cats.map(c => (
                <button key={c.id} onClick={() => { setSelCatId(c.id); setSelSubId(c.subCategories[0]?.id || ''); setEditItem(null); }}
                  style={{ padding: '5px 8px', borderRadius: 7, border: `1px solid ${selCatId === c.id ? '#003366' : '#cde'}`, background: selCatId === c.id ? '#003366' : '#fff', color: selCatId === c.id ? '#fff' : '#333', fontSize: 11, cursor: 'pointer', textAlign: 'right' }}>
                  <i className={`fa-solid ${c.icon || 'fa-folder'}`} style={{ marginInlineEnd: 4 }} />{pickML(c.name, lang) || '—'}
                </button>
              ))}
            </div>
            <button className="btn-outline-sm" style={{ width: '100%', fontSize: 11 }}
              onClick={() => { const nc: GfxCategory = { id: uid(), name: ml('جديد', 'New', 'Neu'), icon: 'fa-folder', subCategories: [] }; commitCats([...cats, nc]); setSelCatId(nc.id); }}>
              <i className="fa-solid fa-plus" /> إضافة
            </button>
            {selCat && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input type="text" value={pickML(selCat.name, lang)} placeholder="الاسم"
                  onChange={e => mutCat(selCatId, c => ({ ...c, name: { ...c.name, [lang]: e.target.value } }))}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cde', fontSize: 11, width: '100%' }} />
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
          <div style={{ background: '#f5f0ff', borderRadius: 10, padding: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#6a0dad', marginBottom: 6, padding: '0 0 6px', borderBottom: '1px solid #dce' }}>فرعية</div>
            {selCat ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                  {selCat.subCategories.map(s => (
                    <button key={s.id} onClick={() => { setSelSubId(s.id); setEditItem(null); }}
                      style={{ padding: '5px 8px', borderRadius: 7, border: `1px solid ${selSubId === s.id ? '#6a0dad' : '#dce'}`, background: selSubId === s.id ? '#6a0dad' : '#fff', color: selSubId === s.id ? '#fff' : '#333', fontSize: 11, cursor: 'pointer', textAlign: 'right' }}>
                      {pickML(s.name, lang) || '—'} ({s.items.length})
                    </button>
                  ))}
                </div>
                <button className="btn-outline-sm" style={{ width: '100%', fontSize: 11 }}
                  onClick={() => { const ns: GfxSubCategory = { id: uid(), name: ml('فرعي', 'Sub', 'Sub'), items: [] }; mutCat(selCatId, c => ({ ...c, subCategories: [...c.subCategories, ns] })); setSelSubId(ns.id); }}>
                  <i className="fa-solid fa-plus" /> إضافة
                </button>
                {selSub && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input type="text" value={pickML(selSub.name, lang)} placeholder="اسم الفرعي"
                      onChange={e => mutSub(selCatId, selSubId, s => ({ ...s, name: { ...s.name, [lang]: e.target.value } }))}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #dce', fontSize: 11, width: '100%' }} />
                    <button className="btn-danger-sm" style={{ fontSize: 11 }}
                      onClick={() => { if (!confirm('حذف؟')) return; mutCat(selCatId, c => ({ ...c, subCategories: c.subCategories.filter(s => s.id !== selSubId) })); setSelSubId(''); }}>
                      <i className="fa-solid fa-trash-can" /> حذف
                    </button>
                  </div>
                )}
              </>
            ) : <p style={{ fontSize: 11, color: '#888' }}>اختر تصنيفاً</p>}
          </div>

          {/* LEVEL 3 */}
          <div style={{ background: '#fffaf0', borderRadius: 10, padding: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: '#b8860b', marginBottom: 6, padding: '0 0 6px', borderBottom: '1px solid #ede', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>مشاريع</span>
              {selSub && <button className="btn-outline-sm" style={{ fontSize: 11 }} onClick={() => { const np = newProject(); mutSub(selCatId, selSubId, s => ({ ...s, items: [...s.items, np] })); setEditItem(np); }}><i className="fa-solid fa-plus" /></button>}
            </div>
            {selSub ? (
              editItem ? (
                <div style={{ overflowY: 'auto', maxHeight: '60vh' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <strong style={{ fontSize: 12, color: '#003366' }}>✏️ تعديل مشروع</strong>
                    <button className="btn-cancel btn-sm" style={{ fontSize: 11 }} onClick={() => setEditItem(null)}>✕</button>
                  </div>

                  {/* ── Language inputs side-by-side ── */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>العنوان — بالثلاث لغات</label>
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
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>الوصف — بالثلاث لغات</label>
                    {LANGS.map(l => (
                      <div key={l.code} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                          <span style={{ fontSize: 14 }}>{l.flag}</span>
                          <span style={{ fontSize: 10, color: '#888' }}>{l.label}</span>
                          {editItem.desc[l.code] ? <i className="fa-solid fa-circle-check" style={{ color: '#4caf50', fontSize: 10 }} /> : <i className="fa-solid fa-circle-exclamation" style={{ color: '#e0a040', fontSize: 10 }} />}
                        </div>
                        <textarea rows={2} value={editItem.desc[l.code] || ''} placeholder={`${l.label}...`}
                          style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: `1px solid ${editItem.desc[l.code] ? '#a0c0e0' : '#dde'}`, fontSize: 11, direction: l.code === 'ar' ? 'rtl' : 'ltr', resize: 'vertical', background: editItem.desc[l.code] ? '#f0f6ff' : '#fff', color: '#333', fontFamily: 'inherit' }}
                          onChange={e => setEditItem({ ...editItem, desc: { ...editItem.desc, [l.code]: e.target.value } })} />
                      </div>
                    ))}
                  </div>

                  {/* Main image */}
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>🖼 الصورة الرئيسية</label>
                    <input type="url" value={editItem.mainImg} placeholder="https://..." style={{ direction: 'ltr', fontSize: 11, color: '#003366', background: '#f8faff' }} onChange={e => setEditItem({ ...editItem, mainImg: e.target.value })} />
                    {editItem.mainImg && <img src={editItem.mainImg} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, marginTop: 4 }} />}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, marginTop: 5, cursor: 'pointer', color: editItem.mainImgNoWm ? '#cc4444' : '#555' }}>
                      <input type="checkbox" checked={!!editItem.mainImgNoWm} onChange={e => setEditItem({ ...editItem, mainImgNoWm: e.target.checked })} />
                      {editItem.mainImgNoWm ? '🚫 بدون علامة مائية على هذه الصورة' : '🔒 تطبيق العلامة المائية'}
                    </label>
                  </div>

                  {/* Individual image URL fields */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>📸 صور إضافية</label>
                      <button className="btn-outline-sm" style={{ fontSize: 10 }} onClick={() => setEditItem({ ...editItem, images: [...editItem.images, ''], imagesNoWm: [...(editItem.imagesNoWm || []), false] })}>
                        <i className="fa-solid fa-plus" /> إضافة صورة
                      </button>
                    </div>
                    {editItem.images.length === 0 && <p style={{ fontSize: 10, color: '#aaa', margin: 0 }}>لا صور إضافية. اضغط + للإضافة.</p>}
                    {editItem.images.map((img, idx) => {
                      const noWm = !!(editItem.imagesNoWm?.[idx]);
                      return (
                        <div key={idx} style={{ marginBottom: 6, background: '#f8faff', borderRadius: 7, padding: '5px 7px', border: '1px solid #dde' }}>
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 3 }}>
                            <span style={{ fontSize: 10, color: '#888', flexShrink: 0, minWidth: 16 }}>{idx + 1}</span>
                            <input type="url" value={img} placeholder="https://..." style={{ flex: 1, padding: '4px 7px', borderRadius: 6, border: `1px solid ${img ? '#a0c0e0' : '#dde'}`, fontSize: 10, direction: 'ltr', color: '#003366', background: img ? '#f0f6ff' : '#fff' }}
                              onChange={e => { const imgs = [...editItem.images]; imgs[idx] = e.target.value; setEditItem({ ...editItem, images: imgs }); }} />
                            <button onClick={() => {
                              const imgs = editItem.images.filter((_, i) => i !== idx);
                              const noWms = (editItem.imagesNoWm || []).filter((_, i) => i !== idx);
                              setEditItem({ ...editItem, images: imgs, imagesNoWm: noWms });
                            }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#cc4444', fontSize: 13, flexShrink: 0, padding: '0 2px' }}>
                              <i className="fa-solid fa-xmark" />
                            </button>
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, cursor: 'pointer', color: noWm ? '#cc4444' : '#888' }}>
                            <input type="checkbox" checked={noWm} onChange={e => {
                              const noWms = [...(editItem.imagesNoWm || editItem.images.map(() => false))];
                              noWms[idx] = e.target.checked;
                              setEditItem({ ...editItem, imagesNoWm: noWms });
                            }} />
                            {noWm ? '🚫 بدون علامة مائية' : '🔒 تطبيق العلامة المائية'}
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  {/* Video URL */}
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>🎬 رابط فيديو YouTube (اختياري)</label>
                    <input type="url" value={editItem.videoUrl} placeholder="https://youtube.com/watch?v=..." style={{ direction: 'ltr', fontSize: 11, color: '#003366', background: '#f8faff' }} onChange={e => setEditItem({ ...editItem, videoUrl: e.target.value })} />
                  </div>

                  {/* GLB 3D model */}
                  <div style={{ marginBottom: 10, background: '#f0f7ff', borderRadius: 10, padding: '10px 12px', border: '1px solid #c8dff5' }}>
                    <div style={{ fontWeight: 700, fontSize: 11, color: '#003366', marginBottom: 8 }}>📦 ملف ثلاثي الأبعاد GLB (اختياري)</div>
                    <div className="form-group" style={{ marginBottom: 6 }}>
                      <label style={{ fontSize: 10, color: '#555' }}>رابط ملف GLB أو معرض العرض</label>
                      <input type="url" value={editItem.glbUrl || ''} placeholder="https://..." style={{ direction: 'ltr', fontSize: 11, color: '#003366', background: '#fff' }}
                        onChange={e => setEditItem({ ...editItem, glbUrl: e.target.value })} />
                    </div>
                    {editItem.glbUrl && (
                      <>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 8, cursor: 'pointer', fontWeight: 600 }}>
                          <input type="checkbox" checked={!!editItem.glbIsPaid} onChange={e => setEditItem({ ...editItem, glbIsPaid: e.target.checked })} />
                          {editItem.glbIsPaid ? '💰 مدفوع' : '🎁 مجاني (تنزيل مباشر)'}
                        </label>
                        {editItem.glbIsPaid ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <input type="text" value={editItem.glbPrice || ''} placeholder="السعر" style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #c8dff5', fontSize: 11 }}
                              onChange={e => setEditItem({ ...editItem, glbPrice: e.target.value })} />
                            <select value={editItem.glbCurrency || 'USD'} onChange={e => setEditItem({ ...editItem, glbCurrency: e.target.value })}
                              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #c8dff5', fontSize: 11 }}>
                              {['USD','EUR','SYP','SAR','AED','EGP','IQD','JOD','TRY','GBP'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        ) : (
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 10, color: '#555' }}>رابط التنزيل المباشر للملف</label>
                            <input type="url" value={editItem.glbFreeUrl || ''} placeholder="https://..." style={{ direction: 'ltr', fontSize: 11, color: '#003366', background: '#fff' }}
                              onChange={e => setEditItem({ ...editItem, glbFreeUrl: e.target.value })} />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 10, cursor: 'pointer' }}>
                    <input type="checkbox" checked={editItem.cvSettings.isFeatured} onChange={e => setEditItem({ ...editItem, cvSettings: { ...editItem.cvSettings, isFeatured: e.target.checked } })} />
                    ★ مميز في السيرة الذاتية
                  </label>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn-prime btn-sm" style={{ fontSize: 11 }}
                      onClick={() => { mutSub(selCatId, selSubId, s => ({ ...s, items: s.items.map(it => it.id === editItem.id ? editItem : it) })); setEditItem(null); }}>
                      <i className="fa-solid fa-floppy-disk" /> حفظ
                    </button>
                    <button className="btn-danger-sm" style={{ fontSize: 11 }}
                      onClick={() => { if (!confirm('حذف؟')) return; mutSub(selCatId, selSubId, s => ({ ...s, items: s.items.filter(x => x.id !== editItem.id) })); setEditItem(null); }}>
                      <i className="fa-solid fa-trash-can" />
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {selSub.items.map(item => {
                    const missingLangs = LANGS.filter(l => !item.title[l.code] || !item.desc[l.code]);
                    return (
                      <button key={item.id} onClick={() => setEditItem(item)}
                        style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fff', border: '1px solid #ede', borderRadius: 7, padding: '5px 8px', cursor: 'pointer', textAlign: 'right' }}>
                        {item.mainImg ? <img src={item.mainImg} alt="" style={{ width: 40, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} /> : <div style={{ width: 40, height: 36, background: '#eee', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-image" style={{ fontSize: 12 }} /></div>}
                        <div style={{ flex: 1, minWidth: 0, fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pickML(item.title, lang) || '—'}</div>
                        {missingLangs.length > 0 && <span style={{ fontSize: 9, background: '#ff9800', color: '#fff', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>⚠ {missingLangs.map(l => l.code.toUpperCase()).join('/')}</span>}
                        {item.cvSettings.isFeatured && <span style={{ fontSize: 9, background: '#003366', color: '#fff', borderRadius: 4, padding: '1px 4px', flexShrink: 0 }}>★</span>}
                      </button>
                    );
                  })}
                  {selSub.items.length === 0 && <p style={{ color: '#888', fontSize: 11 }}>لا مشاريع بعد</p>}
                </div>
              )
            ) : <p style={{ fontSize: 11, color: '#888' }}>اختر فرعياً</p>}
          </div>
        </div>
      )}

      {tab === 'grid' && (
        <div style={{ background: '#f0f4ff', border: '1px solid #aac4ee', borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#003366', marginBottom: 16 }}><i className="fa-solid fa-sliders" /> ضبط شبكة معرض التصاميم</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Cols Mobile */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>📱 عدد البطاقات في السطر (جوال)</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[1,2,3,4].map(n => (
                  <button key={n} onClick={() => saveGfxGrid({ ...gfxGrid, colsMobile: n })}
                    style={{ flex: '1 0 calc(25% - 4px)', minWidth: 32, padding: '7px 0', borderRadius: 8, border: `2px solid ${gfxGrid.colsMobile === n ? '#003366' : '#cde'}`, background: gfxGrid.colsMobile === n ? '#003366' : '#fff', color: gfxGrid.colsMobile === n ? '#fff' : '#003366', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{n}</button>
                ))}
              </div>
            </div>
            {/* Cols Desktop */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>🖥️ عدد البطاقات في السطر (ويب)</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[1,2,3,4,5,6].map(n => (
                  <button key={n} onClick={() => saveGfxGrid({ ...gfxGrid, colsDesktop: n })}
                    style={{ flex: '1 0 calc(16% - 4px)', minWidth: 32, padding: '7px 0', borderRadius: 8, border: `2px solid ${gfxGrid.colsDesktop === n ? '#003366' : '#cde'}`, background: gfxGrid.colsDesktop === n ? '#003366' : '#fff', color: gfxGrid.colsDesktop === n ? '#fff' : '#003366', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{n}</button>
                ))}
              </div>
            </div>
            {/* Gap */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>↔️ المسافة بين البطاقات: <span style={{ color: '#003366' }}>{gfxGrid.gap}px</span></label>
              <input type="range" min={2} max={40} value={gfxGrid.gap} onChange={e => saveGfxGrid({ ...gfxGrid, gap: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
            </div>
            {/* Padding Mobile */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>📐 هامش الجانبين (جوال): <span style={{ color: '#003366' }}>{gfxGrid.paddingMobile ?? 8}px</span></label>
              <input type="range" min={0} max={32} value={gfxGrid.paddingMobile ?? 8} onChange={e => saveGfxGrid({ ...gfxGrid, paddingMobile: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
            </div>
            {/* Image Height */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>🖼️ ارتفاع صورة التصميم: <span style={{ color: '#003366' }}>{gfxGrid.imgHeight ?? 195}px</span></label>
              <input type="range" min={80} max={400} value={gfxGrid.imgHeight ?? 195} onChange={e => saveGfxGrid({ ...gfxGrid, imgHeight: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
            </div>
            {/* Card Min Width */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>📏 الحد الأدنى لعرض البطاقة: <span style={{ color: '#003366' }}>{gfxGrid.cardMinWidth ?? 200}px</span></label>
              <input type="range" min={100} max={500} value={gfxGrid.cardMinWidth ?? 200} onChange={e => saveGfxGrid({ ...gfxGrid, cardMinWidth: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
            </div>
          </div>

          {/* Dual Preview: Desktop + Mobile side by side */}
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12 }}>
            {/* Desktop preview */}
            <div style={{ background: '#fff', border: '1px dashed #aac4ee', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#003366', marginBottom: 8 }}><i className="fa-solid fa-desktop" /> معاينة الويب ({gfxGrid.colsDesktop} أعمدة)</div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gfxGrid.colsDesktop}, 1fr)`, gap: gfxGrid.gap }}>
                {Array.from({ length: Math.min(gfxGrid.colsDesktop, 6) }, (_, i) => (
                  <div key={i} style={{ background: 'linear-gradient(135deg,#e0e8ff,#c8d8f8)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ height: Math.max(40, (gfxGrid.imgHeight ?? 195) * 0.3), background: 'linear-gradient(135deg,#c8d8f8,#a0b8e8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎨</div>
                    <div style={{ padding: '4px 6px', fontSize: 9, fontWeight: 700, color: '#003366' }}>تصميم {i+1}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Mobile preview */}
            <div style={{ background: '#fff', border: '1px dashed #aac4ee', borderRadius: 10, padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#003366', marginBottom: 8 }}><i className="fa-solid fa-mobile-screen" /> معاينة الجوال ({gfxGrid.colsMobile} أعمدة)</div>
              <div style={{ padding: `0 ${gfxGrid.paddingMobile ?? 8}px` }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gfxGrid.colsMobile}, 1fr)`, gap: Math.min(gfxGrid.gap, 12) }}>
                  {Array.from({ length: Math.min(gfxGrid.colsMobile * 2, 6) }, (_, i) => (
                    <div key={i} style={{ background: 'linear-gradient(135deg,#e0e8ff,#c8d8f8)', borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ height: Math.max(36, (gfxGrid.imgHeight ?? 195) * 0.22), background: 'linear-gradient(135deg,#c8d8f8,#a0b8e8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>🎨</div>
                      <div style={{ padding: '3px 5px', fontSize: 8, fontWeight: 700, color: '#003366' }}>تصميم {i+1}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: '#999', marginTop: 6, textAlign: 'center' }}>↑ معاينة تقريبية — التصميم الفعلي أجمل</div>
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
                      {item.mainImg ? <img src={item.mainImg} alt="" style={{ width: 52, height: 44, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} /> : <div style={{ width: 52, height: 44, background: '#eee', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-image" style={{ color: '#aaa' }} /></div>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#003366' }}>{pickML(item.title, lang) || '(بدون عنوان)'}</div>
                        <div style={{ fontSize: 10, color: '#888' }}>{catName} › {subName}</div>
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
              <div style={{ width: 200, height: 140, background: '#f0f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 12 }}>معاينة</div>
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
  const emptyProj = (): WebProject => ({
    id: uid(), title: ml(''), desc: ml(''), mainImg: '', images: [],
    videoUrl: '', liveUrl: '', googlePlayUrl: '', appleStoreUrl: '',
    githubUrl: '', githubVisible: true, tags: [], thumbSize: 220, textColor: '',
  });

  const setDraftML = (field: 'title' | 'desc', lang: LangKey, val: string) => {
    if (!draft) return;
    setDraft({ ...draft, [field]: { ...draft[field], [lang]: val } });
  };

  return (
    <div>
      <h4 style={{ margin: '0 0 14px' }}>
        <i className="fa-solid fa-globe" style={{ color: '#003366' }} /> إدارة المشاريع البرمجية
      </h4>
      {/* ── WebGrid Settings Panel ── */}
      <div style={{ marginBottom: 14 }}>
        <button onClick={() => setShowWebGrid(s => !s)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: showWebGrid ? '#003366' : '#f0f4ff', color: showWebGrid ? '#fff' : '#003366', border: '1px solid #cde', borderRadius: 8, padding: '7px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: showWebGrid ? 10 : 0 }}>
          <i className="fa-solid fa-table-cells" /> إعدادات شبكة العرض
        </button>
        {showWebGrid && (
          <div style={{ background: '#f0f4ff', border: '1px solid #aac4ee', borderRadius: 14, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#003366', marginBottom: 14 }}><i className="fa-solid fa-sliders" /> ضبط شبكة المشاريع البرمجية</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Cols Mobile */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>📱 عدد المشاريع في السطر (جوال)</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[1,2,3,4].map(n => (
                    <button key={n} onClick={() => saveWebGrid({ ...webGrid, colsMobile: n })}
                      style={{ flex: '1 0 calc(25% - 4px)', minWidth: 32, padding: '7px 0', borderRadius: 8, border: `2px solid ${webGrid.colsMobile === n ? '#003366' : '#cde'}`, background: webGrid.colsMobile === n ? '#003366' : '#fff', color: webGrid.colsMobile === n ? '#fff' : '#003366', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{n}</button>
                  ))}
                </div>
              </div>
              {/* Cols Desktop */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>🖥️ عدد المشاريع في السطر (ويب)</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5,6].map(n => (
                    <button key={n} onClick={() => saveWebGrid({ ...webGrid, colsDesktop: n })}
                      style={{ flex: '1 0 calc(16% - 4px)', minWidth: 32, padding: '7px 0', borderRadius: 8, border: `2px solid ${webGrid.colsDesktop === n ? '#003366' : '#cde'}`, background: webGrid.colsDesktop === n ? '#003366' : '#fff', color: webGrid.colsDesktop === n ? '#fff' : '#003366', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>{n}</button>
                  ))}
                </div>
              </div>
              {/* Gap */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>↔️ المسافة بين البطاقات: <span style={{ color: '#003366' }}>{webGrid.gap}px</span></label>
                <input type="range" min={4} max={40} value={webGrid.gap} onChange={e => saveWebGrid({ ...webGrid, gap: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
              </div>
              {/* Padding Mobile */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>📐 هامش الجانبين (جوال): <span style={{ color: '#003366' }}>{webGrid.paddingMobile ?? 8}px</span></label>
                <input type="range" min={0} max={32} value={webGrid.paddingMobile ?? 8} onChange={e => saveWebGrid({ ...webGrid, paddingMobile: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
              </div>
              {/* Card Min Width */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>📏 الحد الأدنى لعرض البطاقة: <span style={{ color: '#003366' }}>{webGrid.cardMinWidth}px</span></label>
                <input type="range" min={160} max={500} value={webGrid.cardMinWidth} onChange={e => saveWebGrid({ ...webGrid, cardMinWidth: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
              </div>
              {/* Image/Thumb Height */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>🖼️ ارتفاع صورة الغلاف: <span style={{ color: '#003366' }}>{webGrid.imgHeight ?? 220}px</span></label>
                <input type="range" min={80} max={500} value={webGrid.imgHeight ?? 220} onChange={e => saveWebGrid({ ...webGrid, imgHeight: Number(e.target.value) })} style={{ width: '100%', accentColor: '#003366' }} />
              </div>
            </div>

            {/* Dual Preview */}
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 12 }}>
              {/* Desktop */}
              <div style={{ background: '#fff', border: '1px dashed #aac4ee', borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#003366', marginBottom: 8 }}><i className="fa-solid fa-desktop" /> معاينة الويب ({webGrid.colsDesktop} أعمدة)</div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${webGrid.colsDesktop}, 1fr)`, gap: webGrid.gap }}>
                  {Array.from({ length: Math.min(webGrid.colsDesktop, 6) }, (_, i) => (
                    <div key={i} style={{ background: '#f0f4ff', border: '1px solid #cde', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ height: Math.max(30, (webGrid.imgHeight ?? 220) * 0.28), background: 'linear-gradient(135deg,#003366,#1a5276)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-globe" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }} /></div>
                      <div style={{ padding: '4px 6px' }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: '#003366', marginBottom: 2 }}>عنوان المشروع</div>
                        <div style={{ fontSize: 8, color: '#888' }}>وصف قصير...</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Mobile */}
              <div style={{ background: '#fff', border: '1px dashed #aac4ee', borderRadius: 10, padding: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#003366', marginBottom: 8 }}><i className="fa-solid fa-mobile-screen" /> معاينة الجوال ({webGrid.colsMobile} أعمدة)</div>
                <div style={{ padding: `0 ${webGrid.paddingMobile ?? 8}px` }}>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${webGrid.colsMobile}, 1fr)`, gap: Math.min(webGrid.gap, 10) }}>
                    {Array.from({ length: Math.min(webGrid.colsMobile * 2, 4) }, (_, i) => (
                      <div key={i} style={{ background: '#f0f4ff', border: '1px solid #cde', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ height: Math.max(28, (webGrid.imgHeight ?? 220) * 0.2), background: 'linear-gradient(135deg,#003366,#1a5276)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fa-solid fa-globe" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }} /></div>
                        <div style={{ padding: '3px 5px' }}>
                          <div style={{ fontSize: 8, fontWeight: 800, color: '#003366' }}>عنوان</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#999', marginTop: 6, textAlign: 'center' }}>↑ معاينة تقريبية — التصميم الفعلي أجمل</div>
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
              <button key={p.id} onClick={() => { setSel(i); setDraft({ ...p, images: [...p.images] }); }}
                style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${sel === i ? '#003366' : '#dde'}`, background: sel === i ? '#003366' : '#fff', color: sel === i ? '#fff' : '#333', fontSize: 12, cursor: 'pointer', textAlign: 'right', display: 'flex', gap: 8, alignItems: 'center' }}>
                {p.mainImg && <img src={p.mainImg} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title.ar || p.title.en || '(بلا عنوان)'}</div>
                  {p.tags.length > 0 && <div style={{ fontSize: 10, opacity: 0.7 }}>{p.tags.slice(0,2).join(', ')}</div>}
                </div>
              </button>
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
                <button className="btn-danger-sm"
                  onClick={() => { if (!confirm('حذف المشروع؟')) return; const next = projects.filter((_, i) => i !== sel); commit(next); setSel(null); setDraft(null); }}>
                  <i className="fa-solid fa-trash-can" /> حذف
                </button>
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
                  <input type="url" value={draft.mainImg} onChange={e => setDraft({ ...draft, mainImg: e.target.value })} dir="ltr" />
                </div>
                <div className="form-group">
                  <label><i className="fa-solid fa-arrow-up-right-from-square" /> رابط الموقع المباشر</label>
                  <input type="url" value={draft.liveUrl} onChange={e => setDraft({ ...draft, liveUrl: e.target.value })} dir="ltr" />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label><i className="fa-brands fa-youtube" /> رابط الفيديو</label>
                <input type="url" value={draft.videoUrl} onChange={e => setDraft({ ...draft, videoUrl: e.target.value })} dir="ltr" placeholder="https://www.youtube.com/embed/..." />
              </div>

              {/* App Store Links */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label><i className="fa-brands fa-google-play" style={{ color: '#01875f' }} /> رابط Google Play</label>
                  <input type="url" value={draft.googlePlayUrl || ''} onChange={e => setDraft({ ...draft, googlePlayUrl: e.target.value })} dir="ltr" placeholder="https://play.google.com/store/apps/details?id=..." />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label><i className="fa-brands fa-apple" style={{ color: '#555' }} /> رابط App Store</label>
                  <input type="url" value={draft.appleStoreUrl || ''} onChange={e => setDraft({ ...draft, appleStoreUrl: e.target.value })} dir="ltr" placeholder="https://apps.apple.com/app/..." />
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

              {/* Text color */}
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
                  <img src={draft.mainImg} style={{ height: 100, borderRadius: 10, objectFit: 'cover', width: '100%' }} />
                </div>
              )}

              <button className="btn-prime" onClick={() => { commit(projects.map((p, i) => i === sel ? draft! : p)); alert('تم الحفظ ✓'); }}>
                <i className="fa-solid fa-floppy-disk" /> حفظ المشروع
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#aaa', flexDirection: 'column', gap: 10 }}>
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
   LAB ADMIN (CODE SNIPPETS)
══════════════════════════════════════════════════════ */
function LabAdmin({ data, onSave }: { data: AppData; onSave: (u: Partial<AppData>) => void }) {
  const [subTab, setSubTab] = useState<'webproj' | 'snippets'>('webproj');
  const [snippets, setSnippets] = useState<SoftwareSnippet[]>(data.softwareSnippets || []);
  const [sel, setSel] = useState<number | null>(null);
  const [draft, setDraft] = useState<SoftwareSnippet | null>(null);
  const [codeLang, setCodeLang] = useState<'html' | 'css' | 'js'>('html');

  const commit = (next: SoftwareSnippet[]) => { setSnippets(next); onSave({ softwareSnippets: next }); };
  const empty = (): SoftwareSnippet => ({ title: '', desc: '', category: '', codeHtml: '', codeCss: '', codeJs: '' });

  return (
    <div>
      <h4 style={{ margin: '0 0 14px' }}><i className="fa-solid fa-code" style={{ color: '#003366' }} /> برمجة المواقع والتطبيقات</h4>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { id: 'webproj', label: 'المشاريع البرمجية', icon: 'fa-globe' },
          { id: 'snippets', label: 'مختبرات الأكواد', icon: 'fa-flask' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id as 'webproj' | 'snippets')}
            style={{ padding: '7px 16px', borderRadius: 10, border: `1px solid ${subTab === tab.id ? '#003366' : '#dde'}`, background: subTab === tab.id ? '#003366' : '#f5f7fa', color: subTab === tab.id ? '#fff' : '#333', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className={`fa-solid ${tab.icon}`} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Web Projects */}
      {subTab === 'webproj' && <WebProjAdmin data={data} onSave={onSave} />}

      {/* Code Snippets */}
      {subTab === 'snippets' && (
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
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title || '(بلا عنوان)'}</div>
                  {s.category && <div style={{ fontSize: 10, opacity: 0.7 }}>{s.category}</div>}
                </button>
              ))}
            </div>
          </div>
          <div>
            {draft !== null && sel !== null ? (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <strong>تعديل المقتطف</strong>
                  <button className="btn-danger-sm"
                    onClick={() => { if (!confirm('حذف؟')) return; const next = snippets.filter((_, i) => i !== sel); commit(next); setSel(null); setDraft(null); }}>
                    <i className="fa-solid fa-trash-can" /> حذف
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div className="form-group"><label>العنوان</label>
                    <input type="text" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
                  <div className="form-group"><label>الفئة / اللغة</label>
                    <input type="text" value={draft.category || ''} onChange={e => setDraft({ ...draft, category: e.target.value })} /></div>
                </div>
                <div className="form-group" style={{ marginBottom: 10 }}><label>الوصف</label>
                  <input type="text" value={draft.desc} onChange={e => setDraft({ ...draft, desc: e.target.value })} /></div>

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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#aaa', flexDirection: 'column', gap: 10 }}>
                <i className="fa-solid fa-code" style={{ fontSize: 32 }} /><span>اختر مقتطفاً للتعديل</span>
              </div>
            )}
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
    <div style={{ background: '#f0f4ff', border: '2px solid #c5d3f0', borderRadius: 12, padding: 18, marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <i className="fa-solid fa-server" style={{ color: '#0055cc', fontSize: 22, marginTop: 2 }} />
      <div>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#003366', marginBottom: 4 }}>
          مفتاح الذكاء الاصطناعي — محفوظ داخل السيرفر
        </div>
        <div style={{ fontSize: 12, color: '#446', lineHeight: 1.9 }}>
          الطلبات تمر عبر ملف <code style={{ background: '#dce8ff', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>ai_proxy.php</code> على السيرفر.
          المفتاح مخفي تماماً عن المتصفح ولا يظهر في أي طلب شبكي.
          لتغيير المفتاح، افتح الملف على السيرفر وعدّل السطر الأول داخله.
        </div>
      </div>
    </div>
  );
}

function SiteSettingsAdmin({
  data, onSave, serverConnected, serverSyncing, onServerConnect, onServerSync, onServerDisconnect,
}: {
  data: AppData;
  onSave: (u: Partial<AppData>) => void;
  serverConnected?: boolean;
  serverSyncing?: boolean;
  onServerConnect?: (username: string, password: string) => Promise<boolean>;
  onServerSync?: () => void;
  onServerDisconnect?: () => void;
}) {
  const [lang, setLang] = useState<LangKey>('ar');
  const [settings, setSettings] = useState<SiteSettings>(data.siteSettings || {
    logoType: 'text', logoImg: '', logoText: ml('المهندس علاء', 'ENG. ALAA', 'ING. ALAA'),
    footerBg: '#003366', footerText: ml('© جميع الحقوق محفوظة', '© All Rights Reserved', '© Alle Rechte vorbehalten'),
    socialLinks: [], navItems: [], themeMode: 'dark', accentColor: '#003366', glassOpacity: 0.5,
  });
  const [savedMsg, setSavedMsg] = useState('');
  const [srvUser, setSrvUser] = useState('');
  const [srvPass, setSrvPass] = useState('');
  const [srvError, setSrvError] = useState('');
  const [srvSuccess, setSrvSuccess] = useState('');

  const commit = (next: SiteSettings) => { setSettings(next); onSave({ siteSettings: next }); setSavedMsg('تم الحفظ ✓'); setTimeout(() => setSavedMsg(''), 2000); };

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
      {savedMsg && <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 8, padding: '8px 14px', marginBottom: 12, color: '#2a7a2a', fontWeight: 700 }}>{savedMsg}</div>}

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
            <button
              onClick={() => { onServerSync?.(); setSrvSuccess('⏳ جارٍ المزامنة...'); setTimeout(() => setSrvSuccess(''), 2000); }}
              disabled={serverSyncing}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: '#003366', color: '#fff', cursor: serverSyncing ? 'wait' : 'pointer', fontWeight: 700, fontSize: 13 }}
            >
              <i className={`fa-solid ${serverSyncing ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`} />
              {serverSyncing ? 'جارٍ الرفع...' : 'رفع البيانات الآن'}
            </button>
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
            <div style={{ fontSize: 12, color: '#666', marginBottom: 10, lineHeight: 1.7 }}>
              <i className="fa-solid fa-circle-info" style={{ color: '#e67e22', marginInlineEnd: 4 }} />
              أدخل بيانات حساب المدير في <b>api/auth.php</b> على Hostinger لتفعيل المزامنة التلقائية مع MySQL. بعد الاتصال، كل تغيير في الإعدادات يُحفظ تلقائياً في قاعدة البيانات.
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

      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        {LANGS.map(l => <button key={l.code} onClick={() => setLang(l.code)} style={{ padding: '4px 8px', borderRadius: 12, border: `1px solid ${lang === l.code ? '#003366' : '#ccc'}`, background: lang === l.code ? '#003366' : '#fff', color: lang === l.code ? '#fff' : '#555', fontSize: 11, cursor: 'pointer' }}>{l.flag} {l.label}</button>)}
      </div>

      {/* THEME MODE */}
      <div style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14, marginBottom: 14 }}>
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

      {/* SITE COLORS — accent + glass transparency (whole site) */}
      <div style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}><i className="fa-solid fa-palette" /> ألوان الموقع والقوائم</div>
        <div style={{ fontSize: 12, color: '#778', marginBottom: 12, lineHeight: 1.7 }}>
          يتحكم اللون الأساسي بكل القوائم والأزرار والعناوين في الموقع (بوابة الزراعة وغيرها). اختر الكحلي أو أي لون، وتحكّم بدرجة شفافية القوائم الزجاجية.
        </div>

        <div className="form-group" style={{ marginBottom: 14 }}>
          <label>اللون الأساسي للموقع (كحلي افتراضياً)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={settings.accentColor || '#003366'} onChange={e => commit({ ...settings, accentColor: e.target.value })} style={{ width: 48, height: 36, borderRadius: 6, border: '1px solid #dde', cursor: 'pointer' }} />
            <input type="text" value={settings.accentColor || '#003366'} style={{ direction: 'ltr', flex: 1 }} onChange={e => commit({ ...settings, accentColor: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {(['#003366', '#0b2a4a', '#14213d', '#1e3a8a', '#0f4c81', '#2c3e6b', '#1a3c34', '#3a1d57'] as const).map(c => (
              <button key={c} onClick={() => commit({ ...settings, accentColor: c })}
                title={c}
                style={{ width: 26, height: 26, borderRadius: 6, background: c, cursor: 'pointer', border: (settings.accentColor || '#003366').toLowerCase() === c ? '3px solid #888' : '1px solid #ccd' }} />
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>درجة شفافية القوائم الزجاجية ({Math.round((settings.glassOpacity ?? 0.5) * 100)}%)</label>
          <input type="range" min={5} max={95} step={5}
            value={Math.round((settings.glassOpacity ?? 0.5) * 100)}
            onChange={e => commit({ ...settings, glassOpacity: Number(e.target.value) / 100 })}
            style={{ width: '100%', accentColor: settings.accentColor || '#003366', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#99a' }}>
            <span>أكثر شفافية (زجاجي)</span>
            <span>أكثر تعتيماً (صلب)</span>
          </div>
        </div>
      </div>

      {/* LOGO */}
      <div style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14, marginBottom: 14 }}>
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
          <div style={{ background: '#f0f4ff', border: '1px solid #c8d5f0', borderRadius: 8, padding: 10, fontSize: 12, color: '#445', marginBottom: 8, lineHeight: 1.7 }}>
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
        <div className="form-group" style={{ marginTop: 10 }}>
          <label>تخصيص لون الشعار (اتركه فارغاً للتبديل التلقائي أبيض/كحلي)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={settings.logoColor || '#003366'} onChange={e => commit({ ...settings, logoColor: e.target.value })}
              style={{ width: 44, height: 34, borderRadius: 6, border: '1px solid #dde', cursor: 'pointer' }} />
            <input type="text" value={settings.logoColor || ''} placeholder="تلقائي (auto)"
              style={{ direction: 'ltr', flex: 1 }} onChange={e => commit({ ...settings, logoColor: e.target.value })} />
            {settings.logoColor && (
              <button className="btn-danger-sm" onClick={() => commit({ ...settings, logoColor: '' })}
                title="إعادة للتلقائي"><i className="fa-solid fa-rotate-left" /></button>
            )}
          </div>
        </div>
      </div>

      {/* THREE.JS ANIMATION */}
      <div style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14, marginBottom: 14 }}>
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
      <div style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}><i className="fa-solid fa-align-center" /> الفوتر</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group"><label>لون خلفية الفوتر</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={settings.footerBg} onChange={e => commit({ ...settings, footerBg: e.target.value })} style={{ width: 48, height: 36, borderRadius: 6, border: '1px solid #dde', cursor: 'pointer' }} />
              <input type="text" value={settings.footerBg} style={{ direction: 'ltr', flex: 1 }} onChange={e => commit({ ...settings, footerBg: e.target.value })} />
            </div>
          </div>
          <div className="form-group"><label>نص الفوتر ({lang.toUpperCase()})</label>
            <input type="text" value={settings.footerText[lang] || ''} onChange={e => commit({ ...settings, footerText: { ...settings.footerText, [lang]: e.target.value } })} /></div>
        </div>
        <div style={{ marginTop: 8, background: settings.footerBg, color: '#fff', borderRadius: 6, padding: '8px 14px', fontSize: 12, textAlign: 'center' }}>
          {settings.footerText[lang] || '—'}
        </div>
      </div>

      {/* SOCIAL LINKS */}
      <div style={{ background: '#f8f9ff', border: '1px solid #dde', borderRadius: 10, padding: 14, marginBottom: 14 }}>
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
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input type="text" value={item.label[lang] || ''} placeholder={`الاسم (${lang.toUpperCase()})`} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #dde', fontSize: 12 }}
              onChange={e => commit({ ...settings, navItems: settings.navItems.map((x, j) => j === i ? { ...x, label: { ...x.label, [lang]: e.target.value } } : x) })} />
            <input type="text" value={item.url} placeholder="الرابط (#agri)" style={{ direction: 'ltr', padding: '5px 8px', borderRadius: 6, border: '1px solid #dde', fontSize: 12 }}
              onChange={e => commit({ ...settings, navItems: settings.navItems.map((x, j) => j === i ? { ...x, url: e.target.value } : x) })} />
            <input type="number" value={item.order} min={1} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #dde', fontSize: 12, direction: 'ltr' }}
              onChange={e => commit({ ...settings, navItems: settings.navItems.map((x, j) => j === i ? { ...x, order: Number(e.target.value) } : x) })} />
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
export function ContentAdmin({ mode, data, onSave, serverConnected, serverSyncing, onServerConnect, onServerSync, onServerDisconnect }: Props) {
  if (mode === 'agri') return <AgriAdmin data={data} onSave={onSave} />;
  if (mode === 'gfx') return <GfxAdmin data={data} onSave={onSave} />;
  if (mode === 'site') return (
    <SiteSettingsAdmin
      data={data}
      onSave={onSave}
      serverConnected={serverConnected}
      serverSyncing={serverSyncing}
      onServerConnect={onServerConnect}
      onServerSync={onServerSync}
      onServerDisconnect={onServerDisconnect}
    />
  );
  return <LabAdmin data={data} onSave={onSave} />;
}
