/**
 * BookCoverGenerator — الطريقة الثالثة لصورة الغلاف
 * - رفع صورة خلفية (لوغو/شعار) أو رابط Google Drive
 * - شريط عنوان قابل للتحكم الكامل (موضع X/Y/عرض/ارتفاع/لون/شفافية)
 * - حفظ قالب قابل لإعادة الاستخدام على أي كتاب
 * - النتيجة: Data URL (PNG) تُخزَّن في AgriBook.thumbnail
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import type { LangKey } from './appData';
import { isGoogleDriveUrl, extractDriveFileId } from './mediaUrl';

/* ═══════════════════════════════════════════════════════════ */
/* الإعدادات                                                    */
/* ═══════════════════════════════════════════════════════════ */

export interface CoverOverlaySettings {
  bgUrl: string;
  title: string;
  bandEnabled: boolean;
  bandColor: string;
  bandOpacity: number;
  bandHeightPct: number;
  bandXPct: number;
  bandYPct: number;
  bandWidthPct: number;
  fontSize: number;
  fontColor: string;
  fontWeight: 'normal' | 'bold';
  textAlign: 'right' | 'center' | 'left';
  textPaddingPct: number;
}

export const DEFAULT_COVER_SETTINGS: CoverOverlaySettings = {
  bgUrl: '',
  title: '',
  bandEnabled: true,
  bandColor: '#111111',
  bandOpacity: 0.85,
  bandHeightPct: 20,
  bandXPct: 0,
  bandYPct: 80,
  bandWidthPct: 100,
  fontSize: 20,
  fontColor: '#ffffff',
  fontWeight: 'bold',
  textAlign: 'center',
  textPaddingPct: 5,
};

const STORAGE_KEY = 'book-cover-generator-settings';
const TEMPLATE_KEY = 'book-cover-generator-template';

/* ═══════════════════════════════════════════════════════════ */
/* Canvas rendering                                             */
/* ═══════════════════════════════════════════════════════════ */

const W = 210;
const H = 297;

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [isNaN(r) ? 0 : r, isNaN(g) ? 0 : g, isNaN(b) ? 0 : b];
}

/**
 * يحوّل رابط Google Drive لرابط يعمل في Canvas عبر img-proxy.php
 * (يحلّ مشكلة CORS — المتصفح لا يسمح بقراءة صور Drive مباشرة في Canvas)
 */
function resolveForCanvas(url: string): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (isGoogleDriveUrl(url)) {
    const id = extractDriveFileId(url);
    const thumbUrl = id
      ? `https://drive.google.com/thumbnail?id=${id}&sz=w800`
      : url;
    return `/api/img-proxy.php?url=${encodeURIComponent(thumbUrl)}`;
  }
  return url;
}

async function loadImg(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function renderCover(canvas: HTMLCanvasElement, s: CoverOverlaySettings, title: string): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width  = W;
  canvas.height = H;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  if (s.bgUrl) {
    const img = await loadImg(resolveForCanvas(s.bgUrl));
    if (img) {
      const scale = Math.min(W / img.width, H / img.height);
      const dw = img.width  * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }
  }

  if (!s.bandEnabled) {
    drawTitle(ctx, s, title);
    return;
  }

  const bandH = Math.max(1, (s.bandHeightPct / 100) * H);
  const bandW = Math.max(1, (s.bandWidthPct  / 100) * W);
  const bandX = Math.max(0, Math.min(W - bandW, (s.bandXPct / 100) * W));
  const bandY = Math.max(0, Math.min(H - bandH, (s.bandYPct / 100) * H));

  const [r, g, b] = hexToRgb(s.bandColor);
  ctx.fillStyle = `rgba(${r},${g},${b},${s.bandOpacity})`;
  ctx.fillRect(bandX, bandY, bandW, bandH);

  drawTitle(ctx, s, title, bandX, bandY, bandW, bandH);
}

function drawTitle(
  ctx: CanvasRenderingContext2D,
  s: CoverOverlaySettings,
  title: string,
  bandX?: number,
  bandY?: number,
  bandW?: number,
  bandH?: number,
) {
  if (!title.trim()) return;
  ctx.save();
  ctx.fillStyle     = s.fontColor;
  ctx.font          = `${s.fontWeight} ${s.fontSize}px 'Tajawal','Arial',sans-serif`;
  ctx.textBaseline  = 'middle';
  ctx.direction     = 'rtl';
  ctx.textAlign     = s.textAlign as CanvasTextAlign;

  const bx    = bandX ?? 0;
  const bw    = bandW ?? W;
  const pad   = (s.textPaddingPct / 100) * bw;
  let xPos    = bx + bw / 2;
  if (s.textAlign === 'right') xPos = bx + bw - pad;
  if (s.textAlign === 'left')  xPos = bx + pad;

  const maxWidth = Math.max(10, bw - pad * 2);
  const lines    = buildTextLines(ctx, title, maxWidth);
  const lineH    = s.fontSize * 1.4;
  const totalH   = lines.length * lineH;
  let yStart: number;
  if (bandY !== undefined && bandH !== undefined) {
    yStart = bandY + (bandH - totalH) / 2 + lineH / 2;
  } else {
    yStart = (H - totalH) / 2 + lineH / 2;
  }

  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], xPos, yStart + i * lineH);
  }
  ctx.restore();
}

/** أسطر يدوية (Enter) ثم لف تلقائي إن طال السطر */
function buildTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const manual = text.replace(/\r\n/g, '\n').split('\n');
  const lines: string[] = [];
  for (const part of manual) {
    const trimmed = part.trimEnd();
    if (!trimmed) {
      lines.push('');
      continue;
    }
    lines.push(...wrapText(ctx, trimmed, maxWidth));
  }
  return lines.length ? lines : [''];
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/* ═══════════════════════════════════════════════════════════ */
/* مكوّن React                                                  */
/* ═══════════════════════════════════════════════════════════ */

/** قراءة إعدادات محفوظة من localStorage */
function readSaved(key: string): Partial<CoverOverlaySettings> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<CoverOverlaySettings>) : {};
  } catch { return {}; }
}

/** حفظ إعدادات في localStorage (بدون Data URL الكبيرة) */
function writeSaved(key: string, s: CoverOverlaySettings) {
  try {
    const clean = { ...s, bgUrl: s.bgUrl.startsWith('data:') ? '' : s.bgUrl };
    localStorage.setItem(key, JSON.stringify(clean));
  } catch { /* ignore */ }
}

export function BookCoverGenerator({
  initialSettings,
  bookTitle,
  lang,
  onApply,
  onClose,
}: {
  initialSettings?: Partial<CoverOverlaySettings>;
  bookTitle?: string;
  lang: LangKey;
  onApply: (dataUrl: string, settings: CoverOverlaySettings) => void;
  onClose: () => void;
}) {
  /* ── الحالة الأولية: initialSettings ← آخر جلسة ← الافتراضي ── */
  const [s, setS] = useState<CoverOverlaySettings>(() => {
    const session = readSaved(STORAGE_KEY);
    return {
      ...DEFAULT_COVER_SETTINGS,
      ...session,
      ...initialSettings,
      title: bookTitle || '',
    };
  });

  const [savedMsg,   setSavedMsg]   = useState('');
  const [templateOk, setTemplateOk] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  /* ── إعادة الرسم عند أي تغيير ── */
  const redraw = useCallback(async () => {
    const c = canvasRef.current;
    if (!c) return;
    await renderCover(c, s, s.title || bookTitle || '');
  }, [s, bookTitle]);

  useEffect(() => { redraw(); }, [redraw]);

  /* ── حفظ تلقائي لآخر جلسة ── */
  useEffect(() => { writeSaved(STORAGE_KEY, s); }, [s]);

  function upd<K extends keyof CoverOverlaySettings>(k: K, v: CoverOverlaySettings[K]) {
    setS(prev => ({ ...prev, [k]: v }));
  }

  function handleBgFile(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = e => upd('bgUrl', e.target?.result as string);
    reader.readAsDataURL(f);
  }

  /** حفظ القالب (بدون عنوان الكتاب وبدون Data URL) */
  function saveTemplate() {
    writeSaved(TEMPLATE_KEY, s);
    setSavedMsg(lang === 'ar' ? '✅ تم حفظ القالب' : '✅ Template saved');
    setTimeout(() => setSavedMsg(''), 2500);
  }

  /** تطبيق القالب المحفوظ (يبقي عنوان الكتاب الحالي) */
  function applyTemplate() {
    const tpl = readSaved(TEMPLATE_KEY);
    if (!Object.keys(tpl).length) {
      setSavedMsg(lang === 'ar' ? '⚠️ لا يوجد قالب محفوظ بعد' : '⚠️ No template saved yet');
      setTimeout(() => setSavedMsg(''), 2500);
      return;
    }
    setS(prev => ({ ...prev, ...tpl, title: prev.title }));
    setTemplateOk(true);
    setTimeout(() => setTemplateOk(false), 1800);
  }

  async function handleApply() {
    const c = canvasRef.current;
    if (!c) return;
    await renderCover(c, s, s.title || bookTitle || '');
    const dataUrl = c.toDataURL('image/png');
    onApply(dataUrl, s);
  }

  /* ── نصوص ── */
  const ar = lang === 'ar';
  const P = {
    title:       ar ? 'مولّد الغلاف التلقائي'            : 'Auto Cover Generator',
    bgLabel:     ar ? 'صورة الخلفية / اللوغو'             : 'Background / Logo Image',
    bgBtn:       ar ? 'رفع صورة'                           : 'Upload Image',
    bgUrl:       ar ? 'أو رابط صورة / Google Drive'        : 'Or image / Google Drive URL',
    textLabel:   ar ? 'نص العنوان على الغلاف'              : 'Title text on cover',
    textHint:    ar ? 'اضغط Enter لسطر جديد — المحاذاة الوسط تطبَّق على كل سطر' : 'Press Enter for a new line — center align applies per line',
    bandLabel:   ar ? 'شريط العنوان'                       : 'Title Band',
    bandEnabled: ar ? 'تفعيل شريط خلف العنوان'            : 'Enable title band',
    bandColor:   ar ? 'لون الشريط'                         : 'Band color',
    bandOpacity: ar ? 'شفافية الشريط'                      : 'Band opacity',
    bandHeight:  ar ? 'ارتفاع الشريط (%)'                  : 'Band height (%)',
    bandWidth:   ar ? 'عرض الشريط (%)'                     : 'Band width (%)',
    bandX:       ar ? 'إزاحة أفقية X (%)'                  : 'X offset (%)',
    bandY:       ar ? 'إزاحة عمودية Y (%)'                 : 'Y offset (%)',
    fontLabel:   ar ? 'خط العنوان'                         : 'Title Font',
    fontSize:    ar ? 'حجم الخط (px)'                      : 'Font size (px)',
    fontColor:   ar ? 'لون النص'                           : 'Font color',
    fontWeight:  ar ? 'سمك الخط'                           : 'Font weight',
    textAlign:   ar ? 'محاذاة النص'                        : 'Text align',
    textPad:     ar ? 'هامش أفقي (%)'                      : 'Horizontal padding (%)',
    bold:        ar ? 'عريض'   : 'Bold',
    normal:      ar ? 'عادي'   : 'Normal',
    right:       ar ? 'يمين'   : 'Right',
    center:      ar ? 'وسط'    : 'Center',
    left:        ar ? 'يسار'   : 'Left',
    preview:     ar ? '👁 معاينة الغلاف'                   : '👁 Preview',
    apply:       ar ? '✅ تطبيق على الغلاف'                : '✅ Apply to Book Cover',
    cancel:      ar ? 'إلغاء'  : 'Cancel',
    saveTemplate:  ar ? '💾 حفظ كقالب'                     : '💾 Save as Template',
    loadTemplate:  ar ? '📋 تطبيق القالب'                  : '📋 Apply Template',
    hint: ar
      ? 'اضغط «تطبيق» لتحويل الغلاف إلى صورة وحفظها مع الكتاب — رابط Google Drive يعمل تلقائياً عبر البروكسي.'
      : 'Press Apply to generate the PNG cover. Google Drive links work automatically via server proxy.',
  };

  /* ── ستايلات ── */
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' };
  const lbl: React.CSSProperties = { fontSize: 12, color: '#bbb', minWidth: 145, flexShrink: 0 };
  const inp: React.CSSProperties = {
    flex: 1, padding: '6px 10px', borderRadius: 7,
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff', fontSize: 13, fontFamily: 'inherit', minWidth: 0,
  };
  const section: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, marginBottom: 12,
  };
  const secTitle: React.CSSProperties = { fontWeight: 700, fontSize: 12, color: '#90cdf4', marginBottom: 8 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div style={{ background: '#1a2236', borderRadius: 16, border: '1.5px solid rgba(99,179,237,0.3)', width: '100%', maxWidth: 840, maxHeight: '96vh', overflowY: 'auto', padding: 20, color: '#e2e8f0' }}>

        {/* ── رأس النافذة ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: '#63b3ed' }}>🎨 {P.title}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {savedMsg && (
              <span style={{ fontSize: 12, color: templateOk ? '#68d391' : '#f6ad55', padding: '4px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.07)' }}>
                {savedMsg}
              </span>
            )}
            <button
              onClick={saveTemplate}
              title={P.saveTemplate}
              style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(104,211,145,0.15)', border: '1px solid rgba(104,211,145,0.4)', color: '#68d391', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {P.saveTemplate}
            </button>
            <button
              onClick={applyTemplate}
              title={P.loadTemplate}
              style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(246,173,85,0.15)', border: '1px solid rgba(246,173,85,0.4)', color: '#f6ad55', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              {P.loadTemplate}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0 }}>✕</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>

          {/* ─── أعمدة التحكم ─── */}
          <div style={{ flex: '1 1 300px', minWidth: 270 }}>

            {/* صورة الخلفية */}
            <div style={section}>
              <div style={secTitle}>🖼 {P.bgLabel}</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleBgFile(e.target.files)} />
                <button onClick={() => fileRef.current?.click()}
                  style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(99,179,237,0.2)', border: '1px solid rgba(99,179,237,0.4)', color: '#90cdf4', cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  📁 {P.bgBtn}
                </button>
                {s.bgUrl && !s.bgUrl.startsWith('data:') && (
                  <span style={{ fontSize: 11, color: '#68d391', alignSelf: 'center' }}>✓ رابط نشط</span>
                )}
                {s.bgUrl.startsWith('data:') && (
                  <span style={{ fontSize: 11, color: '#68d391', alignSelf: 'center' }}>✓ صورة محلية</span>
                )}
              </div>
              <input
                type="url"
                value={s.bgUrl.startsWith('data:') ? '' : s.bgUrl}
                placeholder="https://drive.google.com/file/d/.../view"
                style={{ ...inp, width: '100%', boxSizing: 'border-box', direction: 'ltr' }}
                onChange={e => upd('bgUrl', e.target.value)}
              />
              <div style={{ fontSize: 10, color: '#7a9cc0', marginTop: 5 }}>
                💡 روابط Google Drive تعمل تلقائياً عبر البروكسي — تأكد أن الملف «مشاركة مع الجميع»
              </div>
            </div>

            {/* عنوان الكتاب */}
            <div style={section}>
              <div style={secTitle}>📝 {P.textLabel}</div>
              <textarea
                value={s.title}
                placeholder={bookTitle || '...'}
                rows={3}
                style={{ ...inp, width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: 72, lineHeight: 1.5 }}
                onChange={e => upd('title', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') e.stopPropagation(); }}
              />
              <div style={{ fontSize: 10, color: '#7a9cc0', marginTop: 5 }}>↵ {P.textHint}</div>
            </div>

            {/* الشريط */}
            <div style={section}>
              <div style={secTitle}>🎨 {P.bandLabel}</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 10 }}>
                <input type="checkbox" checked={s.bandEnabled} onChange={e => upd('bandEnabled', e.target.checked)} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 13 }}>{P.bandEnabled}</span>
              </label>
              {s.bandEnabled && (<>
                {/* لون */}
                <div style={row}>
                  <span style={lbl}>{P.bandColor}</span>
                  <input type="color" value={s.bandColor} onChange={e => upd('bandColor', e.target.value)}
                    style={{ width: 42, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                  <span style={{ fontSize: 12, color: '#aaa' }}>{s.bandColor}</span>
                </div>
                {/* شفافية */}
                <div style={row}>
                  <span style={lbl}>{P.bandOpacity}</span>
                  <input type="range" min={0} max={1} step={0.05} value={s.bandOpacity} onChange={e => upd('bandOpacity', +e.target.value)} style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 38 }}>{Math.round(s.bandOpacity * 100)}%</span>
                </div>
                {/* ارتفاع */}
                <div style={row}>
                  <span style={lbl}>{P.bandHeight}</span>
                  <input type="range" min={5} max={60} step={1} value={s.bandHeightPct} onChange={e => upd('bandHeightPct', +e.target.value)} style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 38 }}>{s.bandHeightPct}%</span>
                </div>
                {/* عرض */}
                <div style={row}>
                  <span style={lbl}>{P.bandWidth}</span>
                  <input type="range" min={10} max={100} step={1} value={s.bandWidthPct} onChange={e => upd('bandWidthPct', +e.target.value)} style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 38 }}>{s.bandWidthPct}%</span>
                </div>
                {/* إزاحة X */}
                <div style={row}>
                  <span style={lbl}>{P.bandX}</span>
                  <input type="range" min={0} max={90} step={1} value={s.bandXPct} onChange={e => upd('bandXPct', +e.target.value)} style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 38 }}>{s.bandXPct}%</span>
                </div>
                {/* إزاحة Y */}
                <div style={row}>
                  <span style={lbl}>{P.bandY}</span>
                  <input type="range" min={0} max={90} step={1} value={s.bandYPct} onChange={e => upd('bandYPct', +e.target.value)} style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: '#aaa', minWidth: 38 }}>{s.bandYPct}%</span>
                </div>
              </>)}
            </div>

            {/* الخط */}
            <div style={section}>
              <div style={secTitle}>🔤 {P.fontLabel}</div>
              {/* الحجم */}
              <div style={row}>
                <span style={lbl}>{P.fontSize}</span>
                <input type="range" min={10} max={50} step={1} value={s.fontSize} onChange={e => upd('fontSize', +e.target.value)} style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 38 }}>{s.fontSize}px</span>
              </div>
              {/* اللون */}
              <div style={row}>
                <span style={lbl}>{P.fontColor}</span>
                <input type="color" value={s.fontColor} onChange={e => upd('fontColor', e.target.value)}
                  style={{ width: 42, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none' }} />
                <span style={{ fontSize: 12, color: '#aaa' }}>{s.fontColor}</span>
              </div>
              {/* السمك */}
              <div style={row}>
                <span style={lbl}>{P.fontWeight}</span>
                <select value={s.fontWeight} onChange={e => upd('fontWeight', e.target.value as 'normal' | 'bold')} style={{ ...inp, flex: 'unset', width: 110 }}>
                  <option value="bold">{P.bold}</option>
                  <option value="normal">{P.normal}</option>
                </select>
              </div>
              {/* المحاذاة */}
              <div style={row}>
                <span style={lbl}>{P.textAlign}</span>
                <select value={s.textAlign} onChange={e => upd('textAlign', e.target.value as 'right' | 'center' | 'left')} style={{ ...inp, flex: 'unset', width: 110 }}>
                  <option value="right">{P.right}</option>
                  <option value="center">{P.center}</option>
                  <option value="left">{P.left}</option>
                </select>
              </div>
              {/* الهامش */}
              <div style={row}>
                <span style={lbl}>{P.textPad}</span>
                <input type="range" min={0} max={25} step={1} value={s.textPaddingPct} onChange={e => upd('textPaddingPct', +e.target.value)} style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: '#aaa', minWidth: 38 }}>{s.textPaddingPct}%</span>
              </div>
            </div>

          </div>

          {/* ─── معاينة ─── */}
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 12, color: '#90cdf4', fontWeight: 700 }}>{P.preview}</div>
            <div style={{ border: '2px solid rgba(99,179,237,0.4)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
              <canvas ref={canvasRef} style={{ display: 'block', width: 148, height: 210 }} />
            </div>
            <div style={{ fontSize: 10, color: '#666', textAlign: 'center', maxWidth: 148 }}>210×297 px (A4)</div>
          </div>
        </div>

        {/* ── تلميح ── */}
        <div style={{ fontSize: 11, color: '#7a9cc0', background: 'rgba(99,179,237,0.06)', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
          💡 {P.hint}
        </div>

        {/* ── أزرار ── */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleApply} className="btn-prime" style={{ flex: 1, padding: '10px 0', fontSize: 14, fontWeight: 700 }}>
            {P.apply}
          </button>
          <button onClick={onClose} className="btn-cancel" style={{ padding: '10px 20px', fontSize: 14 }}>
            {P.cancel}
          </button>
        </div>

      </div>
    </div>
  );
}
