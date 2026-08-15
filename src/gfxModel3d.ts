export type GfxModelFormat = 'auto' | 'glb' | 'gltf' | 'stl' | 'fbx';

/** منظور محفوظ لجهاز واحد (جوال أو كمبيوتر) */
export interface GfxDevicePose {
  viewPanX?: number;
  viewPanY?: number;
  /** عمق هدف الكاميرا — يُحفظ حتى لا ينزاح المجسم بعد إعادة التحميل */
  viewPanZ?: number;
  cameraDistance?: number;
  orbitAzimuth?: number;
  orbitPolar?: number;
  orbitDistance?: number;
  /** نسبة العرض/الارتفاع عند الحفظ — لتثبيت الإطار */
  referenceAspect?: number;
}

export const CAM_PAN_MIN = -400;
export const CAM_PAN_MAX = 400;
export const CAM_DIST_MIN = 0.05;
export const CAM_DIST_MAX = 150;
export const ORBIT_DIST_MIN = 0.08;
export const ORBIT_DIST_MAX = 480;
/** خطوة المنزلقات — 10× أدق من السابق */
export const CAM_PAN_STEP = 0.005;
export const CAM_DIST_STEP = 0.005;
/** خطوات أزرار الأسهم */
export const CAM_ARROW_STEP = 1.2;
export const CAM_ARROW_STEP_FINE = 0.5;
export const CAM_ARROW_STEP_LARGE = 2;
export const CAM_ZOOM_STEP = 1;

export interface GfxModel3dSettings {
  /** تفعيل معاينة 3D للزائر — إن أُغلق لا يظهر شيء حتى مع وجود رابط */
  previewEnabled?: boolean;
  /** عرض المجسم كصورة رئيسية في المعرض وصفحة المشروع */
  useAsMain?: boolean;
  autoRotate?: boolean;
  /** 0–100 */
  rotationSpeed?: number;
  /** 1 = يمين، -1 = يسار */
  rotationDirection?: 1 | -1;
  backgroundColor?: string;
  /** 0–2 */
  ambientIntensity?: number;
  /** 0–3 */
  lightIntensity?: number;
  metalness?: number;
  roughness?: number;
  /** 0.15 = قريب جداً، 5 = بعيد جداً */
  cameraDistance?: number;
  /** تحريك الكاميرا يمين/يسار */
  viewPanX?: number;
  /** تحريك الكاميرا أعلى/أسفل */
  viewPanY?: number;
  /** عمق هدف الكاميرا (محور Z) — بدونه ينزاح المجسم بعد الحفظ */
  viewPanZ?: number;
  /** زاوية أفقية كاملة (راديان) — من السحب بالماوس/الإصبع */
  orbitAzimuth?: number;
  /** زاوية عمودية كاملة (راديان) */
  orbitPolar?: number;
  /** مسافة الكاميرا الفعلية من الهدف (يُحفظ بدقة عند تثبيت المنظور) */
  orbitDistance?: number;
  /** نسبة العرض/الارتفاع عند حفظ منظور الكمبيوتر */
  referenceAspect?: number;
  /** منظور الجوال المنفصل — إن وُجد يُستخدم على الشاشات الضيقة */
  mobilePose?: GfxDevicePose;
  /** تشغيل حركة FBX / GLB المدمجة */
  playModelAnimation?: boolean;
  /** سرعة الحركة 0.1–3 */
  animationSpeed?: number;
  /** لون STL أو تلوين موحّد عند تعطيل preserveModelColors */
  modelColor?: string;
  /** الاحتفاظ بألوان GLB/FBX الأصلية (افتراضي: نعم) */
  preserveModelColors?: boolean;
  enableReflections?: boolean;
  modelFormat?: GfxModelFormat;
}

export const DEFAULT_GFX_MODEL_3D: Required<GfxModel3dSettings> = {
  previewEnabled: true,
  useAsMain: false,
  autoRotate: true,
  rotationSpeed: 35,
  rotationDirection: 1,
  backgroundColor: '#e8eef4',
  ambientIntensity: 0.65,
  lightIntensity: 1.2,
  metalness: 0.35,
  roughness: 0.42,
  cameraDistance: 1,
  viewPanX: 0,
  viewPanY: 0,
  viewPanZ: 0,
  orbitAzimuth: 0,
  orbitPolar: 0,
  orbitDistance: 1,
  referenceAspect: 1.6,
  mobilePose: {},
  playModelAnimation: true,
  animationSpeed: 1,
  modelColor: '#7fd44a',
  preserveModelColors: true,
  enableReflections: true,
  modelFormat: 'auto',
};

/** دمج إعدادات المنظور دون فقدان orbitAzimuth / orbitPolar / orbitDistance */
export function mergeGfxModel3dViewSettings(
  base?: GfxModel3dSettings | null,
  patch?: GfxModel3dSettings | null,
): GfxModel3dSettings {
  return { ...(base || {}), ...(patch || {}) };
}

/** مفتاح لإعادة تحميل المعاينة عند تغيّر المنظور المحفوظ */
export function gfxViewSettingsKey(s?: GfxModel3dSettings | null): string {
  if (!s) return 'default';
  const parts = [
    s.viewPanX, s.viewPanY, s.viewPanZ, s.cameraDistance,
    s.orbitAzimuth, s.orbitPolar, s.orbitDistance, s.referenceAspect,
    s.mobilePose?.viewPanX, s.mobilePose?.viewPanY, s.mobilePose?.viewPanZ, s.mobilePose?.cameraDistance,
    s.mobilePose?.orbitAzimuth, s.mobilePose?.orbitPolar, s.mobilePose?.orbitDistance,
    s.mobilePose?.referenceAspect,
  ];
  return parts.map(v => (typeof v === 'number' ? v.toFixed(7) : '_')).join('|');
}

function normDevicePose(raw: unknown): GfxDevicePose | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const pose: GfxDevicePose = {};
  if (typeof o.viewPanX === 'number') pose.viewPanX = o.viewPanX;
  if (typeof o.viewPanY === 'number') pose.viewPanY = o.viewPanY;
  if (typeof o.viewPanZ === 'number') pose.viewPanZ = o.viewPanZ;
  if (typeof o.cameraDistance === 'number') pose.cameraDistance = o.cameraDistance;
  if (typeof o.orbitAzimuth === 'number') pose.orbitAzimuth = o.orbitAzimuth;
  if (typeof o.orbitPolar === 'number') pose.orbitPolar = o.orbitPolar;
  if (typeof o.orbitDistance === 'number') pose.orbitDistance = o.orbitDistance;
  if (typeof o.referenceAspect === 'number' && o.referenceAspect > 0) pose.referenceAspect = o.referenceAspect;
  return Object.keys(pose).length ? pose : undefined;
}

export function extractDesktopPose(s?: GfxModel3dSettings | null): GfxDevicePose {
  if (!s) return {};
  return {
    viewPanX: s.viewPanX,
    viewPanY: s.viewPanY,
    viewPanZ: s.viewPanZ,
    cameraDistance: s.cameraDistance,
    orbitAzimuth: s.orbitAzimuth,
    orbitPolar: s.orbitPolar,
    orbitDistance: s.orbitDistance,
    referenceAspect: s.referenceAspect,
  };
}

export function hasDeviceOrbitPose(p?: GfxDevicePose | null): boolean {
  return typeof p?.orbitAzimuth === 'number' && typeof p?.orbitPolar === 'number';
}

/**
 * يدمج منظور الجهاز في إعدادات العرض الكاملة.
 * الجوال: يستخدم mobilePose إن وُجد، وإلا منظور الكمبيوتر.
 */
export function resolveGlbViewSettings(
  s?: GfxModel3dSettings | null,
  isMobile = false,
): GfxModel3dSettings | undefined {
  if (!s) return undefined;
  if (!isMobile) return s;
  const mp = s.mobilePose;
  if (!mp || (!hasDeviceOrbitPose(mp) && typeof mp.viewPanX !== 'number' && typeof mp.viewPanY !== 'number')) {
    return s;
  }
  return {
    ...s,
    viewPanX: mp.viewPanX ?? s.viewPanX,
    viewPanY: mp.viewPanY ?? s.viewPanY,
    viewPanZ: mp.viewPanZ ?? s.viewPanZ,
    cameraDistance: mp.cameraDistance ?? s.cameraDistance,
    orbitAzimuth: mp.orbitAzimuth ?? s.orbitAzimuth,
    orbitPolar: mp.orbitPolar ?? s.orbitPolar,
    orbitDistance: mp.orbitDistance ?? s.orbitDistance,
    referenceAspect: mp.referenceAspect ?? s.referenceAspect,
  };
}

/**
 * معاينة بطاقة المعرض على الجوال: أقرب من منظور التفاصيل المحفوظ.
 * لا يُستخدم في صفحة التفاصيل — يبقى المنظور كما حفظه المدير.
 */
export function settingsForGalleryCardPreview(
  s?: GfxModel3dSettings | null,
  isMobile = false,
  closerFactor = 0.62,
): GfxModel3dSettings | undefined {
  const base = resolveGlbViewSettings(s, isMobile);
  if (!base || !isMobile) return base;
  const factor = clamp(closerFactor, 0.35, 1);
  const next: GfxModel3dSettings = { ...base };
  if (typeof next.orbitDistance === 'number') {
    next.orbitDistance = clamp(next.orbitDistance * factor, ORBIT_DIST_MIN, ORBIT_DIST_MAX);
  }
  if (typeof next.cameraDistance === 'number') {
    next.cameraDistance = next.cameraDistance * factor;
  }
  // بطاقة المعرض أعرض وأقصر من معاينة الأدمن — تعطيل تعويض النسبة يمنع إبعاد الكاميرا
  next.referenceAspect = undefined;
  return next;
}

/** تطبيق منظور محفوظ على الجهاز المحدد */
export function applyDevicePoseToSettings(
  base: GfxModel3dSettings,
  pose: GfxDevicePose,
  device: 'desktop' | 'mobile',
): GfxModel3dSettings {
  if (device === 'mobile') {
    return prepareGlbViewSettingsForStorage({
      ...base,
      mobilePose: {
        viewPanX: pose.viewPanX,
        viewPanY: pose.viewPanY,
        viewPanZ: pose.viewPanZ,
        cameraDistance: pose.cameraDistance,
        orbitAzimuth: pose.orbitAzimuth,
        orbitPolar: pose.orbitPolar,
        orbitDistance: pose.orbitDistance,
        referenceAspect: pose.referenceAspect,
      },
    }) || { ...base, mobilePose: pose };
  }
  return prepareGlbViewSettingsForStorage({
    ...base,
    viewPanX: pose.viewPanX,
    viewPanY: pose.viewPanY,
    viewPanZ: pose.viewPanZ,
    cameraDistance: pose.cameraDistance,
    orbitAzimuth: pose.orbitAzimuth,
    orbitPolar: pose.orbitPolar,
    orbitDistance: pose.orbitDistance,
    referenceAspect: pose.referenceAspect,
  }) || {
    ...base,
    ...pose,
  };
}

/** إعدادات جاهزة للمعاينة حسب الجهاز (بدون خلط mobilePose في الحقول) */
export function settingsForDevicePreview(
  s: GfxModel3dSettings,
  device: 'desktop' | 'mobile',
): GfxModel3dSettings {
  if (device === 'desktop') {
    const { mobilePose: _m, ...rest } = s;
    return rest;
  }
  return resolveGlbViewSettings(s, true) || s;
}

/** تجهيز الإعدادات للتخزين — يحفظ حقول المنظور صراحةً */
export function prepareGlbViewSettingsForStorage(s?: GfxModel3dSettings | null): GfxModel3dSettings | undefined {
  if (!s) return undefined;
  const m = mergeGfxModel3dSettings(s);
  const out: GfxModel3dSettings = {
    previewEnabled: m.previewEnabled,
    useAsMain: m.useAsMain,
    autoRotate: m.autoRotate,
    rotationSpeed: m.rotationSpeed,
    rotationDirection: m.rotationDirection,
    backgroundColor: m.backgroundColor,
    ambientIntensity: m.ambientIntensity,
    lightIntensity: m.lightIntensity,
    metalness: m.metalness,
    roughness: m.roughness,
    cameraDistance: m.cameraDistance,
    viewPanX: m.viewPanX,
    viewPanY: m.viewPanY,
    viewPanZ: m.viewPanZ,
    modelColor: m.modelColor,
    preserveModelColors: m.preserveModelColors,
    enableReflections: m.enableReflections,
    modelFormat: m.modelFormat,
  };
  if (typeof m.orbitAzimuth === 'number' && Number.isFinite(m.orbitAzimuth)) out.orbitAzimuth = m.orbitAzimuth;
  if (typeof m.orbitPolar === 'number' && Number.isFinite(m.orbitPolar)) out.orbitPolar = m.orbitPolar;
  if (typeof m.orbitDistance === 'number' && Number.isFinite(m.orbitDistance)) out.orbitDistance = m.orbitDistance;
  if (typeof m.referenceAspect === 'number' && m.referenceAspect > 0) out.referenceAspect = m.referenceAspect;
  if (m.mobilePose && typeof m.mobilePose === 'object') {
    const mp = normDevicePose(m.mobilePose);
    if (mp) out.mobilePose = mp;
  }
  if (typeof m.playModelAnimation === 'boolean') out.playModelAnimation = m.playModelAnimation;
  if (typeof m.animationSpeed === 'number') out.animationSpeed = m.animationSpeed;
  return out;
}

export function mergeGfxModel3dSettings(s?: GfxModel3dSettings | null): MergedGfxModel3dSettings {
  const base = { ...DEFAULT_GFX_MODEL_3D };
  if (!s) return base;
  const merged: MergedGfxModel3dSettings = {
    previewEnabled: s.previewEnabled ?? base.previewEnabled,
    useAsMain: s.useAsMain ?? base.useAsMain,
    autoRotate: s.autoRotate ?? base.autoRotate,
    rotationSpeed: clamp(s.rotationSpeed ?? base.rotationSpeed, 0, 100),
    rotationDirection: s.rotationDirection === -1 ? -1 : 1,
    backgroundColor: s.backgroundColor || base.backgroundColor,
    ambientIntensity: clamp(s.ambientIntensity ?? base.ambientIntensity, 0, 2),
    lightIntensity: clamp(s.lightIntensity ?? base.lightIntensity, 0, 3),
    metalness: clamp(s.metalness ?? base.metalness, 0, 1),
    roughness: clamp(s.roughness ?? base.roughness, 0, 1),
    cameraDistance: clamp(s.cameraDistance ?? base.cameraDistance, CAM_DIST_MIN, CAM_DIST_MAX),
    viewPanX: clamp(s.viewPanX ?? base.viewPanX, CAM_PAN_MIN, CAM_PAN_MAX),
    viewPanY: clamp(s.viewPanY ?? base.viewPanY, CAM_PAN_MIN, CAM_PAN_MAX),
    viewPanZ: clamp(s.viewPanZ ?? base.viewPanZ, CAM_PAN_MIN, CAM_PAN_MAX),
    modelColor: s.modelColor || base.modelColor,
    preserveModelColors: s.preserveModelColors ?? base.preserveModelColors,
    enableReflections: s.enableReflections ?? base.enableReflections,
    modelFormat: s.modelFormat || base.modelFormat,
  };
  if (typeof s.orbitAzimuth === 'number') merged.orbitAzimuth = s.orbitAzimuth;
  if (typeof s.orbitPolar === 'number') merged.orbitPolar = s.orbitPolar;
  if (typeof s.orbitDistance === 'number') merged.orbitDistance = clamp(s.orbitDistance, ORBIT_DIST_MIN, ORBIT_DIST_MAX);
  if (typeof s.referenceAspect === 'number' && s.referenceAspect > 0) merged.referenceAspect = s.referenceAspect;
  if (s.mobilePose) merged.mobilePose = s.mobilePose;
  if (typeof s.playModelAnimation === 'boolean') merged.playModelAnimation = s.playModelAnimation;
  if (typeof s.animationSpeed === 'number') merged.animationSpeed = clamp(s.animationSpeed, 0.1, 3);
  return merged;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function normGfxModel3dSettings(raw: unknown): GfxModel3dSettings | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const fmt = o.modelFormat;
  const modelFormat: GfxModelFormat | undefined =
    fmt === 'glb' || fmt === 'gltf' || fmt === 'stl' || fmt === 'fbx' || fmt === 'auto' ? fmt : undefined;
  return {
    previewEnabled: typeof o.previewEnabled === 'boolean' ? o.previewEnabled : undefined,
    useAsMain: typeof o.useAsMain === 'boolean' ? o.useAsMain : undefined,
    autoRotate: typeof o.autoRotate === 'boolean' ? o.autoRotate : undefined,
    rotationSpeed: typeof o.rotationSpeed === 'number' ? o.rotationSpeed : undefined,
    rotationDirection: o.rotationDirection === -1 ? -1 : o.rotationDirection === 1 ? 1 : undefined,
    backgroundColor: typeof o.backgroundColor === 'string' ? o.backgroundColor : undefined,
    ambientIntensity: typeof o.ambientIntensity === 'number' ? o.ambientIntensity : undefined,
    lightIntensity: typeof o.lightIntensity === 'number' ? o.lightIntensity : undefined,
    metalness: typeof o.metalness === 'number' ? o.metalness : undefined,
    roughness: typeof o.roughness === 'number' ? o.roughness : undefined,
    cameraDistance: typeof o.cameraDistance === 'number' ? o.cameraDistance : undefined,
    viewPanX: typeof o.viewPanX === 'number' ? o.viewPanX : undefined,
    viewPanY: typeof o.viewPanY === 'number' ? o.viewPanY : undefined,
    viewPanZ: typeof o.viewPanZ === 'number' ? o.viewPanZ : undefined,
    orbitAzimuth: typeof o.orbitAzimuth === 'number' ? o.orbitAzimuth : undefined,
    orbitPolar: typeof o.orbitPolar === 'number' ? o.orbitPolar : undefined,
    orbitDistance: typeof o.orbitDistance === 'number' ? o.orbitDistance : undefined,
    referenceAspect: typeof o.referenceAspect === 'number' && o.referenceAspect > 0 ? o.referenceAspect : undefined,
    mobilePose: normDevicePose(o.mobilePose),
    playModelAnimation: typeof o.playModelAnimation === 'boolean' ? o.playModelAnimation : undefined,
    animationSpeed: typeof o.animationSpeed === 'number' ? o.animationSpeed : undefined,
    modelColor: typeof o.modelColor === 'string' ? o.modelColor : undefined,
    preserveModelColors: typeof o.preserveModelColors === 'boolean' ? o.preserveModelColors : undefined,
    enableReflections: typeof o.enableReflections === 'boolean' ? o.enableReflections : undefined,
    modelFormat,
  };
}

const LOADER_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/STLLoader.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/FBXLoader.js',
];

const ORBIT_CONTROLS_SCRIPT = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';

export type GfxCameraPose = Pick<GfxModel3dSettings, 'viewPanX' | 'viewPanY' | 'viewPanZ' | 'cameraDistance' | 'orbitAzimuth' | 'orbitPolar' | 'orbitDistance' | 'referenceAspect'>;

export type MergedGfxModel3dSettings = Required<Omit<GfxModel3dSettings, 'mobilePose' | 'orbitAzimuth' | 'orbitPolar' | 'orbitDistance' | 'referenceAspect' | 'playModelAnimation' | 'animationSpeed'>>
  & Pick<GfxModel3dSettings, 'orbitAzimuth' | 'orbitPolar' | 'orbitDistance' | 'referenceAspect' | 'mobilePose' | 'playModelAnimation' | 'animationSpeed'>;

const ORBIT_RADIUS_SCALE = 3.2;

function hasOrbitPose(cfg: { orbitAzimuth?: number; orbitPolar?: number }): boolean {
  return typeof cfg.orbitAzimuth === 'number' && typeof cfg.orbitPolar === 'number';
}

/** هل يوجد منظور محفوظ (زوايا كاملة)؟ */
export function hasSavedOrbitPose(s?: GfxModel3dSettings | null): boolean {
  return hasOrbitPose(s || {});
}

let loadersPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
}

/** تحميل GLTFLoader و STLLoader و FBXLoader عند الحاجة فقط */
export function ensureThreeModelLoaders(): Promise<void> {
  if (!window.THREE) return Promise.reject(new Error('THREE.js not loaded'));
  if (window.THREE.GLTFLoader && window.THREE.STLLoader && window.THREE.FBXLoader) return Promise.resolve();
  if (loadersPromise) return loadersPromise;
  loadersPromise = LOADER_SCRIPTS.reduce(
    (chain, src) => chain.then(() => loadScript(src)),
    Promise.resolve(),
  );
  return loadersPromise;
}

export function cameraTargetFromSettings(cfg: GfxCameraPose): { x: number; y: number; z: number } {
  return {
    x: (cfg.viewPanX ?? 0) * 0.35,
    y: (cfg.viewPanY ?? 0) * 0.35,
    // بدون استرجاع Z ينزاح المجسم لطرف الشاشة بعد الحفظ
    z: (cfg.viewPanZ ?? 0) * 0.35,
  };
}

function orbitRadius(cfg: MergedGfxModel3dSettings): number {
  if (typeof cfg.orbitDistance === 'number') return cfg.orbitDistance;
  return cfg.cameraDistance * ORBIT_RADIUS_SCALE;
}

/**
 * تعويض خفيف لمسافة الكاميرا حسب نسبة الشاشة —
 * يمنع تمدد/انزياح الإطار عند اختلاف الجوال عن الكمبيوتر لنفس المنظور.
 */
export function settingsWithAspectCompensation(
  cfg: MergedGfxModel3dSettings,
  aspect: number,
): MergedGfxModel3dSettings {
  const ref = cfg.referenceAspect;
  if (!ref || !(aspect > 0) || !hasOrbitPose(cfg)) return cfg;
  const ratio = aspect / ref;
  if (Math.abs(ratio - 1) < 0.04) return cfg;
  const base = orbitRadius(cfg);
  // جذر النسبة يوازن بين العرض والارتفاع دون مبالغة
  const compensated = clamp(base * Math.sqrt(ratio), ORBIT_DIST_MIN, ORBIT_DIST_MAX);
  return { ...cfg, orbitDistance: compensated };
}

export function cameraPoseVectors(cfg: MergedGfxModel3dSettings): { camPos: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } } {
  const THREE = window.THREE;
  const t = cameraTargetFromSettings(cfg);
  const target = new THREE.Vector3(t.x, t.y, t.z);
  if (hasOrbitPose(cfg)) {
    const radius = orbitRadius(cfg);
    const sp = new THREE.Spherical(radius, cfg.orbitPolar!, cfg.orbitAzimuth!);
    const camPos = target.clone().add(new THREE.Vector3().setFromSpherical(sp));
    return { camPos: { x: camPos.x, y: camPos.y, z: camPos.z }, target: t };
  }
  return {
    camPos: { x: cfg.viewPanX, y: 0.4 + cfg.viewPanY, z: ORBIT_RADIUS_SCALE * cfg.cameraDistance },
    target: t,
  };
}

export function applyCameraPose(camera: any, cfg: MergedGfxModel3dSettings) {
  const { camPos, target } = cameraPoseVectors(cfg);
  camera.position.set(camPos.x, camPos.y, camPos.z);
  camera.lookAt(target.x, target.y, target.z);
}

/** استخراج منظور كامل من OrbitControls — بدون تقريب يُسبب اختلافاً بعد الحفظ */
export function capturePoseFromControls(camera: any, controls: any, referenceAspect?: number): GfxCameraPose {
  const t = controls?.target;
  if (!t) return { viewPanX: 0, viewPanY: 0, cameraDistance: 1 };
  const dist = typeof controls.getDistance === 'function'
    ? controls.getDistance()
    : camera.position.distanceTo(t);
  const az = typeof controls.getAzimuthalAngle === 'function' ? controls.getAzimuthalAngle() : 0;
  const pol = typeof controls.getPolarAngle === 'function' ? controls.getPolarAngle() : Math.PI / 2;
  const pose: GfxCameraPose = {
    viewPanX: t.x / 0.35,
    viewPanY: t.y / 0.35,
    viewPanZ: t.z / 0.35,
    cameraDistance: dist / ORBIT_RADIUS_SCALE,
    orbitDistance: dist,
    orbitAzimuth: az,
    orbitPolar: pol,
  };
  if (typeof referenceAspect === 'number' && referenceAspect > 0) {
    pose.referenceAspect = referenceAspect;
  }
  return pose;
}

export function syncControlsFromSettings(controls: any, camera: any, cfg: MergedGfxModel3dSettings) {
  const THREE = window.THREE;
  const t = cameraTargetFromSettings(cfg);
  controls.target.set(t.x, t.y, t.z);
  if (hasOrbitPose(cfg)) {
    const radius = orbitRadius(cfg);
    const offset = new THREE.Vector3().setFromSpherical(
      new THREE.Spherical(radius, cfg.orbitPolar!, cfg.orbitAzimuth!),
    );
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
  } else {
    applyCameraPose(camera, cfg);
  }
  controls.update();
}

let orbitPromise: Promise<void> | null = null;

export function ensureOrbitControls(): Promise<void> {
  if (!window.THREE) return Promise.reject(new Error('THREE.js not loaded'));
  if (window.THREE.OrbitControls) return Promise.resolve();
  if (orbitPromise) return orbitPromise;
  orbitPromise = loadScript(ORBIT_CONTROLS_SCRIPT);
  return orbitPromise;
}

declare global {
  interface Window {
    THREE: any;
  }
}
