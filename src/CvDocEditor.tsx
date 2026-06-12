import { useState, useRef, useEffect } from 'react';
import {
  AppData, CvDoc, CvSection, CvSectionKind, CvEntryItem, CvContactItem,
  CvPortfolioItem, CvSidebarDoc, CvQrCredential, ML, LangKey, ml, pickML,
  GfxCategory, GfxProjectItem, Skill,
} from './appData';
import { CvRenderer } from './CvRenderer';
import { SkillIcon } from './SkillIcon';

function uid() { return Math.random().toString(36).slice(2, 9); }

interface Props { data: AppData; onSave: (updated: Partial<AppData>) => void; onExport: (doc: CvDoc, lang: LangKey) => void; }

const LANGS: { code: LangKey; label: string; flag: string }[] = [
  { code: 'ar', label: 'العربية', flag: '🇸🇾' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

const KIND_LABELS: Record<CvSectionKind, string> = {
  header: 'الصورة والعناوين', contact: 'بيانات التواصل',
  entries: 'إدخالات (خبرات / تعليم / مراجع)', tags: 'وسوم / مهارات نقطية',
  skillbars: 'أشرطة المهارات', portfolio: 'معرض صور', text: 'نص حر',
};

const ADDABLE: CvSectionKind[] = ['entries', 'contact', 'tags', 'skillbars', 'portfolio', 'text'];

const COLS: { v: CvSection['column']; label: string }[] = [
  { v: 'left', label: 'العمود الجانبي' },
  { v: 'right', label: 'العمود الرئيسي' },
  { v: 'full', label: 'عرض كامل' },
];

function newSection(kind: CvSectionKind): CvSection {
  return {
    id: uid(), kind, title: ml(KIND_LABELS[kind]),
    column: kind === 'portfolio' ? 'full' : kind === 'entries' ? 'right' : 'left',
    visible: true,
    entries: kind === 'entries' ? [] : undefined,
    tags: kind === 'tags' ? [] : undefined,
    contactItems: kind === 'contact' ? [] : undefined,
    portfolio: kind === 'portfolio' ? [] : undefined,
    text: kind === 'text' ? ml('') : undefined,
    useGlobalSkills: kind === 'skillbars' ? true : undefined,
    galleryLayout: kind === 'portfolio' ? 2 : undefined,
    imgHeight: kind === 'portfolio' ? 130 : undefined,
  };
}

function newDoc(): CvDoc {
  return {
    id: uid(), name: 'سيرة مخصصة جديدة', removable: true,
    accent: '#7a3fb8', icon: 'fa-file-lines', photo: '', fullName: ml(''), subtitle: ml(''),
    since: new Date().getFullYear() - 1, showInAbout: false,
    globalColor: '#7a3fb8', footerBgColor: '#003366', footerText: ml('eng-alaa.com', 'eng-alaa.com', 'eng-alaa.com'),
    sidebarDocs: [], qrCredentials: [],
    sections: [
      { id: uid(), kind: 'header', title: ml('الصورة والعناوين'), column: 'full', visible: true },
      newSection('contact'),
      { ...newSection('entries'), title: ml('الخبرات المهنية', 'Experience', 'Berufserfahrung') },
    ],
  };
}

function MLInput({ value, lang, onChange, placeholder, multiline, dir }: {
  value: ML; lang: LangKey; onChange: (v: ML) => void;
  placeholder?: string; multiline?: boolean; dir?: 'rtl' | 'ltr';
}) {
  const [activeLang, setActiveLang] = useState<LangKey>(lang);
  useEffect(() => { setActiveLang(lang); }, [lang]);
  const set = (s: string) => onChange({ ...value, [activeLang]: s });
  const filled = (k: LangKey) => (value[k] || '').trim().length > 0;
  const isRtl = activeLang === 'ar';
  return (
    <div className="ml-input">
      {multiline
        ? <textarea rows={3} value={value[activeLang] || ''} placeholder={placeholder}
            style={{ direction: dir ?? (isRtl ? 'rtl' : 'ltr') }} onChange={e => set(e.target.value)} />
        : <input type="text" value={value[activeLang] || ''} placeholder={placeholder}
            style={{ direction: dir ?? (isRtl ? 'rtl' : 'ltr') }} onChange={e => set(e.target.value)} />}
      <div className="ml-dots">
        {LANGS.map(l => (
          <button
            key={l.code} type="button"
            className={`ml-dot${filled(l.code) ? ' on' : ''}${l.code === activeLang ? ' cur' : ''}`}
            title={l.label} onClick={() => setActiveLang(l.code)}>
            {l.code.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

function EntryRow({ entry, lang, onChange, onDelete, onUp, onDown, isFirst, isLast }: {
  entry: CvEntryItem; lang: LangKey; onChange: (e: CvEntryItem) => void;
  onDelete: () => void; onUp: () => void; onDown: () => void; isFirst: boolean; isLast: boolean;
}) {
  return (
    <div className="cv-admin-form-card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 8 }}>
        <button className="cv-move-btn" disabled={isFirst} onClick={onUp}><i className="fa-solid fa-chevron-up" /></button>
        <button className="cv-move-btn" disabled={isLast} onClick={onDown}><i className="fa-solid fa-chevron-down" /></button>
        <button className="btn-danger-sm" onClick={onDelete}><i className="fa-solid fa-trash-can" /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="form-group"><label>من</label>
          <input type="text" value={entry.from} placeholder="2020" onChange={e => onChange({ ...entry, from: e.target.value })} /></div>
        <div className="form-group"><label>إلى <small>(present = الحالية)</small></label>
          <input type="text" value={entry.to} placeholder="present" onChange={e => onChange({ ...entry, to: e.target.value })} /></div>
      </div>
      <div className="form-group"><label>العنوان الرئيسي</label>
        <MLInput value={entry.title} lang={lang} onChange={v => onChange({ ...entry, title: v })} /></div>
      <div className="form-group"><label>الجهة</label>
        <MLInput value={entry.org} lang={lang} onChange={v => onChange({ ...entry, org: v })} /></div>
      <div className="form-group"><label>تفاصيل (اختياري)</label>
        <MLInput value={entry.desc} lang={lang} multiline onChange={v => onChange({ ...entry, desc: v })} /></div>
    </div>
  );
}

function ContactRow({ item, lang, onChange, onDelete, onUp, onDown, isFirst, isLast }: {
  item: CvContactItem; lang: LangKey; onChange: (c: CvContactItem) => void;
  onDelete: () => void; onUp: () => void; onDown: () => void; isFirst: boolean; isLast: boolean;
}) {
  return (
    <div className="cv-admin-form-card" style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 8 }}>
        <button className="cv-move-btn" disabled={isFirst} onClick={onUp}><i className="fa-solid fa-chevron-up" /></button>
        <button className="cv-move-btn" disabled={isLast} onClick={onDown}><i className="fa-solid fa-chevron-down" /></button>
        <button className="btn-danger-sm" onClick={onDelete}><i className="fa-solid fa-trash-can" /></button>
      </div>
      <div className="form-group"><label>الاسم (مثل: الهاتف، البريد)</label>
        <MLInput value={item.label} lang={lang} onChange={v => onChange({ ...item, label: v })} /></div>
      <div className="form-group"><label>القيمة</label>
        <input type="text" value={item.value} style={{ direction: item.ltr ? 'ltr' : 'rtl' }}
          onChange={e => onChange({ ...item, value: e.target.value })} /></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={item.ltr} onChange={e => onChange({ ...item, ltr: e.target.checked })} />
        عرض القيمة من اليسار لليمين
      </label>
    </div>
  );
}

function PortfolioRowComp({ item, lang, onChange, onDelete, onUp, onDown, isFirst, isLast, skills, isDragging, isDragOver }: {
  item: CvPortfolioItem; lang: LangKey;
  onChange: (p: CvPortfolioItem) => void;
  onDelete: () => void; onUp: () => void; onDown: () => void;
  isFirst: boolean; isLast: boolean;
  skills: Skill[];
  isDragging?: boolean; isDragOver?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const toolSkills = (item.toolIds || []).map(tid => skills.find(s => s.id === tid)).filter(Boolean) as Skill[];

  return (
    <div className="cv-admin-form-card" style={{
      marginBottom: 8,
      opacity: isDragging ? 0.45 : 1,
      outline: isDragOver ? '2px dashed #7a3fb8' : '2px solid transparent',
      borderRadius: 10,
      transition: 'opacity 0.15s, outline 0.15s',
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ cursor: 'grab', padding: '6px 4px', color: '#aaa', fontSize: 14, alignSelf: 'center' }}
          title="اسحب لإعادة الترتيب">
          <i className="fa-solid fa-grip-vertical" />
        </div>
        {item.img
          ? <img src={item.img} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
          : <div style={{ width: 64, height: 64, borderRadius: 8, background: '#eef', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#aaa' }}>
              <i className="fa-solid fa-image" style={{ fontSize: 20 }} />
            </div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#555', flex: 1 }}>
              {pickML(item.caption, 'ar') || 'بدون عنوان'}
              {item.gfxItemId && <span style={{ marginInlineStart: 6, fontSize: 10, background: '#7a3fb822', color: '#7a3fb8', borderRadius: 10, padding: '1px 7px' }}>من المعرض</span>}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="cv-move-btn" disabled={isFirst} onClick={onUp} title="أعلى"><i className="fa-solid fa-chevron-up" /></button>
              <button className="cv-move-btn" disabled={isLast} onClick={onDown} title="أسفل"><i className="fa-solid fa-chevron-down" /></button>
              <button className="btn-outline-sm" onClick={() => setExpanded(x => !x)} style={{ fontSize: 11, padding: '2px 8px' }}>
                <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`} /> {expanded ? 'طي' : 'تفاصيل'}
              </button>
              <button className="btn-danger-sm" onClick={onDelete}><i className="fa-solid fa-trash-can" /></button>
            </div>
          </div>

          {toolSkills.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
              {toolSkills.map(s => (
                <span key={s.id} title={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, background: '#f0f4ff', padding: '2px 5px', borderRadius: 6 }}>
                  <SkillIcon icon={s.icon} size={12} /> {s.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #eee' }}>
          <div className="form-group"><label>التسمية التوضيحية</label>
            <MLInput value={item.caption} lang={lang} onChange={v => onChange({ ...item, caption: v })} /></div>
          <div className="form-group"><label>رابط الصورة</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input type="text" value={item.img} style={{ direction: 'ltr', flex: 1 }} onChange={e => onChange({ ...item, img: e.target.value })} />
              <button className="btn-outline-sm" onClick={() => fileRef.current?.click()} title="رفع صورة">
                <i className="fa-solid fa-upload" />
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => onChange({ ...item, img: ev.target?.result as string }); r.readAsDataURL(f); }} />
          </div>
          {item.description !== undefined && (
            <div className="form-group"><label>الوصف المختصر</label>
              <MLInput value={item.description} lang={lang} multiline onChange={v => onChange({ ...item, description: v })} /></div>
          )}
          <div className="form-group"><label>معرّفات البرامج (معرفات المهارات مفصولة بفراغ)</label>
            <input type="text" value={(item.toolIds || []).join(' ')} style={{ direction: 'ltr' }}
              placeholder="ps ai cad ..."
              onChange={e => onChange({ ...item, toolIds: e.target.value.split(/\s+/).filter(Boolean) })} />
            {(item.toolIds || []).length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                {(item.toolIds || []).map(tid => {
                  const sk = skills.find(s => s.id === tid);
                  return sk
                    ? <span key={tid} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, background: '#f0f4ff', padding: '2px 6px', borderRadius: 6 }}>
                        <SkillIcon icon={sk.icon} size={13} /> {sk.name}
                      </span>
                    : <span key={tid} style={{ fontSize: 11, color: '#e00', background: '#fee', padding: '2px 6px', borderRadius: 6 }}>{tid} غير موجود</span>;
                })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={!!item.showDesc} onChange={e => onChange({ ...item, showDesc: e.target.checked })} />
              إظهار الوصف
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={!!item.showTools} onChange={e => onChange({ ...item, showTools: e.target.checked })} />
              إظهار أيقونات البرامج
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <input type="checkbox" checked={!!item.showQr} onChange={e => onChange({ ...item, showQr: e.target.checked })} />
              إظهار QR Code
            </label>
          </div>
          {item.showQr && (
            <div className="form-group"><label>رابط QR (رابط صفحة المشروع)</label>
              <input type="url" value={item.qrUrl || ''} style={{ direction: 'ltr' }}
                placeholder="https://eng-alaa.com/..." onChange={e => onChange({ ...item, qrUrl: e.target.value })} />
              {item.qrUrl && (
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(item.qrUrl)}`}
                  alt="QR" style={{ marginTop: 6, width: 56, height: 56 }} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Image Picker Modal ──────────────────────────────────── */
function ImagePickerModal({ gfxCategories, skills, existing, lang, onAdd, onClose }: {
  gfxCategories: GfxCategory[];
  skills: Skill[];
  existing: string[];
  lang: LangKey;
  onAdd: (item: CvPortfolioItem) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  const allProjects: { item: GfxProjectItem; catName: ML; subName: ML }[] = gfxCategories.flatMap(cat =>
    cat.subCategories.flatMap(sub =>
      sub.items.map(item => ({ item, catName: cat.name, subName: sub.name }))
    )
  );

  const filtered = search.trim()
    ? allProjects.filter(({ item }) =>
        pickML(item.title, 'ar').toLowerCase().includes(search.toLowerCase()) ||
        pickML(item.title, 'en').toLowerCase().includes(search.toLowerCase())
      )
    : allProjects;

  const fromGfxItem = (gfxItem: GfxProjectItem): CvPortfolioItem => ({
    id: uid(),
    img: gfxItem.mainImg,
    caption: gfxItem.title,
    gfxItemId: gfxItem.id,
    description: gfxItem.desc,
    toolIds: gfxItem.usedSkillsIds,
    showDesc: gfxItem.cvSettings.showDesc,
    showTools: gfxItem.cvSettings.showTools,
    showQr: false,
    qrUrl: '',
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,20,60,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 14, width: 'min(760px, 95vw)',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#003366' }}>
              <i className="fa-solid fa-images" style={{ marginInlineEnd: 8, color: '#7a3fb8' }} />
              اختيار صور من قاعدة التصاميم الهندسية
            </div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              اضغط على مشروع لإضافته — {allProjects.length} مشروع متاح
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f0f0' }}>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث عن مشروع..."
            style={{ width: '100%', padding: '8px 14px', borderRadius: 8, border: '1px solid #dde', fontSize: 14, direction: 'rtl' }}
            autoFocus
          />
        </div>

        <div style={{ overflow: 'auto', flex: 1, padding: 16 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ fontSize: 28, display: 'block', marginBottom: 10 }} />
              لا توجد نتائج
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
            {filtered.map(({ item, catName }) => {
              const isAdded = existing.includes(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => { if (!isAdded) { onAdd(fromGfxItem(item)); } }}
                  style={{
                    borderRadius: 10,
                    border: isAdded ? '2px solid #22c55e' : '2px solid #e8eaf0',
                    overflow: 'hidden',
                    cursor: isAdded ? 'default' : 'pointer',
                    background: isAdded ? '#f0fff4' : '#fafbff',
                    transition: 'box-shadow 0.15s, border-color 0.15s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (!isAdded) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 18px rgba(122,63,184,0.18)'; (e.currentTarget as HTMLDivElement).style.borderColor = isAdded ? '#22c55e' : '#7a3fb8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = isAdded ? '#22c55e' : '#e8eaf0'; }}
                >
                  {item.mainImg
                    ? <img src={item.mainImg} alt={pickML(item.title, 'ar')}
                        style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
                    : <div style={{ height: 100, background: '#eef', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>
                        <i className="fa-solid fa-image" style={{ fontSize: 28 }} />
                      </div>}
                  <div style={{ padding: '7px 8px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#222', lineHeight: 1.3, marginBottom: 3 }}>
                      {pickML(item.title, 'ar')}
                    </div>
                    <div style={{ fontSize: 10, color: '#888' }}>{pickML(catName, 'ar')}</div>
                    <div style={{ display: 'flex', gap: 3, marginTop: 5, flexWrap: 'wrap' }}>
                      {(item.usedSkillsIds || []).slice(0, 4).map(tid => {
                        const sk = skills.find(s => s.id === tid);
                        return sk ? <SkillIcon key={tid} icon={sk.icon} size={13} /> : null;
                      })}
                    </div>
                  </div>
                  {item.cvSettings.isFeatured && (
                    <div style={{ position: 'absolute', top: 6, insetInlineStart: 6, background: '#f59e0b', color: '#fff', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 8 }}>
                      ★ مميز
                    </div>
                  )}
                  {isAdded && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ background: '#22c55e', color: '#fff', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
                        <i className="fa-solid fa-check" style={{ marginInlineEnd: 4 }} /> مُضاف
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Portfolio Section Editor (with drag-and-drop) ────────── */
function PortfolioSectionEditor({ sec, lang, onChange, gfxCategories, skills }: {
  sec: CvSection;
  lang: LangKey;
  onChange: (s: CvSection) => void;
  gfxCategories: GfxCategory[];
  skills: Skill[];
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const items = sec.portfolio || [];
  const upd = (patch: Partial<CvSection>) => onChange({ ...sec, ...patch });
  const updItems = (next: CvPortfolioItem[]) => upd({ portfolio: next });

  const move = (list: CvPortfolioItem[], i: number, d: number): CvPortfolioItem[] => {
    const a = [...list]; const j = i + d;
    if (j < 0 || j >= a.length) return a;
    [a[i], a[j]] = [a[j], a[i]]; return a;
  };

  const onDragStart = (i: number) => setDragIdx(i);
  const onDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOver(i); };
  const onDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setDragOver(null); return; }
    const a = [...items];
    const [removed] = a.splice(dragIdx, 1);
    a.splice(targetIdx, 0, removed);
    updItems(a);
    setDragIdx(null);
    setDragOver(null);
  };
  const onDragEnd = () => { setDragIdx(null); setDragOver(null); };

  const existingGfxIds = items.filter(x => x.gfxItemId).map(x => x.gfxItemId!);

  return (
    <>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', padding: '10px 14px', background: '#f8f9ff', borderRadius: 10, border: '1px solid #e8eaf0' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 5 }}>تخطيط الصور في الصف</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {([1, 2, 3] as (1|2|3)[]).map(n => (
              <button key={n}
                type="button"
                onClick={() => upd({ galleryLayout: n })}
                style={{
                  padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: (sec.galleryLayout ?? 2) === n ? '#7a3fb8' : '#e8eaf0',
                  color: (sec.galleryLayout ?? 2) === n ? '#fff' : '#555',
                  transition: 'all 0.15s',
                }}>
                {'■'.repeat(n)} {n === 1 ? 'واحدة' : n === 2 ? 'اثنتان' : 'ثلاث'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 5 }}>ارتفاع الصور (px)</label>
          <input type="number" min={60} max={400} step={10} value={sec.imgHeight ?? 130}
            onChange={e => upd({ imgHeight: Number(e.target.value) })}
            style={{ width: 80, padding: '5px 8px', borderRadius: 8, border: '1px solid #dde', fontSize: 13 }} />
        </div>
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>{items.length} صورة</span>
        </div>
      </div>

      {items.length > 0 && (
        <div style={{ fontSize: 11, color: '#7a3fb8', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <i className="fa-solid fa-arrows-up-down" />
          يمكنك السحب لإعادة ترتيب الصور، أو استخدام الأسهم
        </div>
      )}

      {items.map((it, i) => (
        <div
          key={it.id}
          draggable
          onDragStart={() => onDragStart(i)}
          onDragOver={e => onDragOver(e, i)}
          onDrop={e => onDrop(e, i)}
          onDragEnd={onDragEnd}
        >
          <PortfolioRowComp
            item={it}
            lang={lang}
            onChange={p => updItems(items.map((x, j) => j === i ? p : x))}
            onDelete={() => updItems(items.filter((_, j) => j !== i))}
            onUp={() => updItems(move(items, i, -1))}
            onDown={() => updItems(move(items, i, 1))}
            isFirst={i === 0}
            isLast={i === items.length - 1}
            skills={skills}
            isDragging={dragIdx === i}
            isDragOver={dragOver === i && dragIdx !== i}
          />
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button className="btn-outline-sm"
          onClick={() => updItems([...items, { id: uid(), img: '', caption: ml(''), showDesc: false, showTools: false, showQr: false }])}>
          <i className="fa-solid fa-plus" /> إضافة صورة يدوياً
        </button>
        <button
          onClick={() => setShowPicker(true)}
          style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid #7a3fb8', background: '#7a3fb808', color: '#7a3fb8', fontWeight: 700, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fa-solid fa-images" /> اختيار من قاعدة التصاميم
        </button>
      </div>

      {showPicker && (
        <ImagePickerModal
          gfxCategories={gfxCategories}
          skills={skills}
          existing={existingGfxIds}
          lang={lang}
          onAdd={p => updItems([...items, p])}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

function SectionEditor({ sec, lang, onChange, gfxCategories, skills }: {
  sec: CvSection; lang: LangKey; onChange: (s: CvSection) => void;
  gfxCategories: GfxCategory[]; skills: Skill[];
}) {
  const upd = (patch: Partial<CvSection>) => onChange({ ...sec, ...patch });
  const move = <T,>(list: T[], i: number, d: number): T[] => {
    const a = [...list]; const j = i + d;
    if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a;
  };

  if (sec.kind === 'skillbars') return <p style={{ fontSize: 13, color: '#888', margin: '6px 0' }}><i className="fa-solid fa-circle-info" /> يعرض هذا القسم أشرطة المهارات من قائمة "نسب المهارات" — عدّلها من تبويب المهارات.</p>;
  if (sec.kind === 'text') return <div className="form-group"><label>النص</label><MLInput value={sec.text || ml('')} lang={lang} multiline onChange={v => upd({ text: v })} /></div>;

  if (sec.kind === 'tags') {
    const tags = sec.tags || [];
    return <>
      {tags.map((tg, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1 }}><MLInput value={tg} lang={lang} onChange={v => upd({ tags: tags.map((x, j) => j === i ? v : x) })} /></div>
          <button className="btn-danger-sm" onClick={() => upd({ tags: tags.filter((_, j) => j !== i) })}><i className="fa-solid fa-trash-can" /></button>
        </div>
      ))}
      <button className="btn-outline-sm" onClick={() => upd({ tags: [...tags, ml('')] })}><i className="fa-solid fa-plus" /> إضافة عنصر</button>
    </>;
  }

  if (sec.kind === 'contact') {
    const items = sec.contactItems || [];
    return <>
      {items.map((it, i) => (
        <ContactRow key={it.id} item={it} lang={lang}
          onChange={c => upd({ contactItems: items.map((x, j) => j === i ? c : x) })}
          onDelete={() => upd({ contactItems: items.filter((_, j) => j !== i) })}
          onUp={() => upd({ contactItems: move(items, i, -1) })}
          onDown={() => upd({ contactItems: move(items, i, 1) })}
          isFirst={i === 0} isLast={i === items.length - 1} />
      ))}
      <button className="btn-outline-sm" onClick={() => upd({ contactItems: [...items, { id: uid(), label: ml(''), value: '', ltr: true }] })}><i className="fa-solid fa-plus" /> إضافة بيان تواصل</button>
    </>;
  }

  if (sec.kind === 'portfolio') {
    return (
      <PortfolioSectionEditor
        sec={sec}
        lang={lang}
        onChange={onChange}
        gfxCategories={gfxCategories}
        skills={skills}
      />
    );
  }

  const items = sec.entries || [];
  return <>
    {items.map((it, i) => (
      <EntryRow key={it.id} entry={it} lang={lang}
        onChange={e => upd({ entries: items.map((x, j) => j === i ? e : x) })}
        onDelete={() => upd({ entries: items.filter((_, j) => j !== i) })}
        onUp={() => upd({ entries: move(items, i, -1) })}
        onDown={() => upd({ entries: move(items, i, 1) })}
        isFirst={i === 0} isLast={i === items.length - 1} />
    ))}
    <button className="btn-outline-sm" onClick={() => upd({ entries: [...items, { id: uid(), from: '', to: 'present', title: ml(''), org: ml(''), desc: ml('') }] })}><i className="fa-solid fa-plus" /> إضافة إدخال</button>
  </>;
}

/* ── Sidebar Docs Editor ─────────────────────────────── */
function SidebarDocsEditor({ docs, lang, onChange }: { docs: CvSidebarDoc[]; lang: LangKey; onChange: (d: CvSidebarDoc[]) => void }) {
  return (
    <div>
      <label style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'block' }}>
        <i className="fa-solid fa-paperclip" /> وثائق الشريط الجانبي
      </label>
      {docs.map((d, i) => (
        <div key={d.id} className="cv-admin-form-card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="form-group"><label>العنوان</label>
              <MLInput value={d.title} lang={lang} onChange={v => { const a = [...docs]; a[i] = { ...a[i], title: v }; onChange(a); }} /></div>
            <div className="form-group"><label>أيقونة FA (مثال: fa-file-pdf)</label>
              <input type="text" value={d.icon} style={{ direction: 'ltr' }} onChange={e => { const a = [...docs]; a[i] = { ...a[i], icon: e.target.value }; onChange(a); }} /></div>
          </div>
          <div className="form-group"><label>رابط الملف / Drive URL</label>
            <input type="url" value={d.fileUrl} style={{ direction: 'ltr' }} placeholder="https://drive.google.com/..." onChange={e => { const a = [...docs]; a[i] = { ...a[i], fileUrl: e.target.value }; onChange(a); }} /></div>
          <button className="btn-danger-sm" onClick={() => onChange(docs.filter((_, j) => j !== i))}><i className="fa-solid fa-trash-can" /></button>
        </div>
      ))}
      <button className="btn-outline-sm" onClick={() => onChange([...docs, { id: uid(), title: ml(''), icon: 'fa-file', fileUrl: '' }])}>
        <i className="fa-solid fa-plus" /> إضافة وثيقة
      </button>
    </div>
  );
}

/* ── QR Credentials Editor ───────────────────────────── */
function QrCredentialsEditor({ items, lang, onChange }: { items: CvQrCredential[]; lang: LangKey; onChange: (q: CvQrCredential[]) => void }) {
  return (
    <div>
      <label style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'block' }}>
        <i className="fa-solid fa-qrcode" /> بيانات QR للتحقق
      </label>
      {items.map((q, i) => (
        <div key={q.id} className="cv-admin-form-card" style={{ marginBottom: 8 }}>
          <div className="form-group"><label>رابط Drive / التحقق</label>
            <input type="url" value={q.driveUrl} style={{ direction: 'ltr' }} placeholder="https://drive.google.com/..." onChange={e => { const a = [...items]; a[i] = { ...a[i], driveUrl: e.target.value }; onChange(a); }} /></div>
          <div className="form-group"><label>الوصف / Caption</label>
            <MLInput value={q.caption} lang={lang} onChange={v => { const a = [...items]; a[i] = { ...a[i], caption: v }; onChange(a); }} /></div>
          {q.driveUrl && (
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(q.driveUrl)}`} alt="QR" style={{ width: 60, height: 60, marginBottom: 6 }} />
          )}
          <button className="btn-danger-sm" onClick={() => onChange(items.filter((_, j) => j !== i))}><i className="fa-solid fa-trash-can" /></button>
        </div>
      ))}
      <button className="btn-outline-sm" onClick={() => onChange([...items, { id: uid(), driveUrl: '', caption: ml('') }])}>
        <i className="fa-solid fa-plus" /> إضافة رمز QR
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MAIN UNIFIED EDITOR
═══════════════════════════════════════════════════════ */
export function CvDocEditor({ data, onSave, onExport }: Props) {
  const [docs, setDocs] = useState<CvDoc[]>(() => data.cvDocs.length ? data.cvDocs : []);
  const [selId, setSelId] = useState<string>(() => data.cvDocs[0]?.id ?? '');
  const [lang, setLang] = useState<LangKey>('ar');
  const [previewLang, setPreviewLang] = useState<LangKey>('ar');
  const [addingKind, setAddingKind] = useState<CvSectionKind>('entries');
  const [savedMsg, setSavedMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'meta' | 'sections' | 'branding' | 'docs'>('meta');
  const photoRef = useRef<HTMLInputElement>(null);

  const doc = docs.find(d => d.id === selId) ?? docs[0];

  const flash = (m = 'تم الحفظ ✓') => { setSavedMsg(m); setTimeout(() => setSavedMsg(''), 2000); };
  const commit = (next: CvDoc[]) => { setDocs(next); onSave({ cvDocs: next }); };
  const mutate = (fn: (d: CvDoc) => CvDoc) => commit(docs.map(d => d.id === selId ? fn(d) : d));
  const setSection = (sid: string, s: CvSection) => mutate(d => ({ ...d, sections: d.sections.map(x => x.id === sid ? s : x) }));

  const moveSection = (sid: string, dir: number) => mutate(d => {
    const arr = [...d.sections]; const i = arr.findIndex(x => x.id === sid); const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return d;
    [arr[i], arr[j]] = [arr[j], arr[i]]; return { ...d, sections: arr };
  });

  if (!doc) {
    return (
      <div className="cv-admin-section">
        <p style={{ color: '#888' }}>لا توجد سير ذاتية. أنشئ واحدة:</p>
        <button className="btn-prime" onClick={() => { const nd = newDoc(); commit([nd]); setSelId(nd.id); }}>
          <i className="fa-solid fa-plus" /> سيرة ذاتية جديدة
        </button>
      </div>
    );
  }

  const header = doc.sections.find(s => s.kind === 'header');
  const bodySections = doc.sections.filter(s => s.kind !== 'header');

  return (
    <div className="cvx">
      {/* DOC SELECTOR */}
      <div className="cvx-docbar">
        {docs.map(d => (
          <div key={d.id} className="cvx-doc-wrap">
            <button className={`cvx-doc-btn${d.id === selId ? ' active' : ''}${!d.showInAbout ? ' cvx-doc-hidden' : ''}`}
              style={d.id === selId ? { borderColor: d.accent, color: d.accent } : undefined}
              onClick={() => setSelId(d.id)}>
              <i className={`fa-solid ${d.icon}`} />
              <span>{d.name}</span>
              {!d.showInAbout && <i className="fa-solid fa-eye-slash cvx-hidden-badge" title="مخفي من صفحة نبذة عني" />}
            </button>
            <button
              className={`cvx-visibility-btn${d.showInAbout ? ' visible' : ' hidden'}`}
              title={d.showInAbout ? 'إخفاء من صفحة "نبذة عني"' : 'إظهار في صفحة "نبذة عني"'}
              onClick={() => commit(docs.map(x => x.id === d.id ? { ...x, showInAbout: !x.showInAbout } : x))}
            >
              <i className={`fa-solid ${d.showInAbout ? 'fa-eye' : 'fa-eye-slash'}`} />
            </button>
          </div>
        ))}
        <button className="cvx-doc-btn cvx-doc-add" onClick={() => { const nd = newDoc(); commit([...docs, nd]); setSelId(nd.id); flash('تمت إضافة سيرة جديدة ✓'); }}>
          <i className="fa-solid fa-plus" /> <span>سيرة جديدة</span>
        </button>
      </div>

      {/* LANGUAGE TABS */}
      <div className="cvx-langbar">
        <span className="cvx-lang-hint">لغة التعبئة:</span>
        <div className="cvx-langs">
          {LANGS.map(l => (
            <button key={l.code} className={`cvx-lang-btn${lang === l.code ? ' active' : ''}`} onClick={() => setLang(l.code)}>
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      </div>

      {savedMsg && <div className="cv-admin-saved">{savedMsg}</div>}

      {/* SPLIT-SCREEN LAYOUT — 3 cols: sidebar | editor | preview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: 16, alignItems: 'start' }}>

        {/* SIDEBAR: vertical navigation */}
        <div className="cvx-sidebar">
          <div className="cvx-sidebar-label">
            <i className="fa-solid fa-sliders" /> الأقسام
          </div>
          {([
            ['meta',     'fa-id-card',     'الأساسيات'],
            ['branding', 'fa-palette',      'الألوان والتصميم'],
            ['docs',     'fa-qrcode',       'الوثائق والـ QR'],
            ['sections', 'fa-layer-group',  'الأقسام'],
          ] as [string, string, string][]).map(([tab, icon, label]) => (
            <button
              key={tab}
              className={`cvx-sidebar-btn${activeTab === tab ? ' active' : ''}`}
              style={activeTab === tab ? { background: doc.globalColor || '#003366' } : {}}
              onClick={() => setActiveTab(tab as any)}
            >
              <i className={`fa-solid ${icon}`} />
              {label}
            </button>
          ))}
        </div>

        {/* EDITOR: tab content */}
        <div>

          {/* META TAB */}
          {activeTab === 'meta' && (
            <div className="cv-admin-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <h4 style={{ margin: 0 }}><i className="fa-solid fa-id-card" /> الأساسيات</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-prime btn-sm" onClick={() => { onExport(doc, lang); flash('جاري التصدير...'); }}>
                    <i className="fa-solid fa-file-pdf" /> PDF ({lang.toUpperCase()})
                  </button>
                  {doc.removable && (
                    <button className="btn-danger-sm" onClick={() => { if (!confirm('حذف هذه السيرة نهائياً؟')) return; const next = docs.filter(d => d.id !== selId); commit(next); setSelId(next[0]?.id ?? ''); }}>
                      <i className="fa-solid fa-trash-can" /> حذف
                    </button>
                  )}
                </div>
              </div>

              <div className="cv-admin-photo-area" style={{ marginTop: 14 }}>
                {doc.photo
                  ? <img src={doc.photo} alt="" className="cv-admin-photo-preview" />
                  : <div className="cv-admin-photo-placeholder"><i className="fa-solid fa-user-tie" /></div>}
                <div>
                  <button className="btn-prime btn-sm" onClick={() => photoRef.current?.click()}>
                    <i className="fa-solid fa-upload" /> {doc.photo ? 'تغيير الصورة' : 'رفع صورة'}
                  </button>
                  {doc.photo && <button className="btn-cancel btn-sm" style={{ marginTop: 8, display: 'block' }} onClick={() => mutate(d => ({ ...d, photo: '' }))}><i className="fa-solid fa-trash-can" /> حذف</button>}
                  <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => mutate(d => ({ ...d, photo: ev.target?.result as string })); r.readAsDataURL(f); }} />
                </div>
              </div>

              <div className="form-group"><label>اسم السيرة (يظهر على الزر)</label>
                <input type="text" value={doc.name} onChange={e => mutate(d => ({ ...d, name: e.target.value }))} /></div>
              <div className="form-group"><label>الاسم الكامل (في رأس السيرة)</label>
                <MLInput value={doc.fullName} lang={lang} onChange={v => mutate(d => ({ ...d, fullName: v }))} placeholder="الاسم الكامل" /></div>
              <div className="form-group"><label>اللقب المهني</label>
                <MLInput value={doc.subtitle} lang={lang} onChange={v => mutate(d => ({ ...d, subtitle: v }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group"><label>سنة بداية الخبرة</label>
                  <input type="number" min={1980} max={2030} value={doc.since} onChange={e => mutate(d => ({ ...d, since: Number(e.target.value) }))} /></div>
                <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={doc.showInAbout} onChange={e => mutate(d => ({ ...d, showInAbout: e.target.checked }))} />
                    إظهار زر التحميل في "نبذة عني"
                  </label>
                </div>
              </div>
              {header && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 4 }}>
                  <input type="checkbox" checked={header.visible} onChange={e => setSection(header.id, { ...header, visible: e.target.checked })} />
                  إظهار رأس السيرة (الصورة والاسم)
                </label>
              )}
            </div>
          )}

          {/* BRANDING TAB */}
          {activeTab === 'branding' && (
            <div className="cv-admin-section">
              <h4><i className="fa-solid fa-palette" /> الألوان والتصميم</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>اللون الرئيسي للسيرة</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={doc.globalColor || doc.accent || '#003366'}
                      onChange={e => mutate(d => ({ ...d, globalColor: e.target.value, accent: e.target.value }))}
                      style={{ width: 48, height: 36, borderRadius: 6, border: '1px solid #dde', cursor: 'pointer' }} />
                    <input type="text" value={doc.globalColor || doc.accent || '#003366'} style={{ direction: 'ltr', flex: 1 }}
                      onChange={e => mutate(d => ({ ...d, globalColor: e.target.value, accent: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label>لون خلفية الفوتر</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="color" value={doc.footerBgColor || '#003366'}
                      onChange={e => mutate(d => ({ ...d, footerBgColor: e.target.value }))}
                      style={{ width: 48, height: 36, borderRadius: 6, border: '1px solid #dde', cursor: 'pointer' }} />
                    <input type="text" value={doc.footerBgColor || '#003366'} style={{ direction: 'ltr', flex: 1 }}
                      onChange={e => mutate(d => ({ ...d, footerBgColor: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="form-group"><label>نص الفوتر</label>
                <MLInput value={doc.footerText || { ar: '', en: '', de: '' }} lang={lang}
                  onChange={v => mutate(d => ({ ...d, footerText: v }))} placeholder="eng-alaa.com" /></div>
              <div className="form-group"><label>أيقونة FA للسيرة (مثال: fa-seedling)</label>
                <input type="text" value={doc.icon} style={{ direction: 'ltr' }} onChange={e => mutate(d => ({ ...d, icon: e.target.value }))} /></div>
            </div>
          )}

          {/* DOCS & QR TAB */}
          {activeTab === 'docs' && (
            <div className="cv-admin-section">
              <SidebarDocsEditor docs={doc.sidebarDocs || []} lang={lang}
                onChange={d => mutate(doc => ({ ...doc, sidebarDocs: d }))} />
              <div style={{ marginTop: 20 }}>
                <QrCredentialsEditor items={doc.qrCredentials || []} lang={lang}
                  onChange={q => mutate(doc => ({ ...doc, qrCredentials: q }))} />
              </div>
            </div>
          )}

          {/* SECTIONS TAB */}
          {activeTab === 'sections' && (
            <div>
              <h4 style={{ margin: '0 0 12px' }}><i className="fa-solid fa-layer-group" /> أقسام السيرة</h4>
              {bodySections.map((sec, idx) => (
                <div key={sec.id} className="cvx-section">
                  <div className="cvx-section-head">
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="cv-move-btn" disabled={idx === 0} onClick={() => moveSection(sec.id, -1)}><i className="fa-solid fa-chevron-up" /></button>
                      <button className="cv-move-btn" disabled={idx === bodySections.length - 1} onClick={() => moveSection(sec.id, 1)}><i className="fa-solid fa-chevron-down" /></button>
                    </div>
                    <div className="cvx-title-input">
                      <MLInput value={sec.title} lang={lang} onChange={v => setSection(sec.id, { ...sec, title: v })} placeholder="اسم القسم" />
                    </div>
                    <button className="btn-danger-sm" onClick={() => mutate(d => ({ ...d, sections: d.sections.filter(s => s.id !== sec.id) }))}><i className="fa-solid fa-trash-can" /></button>
                  </div>
                  <div className="cvx-section-meta">
                    <span className="cvx-kind-badge"><i className="fa-solid fa-tag" /> {KIND_LABELS[sec.kind]}</span>
                    <select value={sec.column} onChange={e => setSection(sec.id, { ...sec, column: e.target.value as CvSection['column'] })}>
                      {COLS.map(c => <option key={c.v} value={c.v}>{c.label}</option>)}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <input type="checkbox" checked={sec.visible} onChange={e => setSection(sec.id, { ...sec, visible: e.target.checked })} /> ظاهر
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={!!sec.pageBreakBefore}
                        onChange={e => setSection(sec.id, { ...sec, pageBreakBefore: e.target.checked })}
                      />
                      <span title="يبدأ القسم في صفحة جديدة عند التصدير">
                        <i className="fa-solid fa-scissors" style={{ marginInlineEnd: 3, color: '#7a3fb8' }} />
                        صفحة جديدة
                      </span>
                    </label>
                  </div>
                  <div className="cvx-section-body">
                    <SectionEditor
                      sec={sec}
                      lang={lang}
                      onChange={s => setSection(sec.id, s)}
                      gfxCategories={data.gfxCategories || []}
                      skills={data.skills || []}
                    />
                  </div>
                </div>
              ))}
              <div className="cvx-addbar">
                <select value={addingKind} onChange={e => setAddingKind(e.target.value as CvSectionKind)}>
                  {ADDABLE.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                </select>
                <button className="btn-prime btn-sm" onClick={() => mutate(d => ({ ...d, sections: [...d.sections, newSection(addingKind)] }))}>
                  <i className="fa-solid fa-plus" /> إضافة قسم جديد
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: LIVE A4 PREVIEW */}
        <div style={{ position: 'sticky', top: 80 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}><i className="fa-solid fa-eye" /> معاينة حية</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {LANGS.map(l => (
                <button key={l.code} onClick={() => setPreviewLang(l.code)}
                  style={{ padding: '3px 8px', borderRadius: 12, border: `1px solid ${previewLang === l.code ? (doc.globalColor||'#003366') : '#ccc'}`, background: previewLang === l.code ? (doc.globalColor||'#003366') : '#fff', color: previewLang === l.code ? '#fff' : '#333', fontSize: 11, cursor: 'pointer' }}>
                  {l.flag}
                </button>
              ))}
            </div>
            <button className="btn-prime btn-sm" style={{ marginInlineStart: 'auto' }} onClick={() => onExport(doc, previewLang)}>
              <i className="fa-solid fa-file-pdf" /> تصدير
            </button>
          </div>
          <div style={{ background: '#f4f4f4', borderRadius: 8, padding: 12, overflow: 'auto', maxHeight: '80vh' }}>
            <div className="a4-page" style={{ width: '210mm', direction: previewLang === 'ar' ? 'rtl' : 'ltr', transform: 'scale(0.62)', transformOrigin: 'top center', marginBottom: '-38%' }}>
              <CvRenderer doc={doc} lang={previewLang} name={data.name} skills={data.skills} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
