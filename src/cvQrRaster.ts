/** تحويل صور QR إلى data URL قبل التصدير — دقة عالية + يمنع تلويث canvas */

const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const EXPORT_QR_MIN = 220;

type QrRasterOpts = {
  exportHiRes?: boolean;
};

function displayQrSize(img: HTMLImageElement): number {
  const attrW = Number(img.getAttribute('width')) || 0;
  const attrH = Number(img.getAttribute('height')) || 0;
  if (attrW > 0 && attrH > 0) return Math.round(Math.min(attrW, attrH));
  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
    return Math.min(img.naturalWidth, img.naturalHeight);
  }
  const rect = img.getBoundingClientRect();
  const fromRect = Math.min(rect.width, rect.height);
  if (fromRect > 8 && fromRect < 120) return Math.round(fromRect);
  return 68;
}

function fetchQrSize(displayPx: number, hiRes: boolean): number {
  if (!hiRes) return Math.max(96, displayPx);
  return Math.min(400, Math.max(180, displayPx * 3));
}

function hiResQrApiUrl(src: string, px: number): string | null {
  if (!src.includes('qrserver.com')) return null;
  try {
    const u = new URL(src);
    const data = u.searchParams.get('data');
    if (!data) return null;
    const size = Math.min(512, Math.max(EXPORT_QR_MIN, px));
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
  } catch {
    return null;
  }
}

function lockQrSquare(img: HTMLImageElement, displayPx: number): void {
  const px = Math.max(40, Math.min(96, Math.round(displayPx)));
  img.setAttribute('width', String(px));
  img.setAttribute('height', String(px));
  img.style.setProperty('width', `${px}px`, 'important');
  img.style.setProperty('height', `${px}px`, 'important');
  img.style.setProperty('max-width', `${px}px`, 'important');
  img.style.setProperty('min-width', `${px}px`, 'important');
  img.style.setProperty('max-height', `${px}px`, 'important');
  img.style.setProperty('min-height', `${px}px`, 'important');
  img.style.setProperty('display', 'block', 'important');
  img.style.setProperty('margin-inline', 'auto', 'important');
  img.style.setProperty('object-fit', 'contain', 'important');
  img.style.setProperty('flex-shrink', '0', 'important');
  img.style.removeProperty('aspect-ratio');
}

function hideQrImg(img: HTMLImageElement): void {
  img.src = TRANSPARENT_PNG;
  img.style.setProperty('display', 'none', 'important');
  img.style.setProperty('visibility', 'hidden', 'important');
}

async function fetchQrAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function refreshCvQrBitmaps(root: HTMLElement, opts: QrRasterOpts = {}): Promise<void> {
  const hiRes = opts.exportHiRes === true;
  const imgs = [
    ...root.querySelectorAll<HTMLImageElement>('.cv-docs-qr-img'),
    ...root.querySelectorAll<HTMLImageElement>('img[src*="qrserver.com"]'),
  ];
  await Promise.all(imgs.map(async img => {
    try {
      const displayPx = displayQrSize(img);
      const fetchPx = fetchQrSize(displayPx, hiRes);
      if (!img.src || img.src.startsWith('data:')) {
        lockQrSquare(img, displayPx);
        return;
      }

      let fetchUrl = img.src;
      if (hiRes) {
        const upgraded = hiResQrApiUrl(img.src, fetchPx);
        if (upgraded) fetchUrl = upgraded;
      }

      let dataUrl = await fetchQrAsDataUrl(fetchUrl);
      if (!dataUrl) {
        img.crossOrigin = 'anonymous';
        img.loading = 'eager';
        if (fetchUrl !== img.src) img.src = fetchUrl;
        await new Promise<void>(resolve => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
          setTimeout(resolve, 4000);
        });
        if (img.naturalWidth > 0) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              dataUrl = canvas.toDataURL('image/png');
            }
          } catch {
            dataUrl = null;
          }
        }
      }

      if (dataUrl) {
        img.src = dataUrl;
        lockQrSquare(img, displayPx);
        return;
      }

      hideQrImg(img);
    } catch {
      hideQrImg(img);
    }
  }));
}
