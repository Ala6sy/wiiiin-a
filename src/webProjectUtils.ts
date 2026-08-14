import type { CSSProperties } from 'react';

/** تطبيع روابط خارجية — يضيف https:// عند الحاجة (مثل www.example.com) */
export function normalizeExternalUrl(url: string): string {
  const u = (url || '').trim();
  if (!u) return '';
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (u.startsWith('//')) return `https:${u}`;
  return `https://${u.replace(/^\/+/, '')}`;
}

const EMPTY_STORE_PATTERNS = [
  /^https?:\/\/play\.google\.com\/?$/i,
  /^https?:\/\/apps\.apple\.com\/?$/i,
  /^https?:\/\/apps\.apple\.com\/app\/?$/i,
];

/** هل الرابط جاهز للاستخدام (ليس فارغاً ولا placeholder) */
export function isUsableProjectLink(url: string): boolean {
  const n = normalizeExternalUrl(url);
  if (!n || n.length < 10) return false;
  if (EMPTY_STORE_PATTERNS.some((p) => p.test(n))) return false;
  try {
    const parsed = new URL(n);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function webProjThumbStyle(imgBgColor?: string): CSSProperties {
  const bg = (imgBgColor || '').trim();
  return {
    background: bg || '#ffffff',
  };
}

/** دائماً contain حتى يظهر اللوغو كاملاً داخل إطار موحّد */
export function webProjImgFit(_imgBgColor?: string): 'cover' | 'contain' {
  return 'contain';
}
