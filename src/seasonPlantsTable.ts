import type { LangKey } from './appData';
import {
  PLANT_CATEGORY_LABELS,
  PLANT_CATEGORY_ORDER,
  type PlantCategoryId,
  type PlantsByCategory,
} from './plantCategories';

export interface UnifiedSeasonPlantRow {
  category: PlantCategoryId;
  label: string;
  plantNow: string[];
  harvestNow: string[];
}

/** صف واحد لكل تصنيف — يُزرع الآن | يُحصد الآن */
export function buildUnifiedSeasonRows(
  plantGroups: PlantsByCategory[],
  harvestGroups: PlantsByCategory[],
  lang: LangKey,
): UnifiedSeasonPlantRow[] {
  const plantMap = new Map(plantGroups.map(g => [g.category, g.plants]));
  const harvestMap = new Map(harvestGroups.map(g => [g.category, g.plants]));
  const cats = new Set<PlantCategoryId>([
    ...plantGroups.map(g => g.category),
    ...harvestGroups.map(g => g.category),
  ]);

  return PLANT_CATEGORY_ORDER
    .filter(cat => cats.has(cat))
    .map(cat => ({
      category: cat,
      label: PLANT_CATEGORY_LABELS[cat][lang] || PLANT_CATEGORY_LABELS[cat].en,
      plantNow: plantMap.get(cat) || [],
      harvestNow: harvestMap.get(cat) || [],
    }));
}

/** نباتات متقاربة في سطر واحد */
export function plantsInline(plants: string[], _lang: LangKey): string {
  if (!plants.length) return '—';
  return plants.join(' · ');
}
