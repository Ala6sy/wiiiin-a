import type { GfxCategory, GfxProjectItem, GfxSubCategory, ML } from './appData';
import { ml, uid } from './appData';

const ml3 = (ar: string, en: string, de: string): ML => ml(ar, en, de);

/** تصنيفات رئيسية تُملأ بمشاريع نموذجية */
export const GFX_SEED_CATEGORY_IDS = new Set([
  'gfx-landscape',
  'gfx-decor',
  'gfx-prints',
  'gfx-screens',
]);

/** ربط معرّفات قديمة بقالب البذور */
const SUB_SEED_ALIAS: Record<string, string> = {
  'gfx-landscape-general': 'gfx-landscape-villas',
  'gfx-prints-brochures': 'gfx-prints-boxes',
  'gfx-screens-wall': 'gfx-screens-outdoor',
  'gfx-screens-hologram': 'gfx-screens-kiosk',
};

const STYLES = [
  { ar: 'عصري', en: 'Modern', de: 'Modern' },
  { ar: 'كلاسيكي', en: 'Classic', de: 'Klassisch' },
  { ar: 'مينيمال', en: 'Minimal', de: 'Minimalistisch' },
  { ar: 'فاخر', en: 'Luxury', de: 'Luxuriös' },
  { ar: 'طبيعي', en: 'Natural', de: 'Natürlich' },
  { ar: 'صناعي', en: 'Industrial', de: 'Industrial' },
  { ar: 'شمال أوروبي', en: 'Scandinavian', de: 'Skandinavisch' },
  { ar: 'معاصر', en: 'Contemporary', de: 'Zeitgenössisch' },
  { ar: 'تراثي', en: 'Heritage', de: 'Traditionell' },
  { ar: 'مبتكر', en: 'Innovative', de: 'Innovativ' },
] as const;

type SubSeedKey =
  | 'gfx-landscape-villas'
  | 'gfx-landscape-public'
  | 'gfx-decor-living'
  | 'gfx-decor-bedrooms'
  | 'gfx-decor-kitchens'
  | 'gfx-decor-buildings'
  | 'gfx-prints-cards'
  | 'gfx-prints-letterhead'
  | 'gfx-prints-boxes'
  | 'gfx-prints-billboards'
  | 'gfx-prints-gifts'
  | 'gfx-screens-indoor'
  | 'gfx-screens-outdoor'
  | 'gfx-screens-flex'
  | 'gfx-screens-kiosk';

interface SubSeedMeta {
  focusAr: string;
  focusEn: string;
  focusDe: string;
  tools: string;
  fileLabel: string;
}

const SUB_META: Record<SubSeedKey, SubSeedMeta> = {
  'gfx-landscape-villas': {
    focusAr: 'حدائق فلل سكنية',
    focusEn: 'residential villa gardens',
    focusDe: 'Villengärten',
    tools: 'AutoCAD, SketchUp, Lumion',
    fileLabel: 'DWG',
  },
  'gfx-landscape-public': {
    focusAr: 'حدائق ومتنزهات عامة',
    focusEn: 'public parks and gardens',
    focusDe: 'öffentliche Parks',
    tools: 'AutoCAD, Photoshop, Lumion',
    fileLabel: 'DWG',
  },
  'gfx-decor-living': {
    focusAr: 'غرف معيشة واستقبال',
    focusEn: 'living and lounge spaces',
    focusDe: 'Wohn- und Empfangsräume',
    tools: '3ds Max, V-Ray, Photoshop',
    fileLabel: 'MAX',
  },
  'gfx-decor-bedrooms': {
    focusAr: 'غرف نوم',
    focusEn: 'bedroom interiors',
    focusDe: 'Schlafzimmer',
    tools: '3ds Max, Corona, Photoshop',
    fileLabel: 'MAX',
  },
  'gfx-decor-kitchens': {
    focusAr: 'مطابخ عصرية',
    focusEn: 'modern kitchens',
    focusDe: 'moderne Küchen',
    tools: 'SketchUp, V-Ray, AutoCAD',
    fileLabel: 'SKP',
  },
  'gfx-decor-buildings': {
    focusAr: 'واجهات مبانٍ وفلل',
    focusEn: 'building and villa facades',
    focusDe: 'Gebäude- & Villenfassaden',
    tools: 'AutoCAD, 3ds Max, Photoshop',
    fileLabel: 'DWG',
  },
  'gfx-prints-cards': {
    focusAr: 'بطاقات أعمال',
    focusEn: 'business cards',
    focusDe: 'Visitenkarten',
    tools: 'Illustrator, InDesign',
    fileLabel: 'AI',
  },
  'gfx-prints-letterhead': {
    focusAr: 'ورق رسمي وهوية مكتبية',
    focusEn: 'letterhead and stationery',
    focusDe: 'Briefpapier',
    tools: 'Illustrator, InDesign',
    fileLabel: 'AI',
  },
  'gfx-prints-boxes': {
    focusAr: 'تغليف وبوكسات',
    focusEn: 'packaging and boxes',
    focusDe: 'Verpackungen',
    tools: 'Illustrator, Cinema 4D',
    fileLabel: 'C4D',
  },
  'gfx-prints-billboards': {
    focusAr: 'لوحات إعلانية',
    focusEn: 'billboards and outdoor ads',
    focusDe: 'Plakatwände',
    tools: 'Photoshop, Illustrator',
    fileLabel: 'PSD',
  },
  'gfx-prints-gifts': {
    focusAr: 'هدايا ترويجية',
    focusEn: 'promotional gifts',
    focusDe: 'Werbegeschenke',
    tools: 'Illustrator, Photoshop',
    fileLabel: 'AI',
  },
  'gfx-screens-indoor': {
    focusAr: 'شاشات داخلية LED',
    focusEn: 'indoor LED displays',
    focusDe: 'Innen-LED-Displays',
    tools: 'After Effects, Illustrator',
    fileLabel: 'AEP',
  },
  'gfx-screens-outdoor': {
    focusAr: 'شاشات خارجية',
    focusEn: 'outdoor digital screens',
    focusDe: 'Außenbildschirme',
    tools: 'After Effects, Photoshop',
    fileLabel: 'AEP',
  },
  'gfx-screens-flex': {
    focusAr: 'شاشات مرنة',
    focusEn: 'flexible LED displays',
    focusDe: 'flexible Displays',
    tools: 'Cinema 4D, After Effects',
    fileLabel: 'C4D',
  },
  'gfx-screens-kiosk': {
    focusAr: 'كشك تفاعلي',
    focusEn: 'interactive kiosks',
    focusDe: 'interaktive Kioske',
    tools: 'Figma, After Effects',
    fileLabel: 'FIG',
  },
};

/** عناوين احترافية جاهزة — تُستخدم عند الإنشاء التلقائي */
const PREMIUM_TITLES: Partial<Record<SubSeedKey, Array<{ ar: string; en: string; de: string }>>> = {
  'gfx-landscape-villas': [
    { ar: 'حديقة فيلا مع مسبح وإضاءة ليلية', en: 'Villa Garden with Pool & Night Lighting', de: 'Villengarten mit Pool & Nachtbeleuchtung' },
    { ar: 'تنسيق حدائق فيلا عصرية', en: 'Modern Villa Landscape Layout', de: 'Moderne Villengartengestaltung' },
    { ar: 'فيلا كلاسيكية بحديقة رخامية', en: 'Classic Villa with Marble Garden', de: 'Klassische Villa mit Marmorgarten' },
  ],
  'gfx-landscape-public': [
    { ar: 'متنزه حضري بممرات مشاة', en: 'Urban Park with Pedestrian Paths', de: 'Stadtpark mit Fußwegen' },
    { ar: 'حديقة عامة بمناطق لعب وأشجار ظل', en: 'Public Garden with Play Areas', de: 'Öffentlicher Garten mit Spielbereichen' },
  ],
  'gfx-decor-living': [
    { ar: 'غرفة معيشة بأسلوب زين حضري', en: 'Urban Zen Living Room', de: 'Urbanes Zen-Wohnzimmer' },
    { ar: 'صالة استقبال فاخرة مضيئة', en: 'Bright Luxury Reception Lounge', de: 'Helle Luxus-Empfangslounge' },
    { ar: 'غرفة جلوس نيوكلاسيك', en: 'Neoclassical Living Room', de: 'Neoklassisches Wohnzimmer' },
  ],
  'gfx-decor-bedrooms': [
    { ar: 'غرفة نوم رئيسية بإطلالة بانورامية', en: 'Master Bedroom with Panoramic View', de: 'Hauptschlafzimmer mit Panoramablick' },
    { ar: 'غرفة نوم مينيمال هادئة', en: 'Calm Minimal Bedroom', de: 'Ruhiges minimalistisches Schlafzimmer' },
  ],
  'gfx-decor-kitchens': [
    { ar: 'مطبخ مفتوح على الصالة', en: 'Open-Plan Kitchen & Lounge', de: 'Offene Küche mit Wohnbereich' },
    { ar: 'مطبخ عصري بجزيرة وسطية', en: 'Modern Kitchen with Central Island', de: 'Moderne Küche mit Kochinsel' },
  ],
  'gfx-prints-cards': [
    { ar: 'بزنس كارد لشركة هندسية', en: 'Engineering Firm Business Card', de: 'Visitenkarte Ingenieurbüro' },
    { ar: 'بطاقة أعمال بتشطيب ذهبي', en: 'Gold-Finish Business Card', de: 'Visitenkarte mit Goldfinish' },
  ],
  'gfx-prints-letterhead': [
    { ar: 'هوية مكتبية — ليتر هيد رسمي', en: 'Corporate Letterhead Identity', de: 'Firmen-Briefpapier' },
  ],
  'gfx-screens-indoor': [
    { ar: 'شاشة LED داخلية لصالة عرض', en: 'Indoor LED Display for Showroom', de: 'Innen-LED-Display für Showroom' },
  ],
};

function normAr(s: string): string {
  return s.replace(/\s+/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim().toLowerCase();
}

function normEn(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/** مطابقة الاسم العربي/الإنجليزي → قالب البذور (حتى مع معرّف فرعي مخصص) */
function resolveSeedKeyByName(sub: GfxSubCategory): SubSeedKey | null {
  const ar = normAr(sub.name.ar || '');
  const en = normEn(sub.name.en || '');

  const rules: Array<{ test: () => boolean; key: SubSeedKey }> = [
    { test: () => ar.includes('فلل') && !ar.includes('مبان'), key: 'gfx-landscape-villas' },
    { test: () => ar.includes('حدائق') || ar.includes('متنزه') || ar.includes('عامه'), key: 'gfx-landscape-public' },
    { test: () => ar.includes('جلوس') || ar.includes('معيش') || en.includes('living'), key: 'gfx-decor-living' },
    { test: () => ar.includes('نوم') || en.includes('bedroom'), key: 'gfx-decor-bedrooms' },
    { test: () => ar.includes('مطبخ') || en.includes('kitchen'), key: 'gfx-decor-kitchens' },
    { test: () => ar.includes('مبان') || ar.includes('واجه') || en.includes('building') || en.includes('villa'), key: 'gfx-decor-buildings' },
    { test: () => ar.includes('بزنس') || ar.includes('بطاق') || ar.includes('كارد') || en.includes('business card'), key: 'gfx-prints-cards' },
    { test: () => ar.includes('ليتر') || ar.includes('ورق') || en.includes('letterhead'), key: 'gfx-prints-letterhead' },
    { test: () => ar.includes('بوكس') || ar.includes('تغليف') || en.includes('packaging') || en.includes('box'), key: 'gfx-prints-boxes' },
    { test: () => ar.includes('لوح') || ar.includes('اعلان') || en.includes('billboard'), key: 'gfx-prints-billboards' },
    { test: () => ar.includes('هد') || en.includes('gift'), key: 'gfx-prints-gifts' },
    { test: () => ar.includes('داخل') || en.includes('indoor'), key: 'gfx-screens-indoor' },
    { test: () => ar.includes('خارج') || en.includes('outdoor'), key: 'gfx-screens-outdoor' },
    { test: () => ar.includes('مرن') || en.includes('flex'), key: 'gfx-screens-flex' },
    { test: () => ar.includes('كشك') || ar.includes('kiosk') || en.includes('kiosk'), key: 'gfx-screens-kiosk' },
  ];

  for (const rule of rules) {
    if (rule.test()) return rule.key;
  }
  return null;
}

function resolveSeedKey(subId: string, sub: GfxSubCategory): SubSeedKey | null {
  const id = SUB_SEED_ALIAS[subId] || subId;
  if (id in SUB_META) return id as SubSeedKey;
  return resolveSeedKeyByName(sub);
}

function metaForSub(sub: GfxSubCategory): SubSeedMeta {
  const key = resolveSeedKey(sub.id, sub);
  if (key) return SUB_META[key];
  return {
    focusAr: sub.name.ar || 'تصميم',
    focusEn: sub.name.en || 'design project',
    focusDe: sub.name.de || 'Designprojekt',
    tools: 'Photoshop, Illustrator',
    fileLabel: 'PSD',
  };
}

function buildSeedProject(
  cat: GfxCategory,
  sub: GfxSubCategory,
  index: number,
  meta: SubSeedMeta,
): GfxProjectItem {
  const style = STYLES[index % STYLES.length];
  const n = index + 1;
  const key = resolveSeedKey(sub.id, sub);
  const premium = key ? PREMIUM_TITLES[key] : undefined;
  const premiumTitle = premium?.[index % premium.length];

  return {
    id: uid(),
    title: premiumTitle
      ? ml3(premiumTitle.ar, premiumTitle.en, premiumTitle.de)
      : ml3(
        `${sub.name.ar || meta.focusAr} — ${style.ar} ${n}`,
        `${sub.name.en || meta.focusEn} — ${style.en} ${n}`,
        `${sub.name.de || meta.focusDe} — ${style.de} ${n}`,
      ),
    desc: ml3(
      `تصميم ${meta.focusAr} بأسلوب ${style.ar}: تنسيق ألوان ومواد وإضاءة يناسب ${cat.name.ar}. يشمل مخططات العرض والتفاصيل الجاهزة للتعديل.`,
      `${style.en} ${meta.focusEn} design for ${cat.name.en}: color palette, materials, and lighting concept with presentation-ready details.`,
      `${style.de}-Design für ${meta.focusDe}: Farbkonzept, Materialien und Beleuchtung — präsentationsreif und leicht anpassbar.`,
    ),
    mainImg: '',
    images: [],
    videoUrl: '',
    usedSkillsIds: [],
    cvSettings: { isFeatured: n <= 2, imgSize: 100, showDesc: true, showTools: true },
    sourceFileLabel: meta.fileLabel,
    sourceFileVisible: false,
  };
}

/** إنشاء مشروع نموذجي واحد (للاقتراح المحلي أو ملء سريع) */
export function createGfxSeedProject(
  cat: GfxCategory,
  sub: GfxSubCategory,
  index = 0,
): GfxProjectItem {
  return buildSeedProject(cat, sub, index, metaForSub(sub));
}

/** إضافة N مشروعاً جديداً بأسماء جاهزة (قابل للتعديل لاحقاً) */
export function addGfxSeedProjects(
  cat: GfxCategory,
  sub: GfxSubCategory,
  count: number,
): GfxProjectItem[] {
  if (count <= 0) return [...sub.items];
  const meta = metaForSub(sub);
  const items = [...sub.items];
  for (let c = 0; c < count; c++) {
    items.push(buildSeedProject(cat, sub, items.length, meta));
  }
  return items;
}

/** إكمال العدد إلى target (مثلاً 10) دون حذف الموجود */
export function fillGfxSubToCount(
  cat: GfxCategory,
  sub: GfxSubCategory,
  target: number,
): GfxProjectItem[] {
  if (target <= 0) return [...sub.items];
  const meta = metaForSub(sub);
  const items = [...sub.items];
  while (items.length < target) {
    items.push(buildSeedProject(cat, sub, items.length, meta));
  }
  return items;
}

function fillCategorySubsToCount(cat: GfxCategory, target: number): GfxCategory {
  if (!isGfxAutoFillCategory(cat)) return cat;
  return {
    ...cat,
    subCategories: cat.subCategories.map(sub => ({
      ...sub,
      items: fillGfxSubToCount(cat, sub, target),
    })),
  };
}

/** هل يُسمح بالملء التلقائي لهذا التصنيف؟ (بالمعرّف أو الاسم) */
export function isGfxAutoFillCategory(cat: GfxCategory): boolean {
  if (GFX_SEED_CATEGORY_IDS.has(cat.id)) return true;
  const ar = normAr(cat.name.ar || '');
  const en = normEn(cat.name.en || '');
  const hints = ['لاندسكيب', 'حدائق', 'ديكور', 'مطبوع', 'شاش', 'landscape', 'decor', 'print', 'screen'];
  return hints.some(h => ar.includes(normAr(h)) || en.includes(h));
}

/** إكمال 10 مشاريع لكل فرع في التصنيفات المدعومة */
export function ensureGfxSeedProjects(categories: GfxCategory[]): GfxCategory[] {
  return categories.map(cat => fillCategorySubsToCount(cat, 10));
}

/** ملء كل الفروع في تصنيف واحد */
export function fillGfxCategorySubs(
  cat: GfxCategory,
  count: number,
  mode: 'add' | 'target',
): GfxCategory {
  if (!cat.subCategories.length) return cat;
  return {
    ...cat,
    subCategories: cat.subCategories.map(sub => ({
      ...sub,
      items: mode === 'add'
        ? addGfxSeedProjects(cat, sub, count)
        : fillGfxSubToCount(cat, sub, count),
    })),
  };
}

/** عدد المشاريع المضافة بين حالتين */
export function countGfxProjectsInCategory(cat: GfxCategory): number {
  return cat.subCategories.reduce((n, sub) => n + sub.items.length, 0);
}

/** أدوات مقترحة حسب التصنيف الفرعي */
export function getSuggestedToolsForSub(subId: string, sub?: GfxSubCategory): string[] {
  const meta = sub
    ? metaForSub(sub)
    : (() => {
        const id = SUB_SEED_ALIAS[subId] || subId;
        return id in SUB_META ? SUB_META[id as SubSeedKey] : { tools: 'Photoshop, Illustrator', focusAr: '', focusEn: '', focusDe: '', fileLabel: 'PSD' };
      })();
  return meta.tools.split(',').map(s => s.trim()).filter(Boolean);
}

export function getSuggestedFileLabelForSub(subId: string, sub?: GfxSubCategory): string {
  if (sub) return metaForSub(sub).fileLabel;
  const id = SUB_SEED_ALIAS[subId] || subId;
  return (id in SUB_META ? SUB_META[id as SubSeedKey].fileLabel : 'PSD');
}
