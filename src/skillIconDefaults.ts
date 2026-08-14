import type { Skill } from './appData';

function isImageIcon(icon: string): boolean {
  const v = (icon || '').trim();
  if (!v) return false;
  if (v.startsWith('data:')) return true;
  if (/^https?:\/\//i.test(v)) return true;
  if (v.startsWith('/') || v.startsWith('./') || v.startsWith('../')) return true;
  if (/^uploads\//i.test(v)) return true;
  if (/\.(png|jpe?g|gif|webp|svg|ico)(\?.*)?$/i.test(v)) return true;
  return false;
}

/** أيقونات افتراضية موثوقة — تُستخدم عند فشل رابط الرفع */
const DEFAULT_BY_NAME: Record<string, string> = {
  photoshop: 'https://cdn.simpleicons.org/adobephotoshop/31A8FF',
  illustrator: 'https://cdn.simpleicons.org/adobeillustrator/FF9A00',
  indesign: 'https://cdn.simpleicons.org/adobeindesign/FF3366',
  'adobe xd': 'https://cdn.simpleicons.org/adobexd/FF61F6',
  xd: 'https://cdn.simpleicons.org/adobexd/FF61F6',
  'after effects': 'https://cdn.simpleicons.org/adobeaftereffects/9999FF',
  'cinema 4d': 'https://cdn.simpleicons.org/cinema4d/011A6B',
  c4d: 'https://cdn.simpleicons.org/cinema4d/011A6B',
  autocad: 'https://cdn.simpleicons.org/autodesk/E51050',
  autodesk: 'https://cdn.simpleicons.org/autodesk/E51050',
  'bambu lab': 'https://cdn.simpleicons.org/bambulab/00AE42',
  bambu: 'https://cdn.simpleicons.org/bambulab/00AE42',
  blender: 'https://cdn.simpleicons.org/blender/F5792A',
  figma: 'https://cdn.simpleicons.org/figma/F24E1E',
  sketch: 'https://cdn.simpleicons.org/sketch/F7B500',
  premiere: 'https://cdn.simpleicons.org/adobepremierepro/9999FF',
  'premiere pro': 'https://cdn.simpleicons.org/adobepremierepro/9999FF',
};

function normName(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** أيقونة افتراضية حسب اسم البرنامج */
export function getDefaultSkillIconForName(name: string): string {
  const key = normName(name);
  if (!key) return '';
  if (DEFAULT_BY_NAME[key]) return DEFAULT_BY_NAME[key];
  for (const [k, url] of Object.entries(DEFAULT_BY_NAME)) {
    if (key.includes(k) || k.includes(key)) return url;
  }
  return '';
}

/**
 * هل مسار الأيقونة المخصص موثوق للعرض؟
 * مسارات مثل `/uploads/skills/6` بدون امتداد غالباً تالفة/غير معرّفة MIME فتظهر مشوّهة.
 */
export function isReliableCustomSkillIcon(icon: string): boolean {
  const v = normalizeSkillIconField((icon || '').trim());
  if (!v) return false;
  if (v.startsWith('data:image/') || v.startsWith('blob:')) return true;
  if (/cdn\.simpleicons\.org/i.test(v)) return true;
  if (/\.(svg|png|jpe?g|webp|gif|ico|avif)(\?|#|$)/i.test(v)) return true;
  // مسارات الرفع من لوحة التحكم
  if (/^\/?uploads\//i.test(v)) return true;
  // رابط خارجي (ليست ملفات رفع بدون امتداد)
  if (/^https?:\/\//i.test(v) && !/\/uploads\//i.test(v)) return true;
  return false;
}

/** توحيد مسار الرفع — skill→skills، رابط مطلق→نسبي */
export function normalizeSkillIconField(icon: string): string {
  const v = (icon || '').trim();
  if (!v) return v;
  if (v.startsWith('data:') || v.startsWith('blob:')) return v;
  if (!/^https?:\/\//i.test(v)) {
    return v
      .replace(/\/uploads\/skill\//gi, '/uploads/skills/')
      .replace(/^uploads\/skill\//i, 'uploads/skills/');
  }
  try {
    const path = new URL(v).pathname
      .replace(/\/uploads\/skill\//gi, '/uploads/skills/');
    if (path.startsWith('/uploads/')) return path;
  } catch { /* ignore */ }
  return v;
}

/** استرجاع أيقونات البرامج المعروفة + توحيد المسارات */
export function restoreDefaultSkillIcons(skills: Skill[]): Skill[] {
  return skills.map(s => {
    const def = getDefaultSkillIconForName(s.name);
    const normalized = normalizeSkillIconField(s.icon);
    if (def) return { ...s, icon: def };
    if (normalized && normalized !== s.icon) return { ...s, icon: normalized };
    return s;
  });
}

/** توحيد مسارات الرفع دون استبدال الأيقونات المخصصة */
export function normalizeSkillIconList(skills: Skill[]): Skill[] {
  return skills.map(s => {
    const normalized = normalizeSkillIconField(s.icon);
    if (!normalized && getDefaultSkillIconForName(s.name)) {
      return { ...s, icon: getDefaultSkillIconForName(s.name) };
    }
    if (normalized !== s.icon) return { ...s, icon: normalized };
    return s;
  });
}

export function skillIconNeedsRestore(icon: string, name: string): boolean {
  const v = (icon || '').trim();
  if (!v) return !!getDefaultSkillIconForName(name);
  if (!isImageIcon(v)) return false;
  const n = normalizeSkillIconField(v);
  if (n.startsWith('/uploads/') || n.startsWith('uploads/')) return false;
  return !!getDefaultSkillIconForName(name);
}
