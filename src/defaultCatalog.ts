/**
 * تصنيفات افتراضية مدمجة — مقالات + معرض التصاميم
 */
import type { ArticleCategory, GfxCategory, GfxSubCategory, ML } from './appData';

const ml = (ar: string, en = '', de = ''): ML => ({ ar, en: en || ar, de: de || en || ar });

export const DEFAULT_ARTICLE_CATEGORIES: ArticleCategory[] = [
  { id: 'cat-tissue-culture', name: ml('زراعة أنسجة نباتية', 'Plant Tissue Culture', 'Pflanzengewebe-Kultur') },
  { id: 'cat-hydroponics', name: ml('زراعة مائية', 'Hydroponics', 'Hydroponik') },
  { id: 'cat-drone-agri', name: ml('طيران عن بعد بمجال الزراعة', 'Remote Piloting in Agriculture', 'Drohneneinsatz in der Landwirtschaft') },
  { id: 'cat-bees-silk', name: ml('نحل ودودة القز', 'Bees & Silkworms', 'Bienen & Seidenraupen') },
  { id: 'cat-gmo', name: ml('التعديل الوراثي', 'Genetic Modification', 'Gentechnik') },
  { id: 'cat-agri-machinery', name: ml('الآلات الزراعية', 'Agricultural Machinery', 'Landmaschinen') },
  { id: 'cat-agri-tech-news', name: ml('أخبار التكنولوجيا الزراعية', 'Agricultural Technology News', 'Nachrichten Agrartechnik') },
];

export const DEFAULT_GFX_CATEGORIES: GfxCategory[] = [
  {
    id: 'gfx-landscape',
    name: ml('تصميم حدائق لاندسكيب', 'Landscape Garden Design', 'Landschaftsgartengestaltung'),
    icon: 'fa-tree',
    subCategories: [
      { id: 'gfx-landscape-villas', name: ml('فلل', 'Villas', 'Villen'), items: [] },
      { id: 'gfx-landscape-public', name: ml('حدائق عامة', 'Public Parks', 'Öffentliche Parks'), items: [] },
    ],
  },
  {
    id: 'gfx-decor',
    name: ml('ديكور داخلي وخارجي', 'Interior & Exterior Decor', 'Innen- & Außendekor'),
    icon: 'fa-couch',
    subCategories: [
      { id: 'gfx-decor-living', name: ml('غرف جلوس', 'Living Rooms', 'Wohnzimmer'), items: [] },
      { id: 'gfx-decor-bedrooms', name: ml('غرف النوم', 'Bedrooms', 'Schlafzimmer'), items: [] },
      { id: 'gfx-decor-kitchens', name: ml('المطابخ', 'Kitchens', 'Küchen'), items: [] },
      { id: 'gfx-decor-buildings', name: ml('مبانٍ وفلل', 'Buildings & Villas', 'Gebäude & Villen'), items: [] },
    ],
  },
  {
    id: 'gfx-prints',
    name: ml('مطبوعات', 'Prints', 'Drucksachen'),
    icon: 'fa-print',
    subCategories: [
      { id: 'gfx-prints-cards', name: ml('بزنس كارد', 'Business Cards', 'Visitenkarten'), items: [] },
      { id: 'gfx-prints-letterhead', name: ml('ليتر هيد', 'Letterhead', 'Briefpapier'), items: [] },
      { id: 'gfx-prints-boxes', name: ml('بوكسات وتغليف', 'Boxes & Packaging', 'Boxen & Verpackung'), items: [] },
      { id: 'gfx-prints-billboards', name: ml('لوحات إعلانية', 'Billboards', 'Plakatwände'), items: [] },
      { id: 'gfx-prints-gifts', name: ml('هدايا', 'Gifts', 'Geschenke'), items: [] },
    ],
  },
  {
    id: 'gfx-screens',
    name: ml('شاشات إلكترونية', 'Electronic Screens', 'Elektronische Bildschirme'),
    icon: 'fa-tv',
    subCategories: [
      { id: 'gfx-screens-indoor', name: ml('شاشات داخلية', 'Indoor Screens', 'Innenbildschirme'), items: [] },
      { id: 'gfx-screens-outdoor', name: ml('شاشات خارجية', 'Outdoor Screens', 'Außenbildschirme'), items: [] },
      { id: 'gfx-screens-flex', name: ml('شاشات مرنة', 'Flexible Screens', 'Flexible Displays'), items: [] },
      { id: 'gfx-screens-kiosk', name: ml('كiosk', 'Kiosk', 'Kiosk'), items: [] },
    ],
  },
  {
    id: 'gfx-3d-print',
    name: ml('طباعة 3D', '3D Printing', '3D-Druck'),
    icon: 'fa-cube',
    subCategories: [
      { id: 'gfx-3d-engineering', name: ml('هندسية', 'Engineering', 'Ingenieurwesen'), items: [] },
      { id: 'gfx-3d-office', name: ml('مشاريع مكتبية', 'Office Projects', 'Büroprojekte'), items: [] },
      { id: 'gfx-3d-electronics', name: ml('أجهزة إلكترونية', 'Electronic Devices', 'Elektronische Geräte'), items: [] },
      { id: 'gfx-3d-misc', name: ml('متفرقات', 'Miscellaneous', 'Verschiedenes'), items: [] },
    ],
  },
  {
    id: 'gfx-ai',
    name: ml('ذكاء صناعي', 'Artificial Intelligence', 'Künstliche Intelligenz'),
    icon: 'fa-robot',
    subCategories: [
      { id: 'gfx-ai-engineering', name: ml('هندسية', 'Engineering', 'Ingenieurwesen'), items: [] },
      { id: 'gfx-ai-decor', name: ml('ديكورات', 'Decorations', 'Dekorationen'), items: [] },
      { id: 'gfx-ai-realestate', name: ml('عقارات', 'Real Estate', 'Immobilien'), items: [] },
      { id: 'gfx-ai-misc', name: ml('متفرقات', 'Miscellaneous', 'Verschiedenes'), items: [] },
    ],
  },
  {
    id: 'gfx-plans',
    name: ml('مخططات', 'Plans & Blueprints', 'Pläne & Zeichnungen'),
    icon: 'fa-drafting-compass',
    subCategories: [
      { id: 'gfx-plans-general', name: ml('عام', 'General', 'Allgemein'), items: [] },
    ],
  },
  {
    id: 'gfx-industrial',
    name: ml('بناء صناعي', 'Industrial Construction', 'Industriebau'),
    icon: 'fa-industry',
    subCategories: [
      { id: 'gfx-industrial-general', name: ml('عام', 'General', 'Allgemein'), items: [] },
    ],
  },
];

function normAr(s: string): string {
  return s.replace(/\s+/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();
}

/** مطابقة أسماء عربية شائعة → معرّف التصنيف الافتراضي */
const ARTICLE_AR_ALIASES: Record<string, string> = {
  'زراعةأنسجةنباتية': 'cat-tissue-culture',
  'زراعةنسجنباتية': 'cat-tissue-culture',
  'زراعةمائية': 'cat-hydroponics',
  'طيرانعنبعدبمجالالزراعة': 'cat-drone-agri',
  'طيرانعنبعدفيالزراعة': 'cat-drone-agri',
  'نحلودودةالقز': 'cat-bees-silk',
  'التعديلالوراثي': 'cat-gmo',
  'الآلاتالزراعية': 'cat-agri-machinery',
  'أخبارالتكنولوجياالزراعية': 'cat-agri-tech-news',
};

function fillMlFromDefault(current: ML, def: ML): ML {
  return {
    ar: (current.ar || '').trim() || def.ar,
    en: (current.en || '').trim() || def.en,
    de: (current.de || '').trim() || def.de,
  };
}

function cloneDefaultGfx(): GfxCategory[] {
  return DEFAULT_GFX_CATEGORIES.map(cat => ({
    ...cat,
    name: { ...cat.name },
    subCategories: cat.subCategories.map(sub => ({
      ...sub,
      name: { ...sub.name },
      items: [],
    })),
  }));
}

const defaultArticleById = new Map(DEFAULT_ARTICLE_CATEGORIES.map(c => [c.id, c]));
const defaultGfxById = new Map(DEFAULT_GFX_CATEGORIES.map(c => [c.id, c]));
const defaultGfxSubById = new Map(
  DEFAULT_GFX_CATEGORIES.flatMap(c => c.subCategories.map(s => [s.id, s] as const)),
);

/** دمج ترجمات EN/DE من التصنيفات المدمجة — لا يعيد التصنيفات المحذوفة */
export function mergeArticleCategoryDefaults(cats: ArticleCategory[]): ArticleCategory[] {
  if (!cats.length) return DEFAULT_ARTICLE_CATEGORIES.map(c => ({ ...c, name: { ...c.name } }));
  return cats.map(c => {
    let def = defaultArticleById.get(c.id);
    if (!def) {
      const aliasId = ARTICLE_AR_ALIASES[normAr(c.name.ar || '')];
      if (aliasId) def = defaultArticleById.get(aliasId);
    }
    if (!def) return c;
    return { ...c, id: def.id, name: fillMlFromDefault(c.name, def.name) };
  });
}

/** دمج ترجمات التصاميم الرئيسية والفرعية + إضافة فروع ناقصة من الافتراضي */
function mergeGfxSubCategories(userSubs: GfxSubCategory[], defCat: GfxCategory | undefined): GfxSubCategory[] {
  if (!defCat) {
    return userSubs.map(sub => {
      const defSub = defaultGfxSubById.get(sub.id);
      return defSub ? { ...sub, name: fillMlFromDefault(sub.name, defSub.name) } : sub;
    });
  }
  const byId = new Map(userSubs.map(s => [s.id, s]));
  const merged: GfxSubCategory[] = userSubs.map(sub => {
    const defSub = defaultGfxSubById.get(sub.id);
    return defSub ? { ...sub, name: fillMlFromDefault(sub.name, defSub.name) } : sub;
  });
  for (const defSub of defCat.subCategories) {
    if (!byId.has(defSub.id)) {
      merged.push({ ...defSub, name: { ...defSub.name }, items: [] });
    }
  }
  return merged;
}

/** دمج ترجمات التصاميم الرئيسية والفرعية من الأصل — بدون إعادة ملء المشاريع تلقائياً */
export function mergeGfxCategoryDefaults(cats: GfxCategory[]): GfxCategory[] {
  if (!cats.length) return cloneDefaultGfx();
  return cats.map(cat => {
    const defCat = defaultGfxById.get(cat.id);
    const name = defCat ? fillMlFromDefault(cat.name, defCat.name) : cat.name;
    const subCategories = mergeGfxSubCategories(cat.subCategories, defCat);
    return { ...cat, name, subCategories };
  });
}

/** إذا كانت القائمة فارغة → التصنيفات الافتراضية؛ وإلا دمج الترجمات الناقصة */
export function resolveArticleCategories(cats: ArticleCategory[]): ArticleCategory[] {
  return mergeArticleCategoryDefaults(cats);
}

/** إذا كانت القائمة فارغة → شجرة التصاميم الافتراضية؛ وإلا دمج الترجمات الناقصة */
export function resolveGfxCategories(cats: GfxCategory[]): GfxCategory[] {
  return mergeGfxCategoryDefaults(cats);
}

/** استعادة كاملة لتصنيفات المقالات الافتراضية */
export function restoreDefaultArticleCategories(): ArticleCategory[] {
  return DEFAULT_ARTICLE_CATEGORIES.map(c => ({ ...c, name: { ...c.name } }));
}
