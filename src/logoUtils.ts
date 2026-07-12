/** هل المصدر SVG (data URL أو نص SVG أو امتداد) */
export function isSvgSource(src: string): boolean {
  if (!src) return false;
  const s = src.trim();
  const lower = s.toLowerCase();
  return lower.startsWith('data:image/svg+xml')
    || lower.endsWith('.svg')
    || s.startsWith('<svg')
    || s.startsWith('<?xml');
}

/** تجهيز SVG: أبعاد + تلوين — يُرجع data URL جاهز للعرض */
export function tintSvgDataUrl(svgRaw: string, color: string): string {
  let svg = svgRaw.trim();
  if (!svg.includes('<svg')) return svgRaw;

  /* إزالة BOM و XML declaration */
  svg = svg.replace(/^\uFEFF/, '').replace(/<\?xml[^?]*\?>/i, '');

  /* إضافة xmlns إن لم يكن موجوداً */
  if (!/xmlns=/i.test(svg)) {
    svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  /* إضافة width/height من viewBox إن لم تكن موجودة (مهم لعرض SVG في img) */
  if (!/\bwidth\s*=/i.test(svg)) {
    const vb = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    if (vb) {
      const p = vb[1].trim().split(/[\s,]+/).map(Number);
      if (p.length >= 4 && p[2] > 0 && p[3] > 0) {
        svg = svg.replace(/<svg/i, `<svg width="${p[2]}" height="${p[3]}"`);
      } else {
        svg = svg.replace(/<svg/i, '<svg width="400" height="120"');
      }
    } else {
      svg = svg.replace(/<svg/i, '<svg width="400" height="120" viewBox="0 0 400 120"');
    }
  }

  const c = color.trim() || '#ffffff';

  /* تلوين fill/stroke (لا نمس none/transparent/currentColor) */
  svg = svg.replace(
    /fill\s*=\s*["'](?!none|transparent|currentColor)[^"']*["']/gi,
    `fill="${c}"`,
  );
  svg = svg.replace(
    /stroke\s*=\s*["'](?!none|transparent|currentColor)[^"']*["']/gi,
    `stroke="${c}"`,
  );
  svg = svg.replace(
    /fill\s*:\s*(?!none|transparent|currentColor)[^;"']+/gi,
    `fill:${c}`,
  );
  svg = svg.replace(
    /stroke\s*:\s*(?!none|transparent|currentColor)[^;"']+/gi,
    `stroke:${c}`,
  );

  /* إذا لا يوجد fill على المسارات — أضف fill افتراضي */
  if (!/fill\s*=/i.test(svg) && !/fill\s*:/i.test(svg)) {
    svg = svg.replace(/<svg([^>]*)>/i, `<svg$1><g fill="${c}">`).replace(/<\/svg>/i, '</g></svg>');
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** قراءة ملف شعار وإرجاع data URL جاهز */
export function readLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const result = reader.result as string;
      if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        try {
          /* نخزّن SVG خام — التلوين يُطبّق عند العرض */
          resolve(result.startsWith('data:') ? result : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result)}`);
        } catch {
          resolve(result);
        }
      } else {
        resolve(result);
      }
    };
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}

/** استخراج نص SVG من data URL أو نص خام */
export function svgDataUrlToText(dataUrl: string): string | null {
  if (!dataUrl) return null;
  const raw = dataUrl.trim().replace(/^\uFEFF/, '');
  if (raw.startsWith('<svg') || raw.startsWith('<?xml')) return raw;
  if (!isSvgSource(dataUrl)) return null;
  try {
    if (dataUrl.includes('charset=utf-8,')) {
      return decodeURIComponent(dataUrl.split('charset=utf-8,')[1]);
    }
    if (dataUrl.includes('base64,')) {
      return atob(dataUrl.split('base64,')[1]);
    }
    if (dataUrl.includes(',')) {
      return decodeURIComponent(dataUrl.split(',')[1]);
    }
  } catch { /* */ }
  return null;
}

/** قناع أبيض من الشعار — لقص تأثير الإضاءة على الخطوط فقط */
export function buildLogoMaskDataUrl(src: string): string {
  if (!src) return src;
  const svgText = svgDataUrlToText(src);
  if (!svgText) return src;

  let svg = svgText.trim().replace(/^\uFEFF/, '').replace(/<\?xml[^?]*\?>/i, '');
  if (!/xmlns=/i.test(svg)) {
    svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!/\bwidth\s*=/i.test(svg)) {
    const vb = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    if (vb) {
      const p = vb[1].trim().split(/[\s,]+/).map(Number);
      if (p.length >= 4 && p[2] > 0 && p[3] > 0) {
        svg = svg.replace(/<svg/i, `<svg width="${p[2]}" height="${p[3]}"`);
      }
    }
  }

  /* قناع: أبيض على شفاف — يعمل مع fill و stroke (مخطوطة) */
  svg = svg.replace(
    /fill\s*=\s*["'](?!none|transparent)[^"']*["']/gi,
    'fill="#ffffff"',
  );
  svg = svg.replace(
    /stroke\s*=\s*["'](?!none|transparent)[^"']*["']/gi,
    'stroke="#ffffff"',
  );
  svg = svg.replace(
    /fill\s*:\s*(?!none|transparent)[^;"']+/gi,
    'fill:#ffffff',
  );
  svg = svg.replace(
    /stroke\s*:\s*(?!none|transparent)[^;"']+/gi,
    'stroke:#ffffff',
  );
  /* مسارات stroke-only: إضافة stroke أبيض إن لم يكن موجوداً */
  if (!/stroke\s*=/i.test(svg) && !/stroke\s*:/i.test(svg)) {
    svg = svg.replace(/<svg([^>]*)>/i, '<svg$1><g stroke="#ffffff" fill="none">').replace(/<\/svg>/i, '</g></svg>');
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function cssMaskUrl(src: string): string {
  return `url(${JSON.stringify(src)})`;
}

/** تحويل hex → rgb */
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** إضافة width/height من viewBox */
function ensureSvgDimensions(svg: string): string {
  if (/\bwidth\s*=/i.test(svg)) return svg;
  const vb = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (vb) {
    const p = vb[1].trim().split(/[\s,]+/).map(Number);
    if (p.length >= 4 && p[2] > 0 && p[3] > 0) {
      return svg.replace(/<svg/i, `<svg width="${p[2]}" height="${p[3]}"`);
    }
    return svg.replace(/<svg/i, '<svg width="400" height="120"');
  }
  return svg.replace(/<svg/i, '<svg width="400" height="120" viewBox="0 0 400 120"');
}

const CC_SWEEP_GRAD_ID = 'ccLightSweepGrad';

/** أبعاد viewBox أو width/height */
function parseViewBox(svg: string): { x: number; y: number; w: number; h: number } {
  const vb = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (vb) {
    const p = vb[1].trim().split(/[\s,]+/).map(Number);
    if (p.length >= 4 && p[2] > 0 && p[3] > 0) {
      return { x: p[0], y: p[1], w: p[2], h: p[3] };
    }
  }
  const wM = svg.match(/\bwidth\s*=\s*["']([\d.]+)/i);
  const hM = svg.match(/\bheight\s*=\s*["']([\d.]+)/i);
  const w = wM ? parseFloat(wM[1]) : 400;
  const h = hM ? parseFloat(hM[1]) : 120;
  return { x: 0, y: 0, w, h };
}

/** اتجاه التدرج ومسار الحركة — نفس معيار CSS linear-gradient */
function sweepAngleVectors(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const gx = Math.sin(rad);
  const gy = -Math.cos(rad);
  const mx = -gy;
  const my = gx;
  return { gx, gy, mx, my };
}

/** إحداثيات تدرج CC Light Sweep */
export interface SweepGradientFrame {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** حساب مواقع بداية/نهاية/وسط الحركة */
export function computeSweepGradientKeyframes(
  src: string,
  angleDeg: number,
): { start: SweepGradientFrame; end: SweepGradientFrame; mid: SweepGradientFrame; mx: number; my: number; travel: number } | null {
  const svgText = svgDataUrlToText(src);
  if (!svgText) return null;

  let svg = svgText.trim();
  if (!/viewBox\s*=/i.test(svg)) {
    const { w, h } = parseViewBox(svg);
    svg = svg.replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`);
  }

  const angle = Math.min(360, Math.max(0, angleDeg));
  const { x: vx, y: vy, w: vw, h: vh } = parseViewBox(svg);
  const cx = vx + vw / 2;
  const cy = vy + vh / 2;
  const beam = Math.max(Math.hypot(vw, vh) * 0.14, 12);
  const pad = beam * 1.5;
  const travel = Math.hypot(vw, vh) * 0.72 + pad;
  const half = beam / 2;
  const { gx, gy, mx, my } = sweepAngleVectors(angle);

  const pos = (centerX: number, centerY: number): SweepGradientFrame => ({
    x1: centerX - gx * half,
    y1: centerY - gy * half,
    x2: centerX + gx * half,
    y2: centerY + gy * half,
  });

  return {
    start: pos(cx + mx * travel, cy + my * travel),
    end: pos(cx - mx * travel, cy - my * travel),
    mid: pos(cx, cy),
    mx,
    my,
    travel,
  };
}

/** بيانات حركة التدرج (translate) */
export function computeSweepMotion(
  src: string,
  angleDeg: number,
): { mx: number; my: number; travel: number } | null {
  const kf = computeSweepGradientKeyframes(src, angleDeg);
  if (!kf) return null;
  return { mx: kf.mx, my: kf.my, travel: kf.travel };
}

export function lerpSweepFrame(
  a: SweepGradientFrame,
  b: SweepGradientFrame,
  t: number,
): SweepGradientFrame {
  return {
    x1: a.x1 + (b.x1 - a.x1) * t,
    y1: a.y1 + (b.y1 - a.y1) * t,
    x2: a.x2 + (b.x2 - a.x2) * t,
    y2: a.y2 + (b.y2 - a.y2) * t,
  };
}

export function applySweepGradientFrame(
  grad: SVGLinearGradientElement,
  frame: SweepGradientFrame,
): void {
  grad.setAttribute('x1', frame.x1.toFixed(3));
  grad.setAttribute('y1', frame.y1.toFixed(3));
  grad.setAttribute('x2', frame.x2.toFixed(3));
  grad.setAttribute('y2', frame.y2.toFixed(3));
}

export function sanitizeGradId(gradId: string): string {
  return gradId.replace(/[^a-zA-Z0-9_-]/g, '');
}

/** تحريك شريط اللون على طول التدرج (0→1) — يعمل في Chrome */
export function applySweepBandProgress(
  grad: SVGLinearGradientElement,
  t: number,
  bandWidth = 0.08,
): void {
  const c = Math.min(1, Math.max(0, t));
  const w = Math.min(0.22, Math.max(0.03, bandWidth));
  const raw = [
    0,
    c - w * 1.5,
    c - w * 0.75,
    c,
    c + w * 0.75,
    c + w * 1.5,
    1,
  ];
  const offs: number[] = [];
  raw.forEach((v, i) => {
    const clamped = Math.min(1, Math.max(0, v));
    offs[i] = i === 0 ? 0 : Math.max(offs[i - 1] + 0.001, clamped);
    if (i === raw.length - 1) offs[i] = 1;
  });

  const stops = grad.querySelectorAll('stop');
  stops.forEach((stop, i) => {
    if (i < offs.length) {
      stop.setAttribute('offset', `${(offs[i] * 100).toFixed(2)}%`);
    }
  });
}

/** إجبار Chrome على إعادة رسم مسارات التدرج */
export function forceSvgGradientRepaint(svg: SVGSVGElement | null): void {
  if (!svg) return;
  svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect').forEach((el) => {
    const stroke = el.getAttribute('stroke');
    const fill = el.getAttribute('fill');
    if (stroke?.includes('url(')) {
      el.removeAttribute('stroke');
      el.setAttribute('stroke', stroke);
    }
    if (fill?.includes('url(')) {
      el.removeAttribute('fill');
      el.setAttribute('fill', fill);
    }
  });
}

/**
 * CC Light Sweep — تدرج على fill/stroke المخطوطة (userSpaceOnUse)
 * motion=false → وسط ثابت | motion=true → موضع البداية (يُحرَّك بـ JS)
 */
export function buildSvgWithCcLightSweep(
  src: string,
  baseColor: string,
  sweepColor: string,
  _speedSec: number,
  angleDeg = 90,
  _motion = true,
  gradId = CC_SWEEP_GRAD_ID,
): string {
  const svgText = svgDataUrlToText(src);
  if (!svgText) return applyLogoColor(src, baseColor);

  let svg = svgText.trim().replace(/^\uFEFF/, '').replace(/<\?xml[^?]*\?>/i, '');
  if (!/xmlns=/i.test(svg)) {
    svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  svg = ensureSvgDimensions(svg);

  if (!/viewBox\s*=/i.test(svg)) {
    const { w, h } = parseViewBox(svg);
    svg = svg.replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`);
  }

  const base = baseColor.trim() || '#ffffff';
  const sweep = sweepColor.trim() || '#00ccff';
  const angle = Math.min(360, Math.max(0, angleDeg));

  const keyframes = computeSweepGradientKeyframes(src, angle);
  if (!keyframes) return applyLogoColor(src, baseColor);

  const { mx, my, travel } = keyframes;
  const { x: vx, y: vy, w: vw, h: vh } = parseViewBox(svg);
  const cx = vx + vw / 2;
  const cy = vy + vh / 2;
  /* خط التدرج على امتداد حركة الشعاع — كامل المخطوطة */
  const x1 = cx + mx * travel;
  const y1 = cy + my * travel;
  const x2 = cx - mx * travel;
  const y2 = cy - my * travel;

  const gradEsc = sanitizeGradId(gradId);
  svg = svg.replace(new RegExp(`<linearGradient[^>]*id=["']${gradEsc}["'][\\s\\S]*?<\\/linearGradient>`, 'gi'), '');
  svg = svg.replace(new RegExp(`url\\(#${gradEsc}\\)`, 'gi'), base);

  const gradDef = `<linearGradient id="${gradEsc}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
    <stop offset="0%" stop-color="${base}"/>
    <stop offset="35%" stop-color="${base}"/>
    <stop offset="42%" stop-color="${sweep}" stop-opacity="0.55"/>
    <stop offset="50%" stop-color="${sweep}"/>
    <stop offset="58%" stop-color="${sweep}" stop-opacity="0.55"/>
    <stop offset="65%" stop-color="${base}"/>
    <stop offset="100%" stop-color="${base}"/>
  </linearGradient>`;

  if (/<defs[\s>]/i.test(svg)) {
    svg = svg.replace(/<defs([^>]*)>/i, `<defs$1>${gradDef}`);
  } else {
    svg = svg.replace(/<svg([^>]*)>/i, `<svg$1><defs>${gradDef}</defs>`);
  }

  const gradRef = `url(#${gradEsc})`;
  svg = svg.replace(
    /fill\s*=\s*["'](?!none|transparent|currentColor|url\()[^"']*["']/gi,
    `fill="${gradRef}"`,
  );
  svg = svg.replace(
    /stroke\s*=\s*["'](?!none|transparent|currentColor|url\()[^"']*["']/gi,
    `stroke="${gradRef}"`,
  );
  svg = svg.replace(
    /fill\s*:\s*(?!none|transparent|currentColor|url\()[^;"']+/gi,
    `fill:${gradRef}`,
  );
  svg = svg.replace(
    /stroke\s*:\s*(?!none|transparent|currentColor|url\()[^;"']+/gi,
    `stroke:${gradRef}`,
  );

  if (!svg.includes(gradRef)) {
    svg = svg.replace(
      /<(path|polyline|polygon|line|circle|ellipse|rect)(\s[^>]*?)(\/?)>/gi,
      (_m, tag: string, attrs: string, close: string) => {
        let a = attrs;
        const strokeOnly = /fill\s*=\s*["']none["']/i.test(a) || (!/fill\s*=/i.test(a) && /stroke\s*=/i.test(a));
        if (strokeOnly || /stroke\s*=/i.test(a)) {
          if (/stroke\s*=/i.test(a)) {
            a = a.replace(/stroke\s*=\s*["'][^"']*["']/gi, `stroke="${gradRef}"`);
          } else {
            a += ` stroke="${gradRef}"`;
          }
          if (!/fill\s*=/i.test(a)) a += ' fill="none"';
        } else if (!/fill\s*=/i.test(a)) {
          a += ` fill="${gradRef}"`;
        }
        return `<${tag}${a}${close}>`;
      },
    );
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** SVG خام للعرض inline — اللون على الخطوط (الحركة عبر JS) */
export function buildSvgLightSweepMarkup(
  src: string,
  baseColor: string,
  sweepColor: string,
  speedSec: number,
  angleDeg: number,
  motion: boolean,
  gradId?: string,
): string | null {
  if (!isSvgSource(src)) return null;
  const dataUrl = buildSvgWithCcLightSweep(
    src, baseColor, sweepColor, speedSec, angleDeg, motion, gradId,
  );
  return svgDataUrlToText(dataUrl);
}

/** تدرج الشعاع الأفقي — fallback لصور PNG فقط */
export function buildSweepBeamGradient(color: string): string {
  const rgb = parseHex(color) ?? { r: 0, g: 204, b: 255 };
  const { r, g, b } = rgb;
  return [
    'linear-gradient(90deg,',
    'transparent 0%,',
    'transparent 28%,',
    `rgba(${r},${g},${b},0.45) 40%,`,
    `rgba(${r},${g},${b},1) 48%,`,
    `rgba(255,255,255,0.95) 50%,`,
    `rgba(${r},${g},${b},1) 52%,`,
    `rgba(${r},${g},${b},0.45) 60%,`,
    'transparent 72%,',
    'transparent 100%)',
  ].join(' ');
}

/** تدرج CC Light Sweep — fallback لصور PNG */
export function buildSweepGradient(color: string, angleDeg = 90): string {
  const rgb = parseHex(color) ?? { r: 0, g: 204, b: 255 };
  const { r, g, b } = rgb;
  const angle = Math.min(360, Math.max(0, angleDeg));
  return [
    `linear-gradient(${angle}deg,`,
    'transparent 0%,',
    'transparent 28%,',
    `rgba(${r},${g},${b},0.35) 40%,`,
    `rgba(${r},${g},${b},0.95) 47%,`,
    `rgba(255,255,255,1) 50%,`,
    `rgba(${r},${g},${b},1) 52%,`,
    `rgba(${r},${g},${b},0.4) 58%,`,
    'transparent 68%,',
    'transparent 100%)',
  ].join(' ');
}

/** توهج يتبع لون الشعاع */
export function buildSweepGlow(color: string): string {
  const rgb = parseHex(color) ?? { r: 0, g: 204, b: 255 };
  const { r, g, b } = rgb;
  return `drop-shadow(0 0 8px rgba(${r},${g},${b},0.6)) drop-shadow(0 0 16px rgba(${r},${g},${b},0.35))`;
}

/** تطبيق اللون على الشعار (SVG يُلوّن، PNG يُعرض كما هو) */
export function applyLogoColor(src: string, color: string): string {
  if (!src) return src;
  const svgText = svgDataUrlToText(src);
  if (svgText) return tintSvgDataUrl(svgText, color);
  return src;
}
