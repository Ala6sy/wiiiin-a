import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AppData, ML, ml, pickML, LangKey } from './appData';
import { AlaaLogo } from './AlaaLogo';
import { captureReportSnapshot, snapshotDataUrlToPdfBlob, waitForImages, rasterizeReportImagesForCapture } from './plantReportPdfExport';
import { resolveImageSrc } from './mediaUrl';

/* ── Localized labels ─────────────────────────────────── */
const LBL = {
  reportTitle: ml('تقرير التشخيص الزراعي', 'Agricultural Diagnostic Report', 'Agrardiagnosebericht'),
  uploadTitle: ml('ارفع صور النبات (ورقة، ساق، جذور، صورة مجهرية)', 'Upload plant images (leaf, stem, roots, microscopic)', 'Pflanzenbilder hochladen (Blatt, Stängel, Wurzeln, Mikroskop)'),
  addImg: ml('رفع صورة', 'Add image', 'Bild'),
  sourceTitle: ml('اختر مصدر الصورة', 'Choose image source', 'Bildquelle wählen'),
  sourceCamera: ml('تصوير مباشر بالكاميرا', 'Take a photo', 'Foto aufnehmen'),
  sourceCameraHint: ml('افتح كاميرا الجوال وصوّر النبات', 'Open the camera and photograph the plant', 'Kamera öffnen und Pflanze fotografieren'),
  sourceGallery: ml('اختيار من الاستديو', 'Choose from gallery', 'Aus der Galerie wählen'),
  sourceGalleryHint: ml('اختر صورة أو أكثر من معرض الصور', 'Pick one or more saved images', 'Ein oder mehrere gespeicherte Bilder wählen'),
  cancel: ml('إلغاء', 'Cancel', 'Abbrechen'),
  diagnoseBtn: ml('تشخيص فوري وتقرير pdf', 'Instant diagnosis & PDF report', 'Sofortige Diagnose & PDF-Bericht'),
  analyzing: ml('جاري التحليل...', 'Analyzing...', 'Analysiere...'),
  noImages: ml('الرجاء رفع صورة واحدة على الأقل', 'Please upload at least one image', 'Bitte mindestens ein Bild hochladen'),
  error: ml('تعذّر إجراء التشخيص. حاول مرة أخرى.', 'Diagnosis failed. Please try again.', 'Diagnose fehlgeschlagen. Bitte erneut versuchen.'),
  resultTitle: ml('نتيجة التشخيص', 'Diagnosis Result', 'Diagnoseergebnis'),
  plantName: ml('اسم النبات', 'Plant Name', 'Pflanzenname'),
  origin: ml('الموطن الأصلي', 'Origin', 'Herkunft'),
  scientific: ml('الاسم العلمي', 'Scientific Name', 'Wissenschaftlicher Name'),
  careTitle: ml('تعليمات العناية', 'Care Instructions', 'Pflegehinweise'),
  water: ml('الري', 'Water', 'Wasser'),
  fertilizer: ml('التسميد', 'Fertilizer', 'Dünger'),
  light: ml('الإضاءة', 'Light', 'Licht'),
  lightLux: ml('شدة الإضاءة (لوكس)', 'Light Intensity (Lux)', 'Lichtintensität (Lux)'),
  temperature: ml('درجة الحرارة المثلى (°C)', 'Optimal Temperature (°C)', 'Optimale Temperatur (°C)'),
  soilSection: ml('التربة المناسبة', 'Suitable Soil', 'Geeigneter Boden'),
  soilType: ml('نوع التربة', 'Soil Type', 'Bodenart'),
  nutrientsSection: ml('عناصر التغذية الكبرى والصغرى', 'Macro & Micro Nutrients', 'Makro- & Mikronährstoffe'),
  nutrientName: ml('العنصر', 'Element', 'Element'),
  nutrientCat: ml('التصنيف', 'Category', 'Kategorie'),
  nutrientRatio: ml('النسبة الموصى بها', 'Recommended Ratio', 'Empfohlenes Verhältnis'),
  fertRatios: ml('نسب التسميد بالأرقام', 'Fertilization Ratios', 'Düngungsquoten'),
  plantingSection: ml('مواعيد الزراعة والحصاد', 'Planting & Harvest Schedule', 'Pflanz- & Erntetermine'),
  plantingDate: ml('موعد الزراعة', 'Planting Date', 'Pflanztermin'),
  daysToHarvest: ml('أيام حتى الإنتاج', 'Days to Production', 'Tage bis zur Ernte'),
  harvestTime: ml('موسم الحصاد', 'Harvest Season', 'Erntezeit'),
  usesSection: ml('استخدامات النبات', 'Plant Uses', 'Pflanzenverwendung'),
  healthSection: ml('الفوائد الصحية والطبية', 'Health & Medicinal Benefits', 'Gesundheits- & Heilvorteile'),
  healthBenefits: ml('الفوائد الصحية والغذائية', 'Health & Nutritional Benefits', 'Gesundheits- & Ernährungsvorteile'),
  medicinalSubstances: ml('المواد الفعالة الدوائية', 'Active Medicinal Compounds', 'Aktive Heilstoffe'),
  medicines: ml('الأدوية والمستحضرات المستخلصة', 'Derived Pharmaceutical Products', 'Abgeleitete Arzneimittel'),
  diseaseTitle: ml('التشخيص المرضي والآفات', 'Disease & Pest Diagnosis', 'Krankheits- & Schädlingsdiagnose'),
  diseaseType: ml('نوع الإصابة', 'Type', 'Art'),
  diseaseDetail: ml('التشخيص', 'Diagnosis', 'Diagnose'),
  pesticides: ml('المبيدات الموصى بها', 'Recommended Pesticides', 'Empfohlene Pestizide'),
  pesticideDosage: ml('جرعة المبيد للتعافي', 'Pesticide dosage for recovery', 'Pestizid-Dosierung zur Genesung'),
  engineerNote: ml(
    'يرجى التواصل مع المهندس لتقييم الوضع بشكل ممتاز ولتحليل التربة مخبرياً ومجهرياً',
    'Please contact the engineer for an expert assessment and laboratory/microscopic soil analysis.',
    'Bitte kontaktieren Sie den Ingenieur für eine fachgerechte Bewertung und labor-/mikroskopische Bodenanalyse.',
  ),
  imageLabel: ml('صورة', 'Image', 'Bild'),
  noDisease: ml('لا توجد أمراض مكتشفة', 'No diseases detected', 'Keine Krankheiten festgestellt'),
  soilTitle: ml('تحليل التربة والمياه', 'Soil & Water Analysis', 'Boden- & Wasseranalyse'),
  testName: ml('اسم الاختبار', 'Test Name', 'Test'),
  ideal: ml('النتيجة المثالية', 'Ideal Result', 'Idealwert'),
  actual: ml('النتيجة الفعلية', 'Actual Result', 'Istwert'),
  price: ml('السعر', 'Price', 'Preis'),
  tax: ml('الضريبة %', 'Tax %', 'Steuer %'),
  total: ml('الإجمالي', 'Total', 'Gesamt'),
  grandTotal: ml('الإجمالي الكلي', 'Grand Total', 'Gesamtsumme'),
  previewTitle: ml('معاينة وتصدير التقرير', 'Report Preview & Export', 'Berichtsvorschau & Export'),
  exportLang: ml('تصدير PDF حسب اللغة', 'Export PDF by language', 'PDF nach Sprache exportieren'),
  preparing: ml('جاري التحضير...', 'Preparing...', 'Wird vorbereitet...'),
  date: ml('التاريخ', 'Date', 'Datum'),
  engSignature: ml('التوقيع', 'Signature', 'Unterschrift'),
  engStamp: ml('الختم', 'Stamp', 'Stempel'),
  printBtn: ml('طباعة التقرير', 'Print Report', 'Bericht drucken'),
  shareTitle: ml('مشاركة التقرير', 'Share Report', 'Bericht teilen'),
};

interface DiseaseEntry {
  imageNumbers: number[];
  diseaseType?: string;
  diseaseDetail?: string;
  pesticides?: string;
  pesticideDosage?: string;
}

interface NutrientRow {
  name?: string;
  category?: string;
  ratio?: string;
}

/** Arabic parenthetical abbreviations → IUPAC Latin symbols e.g. (ن) → (N) */
const NUTRIENT_SYMBOL_AR_TO_LATIN: Record<string, string> = {
  'ن': 'N', 'ف': 'P', 'ك': 'K', 'بو': 'K', 'كا': 'Ca', 'مغ': 'Mg', 'م': 'Mg',
  'س': 'S', 'كب': 'S', 'ح': 'Fe', 'من': 'Mn', 'ز': 'Zn', 'ب': 'B', 'نح': 'Cu',
};

function normalizeNutrientName(name?: string): string {
  if (!name?.trim()) return '—';
  return name.replace(/\(([^)]+)\)/g, (_, inner: string) => {
    const compact = inner.trim().replace(/\s+/g, '');
    const latin = NUTRIENT_SYMBOL_AR_TO_LATIN[compact] ?? NUTRIENT_SYMBOL_AR_TO_LATIN[inner.trim()];
    if (latin) return `(${latin})`;
    if (/^[A-Za-z]{1,2}$/.test(compact)) return `(${compact.toUpperCase()})`;
    return `(${inner.trim()})`;
  });
}

function normalizeNutrientsInResult(r: DiagResult): DiagResult {
  if (!r.nutrients?.length) return r;
  return {
    ...r,
    nutrients: r.nutrients.map(n => ({
      ...n,
      name: normalizeNutrientName(n.name),
    })),
  };
}

function NutrientNameCell({ name, isRtl }: { name?: string; isRtl: boolean }) {
  const normalized = normalizeNutrientName(name);
  if (!isRtl || normalized === '—') return <>{normalized}</>;
  const m = normalized.match(/^(.+?)\s*\(([A-Za-z]{1,2})\)\s*$/);
  if (!m) return <>{normalized}</>;
  return (
    <>
      {m[1].trim()}{' '}
      <span dir="ltr" style={{ unicodeBidi: 'isolate', whiteSpace: 'nowrap' }}>({m[2]})</span>
    </>
  );
}

interface DiagResult {
  plantName?: string; scientificName?: string; origin?: string;
  water?: string; fertilizer?: string; light?: string;
  lightLux?: string; temperature?: string;
  soilType?: string;
  nutrients?: NutrientRow[];
  fertilizationRatios?: string;
  plantingDate?: string;
  daysToHarvest?: string;
  harvestTime?: string;
  uses?: string;
  healthBenefits?: string;
  medicinalSubstances?: string;
  medicines?: string;
  diseases?: DiseaseEntry[];
  /* legacy flat fields (backward compat) */
  diseaseType?: string; diseaseDetail?: string; pesticides?: string;
}

const FALLBACK_GREEN = '#2a7a2a';
const NAVY = '#003366';
const EXPORT_LANGS: { code: LangKey; flag: string; label: string }[] = [
  { code: 'ar', flag: '🇸🇾', label: 'عربي' },
  { code: 'en', flag: '🇺🇸', label: 'English' },
  { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
];

/* Resize an image file to a JPEG data URL (max edge px) to cut payload & cost */
function fileToDataUrl(file: File, max = 1100): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > max || height > max) {
          const r = Math.min(max / width, max / height);
          width = Math.round(width * r); height = Math.round(height * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(reader.result as string); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PDF_ENDPOINT = '/generate_report.php';

/** جهاز محمول بكاميرا مدمجة — يشمل iPadOS الذي يُعرّف نفسه كـ Macintosh */
function isHandheldDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPod|iPad|Windows Phone|Mobile|Opera Mini|IEMobile/i.test(ua)) return true;
  return navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua);
}

/** Offscreen 794px render for export — avoids preview scale-transform artifacts */
async function captureReportElementForPdf(
  target: LangKey,
  result: DiagResult,
  setCapture: (v: { lang: LangKey; result: DiagResult } | null) => void,
  hostRef: React.RefObject<HTMLDivElement | null>,
): Promise<HTMLElement> {
  flushSync(() => setCapture({ lang: target, result }));
  await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  await new Promise(r => setTimeout(r, 350));
  const el = hostRef.current?.querySelector('.plant-report-print-root') as HTMLElement | null;
  if (!el) {
    flushSync(() => setCapture(null));
    throw new Error('تعذّر تحضير التقرير للتصدير');
  }
  await waitForImages(el);
  await rasterizeReportImagesForCapture(el);
  return el;
}

async function parsePdfResponse(res: Response): Promise<{ ok: boolean; pdf_base64?: string; file_url?: string; error?: string }> {
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch {
    if (!res.ok) {
      throw new Error(
        `خادم PDF أعاد خطأ ${res.status}.\n` +
        'تأكّد من رفع generate_report.php ومجلد vendor/ على Hostinger.\n' +
        'استخدم زر "طباعة التقرير" بدلاً من ذلك.'
      );
    }
    throw new Error(
      'خادم PDF غير متاح حالياً.\n' +
      'استخدم زر "طباعة التقرير" للحصول على PDF عبر المتصفح.'
    );
  }
}

export function PlantDiagnostic({ data, lang }: { data: AppData; lang: LangKey }) {
  const isRtl = lang === 'ar';
  const L = (m: ML) => pickML(m, lang);

  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [results, setResults] = useState<Partial<Record<LangKey, DiagResult>>>({});
  const [exportBusy, setExportBusy] = useState<LangKey | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const previewWrapRef    = useRef<HTMLDivElement>(null);
  const previewContentRef = useRef<HTMLDivElement>(null);
  const pdfCaptureHostRef = useRef<HTMLDivElement>(null);
  const [pdfCapture, setPdfCapture] = useState<{ lang: LangKey; result: DiagResult } | null>(null);
  const [previewScale, setPreviewScale] = useState(0);
  const [previewNatH,  setPreviewNatH]  = useState(0);
  const [previewReady, setPreviewReady] = useState(false);

  const current = results[lang];
  const exporting = !!exportBusy;

  /* Cached diagnoses belong to a specific image set — drop them when images change */
  useEffect(() => { setResults({}); }, [images]);

  /* ─────────────────────────────────────────────────────────────────
     Scale A4 preview to fit mobile width without distorting layout.

     Strategy
     ─────────
     • transform:scale(s) preserves the INTERNAL 794 px coordinate space
       so flex/grid layouts compute at full A4 width (no overlap).
     • We add  marginBottom = natH × (s − 1)  (always negative when s<1)
       so the wrapper height collapses to  natH × s  (the visual height).
     • overflow:hidden on the wrapper clips the right edge cleanly.
     • direction:ltr on the wrapper ensures transformOrigin "0 0"
       anchors to the physical left edge, which is always correct for
       the scale formula: visual_width = 794 × s ≈ available_width.
  ───────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!current) return;
    setPreviewReady(false);
    let ro: ResizeObserver | null = null;

    const measure = () => {
      const wrap    = previewWrapRef.current;
      const content = previewContentRef.current;
      if (!wrap || !content) return;

      const avail = Math.max(280, wrap.clientWidth - 24);
      const scale = Math.min(1.0, Math.max(0.05, avail / 794));

      /* scrollHeight = layout height (unaffected by transform:scale) */
      const natH  = content.scrollHeight;

      setPreviewScale(scale);
      setPreviewNatH(natH);
      setPreviewReady(true);
    };

    /* Double RAF: first frame mounts the DOM, second frame settles layout */
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        measure();
        const wrap = previewWrapRef.current;
        if (!wrap) return;
        ro = new ResizeObserver(measure);
        ro.observe(wrap);
      });
      return raf2;
    });

    return () => { cancelAnimationFrame(raf1); ro?.disconnect(); };
  }, [current]);

  /* ── images ── */
  /* الهواتف: نعرض خيار الكاميرا/الاستديو لأن Chrome على أندرويد يفتح الاستديو فقط مع multiple */
  function openImagePicker() {
    if (isHandheldDevice()) setSourceOpen(true);
    else fileRef.current?.click();
  }

  function pickFromSource(source: 'camera' | 'gallery') {
    setSourceOpen(false);
    const input = source === 'camera' ? cameraRef.current : fileRef.current;
    window.setTimeout(() => input?.click(), 60);
  }

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const slots = 6 - images.length;
    const picked = Array.from(files).slice(0, Math.max(0, slots));
    const urls = await Promise.all(picked.map(f => fileToDataUrl(f)));
    setImages(prev => [...prev, ...urls].slice(0, 6));
  }

  async function fetchDiagnose(target: LangKey): Promise<DiagResult> {
    const langMap: Record<LangKey, string> = { ar: 'Arabic', en: 'English', de: 'German' };
    const langName = langMap[target];
    const imageCount = images.length;

    const prompt = `You are an expert agricultural engineer analyzing ${imageCount} plant image(s) numbered 1 to ${imageCount}.

IMPORTANT: Respond ONLY in ${langName}. Every text value must be in ${langName} EXCEPT scientificName which is always Latin.

Return STRICT JSON only (no markdown, no extra text):
{
  "plantName": "plant name in ${langName}",
  "scientificName": "Latin binomial name",
  "origin": "geographic origin and native region of this plant in ${langName} (e.g. country, continent, region)",
  "water": "watering frequency and method in ${langName}",
  "light": "daily light hours and conditions (e.g. 6-8 hours direct sun) in ${langName}",
  "lightLux": "required light intensity in lux with range (e.g. 25000-45000 lux) in ${langName}",
  "temperature": "optimal temperature ranges in Celsius: minimum/maximum for growth, ideal daytime temp, ideal nighttime temp, frost tolerance (e.g. 18-25°C day, 12-15°C night) in ${langName}",
  "fertilizer": "general fertilizer guidance in ${langName}",
  "soilType": "best soil types for this plant (sandy/clay/loamy/red/etc.) with pH range in ${langName}",
  "nutrients": [
    {"name": "Nitrogen (N)", "category": "Macro", "ratio": "150-200 kg/ha or equivalent"},
    {"name": "Phosphorus (P)", "category": "Macro", "ratio": "..."},
    {"name": "Potassium (K)", "category": "Macro", "ratio": "..."},
    {"name": "Calcium (Ca)", "category": "Macro", "ratio": "..."},
    {"name": "Magnesium (Mg)", "category": "Macro", "ratio": "..."},
    {"name": "Sulfur (S)", "category": "Macro", "ratio": "..."},
    {"name": "Iron (Fe)", "category": "Micro", "ratio": "..."},
    {"name": "Manganese (Mn)", "category": "Micro", "ratio": "..."},
    {"name": "Zinc (Zn)", "category": "Micro", "ratio": "..."},
    {"name": "Boron (B)", "category": "Micro", "ratio": "..."},
    {"name": "Copper (Cu)", "category": "Micro", "ratio": "..."}
  ],
  "fertilizationRatios": "detailed N-P-K ratios with exact numbers and application timing in ${langName}",
  "plantingDate": "best season and month to sow seeds or transplant seedlings in ${langName}",
  "daysToHarvest": "number of days from planting to first production or fruit in ${langName}",
  "harvestTime": "harvest season and optimal harvest indicators in ${langName}",
  "uses": "uses of each plant part (fruits, wood, bark, leaves, seeds, roots) - list each part separately in ${langName}",
  "healthBenefits": "nutritional value, health benefits and traditional medicinal uses in ${langName}",
  "medicinalSubstances": "active pharmaceutical compounds with the specific plant part they come from (leaf/stem/root/fruit/bark/seed) in ${langName}",
  "medicines": "names of known pharmaceutical drugs or commercial products derived from this plant. Write only plant name in ${langName} if none known.",
  "diseases": [
    {
      "imageNumbers": [1],
      "diseaseType": "disease classification in ${langName}",
      "diseaseDetail": "detailed diagnosis in ${langName}",
      "pesticides": "recommended pesticide product names with active ingredients in ${langName}",
      "pesticideDosage": "exact pesticide concentration, dilution ratio (e.g. 2 ml/L), application rate per plant or per hectare, number of treatments and interval days until recovery — numeric values required in ${langName}"
    }
  ]
}

Rules:
- nutrients name: translate element name to ${langName} but ALWAYS use Latin chemical symbol in parentheses — e.g. Arabic "النتروجين (N)" never "(ن)"; Phosphorus "(P)", Potassium "(K)", etc.
- nutrients ratio: write full text in ${langName}; for Arabic use natural right-to-left order (e.g. "100-150 كجم/هكتار سنوياً")
- nutrients category: keep "Macro" or "Micro" in English
- Examine each image separately for disease
- Group images with SAME disease into one entry with imageNumbers listing all affected images
- Healthy images are NOT included in diseases array
- diseases can be []
- When a disease is detected, pesticides AND pesticideDosage are mandatory with specific numbers (ml/L, %, g/L, treatments count)`;

    /* دائماً من جذر الموقع — المسارات النسبية تتكسر على /agri/diag وغيرها */
    const proxyUrl = (import.meta.env.VITE_AI_PROXY_URL as string | undefined)
      || '/ai_proxy.php';

    const proxyBody = JSON.stringify({
      prompt,
      images: images.map(img => ({
        mime_type: 'image/jpeg',
        data: img.includes(',') ? img.split(',')[1] : img,
      })),
    });

    const res = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: proxyBody,
    });

    const raw = await res.text();
    let json: { ok?: boolean; error?: string; result?: DiagResult };
    try {
      json = JSON.parse(raw) as typeof json;
    } catch {
      if (raw.trimStart().startsWith('<?php') || raw.trimStart().startsWith('<!')) {
        throw new Error(
          import.meta.env.DEV
            ? 'تعذّر تشغيل ai_proxy.php محلياً. أعد تشغيل Vite — الطلب يُوجَّه تلقائياً إلى Hostinger (eng-alaa.com).'
            : 'خطأ في الخادم: تأكد من رفع ai_proxy.php و config.php على Hostinger.'
        );
      }
      throw new Error('استجابة غير صالحة من خادم التشخيص.');
    }

    if (!res.ok || !json.ok) {
      const detail = (json?.error || '').trim();
      throw new Error(detail || `خطأ في الاتصال بالخادم (HTTP ${res.status})`);
    }

    return normalizeNutrientsInResult(json.result as DiagResult);
  }

  async function diagnose() {
    if (!images.length) { setErrMsg(L(LBL.noImages)); return; }
    setErrMsg(''); setLoading(true);
    try {
      const r = await fetchDiagnose(lang);
      setResults(prev => ({ ...prev, [lang]: r }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrMsg(msg || L(LBL.error));
    } finally {
      setLoading(false);
    }
  }

  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [shareData, setShareData] = useState<{ blob: Blob; blobUrl: string; fileName: string; plantName: string; serverUrl: string } | null>(null);
  const shareCacheRef = useRef(new Map<LangKey, { blob: Blob; blobUrl: string; fileName: string; plantName: string; serverUrl: string }>());

  const closeSharePanel = () => setSharePanelOpen(false);

  const downloadShareFile = (data: { blobUrl: string; fileName: string }) => {
    const a = document.createElement('a');
    a.href = data.blobUrl;
    a.download = data.fileName;
    a.click();
  };

  /* ── Export: snapshot of preview → single-image PDF on Hostinger ── */
  async function exportLangPdf(target: LangKey, opts?: { openShare?: boolean }) {
    if (!images.length || exportBusy) return;
    const openShare = opts?.openShare ?? false;
    setErrMsg('');
    if (openShare) {
      setSharePanelOpen(true);
      setShareData(null);
    }

    shareCacheRef.current.delete(target);

    setExportBusy(target);

    try {
      let r = results[target];
      if (!r) {
        r = await fetchDiagnose(target);
        setResults(prev => ({ ...prev, [target]: r! }));
      }

      const plant    = r.plantName?.trim();
      const tpl      = data.reportTemplate;
      const fileName = `${plant ? plant.replace(/\s+/g, '_') + '_' : ''}Plant_Report_${target}.pdf`;

      const reportEl = await captureReportElementForPdf(target, r, setPdfCapture, pdfCaptureHostRef);

      let reportSnapshot: string;
      try {
        reportSnapshot = await captureReportSnapshot(reportEl);
      } finally {
        flushSync(() => setPdfCapture(null));
      }

      /* PDF محلي — نفس لقطة المعاينة بدون إعادة ترميز dompdf */
      const blob = await snapshotDataUrlToPdfBlob(reportSnapshot);
      const blobUrl = URL.createObjectURL(blob);

      let serverUrl = '';
      try {
        const res = await fetch(PDF_ENDPOINT, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            lang: target,
            reportSnapshot,
            fileName,
            pageBgColor: tpl?.pageBgColor || '#ffffff',
          }),
        });
        const json = await parsePdfResponse(res);
        if (res.ok && json.ok) serverUrl = json.file_url || '';
      } catch { /* التنزيل/المشاركة تعمل من blob المحلي */ }

      const sharePayload = { blob, blobUrl, fileName, plantName: plant || '', serverUrl };
      shareCacheRef.current.set(target, sharePayload);

      if (openShare) setShareData(sharePayload);
      else downloadShareFile(sharePayload);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrMsg(msg || L(LBL.error));
      if (openShare) setSharePanelOpen(false);
    } finally {
      setExportBusy(null);
    }
  }

  /* ── Inline share panel (below print/share bar) ── */
  function InlineSharePanel() {
    if (!sharePanelOpen) return null;
    const busy = exportBusy === lang && !shareData;

    const mailSubject = shareData
      ? encodeURIComponent(`تقرير التشخيص الزراعي${shareData.plantName ? ` — ${shareData.plantName}` : ''}`)
      : '';
    const mailBody = shareData
      ? encodeURIComponent(`السلام عليكم،\n\nمرفق تقرير التشخيص الزراعي${shareData.plantName ? ` للنبات: ${shareData.plantName}` : ''}.\n\nمع التحية،\nعلاء أحمد المصري\neng-alaa.com`)
      : '';
    const waHref = shareData
      ? `https://wa.me/?text=${encodeURIComponent(shareData.serverUrl || shareData.blobUrl)}`
      : '#';

    return (
      <div className="plant-share-inline no-print">
        {busy && (
          <div className="plant-share-loading">
            <i className="fa-solid fa-spinner fa-spin" /> {L(LBL.preparing)}
          </div>
        )}
        {shareData && (
          <>
            <div className="plant-share-actions">
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="plant-share-btn">
                <i className="fa-brands fa-whatsapp" /> واتساب
              </a>
              <button type="button" className="plant-share-btn" onClick={() => downloadShareFile(shareData)}>
                <i className="fa-solid fa-download" /> تنزيل PDF
              </button>
              <a href={`mailto:?subject=${mailSubject}&body=${mailBody}`} className="plant-share-btn">
                <i className="fa-solid fa-envelope" /> بريد
              </a>
            </div>
            {shareData.serverUrl && (
              <div className="plant-share-link">
                <i className="fa-solid fa-link" /> رابط مباشر: <span dir="ltr">{shareData.serverUrl}</span>
              </div>
            )}
            <button type="button" className="plant-share-close" onClick={closeSharePanel}>
              إغلاق
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="fade-up" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      {/* ══ Upload panel (visitor only — never in the PDF) ══ */}
      <div style={panel}>
        <div style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 15, marginBottom: 12 }}>
          <i className="fa-solid fa-seedling" /> {L(LBL.uploadTitle)}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={img} alt="" style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--navy)' }} />
              <button onClick={() => setImages(images.filter((_, j) => j !== i))} disabled={exporting} style={delBtn}>✕</button>
              <div style={{ position: 'absolute', bottom: 3, insetInlineStart: 3, background: 'rgba(0,51,102,0.82)', color: '#fff', borderRadius: 5, fontSize: 10, fontWeight: 800, padding: '1px 5px', lineHeight: 1.5 }}>{i + 1}</div>
            </div>
          ))}
          {images.length < 6 && (
            <button onClick={openImagePicker} disabled={exporting} style={{ ...addImgBtn, borderColor: 'var(--navy)', color: 'var(--navy)', opacity: exporting ? 0.5 : 1 }}>
              <i className="fa-solid fa-plus" style={{ fontSize: 22, marginBottom: 4 }} />
              {L(LBL.addImg)}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>
        {sourceOpen && (
          <div style={sourceOverlay} onClick={() => setSourceOpen(false)}>
            <div style={{ ...sourceSheet, direction: isRtl ? 'rtl' : 'ltr' }} onClick={e => e.stopPropagation()}>
              <div style={sourceHandle} />
              <div style={sourceTitleStyle}>{L(LBL.sourceTitle)}</div>
              <button type="button" style={sourceBtn} onClick={() => pickFromSource('camera')}>
                <span style={sourceIcon}><i className="fa-solid fa-camera" /></span>
                <span>
                  <b style={sourceBtnTitle}>{L(LBL.sourceCamera)}</b>
                  <small style={sourceBtnHint}>{L(LBL.sourceCameraHint)}</small>
                </span>
              </button>
              <button type="button" style={sourceBtn} onClick={() => pickFromSource('gallery')}>
                <span style={sourceIcon}><i className="fa-solid fa-images" /></span>
                <span>
                  <b style={sourceBtnTitle}>{L(LBL.sourceGallery)}</b>
                  <small style={sourceBtnHint}>{L(LBL.sourceGalleryHint)}</small>
                </span>
              </button>
              <button type="button" style={sourceCancelBtn} onClick={() => setSourceOpen(false)}>{L(LBL.cancel)}</button>
            </div>
          </div>
        )}
        <button onClick={diagnose} disabled={loading || exporting} style={{ ...primeBtn, background: 'var(--navy)', opacity: loading || exporting ? 0.7 : 1 }}>
          {loading
            ? <><i className="fa-solid fa-spinner fa-spin" /> {L(LBL.analyzing)}</>
            : <><i className="fa-solid fa-wand-magic-sparkles" /> {L(LBL.diagnoseBtn)}</>}
        </button>
        {errMsg && <div style={{ color: '#c0392b', marginTop: 10, fontSize: 13, fontWeight: 600 }}><i className="fa-solid fa-triangle-exclamation" /> {errMsg}</div>}
      </div>

      {/* ══ Report preview / A4 ══ */}
      {current && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, margin: '24px 0 12px' }}>
            <div style={{ fontWeight: 800, color: NAVY, fontSize: 15 }}>
              <i className="fa-solid fa-file-pdf" /> {L(LBL.previewTitle)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: '#555' }}><i className="fa-solid fa-language" /> {L(LBL.exportLang)}:</span>
              {EXPORT_LANGS.map(el => {
                const busy = exportBusy === el.code;
                return (
                  <button key={el.code} onClick={() => exportLangPdf(el.code)} disabled={!!exportBusy}
                    style={{ ...langBtn, background: NAVY, opacity: exportBusy && !busy ? 0.5 : 1 }}>
                    {busy
                      ? <><i className="fa-solid fa-spinner fa-spin" /> {L(LBL.preparing)}</>
                      : <><i className="fa-solid fa-download" /> {el.flag} {el.label}</>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── A4 preview: full-width, proportionally scaled ──
               Negative margins cancel out content-wrap's 4% horizontal
               padding so the grey card stretches to the full viewport edge. */}
          <div
            ref={previewWrapRef}
            className="plant-report-preview-wrap"
            style={{
              marginLeft:  'calc(-4% - 0px)',
              marginRight: 'calc(-4% - 0px)',
              background: data.reportTemplate?.pageBgColor || '#ffffff',
              borderRadius: 0,
              padding: 12,
              overflow: 'hidden',
              boxShadow: '0 4px 32px rgba(0,0,0,0.22)',
              minHeight: 120,
            }}
          >
            {/* Skeleton while scale is being calculated */}
            {!previewReady && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, color: '#7a8fa6', fontSize: 13, gap: 8 }}>
                <i className="fa-solid fa-spinner fa-spin" /> جاري تحضير المعاينة...
              </div>
            )}
            <div
              ref={previewContentRef}
              className="plant-report-scale-wrapper"
              style={{
                width: 794,
                transformOrigin: 'top center',
                transform: `scale(${previewScale})`,
                /* Collapse the excess layout height left by transform:scale */
                marginBottom: previewNatH > 0
                  ? Math.round(previewNatH * (previewScale - 1))
                  : 0,
                /* Hide until first measurement fires — prevents scale(0) flash */
                visibility: previewReady ? 'visible' : 'hidden',
                boxShadow: '0 2px 16px rgba(0,51,102,0.13)',
              }}
            >
              <PlantReportDoc data={data} lang={lang} result={current} images={images} />
            </div>
          </div>

          {/* ── Print / Share action bar ── */}
          <div className="report-action-bar no-print" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 12 }}>
            <button
              onClick={() => {
                const el = document.querySelector('.plant-report-print-root') as HTMLElement | null;
                if (!el) return;
                const themeColor = (data.reportTemplate?.themeColor || FALLBACK_GREEN).trim();
                const footerRaw = pickML(data.reportTemplate?.footerText, lang) || '';
                const engName = lang === 'de' ? 'Ing. Alaa Ahmad Almasri' : 'Eng. Alaa Ahmad Almasri';
                const dateStr = new Date().toLocaleDateString('en-GB');
                const plantName = current?.plantName || '';
                const win = window.open('', '_blank', 'width=900,height=750,menubar=yes,toolbar=yes');
                if (!win) return;
                win.document.write(`<!DOCTYPE html>
<html dir="${lang === 'ar' ? 'rtl' : 'ltr'}" lang="${lang}">
<head>
  <meta charset="UTF-8">
  <title>${plantName ? plantName + ' — ' : ''}Plant Report</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;900&display=swap');
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; font-family: Tajawal, Arial, sans-serif; }
    .print-header-band {
      position: fixed; top: 0; left: 0; right: 0; height: 13mm;
      background: #fff; border-bottom: 1.5px solid ${themeColor};
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 14mm; font-size: 8pt; color: #003366; z-index: 999;
    }
    .print-footer-band {
      position: fixed; bottom: 0; left: 0; right: 0; height: 11mm;
      background: #fff; border-top: 1.5px solid ${themeColor};
      display: flex; align-items: center; justify-content: center;
      padding: 0 14mm; font-size: 7.5pt; color: #666; z-index: 999; text-align: center;
    }
    .print-content { padding: 13mm 0 11mm 0; overflow: auto; }
    .pdf-section { break-inside: avoid; page-break-inside: avoid; }
    p { page-break-inside: avoid; break-inside: avoid; }
    li { page-break-inside: avoid; break-inside: avoid; }
    table { break-inside: auto; page-break-inside: auto; width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    img { max-width: 100%; page-break-inside: avoid; break-inside: avoid; }
    @page { size: A4 portrait; margin: 15mm 12mm 13mm 12mm; }
    @media print {
      .print-header-band, .print-footer-band { position: fixed; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="print-header-band">
    <span style="font-weight:800">${engName} &nbsp;|&nbsp; Agricultural Engineering</span>
    <span style="color:#888">${dateStr}</span>
  </div>
  <div class="print-content">${el.outerHTML}</div>
  <div class="print-footer-band">${footerRaw}</div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 600);
    };
  </script>
</body>
</html>`);
                win.document.close();
              }}
              style={{ ...langBtn, background: '#2a7a2a', fontSize: 13, padding: '10px 20px', borderRadius: 10 }}>
              <i className="fa-solid fa-print" /> {L(LBL.printBtn)}
            </button>
            <button
              onClick={() => current && exportLangPdf(lang, { openShare: true })}
              disabled={!!exportBusy}
              style={{ ...langBtn, background: NAVY, fontSize: 13, padding: '10px 20px', borderRadius: 10, opacity: exportBusy ? 0.6 : 1 }}>
              <i className="fa-solid fa-share-nodes" /> {L(LBL.shareTitle)}
            </button>
          </div>
          <InlineSharePanel />
        </>
      )}

      {/* Offscreen clone for PDF when exporting a language other than the preview */}
      {pdfCapture && (
        <div
          ref={pdfCaptureHostRef}
          className="plant-report-export-host"
          aria-hidden
          style={{ position: 'absolute', left: -12000, top: 0, width: 794, opacity: 1, pointerEvents: 'none', zIndex: -1, overflow: 'visible' }}
        >
          <PlantReportDoc data={data} lang={pdfCapture.lang} result={pdfCapture.result} images={images} />
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   A4 REPORT DOCUMENT (shared by screen preview + export)
════════════════════════════════════════════════════ */
function PlantReportDoc({ data, lang, result, images, innerRef }: {
  data: AppData; lang: LangKey; result?: DiagResult; images: string[]; innerRef?: React.Ref<HTMLDivElement>;
}) {
  const isRtl = lang === 'ar';
  const L = (m: ML) => pickML(m, lang);
  const tpl = data.reportTemplate;
  const theme = (tpl.themeColor || FALLBACK_GREEN).trim() || FALLBACK_GREEN;
  const headerText = pickML(tpl.headerText, lang);
  const footerText = pickML(tpl.footerText, lang);
  const engNameDisplay = pickML(tpl.engName, lang) || (lang === 'de' ? 'Ing. Alaa Ahmad Almasri' : lang === 'ar' ? 'م.علاء أحمد المصري' : 'Eng. Alaa Ahmad Almasri');
  const engNameColor = tpl.engNameColor || '#003366';
  const pageBg = tpl.pageBgColor || '#ffffff';
  const stampAlign = tpl.stampAlign || 'right';

  /* Date always in English numerals dd/mm/yyyy */
  const todayStr = new Date().toLocaleDateString('en-GB');
  const plantName = result?.plantName?.trim();
  const reportTitle = plantName ? `${L(LBL.reportTitle)} — ${plantName}` : L(LBL.reportTitle);

  /* Logo helpers */
  const st = data.siteSettings;

  const sectionTitle: React.CSSProperties = { fontWeight: 900, color: theme, fontSize: 15, marginBottom: 10, paddingInlineStart: 8, borderInlineStart: `4px solid ${theme}` };
  const subTitle: React.CSSProperties = { fontWeight: 700, color: theme, fontSize: 12.5, margin: '6px 0' };
  const docStyle: React.CSSProperties = { ...a4Base, background: pageBg, minHeight: 1123, display: 'flex', flexDirection: 'column' };

  return (
    <div ref={innerRef} style={docStyle} dir={isRtl ? 'rtl' : 'ltr'} className="plant-report-print-root">
      {/* Header — grid ثابت يمنع تداخل النص في html2canvas */}
      <div className="plant-report-header-row" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        alignItems: 'start',
        gap: 14,
        borderBottom: `3px solid ${theme}`,
        paddingBottom: 14,
        marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {tpl.headerLogo
            ? <img className="plant-report-header-logo" src={resolveImageSrc(tpl.headerLogo)} alt="logo" style={{ height: 58, objectFit: 'contain' }} />
              : st?.logoType === 'svg_alaa' || (!st?.logoType && !st?.logoImg)
              ? <AlaaLogo className="plant-report-alaa-logo" color={engNameColor} size={58} />
              : st?.logoType === 'image' && st?.logoImg
                ? <img className="plant-report-header-logo" src={st.logoImg} alt="logo" style={{ height: 58, objectFit: 'contain' }} />
                : <div style={{ fontWeight: 900, color: engNameColor, fontSize: 22 }}>{pickML(st?.logoText, lang) || 'م.علاء'}</div>}
          <div>
            <div style={{ fontWeight: 800, color: engNameColor, fontSize: 14, lineHeight: 1.3 }}>
              {engNameDisplay}
            </div>
            {headerText && <div style={{ fontWeight: 600, color: theme, fontSize: 12, lineHeight: 1.4, marginTop: 2 }}>{headerText}</div>}
          </div>
        </div>
        <div style={{ minWidth: 0, textAlign: isRtl ? 'end' : 'end' }}>
          <div style={{ fontWeight: 900, color: theme, fontSize: 17, lineHeight: 1.4, wordBreak: 'break-word' }}>{reportTitle}</div>
          <div style={{ fontSize: 12, color: '#777', marginTop: 4 }}>{L(LBL.date)}: {todayStr}</div>
        </div>
      </div>

      {/* Uploaded plant images */}
      {images.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {images.map((img, i) => (
            <img key={i} src={img} alt="" style={{ width: 170, height: 120, flexShrink: 0, objectFit: 'cover', borderRadius: 8, border: `1.5px solid ${theme}` }} />
          ))}
        </div>
      )}

      {/* AI results */}
      {result && (
        <div style={{ marginBottom: 18 }}>
          <div style={sectionTitle}>{L(LBL.resultTitle)}</div>

          {/* ── Plant Identification ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: result.origin ? 6 : 8 }}>
            <Field label={L(LBL.plantName)} value={result.plantName} icon="fa-leaf" accent={theme} />
            <Field label={L(LBL.scientific)} value={result.scientificName} icon="fa-flask-vial" accent={theme} ltr />
          </div>
          {result.origin && (
            <div style={{ marginBottom: 10 }}>
              <Field label={L(LBL.origin)} value={result.origin} icon="fa-earth-asia" accent={theme} />
            </div>
          )}

          <div style={subTitle}><i className="fa-solid fa-droplet" /> {L(LBL.careTitle)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <Field label={L(LBL.water)} value={result.water} icon="fa-droplet" accent={theme} />
            <Field label={L(LBL.fertilizer)} value={result.fertilizer} icon="fa-wheat-awn" accent={theme} />
            <Field label={L(LBL.light)} value={result.light} icon="fa-sun" accent={theme} />
            {result.temperature && <Field label={L(LBL.temperature)} value={result.temperature} icon="fa-temperature-half" accent={theme} />}
          </div>
          {result.lightLux && (
            <div style={{ marginBottom: 8 }}>
              <Field label={L(LBL.lightLux)} value={result.lightLux} icon="fa-bolt" accent={theme} />
            </div>
          )}

          {/* ── Soil Type ── */}
          {result.soilType && (
            <div className="pdf-section" style={{ marginBottom: 12, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <div style={subTitle}><i className="fa-solid fa-mountain" /> {L(LBL.soilSection)}</div>
              <Field label={L(LBL.soilType)} value={result.soilType} icon="fa-layer-group" accent={theme} />
            </div>
          )}

          {/* ── Nutrients Table ── */}
          {result.nutrients && result.nutrients.length > 0 && (
            <div className="pdf-section" style={{ marginBottom: 12, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <div style={subTitle}><i className="fa-solid fa-flask" /> {L(LBL.nutrientsSection)}</div>
              <table dir={isRtl ? 'rtl' : 'ltr'} className="plant-report-nutrients-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: theme, color: '#fff' }}>
                    <th style={{ padding: '8px 8px', textAlign: isRtl ? 'right' : 'left', verticalAlign: 'middle' }}>{L(LBL.nutrientName)}</th>
                    <th style={{ padding: '8px 8px', textAlign: isRtl ? 'right' : 'left', verticalAlign: 'middle' }}>{L(LBL.nutrientCat)}</th>
                    <th style={{ padding: '8px 8px', textAlign: isRtl ? 'right' : 'left', verticalAlign: 'middle' }}>{L(LBL.nutrientRatio)}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.nutrients.map((n, i) => (
                    <tr key={i} style={{ background: i % 2 ? '#fff' : '#f6faf6' }}>
                      <td style={{ ...td, textAlign: isRtl ? 'right' : 'left' }}>
                        <NutrientNameCell name={n.name} isRtl={isRtl} />
                      </td>
                      <td style={{ ...td, color: theme, fontWeight: 700, direction: 'ltr', textAlign: isRtl ? 'right' : 'left' }}>{n.category || '—'}</td>
                      <td style={{ ...td, direction: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left', unicodeBidi: isRtl ? 'plaintext' : undefined }}>{n.ratio || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Fertilization Ratios ── */}
          {result.fertilizationRatios && (
            <div className="pdf-section" style={{ marginBottom: 12, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <div style={subTitle}><i className="fa-solid fa-percent" /> {L(LBL.fertRatios)}</div>
              <Field label={L(LBL.fertRatios)} value={result.fertilizationRatios} icon="fa-vials" accent={theme} />
            </div>
          )}

          {/* ── Planting & Harvest Schedule ── */}
          {(result.plantingDate || result.daysToHarvest || result.harvestTime) && (
            <div className="pdf-section" style={{ marginBottom: 12, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <div style={subTitle}><i className="fa-solid fa-calendar-days" /> {L(LBL.plantingSection)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <Field label={L(LBL.plantingDate)} value={result.plantingDate} icon="fa-seedling" accent={theme} />
                <Field label={L(LBL.daysToHarvest)} value={result.daysToHarvest} icon="fa-clock-rotate-left" accent={theme} />
                <Field label={L(LBL.harvestTime)} value={result.harvestTime} icon="fa-tractor" accent={theme} />
              </div>
            </div>
          )}

          {/* ── Plant Uses ── */}
          {result.uses && (
            <div className="pdf-section" style={{ marginBottom: 12, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <div style={subTitle}><i className="fa-solid fa-tree" /> {L(LBL.usesSection)}</div>
              <Field label={L(LBL.usesSection)} value={result.uses} icon="fa-recycle" accent={theme} />
            </div>
          )}

          {/* ── Health & Medicinal ── */}
          {(result.healthBenefits || result.medicinalSubstances || result.medicines) && (
            <div className="pdf-section" style={{ marginBottom: 12, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              <div style={subTitle}><i className="fa-solid fa-heart-pulse" /> {L(LBL.healthSection)}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.healthBenefits && <Field label={L(LBL.healthBenefits)} value={result.healthBenefits} icon="fa-apple-whole" accent={theme} />}
                {result.medicinalSubstances && <Field label={L(LBL.medicinalSubstances)} value={result.medicinalSubstances} icon="fa-pills" accent={theme} />}
                {result.medicines && <Field label={L(LBL.medicines)} value={result.medicines} icon="fa-capsules" accent={theme} />}
              </div>
            </div>
          )}

          {/* ── Diseases ── */}
          <div className="pdf-section" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
            <div style={subTitle}><i className="fa-solid fa-virus" /> {L(LBL.diseaseTitle)}</div>
            {result.diseases && result.diseases.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.diseases.map((d, idx) => (
                  <div key={idx} style={{ border: `1.5px solid ${theme}`, borderRadius: 9, padding: '10px 12px', background: '#f7fdf7', breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    <div style={{ fontWeight: 800, color: theme, fontSize: 12, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <i className="fa-solid fa-image" />
                      {d.imageNumbers.map(n => `${L(LBL.imageLabel)} ${n}`).join(' + ')}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8, marginBottom: 6 }}>
                      <Field label={L(LBL.diseaseType)} value={d.diseaseType} icon="fa-bug" accent={theme} />
                      <Field label={L(LBL.diseaseDetail)} value={d.diseaseDetail} icon="fa-stethoscope" accent={theme} />
                    </div>
                    <Field label={L(LBL.pesticides)} value={d.pesticides} icon="fa-spray-can" accent={theme} />
                    {d.pesticideDosage && (
                      <div style={{ marginTop: 8 }}>
                        <Field label={L(LBL.pesticideDosage)} value={d.pesticideDosage} icon="fa-flask" accent={theme} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : result.diseases && result.diseases.length === 0 ? (
              <div style={{ background: '#f0faf0', border: '1.5px solid #b2dfb2', borderRadius: 9, padding: '10px 14px', color: '#2a7a2a', fontWeight: 700, fontSize: 13 }}>
                <i className="fa-solid fa-circle-check" /> {L(LBL.noDisease)}
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8 }}>
                  <Field label={L(LBL.diseaseType)} value={result.diseaseType} icon="fa-bug" accent={theme} />
                  <Field label={L(LBL.diseaseDetail)} value={result.diseaseDetail} icon="fa-stethoscope" accent={theme} />
                </div>
                <div style={{ marginTop: 8 }}>
                  <Field label={L(LBL.pesticides)} value={result.pesticides} icon="fa-spray-can" accent={theme} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Engineer consultation note */}
      <div className="pdf-section" style={{
        marginTop: 16, marginBottom: 8, padding: '12px 14px',
        background: '#eef6ff', border: `1.5px solid ${theme}`, borderRadius: 9,
        fontSize: 12.5, fontWeight: 700, color: '#003366', lineHeight: 1.65,
        breakInside: 'avoid', pageBreakInside: 'avoid',
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <i className="fa-solid fa-user-tie" style={{ color: theme, marginTop: 2, flexShrink: 0 }} />
        <span>{L(LBL.engineerNote)}</span>
      </div>

      {/* Footer: signature & stamp */}
      {(() => {
        const sigStamp = (
          <div style={{ display: 'flex', gap: 30, alignItems: 'flex-end' }}>
            <div style={{ textAlign: 'center', minWidth: 130 }}>
              {tpl.engSignature
                ? <img className="plant-report-signature-img" src={resolveImageSrc(tpl.engSignature)} alt="" crossOrigin="anonymous" style={{ maxHeight: 64, maxWidth: 150, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
                : <div style={{ height: 64 }} />}
              <div style={{ borderTop: '1px solid #999', marginTop: 4, paddingTop: 5, fontSize: 11, fontWeight: 700, color: '#444' }}>{L(LBL.engSignature)}</div>
            </div>
            {tpl.engStamp && (
              <div style={{ textAlign: 'center' }}>
                <img className="plant-report-stamp-img" src={resolveImageSrc(tpl.engStamp)} alt="" crossOrigin="anonymous" style={{ maxHeight: 84, maxWidth: 120, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
              </div>
            )}
          </div>
        );
        const footerLine = <div style={{ fontSize: 11, color: '#666', maxWidth: '46%', lineHeight: 1.7 }}>{footerText}</div>;
        return (
          <div className="pdf-section plant-report-footer" style={{ marginTop: 'auto', borderTop: `2px solid ${theme}`, paddingTop: 16, paddingBottom: 8, breakInside: 'avoid', pageBreakInside: 'avoid',
            display: 'flex',
            flexDirection: stampAlign === 'center' ? 'column' : 'row',
            alignItems: stampAlign === 'center' ? 'center' : 'flex-end',
            justifyContent: stampAlign === 'center' ? 'center' : (stampAlign === 'left' ? 'flex-start' : 'space-between'),
            gap: 18,
          }}>
            {stampAlign === 'center' ? <>{footerLine}{sigStamp}</> :
             stampAlign === 'left'   ? <>{sigStamp}{footerLine}</> :
                                       <>{footerLine}{sigStamp}</>}
          </div>
        );
      })()}
    </div>
  );
}

function safeStr(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v.trim() || '—';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(safeStr).join(' • ');
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}: ${safeStr(val)}`)
      .join(' | ');
  }
  return String(v);
}

function Field({ label, value, icon, accent, ltr }: { label: string; value?: unknown; icon: string; accent: string; ltr?: boolean }) {
  const display = safeStr(value);
  return (
    <div style={{ background: '#f7faf7', border: '1px solid #e0ece0', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: '#8a9a8a', marginBottom: 3 }}><i className={`fa-solid ${icon}`} style={{ color: accent }} /> {label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1d3a1d', direction: ltr ? 'ltr' : undefined, wordBreak: 'break-word' }}>{display}</div>
    </div>
  );
}

/* ── static styles (non theme-dependent) ── */
const panel: React.CSSProperties = { background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 14, padding: 20, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' };
const primeBtn: React.CSSProperties = { color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'inherit', width: '100%', justifyContent: 'center' };
const langBtn: React.CSSProperties = { color: '#fff', border: 'none', borderRadius: 9, padding: '8px 14px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' };
const addImgBtn: React.CSSProperties = { width: 92, height: 92, borderRadius: 10, border: '2px dashed', background: 'var(--navy-light)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 };
const sourceOverlay: React.CSSProperties = { position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(3, 12, 24, .62)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 14 };
const sourceSheet: React.CSSProperties = { width: '100%', maxWidth: 430, background: '#fff', borderRadius: 20, padding: '12px 16px 18px', boxShadow: '0 18px 46px rgba(0,0,0,.34)', display: 'flex', flexDirection: 'column', gap: 10 };
const sourceHandle: React.CSSProperties = { width: 44, height: 4, borderRadius: 4, background: '#d3dbe4', margin: '0 auto 6px' };
const sourceTitleStyle: React.CSSProperties = { fontWeight: 800, fontSize: 15, color: '#00335f', textAlign: 'center', marginBottom: 4 };
const sourceBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: '1px solid #d8e3ee', borderRadius: 14, background: '#f7fafd', padding: '13px 14px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'start' };
const sourceIcon: React.CSSProperties = { width: 42, height: 42, minWidth: 42, borderRadius: 12, background: '#00335f', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 17 };
const sourceBtnTitle: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 800, color: '#123253' };
const sourceBtnHint: React.CSSProperties = { display: 'block', fontSize: 11.5, color: '#6b7c8f', marginTop: 2, lineHeight: 1.5 };
const sourceCancelBtn: React.CSSProperties = { border: 'none', background: 'transparent', color: '#6b7c8f', fontWeight: 700, fontSize: 13.5, padding: '8px 0 2px', cursor: 'pointer', fontFamily: 'inherit' };
const delBtn: React.CSSProperties = { position: 'absolute', top: -7, insetInlineEnd: -7, background: '#c0392b', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 11 };
const a4Base: React.CSSProperties = { width: 794, background: '#fff', padding: 36, boxSizing: 'border-box', fontFamily: 'Tajawal, sans-serif', color: '#222' };
const td: React.CSSProperties = { padding: '8px 8px', borderBottom: '1px solid #e8f0e8', textAlign: 'start', verticalAlign: 'middle', lineHeight: 1.45 };
