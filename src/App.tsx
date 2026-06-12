import { useEffect, useRef, useState, useCallback } from "react";
import { LangCode, translations, T } from "./translations";
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
  pickML,
  loadAppData,
  loadAppDataFromDb,
  saveAppData,
  loginToApi,
  getApiToken,
  clearApiToken,
  ADMIN_EMAIL,
  ADMIN_PASS,
  LANG_PREF_KEY,
  WebProject,
  DEFAULT_BOOK_GRID,
  DEFAULT_WEB_GRID,
  DEFAULT_GFX_GRID,
  driveThumb,
} from "./appData";
import { ContentAdmin } from "./ContentAdmin";
import { FileExplorerAdmin } from "./FileExplorerAdmin";
import { PlantDiagnostic } from "./PlantDiagnostic";
import { AlaaLogo } from "./AlaaLogo";
import { SoilRequest } from "./SoilRequest";
import { CvDocEditor } from "./CvDocEditor";
import { CvRenderer } from "./CvRenderer";
import { stripHtml } from "./RichEditor";
import { SkillIcon } from "./SkillIcon";
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

type Portal =
  | "home"
  | "about"
  | "agri"
  | "graphics"
  | "software"
  | "cv"
  | "admin";

/* ═══════════════════════════════════════════════════════
   THREE.JS BACKGROUND
══════════════════════════════════════════════════════════ */
/* Default Three.js CDN URL used in index.html */
export const DEFAULT_THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

function useThreeBackground(
  containerRef: React.RefObject<HTMLDivElement | null>,
  theme: 'dark' | 'light',
) {
  useEffect(() => {
    const THREE = window.THREE;
    if (!THREE || !containerRef.current) return;
    const isDark = theme === 'dark';
    const container = containerRef.current;
    let rafId: number;
    let renderer: any = null;
    let mouseX = 0, mouseY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouseMove);

    try {
      /* ── Scene & Camera ─────────────────────────── */
      const scene = new THREE.Scene();
      if (isDark) scene.fog = new THREE.FogExp2(0x000c1a, 0.032);

      const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
      camera.position.set(0, 0, 12);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x000000, 0);
      container.appendChild(renderer.domElement);

      /* ── Theme colours ──────────────────────────── */
      const ptColor    = isDark ? 0x4488ff : 0x1144cc;
      const lineColor  = isDark ? 0x1144aa : 0x2255bb;
      const lineOp     = isDark ? 0.18 : 0.28;
      const shapeColor = isDark ? 0x2266ff : 0x1155bb;
      const shapeOp    = isDark ? 0.35 : 0.5;
      const ringColor  = isDark ? 0x1155cc : 0x2266cc;
      const ringOp     = isDark ? 0.3 : 0.4;

      /* ── Particles with connection lines ────────── */
      const PARTICLE_COUNT = 500;
      const positions: number[] = [];
      const velocities: number[] = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const r = 10 + Math.random() * 6;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions.push(
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi),
        );
        velocities.push(
          (Math.random() - 0.5) * 0.006,
          (Math.random() - 0.5) * 0.006,
          (Math.random() - 0.5) * 0.006,
        );
      }
      const ptGeo = new THREE.BufferGeometry();
      ptGeo.setAttribute("position", new THREE.Float32BufferAttribute([...positions], 3));
      const ptMat = new THREE.PointsMaterial({ color: ptColor, size: 0.12, transparent: true, opacity: isDark ? 0.75 : 0.85, sizeAttenuation: true });
      const particles = new THREE.Points(ptGeo, ptMat);
      scene.add(particles);

      /* ── Line mesh between close particles ─────── */
      const LINE_THRESHOLD = 3.8;
      const linePosArr = new Float32Array(PARTICLE_COUNT * PARTICLE_COUNT * 6);
      const lineGeo = new THREE.BufferGeometry();
      const linePos = new THREE.BufferAttribute(linePosArr, 3);
      lineGeo.setAttribute("position", linePos);
      const lineMat = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: lineOp }));
      scene.add(lineMat);

      /* ── Wireframe floating shapes ──────────────── */
      const shapeDefs = [
        { geo: new THREE.IcosahedronGeometry(1.4, 1), x: 4, y: 2, z: -2 },
        { geo: new THREE.OctahedronGeometry(0.9, 1), x: -4.5, y: -1.5, z: -1 },
        { geo: new THREE.TetrahedronGeometry(0.7, 0), x: 3, y: -3, z: 2 },
        { geo: new THREE.IcosahedronGeometry(0.6, 0), x: -2.5, y: 3, z: 1 },
      ];
      const meshes: any[] = [];
      shapeDefs.forEach((def) => {
        const edges = new THREE.EdgesGeometry(def.geo);
        const mat2 = new THREE.LineBasicMaterial({ color: shapeColor, transparent: true, opacity: shapeOp });
        const mesh = new THREE.LineSegments(edges, mat2);
        mesh.position.set(def.x, def.y, def.z);
        scene.add(mesh);
        meshes.push(mesh);
      });

      /* ── Central glowing rings ───────────────────── */
      const ringMat = new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: ringOp });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.018, 2, 140), ringMat);
      ring.rotation.x = Math.PI / 3;
      scene.add(ring);
      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(2.3, 0.012, 2, 100),
        new THREE.MeshBasicMaterial({ color: isDark ? 0x3377ff : 0x4488dd, transparent: true, opacity: isDark ? 0.2 : 0.3 }),
      );
      ring2.rotation.x = -Math.PI / 4;
      ring2.rotation.z = Math.PI / 6;
      scene.add(ring2);

      /* ── Animate ────────────────────────────────── */
      let t = 0;
      function animate() {
        rafId = requestAnimationFrame(animate);
        t += 0.005;
        const pa = ptGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          pa[i * 3] += velocities[i * 3];
          pa[i * 3 + 1] += velocities[i * 3 + 1];
          pa[i * 3 + 2] += velocities[i * 3 + 2];
          const dist = Math.sqrt(pa[i * 3] ** 2 + pa[i * 3 + 1] ** 2 + pa[i * 3 + 2] ** 2);
          if (dist > 16) { pa[i * 3] *= 0.97; pa[i * 3 + 1] *= 0.97; pa[i * 3 + 2] *= 0.97; }
        }
        ptGeo.attributes.position.needsUpdate = true;
        let lineIdx = 0;
        const la = linePos.array as Float32Array;
        for (let i = 0; i < PARTICLE_COUNT && lineIdx < la.length - 12; i++) {
          for (let j = i + 1; j < PARTICLE_COUNT && lineIdx < la.length - 6; j++) {
            const dx = pa[i * 3] - pa[j * 3], dy = pa[i * 3 + 1] - pa[j * 3 + 1], dz = pa[i * 3 + 2] - pa[j * 3 + 2];
            if (Math.sqrt(dx * dx + dy * dy + dz * dz) < LINE_THRESHOLD) {
              la[lineIdx++] = pa[i * 3]; la[lineIdx++] = pa[i * 3 + 1]; la[lineIdx++] = pa[i * 3 + 2];
              la[lineIdx++] = pa[j * 3]; la[lineIdx++] = pa[j * 3 + 1]; la[lineIdx++] = pa[j * 3 + 2];
            }
          }
        }
        lineGeo.setDrawRange(0, lineIdx / 3);
        linePos.needsUpdate = true;
        meshes.forEach((m, idx) => {
          m.rotation.x += 0.003 + idx * 0.0008;
          m.rotation.y += 0.004 + idx * 0.0006;
          m.position.y += Math.sin(t + idx) * 0.003;
        });
        ring.rotation.z += 0.002;
        ring2.rotation.y += 0.0015;
        camera.position.x += (mouseX * 1.2 - camera.position.x) * 0.02;
        camera.position.y += (-mouseY * 0.8 - camera.position.y) * 0.02;
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
      }
      animate();

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener("resize", onResize);

      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("mousemove", onMouseMove);
        if (renderer && container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        renderer?.dispose();
      };
    } catch {
      window.removeEventListener("mousemove", onMouseMove);
      return () => { cancelAnimationFrame(rafId); };
    }
  }, [theme]);
}

/* ═══════════════════════════════════════════════════════
   THREE.JS PHOTO ORBIT (About Page)
══════════════════════════════════════════════════════════ */
function usePhotoOrbit(
  containerRef: React.RefObject<HTMLDivElement | null>,
  active: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const THREE = window.THREE;
    if (!THREE || !containerRef.current) return;
    const container = containerRef.current;
    let rafId: number;
    let renderer: any = null;

    try {
      const W = container.offsetWidth || 340;
      const H = container.offsetHeight || 440;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      Object.assign(renderer.domElement.style, {
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: "1",
      });
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
      camera.position.z = 5;

      const mkRing = (
        r: number,
        tube: number,
        col: number,
        op: number,
        rx: number,
        rz: number,
      ) => {
        const m = new THREE.Mesh(
          new THREE.TorusGeometry(r, tube, 12, 120),
          new THREE.MeshBasicMaterial({
            color: col,
            transparent: true,
            opacity: op,
          }),
        );
        m.rotation.x = rx;
        m.rotation.z = rz;
        scene.add(m);
        return m;
      };
      const ring1 = mkRing(2.0, 0.013, 0x4488ff, 0.65, Math.PI / 3, 0.2);
      const ring2 = mkRing(2.6, 0.009, 0x2255cc, 0.4, -Math.PI / 4, -0.4);
      const ring3 = mkRing(1.6, 0.016, 0x88bbff, 0.3, Math.PI / 5, Math.PI / 4);

      const dotGeo = new THREE.SphereGeometry(0.035, 8, 8);
      const dots = Array.from({ length: 14 }, (_, i) => {
        const mesh = new THREE.Mesh(
          dotGeo,
          new THREE.MeshBasicMaterial({ color: 0x99ccff }),
        );
        const angle = (i / 14) * Math.PI * 2;
        const radius = 2.0 + (i % 3) * 0.25;
        return { mesh, angle, radius, speed: 0.006 + (i % 5) * 0.002 };
      });
      dots.forEach((d) => scene.add(d.mesh));

      let t = 0;
      const animate = () => {
        rafId = requestAnimationFrame(animate);
        t += 0.007;
        ring1.rotation.y = t * 0.5;
        ring2.rotation.y = -t * 0.3;
        ring3.rotation.y = t * 0.45;
        ring3.rotation.x = Math.PI / 5 + t * 0.1;
        dots.forEach((d) => {
          const a = d.angle + t * d.speed * 80;
          d.mesh.position.set(
            Math.cos(a) * d.radius,
            Math.sin(a) * 0.8,
            Math.sin(a * 0.6) * 0.5,
          );
        });
        renderer.render(scene, camera);
      };
      animate();
    } catch {
      /* WebGL unavailable */
    }

    return () => {
      cancelAnimationFrame(rafId);
      if (renderer) {
        renderer.dispose();
        const cv = renderer.domElement;
        if (cv?.parentNode) cv.parentNode.removeChild(cv);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

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
  const dragStyle: React.CSSProperties = {
    transform: DndCSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 999 : undefined,
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

      {/* Icon upload */}
      <div className="skill-admin-icon-wrap">
        <label className="skill-admin-icon-btn" title={lang === "ar" ? "رفع أيقونة" : lang === "de" ? "Symbol hochladen" : "Upload icon"}>
          <SkillIcon icon={s.icon} size={22} />
          <input type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0]; if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => onChange(s.id, { icon: ev.target?.result as string });
              reader.readAsDataURL(file);
            }} />
          <span className="skill-admin-icon-hint">{lang === "ar" ? "تغيير" : lang === "de" ? "Ändern" : "Change"}</span>
        </label>
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
  const [lang, setLang] = useState<LangCode>(detectLang);
  const [portal, setPortal] = useState<Portal>("home");
  const [adminGate, setAdminGate] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [data, setData] = useState<AppData>(loadAppData);
  const [activeSkill, setActiveSkill] = useState<string | null>(null);
  const [agriTab, setAgriTab] = useState(0);
  const [gfxTab, setGfxTab] = useState(0);
  const [adminPanel, setAdminPanel] = useState(0);
  const [selectedSnippetIdx, setSelectedSnippetIdx] = useState<number | null>(
    null,
  );
  const [snippetHtml, setSnippetHtml] = useState("");
  const [snippetCss, setSnippetCss] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cvDocId, setCvDocId] = useState<string>("");
  const [exportLang, setExportLang] = useState<LangKey>("ar");
  const [cvWidth, setCvWidth] = useState(210);
  const [openPrompt, setOpenPrompt] = useState<number | null>(null);

  // GFX 3-tier & full-page project view
  const [gfxSelCatId, setGfxSelCatId] = useState<string>("");
  const [gfxSelSubId, setGfxSelSubId] = useState<string>("");
  const [gfxProjectPage, setGfxProjectPage] = useState<GfxProjectItem | null>(null);
  const [gfxCarouselIdx, setGfxCarouselIdx] = useState(0);
  const [gfxSearch, setGfxSearch] = useState('');
  const [gfxRequestOpen, setGfxRequestOpen] = useState(false);

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
  const [softSubTab, setSoftSubTab] = useState<'projects' | 'labs'>('projects');
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
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editSkills, setEditSkills] = useState<Skill[]>([]);
  const [globalSkillSize, setGlobalSkillSize] = useState(26);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageHtml, setNewPageHtml] = useState("");
  const [newPageCss, setNewPageCss] = useState("");

  const canvasRef = useRef<HTMLDivElement>(null);
  const aboutPhotoRef = useRef<HTMLDivElement>(null);
  const cvExportRef = useRef<HTMLDivElement>(null);
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const [exportDocState, setExportDocState] = useState<CvDoc | null>(null);

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

  // Three.js — animated network renders on every page (dark=deep-navy palette, light=blue-on-white palette)
  useThreeBackground(canvasRef, theme);
  usePhotoOrbit(aboutPhotoRef, portal === "about");

  // Load app data from database on startup (syncs across devices)
  useEffect(() => {
    loadAppDataFromDb().then(dbData => {
      if (dbData) setData(dbData);
    }).catch(() => { /* stay with localStorage data */ });
  }, []);

  // Sync document dir/lang
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = t.dir;
  }, [lang, t.dir]);

  // Keep agri sub-tab index in range when the diagnostic tab is toggled
  // Tabs: [diag?] + soilreq + articles + books
  useEffect(() => {
    const count = (data.aiDiagnosticsEnabled ? 1 : 0) + 3;
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

  const openPortal = useCallback((p: Portal) => {
    setPortal(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const goHome = useCallback(() => {
    setPortal("home");
    setActiveSkill(null);
  }, []);

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
      setEditSkills(data.skills.map((s) => ({ ...s })));
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
        saveAppData(data);
      }
      return ok;
    } finally {
      setServerSyncing(false);
    }
  }

  function handleServerSync() {
    setServerSyncing(true);
    saveAppData(data);
    setTimeout(() => setServerSyncing(false), 1500);
  }

  function handleServerDisconnect() {
    clearApiToken();
    setServerConnected(false);
  }

  function exportDoc(doc: CvDoc, exLang: LangKey) {
    setExportDocState(doc);
    setExportLang(exLang);
    setTimeout(() => {
      if (!cvExportRef.current || !window.html2pdf) return;
      const safeName = (doc.name || "cv").replace(/\s+/g, "_");
      window
        .html2pdf()
        .set({
          margin: 5,
          filename: `CV_${safeName}_${exLang}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(cvExportRef.current)
        .save()
        .then(() => setExportDocState(null));
    }, 300);
  }

  function saveGlobalBio() {
    const updated = { ...data, name: editName, bio: editBio };
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

  function handleCvSave(partial: Partial<AppData>) {
    const updated = { ...data, ...partial };
    setData(updated);
    saveAppData(updated);
  }

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
    const [h, s] = parseHsl(data.siteSettings?.accentColor || "#003366");
    // Accent: as-picked in light mode; lifted to a readable, still-saturated
    // brightness in dark mode (~62% L, matching the original #5b9bff feel).
    const navyL = dark ? 62 : 28;
    const navy = `hsl(${h}, ${Math.max(s, 45)}%, ${navyL}%)`;
    const hsla = (l: number, a: number) => `hsla(${h}, ${Math.max(s, 35)}%, ${l}%, ${a})`;
    return {
      "--navy": navy,
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
          <div className="lang-dd">
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
            {langOpen && (
              <>
                <div
                  className="lang-dd-backdrop"
                  onClick={() => setLangOpen(false)}
                />
                <div className="lang-dd-menu" role="listbox">
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
              </>
            )}
          </div>
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
          <h1 className="hero-name">{data.name}</h1>

          {/* Animated underline */}
          <div className="hero-divider">
            <span className="hero-divider-dot" />
            <span className="hero-divider-bar" />
            <span className="hero-divider-dot" />
          </div>

          {/* Bio */}
          <p className="hero-bio">{data.bio}</p>

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
            <div className="about-dark-photo-side" ref={aboutPhotoRef}>
              <img
                src="/alaa-photo.jpg"
                alt={data.name}
                className="about-dark-photo-img"
              />
              {/* Gradient fade on the left edge — merges photo into dark bg */}
              <div className="about-dark-photo-fade" />
              {/* Name badge floating at bottom of photo */}
              <div className="about-dark-name-badge">
                <span className="about-dark-name">{data.name}</span>
                <span className="about-dark-role">{t.aboutSubtitle}</span>
              </div>
            </div>

            {/* Text content — sits BEHIND the photo (lower z-index) */}
            <div className="about-dark-content">
              <span className="about-dark-eyebrow">{t.aboutTitle}</span>
              <p className="about-dark-bio">{data.bio}</p>

              {/* CV Download Buttons — one per doc shown in About, exports current site language */}
              {data.cvDocs.some((d) => d.showInAbout) && (
                <div className="about-dark-cv-btns">
                  {data.cvDocs
                    .filter((d) => d.showInAbout)
                    .map((d) => (
                      <button
                        key={d.id}
                        className="about-glass-btn"
                        style={{ borderColor: d.accent }}
                        onClick={() => exportDoc(d, lang)}
                      >
                        <i
                          className={`fa-solid ${d.icon}`}
                          style={{ color: d.accent }}
                        />
                        <span>{d.name}</span>
                        <i className="fa-solid fa-arrow-down" />
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
                      <SkillIcon icon={skill.icon} size={18} />
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
          { key: 'soilreq', label: t.soilReqTab },
          { key: 'articles', label: t.agriArticles },
          { key: 'books', label: t.agriBooks },
        ];
        const activeKey = (agriTabs[agriTab] || agriTabs[0]).key;
        const bookKindLabel = (k: BookKind) =>
          k === 'theory' ? (lang === 'ar' ? 'نظري' : lang === 'de' ? 'Theorie' : 'Theory')
          : k === 'practical' ? (lang === 'ar' ? 'عملي' : lang === 'de' ? 'Praxis' : 'Practical')
          : (lang === 'ar' ? 'نظري وعملي' : lang === 'de' ? 'Theorie & Praxis' : 'Theory & Practical');
        const borderCol = theme === 'dark' ? 'rgba(255,255,255,0.12)' : '#dde6f0';
        const bgs = { ...DEFAULT_BOOK_GRID, cardWidth: 130, ...(data.bookGridSettings || {}) };
        const renderBookCard = (book: AgriBook) => {
          const waPhone = (data.personalInfo?.phone || '').replace(/\D/g, '');
          const waMsg   = encodeURIComponent((lang === 'ar' ? 'مرحباً م. علاء، أريد شراء كتاب: ' : 'Hello Eng. Alaa, I want to purchase: ') + pickML(book.title, lang as LangKey));
          const waLink  = `https://wa.me/${waPhone}?text=${waMsg}`;
          const thumbSrc = book.thumbnail ? driveThumb(book.thumbnail) : '';
          return (
            <div key={book.id} className="glass" style={{ borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', position: 'relative' }}>
              {/* Paid/Free badge */}
              {book.isPaid !== undefined && (
                <div style={{ position: 'absolute', top: 8, insetInlineEnd: 8, zIndex: 2, fontSize: 10, fontWeight: 800, borderRadius: 6, padding: '3px 8px', background: book.isPaid ? '#f0a030' : '#22c55e', color: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
                  {book.isPaid ? `💰 ${t.paidBadge}` : `🆓 ${t.freeBadge}`}
                </div>
              )}
              {thumbSrc
                ? <img src={thumbSrc} alt={pickML(book.title, lang as LangKey)} style={{ width: '100%', height: bgs.imgHeight, objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: bgs.imgHeight, background: 'var(--navy-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.max(24, bgs.imgHeight * 0.25) }}>📚</div>}
              <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: theme === 'dark' ? '#dfe9f8' : '#003366' }}>{pickML(book.title, lang as LangKey)}</div>
                {pickML(book.author, lang as LangKey) && <div style={{ fontSize: 12, color: theme === 'dark' ? '#9fb3cc' : '#666' }}>{pickML(book.author, lang as LangKey)}</div>}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--navy-light)', color: 'var(--navy)', borderRadius: 6, padding: '2px 7px' }}>{bookKindLabel(book.kind)}</span>
                  {book.pages && <span style={{ fontSize: 10, color: '#aaa' }}>{book.pages} {lang === 'ar' ? 'صفحة' : lang === 'de' ? 'Seiten' : 'pages'}</span>}
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
                        <button onClick={() => setBookPreview(book)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--navy)', color: '#fff', borderRadius: 8, padding: '6px 11px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit', width: '100%', justifyContent: 'center' }}>
                          <i className="fa-solid fa-eye" /> {t.previewBook}
                        </button>
                      )}
                      <a href={waLink} target="_blank" rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#25d366', color: '#fff', borderRadius: 8, padding: '6px 11px', fontSize: 12, fontWeight: 700, textDecoration: 'none', width: '100%', justifyContent: 'center', boxSizing: 'border-box' }}>
                        <i className="fa-brands fa-whatsapp" /> {t.contactToBuy}
                      </a>
                    </>
                  ) : (
                    /* FREE: preview (optional) + direct download */
                    <>
                      {book.previewUrl && (
                        <button onClick={() => setBookPreview(book)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(100,160,255,0.12)', color: theme === 'dark' ? '#7db8ff' : '#003366', borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${theme === 'dark' ? 'rgba(100,160,255,0.3)' : '#c0d4f0'}`, fontFamily: 'inherit', width: '100%', justifyContent: 'center' }}>
                          <i className="fa-solid fa-eye" /> {t.previewBook}
                        </button>
                      )}
                      {book.driveUrl && (
                        <a href={book.driveUrl} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--navy)', color: '#fff', borderRadius: 8, padding: '6px 11px', fontSize: 12, fontWeight: 700, textDecoration: 'none', width: '100%', justifyContent: 'center', boxSizing: 'border-box' }}>
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
                    <div className="books-dynamic-grid" style={{ '--bgs-cols-d': bgs.colsDesktop, '--bgs-cols-m': bgs.colsMobile, '--bgs-gap': `${bgs.gap}px`, '--bgs-pad': `${bgs.paddingMobile}px`, '--bgs-card-w': `${bgs.cardWidth ?? 130}px` } as React.CSSProperties}>
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
            depth === 0 ? { background: 'var(--navy)', color: '#fff', borderRadius: 10, padding: '12px 16px', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', gap: 10 }
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
                <div className="books-dynamic-grid" style={{ '--bgs-cols-d': bgs.colsDesktop, '--bgs-cols-m': bgs.colsMobile, '--bgs-gap': `${bgs.gap}px`, '--bgs-pad': `${bgs.paddingMobile}px`, '--bgs-card-w': `${bgs.cardWidth ?? 130}px` } as React.CSSProperties}>
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
            <button className="btn-back mobile-hidden" onClick={goHome}>
              {t.backHome}{" "}
              <i
                className={`fa-solid ${isRtl ? "fa-arrow-right" : "fa-arrow-left"}`}
              />
            </button>
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

          {/* Mobile: 4 quick-access icon buttons */}
          {(() => {
            const diagIdx    = agriTabs.findIndex(t => t.key === 'diag');
            const soilIdx    = agriTabs.findIndex(t => t.key === 'soilreq');
            const booksIdx   = agriTabs.findIndex(t => t.key === 'books');
            const artIdx     = agriTabs.findIndex(t => t.key === 'articles');
            const ql = lang === 'ar' ? ['فحص النبات','تحليل التربة','المكتبة','المقالات']
                     : lang === 'de' ? ['Pflanzen','Boden','Bücher','Artikel']
                     : ['Plant Check','Soil','Books','Articles'];
            return (
              <div className="agri-mobile-quicktabs">
                {diagIdx >= 0 && (
                  <button className={`agri-mqt-btn${agriTab === diagIdx ? ' active' : ''}`}
                    onClick={() => setAgriTab(diagIdx)}>
                    <i className="fa-solid fa-leaf" /><span>{ql[0]}</span>
                  </button>
                )}
                {soilIdx >= 0 && (
                  <button className={`agri-mqt-btn${agriTab === soilIdx ? ' active' : ''}`}
                    onClick={() => setAgriTab(soilIdx)}>
                    <i className="fa-solid fa-flask" /><span>{ql[1]}</span>
                  </button>
                )}
                {booksIdx >= 0 && (
                  <button className={`agri-mqt-btn${agriTab === booksIdx ? ' active' : ''}`}
                    onClick={() => setAgriTab(booksIdx)}>
                    <i className="fa-solid fa-book-open" /><span>{ql[2]}</span>
                  </button>
                )}
                {artIdx >= 0 && (
                  <button className={`agri-mqt-btn${agriTab === artIdx ? ' active' : ''}`}
                    onClick={() => setAgriTab(artIdx)}>
                    <i className="fa-solid fa-newspaper" /><span>{ql[3]}</span>
                  </button>
                )}
              </div>
            );
          })()}

          {/* AI Plant Diagnostic */}
          {activeKey === 'diag' && (
            <PlantDiagnostic data={data} lang={lang as LangKey} />
          )}

          {/* Request Soil Analysis — contact engineer */}
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
                  <button onClick={() => { setArticlePage(null); setArticleEditMode(false); setArticleEditData(null); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13 }}>
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
                      <img src={articlePage.images[Math.min(articleImgIdx, articlePage.images.length - 1)]} alt="" style={{ width: '100%', maxHeight: 420, objectFit: 'contain', display: 'block' }} />
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
                          <div className="card-grid">
                            {g.items.map(article => (
                              <div key={article.id} className="card glass" style={{ cursor: 'pointer' }} onClick={() => { setArticlePage(article); setArticleImgIdx(0); setArticleEditMode(false); }}>
                                {article.images[0] && (
                                  <div style={{ overflow: 'hidden', position: 'relative' }}>
                                    <img src={article.images[0]} alt={pickML(article.title, lang as LangKey)} className="card-img" />
                                    {article.images.length > 1 && <span style={{ position: 'absolute', top: 8, insetInlineEnd: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 20, padding: '2px 9px', fontSize: 11 }}><i className="fa-solid fa-images" /> {article.images.length}</span>}
                                  </div>
                                )}
                                <div className="card-body">
                                  <span className="card-tag">{article.date}</span>
                                  <div className="card-title">{pickML(article.title, lang as LangKey)}</div>
                                  <p className="card-desc" style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>
                                    {(() => { const t = stripHtml(pickML(article.content, lang as LangKey)); return t.slice(0, 180) + (t.length > 180 ? '…' : ''); })()}
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
                      <div className="books-dynamic-grid" style={{ '--bgs-cols-d': bgs.colsDesktop, '--bgs-cols-m': bgs.colsMobile, '--bgs-gap': `${bgs.gap}px`, '--bgs-pad': `${bgs.paddingMobile}px`, '--bgs-card-w': `${bgs.cardWidth ?? 130}px` } as React.CSSProperties}>
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
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', padding: '7px 14px', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: libView === 'tree' ? 'var(--navy)' : 'transparent', color: libView === 'tree' ? '#fff' : (theme === 'dark' ? '#cdd9ec' : '#003366') }}>
                          <i className="fa-solid fa-folder-tree" /> {lang === 'ar' ? 'شجري' : lang === 'de' ? 'Baum' : 'Tree'}
                        </button>
                        <button onClick={() => setLibView('expanded')} title={lang === 'ar' ? 'عرض كامل' : lang === 'de' ? 'Vollansicht' : 'Full view'}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', cursor: 'pointer', padding: '7px 14px', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: libView === 'expanded' ? 'var(--navy)' : 'transparent', color: libView === 'expanded' ? '#fff' : (theme === 'dark' ? '#cdd9ec' : '#003366') }}>
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
                            <div className="books-dynamic-grid" style={{ '--bgs-cols-d': bgs.colsDesktop, '--bgs-cols-m': bgs.colsMobile, '--bgs-gap': `${bgs.gap}px`, '--bgs-pad': `${bgs.paddingMobile}px`, '--bgs-card-w': `${bgs.cardWidth ?? 130}px` } as React.CSSProperties}>
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
        const selCat = gfxCats.find(c => c.id === gfxSelCatId) || gfxCats[0];
        const selSub = selCat?.subCategories.find(s => s.id === gfxSelSubId);
        const allItems = selSub ? selSub.items : (selCat ? selCat.subCategories.flatMap(s => s.items) : []);
        const searchedItems = gfxSearch.trim()
          ? allItems.filter(it => (pickML(it.title, lang as LangKey) + ' ' + pickML(it.desc, lang as LangKey)).toLowerCase().includes(gfxSearch.toLowerCase()))
          : allItems;

        const renderCard = (item: GfxProjectItem) => (
          <div key={item.id} className="card glass" style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
            onClick={() => { setGfxProjectPage(item); setGfxCarouselIdx(0); setGfxRequestOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <div style={{ overflow: 'hidden', position: 'relative' }}>
              <img src={item.mainImg || ''} alt={pickML(item.title, lang as LangKey)} className="card-img"
                style={{ transition: 'transform 0.35s ease' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.06)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
              {data.watermarkImg && !item.mainImgNoWm && <img src={data.watermarkImg} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: data.watermarkOpacity ?? 0.15, pointerEvents: 'none' }} />}
              {item.cvSettings.isFeatured && <div style={{ position: 'absolute', top: 8, insetInlineStart: 8, background: '#003366', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px' }}>★ {lang === 'ar' ? 'مميز' : 'Featured'}</div>}
              {(item.images.length > 0 || item.videoUrl) && (
                <div style={{ position: 'absolute', bottom: 8, insetInlineEnd: 8, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: 11, borderRadius: 8, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className="fa-solid fa-images" />{item.images.length + 1}
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
          const imgs = [gfxProjectPage.mainImg, ...gfxProjectPage.images].filter(Boolean);
          const totalSlides = imgs.length + (gfxProjectPage.videoUrl ? 1 : 0);
          const isVideo = gfxProjectPage.videoUrl && gfxCarouselIdx >= imgs.length;
          const projectTitle = pickML(gfxProjectPage.title, lang as LangKey) || '';
          const projectDesc = pickML(gfxProjectPage.desc, lang as LangKey) || '';
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
                  <button className="btn-back" onClick={() => { setGfxProjectPage(null); setGfxCarouselIdx(0); setGfxRequestOpen(false); }}>
                    <i className={`fa-solid ${isRtl ? 'fa-arrow-right' : 'fa-arrow-left'}`} style={{ marginInlineEnd: 6 }} />{t.gfxBack}
                  </button>
                  <button className="btn-back" onClick={goHome}>
                    <i className="fa-solid fa-house" style={{ marginInlineEnd: 6 }} />{t.backHome}
                  </button>
                </div>
              </div>

              {/* Glassmorphism Hero Gallery */}
              <div style={{ background: 'linear-gradient(135deg, #070f1e 0%, #0f1e38 50%, #08122a 100%)', borderRadius: 24, padding: 20, marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
                {/* Decorative ambient glows */}
                <div style={{ position: 'absolute', top: -80, insetInlineStart: -60, width: 300, height: 300, background: 'radial-gradient(circle, rgba(68,136,255,0.12) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
                <div style={{ position: 'absolute', bottom: -60, insetInlineEnd: -40, width: 260, height: 260, background: 'radial-gradient(circle, rgba(140,60,255,0.1) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

                {/* Main slide */}
                <div style={{ position: 'relative', zIndex: 1, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', borderRadius: 18, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  {isVideo
                    ? <iframe src={gfxProjectPage.videoUrl.replace('watch?v=', 'embed/')} style={{ width: '100%', height: 440, border: 'none', display: 'block' }} allowFullScreen title="video" />
                    : imgs[gfxCarouselIdx]
                      ? <img src={imgs[gfxCarouselIdx]} alt={projectTitle} style={{ width: '100%', maxHeight: 480, objectFit: 'contain', display: 'block' }} />
                      : <i className="fa-solid fa-image" style={{ fontSize: 48, color: 'rgba(255,255,255,0.2)' }} />
                  }
                  {data.watermarkImg && (() => {
                    const isMainImg = gfxCarouselIdx === 0;
                    const noWm = isMainImg
                      ? !!gfxProjectPage.mainImgNoWm
                      : !!(gfxProjectPage.imagesNoWm?.[gfxCarouselIdx - 1]);
                    return !noWm && !isVideo ? <img src={data.watermarkImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: data.watermarkOpacity ?? 0.15, pointerEvents: 'none' }} /> : null;
                  })()}

                  {/* Prev/Next arrows */}
                  {totalSlides > 1 && (<>
                    <button onClick={() => setGfxCarouselIdx(i => Math.max(0, i - 1))} style={{ position: 'absolute', top: '50%', insetInlineStart: 12, transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '50%', width: 44, height: 44, color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                      <i className={`fa-solid ${isRtl ? 'fa-chevron-right' : 'fa-chevron-left'}`} />
                    </button>
                    <button onClick={() => setGfxCarouselIdx(i => Math.min(totalSlides - 1, i + 1))} style={{ position: 'absolute', top: '50%', insetInlineEnd: 12, transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '50%', width: 44, height: 44, color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
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
                {(imgs.length > 1 || gfxProjectPage.videoUrl) && (
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, position: 'relative', zIndex: 1 }}>
                    {imgs.map((img, i) => (
                      <div key={i} onClick={() => setGfxCarouselIdx(i)}
                        style={{ flexShrink: 0, width: 72, height: 54, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${gfxCarouselIdx === i ? '#4a90e2' : 'rgba(255,255,255,0.12)'}`, transition: 'border-color 0.2s', background: 'rgba(0,0,0,0.4)' }}>
                        <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                    {gfxProjectPage.videoUrl && (
                      <div onClick={() => setGfxCarouselIdx(imgs.length)}
                        style={{ flexShrink: 0, width: 72, height: 54, borderRadius: 10, cursor: 'pointer', border: `2px solid ${gfxCarouselIdx === imgs.length ? '#4a90e2' : 'rgba(255,255,255,0.12)'}`, background: 'rgba(220,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fa-solid fa-play" style={{ color: '#fff', fontSize: 20 }} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Project info */}
              <div style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.04)' : '#fff', border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.09)' : '#e4e9f4'}`, borderRadius: 18, padding: '24px 28px', marginBottom: 16 }}>
                <h1 style={{ margin: '0 0 12px', fontSize: 22, color: theme === 'dark' ? '#dfe9f8' : '#003366', lineHeight: 1.4 }}>{projectTitle}</h1>
                {projectDesc && <p style={{ margin: '0 0 18px', color: theme === 'dark' ? '#b8cce8' : '#4a5870', lineHeight: 1.85, fontSize: 15 }}>{projectDesc}</p>}
                {gfxProjectPage.usedSkillsIds.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 22 }}>
                    {gfxProjectPage.usedSkillsIds.map(id => { const sk = data.skills.find(s => s.id === id); return sk ? <span key={id} className="app-badge">{sk.name}</span> : null; })}
                  </div>
                )}

                {/* GLB 3D Model section */}
                {gfxProjectPage.glbUrl && (
                  <div style={{ marginBottom: 16, padding: '18px 20px', background: theme === 'dark' ? 'rgba(0,180,130,0.08)' : '#f0fff8', borderRadius: 16, border: `1px solid ${theme === 'dark' ? 'rgba(0,200,140,0.22)' : '#a0e0c8'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 26 }}>📦</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: theme === 'dark' ? '#7fddbb' : '#006644' }}>
                          {lang === 'ar' ? 'ملف ثلاثي الأبعاد GLB' : lang === 'de' ? '3D-Modell GLB' : '3D Model GLB'}
                        </div>
                        {gfxProjectPage.glbIsPaid && gfxProjectPage.glbPrice && (
                          <div style={{ fontSize: 13, color: theme === 'dark' ? '#f0d080' : '#996600', fontWeight: 600 }}>
                            {lang === 'ar' ? 'السعر: ' : lang === 'de' ? 'Preis: ' : 'Price: '}
                            {gfxProjectPage.glbPrice} {gfxProjectPage.glbCurrency || 'USD'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <a href={gfxProjectPage.glbUrl} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: theme === 'dark' ? 'rgba(0,180,130,0.25)' : '#006644', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13, border: `1px solid ${theme === 'dark' ? '#00c88c' : 'transparent'}` }}>
                        <i className="fa-solid fa-cube" />
                        {lang === 'ar' ? 'عرض النموذج ثلاثي الأبعاد' : lang === 'de' ? '3D-Modell anzeigen' : 'View 3D Model'}
                      </a>
                      {!gfxProjectPage.glbIsPaid && gfxProjectPage.glbFreeUrl && (
                        <a href={gfxProjectPage.glbFreeUrl} target="_blank" rel="noopener noreferrer" download
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: '#25d366', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                          <i className="fa-solid fa-download" />
                          {lang === 'ar' ? 'تنزيل مجاني' : lang === 'de' ? 'Kostenlos herunterladen' : 'Free Download'}
                        </a>
                      )}
                      {gfxProjectPage.glbIsPaid && (
                        <>
                          {waPhone && (
                            <a href={`https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(lang === 'ar' ? `أريد الحصول على ملف GLB للمشروع: ${projectTitle}` : lang === 'de' ? `Ich möchte die GLB-Datei für das Projekt: ${projectTitle}` : `I want to get the GLB file for the project: ${projectTitle}`)}`}
                              target="_blank" rel="noopener noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: '#25d366', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                              <i className="fa-brands fa-whatsapp" style={{ fontSize: 18 }} />WhatsApp
                            </a>
                          )}
                          {contactEmail && (
                            <a href={`mailto:${contactEmail}?subject=${encodeURIComponent((lang === 'ar' ? 'طلب ملف GLB: ' : lang === 'de' ? 'GLB-Datei anfragen: ' : 'GLB File Request: ') + projectTitle)}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: '#003366', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                              <i className="fa-solid fa-envelope" style={{ fontSize: 15 }} />{lang === 'ar' ? 'إيميل' : lang === 'de' ? 'E-Mail' : 'Email'}
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

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
            </div>
          );
        }

        // ── Gallery Grid ────────────────────────────────────
        return (
          <div className="content-wrap fade-up">
            <div className="section-head">
              <h2 className="section-title">{t.graphicsTitle}</h2>
              <button className="btn-back mobile-hidden" onClick={goHome}>
                {t.backHome} <i className={`fa-solid ${isRtl ? "fa-arrow-right" : "fa-arrow-left"}`} />
              </button>
            </div>

            {/* Category Level 1 tabs — desktop pills / mobile dropdown */}
            <div className="sub-tabs desktop-sub-tabs" style={{ marginBottom: 10 }}>
              {gfxCats.map(cat => (
                <button key={cat.id} className={`tab-btn${selCat?.id === cat.id ? ' active' : ''}`}
                  onClick={() => { setGfxSelCatId(cat.id); setGfxSelSubId(''); setGfxSearch(''); setGfxTab(0); }}>
                  <i className={`fa-solid ${cat.icon || 'fa-folder'}`} style={{ marginInlineEnd: 6 }} />
                  {pickML(cat.name, lang as LangKey)}
                </button>
              ))}
            </div>
            <select
              className="mobile-tab-select"
              value={selCat?.id || (gfxCats[0]?.id || '')}
              onChange={e => {
                const val = e.target.value;
                setGfxSelCatId(val); setGfxSelSubId(''); setGfxSearch(''); setGfxTab(0);
              }}
            >
              {gfxCats.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {pickML(cat.name, lang as LangKey)}
                </option>
              ))}
            </select>

            <>
                {/* Search bar */}
                <div style={{ position: 'relative', marginBottom: 14 }}>
                  <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRtl ? 'right' : 'left']: 13, color: theme === 'dark' ? '#7a9cc8' : '#8899bb', fontSize: 14, pointerEvents: 'none' }} />
                  <input type="text" value={gfxSearch} onChange={e => setGfxSearch(e.target.value)} placeholder={t.gfxSearch}
                    style={{ width: '100%', padding: isRtl ? '10px 42px 10px 14px' : '10px 14px 10px 42px', borderRadius: 10, border: `1.5px solid ${theme === 'dark' ? 'rgba(255,255,255,0.14)' : '#cdd8ee'}`, background: theme === 'dark' ? 'rgba(255,255,255,0.06)' : '#f6f9ff', color: theme === 'dark' ? '#dfe9f8' : '#003366', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  {gfxSearch && <button onClick={() => setGfxSearch('')} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [isRtl ? 'left' : 'right']: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 14 }}><i className="fa-solid fa-xmark" /></button>}
                </div>

                {/* Sub-category chips */}
                {selCat && selCat.subCategories.length > 0 && (
                  <div className="lab-cats" style={{ marginBottom: 18 }}>
                    <button className={`lab-cat-chip${!gfxSelSubId ? ' active' : ''}`} onClick={() => setGfxSelSubId('')}>
                      {lang === 'ar' ? 'الكل' : lang === 'de' ? 'Alle' : 'All'}
                    </button>
                    {selCat.subCategories.map(sub => (
                      <button key={sub.id} className={`lab-cat-chip${gfxSelSubId === sub.id ? ' active' : ''}`}
                        onClick={() => setGfxSelSubId(sub.id)}>
                        {pickML(sub.name, lang as LangKey)} ({sub.items.length})
                      </button>
                    ))}
                  </div>
                )}

                {/* Grouped by sub-category (with elegant navy dividers) when "All" selected and no search */}
                {!gfxSelSubId && !gfxSearch && selCat && selCat.subCategories.length > 1 ? (
                  selCat.subCategories.map(sub => sub.items.length === 0 ? null : (
                    <div key={sub.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '22px 0 16px' }}>
                        <div style={{ height: 2, flex: 1, background: `linear-gradient(${isRtl ? '270deg' : '90deg'}, rgba(0,51,102,0.08), #003366)`, borderRadius: 2 }} />
                        <span style={{ fontWeight: 700, fontSize: 13, color: theme === 'dark' ? '#7ab0e8' : '#003366', whiteSpace: 'nowrap', padding: '4px 14px', borderRadius: 20, background: theme === 'dark' ? 'rgba(0,51,102,0.3)' : 'rgba(0,51,102,0.07)', border: `1px solid ${theme === 'dark' ? 'rgba(68,136,255,0.2)' : 'rgba(0,51,102,0.15)'}` }}>
                          {pickML(sub.name, lang as LangKey)} · {sub.items.length}
                        </span>
                        <div style={{ height: 2, flex: 1, background: `linear-gradient(${isRtl ? '90deg' : '270deg'}, rgba(0,51,102,0.08), #003366)`, borderRadius: 2 }} />
                      </div>
                      <div className="gfx-dyn-grid" style={{ '--gfx-cols-d': data.gfxGridSettings?.colsDesktop ?? DEFAULT_GFX_GRID.colsDesktop, '--gfx-cols-m': data.gfxGridSettings?.colsMobile ?? DEFAULT_GFX_GRID.colsMobile, '--gfx-gap': `${data.gfxGridSettings?.gap ?? DEFAULT_GFX_GRID.gap}px`, '--gfx-img-h': `${data.gfxGridSettings?.imgHeight ?? DEFAULT_GFX_GRID.imgHeight}px`, '--gfx-pad': `${data.gfxGridSettings?.paddingMobile ?? DEFAULT_GFX_GRID.paddingMobile}px`, '--gfx-card-w': `${data.gfxGridSettings?.cardMinWidth ?? DEFAULT_GFX_GRID.cardMinWidth}px` } as React.CSSProperties}>{sub.items.map(renderCard)}</div>
                    </div>
                  ))
                ) : (
                  <div className="gfx-dyn-grid" style={{ '--gfx-cols-d': data.gfxGridSettings?.colsDesktop ?? DEFAULT_GFX_GRID.colsDesktop, '--gfx-cols-m': data.gfxGridSettings?.colsMobile ?? DEFAULT_GFX_GRID.colsMobile, '--gfx-gap': `${data.gfxGridSettings?.gap ?? DEFAULT_GFX_GRID.gap}px`, '--gfx-img-h': `${data.gfxGridSettings?.imgHeight ?? DEFAULT_GFX_GRID.imgHeight}px`, '--gfx-pad': `${data.gfxGridSettings?.paddingMobile ?? DEFAULT_GFX_GRID.paddingMobile}px`, '--gfx-card-w': `${data.gfxGridSettings?.cardMinWidth ?? DEFAULT_GFX_GRID.cardMinWidth}px` } as React.CSSProperties}>
                    {searchedItems.length === 0 ? (
                      <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#999', padding: '40px 0' }}>
                        <i className="fa-solid fa-images" style={{ fontSize: '2.5rem', color: theme === 'dark' ? '#5b9bff' : '#003366', marginBottom: 14, display: 'block' }} />
                        {gfxSearch ? (lang === 'ar' ? 'لا توجد نتائج' : lang === 'de' ? 'Keine Ergebnisse' : 'No results found') : (lang === 'ar' ? 'لا توجد مشاريع بعد' : lang === 'de' ? 'Noch keine Projekte' : 'No projects yet')}
                      </div>
                    ) : searchedItems.map(renderCard)}
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
                    <div className="web-proj-grid" style={{ '--wpg-cols-d': wg.colsDesktop, '--wpg-cols-m': wg.colsMobile, '--wpg-gap': `${wg.gap}px`, '--wpg-min': `${wg.cardMinWidth}px`, '--wpg-pad': `${wg.paddingMobile ?? 8}px`, '--wpg-img-h': `${wg.imgHeight ?? 220}px` } as React.CSSProperties}>
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
                              <img src={proj.mainImg} alt={pickML(proj.title, lang as LangKey)} className="card-thumb-img" style={{ objectFit: 'cover' }} />
                            ) : (
                              <div className="card-thumb-placeholder" style={{ background: 'linear-gradient(135deg,#003366 0%,#1a5276 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <i className="fa-solid fa-globe" style={{ fontSize: 42, color: 'rgba(255,255,255,0.25)' }} />
                              </div>
                            )}
                            <div style={{ padding: '14px 16px' }}>
                              <div style={{ fontWeight: 800, fontSize: 15, color: tc || 'var(--navy)', marginBottom: 6 }}>{pickML(proj.title, lang as LangKey)}</div>
                              <div style={{ fontSize: 12, color: tc ? `${tc}cc` : '#888', marginBottom: 10, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{pickML(proj.desc, lang as LangKey)}</div>
                              {proj.tags.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                                  {proj.tags.slice(0, 4).map((tag, ti) => (
                                    <span key={ti} style={{ fontSize: 10, background: tc ? `${tc}22` : 'rgba(0,51,102,0.09)', color: tc || '#003366', borderRadius: 20, padding: '2px 8px', fontWeight: 700, border: tc ? `1px solid ${tc}44` : 'none' }}>{tag}</span>
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
            <img src={webProjectPage.mainImg} alt={pickML(webProjectPage.title, lang as LangKey)} style={{ width: '100%', maxHeight: 440, objectFit: 'cover', borderRadius: 18, marginBottom: 20, display: 'block' }} />
          )}

          {webProjectPage.images.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              {/* Thumbnails row */}
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 10 }}>
                {webProjectPage.mainImg && (
                  <img src={webProjectPage.mainImg} alt="main" style={{ height: 72, width: 108, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', flexShrink: 0, border: webProjCarouselIdx === -1 ? '3px solid #003366' : '3px solid transparent', transition: 'border 0.2s' }}
                    onClick={() => setWebProjCarouselIdx(-1)} />
                )}
                {webProjectPage.images.map((img, i) => (
                  <img key={i} src={img} alt="" style={{ height: 72, width: 108, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', flexShrink: 0, border: webProjCarouselIdx === i ? '3px solid #003366' : '3px solid transparent', transition: 'border 0.2s' }}
                    onClick={() => setWebProjCarouselIdx(i)} />
                ))}
              </div>
              {/* Main large image */}
              {(() => {
                const src = webProjCarouselIdx === -1 ? webProjectPage.mainImg : webProjectPage.images[webProjCarouselIdx];
                return src ? <img src={src} alt="" style={{ width: '100%', maxHeight: 500, objectFit: 'contain', borderRadius: 16, marginTop: 6, background: 'rgba(0,0,0,0.04)', display: 'block' }} /> : null;
              })()}
            </div>
          )}

          {webProjectPage.videoUrl && (
            <div style={{ marginBottom: 20, borderRadius: 14, overflow: 'hidden', aspectRatio: '16/9' }}>
              <iframe src={webProjectPage.videoUrl} style={{ width: '100%', height: '100%', border: 'none' }} allowFullScreen title="project-video" />
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
            const selectedDoc =
              data.cvDocs.find((d) => d.id === cvDocId) ?? data.cvDocs[0];
            if (!selectedDoc)
              return <p style={{ textAlign: "center", color: "#888" }}>—</p>;
            return (
              <div className="cv-layout">
                {/* Control panel */}
                <div className="cv-panel glass">
                  <h3>{t.cvSmartSettings}</h3>
                  <div className="form-group">
                    <label>{t.cvTypeLabel}</label>
                    <select
                      value={selectedDoc.id}
                      onChange={(e) => setCvDocId(e.target.value)}
                    >
                      {data.cvDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>اللغة / Language</label>
                    <select
                      value={exportLang}
                      onChange={(e) => setExportLang(e.target.value as LangKey)}
                    >
                      <option value="ar">العربية</option>
                      <option value="en">English</option>
                      <option value="de">Deutsch</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>
                      {t.cvWidthLabel}: {cvWidth}mm
                    </label>
                    <input
                      type="range"
                      min={180}
                      max={250}
                      value={cvWidth}
                      onChange={(e) => setCvWidth(Number(e.target.value))}
                    />
                  </div>
                  <button
                    className="btn-prime"
                    onClick={() => exportDoc(selectedDoc, exportLang)}
                  >
                    <i className="fa-solid fa-file-pdf" /> {t.cvExportBtn}
                  </button>
                </div>

                {/* A4 Preview */}
                <div className="cv-scroll-wrap">
                  <div
                    className="a4-page"
                    style={{
                      width: `${cvWidth}mm`,
                      direction: exportLang === "ar" ? "rtl" : "ltr",
                    }}
                  >
                    <CvRenderer
                      doc={selectedDoc}
                      lang={exportLang}
                      name={data.name}
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
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t.adminBioLabel}</label>
                    <textarea
                      rows={3}
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
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
                    <SkillIcon icon={editSkills[0]?.icon || 'fa-star'} size={globalSkillSize} />
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
                    <button className="btn-prime" onClick={saveSkills}>{t.adminSaveSkills}</button>
                  </div>
                </>
              )}

              {adminPanel === 2 && (
                <CvDocEditor
                  data={data}
                  onSave={handleCvSave}
                  onExport={exportDoc}
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

      {/* ── Floating CV Button — admin only ─────────── */}
      {adminLoggedIn && (
        <button className="float-cv-btn glass" onClick={() => openPortal("cv")}>
          <i className="fa-solid fa-print" /> {t.cvFloatBtn}
        </button>
      )}

      {/* ── Hidden render for unified PDF export (any doc, any language) ─── */}
      <div
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        <div
          ref={cvExportRef}
          className="a4-page"
          style={{
            width: "210mm",
            direction: exportLang === "ar" ? "rtl" : "ltr",
          }}
        >
          {exportDocState && (
            <CvRenderer
              doc={exportDocState}
              lang={exportLang}
              name={data.name}
              skills={data.skills}
            />
          )}
        </div>
      </div>


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
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--navy)', color: '#fff', borderRadius: 10, padding: '9px 22px', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
                      <i className="fa-solid fa-download" /> {t.downloadBook}
                    </a>
                  )
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
