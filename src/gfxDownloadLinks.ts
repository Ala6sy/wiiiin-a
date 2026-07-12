import type { GfxProjectItem } from './appData';
import { uid } from './appData';

export interface GfxDownloadLink {
  id: string;
  /** اسم يظهر للزائر — مثل GLB أو PSD */
  label: string;
  url: string;
  isPaid?: boolean;
  price?: string;
  currency?: string;
  visible?: boolean;
  password?: string;
}

export function newGfxDownloadLink(partial?: Partial<GfxDownloadLink>): GfxDownloadLink {
  return {
    id: uid(),
    label: partial?.label || '',
    url: partial?.url || '',
    isPaid: partial?.isPaid ?? false,
    price: partial?.price || '',
    currency: partial?.currency || 'USD',
    visible: partial?.visible !== false,
    password: partial?.password || '',
  };
}

function migrateLegacyDownloadLinks(item: GfxProjectItem): GfxDownloadLink[] {
  const links: GfxDownloadLink[] = [];
  const glbUrl = (item.glbUrl || '').trim();
  const glbFree = (item.glbFreeUrl || '').trim();

  if (item.glbIsPaid && glbUrl) {
    links.push(normLink({
      id: 'legacy-glb',
      label: 'GLB',
      url: glbUrl,
      isPaid: true,
      price: item.glbPrice,
      currency: item.glbCurrency || 'USD',
    }));
  } else {
    const freeUrl = glbFree || glbUrl;
    if (freeUrl) {
      links.push(normLink({ id: 'legacy-glb', label: 'GLB', url: freeUrl, isPaid: false }));
    }
  }

  const src = (item.sourceFileUrl || '').trim();
  if (src) {
    links.push(normLink({
      id: 'legacy-source',
      label: item.sourceFileLabel || 'ملف أصلي',
      url: src,
      isPaid: false,
      visible: item.sourceFileVisible !== false,
      password: item.sourceFilePassword,
    }));
  }

  return links;
}

function normLink(l: Partial<GfxDownloadLink>): GfxDownloadLink {
  return {
    id: l.id || uid(),
    label: (l.label ?? '').trim() || 'ملف',
    url: l.url ?? '',
    isPaid: !!l.isPaid,
    price: l.price || '',
    currency: l.currency || 'USD',
    visible: l.visible !== false,
    password: l.password || '',
  };
}

/** للتحرير — يبقي الصفوف الفارغة حتى يُعبّئها المستخدم */
export function getGfxDownloadLinksForEdit(item: GfxProjectItem): GfxDownloadLink[] {
  if (Array.isArray(item.downloadLinks)) {
    return item.downloadLinks.map(normLink);
  }
  return migrateLegacyDownloadLinks(item);
}

/** للزائر — روابط مكتملة فقط */
export function getGfxDownloadLinks(item: GfxProjectItem): GfxDownloadLink[] {
  return getGfxDownloadLinksForEdit(item).filter(l => l.url.trim());
}

/** يحفظ الروابط ويُزامن الحقول القديمة للتوافق */
export function applyGfxDownloadLinks(item: GfxProjectItem, links: GfxDownloadLink[]): GfxProjectItem {
  const all = links.map(normLink);
  const filled = all.filter(l => l.url.trim());

  const next: GfxProjectItem = { ...item, downloadLinks: all };

  const source = filled.find(l => (l.password || '').trim() || /أصلي|original|psd|dwg|c4d|source/i.test(l.label));
  if (source) {
    next.sourceFileUrl = source.url;
    next.sourceFileLabel = source.label;
    next.sourceFilePassword = source.password || undefined;
    next.sourceFileVisible = source.visible !== false;
  } else if (!filled.some(l => /أصلي|original|psd|dwg|c4d|source/i.test(l.label))) {
    next.sourceFileUrl = undefined;
    next.sourceFileLabel = undefined;
    next.sourceFilePassword = undefined;
    next.sourceFileVisible = true;
  }

  const glbLinks = filled.filter(l => l !== source);
  const paid = glbLinks.find(l => l.isPaid);
  const free = glbLinks.find(l => !l.isPaid);

  if (paid) {
    next.glbIsPaid = true;
    next.glbPrice = paid.price;
    next.glbCurrency = paid.currency;
    if (!next.glbUrl?.trim()) next.glbUrl = paid.url;
    next.glbFreeUrl = free?.url;
  } else if (free) {
    next.glbIsPaid = false;
    next.glbPrice = undefined;
    next.glbFreeUrl = free.url;
    if (!next.glbUrl?.trim()) next.glbUrl = free.url;
  } else if (!glbLinks.length) {
    next.glbIsPaid = false;
    next.glbFreeUrl = undefined;
  }

  return next;
}

export function normGfxDownloadLinks(raw: unknown): GfxDownloadLink[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const links = raw
    .map(x => (x && typeof x === 'object' ? normLink(x as Partial<GfxDownloadLink>) : null))
    .filter((l): l is GfxDownloadLink => !!l);
  return links.length ? links : undefined;
}