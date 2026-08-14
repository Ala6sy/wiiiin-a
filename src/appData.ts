import { resolveArticleCategories, resolveGfxCategories } from './defaultCatalog';
import type { GfxModel3dSettings } from './gfxModel3d';
import type { GfxDownloadLink } from './gfxDownloadLinks';
import { normGfxModel3dSettings } from './gfxModel3d';
import { normGfxDownloadLinks } from './gfxDownloadLinks';
import { mergeSoilReportSamples } from './soilReportSamples';

export interface ML { ar: string; en: string; de: string }
export type LangKey = 'ar' | 'en' | 'de';
export const ml = (ar: string, en = '', de = ''): ML => ({ ar, en, de });
export function pickML(m: ML | string | undefined, lang: LangKey): string {
  if (!m) return '';
  if (typeof m === 'string') {
    const s = m.trim();
    return s === 'Array' ? '' : s;
  }
  if (Array.isArray(m)) {
    const idx = lang === 'ar' ? 0 : lang === 'en' ? 1 : 2;
    const v = String((m as unknown[])[idx] ?? '').trim();
    return v === 'Array' ? '' : v;
  }
  const v = (m[lang] || m.ar || m.en || m.de || '').trim();
  return v === 'Array' ? '' : v;
}

/** للواجهة العامة — اللغة المختارة فقط بدون الرجوع للعربية */
export function pickMLStrict(m: ML | string | undefined, lang: LangKey): string {
  if (!m) return '';
  if (typeof m === 'string') return lang === 'ar' ? m.trim() : '';
  return (m[lang] || '').trim();
}

export function displayML(m: ML | string | undefined, lang: LangKey): string {
  const strict = pickMLStrict(m, lang);
  if (strict) return strict;
  if (lang === 'ar') return pickML(m, lang);
  return '';
}

export const CV_BTN_ICON_COLOR = '#7ec8ff';

/* ── Skill ─────────────────────────────────────────────── */
export interface Skill {
  id: string;
  name: string;
  percent: number;
  icon: string;
  size?: number;
  /** عرض المهارة في صفحة السيرة — الافتراضي true */
  showOnAbout?: boolean;
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
  /** لون خط القوائم والأزرار (pill) — إن فُرغ يتبع accent تلقائياً */
  menuTextColor?: string;
  /** لون خلفية الأزرار (العودة، التالي، حفظ…) — فارغ = يتبع اللون الأساسي */
  buttonBgColor?: string;
  /** لون خط الأزرار — فارغ = أبيض */
  buttonTextColor?: string;
  /** لون زر «تنزيل مجاني» في صفحة مشروع التصميم — فارغ = كحلي #003366 */
  gfxFreeDownloadBtnColor?: string;
  /** نوع الخط للموقع بالكامل */
  siteFontFamily?: string;
  /** حجم الخط الأساسي بالبكسل (12–24) */
  baseFontSize?: number;
  /** لون النص العام — فارغ = تلقائي حسب الثيم */
  bodyTextColor?: string;
  /** لون العناوين — فارغ = يتبع اللون الأساسي */
  headingTextColor?: string;
  /** لون النص الثانوي/الوصف — فارغ = تلقائي */
  mutedTextColor?: string;
  glassOpacity: number;
  threeScriptUrl?: string;
  /** إظهار طلب موافقة GPS الدقيق للزائر عند دخوله الموقع */
  visitorGpsPromptEnabled?: boolean;
  /**
   * وسائط صورة السيرة (يمين الصفحة): صورة أو فيديو/WebM.
   * فارغ = الافتراضي /alaa-photo.jpg
   * رفع مباشر (data:) أو رابط Google Drive / مباشر
   */
  aboutHeroMedia?: string;
  /** نوع الوسائط — auto يكتشف من الامتداد؛ video يفرض تشغيل فيديو (مفيد لروابط Drive) */
  aboutHeroKind?: 'auto' | 'image' | 'video';
  /** إظهار البطاقة الزجاجية (الاسم) فوق صورة/فيديو السيرة */
  aboutNameBadgeVisible?: boolean;
  /** بعد البطاقة عن أسفل الفيديو — ويب (px) */
  aboutNameBadgeBottomDesktop?: number;
  /** بعد البطاقة عن أسفل الفيديو — جوال (px) */
  aboutNameBadgeBottomMobile?: number;
  /** الحشو العمودي للبطاقة فقط (لا يصغّر المخطوطة) */
  aboutNameBadgePadY?: number;
  /**
   * فيديو تعريفي للصفحة الرئيسية (اختياري).
   * فارغ = لا يُعرض شيء. رابط Drive / مباشر / YouTube.
   */
  homeIntroVideo?: string;
  /**
   * معرض تقارير العملاء: إظهار اسم العميل بسطر ناعم تحت العنوان.
   * الافتراضي: ظاهر.
   */
  reportGalleryShowCustomerName?: boolean;
  /** عدد بطاقات التقارير في صف واحد — جوال */
  reportGalleryColsMobile?: number;
  /** عدد بطاقات التقارير في صف واحد — ويب */
  reportGalleryColsDesktop?: number;
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
  /** اختياري — سنة دراسية (يظهر في JSON للتصنيف) */
  academicYear?: ML;
  /** اختياري — فصل دراسي */
  semester?: ML;
  /** اختياري — اسم المادة */
  subject?: ML;
}

export type BookRibbonShape = 'corner' | 'badge' | 'pill' | 'banner';

export interface BookGridSettings {
  colsMobile: number;
  colsDesktop: number;
  gap: number;
  paddingMobile: number;
  imgHeight: number;
  cardWidth: number;
  titleFontSize?: number;
  descFontSize?: number;
  tagFontSize?: number;
  autoScaleFont?: boolean;
  ribbonShape?: BookRibbonShape;
  ribbonFreeBg?: string;
  ribbonFreeColor?: string;
  ribbonPaidBg?: string;
  ribbonPaidColor?: string;
  ribbonFontSize?: number;
  ribbonVisible?: boolean;
  ribbonOpacity?: number;
  previewBtnFontSize?: number;
  downloadBtnFontSize?: number;
  /** آخر إعدادات مولّد الغلاف التلقائي (تُحفظ في DB ضمن grid_settings) */
  coverGeneratorSettings?: {
    bgUrl?: string;
    bandEnabled?: boolean;
    bandColor?: string;
    bandOpacity?: number;
    bandHeightPct?: number;
    bandXPct?: number;
    bandYPct?: number;
    bandWidthPct?: number;
    fontSize?: number;
    fontColor?: string;
    fontWeight?: 'normal' | 'bold';
    textAlign?: 'right' | 'center' | 'left';
    textPaddingPct?: number;
  };
}
export const DEFAULT_BOOK_GRID: BookGridSettings = {
  colsMobile: 3,
  colsDesktop: 3,
  gap: 10,
  paddingMobile: 4,
  imgHeight: 180,
  cardWidth: 100,
  titleFontSize: 13,
  descFontSize: 11,
  tagFontSize: 10,
  previewBtnFontSize: 12,
  downloadBtnFontSize: 12,
  autoScaleFont: true,
  ribbonShape: 'badge',
  ribbonFreeBg: '#22c55e',
  ribbonFreeColor: '#ffffff',
  ribbonPaidBg: '#f59e0b',
  ribbonPaidColor: '#1a1a1a',
  ribbonFontSize: 10,
  ribbonVisible: true,
  ribbonOpacity: 1,
};

export interface ArticleGridSettings {
  colsMobile: number;
  colsDesktop: number;
  gap: number;
  paddingMobile: number;
  imgHeight: number;
  cardMinWidth: number;
  titleFontSize: number;
  descFontSize: number;
  tagFontSize: number;
  autoScaleFont: boolean;
  excerptLines: number;
}
export const DEFAULT_ARTICLE_GRID: ArticleGridSettings = {
  colsMobile: 1,
  colsDesktop: 3,
  gap: 18,
  paddingMobile: 8,
  imgHeight: 160,
  cardMinWidth: 240,
  titleFontSize: 15,
  descFontSize: 13,
  tagFontSize: 11,
  autoScaleFont: true,
  excerptLines: 3,
};

/** Convert a Google Drive sharing URL to a thumbnail URL that works as <img src> */
export { driveThumb, resolveImageSrc, normalizeImageUrlForStorage, normalizeVideoUrlForStorage, isGoogleDriveUrl } from './mediaUrl';

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
  customerName: ML;
  customerPhone: string;
  customerLocation: ML;
  attendanceDate: string;
  examDate: string;
  images: string[];
  plantName: ML;
  description: ML;
  soilRows: CustomerReportRow[];
  finalReport: ML;
  createdAt: string;
}

/** نص تقرير حسب اللغة — بدون رجوع للعربية عند EN/DE */
export function pickReportML(m: ML | string | undefined, lang: LangKey): string {
  if (lang === 'ar') return pickML(m, 'ar');
  return pickMLStrict(m, lang);
}

/**
 * تطبيع حقل عميل/موقع قديم:
 * - JSON ML
 * - أو نص «عربي / English»
 */
export function normPersonML(v: unknown): ML {
  const m = normML(v);
  const trySplit = (s: string): ML | null => {
    const parts = s.split(/\s*\/\s*/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const hasAr = /[\u0600-\u06FF]/.test(parts[0]);
    const secondIsLatin = !/[\u0600-\u06FF]/.test(parts[1]);
    if (hasAr && secondIsLatin) {
      return ml(parts[0], parts[1], parts[2] || parts[1]);
    }
    return null;
  };
  if (m.ar && !m.en && !m.de) {
    const split = trySplit(m.ar);
    if (split) return split;
  }
  /* نفس النص المزدوج في ar/en/de (من عينات قديمة) */
  if (m.ar && m.en === m.ar && m.de === m.ar) {
    const split = trySplit(m.ar);
    if (split) return split;
  }
  return m;
}

/* ── Agri portal: instructional videos & public client reports ── */
export interface AgriVideo {
  id: string;
  title: ML;
  url: string;
  visible: boolean;
  /** صورة مصغّرة — رابط Drive أو data:image */
  poster?: string;
  /** موضع الإطار الملتقط من الفيديو (ثوانٍ) */
  posterTimeSec?: number;
  /** تشغيل تلقائي عند فتح الصفحة (وإلا بالضغط) */
  autoplay?: boolean;
  /** تكرار مستمر (WebM / صورة متحركة) — افتراضي true */
  loop?: boolean;
  /** كتم الصوت (مطلوب غالباً للتكرار التلقائي) */
  muted?: boolean;
}
export interface PublicReport { id: string; title: ML; thumbnail: string; url: string; visible: boolean }

/* ── Graphics ───────────────────────────────────────────── */
export interface GfxProjectItem {
  id: string;
  title: ML;
  desc: ML;
  mainImg: string;
  mainImgNoWm?: boolean;
  mainImgIsVideo?: boolean;
  images: string[];
  imagesNoWm?: boolean[];
  imagesIsVideo?: boolean[];
  videoUrl: string;
  usedSkillsIds: string[];
  cvSettings: { isFeatured: boolean; imgSize: number; showDesc: boolean; showTools: boolean };
  glbUrl?: string;
  glbIsPaid?: boolean;
  glbPrice?: string;
  glbCurrency?: string;
  glbFreeUrl?: string;
  glbViewSettings?: GfxModel3dSettings;
  /** روابط تحميل متعددة (مجانية / مدفوعة) */
  downloadLinks?: GfxDownloadLink[];
  /** ملف التصميم الأصلي (PSD / DWG / C4D …) على Google Drive */
  sourceFileUrl?: string;
  sourceFileVisible?: boolean;
  sourceFilePassword?: string;
  sourceFileLabel?: string;
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
  id?: string;
  title: ML;
  desc: ML;
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
  googlePlayVisible?: boolean;
  appleStoreVisible?: boolean;
  githubUrl?: string;
  githubVisible?: boolean;
  tags: string[];
  thumbSize?: number;
  textColor?: string;
  imgBgColor?: string;
}

export interface WebGridSettings {
  colsMobile: number;
  colsDesktop: number;
  gap: number;
  cardMinWidth: number;
  paddingMobile: number;
  imgHeight: number;
  titleFontSize?: number;
  descFontSize?: number;
  tagFontSize?: number;
  autoScaleFont?: boolean;
}
export const DEFAULT_WEB_GRID: WebGridSettings = {
  colsMobile: 1,
  colsDesktop: 2,
  gap: 20,
  cardMinWidth: 220,
  paddingMobile: 8,
  imgHeight: 220,
  titleFontSize: 15,
  descFontSize: 13,
  tagFontSize: 11,
  autoScaleFont: true,
};

export interface GfxGridSettings {
  colsMobile: number;
  colsDesktop: number;
  gap: number;
  paddingMobile: number;
  imgHeight: number;
  cardMinWidth: number;
  titleFontSize?: number;
  descFontSize?: number;
  tagFontSize?: number;
  autoScaleFont?: boolean;
  /** الوضع الافتراضي عند فتح مركز التصاميم — يمكن للزائر التبديل من الصفحة */
  galleryBrowseMode?: 'all' | 'byCategory';
}
export const DEFAULT_GFX_GRID: GfxGridSettings = {
  colsMobile: 1,
  colsDesktop: 3,
  gap: 22,
  paddingMobile: 8,
  imgHeight: 195,
  cardMinWidth: 200,
  titleFontSize: 14,
  descFontSize: 12,
  tagFontSize: 10,
  autoScaleFont: true,
  galleryBrowseMode: 'all',
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
export type CvSectionKind = 'header' | 'contact' | 'entries' | 'tags' | 'langtable' | 'skillbars' | 'portfolio' | 'text' | 'documents';

/** عمود في جدول اللغات */
export interface CvLangTableCol {
  id: string;
  header: ML;
}

/** صف في جدول اللغات — خلايا ديناميكية حسب الأعمدة */
export interface CvLangRow {
  id: string;
  cells: Record<string, ML | number | undefined>;
}
export interface CvContactItem { id: string; label: ML; value: ML; ltr: boolean }
/** inline = الجهة بنفس سطر العنوان | block = سطر جديد (افتراضي) */
export type CvEntryOrgLayout = 'inline' | 'block';
/** inline = التاريخ والعنوان بنفس السطر | block = العنوان أسفل التاريخ */
export type CvDateTitleLayout = 'inline' | 'block';
export interface CvEntryItem {
  id: string; from: string; to: string; title: ML; org: ML; desc: ML;
  orgLayout?: CvEntryOrgLayout;
  dateTitleLayout?: CvDateTitleLayout;
}

/** أحجام الخط والتباعد في السيرة — تُحفظ ضمن page_layout */
export type CvFontWeight = 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export const CV_WEIGHT_OPTIONS: { value: CvFontWeight; label: string }[] = [
  { value: 300, label: 'رفيع' },
  { value: 400, label: 'عادي' },
  { value: 500, label: 'متوسط' },
  { value: 600, label: 'شبه غامق' },
  { value: 700, label: 'غامق' },
  { value: 800, label: 'ثقيل' },
  { value: 900, label: 'أسود' },
];

/** أوزان Tajawal المحمّلة فعلياً — نقرّب لأقرب وزن لتفادي الوميض */
const TAJAWAL_WEIGHTS: CvFontWeight[] = [200, 300, 400, 500, 600, 700, 800, 900];

export function snapCvFontWeight(w: number): CvFontWeight {
  let best: CvFontWeight = 400;
  let diff = Infinity;
  for (const tw of TAJAWAL_WEIGHTS) {
    const d = Math.abs(tw - w);
    if (d < diff) { diff = d; best = tw; }
  }
  return best;
}

export const CV_TYPO_PX_MIN = 5;
export const CV_TYPO_PX_MAX = 96;

/** محاذاة نص الإدخالات — auto = عربي يمين / إنجليزي وألماني يسار */
export type CvEntryAlign = 'auto' | 'right' | 'left' | 'center';

export function resolveCvEntryAlign(lang: LangKey, align?: CvEntryAlign): 'right' | 'left' | 'center' {
  if (align === 'right' || align === 'left' || align === 'center') return align;
  return lang === 'ar' ? 'right' : 'left';
}

export interface CvTypography {
  sectionTitlePx?: number;
  bodyPx?: number;
  orgPx?: number;
  /** عنوان الإدخال — مثل «مدير العمليات» */
  entryTitlePx?: number;
  lineHeight?: number;
  sectionGapPx?: number;
  namePx?: number;
  subtitlePx?: number;
  datePx?: number;
  nameWeight?: CvFontWeight;
  subtitleWeight?: CvFontWeight;
  sectionTitleWeight?: CvFontWeight;
  entryTitleWeight?: CvFontWeight;
  orgWeight?: CvFontWeight;
  bodyWeight?: CvFontWeight;
  dateWeight?: CvFontWeight;
  /** افتراضي لمكان الجهة عندما لا يُحدَّد لكل إدخال */
  defaultOrgLayout?: CvEntryOrgLayout;
  /** افتراضي: العنوان أسفل التاريخ أو بنفس السطر */
  defaultDateTitleLayout?: CvDateTitleLayout;
  /** تباعد بين التاريخ والعنوان الرئيسي */
  dateTitleGapPx?: number;
  /** تباعد بين العنوان والجهة */
  titleOrgGapPx?: number;
  /** تباعد قبل التفاصيل */
  entryDetailsGapPx?: number;
  /** تباعد بين الإدخالات داخل القسم */
  entryGapPx?: number;
  /** تباعد تحت عنوان القسم (قبل أول إدخال) */
  sectionInnerGapPx?: number;
  /** محاذاة بلوكات الخبرات — auto حسب اللغة */
  entryAlign?: CvEntryAlign;
  /** تباعد بين أيقونة البرنامج واسمه في شرائط المهارات */
  skillIconNameGapPx?: number;
  /** أدنى تباعد بين اسم البرنامج والنسبة المئوية */
  skillNamePctGapPx?: number;
  /** تباعد بين صف الاسم/النسبة وشريط التقدم */
  skillHeaderBarGapPx?: number;
  /** تباعد بين صفوف المهارات */
  skillRowGapPx?: number;
  /** اسم الحقل في العمود الجانبي (مثل: الهاتف، البريد) */
  sideLabelPx?: number;
  sideLabelWeight?: CvFontWeight;
  /** قيمة الحقل في العمود الجانبي */
  sideValuePx?: number;
  sideValueWeight?: CvFontWeight;
  /** نص المهارات النقطية (وسوم •) */
  tagsPx?: number;
  tagsWeight?: CvFontWeight;
  /** تباعد بين صفوف بيانات التواصل في العمود الجانبي */
  contactGapPx?: number;
  /** تباعد بين عناصر المهارات النقطية */
  tagsGapPx?: number;
}

export const DEFAULT_CV_TYPOGRAPHY: Required<CvTypography> = {
  sectionTitlePx: 13,
  bodyPx: 11.5,
  orgPx: 11,
  entryTitlePx: 11.5,
  lineHeight: 1.55,
  sectionGapPx: 18,
  namePx: 26,
  subtitlePx: 15,
  datePx: 10.5,
  nameWeight: 800,
  subtitleWeight: 700,
  sectionTitleWeight: 800,
  entryTitleWeight: 700,
  orgWeight: 600,
  bodyWeight: 400,
  dateWeight: 700,
  defaultOrgLayout: 'block',
  defaultDateTitleLayout: 'block',
  dateTitleGapPx: 8,
  titleOrgGapPx: 6,
  entryDetailsGapPx: 8,
  entryGapPx: 16,
  sectionInnerGapPx: 10,
  entryAlign: 'auto',
  skillIconNameGapPx: 5,
  skillNamePctGapPx: 8,
  skillHeaderBarGapPx: 4,
  skillRowGapPx: 9,
  sideLabelPx: 11.5,
  sideLabelWeight: 700,
  sideValuePx: 11.5,
  sideValueWeight: 400,
  tagsPx: 11.5,
  tagsWeight: 400,
  contactGapPx: 12,
  tagsGapPx: 12,
};

const CV_WEIGHTS = new Set<CvFontWeight>([200, 300, 400, 500, 600, 700, 800, 900]);

export function mergeCvTypography(v?: CvTypography): Required<CvTypography> {
  const n = normCvTypography(v);
  const clean: CvTypography = {};
  for (const [k, val] of Object.entries(n) as [keyof CvTypography, CvTypography[keyof CvTypography]][]) {
    if (val !== undefined) (clean as Record<string, unknown>)[k] = val;
  }
  return { ...DEFAULT_CV_TYPOGRAPHY, ...clean };
}

export function normCvTypography(v: unknown): CvTypography {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const px = (key: keyof CvTypography, min = CV_TYPO_PX_MIN, max = CV_TYPO_PX_MAX) => {
    const raw = o[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
    return Math.min(max, Math.max(min, raw));
  };
  const wt = (key: keyof CvTypography) => {
    const raw = o[key];
    return typeof raw === 'number' && CV_WEIGHTS.has(raw as CvFontWeight) ? raw as CvFontWeight : undefined;
  };
  const orgLayout = o.defaultOrgLayout === 'inline' ? 'inline' as const
    : o.defaultOrgLayout === 'block' ? 'block' as const : undefined;
  const dateTitleLayout = o.defaultDateTitleLayout === 'inline' ? 'inline' as const
    : o.defaultDateTitleLayout === 'block' ? 'block' as const : undefined;
  const gapPx = (key: keyof CvTypography, max = 48) => px(key, 0, max);
  return {
    sectionTitlePx: px('sectionTitlePx'),
    bodyPx: px('bodyPx'),
    orgPx: px('orgPx'),
    entryTitlePx: px('entryTitlePx'),
    lineHeight: px('lineHeight', 1, 3),
    sectionGapPx: px('sectionGapPx', 4, 64),
    namePx: px('namePx'),
    subtitlePx: px('subtitlePx'),
    datePx: px('datePx'),
    nameWeight: wt('nameWeight'),
    subtitleWeight: wt('subtitleWeight'),
    sectionTitleWeight: wt('sectionTitleWeight'),
    entryTitleWeight: wt('entryTitleWeight'),
    orgWeight: wt('orgWeight'),
    bodyWeight: wt('bodyWeight'),
    dateWeight: wt('dateWeight'),
    defaultOrgLayout: orgLayout,
    defaultDateTitleLayout: dateTitleLayout,
    dateTitleGapPx: gapPx('dateTitleGapPx'),
    titleOrgGapPx: gapPx('titleOrgGapPx'),
    entryDetailsGapPx: gapPx('entryDetailsGapPx'),
    entryGapPx: gapPx('entryGapPx', 64),
    sectionInnerGapPx: gapPx('sectionInnerGapPx', 48),
    skillIconNameGapPx: gapPx('skillIconNameGapPx', 32),
    skillNamePctGapPx: gapPx('skillNamePctGapPx', 64),
    skillHeaderBarGapPx: gapPx('skillHeaderBarGapPx', 32),
    skillRowGapPx: gapPx('skillRowGapPx', 48),
    sideLabelPx: px('sideLabelPx'),
    sideLabelWeight: wt('sideLabelWeight'),
    sideValuePx: px('sideValuePx'),
    sideValueWeight: wt('sideValueWeight'),
    tagsPx: px('tagsPx'),
    tagsWeight: wt('tagsWeight'),
    contactGapPx: gapPx('contactGapPx', 48),
    tagsGapPx: gapPx('tagsGapPx', 48),
    entryAlign: (() => {
      const a = o.entryAlign;
      return a === 'right' || a === 'left' || a === 'center' || a === 'auto' ? a : undefined;
    })(),
  };
}

export function cvTypographyVars(doc: CvDoc, typoOverride?: Required<CvTypography>): Record<string, string> {
  const t = typoOverride ?? mergeCvTypography(doc.typography);
  const w = (n: number) => String(snapCvFontWeight(n));
  return {
    '--cv-sec-title-px': `${t.sectionTitlePx}px`,
    '--cv-body-px': `${t.bodyPx}px`,
    '--cv-org-px': `${t.orgPx}px`,
    '--cv-entry-title-px': `${t.entryTitlePx}px`,
    '--cv-line-height': String(t.lineHeight),
    '--cv-section-gap': `${t.sectionGapPx}px`,
    '--cv-name-px': `${t.namePx}px`,
    '--cv-sub-px': `${t.subtitlePx}px`,
    '--cv-date-px': `${t.datePx}px`,
    '--cv-name-weight': w(t.nameWeight),
    '--cv-sub-weight': w(t.subtitleWeight),
    '--cv-sec-title-weight': w(t.sectionTitleWeight),
    '--cv-entry-title-weight': w(t.entryTitleWeight),
    '--cv-org-weight': w(t.orgWeight),
    '--cv-body-weight': w(t.bodyWeight),
    '--cv-date-weight': w(t.dateWeight),
    '--cv-date-title-gap': `${t.dateTitleGapPx}px`,
    '--cv-title-org-gap': `${t.titleOrgGapPx}px`,
    '--cv-entry-details-gap': `${t.entryDetailsGapPx}px`,
    '--cv-entry-gap': `${t.entryGapPx}px`,
    '--cv-section-inner-gap': `${t.sectionInnerGapPx}px`,
    '--cv-skill-icon-name-gap': `${t.skillIconNameGapPx}px`,
    '--cv-skill-name-pct-gap': `${t.skillNamePctGapPx}px`,
    '--cv-skill-header-bar-gap': `${t.skillHeaderBarGapPx}px`,
    '--cv-skill-row-gap': `${t.skillRowGapPx}px`,
    '--cv-side-label-px': `${t.sideLabelPx}px`,
    '--cv-side-label-weight': w(t.sideLabelWeight),
    '--cv-side-value-px': `${t.sideValuePx}px`,
    '--cv-side-value-weight': w(t.sideValueWeight),
    '--cv-tags-px': `${t.tagsPx}px`,
    '--cv-tags-weight': w(t.tagsWeight),
    '--cv-contact-gap': `${t.contactGapPx}px`,
    '--cv-tags-gap': `${t.tagsGapPx}px`,
  };
}
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

/** line = خط سفلي | bar = شريط كحلي | full-bleed = شريط حتى الحواف */
export type CvHeaderStyle = 'line' | 'bar' | 'full-bleed';

/** إعدادات الصفحة 2+ (تبقى للصفحات التالية) */
export interface CvContinuedPages {
  hideHeader?: boolean;
  hideFooter?: boolean;
  /** نفس ترويسة الصفحة 1 بالكامل */
  useFirstPageHeader?: boolean;
  /** نفس تذييل الصفحة 1 (شكل + لون + نص) */
  useFirstPageFooter?: boolean;
  headerText?: ML;
  footerText?: ML;
  footerBgColor?: string;
  headerBgColor?: string;
  headerStyle?: CvHeaderStyle;
  headerBarWidthPct?: number;
  footerLayout?: CvFooterLayout;
  footerBarWidthPct?: number;
  footerTextInside?: boolean;
  headerHeightMm?: number;
  footerHeightMm?: number;
}

/** full-bleed = لون حتى حواف الصفحة | content-full = عرض المحتوى | bar = شريط ملون + نص تحته */
export type CvFooterLayout = 'full-bleed' | 'content-full' | 'bar';

export interface CvSection {
  id: string; kind: CvSectionKind; title: ML;
  column: 'left' | 'right' | 'full'; visible: boolean;
  entries?: CvEntryItem[]; tags?: ML[];
  contactItems?: CvContactItem[]; portfolio?: CvPortfolioItem[];
  text?: ML; useGlobalSkills?: boolean;
  /** مهارات محددة لقسم skillbars — فارغ = الكل */
  skillIds?: string[];
  /** لون أشرطة النسب — افتراضي: لون السيرة */
  skillBarColor?: string;
  galleryLayout?: 1 | 2 | 3;
  imgHeight?: number;
  pageBreakBefore?: boolean;
  /** للمحرر: ربط القسم بصفحة معيّنة (1+) — فارغ = تلقائي */
  editorPage?: number;
  /** جدول اللغات — kind=langtable */
  langRows?: CvLangRow[];
  langTableCols?: CvLangTableCol[];
  /** تباعد داخل الخلايا (px) */
  langTableCellPadPx?: number;
  /** تباعد أفقي بين الأعمدة (px) */
  langTableColGapPx?: number;
}

export interface CvDoc {
  id: string; name: ML; removable: boolean;
  accent: string; icon: string; photo: string;
  fullName: ML; subtitle: ML; since: number; showInAbout: boolean;
  sections: CvSection[];
  globalColor?: string;
  footerBgColor?: string;
  footerText?: ML;
  /** ارتفاع الترويسة بالمليمتر (18–55) */
  headerHeightMm?: number;
  /** ارتفاع التذييل بالمليمتر (8–30) */
  footerHeightMm?: number;
  /** حجم صورة الرأس بالبكسل */
  headerPhotoSize?: number;
  /** ترويسة/تذييل الصفحة 2 وما بعدها (افتراضي) */
  continuedPages?: CvContinuedPages;
  /** إعدادات خاصة بصفحة معيّنة — فهرس 0 = الصفحة 2، 1 = الصفحة 3، … */
  pageOverrides?: CvContinuedPages[];
  /** صفحات فارغة إضافية في نهاية السيرة (زر إضافة صفحة) — يُستبدل بـ pageSequence عند التحكم اليدوي */
  extraBlankPages?: number;
  /** ترتيب الصفحات — رقم مقطع المحتوى (0+) أو 'blank' */
  pageSequence?: import('./cvPageSequence').CvPageSlot[];
  footerLayout?: CvFooterLayout;
  footerBarWidthPct?: number;
  footerTextInside?: boolean;
  sidebarDocs?: CvSidebarDoc[];
  qrCredentials?: CvQrCredential[];
  /** عدد أعمدة شبكة باركود الوثائق على A4 */
  qrGridCols?: 2 | 3 | 4 | 5;
  /** ملفات PDF جاهزة للزوار — ar/en/de (base64 أو URL) */
  pdfFiles?: Partial<Record<LangKey, string>>;
  /** أحجام الخط والتباعد */
  typography?: CvTypography;
}

/** هدف النقر في معاينة السيرة → تبويب المحرر */
export type CvEditTarget =
  | { tab: 'meta' }
  | { tab: 'branding' }
  | { tab: 'skills' }
  | { tab: 'docs' }
  | { tab: 'sections'; sectionId: string; entryId?: string };

/** أسماء افتراضية لأزرار تنزيل السيرة */
export const CV_DOC_LABELS: Record<string, ML> = {
  agri: ml('سيرة الزراعة', 'Agriculture CV', 'Landwirtschafts-CV'),
  dev: ml('سيرة التصميم', 'Design CV', 'Design-CV'),
};

export function cvDocLabel(doc: Pick<CvDoc, 'id' | 'name'>, lang: LangKey): string {
  const fromDoc = pickMLStrict(doc.name, lang);
  if (fromDoc) return fromDoc;
  return pickML(CV_DOC_LABELS[doc.id], lang) || doc.id;
}

/* ── Custom CV (legacy) ─────────────────────────────────── */
export interface CustomCv { id: string; name: string; template: 'agri' | 'dev'; profile: CvProfile }

/** طريقة عرض الاسم في الواجهة الرئيسية */
export type NameDisplayMode = 'text' | 'handwriting' | 'logo';

/** تخصيص الجولة التفاعلية في /p — النص والصوت لكل لغة */
export interface WalkthroughStepSettings {
  id: string;
  enabled?: boolean;
  title?: ML;
  body?: ML;
  durationMs?: number;
  audio?: Partial<Record<LangKey, string>>;
}

export interface AgriWalkthroughSettings {
  enabled?: boolean;
  autoplay?: boolean;
  defaultSpeed?: number;
  plantImages?: string[];
  steps?: WalkthroughStepSettings[];
}

/* ── App-wide ────────────────────────────────────────────── */
export interface AppData {
  name: ML;
  /** text = عادي | handwriting = خط يد | logo = صورة شعار */
  nameDisplay?: NameDisplayMode;
  /** صورة الشعار (base64 أو URL) عند nameDisplay=logo */
  nameLogo?: string;
  /** لون الشعار (SVG/PNG) — hex */
  nameLogoColor?: string;
  /** حركة إضاءة متموجة على الاسم/الشعار */
  nameShimmer?: boolean;
  /** سرعة CC Light Sweep بالثواني — 0 = ثابت بدون حركة، 0.5–25 */
  nameShimmerSpeed?: number;
  /** لون إضاءة CC Light Sweep (مستقل عن لون الشعار) */
  nameShimmerColor?: string;
  /** زاوية CC Light Sweep بالدرجات (0–360) */
  nameShimmerAngle?: number;
  /** تشغيل حركة CC Light Sweep */
  nameShimmerMotion?: boolean;
  /** اتجاه الحركة: rtl = يمين→يسار (عربي) | ltr = يسار→يمين (إنجليزي) */
  nameShimmerDirection?: 'rtl' | 'ltr';
  /** عرض شعاع اللمعان — 0.03 رفيع … 0.22 سميك */
  nameShimmerWidth?: number;
  bio: ML;
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
  agriCvPlacements?: CvDocPlacements;
  designCvPlacements?: CvDocPlacements;
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
  articleGridSettings: ArticleGridSettings;
  watermarkImg: string;
  watermarkOpacity: number;
  fileNodes: FileNode[];
  agriWalkthrough?: AgriWalkthroughSettings;
}

/** أماكن ظهور أزرار السيرة الذاتية */
export interface CvDocPlacements {
  agriPortal: boolean;
  designPortal: boolean;
  about: boolean;
  cvPage: boolean;
}

export type CvShowWhere = keyof CvDocPlacements;

export const CV_PLACEMENT_LABELS: Record<CvShowWhere, string> = {
  agriPortal: 'محتوى الزراعة',
  designPortal: 'محتوى التصاميم',
  about: 'نبذة عني',
  cvPage: 'صفحة السيرة',
};

export const DEFAULT_CV_PLACEMENTS_OFF: CvDocPlacements = {
  agriPortal: false,
  designPortal: false,
  about: false,
  cvPage: false,
};

function legacyAgriPlacements(show?: boolean): CvDocPlacements {
  if (show !== true) return { ...DEFAULT_CV_PLACEMENTS_OFF };
  return { agriPortal: true, designPortal: false, about: true, cvPage: true };
}

function legacyDesignPlacements(show?: boolean): CvDocPlacements {
  if (show !== true) return { ...DEFAULT_CV_PLACEMENTS_OFF };
  return { agriPortal: false, designPortal: true, about: true, cvPage: true };
}

export function normCvPlacements(raw: unknown, legacyShow?: boolean, kind: 'agri' | 'design' = 'agri'): CvDocPlacements {
  if (!raw || typeof raw !== 'object') {
    return kind === 'design' ? legacyDesignPlacements(legacyShow) : legacyAgriPlacements(legacyShow);
  }
  const o = raw as Partial<CvDocPlacements>;
  return {
    agriPortal: o.agriPortal === true,
    designPortal: o.designPortal === true,
    about: o.about === true,
    cvPage: o.cvPage === true,
  };
}

export function resolveAgriCvPlacements(data: Pick<AppData, 'agriCvPlacements' | 'showAgriCv'>): CvDocPlacements {
  if (data.agriCvPlacements) return data.agriCvPlacements;
  return legacyAgriPlacements(data.showAgriCv);
}

export function resolveDesignCvPlacements(data: Pick<AppData, 'designCvPlacements' | 'showDesignerCv'>): CvDocPlacements {
  if (data.designCvPlacements) return data.designCvPlacements;
  return legacyDesignPlacements(data.showDesignerCv);
}

export function cvPlacementsActive(p: CvDocPlacements): boolean {
  return p.agriPortal || p.designPortal || p.about || p.cvPage;
}

export function cvDocVisibleAt(
  data: Pick<AppData, 'cvDocs' | 'agriCvPlacements' | 'designCvPlacements' | 'showAgriCv' | 'showDesignerCv'>,
  docId: string,
  where: CvShowWhere,
): boolean {
  const doc = (data.cvDocs || []).find(d => d.id === docId);
  if (!doc) return false;
  if (docId === 'agri') return resolveAgriCvPlacements(data)[where] === true;
  if (docId === 'dev') return resolveDesignCvPlacements(data)[where] === true;
  return !!doc.showInAbout && where === 'about';
}

/** سير ذاتية ظاهرة في مكان محدد */
export function visitorCvDocsAt(
  data: Pick<AppData, 'cvDocs' | 'agriCvPlacements' | 'designCvPlacements' | 'showAgriCv' | 'showDesignerCv'>,
  where: CvShowWhere,
): CvDoc[] {
  return (data.cvDocs || []).filter(d => cvDocVisibleAt(data, d.id, where));
}

/** كل السير الظاهرة للزائر في أي قسم — للمعاينة المخفية قبل التصدير */
export function visitorCvDocsForExport(
  data: Pick<AppData, 'cvDocs' | 'agriCvPlacements' | 'designCvPlacements' | 'showAgriCv' | 'showDesignerCv'>,
): CvDoc[] {
  const seen = new Set<string>();
  const out: CvDoc[] = [];
  const push = (d: CvDoc) => {
    if (seen.has(d.id)) return;
    seen.add(d.id);
    out.push(d);
  };
  for (const where of ['about', 'cvPage'] as CvShowWhere[]) {
    for (const d of visitorCvDocsAt(data, where)) push(d);
  }
  for (const id of ['agri', 'dev'] as const) {
    const where: CvShowWhere = id === 'agri' ? 'agriPortal' : 'designPortal';
    if (cvDocVisibleAt(data, id, where)) {
      const d = (data.cvDocs || []).find(x => x.id === id);
      if (d) push(d);
    }
  }
  return out;
}

/** @deprecated استخدم visitorCvDocsAt(data, 'about') أو 'cvPage' */
export function visitorCvDocs(data: Pick<AppData, 'cvDocs' | 'agriCvPlacements' | 'designCvPlacements' | 'showAgriCv' | 'showDesignerCv'>): CvDoc[] {
  const about = visitorCvDocsAt(data, 'about');
  const cvPage = visitorCvDocsAt(data, 'cvPage');
  const seen = new Set<string>();
  return [...about, ...cvPage].filter(d => {
    if (seen.has(d.id)) return false;
    seen.add(d.id);
    return true;
  });
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

function normContactValue(x: Record<string, unknown>): ML {
  if (x.valueMl) return normML(x.valueMl);
  const v = x.value;
  if (v && typeof v === 'object' && !Array.isArray(v)) return normML(v);
  const s = typeof v === 'string' ? v : '';
  if (!s) return ml('');
  return { ar: s, en: s, de: s };
}

function contactItemsFromPersonal(pi: PersonalInfo): CvContactItem[] {
  const items: CvContactItem[] = [];
  const add = (label: ML, value: string, ltr = true) => { if (value) items.push({ id: uid(), label, value: ml(value, value, value), ltr }); };
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

interface DocMeta { id: string; name: ML; removable: boolean; accent: string; icon: string; fullName: ML; subtitle: ML; includeSkillbars: boolean; includePortfolio: boolean; }
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
  id: 'agri', name: ml('سيرة الزراعة', 'Agriculture CV', 'Landwirtschafts-CV'), removable: false, accent: '#2a7a2a', icon: 'fa-seedling',
  fullName: ml('المهندس علاء أحمد المصري', 'Eng. Alaa Ahmad Almasri', 'Ing. Alaa Ahmad Almasri'),
  subtitle: ml('مهندس زراعي | أخصائي التكنولوجيا الحيوية النباتية', 'Agricultural Engineer | Plant Biotechnology Specialist', 'Agraringenieur | Spezialist für pflanzliche Biotechnologie'),
  includeSkillbars: false, includePortfolio: false,
};
const DEV_META: DocMeta = {
  id: 'dev', name: ml('سيرة التصميم', 'Design CV', 'Design-CV'), removable: false, accent: '#003366', icon: 'fa-bezier-curve',
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
  menuTextColor: '',
  buttonBgColor: '',
  buttonTextColor: '',
  gfxFreeDownloadBtnColor: '',
  siteFontFamily: 'Tajawal',
  baseFontSize: 16,
  bodyTextColor: '',
  headingTextColor: '',
  mutedTextColor: '',
  glassOpacity: 0.5,
  threeScriptUrl: '',
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
};

const DEFAULT_DATA: AppData = {
  name: ml(
    'م. علاء أحمد المصري',
    'Eng. Alaa Ahmad Almasri',
    'Ing. Alaa Ahmad Almasri',
  ),
  nameDisplay: 'text',
  nameLogo: '',
  nameLogoColor: '#ffffff',
  nameShimmer: true,
  nameShimmerSpeed: 3.2,
  nameShimmerColor: '#00ccff',
  nameShimmerAngle: 90,
  nameShimmerMotion: true,
  nameShimmerDirection: 'rtl',
  nameShimmerWidth: 0.08,
  bio: ml(
    'مهندس زراعي سوري، متخصص في البيوتكنولوجي، ومصمم مجالات متعددة، ومطور برمجيات. أجمع بين العلوم وهندسة التصميم والذكاء الأكواد لتطوير حلول ابتكارية.',
    'Syrian agricultural engineer specializing in biotechnology, multi-disciplinary designer, and software developer. I combine scientific precision, design engineering, and code intelligence to build leading innovative solutions.',
    'Syrischer Agraringenieur mit Spezialisierung auf Biotechnologie, multidisziplinärer Designer und Softwareentwickler. Ich verbinde wissenschaftliche Präzision, Design-Engineering und Code-Intelligenz für innovative Lösungen.',
  ),
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
  articleCategories: [], // يُستبدل عند التحميل بـ defaultCatalog
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
  gfxCategories: [], // يُستبدل عند التحميل بـ defaultCatalog
  aiVault: [
    { id: 'av1', title: ml('حقل نباتي مستقبلي', 'Futuristic Plant Field', 'Futuristisches Pflanzenfeld'), prompt: 'A futuristic hyper-realistic agricultural laboratory with neon UV glowing plants, organic cell incubation matrix, cinematic low-key studio lighting, 8k resolution, volumetric light paths --v 6.0', img: 'https://images.unsplash.com/photo-1507584947236-ec03c99a3c3d?auto=format&fit=crop&w=500&q=80', categoryId: '', subCategoryId: '' },
    { id: 'av2', title: ml('هوية فاخرة لعلاج طبي', 'Premium Medical Identity', 'Premium-Medizinische Identität'), prompt: 'Ultra-premium pharmaceutical product packaging design, deep navy blue and gold accents, clean white surfaces, herbal botanical elements, studio product photography, 8K sharp --v 6.0', img: 'https://images.unsplash.com/photo-1626446811236-7a6f23343130?auto=format&fit=crop&w=500&q=80', categoryId: '', subCategoryId: '' },
  ],
  softwareSnippets: [
    { title: ml("واجهة تطبيق 'صندوق العائلة المالي'", "Family Finance Box App UI", "Family Finance Box App UI"), desc: ml('محرر إدارة الميزانية وحساب الذهب والديون التفاعلي', 'Interactive budget, gold price and debt manager', 'Interaktiver Budget-, Goldpreis- und Schuldenmanager'), category: 'تطبيقات مالية', codeHtml: `<div class="fin-box">\n  <h3>محاكي العائلة المالي الذكي</h3>\n  <p>معدل أسعار الذهب الحالية متصلة لايف</p>\n  <div class="fin-row">\n    <div class="fin-card">الذهب: <b>308 ر.س/غم</b></div>\n    <div class="fin-card">الرصيد: <b>+12,450 ر.س</b></div>\n  </div>\n  <button class="fin-btn" onclick="alert('تم التحديث!')">تحديث الأسعار</button>\n</div>`, codeCss: `body { font-family: Tajawal, sans-serif; direction: rtl; background: #f0f5ff; }\n.fin-box { padding: 24px; background: #003366; color: #fff; border-radius: 14px; text-align: center; max-width: 400px; margin: auto; }\n.fin-box h3 { font-size: 20px; margin-bottom: 8px; }\n.fin-box p { font-size: 14px; opacity: 0.8; margin-bottom: 16px; }\n.fin-row { display: flex; gap: 10px; justify-content: center; margin-bottom: 16px; }\n.fin-card { background: rgba(255,255,255,0.15); padding: 10px 18px; border-radius: 8px; font-size: 13px; }\n.fin-btn { background: #fff; color: #003366; border: none; padding: 10px 24px; border-radius: 20px; font-weight: 700; font-size: 13px; cursor: pointer; }` },
    { title: ml('نظام إشعارات السيارات التفاعلي Q-Murur', 'Q-Murur Interactive Vehicle Alert System', 'Q-Murur Interaktives Fahrzeug-Benachrichtigungssystem'), desc: ml('نظام إرسال الرسائل الفورية وتنبيه أصحاب المركبات', 'Instant messaging and vehicle owner alerts', 'Sofortnachrichten und Fahrzeuginhaber-Benachrichtigungen'), category: 'أنظمة ذكية', codeHtml: `<div class="qr-box">\n  <div class="qr-icon">🚗</div>\n  <h4>نظام QR-Murur الآمن</h4>\n  <p>اضغط لمسح الباركود والتنبيه الفوري</p>\n  <button class="qr-btn" onclick="this.textContent='✓ تم الإرسال!'; this.style.background='#28a745'">مسح الرمز الآن</button>\n</div>`, codeCss: `body { font-family: Tajawal, sans-serif; direction: rtl; background: #fff; }\n.qr-box { padding: 28px; border: 2px dashed #003366; text-align: center; border-radius: 14px; background: #f0f5ff; max-width: 360px; margin: auto; }\n.qr-icon { font-size: 40px; margin-bottom: 12px; }\n.qr-box h4 { color: #003366; font-size: 18px; margin-bottom: 8px; }\n.qr-box p { font-size: 13px; color: #556; margin-bottom: 16px; }\n.qr-btn { background: #003366; color: #fff; border: none; padding: 10px 28px; border-radius: 20px; font-size: 13px; cursor: pointer; font-family: Tajawal, sans-serif; transition: background 0.3s; }` },
  ],
  webProjects: [],
  bookGridSettings: DEFAULT_BOOK_GRID,
  articleGridSettings: DEFAULT_ARTICLE_GRID,
  webGridSettings: DEFAULT_WEB_GRID,
  gfxGridSettings: DEFAULT_GFX_GRID,
  injectedPages: [],
  customCvs: [],
  showAgriCv: false,
  showDesignerCv: false,
  agriCvPlacements: { ...DEFAULT_CV_PLACEMENTS_OFF },
  designCvPlacements: { ...DEFAULT_CV_PLACEMENTS_OFF },
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
  agriWalkthrough: {
    enabled: true,
    autoplay: false,
    defaultSpeed: 1,
    plantImages: [
      '/milk-thistle-field.jpg',
      '/milk-thistle-leaf-field.jpg',
    ],
    steps: [],
  },
};

/* ═══════════════════════════════════════════════════════════
   STORAGE
═══════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'alaa_portfolio_state';
export const ADMIN_EMAIL = 'ala1990999@gmail.com';
export const ADMIN_PASS = '@@@123@@@';
export const LANG_PREF_KEY = 'alaa_lang';

function arr<T>(v: unknown, fallback: T[]): T[] { return Array.isArray(v) ? (v as T[]) : fallback; }

const ML_GARBAGE = new Set(['Array', '[object Object]', 'undefined', 'null']);

function cleanMLPart(s: unknown): string {
  const t = String(s ?? '').trim();
  return ML_GARBAGE.has(t) ? '' : t;
}

export function normML(v: unknown): ML {
  if (Array.isArray(v)) {
    return { ar: cleanMLPart(v[0]), en: cleanMLPart(v[1]), de: cleanMLPart(v[2]) };
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s || ML_GARBAGE.has(s)) return ml('');
    if (s.startsWith('{') || s.startsWith('[')) {
      try { return normML(JSON.parse(s)); } catch { /* plain string */ }
    }
    return ml(s);
  }
  if (v && typeof v === 'object') {
    const o = v as Partial<ML>;
    return { ar: cleanMLPart(o.ar), en: cleanMLPart(o.en), de: cleanMLPart(o.de) };
  }
  return ml('');
}

/** تطبيع ML مع افتراضي عند الفراغ أو القيم التالفة (مثل "Array") */
export function ensureML(v: unknown, fallback: ML): ML {
  const n = normML(v);
  return {
    ar: n.ar || fallback.ar,
    en: n.en || fallback.en,
    de: n.de || fallback.de,
  };
}

function mergeMLField(dbVal: unknown, localVal: unknown): ML {
  const dbM = normML(dbVal);
  const localM = normML(localVal);
  return {
    ar: dbM.ar || localM.ar,
    en: dbM.en || localM.en,
    de: dbM.de || localM.de,
  };
}

function normSection(s: unknown): CvSection | null {
  if (!s || typeof s !== 'object') return null;
  const o = s as Partial<CvSection> & Record<string, unknown>;
  const kinds: CvSectionKind[] = ['header','contact','entries','tags','langtable','skillbars','portfolio','text','documents'];
  const kind = kinds.includes(o.kind as CvSectionKind) ? (o.kind as CvSectionKind) : 'text';
  const column = o.column === 'right' || o.column === 'full' ? o.column : 'left';
  return {
    id: (o.id as string) || uid(), kind, title: normML(o.title), column, visible: o.visible !== false,
    entries: arr<unknown>(o.entries, []).map(e => {
      const x = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
      return {
        id: (x.id as string) || uid(), from: (x.from as string) || '', to: (x.to as string) || '',
        title: normML(x.title), org: normML(x.org), desc: normML(x.desc),
        orgLayout: x.orgLayout === 'inline' ? 'inline' as const : x.orgLayout === 'block' ? 'block' as const : undefined,
        dateTitleLayout: x.dateTitleLayout === 'inline' ? 'inline' as const : x.dateTitleLayout === 'block' ? 'block' as const : undefined,
      };
    }),
    tags: arr<unknown>(o.tags, []).map(normML),
    langTableCols: (() => {
      const cols = arr<unknown>(o.langTableCols, []);
      if (cols.length > 0) {
        return cols.map(c => {
          const x = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
          return { id: (x.id as string) || uid(), header: normML(x.header) };
        });
      }
      return [
        { id: 'name', header: normML('اللغة') },
        { id: 'level', header: normML('المستوى') },
        { id: 'percent', header: normML('%') },
      ];
    })(),
    langTableCellPadPx: (() => {
      const v = o.langTableCellPadPx;
      return typeof v === 'number' ? Math.min(20, Math.max(2, Math.round(v))) : 5;
    })(),
    langTableColGapPx: (() => {
      const v = o.langTableColGapPx;
      return typeof v === 'number' ? Math.min(32, Math.max(0, Math.round(v))) : 0;
    })(),
    langRows: arr<unknown>(o.langRows, []).map(r => {
      const x = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
      const rawCells = x.cells && typeof x.cells === 'object' ? x.cells as Record<string, unknown> : null;
      const cells: Record<string, ML | number | undefined> = {};
      if (rawCells) {
        for (const [k, v] of Object.entries(rawCells)) {
          if (typeof v === 'number') cells[k] = Math.min(100, Math.max(0, Math.round(v)));
          else cells[k] = normML(v);
        }
      } else {
        const pct = typeof x.percent === 'number' ? Math.min(100, Math.max(0, Math.round(x.percent))) : undefined;
        cells.name = normML(x.name);
        cells.level = normML(x.level);
        if (pct !== undefined) cells.percent = pct;
      }
      return { id: (x.id as string) || uid(), cells };
    }),
    contactItems: arr<unknown>(o.contactItems, []).map(c => { const x = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>; return { id: (x.id as string) || uid(), label: normML(x.label), value: normContactValue(x), ltr: x.ltr !== false }; }),
    text: normML(o.text), useGlobalSkills: o.useGlobalSkills === true,
    galleryLayout: [1, 2, 3].includes(o.galleryLayout as number) ? (o.galleryLayout as 1 | 2 | 3) : undefined,
    imgHeight: typeof o.imgHeight === 'number' ? o.imgHeight : undefined,
    pageBreakBefore: o.pageBreakBefore === true,
    editorPage: (() => {
      const n = o.editorPage;
      return typeof n === 'number' && n >= 1 ? Math.min(20, Math.floor(n)) : undefined;
    })(),
    skillIds: arr<string>(o.skillIds, []),
    skillBarColor: typeof o.skillBarColor === 'string' && o.skillBarColor.trim() ? o.skillBarColor.trim() : undefined,
    portfolio: arr<unknown>(o.portfolio, []).map(p => {
      const x = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
      return {
        id: (x.id as string) || uid(),
        img: (x.img as string) || '',
        caption: normML(x.caption),
        gfxItemId: x.gfxItemId as string | undefined,
        description: x.description ? normML(x.description) : undefined,
        toolIds: arr<string>(x.toolIds, []),
        showDesc: x.showDesc === true,
        showTools: x.showTools === true,
        showQr: x.showQr === true,
        qrUrl: (x.qrUrl as string) || undefined,
      };
    }),
  };
}

function normContinuedPages(v: unknown): CvContinuedPages | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Partial<CvContinuedPages> & Record<string, unknown>;
  const headerStyle = (['line', 'bar', 'full-bleed'] as CvHeaderStyle[]).includes(o.headerStyle as CvHeaderStyle)
    ? (o.headerStyle as CvHeaderStyle) : undefined;
  const footerLayout = (['full-bleed', 'content-full', 'bar'] as CvFooterLayout[]).includes(o.footerLayout as CvFooterLayout)
    ? (o.footerLayout as CvFooterLayout) : undefined;
  const pct = (key: 'headerBarWidthPct' | 'footerBarWidthPct') => {
    const n = o[key];
    return typeof n === 'number' && Number.isFinite(n) ? Math.min(100, Math.max(25, Math.round(n))) : undefined;
  };
  const mm = (key: 'headerHeightMm' | 'footerHeightMm') => {
    const n = o[key];
    return typeof n === 'number' && Number.isFinite(n) ? Math.min(55, Math.max(8, Math.round(n))) : undefined;
  };
  return {
    hideHeader: o.hideHeader === true,
    hideFooter: o.hideFooter === true,
    useFirstPageHeader: o.useFirstPageHeader === true,
    useFirstPageFooter: o.useFirstPageFooter === true,
    headerText: o.headerText ? normML(o.headerText) : undefined,
    footerText: o.footerText ? normML(o.footerText) : undefined,
    footerBgColor: typeof o.footerBgColor === 'string' ? o.footerBgColor : undefined,
    headerBgColor: typeof o.headerBgColor === 'string' ? o.headerBgColor : undefined,
    headerStyle,
    headerBarWidthPct: pct('headerBarWidthPct'),
    footerLayout,
    footerBarWidthPct: pct('footerBarWidthPct'),
    footerTextInside: o.footerTextInside === true ? true
      : (o.footerTextInside === false ? false : undefined),
    headerHeightMm: mm('headerHeightMm'),
    footerHeightMm: mm('footerHeightMm'),
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
  const pl = (o.pageLayout ?? (o as Record<string, unknown>).page_layout) as Record<string, unknown> | undefined;
  const plNum = (key: string) => {
    const v = o[key as keyof typeof o] ?? pl?.[key];
    return typeof v === 'number' ? v : undefined;
  };
  return {
    id: (o.id as string) || uid(), name: ensureML(o.name, fallback?.name || CV_DOC_LABELS[(o.id as string) || ''] || ml('CV')),
    removable: o.removable !== undefined ? !!o.removable : (fallback?.removable ?? true),
    accent: (o.accent as string) || (fallback?.accent ?? '#003366'),
    icon: (o.icon as string) || (fallback?.icon ?? 'fa-file-lines'),
    photo: (o.photo as string) ?? (fallback?.photo ?? ''),
    fullName: ensureML(o.fullName, fallback?.fullName || DEFAULT_DATA.name), subtitle: ensureML(o.subtitle, fallback?.subtitle || ml('')),
    since: typeof o.since === 'number' ? o.since : (fallback?.since ?? 2016),
    showInAbout: o.showInAbout !== undefined ? !!o.showInAbout : (fallback?.showInAbout ?? false),
    sections,
    globalColor: (o.globalColor as string) || fallback?.globalColor || (o.accent as string) || '#003366',
    footerBgColor: (o.footerBgColor as string) || fallback?.footerBgColor || '#003366',
    footerText: normML(o.footerText || fallback?.footerText || ml('eng-alaa.com', 'eng-alaa.com', 'eng-alaa.com')),
    headerHeightMm: plNum('headerHeightMm') ?? fallback?.headerHeightMm,
    footerHeightMm: plNum('footerHeightMm') ?? fallback?.footerHeightMm,
    headerPhotoSize: plNum('headerPhotoSize') ?? fallback?.headerPhotoSize,
    continuedPages: normContinuedPages(o.continuedPages ?? pl?.continuedPages) ?? fallback?.continuedPages,
    pageOverrides: (() => {
      const raw = o.pageOverrides ?? pl?.pageOverrides;
      if (!Array.isArray(raw)) return fallback?.pageOverrides;
      const out = raw.map(normContinuedPages).filter((x): x is CvContinuedPages => !!x);
      return out.length ? out : fallback?.pageOverrides;
    })(),
    extraBlankPages: (() => {
      const v = o.extraBlankPages ?? pl?.extraBlankPages;
      if (typeof v !== 'number' || v < 0) return fallback?.extraBlankPages ?? 0;
      return Math.min(20, Math.floor(v));
    })(),
    pageSequence: (() => {
      const raw = o.pageSequence ?? pl?.pageSequence;
      if (!Array.isArray(raw)) return fallback?.pageSequence;
      const out: import('./cvPageSequence').CvPageSlot[] = [];
      for (const s of raw) {
        if (s === 'blank') out.push('blank');
        else if (typeof s === 'number' && s >= 0) out.push(Math.floor(s));
      }
      return out.length ? out : fallback?.pageSequence;
    })(),
    footerLayout: (['full-bleed', 'content-full', 'bar'] as CvFooterLayout[]).includes((o.footerLayout ?? pl?.footerLayout) as CvFooterLayout)
      ? ((o.footerLayout ?? pl?.footerLayout) as CvFooterLayout) : fallback?.footerLayout,
    footerBarWidthPct: plNum('footerBarWidthPct') ?? fallback?.footerBarWidthPct,
    footerTextInside: o.footerTextInside === true || pl?.footerTextInside === true ? true
      : (o.footerTextInside === false || pl?.footerTextInside === false ? false : fallback?.footerTextInside),
    sidebarDocs, qrCredentials,
    qrGridCols: (() => {
      const v = o.qrGridCols ?? pl?.qrGridCols;
      const n = typeof v === 'number' ? Math.round(v) : 0;
      return ([2, 3, 4, 5] as const).includes(n as 2 | 3 | 4 | 5) ? (n as 2 | 3 | 4 | 5) : (fallback?.qrGridCols ?? 3);
    })(),
    pdfFiles: (() => {
      const pf = o.pdfFiles ?? pl?.pdfFiles;
      if (!pf || typeof pf !== 'object') return fallback?.pdfFiles;
      const m = pf as Record<string, unknown>;
      const out: Partial<Record<LangKey, string>> = {};
      for (const k of ['ar', 'en', 'de'] as LangKey[]) {
        const raw = typeof m[k] === 'string' ? (m[k] as string).trim() : '';
        if (raw && !raw.startsWith('blob:')) out[k] = raw;
      }
      return Object.keys(out).length ? out : fallback?.pdfFiles;
    })(),
    typography: (() => {
      const merged = normCvTypography(o.typography ?? pl?.typography);
      return Object.keys(merged).length ? merged : fallback?.typography;
    })(),
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
    menuTextColor: typeof o.menuTextColor === 'string' && (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(o.menuTextColor.trim()) || o.menuTextColor.trim() === '')
      ? o.menuTextColor.trim()
      : '',
    buttonBgColor: typeof o.buttonBgColor === 'string' ? o.buttonBgColor.trim() : '',
    buttonTextColor: typeof o.buttonTextColor === 'string' ? o.buttonTextColor.trim() : '',
    gfxFreeDownloadBtnColor: typeof o.gfxFreeDownloadBtnColor === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(o.gfxFreeDownloadBtnColor.trim())
      ? o.gfxFreeDownloadBtnColor.trim()
      : (typeof o.gfxFreeDownloadBtnColor === 'string' && o.gfxFreeDownloadBtnColor.trim() === '' ? '' : ''),
    siteFontFamily: typeof o.siteFontFamily === 'string' && o.siteFontFamily.trim()
      ? o.siteFontFamily.trim()
      : DEFAULT_SITE_SETTINGS.siteFontFamily,
    baseFontSize: typeof o.baseFontSize === 'number' && isFinite(o.baseFontSize)
      ? Math.min(24, Math.max(12, Math.round(o.baseFontSize)))
      : DEFAULT_SITE_SETTINGS.baseFontSize,
    bodyTextColor: typeof o.bodyTextColor === 'string' ? o.bodyTextColor.trim() : '',
    headingTextColor: typeof o.headingTextColor === 'string' ? o.headingTextColor.trim() : '',
    mutedTextColor: typeof o.mutedTextColor === 'string' ? o.mutedTextColor.trim() : '',
    glassOpacity: typeof o.glassOpacity === 'number' && isFinite(o.glassOpacity) ? Math.min(0.95, Math.max(0.05, o.glassOpacity)) : DEFAULT_SITE_SETTINGS.glassOpacity,
    threeScriptUrl: typeof o.threeScriptUrl === 'string' ? o.threeScriptUrl : '',
    visitorGpsPromptEnabled: o.visitorGpsPromptEnabled === true,
    aboutHeroMedia: typeof o.aboutHeroMedia === 'string' ? o.aboutHeroMedia.trim() : '',
    aboutHeroKind: o.aboutHeroKind === 'image' || o.aboutHeroKind === 'video' ? o.aboutHeroKind : 'auto',
    aboutNameBadgeVisible: o.aboutNameBadgeVisible !== false,
    aboutNameBadgeBottomDesktop: typeof o.aboutNameBadgeBottomDesktop === 'number' && isFinite(o.aboutNameBadgeBottomDesktop)
      ? Math.min(600, Math.max(-600, Math.round(o.aboutNameBadgeBottomDesktop)))
      : DEFAULT_SITE_SETTINGS.aboutNameBadgeBottomDesktop,
    aboutNameBadgeBottomMobile: typeof o.aboutNameBadgeBottomMobile === 'number' && isFinite(o.aboutNameBadgeBottomMobile)
      ? Math.min(600, Math.max(-600, Math.round(o.aboutNameBadgeBottomMobile)))
      : DEFAULT_SITE_SETTINGS.aboutNameBadgeBottomMobile,
    aboutNameBadgePadY: typeof o.aboutNameBadgePadY === 'number' && isFinite(o.aboutNameBadgePadY)
      ? Math.min(24, Math.max(2, Math.round(o.aboutNameBadgePadY)))
      : DEFAULT_SITE_SETTINGS.aboutNameBadgePadY,
    homeIntroVideo: typeof o.homeIntroVideo === 'string' ? o.homeIntroVideo.trim() : '',
    reportGalleryShowCustomerName: o.reportGalleryShowCustomerName !== false,
    reportGalleryColsMobile: typeof o.reportGalleryColsMobile === 'number' && isFinite(o.reportGalleryColsMobile)
      ? Math.min(4, Math.max(1, Math.round(o.reportGalleryColsMobile)))
      : DEFAULT_SITE_SETTINGS.reportGalleryColsMobile,
    reportGalleryColsDesktop: typeof o.reportGalleryColsDesktop === 'number' && isFinite(o.reportGalleryColsDesktop)
      ? Math.min(6, Math.max(1, Math.round(o.reportGalleryColsDesktop)))
      : DEFAULT_SITE_SETTINGS.reportGalleryColsDesktop,
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
    const posterTime = typeof o.posterTimeSec === 'number' && isFinite(o.posterTimeSec)
      ? Math.max(0, o.posterTimeSec)
      : (typeof o.poster_time_sec === 'number' && isFinite(o.poster_time_sec as number)
        ? Math.max(0, o.poster_time_sec as number)
        : undefined);
    return {
      id: (o.id as string) || uid(),
      title: normML(o.title),
      url: (o.url as string) || '',
      visible: o.visible !== false,
      poster: typeof o.poster === 'string' ? o.poster : '',
      posterTimeSec: posterTime,
      autoplay: o.autoplay === true || o.autoplay === 1 || o.autoplay === '1',
      loop: o.loop !== false && o.loop !== 0 && o.loop !== '0',
      muted: o.muted === true || o.muted === 1 || o.muted === '1',
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
      customerName: normPersonML(o.customerName),
      customerPhone: (o.customerPhone as string) || '',
      customerLocation: normPersonML(o.customerLocation),
      attendanceDate: (o.attendanceDate as string) || '',
      examDate: (o.examDate as string) || '',
      images: arr<unknown>(o.images, []).filter((x): x is string => typeof x === 'string'),
      plantName: normML(o.plantName),
      description: normML(o.description),
      soilRows: arr<unknown>(o.soilRows, []).map(rr => {
        const x = (rr && typeof rr === 'object' ? rr : {}) as Record<string, unknown>;
        return {
          id: (x.id as string) || uid(),
          test: normML(x.test),
          actual: normPersonML(x.actual),
          ideal: normML(x.ideal),
        };
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
      academicYear: o.academicYear ? normML(o.academicYear) : undefined,
      semester: o.semester ? normML(o.semester) : undefined,
      subject: o.subject ? normML(o.subject) : undefined,
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

export function applyDefaultCatalog(data: AppData): AppData {
  return mergeSoilReportSamples({
    ...data,
    articleCategories: resolveArticleCategories(data.articleCategories),
    gfxCategories: resolveGfxCategories(data.gfxCategories),
  });
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return applyDefaultCatalog(DEFAULT_DATA);
    const src = JSON.parse(raw) as Partial<AppData> & Record<string, unknown>;

    const defaultDocs = DEFAULT_CV_DOCS;
    const rawDocs = arr<unknown>(src.cvDocs, []);
    const cvDocs: CvDoc[] = rawDocs.length
      ? rawDocs.map((d, i) => normDoc(d, defaultDocs[i]) ?? defaultDocs[0]).filter(Boolean)
      : defaultDocs;
    if (!cvDocs.find(d => d.id === 'agri')) cvDocs.unshift(defaultDocs[0]);
    if (!cvDocs.find(d => d.id === 'dev')) cvDocs.splice(1, 0, defaultDocs[1]);

    const skills = arr<Skill>(src.skills, DEFAULT_DATA.skills).map(s => ({
      ...s,
      size: s.size ?? 26,
      showOnAbout: s.showOnAbout !== false,
    }));

    const normAiVault = arr<unknown>(src.aiVault, []).map((v: unknown) => {
      if (!v || typeof v !== 'object') return null;
      const o = v as Record<string, unknown>;
      if ('title' in o && typeof o.title === 'string') {
        return { id: uid(), title: ml(o.title as string), prompt: (o.prompt as string) || '', img: (o.img as string) || '', categoryId: '', subCategoryId: '' } as AiVaultItem;
      }
      return v as AiVaultItem;
    }).filter(Boolean) as AiVaultItem[];

    const normGfxCats = resolveGfxCategories(normGfxCategoriesFromJson(src.gfxCategories));

    const nameDisplayRaw = src.nameDisplay as string | undefined;
    const nameDisplay: NameDisplayMode =
      nameDisplayRaw === 'handwriting' || nameDisplayRaw === 'logo' ? nameDisplayRaw : 'text';

    return {
      name: ensureML(src.name, DEFAULT_DATA.name),
      nameDisplay,
      nameLogo: (src.nameLogo as string) || '',
      nameLogoColor: (src.nameLogoColor as string) || DEFAULT_DATA.nameLogoColor,
      nameShimmer: src.nameShimmer !== false,
      nameShimmerSpeed: typeof src.nameShimmerSpeed === 'number'
        ? Math.min(25, Math.max(0, src.nameShimmerSpeed))
        : DEFAULT_DATA.nameShimmerSpeed,
      nameShimmerColor: (src.nameShimmerColor as string) || DEFAULT_DATA.nameShimmerColor,
      nameShimmerAngle: typeof src.nameShimmerAngle === 'number'
        ? Math.min(360, Math.max(0, Math.round(src.nameShimmerAngle)))
        : DEFAULT_DATA.nameShimmerAngle,
      nameShimmerMotion: src.nameShimmerMotion !== false,
      nameShimmerDirection: src.nameShimmerDirection === 'ltr' ? 'ltr' : 'rtl',
      nameShimmerWidth: typeof src.nameShimmerWidth === 'number'
        ? Math.min(0.22, Math.max(0.03, src.nameShimmerWidth))
        : DEFAULT_DATA.nameShimmerWidth,
      bio: ensureML(src.bio, DEFAULT_DATA.bio),
      skills,
      personalInfo: { ...DEFAULT_PERSONAL_INFO, ...(src.personalInfo as object || {}) },
      agriCv: normalizeProfile(src.agriCv, DEFAULT_AGRI_CV),
      devCv: normalizeProfile(src.devCv, DEFAULT_DEV_CV),
      agriCats: arr(src.agriCats, DEFAULT_DATA.agriCats),
      articleCategories: resolveArticleCategories(normArticleCategories(src.articleCategories)),
      agriArticles: normArticles(src.agriArticles),
      libraryTree: normLibraryTree(src.libraryTree),
      libraryView: src.libraryView === 'expanded' ? 'expanded' : 'tree',
      agriBooks: normBooks(src.agriBooks),
      gfxGallery: arr(src.gfxGallery, DEFAULT_DATA.gfxGallery),
      gfxCategories: normGfxCats,
      aiVault: normAiVault.length ? normAiVault : DEFAULT_DATA.aiVault,
      softwareSnippets: arr(src.softwareSnippets, DEFAULT_DATA.softwareSnippets).map((p: unknown) => {
        const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
        return {
          id: (o.id as string) || undefined,
          title: normML(o.title),
          desc: normML(o.desc),
          codeHtml: (o.codeHtml as string) || '',
          codeCss: (o.codeCss as string) || '',
          codeJs: (o.codeJs as string) || '',
          category: (o.category as string) || '',
        } as SoftwareSnippet;
      }),
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
          googlePlayVisible: o.googlePlayVisible !== false,
          appleStoreVisible: o.appleStoreVisible !== false,
          textColor: (o.textColor as string) || '',
          imgBgColor: (o.imgBgColor as string) || '',
        } as WebProject;
      }),
      webGridSettings: { ...DEFAULT_WEB_GRID, ...(src.webGridSettings && typeof src.webGridSettings === 'object' ? src.webGridSettings as Partial<WebGridSettings> : {}) },
      gfxGridSettings: { ...DEFAULT_GFX_GRID, ...(src.gfxGridSettings && typeof src.gfxGridSettings === 'object' ? src.gfxGridSettings as Partial<GfxGridSettings> : {}), paddingMobile: typeof (src.gfxGridSettings as any)?.paddingMobile === 'number' ? (src.gfxGridSettings as any).paddingMobile : DEFAULT_GFX_GRID.paddingMobile, imgHeight: typeof (src.gfxGridSettings as any)?.imgHeight === 'number' ? (src.gfxGridSettings as any).imgHeight : DEFAULT_GFX_GRID.imgHeight, cardMinWidth: typeof (src.gfxGridSettings as any)?.cardMinWidth === 'number' ? (src.gfxGridSettings as any).cardMinWidth : DEFAULT_GFX_GRID.cardMinWidth },
      injectedPages: arr(src.injectedPages, []),
      customCvs: arr(src.customCvs, []),
      agriCvPlacements: normCvPlacements(src.agriCvPlacements, src.showAgriCv === true, 'agri'),
      designCvPlacements: normCvPlacements(src.designCvPlacements, src.showDesignerCv === true, 'design'),
      showAgriCv: cvPlacementsActive(normCvPlacements(src.agriCvPlacements, src.showAgriCv === true, 'agri')),
      showDesignerCv: cvPlacementsActive(normCvPlacements(src.designCvPlacements, src.showDesignerCv === true, 'design')),
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
      articleGridSettings: { ...DEFAULT_ARTICLE_GRID, ...(src.articleGridSettings && typeof src.articleGridSettings === 'object' ? src.articleGridSettings as Partial<ArticleGridSettings> : {}) },
      watermarkImg: (src.watermarkImg as string) || '',
      watermarkOpacity: typeof src.watermarkOpacity === 'number' ? src.watermarkOpacity : 0.15,
      agriWalkthrough: (() => {
        const raw = src.agriWalkthrough && typeof src.agriWalkthrough === 'object'
          ? src.agriWalkthrough as Record<string, unknown>
          : {};
        return {
          enabled: raw.enabled !== false,
          autoplay: raw.autoplay === true,
          defaultSpeed: typeof raw.defaultSpeed === 'number'
            ? Math.max(0.5, Math.min(3, raw.defaultSpeed))
            : 1,
          plantImages: arr<string>(raw.plantImages, DEFAULT_DATA.agriWalkthrough?.plantImages || []),
          steps: arr<unknown>(raw.steps, []).map(value => {
            const step = value && typeof value === 'object' ? value as Record<string, unknown> : {};
            const audioRaw = step.audio && typeof step.audio === 'object'
              ? step.audio as Record<string, unknown>
              : {};
            return {
              id: String(step.id || ''),
              enabled: step.enabled !== false,
              title: step.title ? normML(step.title) : undefined,
              body: step.body ? normML(step.body) : undefined,
              durationMs: typeof step.durationMs === 'number'
                ? Math.max(1500, Math.min(30000, step.durationMs))
                : undefined,
              audio: {
                ar: typeof audioRaw.ar === 'string' ? audioRaw.ar : '',
                en: typeof audioRaw.en === 'string' ? audioRaw.en : '',
                de: typeof audioRaw.de === 'string' ? audioRaw.de : '',
              },
            } as WalkthroughStepSettings;
          }).filter(step => step.id),
        } as AgriWalkthroughSettings;
      })(),
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
  } catch { return applyDefaultCatalog(DEFAULT_DATA); }
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

/** Read a local file as data-URL (fallback when server upload is unavailable). */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** تصغير صورة قبل التخزين المحلي — يمنع تجاوز حد TEXT في قاعدة البيانات (~64KB). */
export async function compressImageFileForStorage(
  file: File,
  maxWidth = 800,
  mime: 'image/png' | 'image/jpeg' = 'image/png',
): Promise<string> {
  if (!file.type.startsWith('image/')) return readFileAsDataUrl(file);

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        readFileAsDataUrl(file).then(resolve).catch(reject);
        return;
      }
      if (mime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL(mime, mime === 'image/jpeg' ? 0.88 : undefined));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      readFileAsDataUrl(file).then(resolve).catch(reject);
    };
    img.src = objectUrl;
  });
}

/**
 * Upload a media file to Hostinger (api/upload.php).
 * Returns public URL on success, null if not logged in or upload failed.
 */
export async function uploadMediaFile(
  file: File,
  folder: 'projects' | 'books' | 'reports' | 'gfx' | 'general' | 'skills' | 'cv' | 'walkthrough' = 'general',
): Promise<string | null> {
  const token = getApiToken();
  if (!token) return null;
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);
    const res = await fetch('/api/upload.php', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const json = await res.json().catch(() => ({})) as { url?: string; error?: string };
    if (!res.ok || !json.url) return null;
    return json.url;
  } catch {
    return null;
  }
}

/**
 * تسجيل دخول Admin على سيرفر Hostinger.
 * يُرجع true عند النجاح وحفظ التوكن.
 */
export async function loginToApi(username: string, password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth.php', {
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

/**
 * يستعيد جلسة الإدارة من التوكن الحالي أو من HttpOnly refresh cookie.
 * لا تُخزّن كلمة المرور في المتصفح أو في ملفات JavaScript.
 */
export async function restoreApiSession(): Promise<boolean> {
  const token = getApiToken();
  try {
    const res = await fetch('/api/auth.php', {
      method: 'GET',
      credentials: 'same-origin',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      clearApiToken();
      return false;
    }
    const json = await res.json() as { token?: string };
    if (!json.token) {
      clearApiToken();
      return false;
    }
    setApiToken(json.token);
    return true;
  } catch {
    return !!token;
  }
}

/** إنهاء جلسة الخادم وحذف التوكن المحلي والـ HttpOnly cookie. */
export async function logoutFromApi(): Promise<void> {
  try {
    await fetch('/api/auth.php', { method: 'DELETE', credentials: 'same-origin' });
  } catch { /* حذف التوكن المحلي يبقى مضموناً */ }
  clearApiToken();
}

/* ═══════════════════════════════════════════════════════════
   SAVE / LOAD
═══════════════════════════════════════════════════════════ */

/**
 * يحفظ البيانات في localStorage (دائماً)
 * ويُزامنها مع قاعدة البيانات على Hostinger (إذا كان التوكن موجوداً).
 * @returns true إذا نجحت المزامنة مع الخادم، false إذا حُفظ محلياً فقط
 */
export async function saveAppData(data: AppData): Promise<boolean> {
  const normalized = applyDefaultCatalog(data);
  const stripTplImgForLocal = (rt: ReportTemplate): ReportTemplate => {
    const keys = ['headerLogo', 'engSignature', 'engStamp', 'paidStamp'] as const;
    const out = { ...rt };
    for (const k of keys) {
      const v = out[k];
      if (v.startsWith('data:') || v.startsWith('blob:')) out[k] = '';
    }
    return out;
  };
  /* لا نخزّن PDF ضخمة base64 في localStorage — فقط روابط الخادم */
  const forLocal: AppData = {
    ...normalized,
    reportTemplate: stripTplImgForLocal(normalized.reportTemplate),
    cvDocs: normalized.cvDocs.map(d => {
      if (!d.pdfFiles) return d;
      const pf: Partial<Record<LangKey, string>> = {};
      for (const k of ['ar', 'en', 'de'] as LangKey[]) {
        const v = d.pdfFiles[k];
        if (v && !v.startsWith('data:') && !v.startsWith('blob:')) pf[k] = v;
      }
      return { ...d, pdfFiles: Object.keys(pf).length ? pf : undefined };
    }),
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(forLocal)); } catch { /* storage full */ }

  /* مزامنة كاملة مع الخادم (تتضمن pdfFiles URLs) */
  const token = getApiToken();
  if (!token) return false;
  try {
    const res = await fetch('/api/data.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(normalized),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** جلب إعدادات الثيم فقط من السيرفر — خفيف للتحديث الفوري للزوار */
export async function fetchSiteSettingsFromDb(): Promise<SiteSettings | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('/api/data.php?section=siteSettings', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const raw = await res.json() as { ok?: boolean; dbIsSeeded?: boolean; siteSettings?: unknown };
    if (!raw?.ok || !raw.dbIsSeeded || !raw.siteSettings) return null;
    return normSiteSettings(raw.siteSettings);
  } catch {
    return null;
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

    const res = await fetch('/api/data.php', {
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

    /* DB مُهيّأة: نمزج بيانات localStorage مع DB (المرجع الأساسي) */
    const local = loadAppData();
    const { dbIsSeeded: _flag, ...dbData } = raw;
    const merged: Record<string, unknown> = { ...local, ...dbData };
    merged.name = ensureML(mergeMLField(dbData.name, local.name), DEFAULT_DATA.name);
    merged.bio = ensureML(mergeMLField(dbData.bio, local.bio), DEFAULT_DATA.bio);
    const dbDocs = Array.isArray(dbData.cvDocs) ? dbData.cvDocs as CvDoc[] : [];
    const localDocs = local.cvDocs || [];
    const isAdminSession = !!getApiToken();
    merged.cvDocs = dbDocs.map(doc => {
      const localDoc = localDocs.find(d => d.id === doc.id);
      if (!localDoc) return doc;
      /* زائر / جوال: قاعدة البيانات هي المصدر — لا نستخدم نسخة localStorage القديمة */
      if (!isAdminSession) {
        const pdfFiles = { ...(localDoc.pdfFiles || {}), ...(doc.pdfFiles || {}) };
        return { ...doc, name: mergeMLField(doc.name, localDoc.name), pdfFiles };
      }
      const localSections = JSON.stringify(localDoc.sections ?? []);
      const dbSections = JSON.stringify(doc.sections ?? []);
      if (localSections !== dbSections) {
        return { ...localDoc, name: mergeMLField(doc.name, localDoc.name) };
      }
      const pdfFiles = { ...(localDoc.pdfFiles || {}), ...(doc.pdfFiles || {}) };
      return { ...doc, name: mergeMLField(doc.name, localDoc.name), pdfFiles };
    });
    for (const ld of localDocs) {
      if (!dbDocs.some(d => d.id === ld.id)) {
        (merged.cvDocs as CvDoc[]).push(ld);
      }
    }
    /* إعدادات الشبكة: لا نستبدل بقيمة null من DB إن وُجدت محلياً */
    const dbRec = dbData as unknown as Record<string, unknown>;
    const localRec = local as unknown as Record<string, unknown>;
    for (const k of ['bookGridSettings', 'articleGridSettings', 'gfxGridSettings', 'webGridSettings', 'agriCvPlacements', 'designCvPlacements'] as const) {
      if (dbRec[k] == null && localRec[k] != null) {
        merged[k] = localRec[k];
      }
    }
    if (dbData.reportTemplate && local.reportTemplate) {
      const dbRt = dbData.reportTemplate as Partial<ReportTemplate>;
      const localRt = local.reportTemplate;
      const pickTplImg = (dbVal?: string, localVal?: string) => {
        const d = (dbVal || '').trim();
        const l = (localVal || '').trim();
        if (d && (!l || d.length >= l.length)) return d;
        return l || d;
      };
      merged.reportTemplate = {
        ...normReportTemplate(merged.reportTemplate),
        headerLogo: pickTplImg(dbRt.headerLogo, localRt.headerLogo),
        engSignature: pickTplImg(dbRt.engSignature, localRt.engSignature),
        engStamp: pickTplImg(dbRt.engStamp, localRt.engStamp),
        paidStamp: pickTplImg(dbRt.paidStamp, localRt.paidStamp),
      };
    }
    const mergedStr = JSON.stringify(merged);

    /* نحفظ محلياً لتسريع التحميل في المرة القادمة */
    try { localStorage.setItem(STORAGE_KEY, mergedStr); } catch { /* */ }

    return loadAppData();
  } catch {
    return null;
  }
}

/** دمج تثبيت الصفحات من النسخة المحلية — المعاينة/المحرر قد تسبق DB */
export function mergeCvLayoutFromLocal(local: CvDoc, remote: CvDoc): CvDoc {
  const localPages = new Map(local.sections.map(s => [s.id, s.editorPage]));
  return {
    ...remote,
    pageSequence: local.pageSequence?.length ? local.pageSequence : remote.pageSequence,
    extraBlankPages: local.extraBlankPages ?? remote.extraBlankPages,
    sections: remote.sections.map(s => {
      const editorPage = localPages.get(s.id);
      if (typeof editorPage === 'number' && editorPage >= 2) {
        return { ...s, editorPage };
      }
      if (editorPage === undefined && localPages.has(s.id)) {
        const { editorPage: _removed, ...rest } = s;
        return rest;
      }
      return s;
    }),
  };
}

/** جلب سيرة + مهارات مباشرة من DB للتصدير — يتجاوز localStorage القديم على الجوال */
export async function fetchCvExportFromDb(docId: string): Promise<{
  doc: CvDoc | null;
  skills: Skill[];
  name: ML;
} | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('/api/data.php', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const raw = await res.json() as Record<string, unknown>;
    if (!raw || typeof raw !== 'object' || !raw.dbIsSeeded) return null;

    const defaultDocs = DEFAULT_CV_DOCS;
    const rawDocs = arr<unknown>(raw.cvDocs, []);
    const cvDocs: CvDoc[] = rawDocs.length
      ? rawDocs.map((d, i) => normDoc(d, defaultDocs[i]) ?? defaultDocs[0]).filter(Boolean) as CvDoc[]
      : defaultDocs;

    const skills = arr<Skill>(raw.skills, DEFAULT_DATA.skills).map(s => ({ ...s, size: s.size ?? 26 }));
    const name = ensureML(raw.name, DEFAULT_DATA.name);
    const doc = cvDocs.find(d => d.id === docId) ?? null;
    return { doc, skills, name };
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   STATIC data.json — مكتبة / مقالات / تصاميم (Shared Hosting)
   ارفع public/data.json إلى public_html — بدون Build على السيرفر
═══════════════════════════════════════════════════════════ */

/** هيكلية data.json — مرنة ومتعددة اللغات (ar | en | de) */
export interface SiteContentJson {
  version?: number;
  updated?: string;
  library?: {
    view?: LibraryView;
    tree?: unknown[];
    books?: unknown[];
  };
  articles?: {
    categories?: unknown[];
    items?: unknown[];
  };
  designs?: {
    categories?: unknown[];
  };
}

function normGfxProjectItem(o: unknown): GfxProjectItem {
  const x = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>;
  const cv = (x.cvSettings && typeof x.cvSettings === 'object' ? x.cvSettings : {}) as Record<string, unknown>;
  return {
    id: (x.id as string) || uid(),
    title: normML(x.title),
    desc: normML(x.desc),
    mainImg: (x.mainImg as string) || '',
    mainImgNoWm: !!x.mainImgNoWm,
    mainImgIsVideo: !!x.mainImgIsVideo,
    images: arr<string>(x.images, []),
    imagesNoWm: arr<boolean>(x.imagesNoWm, []),
    imagesIsVideo: arr<boolean>(x.imagesIsVideo, []),
    videoUrl: (x.videoUrl as string) || '',
    usedSkillsIds: arr<string>(x.usedSkillsIds, []),
    cvSettings: {
      isFeatured: cv.isFeatured !== false,
      imgSize: typeof cv.imgSize === 'number' ? cv.imgSize : 100,
      showDesc: cv.showDesc !== false,
      showTools: cv.showTools !== false,
    },
    glbUrl: (x.glbUrl as string) || undefined,
    glbIsPaid: !!x.glbIsPaid,
    glbPrice: (x.glbPrice as string) || undefined,
    glbCurrency: (x.glbCurrency as string) || undefined,
    glbFreeUrl: (x.glbFreeUrl as string) || undefined,
    glbViewSettings: normGfxModel3dSettings(x.glbViewSettings),
    downloadLinks: normGfxDownloadLinks(x.downloadLinks),
    sourceFileUrl: (x.sourceFileUrl as string) || undefined,
    sourceFileVisible: x.sourceFileVisible !== false,
    sourceFilePassword: (x.sourceFilePassword as string) || undefined,
    sourceFileLabel: (x.sourceFileLabel as string) || undefined,
  };
}

function normGfxCategoriesFromJson(s: unknown): GfxCategory[] {
  return arr<unknown>(s, []).map(cat => {
    const o = (cat && typeof cat === 'object' ? cat : {}) as Record<string, unknown>;
    const subCategories = arr<unknown>(o.subCategories, []).map(sub => {
      const so = (sub && typeof sub === 'object' ? sub : {}) as Record<string, unknown>;
      return {
        id: (so.id as string) || uid(),
        name: normML(so.name),
        items: arr<unknown>(so.items, []).map(normGfxProjectItem),
      };
    });
    return {
      id: (o.id as string) || uid(),
      name: normML(o.name),
      icon: (o.icon as string) || 'fa-palette',
      subCategories,
    };
  });
}

/** يحوّل محتوى data.json إلى حقول AppData (كتب + مقالات + تصاميم) */
export function contentPatchFromJson(raw: unknown): Partial<AppData> | null {
  if (!raw || typeof raw !== 'object') return null;
  const j = raw as SiteContentJson & Record<string, unknown>;
  const patch: Partial<AppData> = {};

  const lib = j.library;
  if (lib && typeof lib === 'object') {
    if (lib.tree) patch.libraryTree = normLibraryTree(lib.tree);
    if (lib.books) patch.agriBooks = normBooks(lib.books);
    if (lib.view) patch.libraryView = lib.view === 'expanded' ? 'expanded' : 'tree';
  }

  const arts = j.articles;
  if (arts && typeof arts === 'object') {
    if (arts.categories) patch.articleCategories = normArticleCategories(arts.categories);
    if (arts.items) patch.agriArticles = normArticles(arts.items);
  }

  const des = j.designs;
  if (des && typeof des === 'object' && des.categories) {
    patch.gfxCategories = normGfxCategoriesFromJson(des.categories);
  }

  if (j.libraryTree) patch.libraryTree = normLibraryTree(j.libraryTree);
  if (j.agriBooks) patch.agriBooks = normBooks(j.agriBooks);
  if (j.articleCategories) patch.articleCategories = normArticleCategories(j.articleCategories);
  if (j.agriArticles) patch.agriArticles = normArticles(j.agriArticles);
  if (j.gfxCategories) patch.gfxCategories = normGfxCategoriesFromJson(j.gfxCategories);

  return Object.keys(patch).length ? patch : null;
}

/** دمج محتوى data.json فوق البيانات الحالية (المكتبة والمقالات والتصاميم فقط) */
export function mergeSiteContent(base: AppData, patch: Partial<AppData>): AppData {
  return {
    ...base,
    ...(patch.libraryTree !== undefined && { libraryTree: patch.libraryTree }),
    ...(patch.libraryView !== undefined && { libraryView: patch.libraryView }),
    ...(patch.agriBooks !== undefined && { agriBooks: patch.agriBooks }),
    ...(patch.articleCategories !== undefined && { articleCategories: patch.articleCategories }),
    ...(patch.agriArticles !== undefined && { agriArticles: patch.agriArticles }),
    ...(patch.gfxCategories !== undefined && { gfxCategories: patch.gfxCategories }),
  };
}

const SITE_CONTENT_JSON_URL = './data.json';
const DATA_JSON_SKIP_KEY = 'eng_skip_data_json_v1';

/** جلب data.json من السيرفر — يُحدَّث فور رفع الملف عبر SFTP (اختياري إن وُجد MySQL) */
export async function loadSiteContentFromJson(url = SITE_CONTENT_JSON_URL): Promise<Partial<AppData> | null> {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DATA_JSON_SKIP_KEY) === '1') {
      return null;
    }
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
    if (res.status === 404) {
      try { sessionStorage.setItem(DATA_JSON_SKIP_KEY, '1'); } catch { /* ignore */ }
      return null;
    }
    if (!res.ok) return null;
    const raw = await res.json();
    return contentPatchFromJson(raw);
  } catch {
    return null;
  }
}
