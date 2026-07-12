import type { LangKey } from './appData';
import { plantLabel } from './plantLabel';

export type PlantCategoryId =
  | 'vegetables'
  | 'fruits'
  | 'crops'
  | 'medicinal'
  | 'fodder'
  | 'pasture'
  | 'ornamental'
  | 'other';

export const PLANT_CATEGORY_LABELS: Record<PlantCategoryId, Record<LangKey, string>> = {
  vegetables: { ar: 'خضار', en: 'Vegetables', de: 'Gemüse' },
  fruits: { ar: 'فاكهة', en: 'Fruits', de: 'Obst' },
  crops: { ar: 'محاصيل حقلية', en: 'Field crops', de: 'Feldfrüchte' },
  medicinal: { ar: 'نباتات طبية', en: 'Medicinal plants', de: 'Heilpflanzen' },
  fodder: { ar: 'نباتات علفية', en: 'Fodder crops', de: 'Futterpflanzen' },
  pasture: { ar: 'مراعي وحشائش وحراج', en: 'Range, grasses & forestry', de: 'Weide, Gräser & Forst' },
  ornamental: { ar: 'نباتات زينة', en: 'Ornamental plants', de: 'Zierpflanzen' },
  other: { ar: 'نباتات أخرى', en: 'Other plants', de: 'Sonstige Pflanzen' },
};

export const PLANT_CATEGORY_ORDER: PlantCategoryId[] = [
  'vegetables', 'fruits', 'crops', 'medicinal', 'fodder', 'pasture', 'ornamental', 'other',
];

type PlantEntry = Record<LangKey, string>;

const matchAny = (key: string, terms: string[]) => terms.some(t => key.includes(t));

const FRUIT_TERMS = [
  'بطيخ', 'شمام', 'مانجو', 'عنب', 'تفاح', 'رمان', 'برتقال', 'ليمون', 'موز', 'أناناس', 'بابايا', 'فراولة', 'زيتون',
  'خوخ', 'مشمش', 'لوز', 'تين', 'نخيل', 'توت',
  'Watermelon', 'Melon', 'Mango', 'Grapes', 'Apple', 'Pomegranate', 'Orange', 'Lemon', 'Banana', 'Pineapple', 'Papaya', 'Strawberry', 'Olives',
  'Peach', 'Apricot', 'Almond', 'Fig', 'Date palm', 'Mulberry',
];

const MEDICINAL_TERMS = [
  'نعناع', 'ريحان', 'كزبرة', 'بقدونس', 'شبت', 'زعتر', 'إكليل', 'مريمية', 'زعفران', 'صبار', 'حناء', 'حشيش', 'خشخاش', 'تبغ', 'ملوخية', 'عرفج',
  'Mint', 'Basil', 'Coriander', 'Parsley', 'Dill', 'Molokhia', 'Thyme', 'Rosemary', 'Sage', 'Saffron', 'Aloe', 'Henna', 'Cannabis', 'Poppy', 'Tobacco',
];

const ORNAMENTAL_TERMS = [
  'ورد', 'ياسمين', 'زينة',
  'Rose', 'Jasmine', 'Henna (ornamental)',
];

const FODDER_TERMS = [
  'ذرة علف', 'Fodder corn', 'Fodder sorghum', 'Fodder barley', 'Fodder wheat', 'Fodder vetch', 'Forage peanut', 'Silage', 'علف',
  'Fodder', 'Forage', 'Silage',
];

const PASTURE_TERMS = [
  'برسيم', 'حلفا', 'السودان', 'Rhodes', 'Sudan', 'Alfalfa', 'Luzerne', 'Clover', 'نخيل الحطب', 'ملحية', 'Atriplex', 'رغل', 'Salsola',
  'حصا', 'Haloxylon', 'Saxaul', 'ضرم', 'Panicum', 'سذاب', 'Artemisia', 'طرفا', 'Tamarisk', 'Tamarix', 'سمر', 'Acacia', 'Samr', 'غاف', 'Ghaf',
  'سدر', 'Ziziphus', 'Jujube', 'Lote', 'عرعر', 'Juniper', 'صنوبر', 'Pine', 'أوكالبتوس', 'Eucalyptus', 'نيم', 'Neem', 'أركان', 'Argan',
  'بلوط', 'Oak', 'حور', 'Poplar', 'صفصاف', 'Willow', 'قيقب', 'Maple', 'Napier', 'Elephantengras', 'Saltbush', 'Saltwort', 'Cymbopogon',
  'Opuntia', 'Prickly pear', 'Wild olive', 'Aleppo pine',
];

const CROP_TERMS = [
  'قمح', 'شعير', 'قطن', 'عدس', 'حمص', 'فول', 'سمسم', 'بطاطا', 'ذرة حلوة', 'ذرة',
  'Wheat', 'Barley', 'Cotton', 'Potato', 'Kartoffel', 'Lentils', 'Chickpeas', 'Fava', 'Sesame', 'Corn', 'Mais', 'Sweet corn',
];

export function categorizePlant(entry: PlantEntry): PlantCategoryId {
  const key = `${entry.ar || ''} ${entry.en || ''} ${entry.de || ''}`;

  if (matchAny(key, FRUIT_TERMS)) return 'fruits';
  if (matchAny(key, MEDICINAL_TERMS)) return 'medicinal';
  if (matchAny(key, ORNAMENTAL_TERMS)) return 'ornamental';
  if (matchAny(key, PASTURE_TERMS)) return 'pasture';
  if (matchAny(key, FODDER_TERMS)) return 'fodder';
  if (matchAny(key, CROP_TERMS)) return 'crops';
  return 'vegetables';
}

export interface PlantsByCategory {
  category: PlantCategoryId;
  label: string;
  plants: string[];
}

export function groupPlantsByCategory(entries: PlantEntry[], lang: LangKey): PlantsByCategory[] {
  const buckets = new Map<PlantCategoryId, string[]>();
  for (const e of entries) {
    const cat = categorizePlant(e);
    const name = plantLabel(e, lang);
    if (!buckets.has(cat)) buckets.set(cat, []);
    const list = buckets.get(cat)!;
    if (!list.includes(name)) list.push(name);
  }
  return PLANT_CATEGORY_ORDER
    .filter(cat => buckets.has(cat))
    .map(cat => ({
      category: cat,
      label: PLANT_CATEGORY_LABELS[cat][lang] || PLANT_CATEGORY_LABELS[cat].en,
      plants: buckets.get(cat)!,
    }));
}
