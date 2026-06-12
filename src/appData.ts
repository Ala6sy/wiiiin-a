export interface ML { ar: string; en: string; de: string }
export type LangKey = 'ar' | 'en' | 'de';
export const ml = (ar: string, en = '', de = ''): ML => ({ ar, en, de });
export function pickML(m: ML | undefined, lang: LangKey): string {
  if (!m) return '';
  return m[lang] || m.ar || m.en || m.de || '';
}

/* ── Skill ─────────────────────────────────────────────── */
export interface Skill {
  id: string;
  name: string;
  percent: number;
  icon: string;
  size?: number;
}

/* ── Site Settings ─────────────────────────────────────── */
export interface SocialLink { id: string; icon: string; url: string }
export interface NavItem { id: string; label: ML; url: string; parentId: string; order: number }
export interface SiteSettings {
  logoType: 'image' | 'text' | 'svg_alaa';
  logoImg: string;
  logoText: ML;
  logoColor?: string;
  footerBg: string;
  footerText: ML;
  socialLinks: SocialLink[];
  navItems: NavItem[];
  themeMode: 'dark' | 'light';
  accentColor: string;
  glassOpacity: number;
  threeScriptUrl?: string;
}

/* ── Agri content ───────────────────────────────────────── */
export interface AgriCat { title: string; desc: string; img: string }

/* Articles organised by category */
export interface ArticleCategory { id: string; name: ML }
export interface AgriArticle {
  id: string;
  categoryId: string;
  title: ML;
  content: ML;
  images: string[];
  reference: ML;
  date: string;
}

/* Library: nested tree (Main → Sub → Year → Semester → Subject) + books attached to a node */
export interface LibraryNode {
  id: string;
  name: ML;
  children: LibraryNode[];
}
export type BookKind = 'theory' | 'practical' | 'both';
export type LibraryView = 'tree' | 'expanded';
export interface AgriBook {
  id: string;
  nodeId: string;
  title: ML;
  author: ML;
  thumbnail: string;
  driveUrl: string;       // Full download URL (hidden from visitors when isPaid)
  previewUrl?: string;    // Google Drive /preview embed URL (shown to all)
  isPaid?: boolean;       // true = show preview + contact button; false = show download
  price?: string;         // book price value
  currency?: string;      // book currency code (USD, EUR, SYP, AED …)
  pages: string;
  kind: BookKind;
  languages?: LangKey[];
}

export interface BookGridSettings {
  colsMobile: number;
  colsDesktop: number;
  gap: number;          // px between cards
  paddingMobile: number; // px horizontal padding on mobile
  imgHeight: number;    // cover image height in px
  cardWidth: number;    // card min-width in px (controls card width)
}
export const DEFAULT_BOOK_GRID: BookGridSettings = {
  colsMobile: 3,
  colsDesktop: 3,
  gap: 10,
  paddingMobile: 4,
  imgHeight: 120,
  cardWidth: 130,
};

/** Convert a Google Drive sharing URL to a thumbnail URL that works as <img src> */
export function driveThumb(url: string): string {
  if (!url) return url;
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return `https://drive.google.com/thumbnail?id=${m1[1]}&sz=w400`;
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=w400`;
  return url;
}

/* ── Soil analysis & PDF report ─────────────────────────── */
export interface SoilRow { id: string; name: ML | string; ideal: string; actual: string; price: string; tax: string }
/** Backwards-compat helper: SoilRow.name was once plain string, now ML */
export function soilRowName(name: ML | string | undefined, lang: LangKey): string {
  if (!name) return '';
  if (typeof name === 'string') return name;
  return pickML(name as ML, lang);
}
export interface ReportTemplate {
  themeColor: string;
  headerLogo: string;
  headerText: ML;
  footerText: ML;
  engSignature: string;
  engStamp: string;
  paidStamp: string;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  engName: ML;
  engNameColor: string;
  pageBgColor: string;
  stampAlign: 'right' | 'left' | 'center';
}

/* ── Customer soil reports (engineer-managed, exported per language) ── */
export interface CustomerReportRow { id: string; test: ML; actual: ML; ideal: ML }
export type ReportType = 'soil' | 'disease' | 'insect';
export interface CustomerReport {
  id: string;
  reportType: ReportType;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  attendanceDate: string;
  examDate: string;
  images: string[];
  plantName: ML;
  description: ML;
  soilRows: CustomerReportRow[];
  finalReport: ML;
  createdAt: string;
}

/* ── Agri portal: instructional videos & public client reports ── */
export interface AgriVideo { id: string; title: ML; url: string; visible: boolean }
export interface PublicReport { id: string; title: ML; thumbnail: string; url: string; visible: boolean }

/* ── Graphics ───────────────────────────────────────────── */
export interface GfxProjectItem {
  id: string;
  title: ML;
  desc: ML;
  mainImg: string;
  mainImgNoWm?: boolean;
  images: string[];
  imagesNoWm?: boolean[];
  videoUrl: string;
  usedSkillsIds: string[];
  cvSettings: { isFeatured: boolean; imgSize: number; showDesc: boolean; showTools: boolean };
  glbUrl?: string;
  glbIsPaid?: boolean;
  glbPrice?: string;
  glbCurrency?: string;
  glbFreeUrl?: string;
}
export interface GfxSubCategory {
  id: string;
  name: ML;
  items: GfxProjectItem[];
}
export interface GfxCategory {
  id: string;
  name: ML;
  icon: string;
  subCategories: GfxSubCategory[];
}

/* Legacy flat item kept for backward compat */
export interface GfxItem { title: string; cat: string; apps: string[]; img: string }

/* ── AI Vault ────────────────────────────────────────────── */
export interface AiVaultItem {
  id: string;
  title: ML;
  prompt: string;
  img: string;
  categoryId: string;
  subCategoryId: string;
}

/* ── Software Lab ────────────────────────────────────────── */
export interface SoftwareSnippet {
  title: string;
  desc: string;
  codeHtml: string;
  codeCss: string;
  codeJs?: string;
  category?: string;
}

export interface WebProject {
  id: string;
  title: ML;
  desc: ML;
  mainImg: string;
  images: string[];
  videoUrl: string;
  liveUrl: string;
  googlePlayUrl?: string;
  appleStoreUrl?: string;
  githubUrl?: string;
  githubVisible?: boolean;
  tags: string[];
  thumbSize?: number;
  textColor?: string;
}

export interface WebGridSettings {
  colsMobile: number;
  colsDesktop: number;
  gap: number;
  cardMinWidth: number;
  paddingMobile: number;
  imgHeight: number;
}
export const DEFAULT_WEB_GRID: WebGridSettings = {
  colsMobile: 1,
  colsDesktop: 2,
  gap: 20,
  cardMinWidth: 220,
  paddingMobile: 8,
  imgHeight: 220,
};

export interface GfxGridSettings {
  colsMobile: number;
  colsDesktop: number;
  gap: number;
  paddingMobile: number;
  imgHeight: number;
  cardMinWidth: number;
}
export const DEFAULT_GFX_GRID: GfxGridSettings = {
  colsMobile: 1,
  colsDesktop: 3,
  gap: 22,
  paddingMobile: 8,
  imgHeight: 195,
  cardMinWidth: 200,
};
export interface InjectedPage { title: string; html: string; css: string }

/* ── Personal / CV ───────────────────────────────────────── */
export interface PersonalInfo {
  photo: string; phone: string; email: string; location: string;
  website: string; linkedin: string; github: string; twitter: string;
  customSocials: { id: string; label: string; url: string }[];
}
export interface ExpEntry { id: string; fromYear: string; toYear: string; title: string; org: string; desc: string }
export interface EduEntry { id: string; fromYear: string; toYear: string; degree: string; institution: string; desc: string }
export interface CvRef { id: string; name: string; title: string; phone: string; email: string }
export interface PortfolioImg { id: string; img: string; caption: string }
export interface CvProfile {
  subtitle: string; since: number;
  experiences: ExpEntry[]; education: EduEntry[]; labSkills: string[];
  references: CvRef[]; portfolio: PortfolioImg[]; showInAbout: boolean;
}

/* ── CV Section / Doc ───────────────────────────────────── */
export type CvSectionKind = 'header' | 'contact' | 'entries' | 'tags' | 'skillbars' | 'portfolio' | 'text';
export interface CvContactItem { id: string; label: ML; value: string; ltr: boolean }
export interface CvEntryItem { id: string; from: string; to: string; title: ML; org: ML; desc: ML }
export interface CvPortfolioItem {
  id: string;
  img: string;
  caption: ML;
  gfxItemId?: string;
  description?: ML;
  toolIds?: string[];
  showDesc?: boolean;
  showTools?: boolean;
  showQr?: boolean;
  qrUrl?: string;
}
export interface CvSidebarDoc { id: string; title: ML; icon: string; fileUrl: string }
export interface CvQrCredential { id: string; driveUrl: string; caption: ML }

export interface CvSection {
  id: string; kind: CvSectionKind; title: ML;
  column: 'left' | 'right' | 'full'; visible: boolean;
  entries?: CvEntryItem[]; tags?: ML[];
  contactItems?: CvContactItem[]; portfolio?: CvPortfolioItem[];
  text?: ML; useGlobalSkills?: boolean;
  galleryLayout?: 1 | 2 | 3;
  imgHeight?: number;
  pageBreakBefore?: boolean;
}

export interface CvDoc {
  id: string; name: string; removable: boolean;
  accent: string; icon: string; photo: string;
  fullName: ML; subtitle: ML; since: number; showInAbout: boolean;
  sections: CvSection[];
  globalColor?: string;
  footerBgColor?: string;
  footerText?: ML;
  sidebarDocs?: CvSidebarDoc[];
  qrCredentials?: CvQrCredential[];
}

/* ── Custom CV (legacy) ─────────────────────────────────── */
export interface CustomCv { id: string; name: string; template: 'agri' | 'dev'; profile: CvProfile }

/* ── App-wide ────────────────────────────────────────────── */
export interface AppData {
  name: string;
  bio: string;
  skills: Skill[];
  personalInfo: PersonalInfo;
  agriCv: CvProfile;
  devCv: CvProfile;
  agriCats: AgriCat[];
  articleCategories: ArticleCategory[];
  agriArticles: AgriArticle[];
  libraryTree: LibraryNode[];
  libraryView: LibraryView;
  agriBooks: AgriBook[];
  gfxGallery: GfxItem[];
  gfxCategories: GfxCategory[];
  aiVault: AiVaultItem[];
  softwareSnippets: SoftwareSnippet[];
  webProjects: WebProject[];
  webGridSettings: WebGridSettings;
  gfxGridSettings: GfxGridSettings;
  injectedPages: InjectedPage[];
  customCvs: CustomCv[];
  showAgriCv: boolean;
  showDesignerCv: boolean;
  cvDocs: CvDoc[];
  siteSettings: SiteSettings;
  aiDiagnosticsEnabled: boolean;
  soilAnalysis: SoilRow[];
  reportTemplate: ReportTemplate;
  customerReports: CustomerReport[];
  agriVideos: AgriVideo[];
  publicReports: PublicReport[];
  currency: string;
  bookGridSettings: BookGridSettings;
  watermarkImg: string;
  watermarkOpacity: number;
  fileNodes: FileNode[];
}

/* ── File Manager ─────────────────────────────────────────── */
export interface FileNode {
  id: string;
  name: string;
  kind: 'folder' | 'file';
  parentId: string | null;
  url?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt: string;
}

export const DEFAULT_REPORT_TEMPLATE: ReportTemplate = {
  themeColor: '#2a7a2a',
  headerLogo: '',
  headerText: ml('بوابة الهندسة الزراعية', 'Agricultural Engineering Portal', 'Portal für Agrartechnik'),
  footerText: ml('© المهندس علاء أحمد المصري — تقرير رسمي', '© Eng. Alaa Ahmad Almasri — Official Report', '© Ing. Alaa Ahmad Almasri — Offizieller Bericht'),
  engSignature: '',
  engStamp: '',
  paidStamp: '',
  marginTop: 20,
  marginRight: 20,
  marginBottom: 20,
  marginLeft: 20,
  engName: ml('م.علاء أحمد المصري', 'Eng. Alaa Ahmad Almasri', 'Ing. Alaa Ahmad Almasri'),
  engNameColor: '#003366',
  pageBgColor: '#ffffff',
  stampAlign: 'right',
};

/* ═══════════════════════════════════════════════════════════
   DEFAULTS
═══════════════════════════════════════════════════════════ */

export const DEFAULT_PERSONAL_INFO: PersonalInfo = {
  photo: '', phone: '+971 56 153 4995', email: 'ala1990999@gmail.com',
  location: 'الإمارات العربية المتحدة', website: 'eng-alaa.com',
  linkedin: '', github: '', twitter: '', customSocials: [],
};

export const DEFAULT_AGRI_CV: CvProfile = {
  subtitle: 'مهندس زراعي | أخصائي التكنولوجيا الحيوية النباتية',
  since: 2016,
  experiences: [
    { id: 'ae1', fromYear: '2022', toYear: 'present', title: 'مدير العمليات ومصمم واجهات التطبيقات', org: 'بوابات ورلد كلوب الدولية', desc: '' },
    { id: 'ae2', fromYear: '2018', toYear: '2021', title: 'أخصائي تصميم ومطبوعات متميز', org: 'مطبعة التميز، الإمارات', desc: 'تصميم هويات فاخرة، كرتنة الأدوية (LiverRevive)، وتهيئة ملفات CNC.' },
    { id: 'ae3', fromYear: '2018', toYear: 'present', title: 'مطور برمجيات ومهندس تطبيقات الويب والـ CNC', org: 'مستقل', desc: 'بناء وتطوير منصات خدمية وأدوات تتبع مالي وربطها بقواعد البيانات.' },
    { id: 'ae4', fromYear: '2016', toYear: '2020', title: 'باحث في التكنولوجيا الحيوية النباتية', org: 'جامعة تشوكوروفا، تركيا', desc: '' },
  ],
  education: [
    { id: 'edu1', fromYear: '2016', toYear: '2020', degree: 'ماجستير التكنولوجيا الحيوية', institution: 'جامعة تشوكوروفا، تركيا', desc: '' },
    { id: 'edu2', fromYear: '2021', toYear: '2022', degree: 'برنامج نجوم العلوم — الموسمين 13 و 14', institution: 'مؤسسة قطر', desc: '' },
    { id: 'edu3', fromYear: '2016', toYear: '2018', degree: 'الإشراف على زراعة النباتات الطبية والزعفران', institution: 'مشاريع زراعية ريادية — تركيا والإمارات', desc: '' },
  ],
  labSkills: ['زراعة الخلايا النباتية والأنسجة', 'زراعة النباتات الطبية والزعفران', 'تخطيط اللاندسكيب والحدائق ثلاثي الأبعاد'],
  references: [], portfolio: [], showInAbout: true,
};

export const DEFAULT_DEV_CV: CvProfile = {
  subtitle: 'مدير العمليات | مصمم هويات وباني تطبيقات الويب والـ CNC',
  since: 2018,
  experiences: [
    { id: 'de1', fromYear: '2022', toYear: 'present', title: 'مدير العمليات ومصمم واجهات التطبيقات', org: 'بوابات ورلد كلوب الدولية', desc: '' },
    { id: 'de2', fromYear: '2018', toYear: '2021', title: 'أخصائي تصميم ومطبوعات متميز', org: 'مطبعة التميز، الإمارات', desc: 'تصميم هويات فاخرة، كرتنة الأدوية (LiverRevive)، وتهيئة ملفات CNC.' },
    { id: 'de3', fromYear: '2018', toYear: 'present', title: 'تطوير وهندسة برمجيات الويب والتطبيقات', org: 'مستقل', desc: '' },
  ],
  education: [], labSkills: [], references: [], portfolio: [], showInAbout: true,
};

export function uid() { return Math.random().toString(36).slice(2, 9); }

const SECTION_TITLES = {
  contact:    ml('بيانات الاتصال', 'Contact', 'Kontakt'),
  labSkills:  ml('المهارات التقنية المعملية', 'Technical Lab Skills', 'Technische Laborkenntnisse'),
  software:   ml('المهارات البرمجية والتصميمية', 'Software & Design Skills', 'Software- & Design-Kenntnisse'),
  education:  ml('المؤهلات العلمية والمشاريع', 'Education & Projects', 'Ausbildung & Projekte'),
  experience: ml('الخبرات المهنية', 'Professional Experience', 'Berufserfahrung'),
  references: ml('المراجع', 'References', 'Referenzen'),
  portfolio:  ml('معرض الأعمال', 'Portfolio', 'Portfolio'),
  header:     ml('الصورة والعناوين', 'Photo & Titles', 'Foto & Titel'),
};

function contactItemsFromPersonal(pi: PersonalInfo): CvContactItem[] {
  const items: CvContactItem[] = [];
  const add = (label: ML, value: string, ltr = true) => { if (value) items.push({ id: uid(), label, value, ltr }); };
  add(ml('الهاتف', 'Phone', 'Telefon'), pi.phone);
  add(ml('البريد الإلكتروني', 'Email', 'E-Mail'), pi.email);
  add(ml('الموقع', 'Location', 'Standort'), pi.location, false);
  add(ml('الموقع الإلكتروني', 'Website', 'Webseite'), pi.website);
  add(ml('LinkedIn', 'LinkedIn', 'LinkedIn'), pi.linkedin);
  add(ml('GitHub', 'GitHub', 'GitHub'), pi.github);
  add(ml('X / Twitter', 'X / Twitter', 'X / Twitter'), pi.twitter);
  (pi.customSocials || []).forEach(s => add(ml(s.label), s.url));
  return items;
}

interface DocMeta { id: string; name: string; removable: boolean; accent: string; icon: string; fullName: ML; subtitle: ML; includeSkillbars: boolean; includePortfolio: boolean; }
interface DocOverrides { fullName?: ML; subtitle?: ML; showInAbout?: boolean; }

function profileToDoc(profile: CvProfile, pi: PersonalInfo, meta: DocMeta, opts?: DocOverrides): CvDoc {
  const sections: CvSection[] = [];
  sections.push({ id: uid(), kind: 'header', title: SECTION_TITLES.header, column: 'full', visible: true });
  sections.push({ id: uid(), kind: 'contact', title: SECTION_TITLES.contact, column: 'left', visible: true, contactItems: contactItemsFromPersonal(pi) });
  if (meta.includeSkillbars) sections.push({ id: uid(), kind: 'skillbars', title: SECTION_TITLES.software, column: 'left', visible: true, useGlobalSkills: true });
  if ((profile.labSkills || []).length) sections.push({ id: uid(), kind: 'tags', title: SECTION_TITLES.labSkills, column: 'left', visible: true, tags: profile.labSkills.map(s => ml(s)) });
  if ((profile.references || []).length) sections.push({ id: uid(), kind: 'entries', title: SECTION_TITLES.references, column: 'left', visible: true, entries: profile.references.map(r => ({ id: r.id || uid(), from: '', to: '', title: ml(r.name), org: ml(r.title), desc: ml([r.phone, r.email].filter(Boolean).join(' • ')) })) });
  if ((profile.experiences || []).length) sections.push({ id: uid(), kind: 'entries', title: SECTION_TITLES.experience, column: 'right', visible: true, entries: profile.experiences.map(e => ({ id: e.id || uid(), from: e.fromYear, to: e.toYear, title: ml(e.title), org: ml(e.org), desc: ml(e.desc) })) });
  if ((profile.education || []).length) sections.push({ id: uid(), kind: 'entries', title: SECTION_TITLES.education, column: 'right', visible: true, entries: profile.education.map(e => ({ id: e.id || uid(), from: e.fromYear, to: e.toYear, title: ml(e.degree), org: ml(e.institution), desc: ml(e.desc) })) });
  if (meta.includePortfolio) sections.push({ id: uid(), kind: 'portfolio', title: SECTION_TITLES.portfolio, column: 'full', visible: true, portfolio: (profile.portfolio || []).map(p => ({ id: p.id || uid(), img: p.img, caption: ml(p.caption) })) });
  return {
    id: meta.id, name: meta.name, removable: meta.removable, accent: meta.accent, icon: meta.icon,
    photo: pi.photo, fullName: opts?.fullName ?? meta.fullName, subtitle: opts?.subtitle ?? meta.subtitle,
    since: profile.since, showInAbout: opts?.showInAbout ?? profile.showInAbout, sections,
    globalColor: meta.accent, footerBgColor: '#003366', footerText: ml('eng-alaa.com', 'eng-alaa.com', 'eng-alaa.com'),
    sidebarDocs: [], qrCredentials: [],
  };
}

const AGRI_META: DocMeta = {
  id: 'agri', name: 'سيرة الزراعة', removable: false, accent: '#2a7a2a', icon: 'fa-seedling',
  fullName: ml('المهندس علاء أحمد المصري', 'Eng. Alaa Ahmad Almasri', 'Ing. Alaa Ahmad Almasri'),
  subtitle: ml('مهندس زراعي | أخصائي التكنولوجيا الحيوية النباتية', 'Agricultural Engineer | Plant Biotechnology Specialist', 'Agraringenieur | Spezialist für pflanzliche Biotechnologie'),
  includeSkillbars: false, includePortfolio: false,
};
const DEV_META: DocMeta = {
  id: 'dev', name: 'سيرة التصاميم', removable: false, accent: '#003366', icon: 'fa-bezier-curve',
  fullName: ml('المهندس علاء أحمد المصري', 'Eng. Alaa Ahmad Almasri', 'Ing. Alaa Ahmad Almasri'),
  subtitle: ml('مدير العمليات | مصمم هويات وباني تطبيقات الويب والـ CNC', 'Operations Manager | Identity Designer & Web/CNC App Builder', 'Operations Manager | Identitätsdesigner & Web/CNC-App-Entwickler'),
  includeSkillbars: true, includePortfolio: true,
};

const DEFAULT_CV_DOCS: CvDoc[] = [
  profileToDoc(DEFAULT_AGRI_CV, DEFAULT_PERSONAL_INFO, AGRI_META),
  profileToDoc(DEFAULT_DEV_CV, DEFAULT_PERSONAL_INFO, DEV_META),
];

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  logoType: 'svg_alaa',
  logoImg: '',
  logoText: ml('م.علاء أحمد المصري', 'Eng. Alaa Ahmad Almasri', 'Ing. Alaa Ahmad Almasri'),
  logoColor: '',
  footerBg: '#003366',
  footerText: ml('© المهندس علاء أحمد المصري — جميع الحقوق محفوظة', '© Eng. Alaa Ahmad Almasri — All Rights Reserved', '© Ing. Alaa Ahmad Almasri — Alle Rechte vorbehalten'),
  socialLinks: [
    { id: 's1', icon: 'fa-solid fa-phone', url: 'tel:+971561534995' },
    { id: 's2', icon: 'fa-solid fa-envelope', url: 'mailto:ala1990999@gmail.com' },
    { id: 's3', icon: 'fa-brands fa-linkedin-in', url: 'https://www.linkedin.com/in/alaa-almasri' },
    { id: 's4', icon: 'fa-brands fa-behance', url: 'https://www.behance.net/ala999777' },
  ],
  navItems: [
    { id: 'n1', label: ml('السيرة الذاتية', 'Resume / CV', 'Lebenslauf'), url: '#cv', parentId: '', order: 1 },
    { id: 'n2', label: ml('الزراعة', 'Agriculture', 'Landwirtschaft'), url: '#agri', parentId: '', order: 2 },
    { id: 'n3', label: ml('التصاميم', 'Design', 'Design'), url: '#graphics', parentId: '', order: 3 },
    { id: 'n4', label: ml('البرمجة', 'Software', 'Software'), url: '#software', parentId: '', order: 4 },
  ],
  themeMode: 'dark',
  accentColor: '#003366',
  glassOpacity: 0.5,
  threeScriptUrl: '',
};

const DEFAULT_DATA: AppData = {
  name: 'المهندس علاء أحمد المصري',
  bio: 'مهندس زراعي متخصص في البيوتكنولوجي، ومصمّر متعدد المجالات، ومطور برمجيات. أجمع بين دقة العلوم وهندسة التصميم وذكاء الأكواد لبناء حلول ابتكارية رائدة.',
  skills: [
    { id: 'ps',   name: 'Photoshop',      percent: 95, icon: 'fa-images',            size: 26 },
    { id: 'ai',   name: 'Illustrator',    percent: 92, icon: 'fa-vector-square',      size: 26 },
    { id: 'id',   name: 'InDesign',       percent: 85, icon: 'fa-book-open',          size: 26 },
    { id: 'xd',   name: 'Adobe XD',       percent: 88, icon: 'fa-mobile-screen',      size: 26 },
    { id: 'ae',   name: 'After Effects',  percent: 80, icon: 'fa-film',               size: 26 },
    { id: 'c4d',  name: 'Cinema 4D',      percent: 78, icon: 'fa-cube',               size: 26 },
    { id: 'cad',  name: 'AutoCAD',        percent: 85, icon: 'fa-compass-drafting',   size: 26 },
    { id: 'cura', name: 'UltiMaker Cura', percent: 90, icon: 'fa-print',              size: 26 },
  ],
  personalInfo: DEFAULT_PERSONAL_INFO,
  agriCv: DEFAULT_AGRI_CV,
  devCv: DEFAULT_DEV_CV,
  agriCats: [
    { title: 'بيوتكنولوجي وزراعة الأنسجة', desc: 'أبحاث زراعة الخلايا النباتية المستنسخة والتحضين المعملي المتطور.', img: 'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?auto=format&fit=crop&w=400&q=80' },
    { title: 'تصاميم لاندسكيب (2D & 3D)', desc: 'مخططات الحدائق وتوزيع النباتات بدقة هندسية متكاملة.', img: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=400&q=80' },
    { title: 'استشارات زراعية ونباتات طبية', desc: 'الإشراف العلمي على زراعة نباتات الأدوية مثل Milk Thistle والزعفران.', img: 'https://images.unsplash.com/photo-1515150144380-bca9f1650ed9?auto=format&fit=crop&w=400&q=80' },
  ],
  articleCategories: [],
  agriArticles: [],
  libraryTree: [],
  libraryView: 'tree',
  agriBooks: [],
  gfxGallery: [
    { title: 'علب كرتون دواء LiverRevive الفاخر', cat: 'medical', apps: ['Photoshop', 'Illustrator'], img: 'https://images.unsplash.com/photo-1626446811236-7a6f23343130?auto=format&fit=crop&w=500&q=80' },
    { title: 'مطبوعات وهويات جامعة أم القيوين الرسمية', cat: 'prints', apps: ['Illustrator', 'InDesign'], img: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=500&q=80' },
    { title: 'لوحات إعلانية طرقية ضخمة وبانيرات شاشات LED', cat: 'billboards', apps: ['Photoshop'], img: 'https://images.unsplash.com/photo-1542744094-3a31f103e35f?auto=format&fit=crop&w=500&q=80' },
    { title: 'مخططات تقطيع دروع ومجسمات ماكينات CNC ليزر', cat: 'cnc', apps: ['AutoCAD', 'UltiMaker Cura'], img: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=500&q=80' },
  ],
  gfxCategories: [
    {
      id: 'cat1', name: ml('الهوية والمطبوعات', 'Identity & Print', 'Identität & Druck'), icon: 'fa-palette',
      subCategories: [
        {
          id: 'sub1', name: ml('هويات بصرية', 'Visual Identities', 'Visuelle Identitäten'),
          items: [
            { id: 'p1', title: ml('هوية LiverRevive الدوائية', 'LiverRevive Pharma Identity', 'LiverRevive Pharma-Identität'), desc: ml('تصميم هوية فاخرة شاملة لمنتج دوائي', 'Complete luxury identity for pharmaceutical product', 'Vollständige Luxusidentität für pharmazeutisches Produkt'), mainImg: 'https://images.unsplash.com/photo-1626446811236-7a6f23343130?auto=format&fit=crop&w=500&q=80', images: [], videoUrl: '', usedSkillsIds: ['ps', 'ai'], cvSettings: { isFeatured: true, imgSize: 100, showDesc: true, showTools: true } },
          ],
        },
      ],
    },
    {
      id: 'cat2', name: ml('CNC والتصنيع', 'CNC & Manufacturing', 'CNC & Fertigung'), icon: 'fa-compass-drafting',
      subCategories: [
        {
          id: 'sub2', name: ml('ماكينات ليزر', 'Laser Machines', 'Lasermaschinen'),
          items: [
            { id: 'p2', title: ml('مخططات تقطيع CNC', 'CNC Cutting Plans', 'CNC-Schneidpläne'), desc: ml('مخططات ماكينات الليزر والـ CNC', 'Laser and CNC machine plans', 'Laser- und CNC-Maschinenpläne'), mainImg: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=500&q=80', images: [], videoUrl: '', usedSkillsIds: ['cad', 'cura'], cvSettings: { isFeatured: false, imgSize: 100, showDesc: true, showTools: true } },
          ],
        },
      ],
    },
  ],
  aiVault: [
    { id: 'av1', title: ml('حقل نباتي مستقبلي', 'Futuristic Plant Field', 'Futuristisches Pflanzenfeld'), prompt: 'A futuristic hyper-realistic agricultural laboratory with neon UV glowing plants, organic cell incubation matrix, cinematic low-key studio lighting, 8k resolution, volumetric light paths --v 6.0', img: 'https://images.unsplash.com/photo-1507584947236-ec03c99a3c3d?auto=format&fit=crop&w=500&q=80', categoryId: '', subCategoryId: '' },
    { id: 'av2', title: ml('هوية فاخرة لعلاج طبي', 'Premium Medical Identity', 'Premium-Medizinische Identität'), prompt: 'Ultra-premium pharmaceutical product packaging design, deep navy blue and gold accents, clean white surfaces, herbal botanical elements, studio product photography, 8K sharp --v 6.0', img: 'https://images.unsplash.com/photo-1626446811236-7a6f23343130?auto=format&fit=crop&w=500&q=80', categoryId: '', subCategoryId: '' },
  ],
  softwareSnippets: [
    { title: "واجهة تطبيق 'صندوق العائلة المالي'", desc: 'محرر إدارة الميزانية وحساب الذهب والديون التفاعلي', category: 'تطبيقات مالية', codeHtml: `<div class="fin-box">\n  <h3>محاكي العائلة المالي الذكي</h3>\n  <p>معدل أسعار الذهب الحالية متصلة لايف</p>\n  <div class="fin-row">\n    <div class="fin-card">الذهب: <b>308 ر.س/غم</b></div>\n    <div class="fin-card">الرصيد: <b>+12,450 ر.س</b></div>\n  </div>\n  <button class="fin-btn" onclick="alert('تم التحديث!')">تحديث الأسعار</button>\n</div>`, codeCss: `body { font-family: Tajawal, sans-serif; direction: rtl; background: #f0f5ff; }\n.fin-box { padding: 24px; background: #003366; color: #fff; border-radius: 14px; text-align: center; max-width: 400px; margin: auto; }\n.fin-box h3 { font-size: 20px; margin-bottom: 8px; }\n.fin-box p { font-size: 14px; opacity: 0.8; margin-bottom: 16px; }\n.fin-row { display: flex; gap: 10px; justify-content: center; margin-bottom: 16px; }\n.fin-card { background: rgba(255,255,255,0.15); padding: 10px 18px; border-radius: 8px; font-size: 13px; }\n.fin-btn { background: #fff; color: #003366; border: none; padding: 10px 24px; border-radius: 20px; font-weight: 700; font-size: 13px; cursor: pointer; }` },
    { title: 'نظام إشعارات السيارات التفاعلي Q-Murur', desc: 'نظام إرسال الرسائل الفورية وتنبيه أصحاب المركبات', category: 'أنظمة ذكية', codeHtml: `<div class="qr-box">\n  <div class="qr-icon">🚗</div>\n  <h4>نظام QR-Murur الآمن</h4>\n  <p>اضغط لمسح الباركود والتنبيه الفوري</p>\n  <button class="qr-btn" onclick="this.textContent='✓ تم الإرسال!'; this.style.background='#28a745'">مسح الرمز الآن</button>\n</div>`, codeCss: `body { font-family: Tajawal, sans-serif; direction: rtl; background: #fff; }\n.qr-box { padding: 28px; border: 2px dashed #003366; text-align: center; border-radius: 14px; background: #f0f5ff; max-width: 360px; margin: auto; }\n.qr-icon { font-size: 40px; margin-bottom: 12px; }\n.qr-box h4 { color: #003366; font-size: 18px; margin-bottom: 8px; }\n.qr-box p { font-size: 13px; color: #556; margin-bottom: 16px; }\n.qr-btn { background: #003366; color: #fff; border: none; padding: 10px 28px; border-radius: 20px; font-size: 13px; cursor: pointer; font-family: Tajawal, sans-serif; transition: background 0.3s; }` },
  ],
  webProjects: [],
  webGridSettings: DEFAULT_WEB_GRID,
  gfxGridSettings: DEFAULT_GFX_GRID,
  injectedPages: [],
  customCvs: [],
  showAgriCv: true,
  showDesignerCv: true,
  cvDocs: DEFAULT_CV_DOCS,
  siteSettings: DEFAULT_SITE_SETTINGS,
  aiDiagnosticsEnabled: true,
  soilAnalysis: [],
  reportTemplate: DEFAULT_REPORT_TEMPLATE,
  customerReports: [],
  agriVideos: [],
  publicReports: [],
  currency: '',
  watermarkImg: '',
  watermarkOpacity: 0.15,
  fileNodes: [],
};

/* ═══════════════════════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'alaa_portfolio_state';
export const ADMIN_EMAIL = 'ala1990999@gmail.com';
export const ADMIN_PASS = '@@@123@@@';
export const LANG_PREF_KEY = 'alaa_lang';

function arr<T>(v: unknown, fallback: T[]): T[] { return Array.isArray(v) ? (v as T[]) : fallback; }

function normML(v: unknown): ML {
  if (typeof v === 'string') return ml(v);
  if (v && typeof v === 'object') { const o = v as Partial<ML>; return { ar: o.ar || '', en: o.en || '', de: o.de || '' }; }
  return ml('');
}

function normSection(s: unknown): CvSection | null {
  if (!s || typeof s !== 'object') return null;
  const o = s as Partial<CvSection> & Record<string, unknown>;
  const kinds: CvSectionKind[] = ['header','contact','entries','tags','skillbars','portfolio','text'];
  const kind = kinds.includes(o.kind as CvSectionKind) ? (o.kind as CvSectionKind) : 'text';
  const column = o.column === 'right' || o.column === 'full' ? o.column : 'left';
  return {
    id: (o.id as string) || uid(), kind, title: normML(o.title), column, visible: o.visible !== false,
    entries: arr<unknown>(o.entries, []).map(e => { const x = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>; return { id: (x.id as string) || uid(), from: (x.from as string) || '', to: (x.to as string) || '', title: normML(x.title), org: normML(x.org), desc: normML(x.desc) }; }),
    tags: arr<unknown>(o.tags, []).map(normML),
    contactItems: arr<unknown>(o.contactItems, []).map(c => { const x = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>; return { id: (x.id as string) || uid(), label: normML(x.label), value: (x.value as string) || '', ltr: x.ltr !== false }; }),
    portfolio: arr<unknown>(o.portfolio, []).map(p => { const x = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>; return { id: (x.id as string) || uid(), img: (x.img as string) || '', caption: normML(x.caption) }; }),
    text: normML(o.text), useGlobalSkills: o.useGlobalSkills === true,
  };
}

function normDoc(d: unknown, fallback?: CvDoc): CvDoc | null {
  if (!d || typeof d !== 'object') return fallback ?? null;
  const o = d as Partial<CvDoc> & Record<string, unknown>;
  const sections = arr<unknown>(o.sections, []).map(normSection).filter((x): x is CvSection => !!x);
  const sidebarDocs = arr<unknown>(o.sidebarDocs, []).map((x: unknown) => {
    const s = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    return { id: (s.id as string) || uid(), title: normML(s.title), icon: (s.icon as string) || 'fa-file', fileUrl: (s.fileUrl as string) || '' };
  });
  const qrCredentials = arr<unknown>(o.qrCredentials, []).map((x: unknown) => {
    const q = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    return { id: (q.id as string) || uid(), driveUrl: (q.driveUrl as string) || '', caption: normML(q.caption) };
  });
  return {
    id: (o.id as string) || uid(), name: (o.name as string) || (fallback?.name ?? 'CV'),
    removable: o.removable !== undefined ? !!o.removable : (fallback?.removable ?? true),
    accent: (o.accent as string) || (fallback?.accent ?? '#003366'),
    icon: (o.icon as string) || (fallback?.icon ?? 'fa-file-lines'),
    photo: (o.photo as string) ?? (fallback?.photo ?? ''),
    fullName: normML(o.fullName), subtitle: normML(o.subtitle),
    since: typeof o.since === 'number' ? o.since : (fallback?.since ?? 2016),
    showInAbout: o.showInAbout !== undefined ? !!o.showInAbout : (fallback?.showInAbout ?? false),
    sections,
    globalColor: (o.globalColor as string) || fallback?.globalColor || (o.accent as string) || '#003366',
    footerBgColor: (o.footerBgColor as string) || fallback?.footerBgColor || '#003366',
    footerText: normML(o.footerText || fallback?.footerText || ml('eng-alaa.com', 'eng-alaa.com', 'eng-alaa.com')),
    sidebarDocs, qrCredentials,
  };
}

function normSiteSettings(s: unknown): SiteSettings {
  if (!s || typeof s !== 'object') return DEFAULT_SITE_SETTINGS;
  const o = s as Partial<SiteSettings> & Record<string, unknown>;
  const lt = o.logoType;
  return {
    logoType: (lt === 'image' ? 'image' : lt === 'svg_alaa' ? 'svg_alaa' : 'text'),
    logoImg: (o.logoImg as string) || '',
    logoText: normML(o.logoText || DEFAULT_SITE_SETTINGS.logoText),
    logoColor: typeof o.logoColor === 'string' ? o.logoColor : '',
    footerBg: (o.footerBg as string) || '#003366',
    footerText: normML(o.footerText || DEFAULT_SITE_SETTINGS.footerText),
    socialLinks: arr<SocialLink>(o.socialLinks, DEFAULT_SITE_SETTINGS.socialLinks),
    navItems: arr<NavItem>(o.navItems, DEFAULT_SITE_SETTINGS.navItems),
    themeMode: (o.themeMode === 'light' ? 'light' : 'dark'),
    accentColor: typeof o.accentColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(o.accentColor.trim()) ? o.accentColor.trim() : DEFAULT_SITE_SETTINGS.accentColor,
    glassOpacity: typeof o.glassOpacity === 'number' && isFinite(o.glassOpacity) ? Math.min(0.95, Math.max(0.05, o.glassOpacity)) : DEFAULT_SITE_SETTINGS.glassOpacity,
    threeScriptUrl: typeof o.threeScriptUrl === 'string' ? o.threeScriptUrl : '',
  };
}

function normReportTemplate(t: unknown, legacyStamps?: unknown): ReportTemplate {
  const o = (t && typeof t === 'object' ? t : {}) as Partial<ReportTemplate> & Record<string, unknown>;
  let engSignature = (o.engSignature as string) || '';
  let engStamp = (o.engStamp as string) || '';
  /* migrate signature/stamp images from the legacy draggable-stamps model */
  if ((!engSignature || !engStamp) && Array.isArray(legacyStamps)) {
    const findImg = (id: string) => {
      const s = (legacyStamps as unknown[]).find(x => x && typeof x === 'object' && (x as Record<string, unknown>).id === id) as Record<string, unknown> | undefined;
      return s && typeof s.img === 'string' ? s.img : '';
    };
    if (!engSignature) engSignature = findImg('alaaSig');
    if (!engStamp) engStamp = findImg('engStamp');
  }
  let paidStamp = (o.paidStamp as string) || '';
  if (!paidStamp && Array.isArray(legacyStamps)) {
    const s = (legacyStamps as unknown[]).find(x => x && typeof x === 'object' && (x as Record<string, unknown>).id === 'paidStamp') as Record<string, unknown> | undefined;
    if (s && typeof s.img === 'string') paidStamp = s.img;
  }
  const clampMargin = (v: unknown, def: number) => {
    const n = typeof v === 'number' ? v : parseFloat(v as string);
    return isNaN(n) ? def : Math.max(5, Math.min(50, n));
  };
  const validAlign = (v: unknown): 'right' | 'left' | 'center' =>
    v === 'left' || v === 'center' ? v : 'right';
  return {
    themeColor: (o.themeColor as string) || DEFAULT_REPORT_TEMPLATE.themeColor,
    headerLogo: (o.headerLogo as string) || '',
    headerText: normML(o.headerText || DEFAULT_REPORT_TEMPLATE.headerText),
    footerText: normML(o.footerText || DEFAULT_REPORT_TEMPLATE.footerText),
    engSignature,
    engStamp,
    paidStamp,
    marginTop:    clampMargin(o.marginTop,    20),
    marginRight:  clampMargin(o.marginRight,  20),
    marginBottom: clampMargin(o.marginBottom, 20),
    marginLeft:   clampMargin(o.marginLeft,   20),
    engName:      normML(o.engName || DEFAULT_REPORT_TEMPLATE.engName),
    engNameColor: (o.engNameColor as string) || '#003366',
    pageBgColor:  (o.pageBgColor  as string) || '#ffffff',
    stampAlign:   validAlign(o.stampAlign),
  };
}

function normAgriVideos(s: unknown): AgriVideo[] {
  return arr<unknown>(s, []).map(v => {
    const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    return {
      id: (o.id as string) || uid(),
      title: normML(o.title),
      url: (o.url as string) || '',
      visible: o.visible !== false,
    };
  });
}

function normPublicReports(s: unknown): PublicReport[] {
  return arr<unknown>(s, []).map(r => {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    return {
      id: (o.id as string) || uid(),
      title: normML(o.title),
      thumbnail: (o.thumbnail as string) || '',
      url: (o.url as string) || '',
      visible: o.visible !== false,
    };
  });
}

function normCustomerReports(s: unknown): CustomerReport[] {
  return arr<unknown>(s, []).map(r => {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    return {
      id: (o.id as string) || uid(),
      reportType: (['soil', 'disease', 'insect'].includes(o.reportType as string) ? o.reportType : 'soil') as ReportType,
      customerName: (o.customerName as string) || '',
      customerPhone: (o.customerPhone as string) || '',
      customerLocation: (o.customerLocation as string) || '',
      attendanceDate: (o.attendanceDate as string) || '',
      examDate: (o.examDate as string) || '',
      images: arr<unknown>(o.images, []).filter((x): x is string => typeof x === 'string'),
      plantName: normML(o.plantName),
      description: normML(o.description),
      soilRows: arr<unknown>(o.soilRows, []).map(rr => {
        const x = (rr && typeof rr === 'object' ? rr : {}) as Record<string, unknown>;
        return { id: (x.id as string) || uid(), test: normML(x.test), actual: normML(x.actual), ideal: normML(x.ideal) };
      }),
      finalReport: normML(o.finalReport),
      createdAt: (o.createdAt as string) || new Date().toISOString(),
    };
  });
}

function normArticleCategories(s: unknown): ArticleCategory[] {
  return arr<unknown>(s, []).map(c => {
    const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    return { id: (o.id as string) || uid(), name: normML(o.name) };
  });
}

function normArticles(s: unknown): AgriArticle[] {
  return arr<unknown>(s, []).map(a => {
    const o = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
    /* migrate legacy single `img` → images[] */
    let images = arr<unknown>(o.images, []).filter((x): x is string => typeof x === 'string');
    if (!images.length && typeof o.img === 'string' && o.img) images = [o.img];
    return {
      id: (o.id as string) || uid(),
      categoryId: (o.categoryId as string) || '',
      title: normML(o.title),
      content: normML(o.content),
      images,
      reference: normML(o.reference),
      date: (o.date as string) || '',
    };
  });
}

function normLibraryTree(s: unknown): LibraryNode[] {
  return arr<unknown>(s, []).map(n => {
    const o = (n && typeof n === 'object' ? n : {}) as Record<string, unknown>;
    return {
      id: (o.id as string) || uid(),
      name: normML(o.name),
      children: normLibraryTree(o.children),
    };
  });
}

function normBooks(s: unknown): AgriBook[] {
  return arr<unknown>(s, []).map(b => {
    const o = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>;
    const kind = (['theory', 'practical', 'both'].includes(o.kind as string) ? o.kind : 'both') as BookKind;
    const rawLangs = Array.isArray(o.languages) ? (o.languages as string[]).filter((l): l is LangKey => ['ar', 'en', 'de'].includes(l)) : undefined;
    return {
      id: (o.id as string) || uid(),
      nodeId: (o.nodeId as string) || '',
      title: normML(o.title),
      author: normML(o.author),
      thumbnail: (o.thumbnail as string) || '',
      driveUrl: (o.driveUrl as string) || '',
      previewUrl: (o.previewUrl as string) || '',
      isPaid: !!(o.isPaid),
      price: (o.price as string) || '',
      currency: (o.currency as string) || '',
      pages: (o.pages as string) || '',
      kind,
      languages: rawLangs,
    };
  });
}

function normSoil(s: unknown): SoilRow[] {
  return arr<unknown>(s, []).map(r => {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    return {
      id: (o.id as string) || uid(),
      name: (o.name as string) || '',
      ideal: (o.ideal as string) || '',
      actual: (o.actual as string) || '',
      price: (o.price as string) || '',
      tax: (o.tax as string) || '',
    };
  });
}

function normalizeProfile(p: unknown, fallback: CvProfile): CvProfile {
  const src = (p && typeof p === 'object') ? (p as Partial<CvProfile>) : {};
  return { ...fallback, ...src, experiences: arr(src.experiences, fallback.experiences), education: arr(src.education, fallback.education), references: arr(src.references, fallback.references), portfolio: arr(src.portfolio, fallback.portfolio), labSkills: arr(src.labSkills, fallback.labSkills) };
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const src = JSON.parse(raw) as Partial<AppData> & Record<string, unknown>;

    const defaultDocs = DEFAULT_CV_DOCS;
    const rawDocs = arr<unknown>(src.cvDocs, []);
    const cvDocs: CvDoc[] = rawDocs.length
      ? rawDocs.map((d, i) => normDoc(d, defaultDocs[i]) ?? defaultDocs[0]).filter(Boolean)
      : defaultDocs;
    if (!cvDocs.find(d => d.id === 'agri')) cvDocs.unshift(defaultDocs[0]);
    if (!cvDocs.find(d => d.id === 'dev')) cvDocs.splice(1, 0, defaultDocs[1]);

    const skills = arr<Skill>(src.skills, DEFAULT_DATA.skills).map(s => ({ ...s, size: s.size ?? 26 }));

    const normAiVault = arr<unknown>(src.aiVault, []).map((v: unknown) => {
      if (!v || typeof v !== 'object') return null;
      const o = v as Record<string, unknown>;
      if ('title' in o && typeof o.title === 'string') {
        return { id: uid(), title: ml(o.title as string), prompt: (o.prompt as string) || '', img: (o.img as string) || '', categoryId: '', subCategoryId: '' } as AiVaultItem;
      }
      return v as AiVaultItem;
    }).filter(Boolean) as AiVaultItem[];

    const normGfxCats = arr<GfxCategory>(src.gfxCategories, DEFAULT_DATA.gfxCategories);

    return {
      name: (src.name as string) || DEFAULT_DATA.name,
      bio: (src.bio as string) || DEFAULT_DATA.bio,
      skills,
      personalInfo: { ...DEFAULT_PERSONAL_INFO, ...(src.personalInfo as object || {}) },
      agriCv: normalizeProfile(src.agriCv, DEFAULT_AGRI_CV),
      devCv: normalizeProfile(src.devCv, DEFAULT_DEV_CV),
      agriCats: arr(src.agriCats, DEFAULT_DATA.agriCats),
      articleCategories: normArticleCategories(src.articleCategories),
      agriArticles: normArticles(src.agriArticles),
      libraryTree: normLibraryTree(src.libraryTree),
      libraryView: src.libraryView === 'expanded' ? 'expanded' : 'tree',
      agriBooks: normBooks(src.agriBooks),
      gfxGallery: arr(src.gfxGallery, DEFAULT_DATA.gfxGallery),
      gfxCategories: normGfxCats,
      aiVault: normAiVault.length ? normAiVault : DEFAULT_DATA.aiVault,
      softwareSnippets: arr(src.softwareSnippets, DEFAULT_DATA.softwareSnippets),
      webProjects: arr(src.webProjects, DEFAULT_DATA.webProjects).map((p: unknown) => {
        const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
        return {
          id: (o.id as string) || uid(),
          title: normML(o.title),
          desc: normML(o.desc),
          mainImg: (o.mainImg as string) || '',
          images: arr<string>(o.images, []),
          videoUrl: (o.videoUrl as string) || '',
          liveUrl: (o.liveUrl as string) || '',
          githubUrl: (o.githubUrl as string) || '',
          githubVisible: o.githubVisible !== false,
          tags: arr<string>(o.tags, []),
          thumbSize: typeof o.thumbSize === 'number' ? o.thumbSize : 220,
          googlePlayUrl: (o.googlePlayUrl as string) || '',
          appleStoreUrl: (o.appleStoreUrl as string) || '',
          textColor: (o.textColor as string) || '',
        } as WebProject;
      }),
      webGridSettings: { ...DEFAULT_WEB_GRID, ...(src.webGridSettings && typeof src.webGridSettings === 'object' ? src.webGridSettings as Partial<WebGridSettings> : {}) },
      gfxGridSettings: { ...DEFAULT_GFX_GRID, ...(src.gfxGridSettings && typeof src.gfxGridSettings === 'object' ? src.gfxGridSettings as Partial<GfxGridSettings> : {}), paddingMobile: typeof (src.gfxGridSettings as any)?.paddingMobile === 'number' ? (src.gfxGridSettings as any).paddingMobile : DEFAULT_GFX_GRID.paddingMobile, imgHeight: typeof (src.gfxGridSettings as any)?.imgHeight === 'number' ? (src.gfxGridSettings as any).imgHeight : DEFAULT_GFX_GRID.imgHeight, cardMinWidth: typeof (src.gfxGridSettings as any)?.cardMinWidth === 'number' ? (src.gfxGridSettings as any).cardMinWidth : DEFAULT_GFX_GRID.cardMinWidth },
      injectedPages: arr(src.injectedPages, []),
      customCvs: arr(src.customCvs, []),
      showAgriCv: src.showAgriCv !== false,
      showDesignerCv: src.showDesignerCv !== false,
      cvDocs,
      siteSettings: normSiteSettings(src.siteSettings),
      aiDiagnosticsEnabled: src.aiDiagnosticsEnabled !== false,
      soilAnalysis: normSoil(src.soilAnalysis),
      reportTemplate: normReportTemplate(src.reportTemplate, src.reportStamps),
      customerReports: normCustomerReports(src.customerReports),
      agriVideos: normAgriVideos(src.agriVideos),
      publicReports: normPublicReports(src.publicReports),
      currency: (src.currency as string) || '',
      bookGridSettings: { ...DEFAULT_BOOK_GRID, ...(src.bookGridSettings && typeof src.bookGridSettings === 'object' ? src.bookGridSettings as Partial<BookGridSettings> : {}) },
      watermarkImg: (src.watermarkImg as string) || '',
      watermarkOpacity: typeof src.watermarkOpacity === 'number' ? src.watermarkOpacity : 0.15,
      fileNodes: arr<FileNode>(src.fileNodes, []).map((n: unknown) => {
        const o = (n && typeof n === 'object' ? n : {}) as Record<string, unknown>;
        return {
          id:        (o.id as string) || uid(),
          name:      (o.name as string) || 'untitled',
          kind:      o.kind === 'folder' ? 'folder' : 'file',
          parentId:  (o.parentId as string | null) ?? null,
          url:       (o.url as string) || undefined,
          mimeType:  (o.mimeType as string) || undefined,
          sizeBytes: typeof o.sizeBytes === 'number' ? o.sizeBytes : undefined,
          createdAt: (o.createdAt as string) || new Date().toISOString(),
        } as FileNode;
      }),
    };
  } catch { return DEFAULT_DATA; }
}

/* Flatten the library forest into selectable paths ("Main / Sub / Year …") */
export function flattenLibrary(nodes: LibraryNode[], lang: LangKey): { id: string; path: string; depth: number }[] {
  const out: { id: string; path: string; depth: number }[] = [];
  const walk = (ns: LibraryNode[], pre: string, depth: number) => {
    (ns || []).forEach(n => {
      const label = pickML(n.name, lang) || '—';
      const path = pre ? `${pre} / ${label}` : label;
      out.push({ id: n.id, path, depth });
      walk(n.children, path, depth + 1);
    });
  };
  walk(nodes, '', 0);
  return out;
}

/* ═══════════════════════════════════════════════════════════
   JWT TOKEN HELPERS  (للاتصال بـ Hostinger API)
═══════════════════════════════════════════════════════════ */

const JWT_KEY = '__admin_jwt__';

export function getApiToken(): string {
  try { return localStorage.getItem(JWT_KEY) || ''; } catch { return ''; }
}
export function setApiToken(token: string) {
  try { localStorage.setItem(JWT_KEY, token); } catch { /* */ }
}
export function clearApiToken() {
  try { localStorage.removeItem(JWT_KEY); } catch { /* */ }
}

/**
 * تسجيل دخول Admin على سيرفر Hostinger.
 * يُرجع true عند النجاح وحفظ التوكن.
 */
export async function loginToApi(username: string, password: string): Promise<boolean> {
  try {
    const res = await fetch('./api/auth.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json.token) { setApiToken(json.token); return true; }
    return false;
  } catch { return false; }
}

/* ═══════════════════════════════════════════════════════════
   SAVE / LOAD
═══════════════════════════════════════════════════════════ */

/**
 * يحفظ البيانات في localStorage (دائماً)
 * ويُزامنها مع قاعدة البيانات على Hostinger (إذا كان التوكن موجوداً).
 */
export function saveAppData(data: AppData) {
  /* 1. حفظ محلي فوري */
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* storage full */ }

  /* 2. مزامنة مع قاعدة البيانات (في الخلفية — لا تُعطّل الواجهة) */
  const token = getApiToken();
  if (token) {
    fetch('./api/data.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    }).catch(() => { /* نتجاهل أخطاء الشبكة — البيانات محفوظة محلياً */ });
  }
}

/**
 * يجلب البيانات من قاعدة بيانات Hostinger.
 * يُرجع null إذا فشل الطلب (سيستخدم الـ localStorage كبديل).
 */
export async function loadAppDataFromDb(): Promise<AppData | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch('./api/data.php', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const raw = await res.json() as Record<string, unknown>;
    if (!raw || typeof raw !== 'object') return null;

    /*
     * إذا كانت DB غير مُهيّأة (is_seeded=0) نتجاهل بياناتها ونبقى على localStorage.
     * هذا يمنع القيم الافتراضية الفارغة من تلويث البيانات الحقيقية في localStorage.
     * بعد أول مزامنة من لوحة التحكم، تصبح is_seeded=1 وتصير DB هي المصدر الحقيقي.
     */
    if (!raw.dbIsSeeded) return null;

    /* DB مُهيّأة: نمزج بيانات localStorage (الحقول الإضافية) مع DB (المرجع الأساسي) */
    const local = loadAppData();
    const { dbIsSeeded: _flag, ...dbData } = raw;
    const merged = JSON.stringify({ ...local, ...dbData });
    const src = JSON.parse(merged) as Partial<AppData> & Record<string, unknown>;

    /* نحفظ محلياً لتسريع التحميل في المرة القادمة */
    try { localStorage.setItem(STORAGE_KEY, merged); } catch { /* */ }

    return src as AppData;
  } catch {
    return null;
  }
}
