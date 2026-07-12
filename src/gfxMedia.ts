import type { GfxProjectItem } from './appData';
import type { GfxModel3dSettings } from './gfxModel3d';
import { isVideoMediaUrl } from './mediaUrl';

export interface GfxMediaRow {
  url: string;
  noWm: boolean;
  isVideo: boolean;
  isMain: boolean;
}

export interface GfxMediaSlide {
  url: string;
  noWm: boolean;
  isVideo: boolean;
}

export function gfxSlideIsVideo(item: GfxProjectItem, slideIndex: number): boolean {
  if (slideIndex === 0) {
    return !!(item.mainImgIsVideo || isVideoMediaUrl(item.mainImg));
  }
  const i = slideIndex - 1;
  const url = item.images[i] || '';
  return !!(item.imagesIsVideo?.[i] || isVideoMediaUrl(url));
}

export function getGfxMediaSlides(item: GfxProjectItem): GfxMediaSlide[] {
  const slides: GfxMediaSlide[] = [];
  if (item.mainImg?.trim()) {
    slides.push({
      url: item.mainImg,
      noWm: !!item.mainImgNoWm,
      isVideo: gfxSlideIsVideo(item, 0),
    });
  }
  item.images.forEach((url, i) => {
    if (!url?.trim()) return;
    slides.push({
      url,
      noWm: !!(item.imagesNoWm?.[i]),
      isVideo: gfxSlideIsVideo(item, i + 1),
    });
  });
  return slides;
}

export function gfxItemToMediaRows(item: GfxProjectItem): GfxMediaRow[] {
  const rows: GfxMediaRow[] = [{
    url: item.mainImg || '',
    noWm: !!item.mainImgNoWm,
    isVideo: !!item.mainImgIsVideo,
    isMain: true,
  }];
  item.images.forEach((url, i) => {
    rows.push({
      url,
      noWm: !!(item.imagesNoWm?.[i]),
      isVideo: !!(item.imagesIsVideo?.[i]),
      isMain: false,
    });
  });
  return rows;
}

export function mediaRowsToGfxItem(rows: GfxMediaRow[], base: GfxProjectItem): GfxProjectItem {
  if (!rows.length) {
    return {
      ...base,
      mainImg: '',
      mainImgNoWm: false,
      mainImgIsVideo: false,
      images: [],
      imagesNoWm: [],
      imagesIsVideo: [],
    };
  }
  const mainIndex = rows.findIndex(r => r.isMain);
  const mi = mainIndex >= 0 ? mainIndex : 0;
  const main = rows[mi];
  const others = rows.filter((_, i) => i !== mi);
  return {
    ...base,
    mainImg: main.url,
    mainImgNoWm: main.noWm,
    mainImgIsVideo: main.isVideo,
    images: others.map(o => o.url),
    imagesNoWm: others.map(o => o.noWm),
    imagesIsVideo: others.map(o => o.isVideo),
  };
}

export function gfxModelAsMain(item: GfxProjectItem): boolean {
  return !!(item.glbUrl?.trim() && item.glbViewSettings?.useAsMain !== false);
}

export type GfxProjectSlide =
  | { kind: 'model'; url: string; settings?: GfxModel3dSettings }
  | { kind: 'image'; url: string; noWm: boolean; isVideo: boolean }
  | { kind: 'youtube' };

export function getGfxProjectSlides(item: GfxProjectItem): GfxProjectSlide[] {
  const slides: GfxProjectSlide[] = [];
  const images = getGfxMediaSlides(item);
  const modelUrl = item.glbUrl?.trim() || '';
  const modelMain = modelUrl && item.glbViewSettings?.useAsMain !== false;
  const modelExtra = modelUrl && item.glbViewSettings?.useAsMain === false;

  if (modelMain) {
    slides.push({ kind: 'model', url: modelUrl, settings: item.glbViewSettings });
  }
  images.forEach(img => slides.push({ kind: 'image', ...img }));
  if (modelExtra) {
    slides.push({ kind: 'model', url: modelUrl, settings: item.glbViewSettings });
  }
  if (item.videoUrl?.trim()) slides.push({ kind: 'youtube' });
  return slides;
}

export function moveMediaRow(rows: GfxMediaRow[], index: number, dir: -1 | 1): GfxMediaRow[] {
  const to = index + dir;
  if (to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  const [row] = next.splice(index, 1);
  next.splice(to, 0, row);
  return next;
}

export function setMainMediaRow(rows: GfxMediaRow[], index: number): GfxMediaRow[] {
  return rows.map((r, i) => ({ ...r, isMain: i === index }));
}
