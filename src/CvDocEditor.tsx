import { useState, useRef, useEffect, useLayoutEffect, useCallback, type RefObject, type ReactNode } from 'react';
import {
  AppData, CvDoc, CvSection, CvSectionKind, CvEntryItem, CvContactItem,
  CvPortfolioItem, CvSidebarDoc, CvQrCredential, ML, LangKey, ml, pickML,
  GfxCategory, GfxProjectItem, Skill, uploadMediaFile, getApiToken, cvDocLabel,
  CvEditTarget, CvTypography, mergeCvTypography,
  CV_WEIGHT_OPTIONS, CV_TYPO_PX_MIN, CV_TYPO_PX_MAX, CvFontWeight, ensureML,
  CvHeaderStyle,
} from './appData';
import { CvRenderer } from './CvRenderer';
import { SkillIcon } from './SkillIcon';
import { CV_EXPORT_PX } from './cvPdfExport';
import { cvPdfSourceKind } from './cvPdfDownload';
import { MlObjectTranslateButton } from './MlTranslateControls';
import { CvAiImproveButton } from './CvAiImproveButton';
import { CvPlacementControls } from './CvPlacementControls';
import {
  initPageSequence, insertBlankAfter, movePageSlot, removePageAt,
  type CvPageSlot,
} from './cvPageSequence';
import {
  computeSectionPages, sectionBelongsToEditorPage,
} from './cvPageBands';
import type { CvContinuedPages, CvFooterLayout } from './appData';

function PageContextBar({
  pageCount, activePage, accent, onChange,
}: {
  pageCount: number; activePage: number; accent: string; onChange: (n: number) => void;
}) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
  return (
    <div className="cvx-page-context-bar" style={{
      display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
      marginBottom: 14, padding: '10px 12px', borderRadius: 10,
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85, marginInlineEnd: 4 }}>
        <i className="fa-solid fa-file-lines" /> تحرير الصفحة:
      </span>
      {pages.map(n => (
        <button key={n} type="button"
          className={`cvx-subnav-btn${activePage === n ? ' active' : ''}`}
          style={activePage === n ? { background: accent, borderColor: accent } : undefined}
          onClick={() => onChange(n)}>
          {n === 1 ? 'صفحة 1' : `صفحة ${n}`}
        </button>
      ))}
    </div>
  );
}

function FooterLayoutControls({
  layout, barWidthPct, textInside, accent,
  onLayout, onBarWidth, onTextInside, disabled,
}: {
  layout: CvFooterLayout;
  barWidthPct: number;
  textInside: boolean;
  accent: string;
  onLayout: (v: CvFooterLayout) => void;
  onBarWidth: (v: number) => void;
  onTextInside: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className="form-group">
        <label>شكل الشريط</label>
        <div className="cvx-chip-row">
          {([
            ['full-bleed', 'حواف كاملة', 'fa-maximize'],
            ['content-full', 'عرض المحتوى', 'fa-square'],
            ['bar', 'شريط + نص', 'fa-minus'],
          ] as const).map(([mode, lbl, icon]) => (
            <button key={mode} type="button" disabled={disabled}
              className={`btn-outline-sm${layout === mode ? ' active' : ''}`}
              style={layout === mode ? { borderColor: accent, color: accent, fontWeight: 700 } : {}}
              onClick={() => onLayout(mode)}>
              <i className={`fa-solid ${icon}`} /> {lbl}
            </button>
          ))}
        </div>
      </div>
      {layout === 'bar' && (
        <>
          <div className="form-group">
            <label>عرض الشريط الملون (%)</label>
            <input type="range" min={25} max={100} value={barWidthPct} disabled={disabled}
              onChange={e => onBarWidth(Number(e.target.value))} />
            <span className="cvx-range-val">{barWidthPct}%</span>
          </div>
          <label className="cvx-inline-check">
            <input type="checkbox" checked={textInside} disabled={disabled}
              onChange={e => onTextInside(e.target.checked)} />
            النص داخل الشريط
          </label>
        </>
      )}
    </>
  );
}

function ContinuedPageSettings({
  pageNum, pageCont, doc, lang, accent, disabled,
  onPatch,
}: {
  pageNum: number;
  pageCont: CvContinuedPages;
  doc: CvDoc;
  lang: LangKey;
  accent: string;
  disabled?: boolean;
  onPatch: (p: Partial<CvContinuedPages>) => void;
}) {
  const useFirstHeader = pageCont.useFirstPageHeader === true;
  const useFirstFooter = pageCont.useFirstPageFooter === true;
  const headerStyle = (pageCont.headerStyle ?? 'line') as CvHeaderStyle;
  const footerLayout = (pageCont.footerLayout ?? doc.footerLayout ?? 'content-full') as CvFooterLayout;

  return (
    <div style={{ opacity: disabled ? 0.55 : 1, pointerEvents: disabled ? 'none' : undefined }}>
      <h6 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: accent }}>
        <i className="fa-solid fa-file" /> إعدادات صفحة {pageNum}
      </h6>
      <div className="cvx-chip-row" style={{ marginBottom: 12 }}>
        <label className="cvx-inline-check">
          <input type="checkbox" checked={!!pageCont.hideHeader}
            onChange={e => onPatch({ hideHeader: e.target.checked, useFirstPageHeader: e.target.checked ? false : pageCont.useFirstPageHeader })} />
          إخفاء الترويسة
        </label>
        <label className="cvx-inline-check">
          <input type="checkbox" checked={!!pageCont.hideFooter}
            onChange={e => onPatch({ hideFooter: e.target.checked, useFirstPageFooter: e.target.checked ? false : pageCont.useFirstPageFooter })} />
          إخفاء التذييل
        </label>
      </div>

      {!pageCont.hideHeader && (
        <>
          <label className="cvx-inline-check" style={{ marginBottom: 10, display: 'flex' }}>
            <input type="checkbox" checked={useFirstHeader}
              onChange={e => onPatch({ useFirstPageHeader: e.target.checked })} />
            نفس ترويسة الصفحة 1 (صورة + اسم + لقب)
          </label>
          {!useFirstHeader && (
            <>
              <div className="form-group">
                <label>نص الترويسة — فارغ = الاسم فقط</label>
                <MLInput value={pageCont.headerText || { ar: '', en: '', de: '' }} lang={lang}
                  onChange={v => onPatch({ headerText: v })} />
              </div>
              <div className="form-group">
                <label>شكل الترويسة</label>
                <div className="cvx-chip-row">
                  {([
                    ['line', 'خط سفلي', 'fa-minus'],
                    ['bar', 'شريط كحلي', 'fa-square'],
                    ['full-bleed', 'حواف كاملة', 'fa-maximize'],
                  ] as const).map(([mode, lbl, icon]) => (
                    <button key={mode} type="button"
                      className={`btn-outline-sm${headerStyle === mode ? ' active' : ''}`}
                      style={headerStyle === mode ? { borderColor: accent, color: accent, fontWeight: 700 } : {}}
                      onClick={() => onPatch({ headerStyle: mode })}>
                      <i className={`fa-solid ${icon}`} /> {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>لون الترويسة</label>
                <div className="cvx-color-row">
                  <input type="color" value={pageCont.headerBgColor || doc.globalColor || doc.accent || '#003366'}
                    onChange={e => onPatch({ headerBgColor: e.target.value })} />
                  <input type="text" value={pageCont.headerBgColor || doc.globalColor || doc.accent || '#003366'}
                    style={{ direction: 'ltr' }}
                    onChange={e => onPatch({ headerBgColor: e.target.value })} />
                </div>
              </div>
              {headerStyle === 'bar' && (
                <div className="form-group">
                  <label>عرض شريط الترويسة (%)</label>
                  <input type="range" min={25} max={100} value={pageCont.headerBarWidthPct ?? 55}
                    onChange={e => onPatch({ headerBarWidthPct: Number(e.target.value) })} />
                  <span className="cvx-range-val">{pageCont.headerBarWidthPct ?? 55}%</span>
                </div>
              )}
              <div className="form-group">
                <label>ارتفاع الترويسة (mm)</label>
                <input type="range" min={10} max={55} value={pageCont.headerHeightMm ?? doc.headerHeightMm ?? 32}
                  onChange={e => onPatch({ headerHeightMm: Number(e.target.value) })} />
                <span className="cvx-range-val">{pageCont.headerHeightMm ?? doc.headerHeightMm ?? 32} mm</span>
              </div>
            </>
          )}
        </>
      )}

      {!pageCont.hideFooter && (
        <>
          <label className="cvx-inline-check" style={{ margin: '14px 0 10px', display: 'flex' }}>
            <input type="checkbox" checked={useFirstFooter}
              onChange={e => onPatch({ useFirstPageFooter: e.target.checked })} />
            نفس تذييل الصفحة 1 (شكل + لون + نص)
          </label>
          {!useFirstFooter && (
            <>
              <div className="form-group"><label>نص التذييل</label>
                <MLInput value={pageCont.footerText || { ar: '', en: '', de: '' }} lang={lang}
                  onChange={v => onPatch({ footerText: v })} /></div>
              <div className="form-group">
                <label>لون التذييل</label>
                <div className="cvx-color-row">
                  <input type="color" value={pageCont.footerBgColor || doc.footerBgColor || '#003366'}
                    onChange={e => onPatch({ footerBgColor: e.target.value })} />
                  <input type="text" value={pageCont.footerBgColor || doc.footerBgColor || '#003366'}
                    style={{ direction: 'ltr' }}
                    onChange={e => onPatch({ footerBgColor: e.target.value })} />
                </div>
              </div>
              <FooterLayoutControls
                layout={footerLayout}
                barWidthPct={pageCont.footerBarWidthPct ?? doc.footerBarWidthPct ?? 55}
                textInside={pageCont.footerTextInside ?? doc.footerTextInside === true}
                accent={accent}
                onLayout={v => onPatch({ footerLayout: v })}
                onBarWidth={v => onPatch({ footerBarWidthPct: v })}
                onTextInside={v => onPatch({ footerTextInside: v })}
              />
              <div className="form-group">
                <label>ارتفاع التذييل (mm)</label>
                <input type="range" min={8} max={30} value={pageCont.footerHeightMm ?? doc.footerHeightMm ?? 14}
                  onChange={e => onPatch({ footerHeightMm: Number(e.target.value) })} />
                <span className="cvx-range-val">{pageCont.footerHeightMm ?? doc.footerHeightMm ?? 14} mm</span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** A4 height at export pixel width */
const CV_PREVIEW_H = Math.round(CV_EXPORT_PX * (297 / 210));
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 7;

function clampZoom(z: number) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

const CV_TABS: { id: 'meta' | 'branding' | 'skills' | 'docs' | 'sections'; icon: string; label: string }[] = [
  { id: 'meta', icon: 'fa-id-card', label: 'الأساسيات' },
  { id: 'branding', icon: 'fa-palette', label: 'الألوان' },
  { id: 'skills', icon: 'fa-chart-bar', label: 'المهارات' },
  { id: 'docs', icon: 'fa-qrcode', label: 'الوثائق' },
  { id: 'sections', icon: 'fa-layer-group', label: 'الأقسام' },
];

type BrandingPanelId = 'colors' | 'layout' | 'spacing' | 'skills-spacing' | 'fonts' | 'sidebar-col' | 'dimensions' | 'continued' | 'icon';
type MetaPanelId = 'identity' | 'placement' | 'visitor-pdf';
type DocsPanelId = 'sidebar' | 'qr';

const BRANDING_PANELS: { id: BrandingPanelId; icon: string; label: string }[] = [
  { id: 'colors', icon: 'fa-palette', label: 'الألوان والفوتر' },
  { id: 'layout', icon: 'fa-table-columns', label: 'تخطيط الإدخالات' },
  { id: 'spacing', icon: 'fa-arrows-up-down', label: 'تباعد الإدخالات' },
  { id: 'skills-spacing', icon: 'fa-chart-bar', label: 'شرائط المهارات' },
  { id: 'fonts', icon: 'fa-font', label: 'أحجام الخط' },
  { id: 'sidebar-col', icon: 'fa-grip-lines-vertical', label: 'العمود الجانبي' },
  { id: 'dimensions', icon: 'fa-ruler-combined', label: 'أبعاد A4' },
  { id: 'continued', icon: 'fa-copy', label: 'صفحات لاحقة' },
  { id: 'icon', icon: 'fa-icons', label: 'أيقونة السيرة' },
];

const META_PANELS: { id: MetaPanelId; icon: string; label: string }[] = [
  { id: 'identity', icon: 'fa-user-tie', label: 'الهوية والصورة' },
  { id: 'placement', icon: 'fa-location-dot', label: 'موضع السيرة' },
  { id: 'visitor-pdf', icon: 'fa-file-pdf', label: 'PDF للزوار' },
];

const DOCS_PANELS: { id: DocsPanelId; icon: string; label: string }[] = [
  { id: 'sidebar', icon: 'fa-paperclip', label: 'وثائق الشريط' },
  { id: 'qr', icon: 'fa-qrcode', label: 'رموز QR' },
];

const SECTION_FILTERS: { id: CvSectionKind | 'all'; icon: string; label: string }[] = [
  { id: 'all', icon: 'fa-border-all', label: 'الكل' },
  { id: 'entries', icon: 'fa-briefcase', label: 'إدخالات' },
  { id: 'contact', icon: 'fa-address-book', label: 'تواصل' },
  { id: 'skillbars', icon: 'fa-chart-bar', label: 'مهارات' },
  { id: 'portfolio', icon: 'fa-images', label: 'معرض' },
  { id: 'tags', icon: 'fa-tags', label: 'وسوم' },
  { id: 'langtable', icon: 'fa-language', label: 'لغات' },
  { id: 'documents', icon: 'fa-qrcode', label: 'وثائق' },
  { id: 'text', icon: 'fa-align-left', label: 'نص' },
];

function CvxSettingsShell({ children }: { children: ReactNode }) {
  return <div className="cvx-settings-body">{children}</div>;
}

function CvxSubnavBtn({ active, accent, icon, label, onClick }: {
  active: boolean; accent: string; icon: string; label: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`cvx-subnav-btn${active ? ' active' : ''}`}
      style={active ? { background: accent, borderColor: accent } : undefined}
      onClick={onClick}
    >
      <i className={`fa-solid ${icon}`} />
      <span>{label}</span>
    </button>
  );
}

function CvxPanel({ title, icon, children, actions }: {
  title: string; icon: string; children: ReactNode; actions?: ReactNode;
}) {
  return (
    <section className="cvx-panel">
      <div className="cvx-panel-head">
        <h4 className="cvx-panel-title"><i className={`fa-solid ${icon}`} /> {title}</h4>
        {actions}
      </div>
      <div className="cvx-panel-body">{children}</div>
    </section>
  );
}

function CvxRadioGroup({ name, value, onChange, options }: {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="cvx-radio-group">
      {options.map(opt => (
        <label key={opt.value} className={`cvx-radio-chip${value === opt.value ? ' on' : ''}`}>
          <input type="radio" name={name} checked={value === opt.value} onChange={() => onChange(opt.value)} />
          <span>{opt.label}</span>
        </label>
      ))}
    </div>
  );
}

function CvxFilterBar({ items, active, accent, onChange }: {
  items: { id: string; icon: string; label: string }[];
  active: string;
  accent: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="cvx-filterbar" role="group" aria-label="تصفية الأقسام">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          className={`cvx-filterbar-btn${active === item.id ? ' active' : ''}`}
          style={active === item.id ? { background: accent, borderColor: accent } : undefined}
          onClick={() => onChange(item.id)}
        >
          <i className={`fa-solid ${item.icon}`} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function uid() { return Math.random().toString(36).slice(2, 9); }

interface Props {
  data: AppData;
  onSave: (updated: Partial<AppData>) => void | Promise<boolean>;
  onExport: (doc: CvDoc, lang: LangKey, previewEl?: HTMLElement | null, previewLang?: LangKey) => void;
}

const LANGS: { code: LangKey; label: string; flag: string }[] = [
  { code: 'ar', label: 'العربية', flag: '🇸🇾' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
];

const KIND_LABELS: Record<CvSectionKind, string> = {
  header: 'الصورة والعناوين', contact: 'بيانات التواصل',
  entries: 'إدخالات (خبرات / تعليم / مراجع)', tags: 'وسوم / مهارات نقطية',
  langtable: 'جدول اللغات', skillbars: 'أشرطة المهارات', portfolio: 'معرض صور',
  text: 'نص حر', documents: 'شبكة وثائق (باركود)',
};

const ADDABLE: CvSectionKind[] = ['entries', 'contact', 'tags', 'langtable', 'skillbars', 'portfolio', 'text', 'documents'];

const COLS: { v: CvSection['column']; label: string }[] = [
  { v: 'left', label: 'العمود الجانبي' },
  { v: 'right', label: 'العمود الرئيسي' },
  { v: 'full', label: 'عرض كامل' },
];

function newSection(kind: CvSectionKind, editorPage?: number): CvSection {
  const pinnedPage = editorPage && editorPage > 1 ? editorPage : undefined;
  return {
    id: uid(), kind,
    title: kind === 'skillbars'
      ? ml('خبرتي بالبرامج', 'My Software Skills', 'Software-Kenntnisse')
      : kind === 'langtable'
        ? ml('اللغات', 'Languages', 'Sprachen')
        : kind === 'documents'
          ? ml('الوثائق', 'Documents', 'Dokumente')
          : ml(KIND_LABELS[kind]),
    column: kind === 'portfolio' || kind === 'documents' ? 'full' : kind === 'entries' ? 'right' : 'left',
    visible: true,
    entries: kind === 'entries' ? [] : undefined,
    tags: kind === 'tags' ? [] : undefined,
    langRows: kind === 'langtable' ? [
      { id: uid(), cells: { name: ml('العربية', 'Arabic', 'Arabisch'), level: ml('اللغة الأم', 'Native', 'Muttersprache'), percent: 100 } },
      { id: uid(), cells: { name: ml('الإنجليزية', 'English', 'Englisch'), level: ml('متقدم', 'Advanced', 'Fortgeschritten'), percent: 85 } },
    ] : undefined,
    langTableCols: kind === 'langtable' ? [
      { id: 'name', header: ml('اللغة', 'Language', 'Sprache') },
      { id: 'level', header: ml('المستوى', 'Level', 'Niveau') },
      { id: 'percent', header: ml('النسبة %', '%', '%') },
    ] : undefined,
    langTableCellPadPx: kind === 'langtable' ? 5 : undefined,
    langTableColGapPx: kind === 'langtable' ? 0 : undefined,
    contactItems: kind === 'contact' ? [] : undefined,
    portfolio: kind === 'portfolio' ? [] : undefined,
    text: kind === 'text' ? ml('') : undefined,
    useGlobalSkills: kind === 'skillbars' ? true : undefined,
    skillIds: kind === 'skillbars' ? [] : undefined,
    galleryLayout: kind === 'portfolio' ? 2 : undefined,
    imgHeight: kind === 'portfolio' ? 130 : undefined,
    editorPage: pinnedPage,
    pageBreakBefore: pinnedPage ? true : undefined,
  };
}

function newDoc(): CvDoc {
  return {
    id: uid(), name: ml('سيرة مخصصة جديدة', 'New Custom CV', 'Neuer Lebenslauf'), removable: true,
    accent: '#7a3fb8', icon: 'fa-file-lines', photo: '', fullName: ml(''), subtitle: ml(''),
    since: new Date().getFullYear() - 1, showInAbout: false,
    globalColor: '#7a3fb8', footerBgColor: '#003366', footerText: ml('eng-alaa.com', 'eng-alaa.com', 'eng-alaa.com'),
    sidebarDocs: [], qrCredentials: [], qrGridCols: 3,
    sections: [
      { id: uid(), kind: 'header', title: ml('الصورة والعناوين'), column: 'full', visible: true },
      newSection('contact'),
      { ...newSection('entries'), title: ml('الخبرات المهنية', 'Experience', 'Berufserfahrung') },
    ],
  };
}

const CV_UNDO_MAX = 10;
const CV_SETTINGS_TEMPLATE_KEY = 'cv-branding-template-v1';

type CvSettingsTemplate = Pick<CvDoc,
  'globalColor' | 'accent' | 'footerBgColor' | 'footerText' | 'footerLayout' | 'footerBarWidthPct'
  | 'footerTextInside' | 'typography' | 'headerHeightMm' | 'footerHeightMm' | 'headerPhotoSize' | 'continuedPages'
>;

function extractSettingsTemplate(d: CvDoc): CvSettingsTemplate {
  return {
    globalColor: d.globalColor,
    accent: d.accent,
    footerBgColor: d.footerBgColor,
    footerText: d.footerText,
    footerLayout: d.footerLayout,
    footerBarWidthPct: d.footerBarWidthPct,
    footerTextInside: d.footerTextInside,
    typography: d.typography,
    headerHeightMm: d.headerHeightMm,
    footerHeightMm: d.footerHeightMm,
    headerPhotoSize: d.headerPhotoSize,
    continuedPages: d.continuedPages,
  };
}

function resetDocSettings(d: CvDoc): CvDoc {
  const defaults = newDoc();
  return {
    ...d,
    globalColor: defaults.globalColor,
    accent: defaults.accent,
    footerBgColor: defaults.footerBgColor,
    footerText: defaults.footerText,
    footerLayout: undefined,
    footerBarWidthPct: undefined,
    footerTextInside: undefined,
    typography: undefined,
    headerHeightMm: undefined,
    footerHeightMm: undefined,
    headerPhotoSize: undefined,
    continuedPages: undefined,
  };
}

export function MLInput({ value, lang, onChange, placeholder, multiline, dir, aiHint, rows }: {
  value: ML; lang: LangKey; onChange: (v: ML) => void;
  placeholder?: string; multiline?: boolean; dir?: 'rtl' | 'ltr';
  aiHint?: string; rows?: number;
}) {
  const safe = ensureML(value, ml(''));
  const [activeLang, setActiveLang] = useState<LangKey>(lang);
  useEffect(() => { setActiveLang(lang); }, [lang]);
  const set = (s: string) => onChange({ ...safe, [activeLang]: s });
  const filled = (k: LangKey) => (safe[k] || '').trim().length > 0;
  const isRtl = activeLang === 'ar';
  const fieldDir = dir ?? (isRtl ? 'rtl' : 'ltr');
  return (
    <div className="ml-input">
      {multiline
        ? <textarea className="ml-input-field" rows={rows ?? 3} value={safe[activeLang] || ''} placeholder={placeholder}
            style={{ direction: fieldDir }} onChange={e => set(e.target.value)} />
        : <input className="ml-input-field" type="text" value={safe[activeLang] || ''} placeholder={placeholder}
            style={{ direction: fieldDir }} onChange={e => set(e.target.value)} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
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
        <MlObjectTranslateButton small value={safe} onChange={onChange} context="CV resume" />
        <CvAiImproveButton
          small
          arabic={safe.ar || ''}
          fieldHint={aiHint || 'CV field'}
          onApplied={v => onChange({ ...safe, ...v })}
        />
      </div>
    </div>
  );
}

function EntryRow({ entry, lang, onChange, onDelete, onUp, onDown, isFirst, isLast, highlight }: {
  entry: CvEntryItem; lang: LangKey; onChange: (e: CvEntryItem) => void;
  onDelete: () => void; onUp: () => void; onDown: () => void; isFirst: boolean; isLast: boolean;
  highlight?: boolean;
}) {
  const orgLayout = entry.orgLayout === 'inline' ? 'inline' : 'block';
  const dateTitleLayout = entry.dateTitleLayout === 'inline' ? 'inline' : 'block';
  return (
    <div id={`cv-entry-${entry.id}`} className="cv-admin-form-card" style={{
      marginBottom: 10,
      outline: highlight ? '2px solid #7a3fb8' : undefined,
      outlineOffset: highlight ? 2 : undefined,
      borderRadius: highlight ? 10 : undefined,
    }}>
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
      <div className="form-group">
        <label>التاريخ والعنوان الرئيسي</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="radio" name={`date-title-layout-${entry.id}`} checked={dateTitleLayout === 'block'}
              onChange={() => onChange({ ...entry, dateTitleLayout: 'block' })} />
            العنوان أسفل التاريخ
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="radio" name={`date-title-layout-${entry.id}`} checked={dateTitleLayout === 'inline'}
              onChange={() => onChange({ ...entry, dateTitleLayout: 'inline' })} />
            نفس سطر التاريخ
          </label>
        </div>
      </div>
      <div className="form-group">
        <label>مكان الجهة بالسطر</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="radio" name={`org-layout-${entry.id}`} checked={orgLayout === 'block'}
              onChange={() => onChange({ ...entry, orgLayout: 'block' })} />
            سطر جديد (افتراضي)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="radio" name={`org-layout-${entry.id}`} checked={orgLayout === 'inline'}
              onChange={() => onChange({ ...entry, orgLayout: 'inline' })} />
            نفس سطر العنوان
          </label>
        </div>
      </div>
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
        <MLInput value={item.label} lang={lang} aiHint="contact label" onChange={v => onChange({ ...item, label: v })} /></div>
      <div className="form-group"><label>القيمة</label>
        <MLInput
          value={item.value}
          lang={lang}
          aiHint="contact value"
          dir={item.ltr ? 'ltr' : 'rtl'}
          onChange={v => onChange({ ...item, value: v })}
        /></div>
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
                  <SkillIcon icon={s.icon} name={s.name} size={12} /> {s.name}
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
                        <SkillIcon icon={sk.icon} name={sk.name} size={13} /> {sk.name}
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
function ImagePickerModal({ gfxCategories, skills, existing, onAdd, onClose }: {
  gfxCategories: GfxCategory[];
  skills: Skill[];
  existing: string[];
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
                        return sk ? <SkillIcon key={tid} icon={sk.icon} name={sk.name} size={13} /> : null;
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
          onAdd={p => updItems([...items, p])}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  );
}

function SkillbarsSectionEditor({ sec, skills, lang, docAccent, typo, onTypoChange, onChange }: {
  sec: CvSection; skills: Skill[]; lang: LangKey; docAccent: string;
  typo: Required<CvTypography>;
  onTypoChange: (patch: Partial<CvTypography>) => void;
  onChange: (s: CvSection) => void;
}) {
  const barColor = sec.skillBarColor || docAccent || '#003366';
  const selected = sec.skillIds?.length
    ? sec.skillIds
    : skills.map(s => s.id);

  const toggle = (id: string) => {
    const base = sec.skillIds?.length ? [...sec.skillIds] : skills.map(s => s.id);
    const next = base.includes(id) ? base.filter(x => x !== id) : [...base, id];
    onChange({ ...sec, skillIds: next, useGlobalSkills: next.length === skills.length });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="form-group" style={{ margin: 0 }}>
        <label>عنوان القسم في السيرة</label>
        <MLInput
          value={sec.title}
          lang={lang}
          onChange={v => onChange({ ...sec, title: v })}
          placeholder="خبرتي بالبرامج"
        />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label>لون أشرطة النسب المئوية</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="color"
            value={barColor}
            onChange={e => onChange({ ...sec, skillBarColor: e.target.value })}
            style={{ width: 48, height: 36, borderRadius: 6, border: '1px solid #dde', cursor: 'pointer' }}
          />
          <input
            type="text"
            value={sec.skillBarColor || ''}
            placeholder="افتراضي: لون السيرة"
            style={{ direction: 'ltr', flex: 1, minWidth: 120 }}
            onChange={e => onChange({ ...sec, skillBarColor: e.target.value || undefined })}
          />
          {sec.skillBarColor && (
            <button type="button" className="btn-outline-sm" onClick={() => onChange({ ...sec, skillBarColor: undefined })}>
              لون السيرة
            </button>
          )}
        </div>
        <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.08)', overflow: 'hidden', maxWidth: 220 }}>
          <div style={{ width: '75%', height: '100%', background: barColor }} />
        </div>
      </div>
      <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(120,160,255,0.2)', background: 'rgba(255,255,255,0.04)' }}>
        <h6 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: '#aab8d0' }}>
          <i className="fa-solid fa-ruler-horizontal" /> تباعد أشرطة المهارات (بكسل)
        </h6>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          <TypoControl label="بعد الأيقونة → اسم البرنامج" px={typo.skillIconNameGapPx} showWeight={false} min={0} max={32} step={1}
            onPx={v => onTypoChange({ skillIconNameGapPx: v })} />
          <TypoControl label="بعد الاسم → النسبة المئوية" px={typo.skillNamePctGapPx} showWeight={false} min={0} max={64} step={1}
            onPx={v => onTypoChange({ skillNamePctGapPx: v })} />
          <TypoControl label="بعد الصف (الاسم/النسبة) → الشريط" px={typo.skillHeaderBarGapPx} showWeight={false} min={0} max={32} step={1}
            onPx={v => onTypoChange({ skillHeaderBarGapPx: v })} />
          <TypoControl label="بين صفوف المهارات" px={typo.skillRowGapPx} showWeight={false} min={0} max={48} step={1}
            onPx={v => onTypoChange({ skillRowGapPx: v })} />
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#888', margin: 0 }}>
        <i className="fa-solid fa-circle-info" /> اختر البرامج من القائمة. النسب تُعدَّل من «إدارة المهارات».
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="btn-outline-sm" onClick={() => onChange({ ...sec, skillIds: skills.map(s => s.id), useGlobalSkills: true })}>
          تحديد الكل
        </button>
        <button type="button" className="btn-outline-sm" onClick={() => onChange({ ...sec, skillIds: [], useGlobalSkills: false })}>
          إلغاء الكل
        </button>
      </div>
      <div className="cv-skill-pick-grid">
        {skills.map(sk => (
          <label key={sk.id} className={`cv-skill-pick-item${selected.includes(sk.id) ? ' active' : ''}`}>
            <input type="checkbox" checked={selected.includes(sk.id)} onChange={() => toggle(sk.id)} />
            <SkillIcon icon={sk.icon} name={sk.name} size={18} />
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{sk.name}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: barColor }}>{sk.percent}%</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function EntriesSpacingPanel({ typo, onTypoChange }: {
  typo: Required<CvTypography>;
  onTypoChange: (patch: Partial<CvTypography>) => void;
}) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid rgba(120,160,255,0.2)', background: 'rgba(255,255,255,0.04)', marginBottom: 14 }}>
      <h6 style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, color: '#aab8d0' }}>
        <i className="fa-solid fa-ruler-vertical" /> تباعد الإدخالات في المعاينة (بكسل)
      </h6>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        <TypoControl label="بين إدخال وإدخال (خبرة ← خبرة)" px={typo.entryGapPx} showWeight={false} min={0} max={64} step={1}
          onPx={v => onTypoChange({ entryGapPx: v })} />
        <TypoControl label="بعد التاريخ → العنوان" px={typo.dateTitleGapPx} showWeight={false} min={0} max={48} step={1}
          onPx={v => onTypoChange({ dateTitleGapPx: v })} />
        <TypoControl label="بعد العنوان → الجهة" px={typo.titleOrgGapPx} showWeight={false} min={0} max={48} step={1}
          onPx={v => onTypoChange({ titleOrgGapPx: v })} />
        <TypoControl label="قبل التفاصيل" px={typo.entryDetailsGapPx} showWeight={false} min={0} max={48} step={1}
          onPx={v => onTypoChange({ entryDetailsGapPx: v })} />
      </div>
    </div>
  );
}

function SectionEditor({ sec, lang, docAccent, typo, onTypoChange, onChange, gfxCategories, skills, highlightEntryId }: {
  sec: CvSection; lang: LangKey; docAccent: string;
  typo: Required<CvTypography>;
  onTypoChange: (patch: Partial<CvTypography>) => void;
  onChange: (s: CvSection) => void;
  gfxCategories: GfxCategory[]; skills: Skill[];
  highlightEntryId?: string | null;
}) {
  const upd = (patch: Partial<CvSection>) => onChange({ ...sec, ...patch });
  const move = <T,>(list: T[], i: number, d: number): T[] => {
    const a = [...list]; const j = i + d;
    if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a;
  };

  if (sec.kind === 'skillbars') {
    return <SkillbarsSectionEditor sec={sec} skills={skills} lang={lang} docAccent={docAccent} typo={typo} onTypoChange={onTypoChange} onChange={onChange} />;
  }
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

  if (sec.kind === 'langtable') {
    const cols = sec.langTableCols?.length ? sec.langTableCols : [
      { id: 'name', header: ml('اللغة') },
      { id: 'level', header: ml('المستوى') },
      { id: 'percent', header: ml('%') },
    ];
    const rows = sec.langRows || [];
    const emptyCells = () => Object.fromEntries(cols.map(c => [c.id, c.id === 'percent' ? undefined : ml('')]));
    return <>
      <div className="cv-lang-table-settings" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="form-group">
          <label>تباعد داخل الخلايا (px)</label>
          <input type="number" min={2} max={20} value={sec.langTableCellPadPx ?? 5}
            onChange={e => upd({ langTableCellPadPx: Math.min(20, Math.max(2, Number(e.target.value) || 5)) })} />
        </div>
        <div className="form-group">
          <label>تباعد بين الأعمدة (px)</label>
          <input type="number" min={0} max={32} value={sec.langTableColGapPx ?? 0}
            onChange={e => upd({ langTableColGapPx: Math.min(32, Math.max(0, Number(e.target.value) || 0)) })} />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginBottom: 8 }}>
          <i className="fa-solid fa-table-columns" /> أعمدة الجدول
        </label>
        {cols.map((col, ci) => (
          <div key={col.id} className="cv-admin-form-card" style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }} className="form-group">
              <label>عنوان العمود {ci + 1}</label>
              <MLInput value={col.header} lang={lang}
                onChange={v => upd({ langTableCols: cols.map((x, j) => j === ci ? { ...x, header: v } : x) })} />
            </div>
            <button className="btn-danger-sm" disabled={cols.length <= 1}
              onClick={() => {
                const nextCols = cols.filter((_, j) => j !== ci);
                upd({
                  langTableCols: nextCols,
                  langRows: rows.map(r => {
                    const cells = { ...r.cells };
                    delete cells[col.id];
                    return { ...r, cells };
                  }),
                });
              }}><i className="fa-solid fa-trash-can" /></button>
          </div>
        ))}
        <button className="btn-outline-sm" onClick={() => {
          const id = uid();
          upd({
            langTableCols: [...cols, { id, header: ml('عمود جديد', 'New column', 'Neue Spalte') }],
            langRows: rows.map(r => ({ ...r, cells: { ...r.cells, [id]: ml('') } })),
          });
        }}><i className="fa-solid fa-plus" /> إضافة عمود</button>
      </div>
      {rows.map((row, i) => (
        <div key={row.id} className="cv-admin-form-card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cols.length, 3)}, 1fr)`, gap: 8 }}>
            {cols.map(col => (
              <div key={col.id} className="form-group">
                <label>{pickML(col.header, lang) || col.id}</label>
                {col.id === 'percent' ? (
                  <input type="number" min={0} max={100} value={typeof row.cells?.[col.id] === 'number' ? row.cells[col.id] as number : ''}
                    onChange={e => {
                      const n = e.target.value === '' ? undefined : Math.min(100, Math.max(0, Number(e.target.value)));
                      upd({ langRows: rows.map((x, j) => j === i ? { ...x, cells: { ...x.cells, [col.id]: n } } : x) });
                    }} />
                ) : (
                  <MLInput value={(row.cells?.[col.id] as ML) || ml('')} lang={lang}
                    onChange={v => upd({ langRows: rows.map((x, j) => j === i ? { ...x, cells: { ...x.cells, [col.id]: v } } : x) })} />
                )}
              </div>
            ))}
          </div>
          <button className="btn-danger-sm" onClick={() => upd({ langRows: rows.filter((_, j) => j !== i) })}><i className="fa-solid fa-trash-can" /></button>
        </div>
      ))}
      <button className="btn-outline-sm" onClick={() => upd({ langRows: [...rows, { id: uid(), cells: emptyCells() }] })}>
        <i className="fa-solid fa-plus" /> إضافة صف
      </button>
    </>;
  }

  if (sec.kind === 'documents') {
    return (
      <p style={{ fontSize: 12, color: 'var(--muted, #888)' }}>
        يعرض الوثائق من تبويب <b>الوثائق → رموز QR</b>. أضف الروابط والأوصاف هناك، وحدّد أعمدة الشبكة من نفس التبويب.
        هذا القسم يتحكم فقط بمكان العرض (عمود / عرض كامل).
      </p>
    );
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
      <button className="btn-outline-sm" onClick={() => upd({ contactItems: [...items, { id: uid(), label: ml(''), value: ml(''), ltr: true }] })}><i className="fa-solid fa-plus" /> إضافة بيان تواصل</button>
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
    <EntriesSpacingPanel typo={typo} onTypoChange={onTypoChange} />
    {items.map((it, i) => (
      <EntryRow key={it.id} entry={it} lang={lang}
        highlight={highlightEntryId === it.id}
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
function QrCredentialsEditor({ items, lang, gridCols, onChange, onGridCols }: {
  items: CvQrCredential[]; lang: LangKey; gridCols: number;
  onChange: (q: CvQrCredential[]) => void;
  onGridCols: (n: 2 | 3 | 4 | 5) => void;
}) {
  return (
    <div>
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: 700, fontSize: 13 }}>
          <i className="fa-solid fa-table-cells" /> أعمدة شبكة الباركود على A4
        </label>
        <select
          value={gridCols}
          onChange={e => onGridCols(Number(e.target.value) as 2 | 3 | 4 | 5)}
          style={{ maxWidth: 200 }}
        >
          <option value={2}>عمودان</option>
          <option value={3}>3 أعمدة</option>
          <option value={4}>4 أعمدة</option>
          <option value={5}>5 أعمدة</option>
        </select>
        <p style={{ fontSize: 11, color: 'var(--muted, #888)', marginTop: 6 }}>
          أضف قسم «شبكة وثائق» من تبويب الأقسام لعرض الباركودات في السيرة (الإعدادات هنا فقط).
        </p>
      </div>
      <label style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, display: 'block' }}>
        <i className="fa-solid fa-qrcode" /> الوثائق (اسم + رابط Drive + باركود)
      </label>
      {items.map((q, i) => (
        <div key={q.id} className="cv-admin-form-card" style={{ marginBottom: 8 }}>
          <div className="form-group"><label>رابط Drive / التحقق</label>
            <input type="url" value={q.driveUrl} style={{ direction: 'ltr' }} placeholder="https://drive.google.com/..." onChange={e => { const a = [...items]; a[i] = { ...a[i], driveUrl: e.target.value }; onChange(a); }} /></div>
          <div className="form-group"><label>الوصف / Caption</label>
            <MLInput multiline rows={3} value={q.caption} lang={lang}
              aiHint="QR document caption — short title under barcode"
              onChange={v => { const a = [...items]; a[i] = { ...a[i], caption: v }; onChange(a); }} /></div>
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

function clampTypoPx(v: number, min = CV_TYPO_PX_MIN, max = CV_TYPO_PX_MAX) {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function TypoControl({ label, px, weight, onPx, onWeight, min = CV_TYPO_PX_MIN, max = CV_TYPO_PX_MAX, step = 0.5, showWeight = true, unit = 'px' }: {
  label: string;
  px: number;
  weight?: CvFontWeight;
  onPx: (v: number) => void;
  onWeight?: (v: CvFontWeight) => void;
  min?: number;
  max?: number;
  step?: number;
  showWeight?: boolean;
  unit?: string;
}) {
  const safePx = clampTypoPx(px, min, max);
  const pxDisplay = step < 1 ? Math.round(safePx * 10) / 10 : Math.round(safePx);
  const resolvedWeight: CvFontWeight = weight ?? 700;
  return (
    <div className="form-group cv-typo-control" style={{ margin: 0 }}>
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step} value={safePx}
        onChange={e => onPx(clampTypoPx(Number(e.target.value), min, max))} />
      <div className="cv-typo-row">
        <input type="number" className="cv-typo-num" min={min} max={max} step={step} value={Number.isFinite(pxDisplay) ? pxDisplay : min}
          onChange={e => onPx(clampTypoPx(Number(e.target.value), min, max))} />
        {unit && <span className="cv-typo-unit">{unit}</span>}
        {showWeight && onWeight && (
          <select className="cv-typo-weight-select" value={resolvedWeight}
            onChange={e => onWeight(Number(e.target.value) as CvFontWeight)}>
            {CV_WEIGHT_OPTIONS.map(w => <option key={w.value} value={w.value}>{w.label} ({w.value})</option>)}
          </select>
        )}
      </div>
      {showWeight && onWeight && (
        <details className="cv-typo-weight-fold">
          <summary>أزرار سريعة للسمك</summary>
          <div className="cv-typo-weight-btns">
            {CV_WEIGHT_OPTIONS.map(w => (
              <button key={w.value} type="button"
                className={`cv-typo-weight-btn${resolvedWeight === w.value ? ' on' : ''}`}
                onClick={() => onWeight(w.value)}>
                {w.label}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

/* ── Fixed A4 preview dock (right) — pan & zoom ── */
function CvPreviewDock({
  doc, previewLang, name, skills, onExport, previewPageRef, onEditTarget, viewKey, onPageCount,
}: {
  doc: CvDoc; previewLang: LangKey; name: string; skills: Skill[];
  onExport: () => void;
  previewPageRef: RefObject<HTMLDivElement>;
  onEditTarget?: (t: CvEditTarget) => void;
  viewKey: string;
  onPageCount?: (n: number) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [baseFit, setBaseFit] = useState(0.4);
  const [userZoom, setUserZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [pageH, setPageH] = useState(CV_PREVIEW_H);
  const [pageCount, setPageCount] = useState(1);
  const pageHRef = useRef(pageH);
  const dragRef = useRef({ active: false, sx: 0, sy: 0, px: 0, py: 0 });
  const baseFitRef = useRef(baseFit);
  const userZoomRef = useRef(userZoom);
  const panRef = useRef(pan);
  const viewReadyRef = useRef(false);
  const prevPageHRef = useRef(pageH);
  baseFitRef.current = baseFit;
  userZoomRef.current = userZoom;
  panRef.current = pan;
  pageHRef.current = pageH;

  const totalScale = baseFit * userZoom;
  const zoomPct = Math.round(userZoom * 100);

  const computeBaseFit = useCallback((vpW: number, vpH: number) => {
    const byW = (vpW / CV_EXPORT_PX) * 0.92;
    const byH = (vpH / CV_PREVIEW_H) * 0.92;
    return Math.min(byW, byH);
  }, []);

  const applyPanForView = useCallback((bf: number, uz: number, contentH: number) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const w = vp.clientWidth;
    const h = vp.clientHeight;
    if (w <= 0 || h <= 0) return;
    const s = bf * uz;
    const visibleH = Math.min(contentH, CV_PREVIEW_H) * s;
    const p = { x: (w - CV_EXPORT_PX * s) / 2, y: Math.max(0, (h - visibleH) / 2) };
    panRef.current = p;
    setPan(p);
  }, []);

  const updateBaseFit = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp || vp.clientWidth <= 0 || vp.clientHeight <= 0) return;
    const bf = computeBaseFit(vp.clientWidth, vp.clientHeight);
    baseFitRef.current = bf;
    setBaseFit(bf);
    if (viewReadyRef.current && !dragRef.current.active) {
      applyPanForView(bf, userZoomRef.current, pageHRef.current);
    }
  }, [computeBaseFit, applyPanForView]);

  const recenterView = useCallback(() => {
    if (dragRef.current.active) return;
    updateBaseFit();
    applyPanForView(baseFitRef.current, userZoomRef.current, pageHRef.current);
    viewReadyRef.current = true;
  }, [updateBaseFit, applyPanForView]);

  const zoomAtCenter = useCallback((factor: number) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const w = vp.clientWidth;
    const cx = w / 2;
    const cy = vp.clientHeight / 2;
    const bf = baseFitRef.current;
    const uzOld = userZoomRef.current;
    const uzNew = clampZoom(uzOld * factor);
    if (uzNew === uzOld) return;
    const sOld = bf * uzOld;
    const sNew = bf * uzNew;
    const p = panRef.current;
    const docX = (cx - p.x) / sOld;
    const docY = (cy - p.y) / sOld;
    setPan({
      x: cx - docX * sNew,
      y: cy - docY * sNew,
    });
    setUserZoom(uzNew);
  }, []);

  useLayoutEffect(() => {
    const el = previewPageRef.current;
    if (!el) return;
    const measure = () => {
      const newH = Math.max(CV_PREVIEW_H, el.scrollHeight, el.offsetHeight);
      pageHRef.current = newH;
      setPageH(newH);
      const pageCount = Number(el.querySelector('.cv-paged-root')?.getAttribute('data-cv-page-count') || 1);
      setPageCount(pageCount);
      onPageCount?.(pageCount);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc, previewLang, previewPageRef]);

  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onResize = () => updateBaseFit();
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(vp);
    return () => ro.disconnect();
  }, [updateBaseFit]);

  useLayoutEffect(() => {
    if (!viewReadyRef.current || dragRef.current.active) return;
    applyPanForView(baseFitRef.current, userZoomRef.current, pageH);
    prevPageHRef.current = pageH;
  }, [pageH, applyPanForView]);

  useLayoutEffect(() => {
    setUserZoom(1);
    userZoomRef.current = 1;
    viewReadyRef.current = false;
    recenterView();
    prevPageHRef.current = pageHRef.current;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      recenterView();
      prevPageHRef.current = pageHRef.current;
    }));
  }, [viewKey, recenterView]);

  const resetView = () => {
    setUserZoom(1);
    userZoomRef.current = 1;
    recenterView();
    prevPageHRef.current = pageHRef.current;
  };

  const zoomBy = (factor: number) => zoomAtCenter(factor);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAtCenter(e.deltaY < 0 ? 1.1 : 1 / 1.1);
    };
    vp.addEventListener('wheel', onWheel, { passive: false });
    return () => vp.removeEventListener('wheel', onWheel);
  }, [zoomAtCenter]);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.cv-edit-hit, .cvx-preview-zoom-btn')) return;
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    setPan({
      x: dragRef.current.px + (e.clientX - dragRef.current.sx),
      y: dragRef.current.py + (e.clientY - dragRef.current.sy),
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current.active = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  return (
    <aside className="cvx-preview-dock" aria-label="معاينة السيرة A4">
      <div className="cvx-dock-head">
        <span className="cvx-preview-label">
          <i className="fa-solid fa-file-lines" /> معاينة A4
          <span style={{ marginInlineStart: 8, fontSize: 12, opacity: 0.75 }}>
            ({pageCount} {pageCount === 1 ? 'صفحة' : 'صفحات'})
          </span>
        </span>
        <span className="cvx-dock-hint">انقر على النص للتعديل · اسحب للتحريك · عجلة للتكبير</span>
      </div>
      <div
        ref={viewportRef}
        className="cvx-preview-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={previewPageRef}
          className="cv-preview-stack cvx-preview-stack-abs"
          style={{
            width: CV_EXPORT_PX,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${totalScale})`,
            transformOrigin: 'top left',
          }}
        >
          <CvRenderer doc={doc} lang={previewLang} name={name} skills={skills} editMode onEditTarget={onEditTarget} />
        </div>
      </div>
      <div className="cvx-preview-zoombar">
        <button type="button" className="cvx-preview-zoom-btn" title="تصغير" onClick={() => zoomBy(1 / 1.15)}>
          <i className="fa-solid fa-minus" />
        </button>
        <span className="cvx-preview-zoom-pct">{zoomPct}%</span>
        <button type="button" className="cvx-preview-zoom-btn" title="تكبير" onClick={() => zoomBy(1.15)}>
          <i className="fa-solid fa-plus" />
        </button>
        <button type="button" className="cvx-preview-zoom-btn cvx-preview-zoom-reset" title="ملائمة الشاشة" onClick={resetView}>
          <i className="fa-solid fa-compress" /> ملائمة
        </button>
        <button type="button" className="btn-prime btn-sm cvx-export-btn" onClick={onExport}>
          <i className="fa-solid fa-print" /> PDF
        </button>
      </div>
    </aside>
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
  const [activeTab, setActiveTab] = useState<'meta' | 'sections' | 'branding' | 'docs' | 'skills'>('meta');
  const [brandingPanel, setBrandingPanel] = useState<BrandingPanelId>('colors');
  const [metaPanel, setMetaPanel] = useState<MetaPanelId>('identity');
  const [docsPanel, setDocsPanel] = useState<DocsPanelId>('sidebar');
  const [sectionsFilter, setSectionsFilter] = useState<CvSectionKind | 'all'>('all');
  const undoStackRef = useRef<CvDoc[][]>([]);
  const skipUndoRef = useRef(false);
  const [undoSteps, setUndoSteps] = useState(0);
  const [hasSettingsTemplate, setHasSettingsTemplate] = useState(
    () => typeof localStorage !== 'undefined' && !!localStorage.getItem(CV_SETTINGS_TEMPLATE_KEY),
  );
  const photoRef = useRef<HTMLInputElement>(null);
  const pdfRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const previewPageRef = useRef<HTMLDivElement>(null);
  const editorMainRef = useRef<HTMLDivElement>(null);
  const editorScrollTopRef = useRef(0);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [editHighlight, setEditHighlight] = useState<{ sectionId?: string; entryId?: string } | null>(null);

  const handlePreviewEdit = useCallback((target: CvEditTarget) => {
    setActiveTab(target.tab);
    if (target.tab === 'sections' && target.sectionId) {
      setEditHighlight({ sectionId: target.sectionId, entryId: target.entryId });
    } else {
      setEditHighlight(null);
    }
  }, []);

  useEffect(() => {
    if (!editHighlight?.sectionId || activeTab !== 'sections') return;
    const { sectionId, entryId } = editHighlight;
    const scrollTimer = window.setTimeout(() => {
      if (entryId) {
        document.getElementById(`cv-entry-${entryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
    const clearTimer = window.setTimeout(() => setEditHighlight(null), 4500);
    return () => { window.clearTimeout(scrollTimer); window.clearTimeout(clearTimer); };
  }, [editHighlight, activeTab]);

  useEffect(() => {
    undoStackRef.current = [];
    setUndoSteps(0);
  }, [selId]);

  const [pdfUploading, setPdfUploading] = useState<string | null>(null);
  const [previewPageCount, setPreviewPageCount] = useState(1);
  const [editPageNum, setEditPageNum] = useState(1);

  useEffect(() => {
    setEditPageNum(n => Math.min(Math.max(1, n), Math.max(1, previewPageCount)));
  }, [previewPageCount]);

  const uploadPdfForDoc = async (docId: string, l: LangKey, files: FileList | null) => {
    if (!files?.[0]) return;
    const f = files[0];
    if (!f.type.includes('pdf') && !f.name.toLowerCase().endsWith('.pdf')) {
      alert('ملف PDF فقط');
      return;
    }
    const uploadKey = `${docId}-${l}`;
    setPdfUploading(uploadKey);
    try {
      const token = getApiToken();
      if (token) {
        const url = await uploadMediaFile(f, 'cv');
        if (url) {
          applyDocs(docs.map(d => d.id === docId
            ? { ...d, pdfFiles: { ...(d.pdfFiles || {}), [l]: url } }
            : d), { flashMsg: `PDF ${l.toUpperCase()} ✓ — تم الرفع للخادم` });
          return;
        }
        alert('فشل الرفع — تأكد من اتصال MySQL في إعدادات الموقع');
        return;
      }
      if (f.size > 800 * 1024) {
        alert('الملف كبير — سجّل الدخول للخادم أولاً (إعدادات الموقع → MySQL) ثم ارفع PDF');
        return;
      }
      const r = new FileReader();
      r.onload = ev => {
        const dataUrl = ev.target?.result as string;
        applyDocs(docs.map(d => d.id === docId
          ? { ...d, pdfFiles: { ...(d.pdfFiles || {}), [l]: dataUrl } }
          : d), { flashMsg: `PDF ${l.toUpperCase()} ✓ (محلي فقط — اربط الخادم للزوار)` });
      };
      r.readAsDataURL(f);
    } finally {
      setPdfUploading(null);
    }
  };

  const setPdfDriveUrlForDoc = (docId: string, l: LangKey, rawUrl: string) => {
    const trimmed = rawUrl.trim();
    applyDocs(docs.map(d => {
      if (d.id !== docId) return d;
      if (!trimmed) {
        const next = { ...(d.pdfFiles || {}) };
        delete next[l];
        return { ...d, pdfFiles: Object.keys(next).length ? next : undefined };
      }
      return { ...d, pdfFiles: { ...(d.pdfFiles || {}), [l]: trimmed } };
    }), { flashMsg: trimmed ? `رابط Drive ${l.toUpperCase()} ✓` : undefined });
  };

  const pdfSourceLabel = (cvDoc: CvDoc, l: LangKey) => {
    const kind = cvPdfSourceKind(cvDoc, l);
    if (kind === 'drive') return <span className="cvx-pdf-ok"><i className="fa-brands fa-google-drive" /> Drive</span>;
    if (kind === 'upload') return <span className="cvx-pdf-ok"><i className="fa-solid fa-circle-check" /> مرفوع</span>;
    return <span className="cvx-pdf-auto"><i className="fa-solid fa-wand-magic-sparkles" /> من الإعدادات</span>;
  };

  const doc = docs.find(d => d.id === selId) ?? docs[0];

  const flash = (m = 'تم الحفظ ✓') => { setSavedMsg(m); setTimeout(() => setSavedMsg(''), 2000); };

  const persistDocs = useCallback((next: CvDoc[], msg?: string) => {
    const result = onSave({ cvDocs: next });
    if (result && typeof (result as Promise<boolean>).then === 'function') {
      void (result as Promise<boolean>).then(synced => {
        if (msg) flash(msg);
        else if (synced) flash('تم الحفظ في قاعدة البيانات ✓');
        else if (getApiToken()) flash('حُفظ محلياً — فشل رفع قاعدة البيانات');
        else flash('حُفظ محلياً — اربط MySQL من إعدادات الموقع');
      });
    } else {
      flash(msg);
    }
  }, [onSave]);

  const recordUndo = useCallback(() => {
    if (skipUndoRef.current) return;
    undoStackRef.current = [
      ...undoStackRef.current.slice(-(CV_UNDO_MAX - 1)),
      JSON.parse(JSON.stringify(docs)) as CvDoc[],
    ];
    setUndoSteps(undoStackRef.current.length);
  }, [docs]);

  const applyDocs = useCallback((next: CvDoc[], opts?: { skipUndo?: boolean; persist?: boolean; flashMsg?: string }) => {
    if (editorMainRef.current) {
      editorScrollTopRef.current = editorMainRef.current.scrollTop;
    }
    if (!opts?.skipUndo) recordUndo();
    setDocs(next);
    if (opts?.persist !== false) persistDocs(next, opts?.flashMsg);
    else if (opts?.flashMsg) flash(opts.flashMsg);
  }, [persistDocs, recordUndo]);

  useLayoutEffect(() => {
    const el = editorMainRef.current;
    if (el) el.scrollTop = editorScrollTopRef.current;
  }, [docs, activeTab, brandingPanel, metaPanel, docsPanel, sectionsFilter]);

  const commit = (next: CvDoc[], opts?: { skipUndo?: boolean; flashMsg?: string }) => {
    applyDocs(next, opts);
  };

  const mutate = (fn: (d: CvDoc) => CvDoc) => applyDocs(docs.map(d => d.id === selId ? fn(d) : d));
  const setSection = (sid: string, s: CvSection) => mutate(d => ({ ...d, sections: d.sections.map(x => x.id === sid ? s : x) }));

  const saveNow = () => persistDocs(docs, 'تم حفظ السيرة ✓');

  const undo = () => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    skipUndoRef.current = true;
    setDocs(prev);
    setUndoSteps(undoStackRef.current.length);
    skipUndoRef.current = false;
    persistDocs(prev, 'تراجع ✓');
  };

  const restoreDefaults = () => {
    if (!confirm('استعادة جميع إعدادات التصميم (ألوان، خطوط، تباعد، أبعاد) إلى الافتراضي؟\nالمحتوى والأقسام تبقى كما هي.')) return;
    applyDocs(docs.map(d => d.id === selId ? resetDocSettings(d) : d), { flashMsg: 'تمت استعادة الإعدادات الافتراضية ✓' });
  };

  const saveSettingsTemplate = () => {
    try {
      localStorage.setItem(CV_SETTINGS_TEMPLATE_KEY, JSON.stringify(extractSettingsTemplate(doc)));
      setHasSettingsTemplate(true);
      flash('تم حفظ قالب الإعدادات ✓');
    } catch {
      alert('تعذّر حفظ القالب محلياً');
    }
  };

  const applySettingsTemplate = () => {
    try {
      const raw = localStorage.getItem(CV_SETTINGS_TEMPLATE_KEY);
      if (!raw) { alert('لا يوجد قالب إعدادات محفوظ'); return; }
      const template = JSON.parse(raw) as CvSettingsTemplate;
      mutate(d => ({ ...d, ...template }));
      flash('تم تطبيق القالب المحفوظ ✓');
    } catch {
      alert('تعذّر قراءة القالب المحفوظ');
    }
  };

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
      {savedMsg && <div className="cv-admin-saved cvx-toast">{savedMsg}</div>}

      <div className="cvx-stack">
        {/* DOC SELECTOR */}
        <div className="cvx-docbar">
          {docs.map(d => (
            <div key={d.id} className="cvx-doc-wrap">
              <button className={`cvx-doc-btn${d.id === selId ? ' active' : ''}${!d.showInAbout ? ' cvx-doc-hidden' : ''}`}
                style={d.id === selId ? { borderColor: d.accent, color: d.accent } : undefined}
                onClick={() => setSelId(d.id)}>
                <i className={`fa-solid ${d.icon}`} />
                <span>{cvDocLabel(d, previewLang)}</span>
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

        {/* ── Fixed top: toolbar + tabs + sub-nav (never scrolls away) ── */}
        <div className="cvx-top-chrome">
          <div className="cvx-preview-toolbar">
            <span className="cvx-preview-label"><i className="fa-solid fa-pen-to-square" /> محرر السيرة</span>
            <span className="cvx-dock-hint cvx-top-hint">المعاينة ثابتة يميناً — انقر على أي نص فيها للانتقال للتعديل</span>
            <div className="cvx-preview-langs">
              {LANGS.map(l => (
                <button key={l.code} type="button" className={`cvx-preview-lang${previewLang === l.code ? ' active' : ''}`}
                  style={previewLang === l.code ? { background: doc.globalColor || '#003366', borderColor: doc.globalColor || '#003366' } : undefined}
                  onClick={() => setPreviewLang(l.code)}
                  title={`معاينة ${l.label}`}>
                  {l.flag}
                </button>
              ))}
            </div>
            <div className="cvx-global-actions">
              <button
                type="button"
                className="cvx-action-btn"
                disabled={undoSteps === 0}
                title="تراجع (حتى 10 خطوات)"
                onClick={undo}
              >
                <i className="fa-solid fa-undo" /> تراجع{undoSteps > 0 ? ` (${undoSteps})` : ''}
              </button>
              <button type="button" className="cvx-action-btn cvx-action-save" onClick={saveNow} title="حفظ السيرة">
                <i className="fa-solid fa-floppy-disk" /> حفظ
              </button>
              <button type="button" className="cvx-action-btn" onClick={restoreDefaults} title="استعادة إعدادات التصميم الافتراضية">
                <i className="fa-solid fa-arrows-rotate" /> افتراضي
              </button>
              <button type="button" className="cvx-action-btn" onClick={saveSettingsTemplate} title="حفظ الإعدادات الحالية كقالب">
                <i className="fa-solid fa-bookmark" /> حفظ قالب
              </button>
              {hasSettingsTemplate && (
                <button type="button" className="cvx-action-btn" onClick={applySettingsTemplate} title="تطبيق القالب المحفوظ">
                  <i className="fa-solid fa-wand-magic-sparkles" /> تطبيق قالب
                </button>
              )}
            </div>
            <button type="button" className="btn-prime btn-sm cvx-export-btn cvx-export-top" onClick={() => onExport(doc, previewLang, previewPageRef.current, previewLang)}>
              <i className="fa-solid fa-print" /> طباعة / PDF
            </button>
          </div>
          <nav className="cvx-tabbar" aria-label="أقسام محرر السيرة">
            {CV_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                className={`cvx-tabbar-btn${activeTab === tab.id ? ' active' : ''}`}
                style={activeTab === tab.id ? { background: doc.globalColor || '#003366', borderColor: doc.globalColor || '#003366' } : undefined}
                onClick={() => setActiveTab(tab.id)}
              >
                <i className={`fa-solid ${tab.icon}`} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {(activeTab === 'meta' || activeTab === 'branding' || activeTab === 'docs' || activeTab === 'sections') && (
          <div className="cvx-subnav-strip" role="navigation" aria-label="قائمة الإعدادات الفرعية">
            {activeTab === 'meta' && META_PANELS.map(p => (
              <CvxSubnavBtn
                key={p.id}
                active={metaPanel === p.id}
                accent={doc.globalColor || doc.accent || '#003366'}
                icon={p.icon}
                label={p.label}
                onClick={() => setMetaPanel(p.id)}
              />
            ))}
            {activeTab === 'branding' && BRANDING_PANELS.map(p => (
              <CvxSubnavBtn
                key={p.id}
                active={brandingPanel === p.id}
                accent={doc.globalColor || doc.accent || '#003366'}
                icon={p.icon}
                label={p.label}
                onClick={() => setBrandingPanel(p.id)}
              />
            ))}
            {activeTab === 'docs' && DOCS_PANELS.map(p => (
              <CvxSubnavBtn
                key={p.id}
                active={docsPanel === p.id}
                accent={doc.globalColor || doc.accent || '#003366'}
                icon={p.icon}
                label={p.label}
                onClick={() => setDocsPanel(p.id)}
              />
            ))}
            {activeTab === 'sections' && (
              <CvxFilterBar
                items={SECTION_FILTERS}
                active={sectionsFilter}
                accent={doc.globalColor || doc.accent || '#003366'}
                onChange={id => setSectionsFilter(id as CvSectionKind | 'all')}
              />
            )}
          </div>
          )}
        </div>

        {/* ── Editor (scroll) + fixed A4 preview (right) ── */}
        <div className="cvx-workspace">
        <div className="cvx-editor-column">
        <div className="cvx-editor-main" ref={editorMainRef}>

          {/* META TAB */}
          {activeTab === 'meta' && (
            <CvxSettingsShell>
              {metaPanel === 'identity' && (
                <CvxPanel
                  title="الهوية والصورة"
                  icon="fa-user-tie"
                  actions={(
                    <div className="cvx-panel-actions">
                      <button className="btn-prime btn-sm" onClick={() => { onExport(doc, lang, previewPageRef.current, previewLang); flash('جاري فتح الطباعة…'); }}>
                        <i className="fa-solid fa-print" /> PDF ({lang.toUpperCase()})
                      </button>
                      {doc.removable && (
                        <button className="btn-danger-sm" onClick={() => { if (!confirm('حذف هذه السيرة نهائياً؟')) return; const next = docs.filter(d => d.id !== selId); commit(next); setSelId(next[0]?.id ?? ''); }}>
                          <i className="fa-solid fa-trash-can" /> حذف
                        </button>
                      )}
                    </div>
                  )}
                >
                  <div className="cv-admin-photo-area">
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
                    <MLInput value={doc.name} lang={lang} onChange={v => mutate(d => ({ ...d, name: v }))} placeholder="سيرة الزراعة" /></div>
                  <div className="form-group"><label>الاسم الكامل (في رأس السيرة)</label>
                    <MLInput value={doc.fullName} lang={lang} onChange={v => mutate(d => ({ ...d, fullName: v }))} placeholder="الاسم الكامل" /></div>
                  <div className="form-group"><label>اللقب المهني</label>
                    <MLInput value={doc.subtitle} lang={lang} onChange={v => mutate(d => ({ ...d, subtitle: v }))} /></div>
                  <div className="cvx-form-grid-2">
                    <div className="form-group"><label>سنة بداية الخبرة</label>
                      <input type="number" min={1980} max={2030} value={doc.since} onChange={e => mutate(d => ({ ...d, since: Number(e.target.value) }))} /></div>
                    <div className="form-group cvx-form-check">
                      <label>
                        <input type="checkbox" checked={doc.showInAbout} onChange={e => mutate(d => ({ ...d, showInAbout: e.target.checked }))} />
                        إظهار زر التحميل في "نبذة عني"
                      </label>
                    </div>
                  </div>
                  {header && (
                    <label className="cvx-inline-check">
                      <input type="checkbox" checked={header.visible} onChange={e => setSection(header.id, { ...header, visible: e.target.checked })} />
                      إظهار رأس السيرة (الصورة والاسم)
                    </label>
                  )}
                </CvxPanel>
              )}
              {metaPanel === 'placement' && (
                <CvxPanel title="موضع السيرة في الموقع" icon="fa-location-dot">
                  <CvPlacementControls data={data} onSave={onSave} />
                </CvxPanel>
              )}
              {metaPanel === 'visitor-pdf' && (
                <CvxPanel title="ملفات PDF للزوار (6 ملفات)" icon="fa-file-pdf">
                  <p className="cvx-panel-hint">
                    لكل لغة: ارفع ملف PDF، أو الصق رابط Google Drive، أو اضغط «تصدير» لإنشاء PDF من السيرة الحالية.
                    إن لم تُرفع ملفاً خارجياً، يُنزَّل للزائر تلقائياً من إعدادات السيرة في المحرر.
                  </p>
                  {(['agri', 'dev'] as const).map(docId => {
                    const cvDoc = docs.find(d => d.id === docId);
                    if (!cvDoc) return null;
                    const title = docId === 'agri' ? 'سيرة الزراعة' : 'سيرة التصميم';
                    return (
                      <div key={docId} style={{ marginBottom: 24 }}>
                        <h5 style={{ margin: '0 0 10px', fontSize: 14, color: '#8ec8ff' }}>
                          <i className={`fa-solid ${cvDoc.icon}`} /> {title}
                        </h5>
                        <div className="cvx-pdf-upload-list cvx-pdf-upload-list--visitor">
                          {(['ar', 'en', 'de'] as LangKey[]).map(l => {
                            const uploadKey = `${docId}-${l}`;
                            const currentUrl = cvDoc.pdfFiles?.[l] || '';
                            const isDrive = cvPdfSourceKind(cvDoc, l) === 'drive';
                            return (
                              <div key={l} className="cvx-pdf-visitor-row">
                                <div className="cvx-pdf-visitor-head">
                                  <span className="cvx-pdf-lang">{l.toUpperCase()}</span>
                                  {pdfSourceLabel(cvDoc, l)}
                                </div>
                                <input
                                  type="url"
                                  className="cvx-pdf-drive-input"
                                  value={isDrive ? currentUrl : ''}
                                  placeholder="رابط Google Drive (اختياري)"
                                  style={{ direction: 'ltr' }}
                                  onChange={e => setPdfDriveUrlForDoc(docId, l, e.target.value)}
                                />
                                <div className="cvx-pdf-visitor-actions">
                                  <button
                                    type="button"
                                    className="btn-prime btn-sm"
                                    disabled={pdfUploading === uploadKey || pdfUploading === `gen-${uploadKey}`}
                                    onClick={() => onExport(cvDoc, l)}
                                    title="طباعة / PDF من السيرة الحالية في المحرر"
                                  >
                                    <i className="fa-solid fa-print" /> طباعة
                                  </button>
                                  <button type="button" className="btn-outline-sm" disabled={pdfUploading === uploadKey}
                                    onClick={() => pdfRefs.current[uploadKey]?.click()}>
                                    {pdfUploading === uploadKey ? <i className="fa-solid fa-spinner fa-spin" /> : <><i className="fa-solid fa-upload" /> رفع</>}
                                  </button>
                                  {currentUrl && (
                                    <button type="button" className="btn-danger-sm" onClick={() => setPdfDriveUrlForDoc(docId, l, '')}>
                                      <i className="fa-solid fa-trash-can" />
                                    </button>
                                  )}
                                </div>
                                <input ref={el => { pdfRefs.current[uploadKey] = el; }} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
                                  onChange={e => { uploadPdfForDoc(docId, l, e.target.files); e.target.value = ''; }} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </CvxPanel>
              )}
            </CvxSettingsShell>
          )}

          {/* BRANDING TAB */}
          {activeTab === 'branding' && (() => {
            const typo = mergeCvTypography(doc.typography);
            const setTypo = (patch: Partial<CvTypography>) => mutate(d => ({
              ...d,
              typography: { ...mergeCvTypography(d.typography), ...patch },
            }));
            const accent = doc.globalColor || doc.accent || '#003366';
            return (
              <CvxSettingsShell>
                {brandingPanel === 'colors' && (
                  <CvxPanel title="الألوان والفوتر" icon="fa-palette">
                    <div className="cvx-form-grid-2">
                      <div className="form-group">
                        <label>اللون الرئيسي للسيرة</label>
                        <div className="cvx-color-row">
                          <input type="color" value={doc.globalColor || doc.accent || '#003366'}
                            onChange={e => mutate(d => ({ ...d, globalColor: e.target.value, accent: e.target.value }))} />
                          <input type="text" value={doc.globalColor || doc.accent || '#003366'} style={{ direction: 'ltr' }}
                            onChange={e => mutate(d => ({ ...d, globalColor: e.target.value, accent: e.target.value }))} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>لون خلفية الفوتر</label>
                        <div className="cvx-color-row">
                          <input type="color" value={doc.footerBgColor || '#003366'}
                            onChange={e => mutate(d => ({ ...d, footerBgColor: e.target.value }))} />
                          <input type="text" value={doc.footerBgColor || '#003366'} style={{ direction: 'ltr' }}
                            onChange={e => mutate(d => ({ ...d, footerBgColor: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                    <div className="form-group"><label>نص الفوتر</label>
                      <MLInput value={doc.footerText || { ar: '', en: '', de: '' }} lang={lang}
                        onChange={v => mutate(d => ({ ...d, footerText: v }))} placeholder="eng-alaa.com" /></div>
                    <div className="form-group">
                      <label>شكل التذييل</label>
                      <div className="cvx-chip-row">
                        {([
                          ['full-bleed', 'حواف كاملة', 'fa-maximize'],
                          ['content-full', 'عرض المحتوى', 'fa-square'],
                          ['bar', 'شريط + نص', 'fa-minus'],
                        ] as const).map(([mode, lbl, icon]) => (
                          <button key={mode} type="button" className={`btn-outline-sm${(doc.footerLayout ?? 'content-full') === mode ? ' active' : ''}`}
                            style={(doc.footerLayout ?? 'content-full') === mode ? { borderColor: accent, color: accent, fontWeight: 700 } : {}}
                            onClick={() => mutate(d => ({ ...d, footerLayout: mode }))}>
                            <i className={`fa-solid ${icon}`} /> {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                    {(doc.footerLayout ?? 'content-full') === 'bar' && (
                      <>
                        <div className="form-group">
                          <label>عرض الشريط الملون (%)</label>
                          <input type="range" min={25} max={100} value={doc.footerBarWidthPct ?? 55}
                            onChange={e => mutate(d => ({ ...d, footerBarWidthPct: Number(e.target.value) }))} />
                          <span className="cvx-range-val">{doc.footerBarWidthPct ?? 55}%</span>
                        </div>
                        <label className="cvx-inline-check">
                          <input type="checkbox" checked={doc.footerTextInside === true}
                            onChange={e => mutate(d => ({ ...d, footerTextInside: e.target.checked }))} />
                          النص داخل الشريط (غير مفعّل = النص تحت الشريط)
                        </label>
                      </>
                    )}
                  </CvxPanel>
                )}

                {brandingPanel === 'layout' && (
                  <CvxPanel
                    title="تخطيط الإدخالات"
                    icon="fa-table-columns"
                    actions={(
                      <button type="button" className="btn-outline-sm" onClick={() => mutate(d => ({ ...d, typography: undefined }))}>
                        <i className="fa-solid fa-rotate-left" /> استعادة الافتراضي
                      </button>
                    )}
                  >
                    <p className="cvx-panel-hint">
                      الإعدادات الافتراضية للإدخالات الجديدة. يمكن تجاوزها لكل إدخال من تبويب الأقسام.
                    </p>
                    <div className="form-group">
                      <label>التاريخ والعنوان الرئيسي</label>
                      <CvxRadioGroup
                        name="cv-default-date-title"
                        value={typo.defaultDateTitleLayout}
                        onChange={v => setTypo({ defaultDateTitleLayout: v as 'block' | 'inline' })}
                        options={[
                          { value: 'block', label: 'العنوان أسفل التاريخ' },
                          { value: 'inline', label: 'نفس سطر التاريخ' },
                        ]}
                      />
                    </div>
                    <div className="form-group">
                      <label>مكان الجهة افتراضياً</label>
                      <CvxRadioGroup
                        name="cv-default-org-layout"
                        value={typo.defaultOrgLayout}
                        onChange={v => setTypo({ defaultOrgLayout: v as 'block' | 'inline' })}
                        options={[
                          { value: 'block', label: 'سطر جديد تحت العنوان' },
                          { value: 'inline', label: 'نفس سطر العنوان الرئيسي' },
                        ]}
                      />
                    </div>
                    <div className="form-group">
                      <label>محاذاة الإدخالات (التاريخ · العنوان · الجهة)</label>
                      <CvxRadioGroup
                        name="cv-entry-align"
                        value={typo.entryAlign}
                        onChange={v => setTypo({ entryAlign: v as typeof typo.entryAlign })}
                        options={[
                          { value: 'auto', label: 'تلقائي (عربي يمين · إنجليزي/ألماني يسار)' },
                          { value: 'right', label: 'يمين' },
                          { value: 'left', label: 'يسار' },
                          { value: 'center', label: 'وسط' },
                        ]}
                      />
                    </div>
                  </CvxPanel>
                )}

                {brandingPanel === 'spacing' && (
                  <CvxPanel title="تباعد الإدخالات والأقسام" icon="fa-arrows-up-down">
                    <div className="cvx-typo-grid">
                      <TypoControl label="بعد التاريخ → العنوان" px={typo.dateTitleGapPx} showWeight={false} min={0} max={48} step={1}
                        onPx={v => setTypo({ dateTitleGapPx: v })} />
                      <TypoControl label="بعد العنوان → الجهة" px={typo.titleOrgGapPx} showWeight={false} min={0} max={48} step={1}
                        onPx={v => setTypo({ titleOrgGapPx: v })} />
                      <TypoControl label="قبل التفاصيل" px={typo.entryDetailsGapPx} showWeight={false} min={0} max={48} step={1}
                        onPx={v => setTypo({ entryDetailsGapPx: v })} />
                      <TypoControl label="بين البلوكات (خبرة ← خبرة)" px={typo.entryGapPx} showWeight={false} min={0} max={64} step={1}
                        onPx={v => setTypo({ entryGapPx: v })} />
                      <TypoControl label="تباعد الأقسام" px={typo.sectionGapPx} showWeight={false} min={4} max={64} step={1}
                        onPx={v => setTypo({ sectionGapPx: v })} />
                      <TypoControl label="تحت عنوان القسم" px={typo.sectionInnerGapPx} showWeight={false} min={0} max={48} step={1}
                        onPx={v => setTypo({ sectionInnerGapPx: v })} />
                    </div>
                  </CvxPanel>
                )}

                {brandingPanel === 'skills-spacing' && (
                  <CvxPanel title="شرائط المهارات (البرامج)" icon="fa-chart-bar">
                    <div className="cvx-typo-grid">
                      <TypoControl label="بعد الأيقونة → اسم البرنامج" px={typo.skillIconNameGapPx} showWeight={false} min={0} max={32} step={1}
                        onPx={v => setTypo({ skillIconNameGapPx: v })} />
                      <TypoControl label="بعد الاسم → النسبة المئوية" px={typo.skillNamePctGapPx} showWeight={false} min={0} max={64} step={1}
                        onPx={v => setTypo({ skillNamePctGapPx: v })} />
                      <TypoControl label="بعد الصف (الاسم/النسبة) → الشريط" px={typo.skillHeaderBarGapPx} showWeight={false} min={0} max={32} step={1}
                        onPx={v => setTypo({ skillHeaderBarGapPx: v })} />
                      <TypoControl label="بين صفوف المهارات" px={typo.skillRowGapPx} showWeight={false} min={0} max={48} step={1}
                        onPx={v => setTypo({ skillRowGapPx: v })} />
                    </div>
                  </CvxPanel>
                )}

                {brandingPanel === 'sidebar-col' && (
                  <CvxPanel title="العمود الجانبي — التواصل والوسوم" icon="fa-grip-lines-vertical">
                    <p className="cvx-panel-hint">
                      يتحكم بحجم خط <strong>اسم الحقل</strong> و<strong>القيمة</strong> في التواصل، و<strong>المهارات النقطية</strong> (قوائم •).
                    </p>
                    <div className="cvx-typo-grid">
                      <TypoControl label="اسم الحقل (العمود الجانبي)" px={typo.sideLabelPx} weight={typo.sideLabelWeight}
                        onPx={v => setTypo({ sideLabelPx: v })} onWeight={v => setTypo({ sideLabelWeight: v })} />
                      <TypoControl label="قيمة الحقل (العمود الجانبي)" px={typo.sideValuePx} weight={typo.sideValueWeight}
                        onPx={v => setTypo({ sideValuePx: v })} onWeight={v => setTypo({ sideValueWeight: v })} />
                      <TypoControl label="المهارات النقطية (•)" px={typo.tagsPx} weight={typo.tagsWeight}
                        onPx={v => setTypo({ tagsPx: v })} onWeight={v => setTypo({ tagsWeight: v })} />
                    </div>
                    <h6 style={{ margin: '14px 0 10px', fontSize: 12, fontWeight: 800, color: '#aab8d0' }}>
                      <i className="fa-solid fa-arrows-up-down" /> التباعد (بكسل)
                    </h6>
                    <div className="cvx-typo-grid">
                      <TypoControl label="بين صفوف التواصل" px={typo.contactGapPx} showWeight={false} min={0} max={48} step={1}
                        onPx={v => setTypo({ contactGapPx: v })} />
                      <TypoControl label="بين المهارات النقطية" px={typo.tagsGapPx} showWeight={false} min={0} max={48} step={1}
                        onPx={v => setTypo({ tagsGapPx: v })} />
                    </div>
                  </CvxPanel>
                )}

                {brandingPanel === 'fonts' && (
                  <CvxPanel
                    title="أحجام الخط وسمكه"
                    icon="fa-font"
                    actions={(
                      <button type="button" className="btn-outline-sm" onClick={() => mutate(d => ({ ...d, typography: undefined }))}>
                        <i className="fa-solid fa-rotate-left" /> استعادة المقاسات
                      </button>
                    )}
                  >
                    <p className="cvx-panel-hint">
                      المقاسات الافتراضية مطابقة لمعايير A4. يمكن ضبط كل قيمة من {CV_TYPO_PX_MIN} إلى {CV_TYPO_PX_MAX} بكسل.
                    </p>
                    <div className="cvx-typo-grid">
                      <TypoControl label="اسم الرأس" px={typo.namePx} weight={typo.nameWeight}
                        onPx={v => setTypo({ namePx: v })} onWeight={v => setTypo({ nameWeight: v })} />
                      <TypoControl label="اللقب المهني" px={typo.subtitlePx} weight={typo.subtitleWeight}
                        onPx={v => setTypo({ subtitlePx: v })} onWeight={v => setTypo({ subtitleWeight: v })} />
                      <TypoControl label="عناوين الأقسام" px={typo.sectionTitlePx} weight={typo.sectionTitleWeight}
                        onPx={v => setTypo({ sectionTitlePx: v })} onWeight={v => setTypo({ sectionTitleWeight: v })} />
                      <TypoControl label="العنوان الرئيسي للإدخال" px={typo.entryTitlePx} weight={typo.entryTitleWeight}
                        onPx={v => setTypo({ entryTitlePx: v })} onWeight={v => setTypo({ entryTitleWeight: v })} />
                      <TypoControl label="حجم خط الجهة" px={typo.orgPx} weight={typo.orgWeight}
                        onPx={v => setTypo({ orgPx: v })} onWeight={v => setTypo({ orgWeight: v })} />
                      <TypoControl label="حجم التاريخ" px={typo.datePx} weight={typo.dateWeight}
                        onPx={v => setTypo({ datePx: v })} onWeight={v => setTypo({ dateWeight: v })} />
                      <TypoControl label="حجم النص العام" px={typo.bodyPx} weight={typo.bodyWeight}
                        onPx={v => setTypo({ bodyPx: v })} onWeight={v => setTypo({ bodyWeight: v })} />
                      <TypoControl label="تباعد الأسطر" px={typo.lineHeight} showWeight={false} min={1} max={3} step={0.05} unit=""
                        onPx={v => setTypo({ lineHeight: v })} />
                    </div>
                  </CvxPanel>
                )}

                {brandingPanel === 'dimensions' && (
                  <CvxPanel title="أبعاد الترويسة والتذييل (A4)" icon="fa-ruler-combined">
                    <div className="cvx-form-grid-3">
                      <div className="form-group">
                        <label>ارتفاع الترويسة (mm)</label>
                        <input type="range" min={18} max={55} value={doc.headerHeightMm ?? 32}
                          onChange={e => mutate(d => ({ ...d, headerHeightMm: Number(e.target.value) }))} />
                        <span className="cvx-range-val">{doc.headerHeightMm ?? 32} mm</span>
                      </div>
                      <div className="form-group">
                        <label>ارتفاع التذييل (mm)</label>
                        <input type="range" min={8} max={30} value={doc.footerHeightMm ?? 14}
                          onChange={e => mutate(d => ({ ...d, footerHeightMm: Number(e.target.value) }))} />
                        <span className="cvx-range-val">{doc.footerHeightMm ?? 14} mm</span>
                      </div>
                      <div className="form-group">
                        <label>حجم صورة الرأس (px)</label>
                        <input type="range" min={40} max={100} value={doc.headerPhotoSize ?? 72}
                          onChange={e => mutate(d => ({ ...d, headerPhotoSize: Number(e.target.value) }))} />
                        <span className="cvx-range-val">{doc.headerPhotoSize ?? 72} px</span>
                      </div>
                    </div>
                  </CvxPanel>
                )}

                {brandingPanel === 'continued' && (() => {
                  const ovIdx = editPageNum - 2;
                  const baseCont = doc.continuedPages || {};
                  const pageCont = editPageNum >= 2
                    ? { ...baseCont, ...(doc.pageOverrides?.[ovIdx] || {}) }
                    : baseCont;
                  const estContentPages = Math.max(1, previewPageCount - (doc.extraBlankPages ?? 0));
                  const seqDisplay: CvPageSlot[] = doc.pageSequence?.length
                    ? doc.pageSequence
                    : initPageSequence(estContentPages, doc.extraBlankPages ?? 0);
                  const setPageSequence = (next: CvPageSlot[]) => {
                    mutate(d => ({ ...d, pageSequence: next, extraBlankPages: 0 }));
                  };
                  const patchPage = (patch: Partial<CvContinuedPages>) => {
                    if (editPageNum < 2) return;
                    mutate(d => {
                      const overrides = [...(d.pageOverrides || [])];
                      while (overrides.length <= ovIdx) overrides.push({});
                      overrides[ovIdx] = { ...overrides[ovIdx], ...patch };
                      return { ...d, pageOverrides: overrides };
                    });
                  };
                  const patchBase = (patch: Partial<CvContinuedPages>) => {
                    mutate(d => ({ ...d, continuedPages: { ...d.continuedPages, ...patch } }));
                  };
                  return (
                  <CvxPanel title={`التحكم بالصفحات (${previewPageCount} صفحة)`} icon="fa-copy">
                    <PageContextBar
                      pageCount={previewPageCount}
                      activePage={editPageNum}
                      accent={accent}
                      onChange={setEditPageNum}
                    />
                    <p className="cvx-panel-hint">
                      رتّب الصفحات أو أدرج صفحة فارغة. اختر الصفحة أعلاه لتعديل ترويسة/تذييلها فقط — دون ازدحام الإعدادات.
                    </p>
                    <div style={{ marginBottom: 16 }}>
                      {seqDisplay.map((slot, i) => (
                        <div key={`${i}-${slot}`} className="cvx-page-seq-row" style={{
                          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                          marginBottom: 8, padding: '8px 10px', borderRadius: 8,
                          background: editPageNum === i + 1 ? 'rgba(122,63,184,0.15)' : 'rgba(255,255,255,0.06)',
                          border: editPageNum === i + 1 ? '1px solid rgba(122,63,184,0.45)' : '1px solid rgba(255,255,255,0.1)',
                        }}>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                            صفحة {i + 1}
                            <span style={{ fontWeight: 400, opacity: 0.75, marginInlineStart: 6 }}>
                              {slot === 'blank' ? '— فارغة' : `— محتوى ${slot + 1}`}
                            </span>
                          </span>
                          <button type="button" className="btn-ghost btn-sm" title="تحرير هذه الصفحة"
                            onClick={() => setEditPageNum(i + 1)}>
                            <i className="fa-solid fa-pen" />
                          </button>
                          <button type="button" className="btn-ghost btn-sm" title="تحريك لأعلى"
                            disabled={i === 0}
                            onClick={() => setPageSequence(movePageSlot(seqDisplay, i, i - 1))}>
                            <i className="fa-solid fa-arrow-up" />
                          </button>
                          <button type="button" className="btn-ghost btn-sm" title="تحريك لأسفل"
                            disabled={i === seqDisplay.length - 1}
                            onClick={() => setPageSequence(movePageSlot(seqDisplay, i, i + 1))}>
                            <i className="fa-solid fa-arrow-down" />
                          </button>
                          <button type="button" className="btn-ghost btn-sm" title="إدراج صفحة فارغة بعدها"
                            onClick={() => setPageSequence(insertBlankAfter(seqDisplay, i))}>
                            <i className="fa-solid fa-plus" /> بعد
                          </button>
                          {slot === 'blank' && (
                            <button type="button" className="btn-ghost btn-sm" title="حذف الصفحة الفارغة"
                              onClick={() => setPageSequence(removePageAt(seqDisplay, i))}>
                              <i className="fa-solid fa-trash" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" className="btn-prime btn-sm" style={{ marginTop: 4 }}
                        onClick={() => setPageSequence([...seqDisplay, 'blank'])}>
                        <i className="fa-solid fa-plus" /> إضافة صفحة فارغة في النهاية
                      </button>
                    </div>

                    {editPageNum === 1 ? (
                      <p className="cvx-panel-hint" style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
                        <i className="fa-solid fa-circle-info" /> إعدادات <strong>الصفحة 1</strong> في تبويب
                        {' '}<button type="button" className="btn-outline-sm btn-sm" style={{ padding: '2px 8px' }} onClick={() => setBrandingPanel('colors')}>الألوان والفوتر</button>
                        {' '}و{' '}
                        <button type="button" className="btn-outline-sm btn-sm" style={{ padding: '2px 8px' }} onClick={() => setBrandingPanel('dimensions')}>أبعاد A4</button>.
                      </p>
                    ) : (
                      <ContinuedPageSettings
                        pageNum={editPageNum}
                        pageCont={pageCont}
                        doc={doc}
                        lang={lang}
                        accent={accent}
                        onPatch={patchPage}
                      />
                    )}

                    <details style={{ marginTop: 20 }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                        الإعدادات الافتراضية لكل الصفحات 2+ (قبل التخصيص لكل صفحة)
                      </summary>
                      <div style={{ marginTop: 12 }}>
                        <ContinuedPageSettings
                          pageNum={2}
                          pageCont={baseCont}
                          doc={doc}
                          lang={lang}
                          accent={accent}
                          onPatch={patchBase}
                        />
                      </div>
                    </details>
                  </CvxPanel>
                  );
                })()}

                {brandingPanel === 'icon' && (
                  <CvxPanel title="أيقونة السيرة" icon="fa-icons">
                    <div className="form-group"><label>أيقونة FA للسيرة (مثال: fa-seedling)</label>
                      <input type="text" value={doc.icon} style={{ direction: 'ltr' }} onChange={e => mutate(d => ({ ...d, icon: e.target.value }))} /></div>
                  </CvxPanel>
                )}
              </CvxSettingsShell>
            );
          })()}

          {/* DOCS & QR TAB */}
          {activeTab === 'skills' && (() => {
            const skillSec = doc.sections.find(s => s.kind === 'skillbars');
            const docAccent = doc.globalColor || doc.accent || '#003366';
            const typo = mergeCvTypography(doc.typography);
            const setTypo = (patch: Partial<CvTypography>) => mutate(d => ({
              ...d,
              typography: { ...mergeCvTypography(d.typography), ...patch },
            }));
            return (
              <div className="cv-admin-section">
                <h4><i className="fa-solid fa-chart-bar" /> مهارات البرامج في السيرة</h4>
                {skillSec ? (
                  <>
                    <SkillbarsSectionEditor
                      sec={skillSec}
                      skills={data.skills || []}
                      lang={lang}
                      docAccent={docAccent}
                      typo={typo}
                      onTypoChange={setTypo}
                      onChange={s => setSection(skillSec.id, s)}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                      <button type="button" className="btn-outline-sm" onClick={() => setActiveTab('sections')}>
                        <i className="fa-solid fa-layer-group" /> ترتيب أقسام السيرة
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>
                      أضف قسم أشرطة المهارات للسيرة، ثم غيّر عنوانه (مثل «خبرتي بالبرامج») ولون النسب.
                    </p>
                    <button type="button" className="btn-prime btn-sm" onClick={() => {
                      mutate(d => ({ ...d, sections: [...d.sections, newSection('skillbars')] }));
                      flash('تمت إضافة قسم المهارات ✓');
                    }}>
                      <i className="fa-solid fa-plus" /> إضافة قسم مهارات للسيرة
                    </button>
                  </>
                )}
              </div>
            );
          })()}

          {activeTab === 'docs' && (
            <CvxSettingsShell>
              {docsPanel === 'sidebar' && (
                <CvxPanel title="وثائق الشريط الجانبي" icon="fa-paperclip">
                  <SidebarDocsEditor docs={doc.sidebarDocs || []} lang={lang}
                    onChange={d => mutate(doc => ({ ...doc, sidebarDocs: d }))} />
                </CvxPanel>
              )}
              {docsPanel === 'qr' && (
                <CvxPanel title="رموز QR للتحقق" icon="fa-qrcode">
                  <QrCredentialsEditor items={doc.qrCredentials || []} lang={lang}
                    gridCols={doc.qrGridCols ?? 3}
                    onChange={q => mutate(doc => ({ ...doc, qrCredentials: q }))}
                    onGridCols={n => mutate(doc => ({ ...doc, qrGridCols: n }))} />
                </CvxPanel>
              )}
            </CvxSettingsShell>
          )}

          {/* SECTIONS TAB */}
          {activeTab === 'sections' && (() => {
            const typo = mergeCvTypography(doc.typography);
            const setTypo = (patch: Partial<CvTypography>) => mutate(d => ({
              ...d,
              typography: { ...mergeCvTypography(d.typography), ...patch },
            }));
            const accent = doc.globalColor || doc.accent || '#003366';
            const sectionPages = computeSectionPages(doc.sections);
            const byKind = sectionsFilter === 'all'
              ? bodySections
              : bodySections.filter(s => s.kind === sectionsFilter);
            const filteredSections = previewPageCount > 1
              ? byKind.filter(s => sectionBelongsToEditorPage(s, editPageNum, sectionPages))
              : byKind;
            return (
            <div className="cvx-sections-tab">
              <PageContextBar
                pageCount={previewPageCount}
                activePage={editPageNum}
                accent={accent}
                onChange={setEditPageNum}
              />
              {previewPageCount > 1 && (
                <p className="cvx-panel-hint" style={{ marginTop: 0, marginBottom: 12 }}>
                  تُعرض فقط الأقسام المرتبطة بـ <strong>صفحة {editPageNum}</strong>.
                  غيّر «صفحة القسم» أو فعّل «صفحة جديدة» لنقل قسم لصفحة أخرى.
                </p>
              )}
              {filteredSections.length === 0 && (
                <p className="cvx-panel-hint" style={{ marginTop: 12 }}>
                  {previewPageCount > 1
                    ? `لا توجد أقسام على صفحة ${editPageNum}. غيّر الصفحة أو أضف قسماً جديداً.`
                    : 'لا توجد أقسام من هذا النوع. أضف قسماً جديداً من الأسفل.'}
                </p>
              )}
              {filteredSections.map((sec) => {
                const idx = bodySections.findIndex(s => s.id === sec.id);
                return (
                <div
                  key={sec.id}
                  ref={el => { sectionRefs.current[sec.id] = el; }}
                  className={`cvx-section${editHighlight?.sectionId === sec.id ? ' cvx-section--focused' : ''}`}
                >
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
                    {previewPageCount > 1 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                        <span>صفحة القسم:</span>
                        <select
                          value={sec.editorPage ?? sectionPages.get(sec.id) ?? 1}
                          onChange={e => {
                            const v = Number(e.target.value);
                            setSection(sec.id, {
                              ...sec,
                              editorPage: v >= 2 ? v : undefined,
                              pageBreakBefore: v >= 2 ? true : sec.pageBreakBefore,
                            });
                          }}
                        >
                          {Array.from({ length: previewPageCount }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>صفحة {n}{n === (sectionPages.get(sec.id) ?? 1) && !sec.editorPage ? ' (تلقائي)' : ''}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  <div className="cvx-section-body">
                    <SectionEditor
                      sec={sec}
                      lang={lang}
                      docAccent={doc.globalColor || doc.accent || '#003366'}
                      typo={typo}
                      onTypoChange={setTypo}
                      onChange={s => setSection(sec.id, s)}
                      gfxCategories={data.gfxCategories || []}
                      skills={data.skills || []}
                      highlightEntryId={editHighlight?.sectionId === sec.id ? editHighlight.entryId : null}
                    />
                  </div>
                </div>
                );
              })}
              <div className="cvx-addbar">
                <select value={addingKind} onChange={e => setAddingKind(e.target.value as CvSectionKind)}>
                  {ADDABLE.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                </select>
                <button className="btn-prime btn-sm" onClick={() => mutate(d => ({
                  ...d,
                  sections: [...d.sections, newSection(addingKind, editPageNum > 1 ? editPageNum : undefined)],
                }))}>
                  <i className="fa-solid fa-plus" /> إضافة قسم جديد
                </button>
              </div>
            </div>
            );
          })()}
        </div>
        </div>

        <CvPreviewDock
          doc={doc}
          previewLang={previewLang}
          name={pickML(data.name, previewLang)}
          skills={data.skills || []}
          previewPageRef={previewPageRef}
          onEditTarget={handlePreviewEdit}
          onExport={() => onExport(doc, previewLang, previewPageRef.current, previewLang)}
          viewKey={`${selId}:${previewLang}`}
          onPageCount={setPreviewPageCount}
        />
        </div>
      </div>
    </div>
  );
}
