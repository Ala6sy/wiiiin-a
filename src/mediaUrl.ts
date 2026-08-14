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
  const thumb = (thumbnail || '').trim();
  /* روابط customer-report: ليست صورًا — استخدم الصورة المصغّرة فقط */
  if (/^customer-report:/i.test(rawUrl)) {
    return {
      thumbSrc: resolveImageSrc(thumb, 400),
      previewUrl: '',
      useModal: false,
    };
  }
  const id = extractDriveFileId(rawUrl || thumb);
  if (id) {
    return {
      thumbSrc: resolveImageSrc(thumb || rawUrl, 400),
      previewUrl: `https://drive.google.com/file/d/${id}/preview`,
      useModal: true,
    };
  }
  const thumbSrc = resolveImageSrc(thumb || rawUrl, 400);
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

/** هل الرابط فيديو (WebM / MP4 …) — أو مُعلَّم يدوياً في لوحة التحكم */
export function isVideoMediaUrl(url: string, forceVideo = false): boolean {
  if (forceVideo) return true;
  const u = (url || '').trim().toLowerCase();
  return /\.(webm|mp4|ogg|ogv|mov|m4v)(\?|#|$)/i.test(u)
    || /^data:video\//i.test(u);
}

/** صورة السيرة الافتراضية عند عدم تعيين وسائط مخصصة */
export const DEFAULT_ABOUT_HERO = '/alaa-photo.jpg';

export type AboutHeroResolved = {
  kind: 'image' | 'video';
  src: string;
};

/**
 * يحل وسائط صورة السيرة: فارغ → alaa-photo.jpg
 * صورة / فيديو / webm من رفع أو Drive
 */
export function resolveAboutHeroMedia(
  mediaUrl?: string,
  kind: 'auto' | 'image' | 'video' = 'auto',
): AboutHeroResolved {
  const raw = (mediaUrl || '').trim();
  if (!raw) return { kind: 'image', src: DEFAULT_ABOUT_HERO };
  const forceVideo = kind === 'video';
  const forceImage = kind === 'image';
  const asVideo = forceVideo || (!forceImage && isVideoMediaUrl(raw, false));
  if (asVideo) {
    return { kind: 'video', src: resolveVideoPlaybackSrc(raw) };
  }
  return { kind: 'image', src: resolveImageSrc(raw, 1600) };
}

/** رابط تشغيل فيديو في <video> — عبر video-proxy (نفس النطاق + Range للجوال) */
function videoProxyBase(): string {
  if (typeof window === 'undefined') return '/api/video-proxy.php';
  return import.meta.env.PROD && window.location.pathname !== '/'
    ? '../api/video-proxy.php'
    : '/api/video-proxy.php';
}

export function resolveVideoPlaybackSrc(url: string): string {
  const u = (url || '').trim();
  if (!u) return '';
  if (u.startsWith('data:') || u.startsWith('blob:')) return u;
  const id = extractDriveFileId(u);
  const direct = id ? driveDownloadUrl(u) : u;
  if (/^https?:\/\//i.test(direct)) {
    return `${videoProxyBase()}?url=${encodeURIComponent(direct)}`;
  }
  return direct;
}

export type ModelFileKind = 'glb' | 'gltf' | 'stl' | 'fbx';

export function detectModelFormat(url: string, hint: 'auto' | ModelFileKind = 'auto'): ModelFileKind {
  if (hint !== 'auto') return hint;
  const u = (url || '').trim().toLowerCase();
  if (/\.fbx(\?|#|$)/.test(u)) return 'fbx';
  if (/\.stl(\?|#|$)/.test(u)) return 'stl';
  if (/\.gltf(\?|#|$)/.test(u)) return 'gltf';
  return 'glb';
}

/** كشف الصيغة من بداية الملف */
export function detectModelFormatFromBuffer(buf: ArrayBuffer, hint: 'auto' | ModelFileKind = 'auto'): ModelFileKind {
  if (hint !== 'auto') return hint;
  const head = new Uint8Array(buf.slice(0, 24));
  const ascii = String.fromCharCode(...head.filter(b => b >= 32 && b < 127));
  if (ascii.includes('Kaydara FBX')) return 'fbx';
  if (head[0] === 0x7b) return 'gltf';
  if (head[0] === 0x67 && head[1] === 0x6c && head[2] === 0x54 && head[3] === 0x46) return 'glb';
  return 'glb';
}

/** رابط تحميل مجسم 3D (GLB/STL/FBX) عبر نفس النطاق */
export function resolveModelPlaybackSrc(url: string): string {
  return resolveVideoPlaybackSrc(url);
}
