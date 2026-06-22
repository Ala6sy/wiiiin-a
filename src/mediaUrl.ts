/**
 * تحويل روابط Google Drive (مشاركة /view) إلى روابط تعمل في <img> و <iframe>.
 * الصق رابط المشاركة كما هو — الموقع يحوّله تلقائياً.
 */

export function extractDriveFileId(url: string): string | null {
  const u = (url || '').trim();
  if (!u) return null;
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const p of patterns) {
    const m = u.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function isGoogleDriveUrl(url: string): boolean {
  return /drive\.google\.com|docs\.google\.com/i.test(url || '');
}

/** رابط يعمل داخل <img src> — صور Drive أو أي رابط عادي */
export function resolveImageSrc(url: string, width = 1200): string {
  const u = (url || '').trim();
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  const id = extractDriveFileId(u);
  if (!id) return u;
  if (u.includes('thumbnail?id=')) return u;
  if (/export=view|export=download/i.test(u) && u.includes(id)) {
    return `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`;
  }
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`;
}

/** حفظ في قاعدة البيانات — يحوّل روابط Drive إلى صيغة عرض */
export function normalizeImageUrlForStorage(url: string): string {
  return resolveImageSrc(url);
}

/** رابط فيديو للتضمين في iframe (YouTube / Drive / Vimeo) */
export function resolveVideoEmbedSrc(url: string): string | null {
  const u = (url || '').trim();
  if (!u) return null;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const id = extractDriveFileId(u);
  if (id) return `https://drive.google.com/file/d/${id}/preview`;
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  if (/^https?:\/\/\S+\.(mp4|webm|ogg|ogv|mov|m4v)(\?\S*)?$/i.test(u)) return u;
  return null;
}

export function normalizeVideoUrlForStorage(url: string): string {
  const u = (url || '').trim();
  if (!u) return '';
  const embed = resolveVideoEmbedSrc(u);
  if (embed && isGoogleDriveUrl(u)) return embed;
  if (embed && u.includes('youtube')) return embed;
  if (embed && u.includes('vimeo')) return embed;
  return u;
}

/** @deprecated استخدم resolveImageSrc — للتوافق مع الكتب */
export function driveThumb(url: string, width = 400): string {
  return resolveImageSrc(url, width);
}

/** معاينة تقرير PDF / Google Drive */
export function drivePdfPreviewUrl(url: string): string {
  const id = extractDriveFileId(url);
  if (!id) return (url || '').trim();
  return `https://drive.google.com/file/d/${id}/preview`;
}

export function resolveReportDisplay(url: string, thumbnail = ''): {
  thumbSrc: string;
  previewUrl: string;
  useModal: boolean;
} {
  const rawUrl = (url || '').trim();
  const id = extractDriveFileId(rawUrl || thumbnail);
  if (id) {
    return {
      thumbSrc: resolveImageSrc(thumbnail || rawUrl, 400),
      previewUrl: `https://drive.google.com/file/d/${id}/preview`,
      useModal: true,
    };
  }
  const thumbSrc = resolveImageSrc(thumbnail || rawUrl, 400);
  const isPdf = /\.pdf(\?|$)/i.test(rawUrl);
  return {
    thumbSrc,
    previewUrl: rawUrl,
    useModal: isPdf && !!rawUrl,
  };
}

/** رابط تنزيل مباشر لملف Google Drive */
export function driveDownloadUrl(url: string): string {
  const u = (url || '').trim();
  if (!u) return '';
  const id = extractDriveFileId(u);
  if (!id) return u;
  if (/export=download/i.test(u)) return u;
  return `https://drive.google.com/uc?export=download&id=${id}`;
}
