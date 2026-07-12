import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { LangCode, translations, T } from "./translations";
import { HeroNameDisplay } from "./HeroNameDisplay";
import { readLogoFile } from "./logoUtils";
import {
  AppData,
  Skill,
  InjectedPage,
  CvDoc,
  GfxProjectItem,
  AgriArticle,
  LibraryNode,
  AgriBook,
  BookKind,
  LibraryView,
  LangKey,
  ML,
  ml,
  pickML,
  loadAppData,
  loadAppDataFromDb,
  fetchCvExportFromDb,
  mergeCvLayoutFromLocal,
  loadSiteContentFromJson,
  mergeSiteContent,
  applyDefaultCatalog,
  saveAppData,
  fetchSiteSettingsFromDb,
  loginToApi,
  getApiToken,
  clearApiToken,
  uploadMediaFile,
  readFileAsDataUrl,
  ADMIN_EMAIL,
  ADMIN_PASS,
  LANG_PREF_KEY,
  WebProject,
  DEFAULT_BOOK_GRID,
  DEFAULT_ARTICLE_GRID,
  DEFAULT_WEB_GRID,
  DEFAULT_GFX_GRID,
  driveThumb,
  NameDisplayMode,
  visitorCvDocsAt,
  visitorCvDocsForExport,
  cvDocVisibleAt,
  displayML,
  cvDocLabel,
  CV_BTN_ICON_COLOR,
} from "./appData";
import { resolveImageSrc, resolveVideoEmbedSrc, normalizeImageUrlForStorage } from "./mediaUrl";
import { getGfxMediaSlides, getGfxProjectSlides, gfxModelAsMain } from "./gfxMedia";
import { GfxMediaSlide } from "./GfxMediaSlide";
import { GfxModelViewer } from "./GfxModelViewer";
import { gfxViewSettingsKey } from "./gfxModel3d";
import { bookGridStyleResponsive, articleGridStyleResponsive, gfxGridStyleResponsive, webGridStyleResponsive } from "./GridFontControls";
import { GfxProjectDownloads } from "./GfxProjectDownloads";
import { BookAccessRibbon, BookCover } from "./BookAccessRibbon";
import { useIsMobile } from "./hooks/use-mobile";
import { useThreeBackground } from "./useThreeBackground";
import { ContentAdmin } from "./ContentAdmin";
import { FileExplorerAdmin } from "./FileExplorerAdmin";
import { PlantDiagnostic } from "./PlantDiagnostic";
import { AlaaLogo } from "./AlaaLogo";
import { AppPicker } from "./AppPicker";
import { SoilRequest } from "./SoilRequest";
import { CvDocEditor, MLInput } from "./CvDocEditor";
import { CvRenderer } from "./CvRenderer";
import { stripHtml } from "./RichEditor";
import { SkillIcon } from "./SkillIcon";
import {
  CV_EXPORT_PX,
} from "./cvPdfExport";
import { waitForCvExportReady, waitForCvPagedLayout } from "./cvExportReady";
import { trackPageView, trackHeartbeat, trackCvDownload, trackFileDownload } from "./analytics";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { printCvFromRoot, isMobileCvDevice } from "./cvBrowserPrint";
import { normalizeSkillIconList, restoreDefaultSkillIcons } from "./skillIconDefaults";
import {
  CV_LANG_PICKER_PROMPT,
  CV_LANG_PICKER_CANCEL,
  visitorCvFileName,
} from "./cvVisitorDownload";
import { SeasonNowPanel } from "./SeasonNowPanel";
import {
  resolveBodyTextColor, resolveMutedTextColor, resolveHeadingTextColor,
} from "./siteThemeOptions";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS as DndCSS } from '@dnd-kit/utilities';

/* ── helpers ─────────────────────────────────────────── */
declare global {
  interface Window {
    THREE: any;
    html2pdf: any;
  }
}

const LANG_OPTIONS: [LangCode, string, string][] = [
  ["ar", "العربية", "🇸🇾"],
  ["en", "English", "🇺🇸"],
  ["de", "Deutsch", "🇩🇪"],
];

function detectLang(): LangCode {
  const stored = localStorage.getItem(LANG_PREF_KEY) as LangCode | null;
  if (stored && ["ar", "en", "de"].includes(stored)) return stored;
  const browser = navigator.language.toLowerCase();
  if (browser.startsWith("ar")) return "ar";
  if (browser.startsWith("de")) return "de";
  return "ar"; // default Arabic as user requested
}

function saveLang(l: LangCode) {
  localStorage.setItem(LANG_PREF_KEY, l);
}

/* ── Navigation persistence (survive refresh + browser back) ── */
const NAV_KEY = "siteNav_v1";
interface NavSnapshot {
  portal?: Portal;
  agriTab?: number;
  gfxTab?: number;
  softSubTab?: "projects" | "labs";
  gfxSelCatId?: string;
  gfxSelSubId?: string;
  activeCat?: string | null;
  gfxProjectId?: string | null;
  articleId?: string | null;
  webProjectId?: string | null;
  scrollY?: number;
}
function readNav(): NavSnapshot | null {
  try {
    const h = typeof history !== "undefined" ? (history.state as any) : null;
    if (h && h.__nav) return h.__nav as NavSnapshot;
  } catch {
    /* ignore */
  }
  try {
    return JSON.parse(sessionStorage.getItem(NAV_KEY) || "null");
  } catch {
    return null;
  }
}
function writeNav(nav: NavSnapshot, push: boolean) {
  try {
    sessionStorage.setItem(NAV_KEY, JSON.stringify(nav));
  } catch {
    /* ignore */
  }
  try {
    const st = { ...(history.state || {}), __nav: nav };
    if (push) history.pushState(st, "");
    else history.replaceState(st, "");
  } catch {
    /* ignore */
  }
}

type Portal =
  | "home"
  | "about"
  | "agri"
  | "graphics"
  | "software"
  | "cv"
  | "admin";

/* ═══════════════════════════════════════════════════════
   THREE.JS — see useThreeBackground.ts (خلفية واحدة، آمنة لـ WebGL)
══════════════════════════════════════════════════════════ */
export const DEFAULT_THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

/* ═══════════════════════════════════════════════════════
   SORTABLE SKILL ROW
══════════════════════════════════════════════════════════ */
interface SortableSkillItemProps {
  skill: Skill;
  index: number;
  total: number;
  lang: LangCode;
  globalSkillSize: number;
  onChange: (id: string, patch: Partial<Skill>) => void;
  onDelete: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}
function SortableSkillItem({ skill: s, index: i, total, lang, globalSkillSize, onChange, onDelete, onMoveUp, onMoveDown }: SortableSkillItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const [iconUploading, setIconUploading] = useState(false);
  const [iconUrlDraft, setIconUrlDraft] = useState('');
  const dragStyle: React.CSSProperties = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  const applyIconUrl = () => {
    const url = iconUrlDraft.trim();
    if (!url) return;
    const normalized = normalizeImageUrlForStorage(url);
    onChange(s.id, { icon: normalized });
    setIconUrlDraft(normalized);
  };

  const handleIconFile = async (file: File) => {
    setIconUploading(true);
    try {
      const serverUrl = getApiToken() ? await uploadMediaFile(file, 'skills') : null;
      if (serverUrl) {
        onChange(s.id, { icon: serverUrl });
        setIconUrlDraft(serverUrl);
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      onChange(s.id, { icon: dataUrl });
      setIconUrlDraft('');
    } finally {
      setIconUploading(false);
    }
  };

  return (
    <div ref={setNodeRef} style={dragStyle} className="skill-admin-row">
      {/* Drag handle */}
      <button
        className="skill-drag-handle"
        {...attributes}
        {...listeners}
        title={lang === 'ar' ? 'اسحب لإعادة الترتيب' : lang === 'de' ? 'Zum Sortieren ziehen' : 'Drag to reorder'}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', padding: '0 4px', fontSize: 14, touchAction: 'none' }}
      >
        <i className="fa-solid fa-grip-vertical" />
      </button>

      {/* Icon upload + URL */}
      <div className="skill-admin-icon-wrap">
        <label className={`skill-admin-icon-btn${iconUploading ? ' skill-admin-icon-btn--busy' : ''}`} title={lang === "ar" ? "رفع أيقونة" : lang === "de" ? "Symbol hochladen" : "Upload icon"}>
          {iconUploading ? (
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 16, color: '#0af' }} />
          ) : (
            <SkillIcon icon={s.icon} name={s.name} size={22} />
          )}
          <input type="file" accept="image/*,.svg" style={{ display: "none" }} disabled={iconUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void handleIconFile(file);
              e.target.value = '';
            }} />
          <span className="skill-admin-icon-hint">{iconUploading ? '…' : (lang === "ar" ? "رفع" : lang === "de" ? "Upload" : "Upload")}</span>
        </label>
        <input
          type="url"
          className="skill-admin-icon-url"
          value={iconUrlDraft || (/^https?:\/\//i.test(s.icon) || s.icon.startsWith('/') || s.icon.startsWith('uploads/') ? s.icon : iconUrlDraft)}
          onChange={(e) => setIconUrlDraft(e.target.value)}
          onBlur={applyIconUrl}
          onKeyDown={(e) => { if (e.key === 'Enter') applyIconUrl(); }}
          placeholder={lang === 'ar' ? 'رابط الصورة' : lang === 'de' ? 'Bild-URL' : 'Image URL'}
          dir="ltr"
        />
      </div>

      {/* Name + percent */}
      <div style={{ flex: 1 }}>
        <input type="text" value={s.name}
          style={{ width: '100%', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.25)', marginBottom: 4, fontSize: 13, background: 'rgba(255,255,255,0.08)', color: '#fff' }}
          onChange={e => onChange(s.id, { name: e.target.value })} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="range" min={0} max={100} value={s.percent} style={{ flex: 1 }}
            onChange={e => onChange(s.id, { percent: Number(e.target.value) })} />
          <span style={{ fontSize: 12, minWidth: 32, color: '#fff' }}>{s.percent}%</span>
        </div>
      </div>

      {/* Up / Down arrows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button
          className="btn-outline-sm"
          disabled={i === 0}
          onClick={() => onMoveUp(i)}
          title={lang === 'ar' ? 'تحريك لأعلى' : 'Move up'}
          style={{ padding: '2px 6px', opacity: i === 0 ? 0.25 : 1 }}
        ><i className="fa-solid fa-chevron-up" /></button>
        <button
          className="btn-outline-sm"
          disabled={i === total - 1}
          onClick={() => onMoveDown(i)}
          title={lang === 'ar' ? 'تحريك لأسفل' : 'Move down'}
          style={{ padding: '2px 6px', opacity: i === total - 1 ? 0.25 : 1 }}
        ><i className="fa-solid fa-chevron-down" /></button>
      </div>

      {/* Delete */}
      <button className="btn-danger-sm" onClick={() => onDelete(s.id)}>
        <i className="fa-solid fa-trash-can" />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════════ */
export default function App() {
  const isMobileView = useIsMobile();
  const initialNav = readNav();
  const [lang, setLang] = useState<LangCode>(detectLang);
  const [portal, setPortal] = useState<Portal>(initialNav?.portal ?? "home");
  const [adminGate, setAdminGate] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langDdRef = useRef<HTMLDivElement>(null);
  const [langMenuStyle, setLangMenuStyle] = useState<React.CSSProperties>({});
  const [data, setData] = useState<AppData>(loadAppData);
  const dataRef = useRef(data);
  useEffect(() => { dataRef.current = data; }, [data]);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [agriTab, setAgriTab] = useState(initialNav?.agriTab ?? 0);
  const [gfxTab, setGfxTab] = useState(initialNav?.gfxTab ?? 0);
  const [adminPanel, setAdminPanel] = useState(0);
  const [selectedSnippetIdx, setSelectedSnippetIdx] = useState<number | null>(
    null,
  );
  const [snippetHtml, setSnippetHtml] = useState("");
  const [snippetCss, setSnippetCss] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(initialNav?.activeCat ?? null);
  const [cvDocId, setCvDocId] = useState<string>("");
  const cvLang = lang as LangKey;
  const [printCvMount, setPrintCvMount] = useState<{
    doc: CvDoc;
    lang: LangKey;
    name: typeof data.name;
    skills: Skill[];
  } | null>(null);
  const [printingCv, setPrintingCv] = useState(false);
  const [cvLangPickerDoc, setCvLangPickerDoc] = useState<CvDoc | null>(null);
  const [openPrompt, setOpenPrompt] = useState<number | null>(null);

  // GFX 3-tier & full-page project view
  const [gfxSelCatId, setGfxSelCatId] = useState<string>(initialNav?.gfxSelCatId ?? "");
  const [gfxSelSubId, setGfxSelSubId] = useState<string>(initialNav?.gfxSelSubId ?? "");
  const [gfxProjectPage, setGfxProjectPage] = useState<GfxProjectItem | null>(null);
  const [gfxCarouselIdx, setGfxCarouselIdx] = useState(0);
  const [gfxZoom, setGfxZoom] = useState(false);
  const [gfxSearch, setGfxSearch] = useState('');
  const [gfxRequestOpen, setGfxRequestOpen] = useState(false);
  const [gfxBrowseView, setGfxBrowseView] = useState<'all' | 'byCategory'>('all');
  useEffect(() => {
    setGfxBrowseView(data.gfxGridSettings?.galleryBrowseMode ?? 'all');
  }, [data.gfxGridSettings?.galleryBrowseMode]);

  // Agri article full-page view (replaces modal)
  const [articlePage, setArticlePage] = useState<AgriArticle | null>(null);
  const [articleImgIdx, setArticleImgIdx] = useState(0);
  const [articleSearch, setArticleSearch] = useState('');
  // Inline article edit (for admins inside the article full-page)
  const [articleEditMode, setArticleEditMode] = useState(false);
  const [articleEditData, setArticleEditData] = useState<AgriArticle | null>(null);
  const [articleEditLang, setArticleEditLang] = useState<LangKey>('ar');
  // Library state
  const [libSearch, setLibSearch] = useState('');
  const [bookPreview, setBookPreview] = useState<import('./appData').AgriBook | null>(null);
  // Library tree expand/collapse state
  const [libOpen, setLibOpen] = useState<Record<string, boolean>>({});
  // Library view mode (session override; defaults to the admin-saved setting)
  const [libView, setLibView] = useState<LibraryView>('tree');
  useEffect(() => { setLibView(data.libraryView || 'tree'); }, [data.libraryView]);

  // Software lab playground mode (full-page, ephemeral)
  const [playgroundMode, setPlaygroundMode] = useState(false);
  const [snippetJs, setSnippetJs] = useState('');
  const [snippetLangTab, setSnippetLangTab] = useState<'html' | 'css' | 'js'>('html');

  // Software portal sub-tabs & web project page
  const [softSubTab, setSoftSubTab] = useState<'projects' | 'labs'>(initialNav?.softSubTab ?? 'projects');
  const [webProjectPage, setWebProjectPage] = useState<WebProject | null>(null);
  const [webProjCarouselIdx, setWebProjCarouselIdx] = useState(0);

  // Request form state (software section)
  const [reqName, setReqName] = useState('');
  const [reqPhone, setReqPhone] = useState('');
  const [reqDesc, setReqDesc] = useState('');

  // Server sync state
  const [serverConnected, setServerConnected] = useState(() => !!getApiToken());
  const [serverSyncing, setServerSyncing] = useState(false);

  // Admin form state
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminError, setAdminError] = useState("");
  const [editName, setEditName] = useState<ML>(ml(""));
  const [editBio, setEditBio] = useState<ML>(ml(""));
  const [editNameDisplay, setEditNameDisplay] = useState<NameDisplayMode>("text");
  const [editNameLogo, setEditNameLogo] = useState("");
  const [editNameLogoColor, setEditNameLogoColor] = useState("#ffffff");
  const [editNameShimmer, setEditNameShimmer] = useState(true);
  const [editNameShimmerSpeed, setEditNameShimmerSpeed] = useState(3.2);
  const [editNameShimmerColor, setEditNameShimmerColor] = useState("#00ccff");
  const [editNameShimmerAngle, setEditNameShimmerAngle] = useState(90);
  const [editNameShimmerMotion, setEditNameShimmerMotion] = useState(true);
  const [editNameShimmerDirection, setEditNameShimmerDirection] = useState<'rtl' | 'ltr'>('rtl');
  const [editNameShimmerWidth, setEditNameShimmerWidth] = useState(0.08);
  const nameLogoRef = useRef<HTMLInputElement>(null);
  const [editSkills, setEditSkills] = useState<Skill[]>([]);
  const [globalSkillSize, setGlobalSkillSize] = useState(26);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageHtml, setNewPageHtml] = useState("");
  const [newPageCss, setNewPageCss] = useState("");

  const canvasRef = useRef<HTMLDivElement>(null);
  const cvPrintMountRef = useRef<HTMLDivElement>(null);
  const cvPortalPreviewRef = useRef<HTMLDivElement>(null);
  const aboutCvSnapRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const exportBundleRef = useRef<{ skills: Skill[]; name: ML }>({ skills: [], name: { ar: '', en: '', de: '' } });
  const previewFrame = useRef<HTMLIFrameElement>(null);

  const t: T = translations[lang];

  // Site theme (dark default) — controlled from admin Site Settings
  const theme = data.siteSettings?.themeMode === "light" ? "light" : "dark";

  // Sync body/html background to fill any area below the fixed canvas
  useEffect(() => {
    const bg = theme === 'dark' ? '#000c1a' : '#eef4ff';
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
    return () => {
      document.documentElement.style.background = '';
      document.body.style.background = '';
    };
  }, [theme]);

  // Site-wide base font size (admin Site Settings)
  useEffect(() => {
    const px = data.siteSettings?.baseFontSize ?? 16;
    document.documentElement.style.fontSize = `${px}px`;
    return () => { document.documentElement.style.fontSize = ''; };
  }, [data.siteSettings?.baseFontSize]);

  // Three.js — animated network renders on every page (dark=deep-navy palette, light=blue-on-white palette)
  useThreeBackground(canvasRef, theme);

  // Load: localStorage → DB (admin) → data.json (اختياري — فقط إن لم تُحمَّل قاعدة البيانات)
  useEffect(() => {
    (async () => {
      let merged = loadAppData();
      const dbData = await loadAppDataFromDb();
      const dbLoaded = !!dbData;
      if (dbData) merged = { ...merged, ...dbData };
      /* عند نجاح MySQL لا نطلب data.json — يمنع 404 في الكونسول */
      if (!dbLoaded) {
        const jsonPatch = await loadSiteContentFromJson();
        if (jsonPatch) {
          merged = mergeSiteContent(merged, jsonPatch);
        }
      }
      merged = { ...merged, skills: normalizeSkillIconList(merged.skills || []) };
      setData(applyDefaultCatalog(merged));
    })().catch(() => { /* stay with localStorage */ });
  }, []);

  // Sync document dir/lang
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = t.dir;
  }, [lang, t.dir]);

  // Visitor analytics — لا يُتتبّع المدير أثناء جلسة الإدارة
  useEffect(() => {
    if (adminLoggedIn) return;
    trackPageView(`${portal}:${lang}`);
  }, [portal, lang, adminLoggedIn]);

  useEffect(() => {
    if (adminLoggedIn) return;
    const beat = () => {
      if (document.visibilityState === 'visible') trackHeartbeat();
    };
    beat();
    const id = setInterval(beat, 60000);
    return () => clearInterval(id);
  }, [adminLoggedIn]);

  // Tabs: [diag?] + season + books + articles + soilreq
  useEffect(() => {
    const count = (data.aiDiagnosticsEnabled ? 1 : 0) + 4;
    if (agriTab >= count) setAgriTab(0);
  }, [data.aiDiagnosticsEnabled, agriTab]);

  // Update preview iframe when snippet HTML/CSS/JS changes
  useEffect(() => {
    const iframe = previewFrame.current;
    if (!iframe || selectedSnippetIdx === null) return;
    iframe.srcdoc = buildPreviewSrc(snippetHtml, snippetCss, snippetJs);
  }, [snippetHtml, snippetCss, snippetJs, selectedSnippetIdx]);

  // Animate skill bars when graphics portal opens
  useEffect(() => {
    if (portal === "graphics") {
      setTimeout(() => {
        data.skills.forEach((s) => {
          const el = document.getElementById(`skill-fill-${s.id}`);
          if (el) el.style.width = `${s.percent}%`;
        });
      }, 120);
    }
  }, [portal, data.skills]);

  const switchLang = useCallback((l: LangCode) => {
    saveLang(l);
    setLang(l);
    setLangOpen(false);
  }, []);

  useLayoutEffect(() => {
    if (!langOpen) return;

    const placeMenu = () => {
      const anchor = langDdRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const top = rect.bottom + 10;
      const dir = document.documentElement.dir;
      if (dir === "rtl") {
        setLangMenuStyle({ top, left: rect.left, right: "auto" });
      } else {
        setLangMenuStyle({ top, right: window.innerWidth - rect.right, left: "auto" });
      }
    };

    placeMenu();
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
    return () => {
      window.removeEventListener("resize", placeMenu);
      window.removeEventListener("scroll", placeMenu, true);
    };
  }, [langOpen]);

  const openPortal = useCallback((p: Portal) => {
    setPortal(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const goHome = useCallback(() => {
    setPortal("home");
    setActiveSkill(null);
  }, []);

  /* ── Navigation persistence: refresh + browser back ── */
  const navPoppingRef = useRef(false);
  const navReadyRef = useRef(false);
  const navRef = useRef<NavSnapshot>({});
  const gfxGalleryScrollRef = useRef(0);
  const articleScrollRef = useRef(0);

  const resolveGfxById = useCallback(
    (id: string | null | undefined): GfxProjectItem | null => {
      if (!id) return null;
      for (const c of data.gfxCategories || [])
        for (const s of c.subCategories || []) {
          const it = s.items.find((i) => i.id === id);
          if (it) return it;
        }
      return null;
    },
    [data.gfxCategories],
  );

  // Restore open detail pages + scroll on first mount (after data is ready)
  useEffect(() => {
    const nav = initialNav;
    if (!nav) return;
    const gfx = resolveGfxById(nav.gfxProjectId);
    const art = nav.articleId
      ? (data.agriArticles || []).find((x) => x.id === nav.articleId)
      : null;
    const web = nav.webProjectId
      ? (data.webProjects || []).find((x) => x.id === nav.webProjectId)
      : null;
    if (gfx || art || web) {
      // Restore does not add a new history entry
      navPoppingRef.current = true;
      if (gfx) setGfxProjectPage(gfx);
      if (art) setArticlePage(art);
      if (web) setWebProjectPage(web);
    }
    if (typeof nav.scrollY === "number" && nav.scrollY > 0) {
      const y = nav.scrollY;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => window.scrollTo(0, y)),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the current view to history + sessionStorage whenever it changes
  useEffect(() => {
    const snap: NavSnapshot = {
      portal,
      agriTab,
      gfxTab,
      softSubTab,
      gfxSelCatId,
      gfxSelSubId,
      activeCat,
      gfxProjectId: gfxProjectPage?.id ?? null,
      articleId: articlePage?.id ?? null,
      webProjectId: webProjectPage?.id ?? null,
      scrollY: window.scrollY,
    };
    navRef.current = snap;
    if (navPoppingRef.current) {
      navPoppingRef.current = false;
      return;
    }
    writeNav(snap, navReadyRef.current);
    navReadyRef.current = true;
  }, [
    portal,
    agriTab,
    gfxTab,
    softSubTab,
    gfxSelCatId,
    gfxSelSubId,
    activeCat,
    gfxProjectPage,
    articlePage,
    webProjectPage,
  ]);

  // Keep scroll position fresh in the stored snapshot (for refresh restore)
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        writeNav({ ...navRef.current, scrollY: window.scrollY }, false);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Browser Back/Forward: apply the stored view instead of leaving the app
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const nav: NavSnapshot | undefined = (e.state as any)?.__nav;
      if (!nav) return;
      navPoppingRef.current = true;
      setPortal(nav.portal ?? "home");
      setAgriTab(nav.agriTab ?? 0);
      setGfxTab(nav.gfxTab ?? 0);
      setSoftSubTab(nav.softSubTab ?? "projects");
      setGfxSelCatId(nav.gfxSelCatId ?? "");
      setGfxSelSubId(nav.gfxSelSubId ?? "");
      setActiveCat(nav.activeCat ?? null);
      setGfxProjectPage(resolveGfxById(nav.gfxProjectId));
      setArticlePage(
        nav.articleId
          ? (data.agriArticles || []).find((x) => x.id === nav.articleId) ?? null
          : null,
      );
      setWebProjectPage(
        nav.webProjectId
          ? (data.webProjects || []).find((x) => x.id === nav.webProjectId) ?? null
          : null,
      );
      const y = nav.scrollY ?? 0;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          window.scrollTo(0, y);
          navPoppingRef.current = false;
        }),
      );
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [data.gfxCategories, data.agriArticles, data.webProjects, resolveGfxById]);

  const filteredGfx = activeSkill
    ? data.gfxGallery.filter((g) => g.apps.includes(activeSkill))
    : data.gfxGallery;

  /* ── Lab helpers ─────────────────────────────────── */
  function buildPreviewSrc(html: string, css: string, js: string = '') {
    return `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
<style>*,*::before,*::after{box-sizing:border-box;}body{font-family:'Tajawal',sans-serif;padding:14px;padding-bottom:36px;margin:0;}
${css}
.___wm{position:fixed;bottom:0;left:0;right:0;background:rgba(0,51,102,0.07);text-align:center;padding:4px 0;font-size:10px;color:#003366;font-weight:700;letter-spacing:0.5px;font-family:'Courier New',monospace;border-top:1px solid rgba(0,51,102,0.1);z-index:9999;}
</style></head><body>${html}<div class="___wm">eng-alaa.com</div>${js ? `<script>${js}</script>` : ''}</body></html>`;
  }

  function buildThumbSrc(html: string, css: string) {
    return `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
<style>
*,*::before,*::after{box-sizing:border-box;}
html,body{margin:0;padding:0;width:780px;min-height:520px;overflow:hidden;}
body{font-family:'Segoe UI','Tajawal',Arial,sans-serif;padding:18px;direction:rtl;}
${css}
</style></head><body>${html}</body></html>`;
  }

  function openSnippetEditor(idx: number) {
    const s = data.softwareSnippets[idx];
    if (!s) return;
    setSelectedSnippetIdx(idx);
    setSnippetHtml(s.codeHtml);
    setSnippetCss(s.codeCss);
    setSnippetJs(s.codeJs || '');
    setSnippetLangTab('html');
    setPlaygroundMode(true);
  }

  function sendSoftwareRequest(via: 'whatsapp' | 'email') {
    const msg = `${t.requestProject}\n${t.requestName}: ${reqName}\n${t.requestPhone}: ${reqPhone}\n${t.requestProjectDesc}: ${reqDesc}`;
    if (via === 'whatsapp') {
      const phone = (data.personalInfo?.phone || '').replace(/\D/g, '');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      window.open(`mailto:${data.personalInfo?.email || ''}?subject=${encodeURIComponent(t.requestProject)}&body=${encodeURIComponent(msg)}`, '_blank');
    }
  }

  const labCategories = Array.from(
    new Set(
      data.softwareSnippets.map((s) => s.category).filter(Boolean) as string[],
    ),
  );

  const filteredSnippets = activeCat
    ? data.softwareSnippets.filter((s) => s.category === activeCat)
    : data.softwareSnippets;

  // Admin login
  function handleAdminLogin() {
    if (adminEmail === ADMIN_EMAIL && adminPass === ADMIN_PASS) {
      setAdminGate(false);
      setAdminLoggedIn(true);
      setEditName(data.name);
      setEditBio(data.bio);
      setEditNameDisplay(data.nameDisplay || 'text');
      setEditNameLogo(data.nameLogo || '');
      setEditNameLogoColor(data.nameLogoColor || '#ffffff');
      setEditNameShimmer(data.nameShimmer !== false);
      setEditNameShimmerSpeed(data.nameShimmerSpeed ?? 3.2);
      setEditNameShimmerColor(data.nameShimmerColor || '#00ccff');
      setEditNameShimmerAngle(data.nameShimmerAngle ?? 90);
      setEditNameShimmerMotion(data.nameShimmerMotion !== false);
      setEditNameShimmerDirection(data.nameShimmerDirection === 'ltr' ? 'ltr' : 'rtl');
      setEditNameShimmerWidth(data.nameShimmerWidth ?? 0.08);
      setEditSkills(normalizeSkillIconList(data.skills.map((s) => ({ ...s }))));
      setGlobalSkillSize(data.skills[0]?.size ?? 26);
      openPortal("admin");
    } else {
      setAdminError(
        lang === "ar"
          ? "بيانات خاطئة!"
          : lang === "de"
            ? "Falsche Daten!"
            : "Invalid credentials!",
      );
    }
  }

  async function handleServerConnect(username: string, password: string): Promise<boolean> {
    setServerSyncing(true);
    try {
      const ok = await loginToApi(username, password);
      if (ok) {
        setServerConnected(true);
        await saveAppData(data);
      }
      return ok;
    } finally {
      setServerSyncing(false);
    }
  }

  async function handleServerSync() {
    setServerSyncing(true);
    try {
      await saveAppData(data);
    } finally {
      setServerSyncing(false);
    }
  }

  function handleServerDisconnect() {
    clearApiToken();
    setServerConnected(false);
  }

  /** للزوار: نافذة اختيار لغة السيرة (عربي · إنجليزي · ألماني) */
  function requestVisitorCv(doc: CvDoc) {
    setCvLangPickerDoc(doc);
  }

  function resolveLiveCvPreview(
    docId: string,
    exLang: LangKey,
    previewEl?: HTMLElement | null,
  ): HTMLElement | null {
    if (previewEl?.querySelector('.cv-a4-sheet')) return previewEl;

    if (exLang === cvLang) {
      const snap = aboutCvSnapRefs.current[docId];
      if (snap?.querySelector('.cv-a4-sheet')) return snap;

      const portal = cvPortalPreviewRef.current;
      if (portal?.querySelector('.cv-a4-sheet') && cvDocId === docId) return portal;
    }

    return null;
  }

  async function mountCvForPrint(
    docToPrint: CvDoc,
    exLang: LangKey,
    nameToPrint: typeof data.name,
    skillsToPrint: Skill[],
  ): Promise<HTMLElement> {
    setPrintCvMount({ doc: docToPrint, lang: exLang, name: nameToPrint, skills: skillsToPrint });
    const timeout = isMobileCvDevice() ? 35000 : 25000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const root = cvPrintMountRef.current;
      const sheets = root?.querySelectorAll('.cv-paged-root > .cv-a4-sheet').length ?? 0;
      if (root && sheets > 0) {
        const host = root.closest('.cv-print-mount') as HTMLElement | null;
        await waitForCvExportReady(host ?? root, isMobileCvDevice() ? 35000 : 25000);
        await waitForCvPagedLayout(root, isMobileCvDevice() ? 35000 : 25000);
        return root;
      }
      await new Promise(r => setTimeout(r, 80));
    }
    throw new Error('CV print mount timeout');
  }

  async function printCvDoc(doc: CvDoc, exLang: LangKey, previewEl?: HTMLElement | null, _previewLang?: LangKey) {
    if (printingCv) return;
    setPrintingCv(true);

    let docToPrint = doc;
    let skillsToPrint = data.skills;
    let nameToPrint = data.name;

    let fresh: Awaited<ReturnType<typeof fetchCvExportFromDb>> = null;
    try {
      fresh = await Promise.race([
        fetchCvExportFromDb(doc.id),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
      ]);
    } catch {
      fresh = null;
    }
    if (fresh?.doc) {
      docToPrint = mergeCvLayoutFromLocal(doc, fresh.doc);
      skillsToPrint = fresh.skills;
      nameToPrint = fresh.name;
      exportBundleRef.current = { skills: skillsToPrint, name: nameToPrint };
      setData(prev => ({
        ...prev,
        name: nameToPrint,
        skills: skillsToPrint,
        cvDocs: prev.cvDocs.some(d => d.id === fresh.doc!.id)
          ? prev.cvDocs.map(d => (d.id === fresh.doc!.id ? docToPrint : d))
          : [...prev.cvDocs, docToPrint],
      }));
    } else {
      exportBundleRef.current = { skills: skillsToPrint, name: nameToPrint };
    }

    const printTitle = visitorCvFileName(docToPrint, exLang).replace(/\.pdf$/i, '');

    try {
      // دائماً mount مخفي 794px — يطابق الكمبيوتر ويمنع اختلاف تقسيم الصفحات على الجوال
      const printRoot = await mountCvForPrint(docToPrint, exLang, nameToPrint, skillsToPrint);
      await printCvFromRoot(printRoot, printTitle, lang);
      trackCvDownload(docToPrint.id, pickML(docToPrint.name, exLang), exLang);
    } catch (e) {
      console.error('CV print failed', e);
      const msg = e instanceof Error ? e.message : String(e);
      alert(lang === 'ar'
        ? `تعذّر تنزيل السيرة الذاتية${msg ? `\n${msg}` : ''}`
        : lang === 'de'
          ? `Lebenslauf-Download fehlgeschlagen${msg ? `\n${msg}` : ''}`
          : `CV download failed${msg ? `\n${msg}` : ''}`);
    } finally {
      setPrintCvMount(null);
      setPrintingCv(false);
    }
  }

  function saveGlobalBio() {
    const updated = {
      ...data,
      name: editName,
      bio: editBio,
      nameDisplay: editNameDisplay,
      nameLogo: editNameLogo,
      nameLogoColor: editNameLogoColor,
      nameShimmer: editNameShimmer,
      nameShimmerSpeed: editNameShimmerSpeed,
      nameShimmerColor: editNameShimmerColor,
      nameShimmerAngle: editNameShimmerAngle,
      nameShimmerMotion: editNameShimmerMotion,
      nameShimmerDirection: editNameShimmerDirection,
      nameShimmerWidth: editNameShimmerWidth,
    };
    setData(updated);
    saveAppData(updated);
  }

  function saveSkills() {
    const withSize = editSkills.map(s => ({ ...s, size: globalSkillSize }));
    const updated = { ...data, skills: withSize };
    setEditSkills(withSize);
    setData(updated);
    saveAppData(updated);
  }

  /** Immediate save used after drag/arrow reorder */
  function saveSkillsImmediate(newList: Skill[]) {
    const withSize = newList.map(s => ({ ...s, size: globalSkillSize }));
    setEditSkills(withSize);
    const updated = { ...data, skills: withSize };
    setData(updated);
    saveAppData(updated);
  }

  const skillDndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleSkillDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = editSkills.findIndex(s => s.id === active.id);
    const newIndex = editSkills.findIndex(s => s.id === over.id);
    saveSkillsImmediate(arrayMove(editSkills, oldIndex, newIndex));
  }

  function handleSkillChange(id: string, patch: Partial<Skill>) {
    setEditSkills(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  function handleSkillMoveUp(index: number) {
    if (index === 0) return;
    saveSkillsImmediate(arrayMove(editSkills, index, index - 1));
  }

  function handleSkillMoveDown(index: number) {
    if (index === editSkills.length - 1) return;
    saveSkillsImmediate(arrayMove(editSkills, index, index + 1));
  }

  function handleCvSave(partial: Partial<AppData>): Promise<boolean> {
    return new Promise(resolve => {
      setData(prev => {
        const updated = { ...prev, ...partial };
        dataRef.current = updated;
        void saveAppData(updated).then(resolve);
        return updated;
      });
    });
  }

  /** إعدادات الموقع — تحديث فوري للواجهة ثم حفظ/رفع مؤجّل */
  const handleSiteApply = useCallback((partial: Partial<AppData>) => {
    setData(prev => {
      const updated = { ...prev, ...partial };
      dataRef.current = updated;
      return updated;
    });
  }, []);

  const handleSitePersist = useCallback(() => saveAppData(dataRef.current), []);

  // تحديث ألوان/ثيم الموقع للزوار من قاعدة البيانات (بدون إعادة تحميل الصفحة)
  useEffect(() => {
    if (adminLoggedIn) return;
    let cancelled = false;
    const pullTheme = async () => {
      const remote = await fetchSiteSettingsFromDb();
      if (cancelled || !remote) return;
      setData(prev => {
        if (JSON.stringify(prev.siteSettings) === JSON.stringify(remote)) return prev;
        return { ...prev, siteSettings: remote };
      });
    };
    void pullTheme();
    const intervalId = setInterval(() => { void pullTheme(); }, 12000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pullTheme();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [adminLoggedIn]);

  function saveArticleInline(updated: AgriArticle) {
    const newArticles = (data.agriArticles || []).map(a => a.id === updated.id ? updated : a);
    const newData = { ...data, agriArticles: newArticles };
    setData(newData);
    saveAppData(newData);
    setArticlePage(updated);
    setArticleEditMode(false);
    setArticleEditData(null);
  }

  function injectPage() {
    if (!newPageTitle.trim()) return;
    const page: InjectedPage = {
      title: newPageTitle,
      html: newPageHtml,
      css: newPageCss,
    };
    const updated = { ...data, injectedPages: [...data.injectedPages, page] };
    setData(updated);
    saveAppData(updated);
    setNewPageTitle("");
    setNewPageHtml("");
    setNewPageCss("");
  }

  /* ── render helpers ───────────────────────────────── */
  const isRtl = lang === "ar";

  // ── Site accent + glass controls (admin Site Settings) ──
  // A single brand color drives every menu/accent site-wide; a glass-opacity
  // slider drives the transparency of all glass surfaces. Both are made
  // mode-aware here so the chosen color stays readable in dark *and* light.
  const accentVars = (() => {
    // Parse hex → HSL so we can lighten the accent while preserving its hue &
    // saturation (mixing toward white would desaturate it and leave white text
    // on buttons illegible). Falls back to the default navy on bad input.
    const parseHsl = (hx: string): [number, number, number] => {
      let s = (hx || "").trim().replace("#", "");
      if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) s = "003366";
      if (s.length === 3) s = s.split("").map(c => c + c).join("");
      const n = parseInt(s, 16);
      const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      let h = 0;
      if (d) {
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60; if (h < 0) h += 360;
      }
      const l = (max + min) / 2;
      const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
      return [Math.round(h), Math.round(sat * 100), l];
    };
    const op = typeof data.siteSettings?.glassOpacity === "number" ? data.siteSettings.glassOpacity : 0.5;
    const dark = theme === "dark";
    const accentRaw = data.siteSettings?.accentColor || "#003366";
    const [h, s] = parseHsl(accentRaw);
    // Accent for public site: as-picked in light mode; lifted for readability in dark.
    const navyL = dark ? 62 : 28;
    const navy = `hsl(${h}, ${Math.max(s, 45)}%, ${navyL}%)`;
    const hsla = (l: number, a: number) => `hsla(${h}, ${Math.max(s, 35)}%, ${l}%, ${a})`;
    // Admin panels sit on light cards — always keep a dark ink so labels stay readable.
    const adminInk = `hsl(${h}, ${Math.max(s, 55)}%, 22%)`;
    const menuTxt = (data.siteSettings?.menuTextColor || "").trim() || navy;
    const fontFamily = (data.siteSettings?.siteFontFamily || "Tajawal").trim() || "Tajawal";
    const bodyText = resolveBodyTextColor(data.siteSettings?.bodyTextColor, dark);
    const mutedText = resolveMutedTextColor(data.siteSettings?.mutedTextColor, dark);
    const headingText = resolveHeadingTextColor(data.siteSettings?.headingTextColor, accentRaw);
    const btnBg = (data.siteSettings?.buttonBgColor || "").trim() || navy;
    const btnText = (data.siteSettings?.buttonTextColor || "").trim() || "#ffffff";
    return {
      "--navy": navy,
      "--navy-raw": accentRaw,
      "--admin-ink": adminInk,
      "--menu-text": menuTxt,
      "--btn-bg": btnBg,
      "--btn-text": btnText,
      "--font": `'${fontFamily}', system-ui, sans-serif`,
      "--text": bodyText,
      "--muted": mutedText,
      "--heading-text": headingText,
      "--navy-light": hsla(navyL, 0.12),
      "--navy-glow": hsla(navyL, 0.32),
      // Glass + field tinted by the accent hue, scaled by the opacity slider.
      "--glass": hsla(dark ? 13 : 95, op),
      "--glass-border": hsla(navyL, dark ? 0.24 : 0.18),
      "--field": hsla(dark ? 22 : 97, dark ? 0.5 : 0.92),
    } as React.CSSProperties;
  })();

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        maxWidth: "100vw",
        overflowX: "hidden",
        background: "transparent",
        position: "relative",
        ...accentVars,
      }}
      data-theme={theme}
    >
      {/* Three.js canvas — always rendered; palette switches per theme */}
      <div id="three-canvas-wrapper" ref={canvasRef} />

      {/* ── Navbar ─────────────────────────────────── */}
      <nav className={`navbar${theme === "dark" ? " dark" : " glass"}`}>
        <a href="#" className="nav-logo" onClick={goHome} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          {data.siteSettings?.logoType === 'image' && data.siteSettings.logoImg
            ? <img src={data.siteSettings.logoImg} alt="logo" style={{ height: 32, objectFit: 'contain', verticalAlign: 'middle', filter: theme === 'dark' ? 'brightness(0) invert(1)' : 'none' }} />
            : (data.siteSettings?.logoType === 'svg_alaa' || !data.siteSettings?.logoImg)
              ? <AlaaLogo
                  color={data.siteSettings?.logoColor || (theme === 'dark' ? '#ffffff' : (data.siteSettings?.accentColor || '#003366'))}
                  size={32}
                />
              : null}
          <span style={{ color: data.siteSettings?.logoColor || (theme === 'dark' ? '#ffffff' : (data.siteSettings?.accentColor || '#003366')), fontWeight: 800, fontSize: 15, letterSpacing: '0.01em' }}>
            {(lang as LangKey) === 'ar' ? 'م.علاء أحمد المصري' : (lang as LangKey) === 'de' ? 'Ing. Alaa Ahmad Almasri' : 'Eng. Alaa Ahmad Almasri'}
          </span>
        </a>
        <div className="nav-actions">
          <button className="btn-pill" onClick={goHome}>
            <i className="fa-solid fa-house" />
            {lang === "ar" ? "الرئيسية" : lang === "de" ? "Startseite" : "Home"}
          </button>
          <button className="btn-pill" onClick={() => openPortal("about")}>
            <i className="fa-solid fa-user" />
            {t.aboutNavBtn}
          </button>
          <div className="lang-dd" ref={langDdRef}>
            <button
              className="btn-pill"
              onClick={() => setLangOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={langOpen}
            >
              <i className="fa-solid fa-globe" />
              {lang === "ar" ? "اللغة" : lang === "de" ? "Sprache" : "Language"}
              <i
                className={`fa-solid fa-chevron-down lang-dd-caret${langOpen ? " open" : ""}`}
              />
            </button>
          </div>
          {langOpen && typeof document !== "undefined" && createPortal(
            <>
              <div
                className="lang-dd-backdrop"
                onClick={() => setLangOpen(false)}
              />
              <div
                className="lang-dd-menu lang-dd-menu--portal"
                role="listbox"
                style={langMenuStyle}
              >
                {LANG_OPTIONS.map(([code, label, flag]) => (
                  <button
                    key={code}
                    role="option"
                    aria-selected={lang === code}
                    className={`lang-dd-item${lang === code ? " active" : ""}`}
                    onClick={() => switchLang(code)}
                  >
                    <span className="lang-dd-flag">{flag}</span>
                    <span>{label}</span>
                    {lang === code && (
                      <i className="fa-solid fa-check lang-dd-check" />
                    )}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )}
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────── */}
      {portal === "home" && (
        <main className="hero fade-up">
          {/* Tagline above name */}
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-line" />
            <span className="hero-eyebrow-text">
              {lang === "ar"
                ? "مُهندس · مُصمّم · مُطوّر"
                : lang === "de"
                  ? "Ingenieur · Designer · Entwickler"
                  : "Engineer · Designer · Developer"}
            </span>
            <span className="hero-eyebrow-line" />
          </div>

          {/* Main name */}
          <HeroNameDisplay
            name={pickML(data.name, cvLang)}
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
          />

          {/* Animated underline */}
          <div className="hero-divider">
            <span className="hero-divider-dot" />
            <span className="hero-divider-bar" />
            <span className="hero-divider-dot" />
          </div>

          {/* Bio */}
          <p className="hero-bio">{displayML(data.bio, cvLang)}</p>

          {/* Social links — dynamic from siteSettings, fallback to hardcoded */}
          <div className="social-row">
            {(data.siteSettings?.socialLinks?.length
              ? data.siteSettings.socialLinks
              : [
                  { id: '1', icon: 'fa-solid fa-phone', url: 'tel:+971561534995' },
                  { id: '2', icon: 'fa-solid fa-envelope', url: 'mailto:ala1990999@gmail.com' },
                  { id: '3', icon: 'fa-brands fa-linkedin-in', url: 'https://www.linkedin.com/in/alaa-almasri' },
                  { id: '4', icon: 'fa-brands fa-behance', url: 'https://www.behance.net/ala999777' },
                ]
            ).map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="social-btn">
                <i className={l.icon} />
              </a>
            ))}
          </div>

          {/* Portal gates */}
          <div className="portal-grid">
            {[
              {
                id: "agri",
                icon: "fa-seedling",
                gradient: "--g-agri",
                title: t.gate1Title,
                desc: t.gate1Desc,
                num: "01",
              },
              {
                id: "graphics",
                icon: "fa-bezier-curve",
                gradient: "--g-gfx",
                title: t.gate2Title,
                desc: t.gate2Desc,
                num: "02",
              },
              {
                id: "software",
                icon: "fa-code",
                gradient: "--g-software",
                title: t.gate3Title,
                desc: t.gate3Desc,
                num: "03",
              },
            ].map((g) => (
              <div
                key={g.id}
                className="portal-card"
                onClick={() => openPortal(g.id as Portal)}
              >
                <div className="portal-card-glow" />
                <div className="portal-card-num">{g.num}</div>
                <div className="portal-card-icon-wrap">
                  <i className={`fa-solid ${g.icon}`} />
                </div>
                <h3>{g.title}</h3>
                <p>{g.desc}</p>
                <div className="portal-card-arrow">
                  <i
                    className={`fa-solid ${isRtl ? "fa-arrow-left" : "fa-arrow-right"}`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Scroll indicator */}
          <div className="hero-scroll-hint">
            <i className="fa-solid fa-chevron-down" />
          </div>
        </main>
      )}

      {/* ── About Page ─────────────────────────────── */}
      {portal === "about" && (
        <div className="about-dark-page fade-up">
          {/* ── Top nav bar ── */}
          <div className="about-topbar">
            <button className="about-back-btn" onClick={goHome}>
              <i
                className={`fa-solid ${isRtl ? "fa-arrow-right" : "fa-arrow-left"}`}
              />
              {t.backHome}
            </button>
            <h1 className="about-page-title">{t.aboutTitle}</h1>
          </div>

          {/* ── Full-page layout ── */}
          <div className="about-dark-layout">
            {/* Photo — absolute right, full height, bleeds into bg */}
            <div className="about-dark-photo-side">
              <div className="about-photo-orbit" aria-hidden="true">
                <span className="about-photo-orbit-ring about-photo-orbit-ring--1" />
                <span className="about-photo-orbit-ring about-photo-orbit-ring--2" />
                <span className="about-photo-orbit-ring about-photo-orbit-ring--3" />
              </div>
              <img
                src="/alaa-photo.jpg"
                alt={pickML(data.name, cvLang)}
                className="about-dark-photo-img"
              />
              {/* Gradient fade on the left edge — merges photo into dark bg */}
              <div className="about-dark-photo-fade" />
              {/* Name badge floating at bottom of photo */}
              <div className="about-dark-name-badge">
                <HeroNameDisplay
                  name={pickML(data.name, cvLang)}
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
                <span className="about-dark-role">{t.aboutSubtitle}</span>
              </div>
            </div>

            {/* Text content — sits BEHIND the photo (lower z-index) */}
            <div className="about-dark-content">
              <span className="about-dark-eyebrow">{t.aboutTitle}</span>
              <p className="about-dark-bio">{displayML(data.bio, cvLang)}</p>

              {/* CV Download Buttons — exports current site language */}
              {visitorCvDocsAt(data, 'about').length > 0 && (
                <div className="about-dark-cv-btns">
                  {visitorCvDocsAt(data, 'about').map((d) => (
                      <button
                        key={d.id}
                        className={`about-glass-btn${d.id === 'agri' ? ' about-glass-btn-agri' : d.id === 'dev' ? ' about-glass-btn-design' : ''}`}
                        onClick={() => requestVisitorCv(d)}
                      >
                        <i
                          className={`fa-solid ${d.icon} about-cv-btn-icon`}
                          style={{ color: CV_BTN_ICON_COLOR }}
                        />
                        <span className="about-cv-btn-label">{cvDocLabel(d, cvLang)}</span>
                        <i className="fa-solid fa-arrow-down about-cv-btn-dl" style={{ color: CV_BTN_ICON_COLOR }} />
                      </button>
                    ))}
                </div>
              )}

              {/* Skills */}
              <h4 className="about-dark-skills-title">{t.aboutSkillsTitle}</h4>
              <div className="about-dark-skills-list">
                {data.skills.map((skill) => (
                  <div key={skill.id} className="about-dark-skill-row">
                    <div className="about-dark-skill-info">
                      <SkillIcon icon={skill.icon} name={skill.name} size={18} />
                      <span>{skill.name}</span>
                      <span className="about-dark-skill-pct">
                        {skill.percent}%
                      </span>
                    </div>
                    <div className="about-dark-skill-track">
                      <div
                        className="about-dark-skill-fill"
                        style={{ width: `${skill.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Agricultural Portal ─────────────────────── */}
      {portal === "agri" && (() => {
        const agriTabs = [
          ...(data.aiDiagnosticsEnabled ? [{ key: 'diag', label: t.diagTab }] : []),
          { key: 'season', label: t.seasonTab },
          { key: 'books', label: t.agriBooks },
          { key: 'articles', label: t.agriArticles },
          { key: 'soilreq', label: t.soilReqTab },
        ];
        const activeKey = (agriTabs[agriTab] || agriTabs[0]).key;
        const bookKindLabel = (k: BookKind) =>
          k === 'theory' ? (lang === 'ar' ? 'نظري' : lang === 'de' ? 'Theorie' : 'Theory')
          : k === 'practical' ? (lang === 'ar' ? 'عملي' : lang === 'de' ? 'Praxis' : 'Practical')
          : (lang === 'ar' ? 'نظري وعملي' : lang === 'de' ? 'Theorie & Praxis' : 'Theory & Practical');
        const borderCol = theme === 'dark' ? 'rgba(255,255,255,0.12)' : '#dde6f0';
        const bgs = { ...DEFAULT_BOOK_GRID, ...(data.bookGridSettings || {}) };
        const bookGridCss = bookGridStyleResponsive(bgs, isMobileView);
        const ags = { ...DEFAULT_ARTICLE_GRID, ...(data.articleGridSettings || {}) };
        const articleGridCss = articleGridStyleResponsive(ags, isMobileView);
        const renderBookCard = (book: AgriBook) => {
          const waPhone = (data.personalInfo?.phone || '').replace(/\D/g, '');
          const waMsg   = encodeURIComponent((lang === 'ar' ? 'مرحباً م. علاء، أريد شراء كتاب: ' : 'Hello Eng. Alaa, I want to purchase: ') + pickML(book.title, lang as LangKey));
          const waLink  = `https://wa.me/${waPhone}?text=${waMsg}`;
          const thumbSrc = book.thumbnail ? driveThumb(book.thumbnail) : '';
          return (
            <div key={book.id} className="glass book-grid-card" style={{ borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', position: 'relative' }}>
              {book.isPaid !== undefined && (
                <BookAccessRibbon isPaid={!!book.isPaid} freeLabel={t.freeBadge} paidLabel={t.paidBadge} grid={bgs} />
              )}
              <BookCover src={thumbSrc || undefined} alt={pickML(book.title, lang as LangKey)} />
              <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="book-card-title" style={{ color: theme === 'dark' ? '#dfe9f8' : '#003366' }}>{pickML(book.title, lang as LangKey)}</div>
                {pickML(book.author, lang as LangKey) && <div className="book-card-author" style={{ color: theme === 'dark' ? '#9fb3cc' : '#666' }}>{pickML(book.author, lang as LangKey)}</div>}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
                  <span className="book-card-tag" style={{ fontWeight: 700, background: 'var(--navy-light)', color: 'var(--navy)', borderRadius: 6, padding: '2px 7px' }}>{bookKindLabel(book.kind)}</span>
                  {book.pages && <span className="book-card-tag" style={{ color: '#aaa' }}>{book.pages} {lang === 'ar' ? 'صفحة' : lang === 'de' ? 'Seiten' : 'pages'}</span>}
                </div>
                {book.isPaid && book.price && (
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#f0a030', marginTop: 2 }}>
                    💰 {book.price} {book.currency || data.currency || ''}
                  </div>
                )}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* PAID: preview button + contact */}
                  {book.isPaid ? (
                    <>
                      {book.previewUrl && (
                        <button type="button" onClick={() => setBookPreview(book)}
                          className="book-btn-preview"
                          style={{ background: 'var(--btn-bg, var(--navy))', color: 'var(--btn-text, #fff)', border: 'none' }}>
                          <i className="fa-solid fa-eye" /> {t.previewBook}
                        </button>
                      )}
                      <a href={waLink} target="_blank" rel="noreferrer"
                        className="book-btn-download"
                        style={{ background: '#25d366', color: '#fff' }}>
                        <i className="fa-brands fa-whatsapp" /> {t.contactToBuy}
                      </a>
                    </>
                  ) : (
                    /* FREE: preview (optional) + direct download */
                    <>
                      {book.previewUrl && (
                        <button type="button" onClick={() => setBookPreview(book)}
                          className="book-btn-preview"
                          style={{ background: 'rgba(100,160,255,0.12)', color: theme === 'dark' ? '#7db8ff' : '#003366', border: `1px solid ${theme === 'dark' ? 'rgba(100,160,255,0.3)' : '#c0d4f0'}` }}>
                          <i className="fa-solid fa-eye" /> {t.previewBook}
                        </button>
                      )}
                      {book.driveUrl && (
                        <a href={book.driveUrl} target="_blank" rel="noreferrer"
                          className="book-btn-download"
                          onClick={() => trackFileDownload(pickML(book.title, lang as LangKey) || 'book', book.id)}
                          style={{ background: 'var(--btn-bg, var(--navy))', color: 'var(--btn-text, #fff)' }}>
                          <i className="fa-solid fa-download" /> {t.downloadBook}
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        };
        const langFilteredBooks = (data.agriBooks || []).filter(b => !b.languages || b.languages.length === 0 || b.languages.includes(lang as LangKey));
        const renderLibNode = (node: LibraryNode, depth: number): JSX.Element => {
          const open = !!libOpen[node.id];
          const nodeBooks = langFilteredBooks.filter(b => b.nodeId === node.id);
          const hasContent = node.children.length > 0 || nodeBooks.length > 0;
          return (
            <div key={node.id}>
              <button onClick={() => setLibOpen(s => ({ ...s, [node.id]: !s[node.id] }))}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: depth === 0 ? 'var(--navy)' : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f3f7fc'), color: depth === 0 ? '#fff' : (theme === 'dark' ? '#dfe9f8' : '#003366'), border: depth === 0 ? 'none' : `1px solid ${borderCol}`, borderRadius: 10, padding: depth === 0 ? '12px 16px' : '9px 14px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: depth === 0 ? 15 : 13, textAlign: isRtl ? 'right' : 'left' }}>
                <i className={`fa-solid ${open ? 'fa-folder-open' : 'fa-folder'}`} style={{ opacity: .85 }} />
                <span style={{ flex: 1 }}>{pickML(node.name, lang as LangKey) || '—'}</span>
                {nodeBooks.length > 0 && <span style={{ fontSize: 11, opacity: .8, fontWeight: 400 }}>{nodeBooks.length} {lang === 'ar' ? 'كتاب' : lang === 'de' ? 'Bücher' : 'books'}</span>}
                {hasContent && <i className={`fa-solid fa-chevron-${open ? 'down' : (isRtl ? 'left' : 'right')}`} style={{ fontSize: 12 }} />}
              </button>
              {open && hasContent && (
                <div style={{ marginTop: 8, marginInlineStart: 14, borderInlineStart: `2px solid ${borderCol}`, paddingInlineStart: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {nodeBooks.length > 0 && (
                    <div className="books-dynamic-grid" style={bookGridCss}>
                      {nodeBooks.map(renderBookCard)}
                    </div>
                  )}
                  {node.children.map(child => renderLibNode(child, depth + 1))}
                </div>
              )}
            </div>
          );
        };
        // Expanded view: everything visible, children laid side-by-side at the
        // "semester" level (depth 1's children) so each year stacks vertically
        // while its semesters/sections sit next to each other.
        const renderLibNodeExpanded = (node: LibraryNode, depth: number): JSX.Element => {
          const nodeBooks = langFilteredBooks.filter(b => b.nodeId === node.id);
          const name = pickML(node.name, lang as LangKey) || '—';
          const childrenSideBySide = depth === 1 && node.children.length > 0;
          const headerStyle: React.CSSProperties =
            depth === 0 ? { background: 'var(--btn-bg, var(--navy))', color: 'var(--btn-text, #fff)', borderRadius: 10, padding: '12px 16px', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 10 }
            : depth === 1 ? { color: theme === 'dark' ? '#dfe9f8' : '#003366', fontWeight: 800, fontSize: 17, padding: '4px 0 10px', borderBottom: `2px solid var(--navy)`, display: 'flex', alignItems: 'center', gap: 9 }
            : depth === 2 ? { background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#eef4fb', color: theme === 'dark' ? '#dfe9f8' : '#003366', borderRadius: 8, padding: '8px 12px', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }
            : { color: theme === 'dark' ? '#bcd0ea' : '#2a4a6b', fontWeight: 700, fontSize: 13, padding: '2px 0', display: 'flex', alignItems: 'center', gap: 7 };
          return (
            <div key={node.id} style={{ display: 'flex', flexDirection: 'column', gap: 12, ...(depth === 1 ? { background: theme === 'dark' ? 'rgba(255,255,255,0.03)' : '#fafcff', border: `1px solid ${borderCol}`, borderRadius: 12, padding: 16 } : {}), ...(depth === 2 ? { border: `1px solid ${borderCol}`, borderRadius: 10, padding: 12 } : {}) }}>
              <div style={headerStyle}>
                <i className={`fa-solid ${depth >= 2 ? 'fa-book-bookmark' : 'fa-folder-open'}`} style={{ opacity: .85 }} />
                <span style={{ flex: 1 }}>{name}</span>
                {nodeBooks.length > 0 && <span style={{ fontSize: 11, fontWeight: 400, opacity: .8 }}>{nodeBooks.length} {lang === 'ar' ? 'كتاب' : lang === 'de' ? 'Bücher' : 'books'}</span>}
              </div>
              {nodeBooks.length > 0 && (
                <div className="books-dynamic-grid" style={bookGridCss}>
                  {nodeBooks.map(renderBookCard)}
                </div>
              )}
              {node.children.length > 0 && (
                <div style={childrenSideBySide
                  ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16, alignItems: 'start' }
                  : { display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {node.children.map(child => renderLibNodeExpanded(child, depth + 1))}
                </div>
              )}
            </div>
          );
        };
        return (
        <div className="content-wrap fade-up">
          <div className="section-head">
            <h2 className="section-title">{t.agriTitle}</h2>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {cvDocVisibleAt(data, 'agri', 'agriPortal') && data.cvDocs.find(d => d.id === 'agri') && (
                <button
                  className="btn-pill"
                  style={{ borderColor: '#2a7a2a' }}
                  onClick={() => requestVisitorCv(data.cvDocs.find(d => d.id === 'agri')!)}
                  title={lang === 'ar' ? 'تنزيل سيرة الزراعة PDF' : lang === 'de' ? 'Landwirtschafts-CV als PDF' : 'Download Agriculture CV PDF'}
                >
                  <i className="fa-solid fa-file-pdf" style={{ color: '#2a7a2a' }} />
                  {lang === 'ar' ? 'سيرة الزراعة' : lang === 'de' ? 'Landwirtschafts-CV' : 'Agriculture CV'}
                  <i className="fa-solid fa-arrow-down" />
                </button>
              )}
              <button className="btn-back mobile-hidden" onClick={goHome}>
                {t.backHome}{" "}
                <i
                  className={`fa-solid ${isRtl ? "fa-arrow-right" : "fa-arrow-left"}`}
                />
              </button>
            </div>
          </div>

          {/* Desktop: pill tabs */}
          <div className="sub-tabs desktop-sub-tabs">
            {agriTabs.map((tb, i) => (
              <button
                key={tb.key}
                className={`tab-btn${agriTab === i ? " active" : ""}`}
                onClick={() => setAgriTab(i)}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {/* Mobile: quick-access icon buttons */}
          {(() => {
            const diagIdx    = agriTabs.findIndex(t => t.key === 'diag');
            const seasonIdx  = agriTabs.findIndex(t => t.key === 'season');
            const booksIdx   = agriTabs.findIndex(t => t.key === 'books');
            const artIdx     = agriTabs.findIndex(t => t.key === 'articles');
            const soilIdx    = agriTabs.findIndex(t => t.key === 'soilreq');
            const ql = lang === 'ar' ? ['افحص نباتك','موسمك الآن','الكتب','الأبحاث والمقالات','تحليل التربة']
                     : lang === 'de' ? ['Pflanze','Saison','Bücher','Artikel','Boden']
                     : ['Plant','Season','Books','Articles','Soil'];
            const icons = ['fa-leaf', 'fa-cloud-sun', 'fa-book-open', 'fa-newspaper', 'fa-flask'];
            const idxs = [diagIdx, seasonIdx, booksIdx, artIdx, soilIdx];
            return (
              <div className="agri-mobile-quicktabs">
                {idxs.map((idx, i) => idx >= 0 && (
                  <button key={agriTabs[idx].key} className={`agri-mqt-btn${agriTab === idx ? ' active' : ''}`}
                    onClick={() => setAgriTab(idx)}>
                    <i className={`fa-solid ${icons[i]}`} /><span>{ql[i]}</span>
                  </button>
                ))}
              </div>
            );
          })()}

          {activeKey === 'diag' && (
            <PlantDiagnostic data={data} lang={lang as LangKey} />
          )}

          {activeKey === 'season' && (
            <SeasonNowPanel data={data} lang={lang as LangKey} active={activeKey === 'season'} />
          )}

          {activeKey === 'soilreq' && (
            <SoilRequest data={data} lang={lang as LangKey} />
          )}

          {/* Articles — full-page view OR list with search */}
          {activeKey === 'articles' && (
            articlePage ? (
              /* ── Full-page Article View ── */
              <div style={{ maxWidth: 820, margin: '0 auto' }}>
                {/* Top navigation buttons */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button onClick={() => { setArticlePage(null); setArticleEditMode(false); setArticleEditData(null); const y = articleScrollRef.current; requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y))); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--btn-bg, var(--navy))', color: 'var(--btn-text, #fff)', border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13 }}>
                    <i className={`fa-solid ${isRtl ? 'fa-arrow-right' : 'fa-arrow-left'}`} />
                    {lang === 'ar' ? 'العودة للمقالات' : lang === 'de' ? 'Zurück zu Artikeln' : 'Back to Articles'}
                  </button>
                  <button onClick={goHome}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#eef4fb', color: theme === 'dark' ? '#dfe9f8' : '#003366', border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13 }}>
                    <i className="fa-solid fa-house" />
                    {lang === 'ar' ? 'الرئيسية' : lang === 'de' ? 'Startseite' : 'Home'}
                  </button>
                  {adminLoggedIn && !articleEditMode && (
                    <button onClick={() => { setArticleEditData({ ...articlePage }); setArticleEditLang(lang as LangKey); setArticleEditMode(true); }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#2a7a2a', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, marginInlineStart: 'auto' }}>
                      <i className="fa-solid fa-pen-to-square" />
                      {lang === 'ar' ? 'تعديل المقالة' : lang === 'de' ? 'Artikel bearbeiten' : 'Edit Article'}
                    </button>
                  )}
                </div>

                {/* Inline Admin Edit Panel */}
                {articleEditMode && articleEditData && (
                  <div className="glass" style={{ borderRadius: 14, padding: 22, marginBottom: 24, border: '2px solid #2a7a2a' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#2a7a2a' }}><i className="fa-solid fa-pen-to-square" /> {lang === 'ar' ? 'تعديل المقالة' : 'Edit Article'}</span>
                      <button onClick={() => { setArticleEditMode(false); setArticleEditData(null); }} style={{ background: 'none', border: '1px solid #ccc', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                    </div>
                    {/* Language tabs */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                      {(['ar', 'en', 'de'] as LangKey[]).map(l => (
                        <button key={l} onClick={() => setArticleEditLang(l)}
                          style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${articleEditLang === l ? '#2a7a2a' : '#ccc'}`, background: articleEditLang === l ? '#2a7a2a' : '#fff', color: articleEditLang === l ? '#fff' : '#555', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                          {l === 'ar' ? '🇸🇾 العربية' : l === 'en' ? '🇺🇸 English' : '🇩🇪 Deutsch'}
                        </button>
                      ))}
                    </div>
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>{lang === 'ar' ? `العنوان (${articleEditLang.toUpperCase()})` : `Title (${articleEditLang.toUpperCase()})`}</label>
                      <input type="text" value={articleEditData.title[articleEditLang] || ''} onChange={e => setArticleEditData({ ...articleEditData, title: { ...articleEditData.title, [articleEditLang]: e.target.value } })}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>{lang === 'ar' ? `المحتوى (${articleEditLang.toUpperCase()})` : `Content (${articleEditLang.toUpperCase()})`}</label>
                      <textarea rows={8} value={articleEditData.content[articleEditLang] || ''} onChange={e => setArticleEditData({ ...articleEditData, content: { ...articleEditData.content, [articleEditLang]: e.target.value } })}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>{lang === 'ar' ? `المرجع (${articleEditLang.toUpperCase()})` : `Reference (${articleEditLang.toUpperCase()})`}</label>
                      <input type="text" value={articleEditData.reference[articleEditLang] || ''} onChange={e => setArticleEditData({ ...articleEditData, reference: { ...articleEditData.reference, [articleEditLang]: e.target.value } })}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>{lang === 'ar' ? 'التاريخ' : 'Date'}</label>
                      <input type="date" value={articleEditData.date} onChange={e => setArticleEditData({ ...articleEditData, date: e.target.value })}
                        style={{ padding: '7px 10px', border: '1px solid #ccc', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => articleEditData && saveArticleInline(articleEditData)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2a7a2a', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 18px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13 }}>
                        <i className="fa-solid fa-floppy-disk" /> {lang === 'ar' ? 'حفظ' : 'Save'}
                      </button>
                      <button onClick={() => { setArticleEditMode(false); setArticleEditData(null); }}
                        style={{ background: 'none', border: '1px solid #ccc', borderRadius: 9, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Article content */}
                <div className="glass" style={{ borderRadius: 16, overflow: 'hidden' }}>
                  {articlePage.images.length > 0 && (
                    <div style={{ position: 'relative', background: '#000', overflow: 'hidden' }}>
                      <img src={resolveImageSrc(articlePage.images[Math.min(articleImgIdx, articlePage.images.length - 1)])} alt="" style={{ width: '100%', maxHeight: 420, objectFit: 'contain', display: 'block' }} />
                      {articlePage.images.length > 1 && (
                        <>
                          <button onClick={() => setArticleImgIdx(i => (i - 1 + articlePage.images.length) % articlePage.images.length)} style={{ position: 'absolute', insetInlineStart: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', fontSize: 16 }}><i className={`fa-solid ${isRtl ? 'fa-chevron-right' : 'fa-chevron-left'}`} /></button>
                          <button onClick={() => setArticleImgIdx(i => (i + 1) % articlePage.images.length)} style={{ position: 'absolute', insetInlineEnd: 10, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '50%', width: 40, height: 40, cursor: 'pointer', fontSize: 16 }}><i className={`fa-solid ${isRtl ? 'fa-chevron-left' : 'fa-chevron-right'}`} /></button>
                          <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 7 }}>
                            {articlePage.images.map((_, i) => <span key={i} onClick={() => setArticleImgIdx(i)} style={{ width: 9, height: 9, borderRadius: '50%', background: i === Math.min(articleImgIdx, articlePage.images.length - 1) ? '#fff' : 'rgba(255,255,255,0.45)', cursor: 'pointer' }} />)}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <div style={{ padding: '28px 32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--navy-light)', borderRadius: 8, padding: '3px 12px' }}>{articlePage.date}</span>
                      {data.articleCategories?.find(c => c.id === articlePage.categoryId) && (
                        <span style={{ fontSize: 12, color: 'var(--navy)', background: 'var(--navy-light)', borderRadius: 8, padding: '3px 12px', fontWeight: 600 }}>
                          <i className="fa-solid fa-folder" style={{ marginInlineEnd: 5 }} />
                          {pickML(data.articleCategories.find(c => c.id === articlePage.categoryId)!.name, lang as LangKey)}
                        </span>
                      )}
                    </div>
                    <h1 style={{ margin: '0 0 20px', color: theme === 'dark' ? '#dfe9f8' : '#003366', fontSize: 26, lineHeight: 1.4 }}>{pickML(articlePage.title, lang as LangKey)}</h1>
                    <div className="article-body" style={{ lineHeight: 1.9, color: theme === 'dark' ? '#ccd8ec' : '#444', fontSize: 15 }} dangerouslySetInnerHTML={{ __html: pickML(articlePage.content, lang as LangKey) }} />
                    {pickML(articlePage.reference, lang as LangKey) && (
                      <div style={{ marginTop: 28, padding: '14px 16px', background: theme === 'dark' ? 'rgba(0,51,102,0.3)' : '#f5f8fc', borderInlineStart: '4px solid var(--navy)', borderRadius: 8, fontSize: 13, color: theme === 'dark' ? '#bcd0ea' : '#555' }}>
                        <b style={{ color: theme === 'dark' ? '#dfe9f8' : '#003366' }}><i className="fa-solid fa-quote-right" /> {lang === 'ar' ? 'المرجع' : lang === 'de' ? 'Quelle' : 'Reference'}: </b>{pickML(articlePage.reference, lang as LangKey)}
                      </div>
                    )}

                    {/* Share buttons */}
                    <div style={{ marginTop: 32, paddingTop: 20, borderTop: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e8eff7'}` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', marginBottom: 12 }}>
                        <i className="fa-solid fa-share-nodes" style={{ marginInlineEnd: 6 }} />
                        {lang === 'ar' ? 'مشاركة المقالة' : lang === 'de' ? 'Artikel teilen' : 'Share Article'}
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent((pickML(articlePage.title, lang as LangKey) || '') + '\n' + window.location.href)}`}
                          target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#25d366', color: '#fff', borderRadius: 10, padding: '9px 18px', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                          <i className="fa-brands fa-whatsapp" style={{ fontSize: 16 }} />
                          {lang === 'ar' ? 'واتساب' : lang === 'de' ? 'WhatsApp' : 'WhatsApp'}
                        </a>
                        <a href={`mailto:?subject=${encodeURIComponent(pickML(articlePage.title, lang as LangKey) || '')}&body=${encodeURIComponent((pickML(articlePage.content, lang as LangKey) || '').slice(0, 300) + '…\n\n' + window.location.href)}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: theme === 'dark' ? 'rgba(255,255,255,0.12)' : '#eef4fb', color: theme === 'dark' ? '#dfe9f8' : '#003366', borderRadius: 10, padding: '9px 18px', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                          <i className="fa-solid fa-envelope" style={{ fontSize: 15 }} />
                          {lang === 'ar' ? 'بريد إلكتروني' : lang === 'de' ? 'E-Mail' : 'Email'}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Articles List with Search ── */
              (data.agriArticles || []).length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
                  <i className="fa-solid fa-newspaper" style={{ fontSize: '2.5rem', color: 'var(--navy)', marginBottom: 14, display: 'block' }} />
                  {lang === "ar" ? "لا توجد مقالات بعد" : lang === "de" ? "Noch keine Artikel" : "No articles yet"}
                </div>
              ) : (() => {
                /* Search bar */
                const sq = articleSearch.trim().toLowerCase();
                const cats = data.articleCategories || [];
                const allArticles = data.agriArticles || [];
                const filtered = sq
                  ? allArticles.filter(a =>
                      (pickML(a.title, lang as LangKey) + ' ' + pickML(a.content, lang as LangKey))
                        .toLowerCase().includes(sq)
                    )
                  : allArticles;
                const groups = sq
                  ? [{ id: '__search__', name: lang === 'ar' ? `نتائج البحث (${filtered.length})` : lang === 'de' ? `Suchergebnisse (${filtered.length})` : `Search Results (${filtered.length})`, items: filtered }]
                  : [
                      ...cats.map(c => ({ id: c.id, name: pickML(c.name, lang as LangKey) || '—', items: allArticles.filter(a => a.categoryId === c.id) })),
                      { id: '__none__', name: lang === 'ar' ? 'غير مصنّف' : lang === 'de' ? 'Ohne Kategorie' : 'Uncategorized', items: allArticles.filter(a => !cats.some(c => c.id === a.categoryId)) },
                    ].filter(g => g.items.length > 0);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Search bar */}
                    <div style={{ position: 'relative' }}>
                      <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 14, pointerEvents: 'none' }} />
                      <input type="search" value={articleSearch} onChange={e => setArticleSearch(e.target.value)}
                        placeholder={lang === 'ar' ? 'ابحث في المقالات والأبحاث…' : lang === 'de' ? 'Artikel durchsuchen…' : 'Search articles…'}
                        style={{ width: '100%', padding: '11px 16px', paddingInlineStart: 40, border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.15)' : '#dde6f0'}`, borderRadius: 12, fontFamily: 'inherit', fontSize: 14, background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#fff', color: theme === 'dark' ? '#dfe9f8' : '#003366', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    {filtered.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#999', padding: '30px 0' }}>
                        <i className="fa-solid fa-circle-xmark" style={{ fontSize: '2rem', marginBottom: 10, display: 'block', color: 'var(--navy)' }} />
                        {lang === 'ar' ? 'لا توجد نتائج' : lang === 'de' ? 'Keine Ergebnisse' : 'No results found'}
                      </div>
                    ) : (
                      groups.map(g => (
                        <div key={g.id}>
                          <h3 style={{ fontSize: 17, margin: '0 0 14px', color: theme === 'dark' ? '#dfe9f8' : '#003366', borderInlineStart: '4px solid var(--navy)', paddingInlineStart: 10 }}>
                            <i className="fa-solid fa-folder-open" style={{ marginInlineEnd: 8, opacity: .7 }} />{g.name}
                            {!sq && <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400, marginInlineStart: 8 }}>({g.items.length})</span>}
                          </h3>
                          <div className="articles-dynamic-grid" style={articleGridCss}>
                            {g.items.map(article => (
                              <div key={article.id} className="card glass" style={{ cursor: 'pointer' }} onClick={() => { articleScrollRef.current = window.scrollY; setArticlePage(article); setArticleImgIdx(0); setArticleEditMode(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                                {article.images[0] && (
                                  <div style={{ overflow: 'hidden', position: 'relative' }}>
                                    <img src={resolveImageSrc(article.images[0])} alt={pickML(article.title, lang as LangKey)} className="article-card-img" />
                                    {article.images.length > 1 && <span className="card-tag" style={{ position: 'absolute', top: 8, insetInlineEnd: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 20, padding: '2px 9px' }}><i className="fa-solid fa-images" /> {article.images.length}</span>}
                                  </div>
                                )}
                                <div className="card-body">
                                  <span className="card-tag">{article.date}</span>
                                  <div className="card-title">{pickML(article.title, lang as LangKey)}</div>
                                  <p className="card-desc">
                                    {(() => { const txt = stripHtml(pickML(article.content, lang as LangKey)); return txt.slice(0, 220) + (txt.length > 220 ? '…' : ''); })()}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })()
            )
          )}

          {/* Library — tree browser or full expanded view */}
          {activeKey === 'books' && (() => {
            const libLang = lang as LangKey;
            const visibleBooks = (data.agriBooks || []).filter(b => !b.languages || b.languages.length === 0 || b.languages.includes(libLang));
            const lsq = libSearch.trim().toLowerCase();
            const searchMatchBooks = lsq ? visibleBooks.filter(b =>
              (pickML(b.title, libLang) + ' ' + pickML(b.author, libLang)).toLowerCase().includes(lsq)
            ) : [];
            const renderBookCardFiltered = (book: AgriBook) => renderBookCard(book);
            if (visibleBooks.length === 0 && (data.libraryTree || []).length === 0) return (
              <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
                <i className="fa-solid fa-book-open" style={{ fontSize: '2.5rem', color: 'var(--navy)', marginBottom: 14, display: 'block' }} />
                {lang === "ar" ? "المكتبة فارغة بعد" : lang === "de" ? "Bibliothek ist noch leer" : "Library is empty"}
              </div>
            );
            return (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Search bar */}
                <div style={{ position: 'relative' }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', insetInlineStart: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 14, pointerEvents: 'none' }} />
                  <input type="search" value={libSearch} onChange={e => setLibSearch(e.target.value)}
                    placeholder={lang === 'ar' ? 'ابحث في الكتب والمراجع…' : lang === 'de' ? 'Bücher durchsuchen…' : 'Search books…'}
                    style={{ width: '100%', padding: '11px 16px', paddingInlineStart: 40, border: `1px solid ${borderCol}`, borderRadius: 12, fontFamily: 'inherit', fontSize: 14, background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#fff', color: theme === 'dark' ? '#dfe9f8' : '#003366', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                {/* Search results flat list */}
                {lsq ? (
                  searchMatchBooks.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#999', padding: '30px 0' }}>
                      <i className="fa-solid fa-circle-xmark" style={{ fontSize: '2rem', marginBottom: 10, display: 'block', color: 'var(--navy)' }} />
                      {lang === 'ar' ? 'لا توجد نتائج' : lang === 'de' ? 'Keine Ergebnisse' : 'No results found'}
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>
                        {lang === 'ar' ? `نتائج البحث (${searchMatchBooks.length})` : lang === 'de' ? `Suchergebnisse (${searchMatchBooks.length})` : `Search Results (${searchMatchBooks.length})`}
                      </div>
                      <div className="books-dynamic-grid" style={bookGridCss}>
                        {searchMatchBooks.map(renderBookCardFiltered)}
                      </div>
                    </div>
                  )
                ) : (
                  <>
                    {/* View switcher */}
                    <div style={{ display: 'flex', justifyContent: isRtl ? 'flex-start' : 'flex-end', gap: 6 }}>
                      <div style={{ display: 'inline-flex', border: `1px solid ${borderCol}`, borderRadius: 10, overflow: 'hidden' }}>
                        <button onClick={() => setLibView('tree')} title={lang === 'ar' ? 'عرض شجري' : lang === 'de' ? 'Baumansicht' : 'Tree view'}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', padding: '7px 14px', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: libView === 'tree' ? 'var(--btn-bg, var(--navy))' : 'transparent', color: libView === 'tree' ? 'var(--btn-text, #fff)' : (theme === 'dark' ? '#cdd9ec' : '#003366') }}>
                          <i className="fa-solid fa-folder-tree" /> {lang === 'ar' ? 'شجري' : lang === 'de' ? 'Baum' : 'Tree'}
                        </button>
                        <button onClick={() => setLibView('expanded')} title={lang === 'ar' ? 'عرض كامل' : lang === 'de' ? 'Vollansicht' : 'Full view'}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', padding: '7px 14px', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: libView === 'expanded' ? 'var(--btn-bg, var(--navy))' : 'transparent', color: libView === 'expanded' ? 'var(--btn-text, #fff)' : (theme === 'dark' ? '#cdd9ec' : '#003366') }}>
                          <i className="fa-solid fa-table-cells-large" /> {lang === 'ar' ? 'كامل' : lang === 'de' ? 'Voll' : 'Full'}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: libView === 'expanded' ? 24 : 10 }}>
                      {(data.libraryTree || []).map(node => libView === 'expanded' ? renderLibNodeExpanded(node, 0) : renderLibNode(node, 0))}
                      {(() => {
                        const allIds = new Set<string>();
                        const collect = (ns: LibraryNode[]) => ns.forEach(n => { allIds.add(n.id); collect(n.children); });
                        collect(data.libraryTree || []);
                        const orphans = visibleBooks.filter(b => !b.nodeId || !allIds.has(b.nodeId));
                        return orphans.length > 0 ? (
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--muted)', margin: '6px 0 10px' }}>{lang === 'ar' ? 'كتب غير مصنّفة' : lang === 'de' ? 'Nicht kategorisierte Bücher' : 'Uncategorized books'}</div>
                            <div className="books-dynamic-grid" style={bookGridCss}>
                              {orphans.map(renderBookCardFiltered)}
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

        </div>
        );
      })()}

      {/* ── Graphics Portal (3-tier) ─────────────────── */}
      {portal === "graphics" && (() => {
        const gfxCats = data.gfxCategories || [];
        const gfxGrid = { ...DEFAULT_GFX_GRID, ...(data.gfxGridSettings || {}) };
        const browseMode = gfxBrowseView;
        const gridStyle = gfxGridStyleResponsive(gfxGrid, isMobileView);
        const selCat = gfxCats.find(c => c.id === gfxSelCatId) || gfxCats[0];
        const selSub = selCat?.subCategories.find(s => s.id === gfxSelSubId);
        const totalInCat = selCat
          ? selCat.subCategories.reduce((n, s) => n + s.items.length, 0)
          : 0;
        const allItems = selSub ? selSub.items : (selCat ? selCat.subCategories.flatMap(s => s.items) : []);
        const itemMatchesSearch = (item: GfxProjectItem) => {
          if (!gfxSearch.trim()) return true;
          const q = gfxSearch.toLowerCase();
          return (pickML(item.title, lang as LangKey) + ' ' + pickML(item.desc, lang as LangKey)).toLowerCase().includes(q);
        };
        const searchedItems = allItems.filter(itemMatchesSearch);
        const showAllGrouped = browseMode === 'byCategory' && !gfxSelSubId && !gfxSearch.trim() && !!selCat;
        const allLabel = lang === 'ar' ? 'الكل' : lang === 'de' ? 'Alle' : 'All';

        const buildGfxNavList = (): GfxProjectItem[] => {
          if (browseMode === 'all') {
            return gfxCats.flatMap(cat =>
              cat.subCategories.flatMap(sub => sub.items.filter(itemMatchesSearch)),
            );
          }
          if (showAllGrouped && selCat) {
            return selCat.subCategories.flatMap(sub => sub.items.filter(itemMatchesSearch));
          }
          return searchedItems;
        };

        const openGfxProject = (item: GfxProjectItem) => {
          setGfxProjectPage(item);
          setGfxCarouselIdx(0);
          setGfxRequestOpen(false);
          setGfxZoom(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        const renderSubDivider = (label: string, count: number) => (
          <div className="gfx-sub-divider">
            <div className="gfx-sub-divider-line" style={{ background: `linear-gradient(${isRtl ? '270deg' : '90deg'}, rgba(0,51,102,0.08), #003366)` }} />
            <span className="gfx-sub-divider-label">{label} · {count}</span>
            <div className="gfx-sub-divider-line" style={{ background: `linear-gradient(${isRtl ? '90deg' : '270deg'}, rgba(0,51,102,0.08), #003366)` }} />
          </div>
        );

        const renderSubGrid = (items: GfxProjectItem[]) => (
          items.length > 0 ? (
            <div className="gfx-dyn-grid" style={gridStyle}>{items.map(renderCard)}</div>
          ) : (
            <p className="gfx-sub-empty">
              {lang === 'ar' ? 'لا مشاريع في هذا الفرع بعد' : lang === 'de' ? 'Noch keine Projekte in dieser Kategorie' : 'No projects in this branch yet'}
            </p>
          )
        );

        const renderEmptyGallery = (searching: boolean) => (
          <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
            <i className="fa-solid fa-images" style={{ fontSize: '2.5rem', color: theme === 'dark' ? '#5b9bff' : '#003366', marginBottom: 14, display: 'block' }} />
            {searching
              ? (lang === 'ar' ? 'لا توجد نتائج' : lang === 'de' ? 'Keine Ergebnisse' : 'No results found')
              : (lang === 'ar' ? 'لا توجد مشاريع بعد' : lang === 'de' ? 'Noch keine Projekte' : 'No projects yet')}
          </div>
        );

        const renderCard = (item: GfxProjectItem) => (
          <div key={item.id} className="card glass" style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
            onClick={() => { gfxGalleryScrollRef.current = window.scrollY; openGfxProject(item); }}>
            <div style={{ overflow: 'hidden', position: 'relative' }}>
              {gfxModelAsMain(item) && item.glbUrl ? (
                <GfxModelViewer key={`${item.id}-${gfxViewSettingsKey(item.glbViewSettings)}`} url={item.glbUrl} settings={item.glbViewSettings} height={220} className="card-img" style={{ minHeight: 180 }} />
              ) : (item.mainImgIsVideo || getGfxMediaSlides(item)[0]?.isVideo) ? (
                <GfxMediaSlide url={item.mainImg || ''} isVideo objectFit="cover" className="card-img" style={{ transition: 'transform 0.35s ease' }} />
              ) : (
                <img src={resolveImageSrc(item.mainImg || '')} alt={pickML(item.title, lang as LangKey)} className="card-img"
                  style={{ transition: 'transform 0.35s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
              )}
              {data.watermarkImg && !item.mainImgNoWm && <img src={data.watermarkImg} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: data.watermarkOpacity ?? 0.15, pointerEvents: 'none' }} />}
              {item.cvSettings.isFeatured && <div style={{ position: 'absolute', top: 8, insetInlineStart: 8, background: '#003366', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px' }}>★ {lang === 'ar' ? 'مميز' : 'Featured'}</div>}
              {(item.images.length > 0 || item.videoUrl || item.glbUrl) && (
                <div style={{ position: 'absolute', bottom: 8, insetInlineEnd: 8, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 11, borderRadius: 8, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className="fa-solid fa-images" />{item.images.length + (item.mainImg ? 1 : 0)}
                  {item.glbUrl && <i className="fa-solid fa-cube" style={{ marginInlineStart: 4 }} />}
                  {item.videoUrl && <><i className="fa-solid fa-play" style={{ marginInlineStart: 4 }} /></>}
                </div>
              )}
            </div>
            <div className="card-body">
              <span className="card-tag">{t.gfxTag}</span>
              <div className="card-title">{pickML(item.title, lang as LangKey)}</div>
            </div>
          </div>
        );

        // ── Full-page project view ──────────────────────────
        if (gfxProjectPage) {
          const projectSlides = getGfxProjectSlides(gfxProjectPage);
          const totalSlides = projectSlides.length;
          const current = projectSlides[gfxCarouselIdx];
          const isYoutubeSlide = current?.kind === 'youtube';
          const isModelSlide = current?.kind === 'model';
          const isImageSlide = current?.kind === 'image';
          const projectTitle = pickML(gfxProjectPage.title, lang as LangKey) || '';
          const projectDesc = pickML(gfxProjectPage.desc, lang as LangKey) || '';
          const gfxNavList = buildGfxNavList();
          const projIdx = gfxNavList.findIndex(p => p.id === gfxProjectPage.id);
          const hasPrevProj = projIdx > 0;
          const hasNextProj = projIdx >= 0 && projIdx < gfxNavList.length - 1;
          const goPrevProj = () => { if (hasPrevProj) openGfxProject(gfxNavList[projIdx - 1]); };
          const goNextProj = () => { if (hasNextProj) openGfxProject(gfxNavList[projIdx + 1]); };
          const prevImg = () => setGfxCarouselIdx(i => Math.max(0, i - 1));
          const nextImg = () => setGfxCarouselIdx(i => Math.min(totalSlides - 1, i + 1));
          const phoneRaw = (data as any).personalInfo?.phone || '';
          const waPhone = phoneRaw.replace(/\D/g, '');
          const contactEmail = (data as any).personalInfo?.email || '';
          const waMsg = encodeURIComponent(`${lang === 'ar' ? 'أريد طلب تصميم مشابه' : lang === 'de' ? 'Ich möchte ein ähnliches Design anfragen' : 'I want to request a similar design'}: ${projectTitle}`);
          const emailSubj = encodeURIComponent(`${lang === 'ar' ? 'طلب تصميم مشابه' : lang === 'de' ? 'Ähnliches Design anfragen' : 'Similar Design Request'}: ${projectTitle}`);
          const emailBody = encodeURIComponent(`${lang === 'ar' ? 'السلام عليكم،\n\nأريد طلب تصميم مشابه للمشروع: ' : lang === 'de' ? 'Guten Tag,\n\nIch möchte ein ähnliches Design für das Projekt anfragen: ' : 'Hello,\n\nI would like to request a similar design for the project: '}${projectTitle}\n\n${projectDesc.slice(0, 300)}`);

          return (
            <div className="content-wrap fade-up" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
              {/* Navigation header */}
              <div className="section-head" style={{ marginBottom: 20 }}>
                <h2 className="section-title">{t.graphicsTitle}</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn-back" onClick={() => { setGfxProjectPage(null); setGfxCarouselIdx(0); setGfxRequestOpen(false); setGfxZoom(false); const y = gfxGalleryScrollRef.current; requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y))); }}>
                    <i className={`fa-solid ${isRtl ? 'fa-arrow-right' : 'fa-arrow-left'}`} style={{ marginInlineEnd: 6 }} />{t.gfxBack}
                  </button>
                  <button className="btn-back" onClick={goHome}>
                    <i className="fa-solid fa-house" style={{ marginInlineEnd: 6 }} />{t.backHome}
                  </button>
                </div>
              </div>

              {/* Project-to-project navigation */}
              {(hasPrevProj || hasNextProj) && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
                  <button type="button" className="btn-back" disabled={!hasPrevProj} onClick={goPrevProj}
                    style={{ opacity: hasPrevProj ? 1 : 0.45, cursor: hasPrevProj ? 'pointer' : 'not-allowed' }}>
                    <i className={`fa-solid ${isRtl ? 'fa-chevron-right' : 'fa-chevron-left'}`} style={{ marginInlineEnd: 6 }} />
                    {lang === 'ar' ? 'التصميم السابق' : lang === 'de' ? 'Vorheriges Design' : 'Previous design'}
                  </button>
                  {projIdx >= 0 && gfxNavList.length > 1 && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: theme === 'dark' ? '#a8c0e0' : '#667' }}>
                      {projIdx + 1} / {gfxNavList.length}
                    </span>
                  )}
                  <button type="button" className="btn-back" disabled={!hasNextProj} onClick={goNextProj}
                    style={{ opacity: hasNextProj ? 1 : 0.45, cursor: hasNextProj ? 'pointer' : 'not-allowed' }}>
                    {lang === 'ar' ? 'التصميم التالي' : lang === 'de' ? 'Nächstes Design' : 'Next design'}
                    <i className={`fa-solid ${isRtl ? 'fa-chevron-left' : 'fa-chevron-right'}`} style={{ marginInlineStart: 6 }} />
                  </button>
                </div>
              )}

              {/* Glassmorphism Hero Gallery */}
              <div style={{ background: 'linear-gradient(135deg, #070f1e 0%, #0f1e38 50%, #08122a 100%)', borderRadius: 24, padding: 20, marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
                {/* Decorative ambient glows */}
                <div style={{ position: 'absolute', top: -80, insetInlineStart: -60, width: 300, height: 300, background: 'radial-gradient(circle, rgba(68,136,255,0.12) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
                <div style={{ position: 'absolute', bottom: -60, insetInlineEnd: -40, width: 260, height: 260, background: 'radial-gradient(circle, rgba(140,60,255,0.1) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

                {/* Main slide */}
                <div style={{ position: 'relative', zIndex: 1, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', borderRadius: 18, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  {isYoutubeSlide
                    ? <iframe src={resolveVideoEmbedSrc(gfxProjectPage.videoUrl) || ''} style={{ width: '100%', height: 440, border: 'none', display: 'block' }} allowFullScreen title="video" />
                    : isModelSlide
                      ? <GfxModelViewer key={gfxViewSettingsKey(current.settings)} url={current.url} settings={current.settings} height={440} style={{ width: '100%' }} allowUserControl />
                      : isImageSlide
                        ? <GfxMediaSlide
                            url={current.url}
                            isVideo={current.isVideo}
                            alt={projectTitle}
                            onClick={current.isVideo ? undefined : () => setGfxZoom(true)}
                            style={{ maxHeight: 480, cursor: current.isVideo ? 'default' : 'zoom-in' }}
                          />
                        : <i className="fa-solid fa-image" style={{ fontSize: 48, color: 'rgba(255,255,255,0.2)' }} />
                  }

                  {/* Zoom (enlarge image) button */}
                  {isImageSlide && current && !current.isVideo && (
                    <button onClick={() => setGfxZoom(true)}
                      title={lang === 'ar' ? 'تكبير الصورة' : lang === 'de' ? 'Bild vergrößern' : 'Enlarge image'}
                      style={{ position: 'absolute', top: 12, insetInlineEnd: 12, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '50%', width: 42, height: 42, color: '#fff', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
                      <i className="fa-solid fa-magnifying-glass-plus" />
                    </button>
                  )}
                  {data.watermarkImg && (() => {
                    const noWm = isImageSlide && current ? current.noWm : true;
                    return !noWm && isImageSlide && current && !current.isVideo
                      ? <img src={data.watermarkImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: data.watermarkOpacity ?? 0.15, pointerEvents: 'none' }} />
                      : null;
                  })()}

                  {/* Prev/Next image arrows */}
                  {totalSlides > 1 && (<>
                    <button onClick={prevImg} style={{ position: 'absolute', top: '50%', insetInlineStart: 12, transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '50%', width: 44, height: 44, color: '#fff', cursor: gfxCarouselIdx > 0 ? 'pointer' : 'not-allowed', opacity: gfxCarouselIdx > 0 ? 1 : 0.35, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                      <i className={`fa-solid ${isRtl ? 'fa-chevron-right' : 'fa-chevron-left'}`} />
                    </button>
                    <button onClick={nextImg} style={{ position: 'absolute', top: '50%', insetInlineEnd: 12, transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '50%', width: 44, height: 44, color: '#fff', cursor: gfxCarouselIdx < totalSlides - 1 ? 'pointer' : 'not-allowed', opacity: gfxCarouselIdx < totalSlides - 1 ? 1 : 0.35, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                      <i className={`fa-solid ${isRtl ? 'fa-chevron-left' : 'fa-chevron-right'}`} />
                    </button>
                  </>)}

                  {/* Slide counter badge */}
                  {totalSlides > 1 && (
                    <div style={{ position: 'absolute', bottom: 12, insetInlineEnd: 14, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', color: '#fff', fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.15)', zIndex: 2 }}>
                      {gfxCarouselIdx + 1} / {totalSlides}
                    </div>
                  )}
                </div>

                {/* Thumbnail strip */}
                {totalSlides > 1 && (
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, position: 'relative', zIndex: 1 }}>
                    {projectSlides.map((slide, i) => (
                      <div key={i} onClick={() => setGfxCarouselIdx(i)}
                        style={{ flexShrink: 0, width: 72, height: 54, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${gfxCarouselIdx === i ? '#4a90e2' : 'rgba(255,255,255,0.12)'}`, transition: 'border-color 0.2s', background: 'rgba(0,0,0,0.4)', position: 'relative' }}>
                        {slide.kind === 'model' ? (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: slide.settings?.backgroundColor || '#e8eef4' }}>
                            <i className="fa-solid fa-cube" style={{ color: '#003366', fontSize: 22 }} />
                          </div>
                        ) : slide.kind === 'youtube' ? (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(220,0,0,0.4)' }}>
                            <i className="fa-solid fa-play" style={{ color: '#fff', fontSize: 20 }} />
                          </div>
                        ) : slide.isVideo ? (
                          <>
                            <GfxMediaSlide url={slide.url} isVideo objectFit="cover" />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }}>
                              <i className="fa-solid fa-film" style={{ color: '#fff', fontSize: 16 }} />
                            </div>
                          </>
                        ) : (
                          <img src={resolveImageSrc(slide.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Image navigation shortcuts (when multiple slides) */}
                {totalSlides > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10, position: 'relative', zIndex: 1 }}>
                    <button type="button" onClick={prevImg} disabled={gfxCarouselIdx <= 0}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.45)', color: '#fff', cursor: gfxCarouselIdx > 0 ? 'pointer' : 'not-allowed', opacity: gfxCarouselIdx > 0 ? 1 : 0.4, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                      <i className={`fa-solid ${isRtl ? 'fa-chevron-right' : 'fa-chevron-left'}`} />
                      {lang === 'ar' ? 'الصورة السابقة' : lang === 'de' ? 'Vorheriges Bild' : 'Previous image'}
                    </button>
                    <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 600 }}>{gfxCarouselIdx + 1} / {totalSlides}</span>
                    <button type="button" onClick={nextImg} disabled={gfxCarouselIdx >= totalSlides - 1}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(0,0,0,0.45)', color: '#fff', cursor: gfxCarouselIdx < totalSlides - 1 ? 'pointer' : 'not-allowed', opacity: gfxCarouselIdx < totalSlides - 1 ? 1 : 0.4, fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                      {lang === 'ar' ? 'الصورة التالية' : lang === 'de' ? 'Nächstes Bild' : 'Next image'}
                      <i className={`fa-solid ${isRtl ? 'fa-chevron-left' : 'fa-chevron-right'}`} />
                    </button>
                  </div>
                )}
              </div>

              {/* Project info */}
              <div style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fff', border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.09)' : '#e4e9f4'}`, borderRadius: 18, padding: '24px 28px', marginBottom: 16 }}>
                <h1 style={{ margin: '0 0 12px', fontSize: 22, color: theme === 'dark' ? '#dfe9f8' : '#003366', lineHeight: 1.4 }}>{projectTitle}</h1>
                {projectDesc && <p style={{ margin: '0 0 18px', color: theme === 'dark' ? '#b8cce8' : '#4a5870', lineHeight: 1.85, fontSize: 15 }}>{projectDesc}</p>}
                {gfxProjectPage.cvSettings.showTools !== false && gfxProjectPage.usedSkillsIds.length > 0 && (
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: theme === 'dark' ? '#a8c8f0' : '#003366', marginBottom: 12 }}>
                      {lang === 'ar' ? 'البرامج المستخدمة في التصميم' : lang === 'de' ? 'Verwendete Programme' : 'Software used'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
                      {gfxProjectPage.usedSkillsIds.map(id => {
                        const sk = data.skills.find(s => s.id === id);
                        if (!sk) return null;
                        const iconSize = sk.size || data.skills[0]?.size || 28;
                        return (
                          <div key={id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 64, maxWidth: 88, textAlign: 'center' }}>
                            <SkillIcon icon={sk.icon} name={sk.name} size={iconSize} />
                            <span style={{ fontSize: 11, fontWeight: 600, color: theme === 'dark' ? '#b8cce8' : '#4a5870', lineHeight: 1.3 }}>{sk.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* معاينة 3D إضافية إن لم تكن رئيسية */}
                {gfxProjectPage.glbUrl && !gfxModelAsMain(gfxProjectPage) && (
                  <div style={{ marginBottom: 16 }}>
                    <GfxModelViewer key={gfxViewSettingsKey(gfxProjectPage.glbViewSettings)} url={gfxProjectPage.glbUrl} settings={gfxProjectPage.glbViewSettings} height={280} style={{ width: '100%' }} allowUserControl />
                  </div>
                )}

                <GfxProjectDownloads
                  item={gfxProjectPage}
                  lang={lang as LangKey}
                  theme={theme}
                  projectTitle={projectTitle}
                  waPhone={waPhone}
                  contactEmail={contactEmail}
                />

                {/* Request similar design button */}
                <button onClick={() => setGfxRequestOpen(o => !o)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '11px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #003366 0%, #1a4d99 100%)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: 'inherit', boxShadow: '0 4px 18px rgba(0,51,102,0.28)', transition: 'opacity 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')} onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  <i className="fa-solid fa-paintbrush" />
                  {t.requestSimilarDesign}
                  <i className={`fa-solid fa-chevron-${gfxRequestOpen ? 'up' : 'down'}`} style={{ fontSize: 11 }} />
                </button>

                {/* Inline request panel */}
                {gfxRequestOpen && (
                  <div style={{ marginTop: 14, padding: '18px 20px', background: theme === 'dark' ? 'rgba(68,136,255,0.08)' : '#f0f5ff', borderRadius: 14, border: `1px solid ${theme === 'dark' ? 'rgba(68,136,255,0.22)' : '#c8d8f0'}` }}>
                    <p style={{ margin: '0 0 14px', fontWeight: 600, color: theme === 'dark' ? '#a8c8f0' : '#003366', fontSize: 14 }}>
                      {lang === 'ar' ? `طلب تصميم مشابه لـ: "${projectTitle}"` : lang === 'de' ? `Ähnliches Design anfragen für: "${projectTitle}"` : `Request a design similar to: "${projectTitle}"`}
                    </p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {waPhone && (
                        <a href={`https://api.whatsapp.com/send?phone=${waPhone}&text=${waMsg}`} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: '#25d366', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                          <i className="fa-brands fa-whatsapp" style={{ fontSize: 18 }} />WhatsApp
                        </a>
                      )}
                      {contactEmail && (
                        <a href={`mailto:${contactEmail}?subject=${emailSubj}&body=${emailBody}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: '#003366', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                          <i className="fa-solid fa-envelope" style={{ fontSize: 15 }} />{lang === 'ar' ? 'إيميل' : lang === 'de' ? 'E-Mail' : 'Email'}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Image zoom lightbox */}
              {gfxZoom && isImageSlide && current && createPortal(
                <div onClick={() => setGfxZoom(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
                  <button onClick={(e) => { e.stopPropagation(); setGfxZoom(false); }}
                    title={lang === 'ar' ? 'إغلاق' : lang === 'de' ? 'Schließen' : 'Close'}
                    style={{ position: 'absolute', top: 18, insetInlineEnd: 18, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '50%', width: 48, height: 48, color: '#fff', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-xmark" />
                  </button>
                  {totalSlides > 1 && (<>
                    <button onClick={(e) => { e.stopPropagation(); prevImg(); }}
                      style={{ position: 'absolute', top: '50%', insetInlineStart: 18, transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '50%', width: 48, height: 48, color: '#fff', cursor: gfxCarouselIdx > 0 ? 'pointer' : 'not-allowed', opacity: gfxCarouselIdx > 0 ? 1 : 0.35, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={`fa-solid ${isRtl ? 'fa-chevron-right' : 'fa-chevron-left'}`} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); nextImg(); }}
                      style={{ position: 'absolute', top: '50%', insetInlineEnd: 18, transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '50%', width: 48, height: 48, color: '#fff', cursor: gfxCarouselIdx < totalSlides - 1 ? 'pointer' : 'not-allowed', opacity: gfxCarouselIdx < totalSlides - 1 ? 1 : 0.35, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className={`fa-solid ${isRtl ? 'fa-chevron-left' : 'fa-chevron-right'}`} />
                    </button>
                  </>)}
                  {current.isVideo ? (
                    <GfxMediaSlide
                      url={current.url}
                      isVideo
                      alt={projectTitle}
                      onClick={(e) => e.stopPropagation()}
                      style={{ maxWidth: '96vw', maxHeight: '92vh', borderRadius: 8, boxShadow: '0 10px 60px rgba(0,0,0,0.6)', cursor: 'default' }}
                    />
                  ) : (
                    <img src={resolveImageSrc(current.url)} alt={projectTitle} onClick={(e) => e.stopPropagation()}
                      style={{ maxWidth: '96vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 10px 60px rgba(0,0,0,0.6)', cursor: 'default' }} />
                  )}
                </div>,
                document.body,
              )}
            </div>
          );
        }

        // ── Gallery Grid ────────────────────────────────────
        return (
          <div className="content-wrap fade-up">
            <div className="section-head">
              <h2 className="section-title">{t.graphicsTitle}</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {cvDocVisibleAt(data, 'dev', 'designPortal') && data.cvDocs.find(d => d.id === 'dev') && (
                  <button
                    className="btn-pill"
                    onClick={() => requestVisitorCv(data.cvDocs.find(d => d.id === 'dev')!)}
                    title={lang === 'ar' ? 'تنزيل سيرة التصاميم PDF' : lang === 'de' ? 'Design-CV als PDF' : 'Download Design CV PDF'}
                  >
                    <i className="fa-solid fa-file-pdf" style={{ color: '#003366' }} />
                    {lang === 'ar' ? 'سيرة التصاميم' : lang === 'de' ? 'Design-CV' : 'Design CV'}
                    <i className="fa-solid fa-arrow-down" />
                  </button>
                )}
                <button className="btn-back mobile-hidden" onClick={goHome}>
                  {t.backHome} <i className={`fa-solid ${isRtl ? "fa-arrow-right" : "fa-arrow-left"}`} />
                </button>
              </div>
            </div>

            {/* Visitor browse mode toggle — default from admin settings */}
            <div style={{ display: 'flex', justifyContent: isRtl ? 'flex-start' : 'flex-end', marginBottom: 14 }}>
              <div style={{ display: 'inline-flex', border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.14)' : '#cde'}`, borderRadius: 10, overflow: 'hidden' }}>
                <button type="button" onClick={() => { setGfxBrowseView('all'); setGfxSelSubId(''); }}
                  title={lang === 'ar' ? 'عرض كل التصنيفات والفروع' : lang === 'de' ? 'Alle Kategorien anzeigen' : 'Show all categories'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', padding: '7px 14px', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: browseMode === 'all' ? 'var(--navy)' : 'transparent', color: browseMode === 'all' ? '#fff' : (theme === 'dark' ? '#cdd9ec' : '#003366') }}>
                  <i className="fa-solid fa-table-cells-large" />
                  {lang === 'ar' ? 'عرض الكل' : lang === 'de' ? 'Alle' : 'Show all'}
                </button>
                <button type="button" onClick={() => { setGfxBrowseView('byCategory'); setGfxSelSubId(''); }}
                  title={lang === 'ar' ? 'اختيار تصنيف ثم فرع' : lang === 'de' ? 'Nach Kategorie filtern' : 'Browse by category'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', padding: '7px 14px', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: browseMode === 'byCategory' ? 'var(--navy)' : 'transparent', color: browseMode === 'byCategory' ? '#fff' : (theme === 'dark' ? '#cdd9ec' : '#003366') }}>
                  <i className="fa-solid fa-filter" />
                  {lang === 'ar' ? 'حسب التصنيف' : lang === 'de' ? 'Kategorie' : 'By category'}
                </button>
              </div>
            </div>

            {/* Category dropdown — byCategory mode (web + mobile) */}
            {browseMode === 'byCategory' && (
              <AppPicker
                className="gfx-cat-picker"
                value={selCat?.id || (gfxCats[0]?.id || '')}
                aria-label={lang === 'ar' ? 'تصنيف التصاميم' : 'Design category'}
                options={gfxCats.map(cat => ({
                  value: cat.id,
                  label: pickML(cat.name, lang as LangKey),
                }))}
                onChange={val => {
                  setGfxSelCatId(val);
                  setGfxSelSubId('');
                  setGfxSearch('');
                  setGfxTab(0);
                }}
              />
            )}

            <>
                {/* Search bar */}
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRtl ? 'right' : 'left']: 13, color: theme === 'dark' ? '#7a9cc8' : '#8899bb', fontSize: 14, pointerEvents: 'none' }} />
                  <input type="text" value={gfxSearch} onChange={e => setGfxSearch(e.target.value)} placeholder={t.gfxSearch}
                    style={{ width: '100%', padding: isRtl ? '10px 42px 10px 14px' : '10px 14px 10px 42px', borderRadius: 10, border: `1.5px solid ${theme === 'dark' ? 'rgba(255,255,255,0.14)' : '#cdd8ee'}`, background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#f6f9ff', color: theme === 'dark' ? '#dfe9f8' : '#003366', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  {gfxSearch && <button onClick={() => setGfxSearch('')} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRtl ? 'left' : 'right']: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 14 }}><i className="fa-solid fa-xmark" /></button>}
                </div>

                {/* Branch dropdown — byCategory mode only */}
                {browseMode === 'byCategory' && selCat && selCat.subCategories.length > 0 && (
                  <AppPicker
                    className="gfx-sub-picker"
                    value={gfxSelSubId}
                    aria-label={lang === 'ar' ? 'فرع التصنيف' : 'Design branch'}
                    options={[
                      { value: '', label: `${allLabel} (${totalInCat})` },
                      ...selCat.subCategories.map(sub => ({
                        value: sub.id,
                        label: `${pickML(sub.name, lang as LangKey)} (${sub.items.length})`,
                      })),
                    ]}
                    onChange={val => setGfxSelSubId(val)}
                  />
                )}

                {browseMode === 'all' ? (
                  (() => {
                    const searching = !!gfxSearch.trim();
                    const sections = gfxCats.map(cat => {
                      const catTotal = cat.subCategories.reduce((n, s) => n + s.items.length, 0);
                      const subs = cat.subCategories.map(sub => ({
                        sub,
                        items: sub.items.filter(itemMatchesSearch),
                      })).filter(({ items }) => !searching || items.length > 0);
                      if (searching && subs.length === 0) return null;
                      return (
                        <div key={cat.id} className="gfx-cat-section">
                          <div className="gfx-cat-divider">
                            <i className={`fa-solid ${cat.icon || 'fa-folder'}`} />
                            {pickML(cat.name, lang as LangKey)} · {catTotal}
                          </div>
                          {subs.map(({ sub, items }) => (
                            <div key={sub.id} className="gfx-sub-section">
                              {renderSubDivider(pickML(sub.name, lang as LangKey), sub.items.length)}
                              {renderSubGrid(items)}
                            </div>
                          ))}
                        </div>
                      );
                    }).filter(Boolean);
                    if (!sections.length) return renderEmptyGallery(searching);
                    return sections;
                  })()
                ) : showAllGrouped ? (
                  selCat!.subCategories.length > 0 ? selCat!.subCategories.map(sub => {
                    const items = sub.items.filter(itemMatchesSearch);
                    return (
                      <div key={sub.id} className="gfx-sub-section">
                        {renderSubDivider(pickML(sub.name, lang as LangKey), sub.items.length)}
                        {renderSubGrid(items)}
                      </div>
                    );
                  }) : renderEmptyGallery(false)
                ) : (
                  <div className="gfx-dyn-grid" style={gridStyle}>
                    {searchedItems.length === 0
                      ? renderEmptyGallery(!!gfxSearch.trim())
                      : searchedItems.map(renderCard)}
                  </div>
                )}
            </>
          </div>
        );
      })()}

      {/* ── Software Portal ─────────────────────────────────── */}
      {portal === "software" && !webProjectPage && (
        <div className="content-wrap fade-up">
          <div className="section-head">
            <h2 className="section-title">{t.softwareTitle}</h2>
            <button className="btn-back mobile-hidden" onClick={goHome}>
              {t.backHome}{" "}
              <i className={`fa-solid ${isRtl ? "fa-arrow-right" : "fa-arrow-left"}`} />
            </button>
          </div>

          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 30, flexWrap: 'wrap' }}>
            <button
              className={`lab-cat-chip${softSubTab === 'projects' ? ' active' : ''}`}
              onClick={() => setSoftSubTab('projects')}
            >
              <i className="fa-solid fa-globe" style={{ marginInlineEnd: 7 }} />
              {t.webProjectsTab}
            </button>
            <button
              className={`lab-cat-chip${softSubTab === 'labs' ? ' active' : ''}`}
              onClick={() => setSoftSubTab('labs')}
            >
              <i className="fa-solid fa-flask" style={{ marginInlineEnd: 7 }} />
              {t.codeLabsTab}
            </button>
          </div>

          {/* ── Projects Sub-Tab ── */}
          {softSubTab === 'projects' && (
            <>
              {data.webProjects.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#888', padding: '60px 0' }}>
                  <i className="fa-solid fa-code" style={{ fontSize: 52, marginBottom: 16, opacity: 0.25, display: 'block' }} />
                  <p style={{ fontSize: 15 }}>{t.noWebProjects}</p>
                </div>
              ) : (
                (() => {
                  const wg = { ...DEFAULT_WEB_GRID, ...(data.webGridSettings || {}) };
                  return (
                    <div className="web-proj-grid" style={webGridStyleResponsive(wg, isMobileView)}>
                      {data.webProjects.map(proj => {
                        const tc = proj.textColor || '';
                        return (
                          <div
                            key={proj.id}
                            className="glass"
                            style={{ borderRadius: 18, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.22s, box-shadow 0.22s', boxShadow: '0 4px 18px rgba(0,51,102,0.1)' }}
                            onClick={() => { setWebProjectPage(proj); setWebProjCarouselIdx(0); }}
                            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-5px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px rgba(0,51,102,0.22)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 18px rgba(0,51,102,0.1)'; }}
                          >
                            {proj.mainImg ? (
                              <img src={resolveImageSrc(proj.mainImg)} alt={pickML(proj.title, lang as LangKey)} className="card-thumb-img" style={{ objectFit: 'cover' }} />
                            ) : (
                              <div className="card-thumb-placeholder" style={{ background: 'linear-gradient(135deg,#003366 0%,#1a5276 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <i className="fa-solid fa-globe" style={{ fontSize: 42, color: 'rgba(255,255,255,0.25)' }} />
                              </div>
                            )}
                            <div style={{ padding: '14px 16px' }}>
                              <div className="wpg-card-title" style={{ color: tc || 'var(--navy)', marginBottom: 6 }}>{pickML(proj.title, lang as LangKey)}</div>
                              <div className="wpg-card-desc" style={{ color: tc ? `${tc}cc` : '#888', marginBottom: 10, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{pickML(proj.desc, lang as LangKey)}</div>
                              {proj.tags.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                                  {proj.tags.slice(0, 4).map((tag, ti) => (
                                    <span key={ti} className="wpg-card-tag" style={{ background: tc ? `${tc}22` : 'rgba(0,51,102,0.09)', color: tc || '#003366', borderRadius: 20, padding: '2px 8px', fontWeight: 700, border: tc ? `1px solid ${tc}44` : 'none' }}>{tag}</span>
                                  ))}
                                </div>
                              )}
                              {/* Store/visit quick links */}
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                {proj.liveUrl && (
                                  <span style={{ fontSize: 10, background: '#003366', color: '#fff', borderRadius: 20, padding: '3px 10px', fontWeight: 700 }}><i className="fa-solid fa-globe" style={{ marginInlineEnd: 4 }} />{lang === 'ar' ? 'زيارة' : 'Visit'}</span>
                                )}
                                {proj.googlePlayUrl && (
                                  <span style={{ fontSize: 10, background: '#01875f', color: '#fff', borderRadius: 20, padding: '3px 10px', fontWeight: 700 }}><i className="fa-brands fa-google-play" style={{ marginInlineEnd: 4 }} />Play</span>
                                )}
                                {proj.appleStoreUrl && (
                                  <span style={{ fontSize: 10, background: '#555', color: '#fff', borderRadius: 20, padding: '3px 10px', fontWeight: 700 }}><i className="fa-brands fa-apple" style={{ marginInlineEnd: 4 }} />App Store</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}

              {/* Request Form */}
              <div style={{ marginTop: 52, padding: '32px 28px', background: 'rgba(0,51,102,0.04)', borderRadius: 20, border: '1px solid rgba(0,51,102,0.1)' }}>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <i className="fa-solid fa-paper-plane" /> {t.requestProject}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
                  <div className="form-group">
                    <label>{t.requestName}</label>
                    <input type="text" value={reqName} onChange={e => setReqName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>{t.requestPhone}</label>
                    <input type="tel" value={reqPhone} onChange={e => setReqPhone(e.target.value)} dir="ltr" />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label>{t.requestProjectDesc}</label>
                  <textarea rows={4} value={reqDesc} onChange={e => setReqDesc(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => sendSoftwareRequest('whatsapp')}
                    style={{ background: '#25d366', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <i className="fa-brands fa-whatsapp" style={{ fontSize: 18 }} /> {t.sendWhatsApp}
                  </button>
                  <button
                    onClick={() => sendSoftwareRequest('email')}
                    style={{ background: '#003366', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <i className="fa-solid fa-envelope" style={{ fontSize: 16 }} /> {t.sendEmail}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── Code Labs Sub-Tab ── */}
          {softSubTab === 'labs' && (
            <>
              <div className="lab-cats">
                <button className={`lab-cat-chip${activeCat === null ? ' active' : ''}`} onClick={() => setActiveCat(null)}>
                  {lang === 'ar' ? 'الكل' : lang === 'de' ? 'Alle' : 'All'}
                </button>
                {labCategories.map(cat => (
                  <button key={cat} className={`lab-cat-chip${activeCat === cat ? ' active' : ''}`} onClick={() => setActiveCat(cat)}>
                    {cat}
                  </button>
                ))}
              </div>
              <div className="lab-grid">
                {filteredSnippets.map((s, i) => {
                  const realIdx = data.softwareSnippets.indexOf(s);
                  return (
                    <div key={i} className={`lab-card glass${selectedSnippetIdx === realIdx ? ' selected' : ''}`} onClick={() => openSnippetEditor(realIdx)}>
                      <div className="lab-thumb">
                        <iframe title={`thumb-${realIdx}`} srcDoc={buildThumbSrc(s.codeHtml, s.codeCss)} sandbox="allow-scripts allow-same-origin" scrolling="no" loading="eager" />
                      </div>
                      <div className="lab-card-body">
                        {s.category && <span className="lab-cat-badge">{s.category}</span>}
                        <div className="lab-card-title">{s.title}</div>
                        <div className="lab-card-desc">{s.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Web Project Full-Page View ────────────────────────── */}
      {portal === "software" && webProjectPage && (
        <div className="content-wrap fade-up">
          <div className="section-head">
            <h2 className="section-title">{pickML(webProjectPage.title, lang as LangKey)}</h2>
            <button className="btn-back" onClick={() => setWebProjectPage(null)}>
              {t.backToLab}{" "}
              <i className={`fa-solid ${isRtl ? "fa-arrow-right" : "fa-arrow-left"}`} />
            </button>
          </div>

          {/* ── MEDIA: Main image + carousel + video at the top ── */}
          {webProjectPage.mainImg && webProjectPage.images.length === 0 && (
            <img src={resolveImageSrc(webProjectPage.mainImg)} alt={pickML(webProjectPage.title, lang as LangKey)} style={{ width: '100%', maxHeight: 440, objectFit: 'cover', borderRadius: 18, marginBottom: 20, display: 'block' }} />
          )}

          {webProjectPage.images.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              {/* Thumbnails row */}
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 10 }}>
                {webProjectPage.mainImg && (
                  <img src={resolveImageSrc(webProjectPage.mainImg)} alt="main" style={{ height: 72, width: 108, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', flexShrink: 0, border: webProjCarouselIdx === -1 ? '3px solid #003366' : '3px solid transparent', transition: 'border 0.2s' }}
                    onClick={() => setWebProjCarouselIdx(-1)} />
                )}
                {webProjectPage.images.map((img, i) => (
                  <img key={i} src={resolveImageSrc(img)} alt="" style={{ height: 72, width: 108, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', flexShrink: 0, border: webProjCarouselIdx === i ? '3px solid #003366' : '3px solid transparent', transition: 'border 0.2s' }}
                    onClick={() => setWebProjCarouselIdx(i)} />
                ))}
              </div>
              {/* Main large image */}
              {(() => {
                const src = webProjCarouselIdx === -1 ? webProjectPage.mainImg : webProjectPage.images[webProjCarouselIdx];
                return src ? <img src={resolveImageSrc(src)} alt="" style={{ width: '100%', maxHeight: 500, objectFit: 'contain', borderRadius: 16, marginTop: 6, background: 'rgba(0,0,0,0.04)', display: 'block' }} /> : null;
              })()}
            </div>
          )}

          {webProjectPage.videoUrl && (
            <div style={{ marginBottom: 20, borderRadius: 14, overflow: 'hidden', aspectRatio: '16/9' }}>
              <iframe src={resolveVideoEmbedSrc(webProjectPage.videoUrl) || webProjectPage.videoUrl} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen title="project-video" />
            </div>
          )}

          {/* ── ACTION BUTTONS: Visit / Play Store / App Store / GitHub ── */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
            {webProjectPage.liveUrl && (
              <a href={webProjectPage.liveUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#003366', color: '#fff', borderRadius: 14, padding: '13px 26px', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>
                <i className="fa-solid fa-arrow-up-right-from-square" /> {t.visitWebsite}
              </a>
            )}
            {webProjectPage.googlePlayUrl && (
              <a href={webProjectPage.googlePlayUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#01875f', color: '#fff', borderRadius: 14, padding: '13px 26px', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>
                <i className="fa-brands fa-google-play" /> {lang === 'ar' ? 'Google Play' : 'Google Play'}
              </a>
            )}
            {webProjectPage.appleStoreUrl && (
              <a href={webProjectPage.appleStoreUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#1c1c1e', color: '#fff', borderRadius: 14, padding: '13px 26px', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>
                <i className="fa-brands fa-apple" /> {lang === 'ar' ? 'App Store' : 'App Store'}
              </a>
            )}
            {webProjectPage.githubUrl && webProjectPage.githubVisible !== false && (
              <a href={webProjectPage.githubUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#1a1a2e', color: '#fff', borderRadius: 14, padding: '13px 26px', fontWeight: 800, fontSize: 15, textDecoration: 'none', border: '2px solid #444' }}>
                <i className="fa-brands fa-github" /> {t.viewOnGithub}
              </a>
            )}
          </div>

          {/* ── Tags ── */}
          {webProjectPage.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {webProjectPage.tags.map((tag, i) => (
                <span key={i} style={{ background: 'rgba(0,51,102,0.1)', color: '#003366', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>{tag}</span>
              ))}
            </div>
          )}

          {/* ── Description ── */}
          <p style={{ fontSize: 15, lineHeight: 1.85, color: theme === 'dark' ? '#ccd6f6' : '#444', marginBottom: 28 }}>
            {pickML(webProjectPage.desc, lang as LangKey)}
          </p>
        </div>
      )}

      {/* ── Code Lab Playground (full-page) ─────────────────── */}
      {portal === "software" && selectedSnippetIdx !== null && playgroundMode && (
        <div style={{ position: 'fixed', inset: 0, background: '#0d0d1a', zIndex: 9000, display: 'flex', flexDirection: 'column' }}>
          {/* Playground Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', background: '#111', borderBottom: '1px solid #222', flexShrink: 0, flexWrap: 'wrap' }}>
            <button onClick={() => { setPlaygroundMode(false); setSelectedSnippetIdx(null); }}
              style={{ background: '#c00', border: 'none', borderRadius: 8, padding: '6px 14px', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
              <i className="fa-solid fa-xmark" /> {lang === 'ar' ? 'إغلاق' : 'Close'}
            </button>
            <span style={{ color: '#4488ff', fontWeight: 700, fontSize: 15 }}>
              <i className="fa-solid fa-code" style={{ marginInlineEnd: 8 }} />
              {data.softwareSnippets[selectedSnippetIdx]?.title}
            </span>
            {data.softwareSnippets[selectedSnippetIdx]?.desc && (
              <span style={{ fontSize: 12, color: '#888', fontStyle: 'italic' }}>{data.softwareSnippets[selectedSnippetIdx]?.desc}</span>
            )}
            <div style={{ marginInlineStart: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn-copy" onClick={() => navigator.clipboard.writeText(snippetHtml)}><i className="fa-brands fa-html5" /> HTML</button>
              <button className="btn-copy" onClick={() => navigator.clipboard.writeText(snippetCss)}><i className="fa-brands fa-css3-alt" /> CSS</button>
              {snippetJs && <button className="btn-copy" onClick={() => navigator.clipboard.writeText(snippetJs)}><i className="fa-brands fa-js" /> JS</button>}
            </div>
          </div>

          {/* Playground Body: editor (left) + preview (right) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, overflow: 'hidden' }}>
            {/* Left: Tabbed code editor */}
            <div style={{ display: 'flex', flexDirection: 'column', borderInlineEnd: '2px solid #222', overflow: 'hidden' }}>
              {/* Tab bar */}
              <div style={{ display: 'flex', background: '#181818', borderBottom: '1px solid #222', flexShrink: 0 }}>
                {(['html', 'css', 'js'] as const).map(tab => (
                  <button key={tab} onClick={() => setSnippetLangTab(tab)}
                    style={{ padding: '8px 18px', background: snippetLangTab === tab ? '#111' : 'transparent', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12,
                      color: tab === 'html' ? '#e34f26' : tab === 'css' ? '#1572b6' : '#f7df1e',
                      borderBottom: snippetLangTab === tab ? '2px solid currentColor' : '2px solid transparent' }}>
                    <i className={`fa-brands fa-${tab === 'js' ? 'js' : tab === 'html' ? 'html5' : 'css3-alt'}`} style={{ marginInlineEnd: 5 }} />
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>
              {/* Editor */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                {snippetLangTab === 'html' && (
                  <textarea className="code-editor" value={snippetHtml} onChange={e => setSnippetHtml(e.target.value)} spellCheck={false} dir="ltr" placeholder="<!-- HTML -->" style={{ flex: 1, borderRadius: 0, background: '#111', color: '#e0e0ff', resize: 'none' }} />
                )}
                {snippetLangTab === 'css' && (
                  <textarea className="code-editor" value={snippetCss} onChange={e => setSnippetCss(e.target.value)} spellCheck={false} dir="ltr" placeholder="/* CSS */" style={{ flex: 1, borderRadius: 0, background: '#111', color: '#b3e0ff', resize: 'none' }} />
                )}
                {snippetLangTab === 'js' && (
                  <textarea className="code-editor" value={snippetJs} onChange={e => setSnippetJs(e.target.value)} spellCheck={false} dir="ltr" placeholder="// JavaScript" style={{ flex: 1, borderRadius: 0, background: '#111', color: '#ffe082', resize: 'none' }} />
                )}
              </div>
            </div>

            {/* Right: Live preview */}
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="lab-preview-topbar" style={{ background: '#181818', flexShrink: 0 }}>
                <span>
                  <i className="fa-solid fa-circle" style={{ color: '#ff5f57', fontSize: 10 }} />{' '}
                  <i className="fa-solid fa-circle" style={{ color: '#febc2e', fontSize: 10 }} />{' '}
                  <i className="fa-solid fa-circle" style={{ color: '#28c840', fontSize: 10 }} />
                </span>
                <span style={{ fontSize: 12, color: '#aaa', fontWeight: 700 }}>
                  {lang === 'ar' ? 'معاينة مباشرة' : lang === 'de' ? 'Live-Vorschau' : 'Live Preview'}
                </span>
              </div>
              <iframe ref={previewFrame} className="lab-preview-iframe" title="live-preview" sandbox="allow-scripts allow-same-origin" style={{ flex: 1, border: 'none' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── CV Engine ────────────────────────────────── */}
      {portal === "cv" && (
        <div className="content-wrap fade-up" style={{ maxWidth: "1300px" }}>
          <div className="section-head">
            <h2 className="section-title">{t.cvTitle}</h2>
            <button className="btn-back mobile-hidden" onClick={goHome}>
              {t.cvCloseBtn}{" "}
              <i
                className={`fa-solid ${isRtl ? "fa-arrow-right" : "fa-arrow-left"}`}
              />
            </button>
          </div>

          {(() => {
            const visibleDocs = visitorCvDocsAt(data, 'cvPage');
            const selectedDoc =
              visibleDocs.find((d) => d.id === cvDocId) ?? visibleDocs[0];
            if (!visibleDocs.length) {
              return (
                <p style={{ textAlign: "center", color: "#888", padding: "40px 20px" }}>
                  {lang === "ar"
                    ? "لا توجد سيرة ذاتية متاحة حالياً — فعّل الظهور من محرر السيرة في لوحة التحكم"
                    : lang === "de"
                      ? "Kein Lebenslauf verfügbar"
                      : "No CV available — enable visibility in admin CV editor"}
                </p>
              );
            }
            return (
              <div className="cv-layout">
                <div className="cv-panel glass">
                  <h3>{t.cvSmartSettings}</h3>

                  {visibleDocs.length > 1 && (
                    <div className="form-group">
                      <label>{t.cvTypeLabel}</label>
                      <div className="cvx-docbar" style={{ marginTop: 8 }}>
                        {visibleDocs.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            className={`cvx-doc-btn${d.id === selectedDoc.id ? " active" : ""}`}
                            style={d.id === selectedDoc.id ? { borderColor: d.accent, color: d.accent } : undefined}
                            onClick={() => setCvDocId(d.id)}
                          >
                            <i className={`fa-solid ${d.icon}`} style={{ color: CV_BTN_ICON_COLOR }} />
                            <span>{cvDocLabel(d, cvLang)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 8 }}>
                      {lang === 'ar' ? 'لغة التحميل: حسب لغة المتصفح' : lang === 'de' ? 'Download-Sprache: Browsersprache' : 'Download language: browser language'}
                    </label>
                  </div>
                  <button
                    className="btn-prime"
                    disabled={printingCv}
                    onClick={() => requestVisitorCv(selectedDoc)}
                  >
                    <i className="fa-solid fa-print" /> {printingCv ? "…" : t.cvExportBtn}
                  </button>
                </div>

                <div className="cv-scroll-wrap">
                  <div
                    ref={cvPortalPreviewRef}
                    className="cv-preview-stack"
                    style={{ width: CV_EXPORT_PX }}
                  >
                    <CvRenderer
                      doc={selectedDoc}
                      lang={cvLang}
                      name={pickML(data.name, cvLang)}
                      skills={data.skills}
                    />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Admin Dashboard ──────────────────────────── */}
      {portal === "admin" && adminLoggedIn && (
        <div className="content-wrap fade-up" style={{ maxWidth: "1400px" }}>
          <div className="section-head">
            <h2 className="section-title">{t.adminDashTitle}</h2>
            <button
              className="btn-back"
              style={{ background: "#c00" }}
              onClick={() => {
                setAdminLoggedIn(false);
                goHome();
              }}
            >
              {t.adminLogout} <i className="fa-solid fa-right-from-bracket" />
            </button>
          </div>

          <div className="admin-layout">
            <aside className="glass admin-sidebar">
              {[
                [t.adminBioPanel, 'fa-id-card'],
                [t.adminSkillsPanel, 'fa-chart-bar'],
                [t.adminCvPanel, 'fa-file-lines'],
                [lang === 'ar' ? 'محتوى الزراعة' : lang === 'de' ? 'Landwirtschaft' : 'Agriculture', 'fa-seedling'],
                [lang === 'ar' ? 'معرض التصاميم' : lang === 'de' ? 'Design-Galerie' : 'Design Gallery', 'fa-bezier-curve'],
                [lang === 'ar' ? 'المشاريع البرمجية' : lang === 'de' ? 'Web-Entwicklung' : 'Web Dev', 'fa-code'],
                [t.adminInjectPanel, 'fa-file-code'],
                [lang === 'ar' ? 'إعدادات الموقع' : lang === 'de' ? 'Website-Einstellungen' : 'Site Settings', 'fa-globe'],
                [lang === 'ar' ? 'إدارة الملفات' : lang === 'de' ? 'Dateiverwaltung' : 'File Manager', 'fa-folder-open'],
                [lang === 'ar' ? 'إحصائيات الزوار' : lang === 'de' ? 'Besucherstatistik' : 'Visitor Analytics', 'fa-chart-line'],
              ].map(([label, icon], i) => (
                <button
                  key={i}
                  className={`admin-panel-btn${adminPanel === i ? " active" : ""}`}
                  onClick={() => setAdminPanel(i)}
                >
                  <i className={`fa-solid ${icon}`} style={{ marginInlineEnd: 7, opacity: 0.8 }} />
                  {label}
                </button>
              ))}
            </aside>

            <main className="glass admin-main">
              {adminPanel === 0 && (
                <>
                  <h4>{t.adminBioPanel}</h4>
                  <div className="form-group">
                    <label>{t.adminNameLabel}</label>
                    <MLInput
                      value={editName}
                      lang={cvLang}
                      onChange={setEditName}
                      placeholder={t.adminNameLabel}
                      aiHint="full name on homepage"
                    />
                  </div>

                  {/* ── طريقة عرض الاسم ── */}
                  <div className="form-group">
                    <label>{lang === 'ar' ? 'طريقة عرض الاسم في الواجهة' : lang === 'de' ? 'Namensdarstellung' : 'Name display style'}</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      {([
                        ['text', lang === 'ar' ? 'نص عادي' : lang === 'de' ? 'Normaler Text' : 'Plain text', 'fa-font'],
                        ['handwriting', lang === 'ar' ? 'خط يد' : lang === 'de' ? 'Handschrift' : 'Handwriting', 'fa-signature'],
                        ['logo', lang === 'ar' ? 'شعار (صورة)' : lang === 'de' ? 'Logo (Bild)' : 'Logo (image)', 'fa-image'],
                      ] as [NameDisplayMode, string, string][]).map(([val, label, icon]) => {
                        const on = editNameDisplay === val;
                        return (
                          <button key={val} type="button" onClick={() => setEditNameDisplay(val)}
                            style={{ padding: '8px 14px', borderRadius: 10, border: `1.5px solid ${on ? '#0af' : 'rgba(255,255,255,0.2)'}`, background: on ? 'rgba(0,170,255,0.18)' : 'rgba(255,255,255,0.05)', color: on ? '#0af' : '#ccc', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                            <i className={`fa-solid ${icon}`} style={{ marginInlineEnd: 6 }} />{label}
                          </button>
                        );
                      })}
                    </div>

                    {editNameDisplay === 'logo' && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                          {editNameLogo ? (
                            <HeroNameDisplay
                              name={pickML(editName, cvLang) || pickML(data.name, cvLang)}
                              display="logo"
                              logo={editNameLogo}
                              logoColor={editNameLogoColor}
                              shimmer={editNameShimmer}
                              shimmerSpeed={editNameShimmerSpeed}
                              shimmerColor={editNameShimmerColor}
                              shimmerAngle={editNameShimmerAngle}
                              shimmerMotion={editNameShimmerMotion}
                              shimmerDirection={editNameShimmerDirection}
                              shimmerWidth={editNameShimmerWidth}
                              className="hero-name"
                              as="div"
                            />
                          ) : (
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                              {lang === 'ar' ? 'ارفع الشعار (SVG أو PNG شفاف)' : 'Upload logo (SVG or transparent PNG)'}
                            </span>
                          )}
                          <input ref={nameLogoRef} type="file" accept="image/svg+xml,image/png,image/webp,image/*" style={{ display: 'none' }}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              try {
                                const dataUrl = await readLogoFile(file);
                                setEditNameLogo(dataUrl);
                              } catch {
                                alert(lang === 'ar' ? 'تعذّر قراءة ملف الشعار' : 'Could not read logo file');
                              }
                              e.target.value = '';
                            }} />
                          <button type="button" className="btn-outline-sm" onClick={() => nameLogoRef.current?.click()}>
                            <i className="fa-solid fa-upload" /> {lang === 'ar' ? 'رفع الشعار' : 'Upload logo'}
                          </button>
                          {editNameLogo && (
                            <button type="button" className="btn-cancel" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setEditNameLogo('')}>
                              {lang === 'ar' ? 'حذف' : 'Remove'}
                            </button>
                          )}
                        </div>

                        {/* ── لون الشعار ── */}
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                            {lang === 'ar' ? 'لون الشعار' : lang === 'de' ? 'Logo-Farbe' : 'Logo color'}
                          </label>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            {([
                              ['#ffffff', lang === 'ar' ? 'أبيض' : 'White'],
                              ['#a0c4ff', lang === 'ar' ? 'أزرق فاتح' : 'Light blue'],
                              ['#0af', lang === 'ar' ? 'أزرق سماوي' : 'Cyan'],
                              ['#003366', lang === 'ar' ? 'كحلي' : 'Navy'],
                            ] as [string, string][]).map(([hex, lbl]) => (
                              <button key={hex} type="button" onClick={() => setEditNameLogoColor(hex)}
                                style={{
                                  padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                  border: `2px solid ${editNameLogoColor === hex ? '#0af' : 'rgba(255,255,255,0.2)'}`,
                                  background: editNameLogoColor === hex ? 'rgba(0,170,255,0.15)' : 'rgba(255,255,255,0.05)',
                                  color: hex === '#ffffff' ? '#fff' : hex,
                                }}>
                                <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: hex, marginInlineEnd: 6, border: '1px solid rgba(255,255,255,0.3)', verticalAlign: 'middle' }} />
                                {lbl}
                              </button>
                            ))}
                            <input type="color" value={editNameLogoColor} onChange={(e) => setEditNameLogoColor(e.target.value)}
                              style={{ width: 40, height: 32, border: 'none', background: 'transparent', cursor: 'pointer' }} title={lang === 'ar' ? 'لون مخصص' : 'Custom color'} />
                            <input type="text" value={editNameLogoColor} onChange={(e) => setEditNameLogoColor(e.target.value)}
                              style={{ width: 88, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: 12, direction: 'ltr' }} />
                          </div>
                        </div>
                      </div>
                    )}

                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: editNameShimmer ? 10 : 0 }}>
                      <input type="checkbox" checked={editNameShimmer} onChange={(e) => setEditNameShimmer(e.target.checked)} />
                      {lang === 'ar' ? 'تفعيل CC Light Sweep (شعاع الإضاءة)' : lang === 'de' ? 'CC Light Sweep aktivieren' : 'Enable CC Light Sweep'}
                    </label>

                    {editNameShimmer && (
                      <>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                          {lang === 'ar' ? 'لون إضاءة CC Light Sweep' : lang === 'de' ? 'CC Light Sweep Farbe' : 'CC Light Sweep color'}
                        </label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          {([
                            ['#00ccff', lang === 'ar' ? 'سماوي' : 'Cyan'],
                            ['#ffd700', lang === 'ar' ? 'ذهبي' : 'Gold'],
                            ['#ffffff', lang === 'ar' ? 'أبيض' : 'White'],
                            ['#ff66cc', lang === 'ar' ? 'وردي' : 'Pink'],
                            ['#00ff88', lang === 'ar' ? 'أخضر' : 'Green'],
                          ] as [string, string][]).map(([hex, lbl]) => (
                            <button key={hex} type="button" onClick={() => setEditNameShimmerColor(hex)}
                              style={{
                                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                border: `2px solid ${editNameShimmerColor === hex ? '#0af' : 'rgba(255,255,255,0.2)'}`,
                                background: editNameShimmerColor === hex ? 'rgba(0,170,255,0.15)' : 'rgba(255,255,255,0.05)',
                                color: hex === '#ffffff' ? '#fff' : hex,
                              }}>
                              <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: hex, marginInlineEnd: 6, border: '1px solid rgba(255,255,255,0.3)', verticalAlign: 'middle' }} />
                              {lbl}
                            </button>
                          ))}
                          <input type="color" value={editNameShimmerColor} onChange={(e) => setEditNameShimmerColor(e.target.value)}
                            style={{ width: 40, height: 32, border: 'none', background: 'transparent', cursor: 'pointer' }} title={lang === 'ar' ? 'لون مخصص' : 'Custom color'} />
                          <input type="text" value={editNameShimmerColor} onChange={(e) => setEditNameShimmerColor(e.target.value)}
                            style={{ width: 88, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 12, direction: 'ltr' }} />
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 8, marginBottom: 0 }}>
                          {lang === 'ar'
                            ? 'يُطبَّق على خطوط المخطوطة SVG مباشرة — اختر لوناً مختلفاً عن الشعار للوضوح (مثلاً سماوي مع شعار أبيض).'
                            : 'Applied directly to SVG calligraphy strokes — pick a contrasting light color.'}
                        </p>
                      </div>

                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                          {lang === 'ar' ? 'حركة CC Light Sweep' : lang === 'de' ? 'CC Light Sweep Bewegung' : 'CC Light Sweep motion'}
                        </label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => setEditNameShimmerMotion(true)}
                            style={{
                              padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                              border: `2px solid ${editNameShimmerMotion ? '#0af' : 'rgba(255,255,255,0.2)'}`,
                              background: editNameShimmerMotion ? 'rgba(0,170,255,0.2)' : 'rgba(255,255,255,0.05)',
                              color: '#fff',
                            }}>
                            <i className="fa-solid fa-play" style={{ marginInlineEnd: 6 }} />
                            {lang === 'ar' ? 'تحريك' : lang === 'de' ? 'Bewegen' : 'Animate'}
                          </button>
                          <button type="button" onClick={() => setEditNameShimmerMotion(false)}
                            style={{
                              padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                              border: `2px solid ${!editNameShimmerMotion ? '#0af' : 'rgba(255,255,255,0.2)'}`,
                              background: !editNameShimmerMotion ? 'rgba(0,170,255,0.2)' : 'rgba(255,255,255,0.05)',
                              color: '#fff',
                            }}>
                            <i className="fa-solid fa-pause" style={{ marginInlineEnd: 6 }} />
                            {lang === 'ar' ? 'بدون تحريك' : lang === 'de' ? 'Keine Bewegung' : 'No motion'}
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap', opacity: editNameShimmerMotion ? 1 : 0.45 }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>
                          {lang === 'ar' ? 'سرعة الحركة' : lang === 'de' ? 'Bewegungsgeschwindigkeit' : 'Motion speed'}:
                        </span>
                        <input type="range" min={0.5} max={20} step={0.1} value={editNameShimmerSpeed} disabled={!editNameShimmerMotion}
                          style={{ flex: 1, minWidth: 120 }}
                          onChange={(e) => setEditNameShimmerSpeed(Number(e.target.value))} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0af', minWidth: 52, direction: 'ltr' }}>
                          {editNameShimmerSpeed.toFixed(1)}s
                        </span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                          {lang === 'ar' ? 'بطيء ← → سريع' : 'slow ← → fast'}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: -4, marginBottom: 10 }}>
                        {lang === 'ar'
                          ? 'فعّل «تحريك» لمرور الشعاع. رقم أكبر = أبطأ، رقم أصغر = أسرع.'
                          : 'Enable Animate for the sweep. Higher = slower, lower = faster.'}
                      </p>

                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                          {lang === 'ar' ? 'زاوية CC Light Sweep' : lang === 'de' ? 'CC Light Sweep Winkel' : 'CC Light Sweep angle'}
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                          <input type="range" min={0} max={360} step={1} value={editNameShimmerAngle} style={{ flex: 1, minWidth: 140 }}
                            onChange={(e) => setEditNameShimmerAngle(Number(e.target.value))} />
                          <input type="number" min={0} max={360} step={1} value={editNameShimmerAngle}
                            onChange={(e) => setEditNameShimmerAngle(Math.min(360, Math.max(0, Number(e.target.value) || 0)))}
                            style={{ width: 64, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 12, direction: 'ltr' }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#0af', direction: 'ltr' }}>{editNameShimmerAngle}°</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {([
                            [0, lang === 'ar' ? '0° عمودي' : '0° vertical'],
                            [45, '45°'],
                            [90, lang === 'ar' ? '90° (افتراضي)' : '90° default'],
                            [135, '135°'],
                            [180, '180°'],
                            [270, '270°'],
                          ] as [number, string][]).map(([deg, lbl]) => (
                            <button key={deg} type="button" onClick={() => setEditNameShimmerAngle(deg)}
                              style={{
                                padding: '5px 10px', borderRadius: 16, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                border: `2px solid ${editNameShimmerAngle === deg ? '#0af' : 'rgba(255,255,255,0.2)'}`,
                                background: editNameShimmerAngle === deg ? 'rgba(0,170,255,0.15)' : 'rgba(255,255,255,0.05)',
                                color: '#fff',
                              }}>
                              {lbl}
                            </button>
                          ))}
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8, marginBottom: 0 }}>
                          {lang === 'ar'
                            ? 'اتجاه شعاع الإضاءة على المخطوطة — 90° هو الوضع الافتراضي.'
                            : 'Direction of the light beam across the logo — 90° is the default.'}
                        </p>
                      </div>

                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                          {lang === 'ar' ? 'اتجاه الحركة' : lang === 'de' ? 'Bewegungsrichtung' : 'Motion direction'}
                        </label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => setEditNameShimmerDirection('rtl')}
                            style={{
                              padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                              border: `2px solid ${editNameShimmerDirection === 'rtl' ? '#0af' : 'rgba(255,255,255,0.2)'}`,
                              background: editNameShimmerDirection === 'rtl' ? 'rgba(0,170,255,0.2)' : 'rgba(255,255,255,0.05)',
                              color: '#fff',
                            }}>
                            {lang === 'ar' ? 'يمين → يسار (عربي)' : lang === 'de' ? 'Rechts → Links (AR)' : 'Right → Left (Arabic)'}
                          </button>
                          <button type="button" onClick={() => setEditNameShimmerDirection('ltr')}
                            style={{
                              padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                              border: `2px solid ${editNameShimmerDirection === 'ltr' ? '#0af' : 'rgba(255,255,255,0.2)'}`,
                              background: editNameShimmerDirection === 'ltr' ? 'rgba(0,170,255,0.2)' : 'rgba(255,255,255,0.05)',
                              color: '#fff',
                            }}>
                            {lang === 'ar' ? 'يسار → يمين (English)' : lang === 'de' ? 'Links → Rechts (EN)' : 'Left → Right (English)'}
                          </button>
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8, marginBottom: 0 }}>
                          {lang === 'ar'
                            ? 'عربي: من بداية المخطوطة (يمين) إلى النهاية (يسار). إنجليزي: العكس.'
                            : 'Arabic: right to left. English: left to right.'}
                        </p>
                      </div>

                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600 }}>
                          {lang === 'ar' ? 'عرض شعاع اللمعان' : lang === 'de' ? 'Sweep-Breite' : 'Sweep beam width'}
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <input type="range" min={0.03} max={0.22} step={0.01} value={editNameShimmerWidth}
                            style={{ flex: 1, minWidth: 140 }}
                            onChange={(e) => setEditNameShimmerWidth(Number(e.target.value))} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#0af', minWidth: 72 }}>
                            {editNameShimmerWidth <= 0.05
                              ? (lang === 'ar' ? 'رفيع' : 'Thin')
                              : editNameShimmerWidth >= 0.16
                                ? (lang === 'ar' ? 'سميك' : 'Thick')
                                : (lang === 'ar' ? 'متوسط' : 'Medium')}
                          </span>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                            {lang === 'ar' ? 'رفيع ← → سميك' : 'thin ← → thick'}
                          </span>
                        </div>
                      </div>
                      </>
                    )}
                  </div>

                  {/* معاينة مباشرة */}
                  <div style={{ background: 'rgba(0,12,26,0.55)', borderRadius: 12, padding: '18px 16px', marginBottom: 16, textAlign: 'center', border: '1px solid rgba(100,160,255,0.15)' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
                      {lang === 'ar' ? 'معاينة' : lang === 'de' ? 'Vorschau' : 'Preview'}
                    </div>
                    <HeroNameDisplay
                      name={pickML(editName, cvLang) || pickML(data.name, cvLang)}
                      display={editNameDisplay}
                      logo={editNameLogo}
                      logoColor={editNameLogoColor}
                      shimmer={editNameShimmer}
                      shimmerSpeed={editNameShimmerSpeed}
                      shimmerColor={editNameShimmerColor}
                      shimmerAngle={editNameShimmerAngle}
                      shimmerMotion={editNameShimmerMotion}
                      shimmerDirection={editNameShimmerDirection}
                      shimmerWidth={editNameShimmerWidth}
                    />
                  </div>

                  <div className="form-group">
                    <label>{t.adminBioLabel}</label>
                    <MLInput
                      value={editBio}
                      lang={cvLang}
                      onChange={setEditBio}
                      multiline
                      aiHint="homepage quick bio"
                    />
                  </div>
                  <button className="btn-prime" onClick={saveGlobalBio}>
                    {t.adminSaveBio}
                  </button>
                </>
              )}

              {adminPanel === 1 && (
                <>
                  <h4>{t.adminSkillsTitle}</h4>

                  {/* ── شريط الحجم الموحد لجميع الأيقونات ── */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 14px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                      {lang === 'ar' ? 'حجم جميع الأيقونات' : lang === 'de' ? 'Symbolgröße (alle)' : 'All Icons Size'}:
                    </span>
                    <input type="range" min={16} max={64} value={globalSkillSize} style={{ flex: 1 }}
                      onChange={e => setGlobalSkillSize(Number(e.target.value))} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', minWidth: 36 }}>{globalSkillSize}px</span>
                    <SkillIcon icon={editSkills[0]?.icon || 'fa-star'} name={editSkills[0]?.name || ''} size={globalSkillSize} />
                  </div>

                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 10, lineHeight: 1.5 }}>
                    {lang === 'ar'
                      ? 'ارفع الأيقونة أو الصق رابط صورة. على الموقع المباشر (Hostinger) يُفضَّل الرفع أو الرابط — الصور المحلية فقط لا تُحفظ على السيرفر.'
                      : lang === 'de'
                        ? 'Symbol hochladen oder Bild-URL einfügen. Auf Hostinger Upload oder URL verwenden.'
                        : 'Upload an icon or paste an image URL. On Hostinger, use upload or URL — local-only images are not stored on the server.'}
                  </div>

                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fa-solid fa-grip-vertical" />
                    {lang === 'ar' ? 'اسحب الصف لإعادة الترتيب — أو استخدم سهمَي ↑↓' : lang === 'de' ? 'Zeile ziehen oder ↑↓ benutzen' : 'Drag row to reorder — or use ↑↓ arrows'}
                  </div>
                  <DndContext sensors={skillDndSensors} collisionDetection={closestCenter} onDragEnd={handleSkillDragEnd}>
                    <SortableContext items={editSkills.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      {editSkills.map((s, i) => (
                        <SortableSkillItem
                          key={s.id}
                          skill={s}
                          index={i}
                          total={editSkills.length}
                          lang={lang}
                          globalSkillSize={globalSkillSize}
                          onChange={handleSkillChange}
                          onDelete={(id) => saveSkillsImmediate(editSkills.filter(x => x.id !== id))}
                          onMoveUp={handleSkillMoveUp}
                          onMoveDown={handleSkillMoveDown}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <button className="btn-outline-sm" onClick={() => setEditSkills(prev => [...prev, { id: Math.random().toString(36).slice(2, 9), name: lang === 'ar' ? 'مهارة جديدة' : 'New Skill', icon: '', percent: 50, size: globalSkillSize } as Skill])}>
                      <i className="fa-solid fa-plus" /> {lang === 'ar' ? 'إضافة مهارة' : lang === 'de' ? 'Fähigkeit hinzufügen' : 'Add Skill'}
                    </button>
                    <button
                      type="button"
                      className="btn-outline-sm"
                      onClick={() => {
                        const restored = restoreDefaultSkillIcons(editSkills);
                        setEditSkills(restored);
                        saveSkillsImmediate(restored);
                      }}
                    >
                      <i className="fa-solid fa-rotate-left" /> {lang === 'ar' ? 'استرجاع أيقونات البرامج' : lang === 'de' ? 'Programm-Icons wiederherstellen' : 'Restore app icons'}
                    </button>
                    <button className="btn-prime" onClick={saveSkills}>{t.adminSaveSkills}</button>
                  </div>
                </>
              )}

              {adminPanel === 2 && (
                <CvDocEditor
                  data={data}
                  onSave={handleCvSave}
                  onExport={printCvDoc}
                />
              )}

              {adminPanel === 3 && (
                <ContentAdmin mode="agri" data={data} onSave={handleCvSave} />
              )}

              {adminPanel === 4 && (
                <ContentAdmin mode="gfx" data={data} onSave={handleCvSave} />
              )}

              {adminPanel === 5 && (
                <ContentAdmin mode="lab" data={data} onSave={handleCvSave} />
              )}

              {adminPanel === 7 && (
                <ContentAdmin
                  mode="site"
                  data={data}
                  onSave={handleCvSave}
                  onSiteApply={handleSiteApply}
                  onSitePersist={handleSitePersist}
                  serverConnected={serverConnected}
                  serverSyncing={serverSyncing}
                  onServerConnect={handleServerConnect}
                  onServerSync={handleServerSync}
                  onServerDisconnect={handleServerDisconnect}
                />
              )}

              {adminPanel === 8 && (
                <FileExplorerAdmin data={data} onSave={handleCvSave} />
              )}

              {adminPanel === 9 && (
                <AnalyticsDashboard lang={lang as 'ar' | 'en' | 'de'} />
              )}

              {adminPanel === 6 && (
                <>
                  <h4>{t.adminInjectTitle}</h4>
                  <div className="form-group">
                    <label>{t.adminPageTitleLabel}</label>
                    <input
                      type="text"
                      value={newPageTitle}
                      onChange={(e) => setNewPageTitle(e.target.value)}
                      placeholder={
                        lang === "ar"
                          ? "مثال: قسم زراعة الزعفران الطبية"
                          : "e.g. Saffron Cultivation Section"
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>{t.adminPageHtmlLabel}</label>
                    <textarea
                      rows={5}
                      value={newPageHtml}
                      onChange={(e) => setNewPageHtml(e.target.value)}
                      style={{ direction: "ltr", fontFamily: "monospace" }}
                      placeholder="<div class='custom-card'><h3>Title</h3><p>Content...</p></div>"
                    />
                  </div>
                  <div className="form-group">
                    <label>{t.adminPageCssLabel}</label>
                    <textarea
                      rows={4}
                      value={newPageCss}
                      onChange={(e) => setNewPageCss(e.target.value)}
                      style={{ direction: "ltr", fontFamily: "monospace" }}
                      placeholder=".custom-card { background: gold; padding: 20px; }"
                    />
                  </div>
                  <button className="btn-prime" onClick={injectPage}>
                    {t.adminInjectBtn}
                  </button>

                  {/* Language pref in admin */}
                  <div
                    style={{
                      marginTop: "30px",
                      borderTop: "1px solid #eee",
                      paddingTop: "22px",
                    }}
                  >
                    <h4>{t.langSettings}</h4>
                    <div className="lang-picker">
                      {(
                        [
                          ["ar", t.langAr, "🇸🇾"],
                          ["en", t.langEn, "🇺🇸"],
                          ["de", t.langDe, "🇩🇪"],
                        ] as [LangCode, string, string][]
                      ).map(([code, label, flag]) => (
                        <button
                          key={code}
                          className={`lang-option${lang === code ? " selected" : ""}`}
                          onClick={() => switchLang(code)}
                        >
                          <span>{flag}</span> {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </main>
          </div>
        </div>
      )}

      {/* ── Floating CV Button removed per admin request ── */}

      {/* ── Hidden CV snapshots for about-page PDF (نفس محتوى المعاينة) ─── */}
      {visitorCvDocsForExport(data).length > 0 && (
        <div
          aria-hidden="true"
          className="cv-export-offscreen plant-report-export-host plant-report-export-capture"
          style={{
            position: "fixed",
            left: -12000,
            top: 0,
            width: CV_EXPORT_PX,
            zIndex: -9998,
            pointerEvents: "none",
            opacity: 1,
            visibility: "visible",
            overflow: "visible",
          }}
        >
          {visitorCvDocsForExport(data).map((d) => (
            <div
              key={d.id}
              ref={(el) => { aboutCvSnapRefs.current[d.id] = el; }}
              className="cv-preview-stack"
              style={{ width: CV_EXPORT_PX }}
            >
              <CvRenderer
                doc={d}
                lang={cvLang}
                name={pickML(data.name, cvLang)}
                skills={data.skills}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Hidden render for browser print (any doc, any language) ─── */}
      <div
        aria-hidden="true"
        className="cv-print-mount cv-export-offscreen"
        style={{
          position: "fixed",
          left: -12000,
          top: 0,
          width: CV_EXPORT_PX,
          zIndex: -9998,
          pointerEvents: "none",
          opacity: 1,
          visibility: "visible",
          overflow: "visible",
        }}
      >
        {printCvMount && (
          <div
            ref={cvPrintMountRef}
            className="cv-preview-stack"
            style={{ width: CV_EXPORT_PX }}
          >
            <CvRenderer
              doc={printCvMount.doc}
              lang={printCvMount.lang}
              name={pickML(printCvMount.name, printCvMount.lang)}
              skills={printCvMount.skills.length ? printCvMount.skills : data.skills}
            />
          </div>
        )}
      </div>

      {/* ── اختيار لغة السيرة (عربي · إنجليزي · ألماني) ─── */}
      {cvLangPickerDoc && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: "'Tajawal', sans-serif" }}
          onClick={() => setCvLangPickerDoc(null)}
        >
          <div
            style={{ background: '#0c1628', borderRadius: 16, padding: '28px 24px', maxWidth: 400, width: '100%', border: '1px solid rgba(120,160,255,0.25)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', fontFamily: "'Tajawal', sans-serif" }}
            onClick={e => e.stopPropagation()}
            dir={cvLang === 'ar' ? 'rtl' : 'ltr'}
          >
            <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#e8f0ff', fontFamily: "'Tajawal', sans-serif" }}>
              {cvDocLabel(cvLangPickerDoc, cvLang)}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 15, color: 'rgba(200,215,240,0.85)', lineHeight: 1.65, fontFamily: "'Tajawal', sans-serif" }}>
              {CV_LANG_PICKER_PROMPT[cvLang]}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                ['ar', 'العربية', '🇸🇾'],
                ['en', 'English', '🇺🇸'],
                ['de', 'Deutsch', '🇩🇪'],
              ] as [LangKey, string, string][]).map(([code, label, flag]) => (
                <button
                  key={code}
                  type="button"
                  className="btn-prime"
                  disabled={printingCv}
                  style={{ justifyContent: 'center', gap: 10 }}
                  onClick={() => {
                    const picked = cvLangPickerDoc;
                    setCvLangPickerDoc(null);
                    if (picked) void printCvDoc(picked, code);
                  }}
                >
                  <span>{flag}</span> {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn-outline-sm"
              style={{ marginTop: 16, width: '100%' }}
              onClick={() => setCvLangPickerDoc(null)}
            >
              {CV_LANG_PICKER_CANCEL[cvLang]}
            </button>
          </div>
        </div>
      )}


      {/* ── Site Footer ──────────────────────────────────── */}
      {portal !== 'admin' && (
        <footer style={{ position: 'relative', zIndex: 1, background: data.siteSettings?.footerBg || '#003366', color: '#fff', textAlign: 'center', padding: '18px 24px', marginTop: 60, fontSize: 13 }}>
          {data.siteSettings?.footerText?.[lang as LangKey] || '© Alaa Ahmad Almasri — All Rights Reserved'}
          {(data.siteSettings?.socialLinks || []).length > 0 && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 10 }}>
              {(data.siteSettings?.socialLinks || []).map(l => (
                <a key={l.id} href={l.url} target="_blank" rel="noreferrer" style={{ color: '#fff', opacity: 0.8, fontSize: 16 }}>
                  <i className={l.icon} />
                </a>
              ))}
            </div>
          )}
          {/* Discreet dashboard access — hidden from the main nav so customers don't see it */}
          <div style={{ marginTop: 14 }}>
            <button
              className="footer-admin-btn"
              onClick={() => {
                setAdminEmail("");
                setAdminPass("");
                setAdminError("");
                setAdminGate(true);
              }}
            >
              <i className="fa-solid fa-gear" />
              {t.adminBtn}
            </button>
          </div>
        </footer>
      )}

      {/* ── Book Preview Modal ───────────────────────── */}
      {bookPreview && (() => {
        const waPhone = (data.personalInfo?.phone || '').replace(/\D/g, '');
        const waMsg   = encodeURIComponent((lang === 'ar' ? 'مرحباً م. علاء، أريد شراء كتاب: ' : 'Hello Eng. Alaa, I want to purchase: ') + pickML(bookPreview.title, lang as LangKey));
        const waLink  = `https://wa.me/${waPhone}?text=${waMsg}`;
        const embedUrl = bookPreview.previewUrl || '';
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={() => setBookPreview(null)}>
            <div style={{ width: '100%', maxWidth: 860, background: '#0c1628', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', maxHeight: '92vh', border: '1px solid rgba(120,160,255,0.2)' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, background: '#001529', borderBottom: '1px solid rgba(120,160,255,0.15)', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#dfe9f8' }}>{pickML(bookPreview.title, lang as LangKey)}</div>
                  {pickML(bookPreview.author, lang as LangKey) && (
                    <div style={{ fontSize: 12, color: '#9fb3cc', marginTop: 2 }}>{pickML(bookPreview.author, lang as LangKey)}</div>
                  )}
                </div>
                {bookPreview.isPaid && (
                  <span style={{ fontSize: 11, fontWeight: 800, background: '#f0a030', color: '#fff', borderRadius: 6, padding: '3px 10px' }}>💰 {t.paidBadge}</span>
                )}
                <button onClick={() => setBookPreview(null)}
                  style={{ background: 'rgba(255,60,60,0.15)', border: '1px solid rgba(255,60,60,0.35)', borderRadius: 8, padding: '6px 12px', color: '#f88', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                  ✕ {t.closePreview}
                </button>
              </div>

              {/* Preview note for paid books */}
              {bookPreview.isPaid && (
                <div style={{ padding: '8px 20px', background: 'rgba(240,160,48,0.1)', borderBottom: '1px solid rgba(240,160,48,0.2)', fontSize: 12, color: '#f0c070', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fa-solid fa-circle-info" /> {t.previewNote}
                </div>
              )}

              {/* iFrame */}
              <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#111' }}>
                <iframe
                  src={embedUrl}
                  style={{ width: '100%', height: '100%', minHeight: 480, border: 'none', display: 'block' }}
                  allow="autoplay"
                  title={pickML(bookPreview.title, lang as LangKey)}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                />
              </div>

              {/* Footer */}
              <div style={{ padding: '12px 20px', background: '#001529', borderTop: '1px solid rgba(120,160,255,0.12)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: bookPreview.isPaid ? 'space-between' : 'flex-end' }}>
                {bookPreview.isPaid ? (
                  <>
                    <span style={{ fontSize: 13, color: '#9fb3cc' }}>{t.previewNote}</span>
                    <a href={waLink} target="_blank" rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#25d366', color: '#fff', borderRadius: 10, padding: '9px 22px', fontWeight: 800, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 14px rgba(37,211,102,0.3)' }}>
                      <i className="fa-brands fa-whatsapp" style={{ fontSize: 16 }} /> {t.contactToBuy}
                    </a>
                  </>
                ) : (
                  bookPreview.driveUrl && (
                    <a href={bookPreview.driveUrl} target="_blank" rel="noreferrer"
                      onClick={() => trackFileDownload(pickML(bookPreview.title, lang as LangKey) || 'book', bookPreview.id)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--btn-bg, var(--navy))', color: 'var(--btn-text, #fff)', borderRadius: 10, padding: '9px 22px', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
                      <i className="fa-solid fa-download" /> {t.downloadBook}
                    </a>
                  )
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {printingCv && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 12000, background: 'rgba(0,0,0,0.72)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
          <i className="fa-solid fa-file-pdf fa-spin" style={{ fontSize: 42, color: '#5ec8ff' }} />
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, textAlign: 'center' }}>
            {lang === 'ar' ? 'جاري تجهيز المعاينة…' : lang === 'de' ? 'Vorschau wird erstellt…' : 'Preparing preview…'}
          </div>
          <div style={{ color: '#b8cce8', fontSize: 12, textAlign: 'center', maxWidth: 320 }}>
            {lang === 'ar' ? 'انتظر قليلاً — ستظهر معاينة PDF ثم زر الحفظ' : lang === 'de' ? 'Bitte warten — PDF-Vorschau erscheint gleich' : 'Please wait — PDF preview will open shortly'}
          </div>
        </div>
      )}

      {/* ── Bottom Navigation (mobile only) ──────────── */}
      <nav className="bottom-nav" role="navigation">
        {[
          { key: 'home',     icon: 'fa-house',       label: lang === 'ar' ? 'الرئيسية' : lang === 'de' ? 'Start'     : 'Home'     },
          { key: 'agri',     icon: 'fa-seedling',    label: lang === 'ar' ? 'الزراعة'  : lang === 'de' ? 'Agrar'     : 'Agri'     },
          { key: 'graphics', icon: 'fa-bezier-curve', label: lang === 'ar' ? 'التصاميم' : lang === 'de' ? 'Design'    : 'Design'   },
          { key: 'software', icon: 'fa-code',        label: lang === 'ar' ? 'البرمجة'  : lang === 'de' ? 'Dev'       : 'Dev'      },
          { key: 'about',    icon: 'fa-user',        label: lang === 'ar' ? 'السيرة'   : lang === 'de' ? 'CV'        : 'CV'       },
        ].map(item => (
          <button
            key={item.key}
            className={`bottom-nav-item${portal === item.key ? ' active' : ''}`}
            onClick={() => item.key === 'home' ? goHome() : openPortal(item.key as Portal)}
            aria-label={item.label}
          >
            <i className={`fa-solid ${item.icon}`} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Admin Gate Modal ─────────────────────────── */}
      {adminGate && (
        <div className="modal-overlay" onClick={() => setAdminGate(false)}>
          <div className="modal-box glass" onClick={(e) => e.stopPropagation()}>
            <h3>{t.adminLoginTitle}</h3>
            <div className="form-group">
              <label>{t.adminEmailLabel}</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => {
                  setAdminEmail(e.target.value);
                  setAdminError("");
                }}
                style={{ direction: "ltr" }}
                placeholder="admin@email.com"
              />
            </div>
            <div className="form-group">
              <label>{t.adminPassLabel}</label>
              <input
                type="password"
                value={adminPass}
                onChange={(e) => {
                  setAdminPass(e.target.value);
                  setAdminError("");
                }}
              />
            </div>
            {adminError && (
              <p
                style={{
                  color: "#c00",
                  fontSize: "13px",
                  marginBottom: "10px",
                  textAlign: "center",
                }}
              >
                {adminError}
              </p>
            )}
            <button className="btn-prime" onClick={handleAdminLogin}>
              {t.adminLoginBtn} <i className="fa-solid fa-right-to-bracket" />
            </button>
            <button className="btn-cancel" onClick={() => setAdminGate(false)}>
              {t.adminCancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
