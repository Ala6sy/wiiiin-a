const SEC_TITLE_PAD_X = 10;
const SEC_TITLE_ACCENT_W = 3;
const SEC_TITLE_BG = 'rgba(0, 51, 102, 0.07)';
const SEC_TITLE_NAVY = '#003366';

function sectionTitleTextY(ctx: CanvasRenderingContext2D, text: string, barH: number, fontPx: number): number {
  const m = ctx.measureText(text);
  const ascent = m.actualBoundingBoxAscent > 0 ? m.actualBoundingBoxAscent : fontPx * 0.88;
  const descent = m.actualBoundingBoxDescent > 0 ? m.actualBoundingBoxDescent : fontPx * 0.22;
  return (barH - ascent - descent) / 2 + ascent;
}

/** رسم عنوان قسم على canvas — توسيط عمودي/أفقي ثابت */
export async function rasterizeSectionTitle(
  width: number,
  barH: number,
  text: string,
  textColor: string,
  rtl: boolean,
  fontPx: number,
  fontWeight: number,
): Promise<string> {
  const fontSpec = `${fontWeight} ${fontPx}px Tajawal, "Segoe UI", Arial, sans-serif`;
  try {
    if (document.fonts?.load) {
      await Promise.all([
        document.fonts.load(fontSpec),
        document.fonts.load(`400 ${fontPx}px Tajawal`),
        document.fonts.load(`700 ${fontPx}px Tajawal`),
        document.fonts.load(`800 ${fontPx}px Tajawal`),
      ]);
    }
    if (document.fonts?.ready) await document.fonts.ready;
  } catch { /* */ }

  const dpr = Math.min(3, typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * dpr));
  canvas.height = Math.max(1, Math.ceil(barH * dpr));
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(dpr, dpr);
  ctx.fillStyle = SEC_TITLE_BG;
  ctx.fillRect(0, 0, width, barH);

  ctx.fillStyle = SEC_TITLE_NAVY;
  if (rtl) {
    ctx.fillRect(0, 0, SEC_TITLE_ACCENT_W, barH);
  } else {
    ctx.fillRect(width - SEC_TITLE_ACCENT_W, 0, SEC_TITLE_ACCENT_W, barH);
  }

  ctx.fillStyle = textColor;
  ctx.font = fontSpec;
  ctx.textBaseline = 'alphabetic';
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  const textX = rtl ? width - SEC_TITLE_PAD_X : SEC_TITLE_PAD_X;
  const textY = sectionTitleTextY(ctx, text, barH, fontPx);
  ctx.fillText(text, textX, textY);

  return canvas.toDataURL('image/png');
}

/** إعادة رسم عناوين الأقسام بالعرض الفعلي — ضروري بعد clone على الجوال */
export async function refreshCvSectionTitleBitmaps(root: HTMLElement): Promise<void> {
  const nodes = [...root.querySelectorAll<HTMLElement>('.cv-sec-title--raster')];
  await Promise.all(nodes.map(async (el) => {
    const text = el.dataset.cvTitleText;
    if (!text) return;

    const barH = Number(el.dataset.cvBarH) || 31;
    const accent = el.dataset.cvAccent || '#003366';
    const rtl = el.dataset.cvRtl === '1';
    const fontPx = Number(el.dataset.cvFontPx) || 13;
    const fontWeight = Number(el.dataset.cvFontWeight) || 800;

    const w = Math.round(el.offsetWidth);
    if (w < 12) return;

    const url = await rasterizeSectionTitle(w, barH, text, accent, rtl, fontPx, fontWeight);
    if (!url) return;

    el.querySelector('.cv-sec-title-placeholder')?.remove();
    let img = el.querySelector<HTMLImageElement>('.cv-sec-title-img');
    if (!img) {
      img = document.createElement('img');
      img.className = 'cv-sec-title-img';
      img.alt = '';
      img.draggable = false;
      el.appendChild(img);
    }
    img.src = url;
    img.width = w;
    img.height = barH;
    img.style.cssText = `display:block;width:${w}px;max-width:100%;height:${barH}px`;
    el.dataset.cvTitleReady = '1';
  }));
}
