/** Preset theme colors + fonts for Site Settings (dropdown lists) */

export type ThemeColorOption = { value: string; label: string };

export const ACCENT_COLOR_OPTIONS: ThemeColorOption[] = [
  { value: '#003366', label: 'كحلي — افتراضي الموقع' },
  { value: '#0b2a4a', label: 'كحلي داكن' },
  { value: '#14213d', label: 'كحلي ليلي' },
  { value: '#1e3a8a', label: 'أزرق ملكي' },
  { value: '#0f4c81', label: 'أزرق بحري' },
  { value: '#2563eb', label: 'أزرق ساطع' },
  { value: '#0ea5e9', label: 'أزرق سماوي' },
  { value: '#0891b2', label: 'تركواز' },
  { value: '#0d9488', label: 'أخضر مائي' },
  { value: '#059669', label: 'أخضر زمردي' },
  { value: '#166534', label: 'أخضر غامق' },
  { value: '#1a3c34', label: 'أخضر زيتوني' },
  { value: '#7c3aed', label: 'بنفسجي' },
  { value: '#6d28d9', label: 'بنفسجي ملكي' },
  { value: '#3a1d57', label: 'بنفسجي داكن' },
  { value: '#be185d', label: 'وردي' },
  { value: '#b91c1c', label: 'أحمر' },
  { value: '#c2410c', label: 'برتقالي محروق' },
  { value: '#a16207', label: 'ذهبي داكن' },
  { value: '#374151', label: 'رمادي فحمي' },
  { value: '#111827', label: 'أسود رمادي' },
];

export const MENU_TEXT_COLOR_OPTIONS: ThemeColorOption[] = [
  { value: '', label: 'تلقائي — يتبع الثيم والوضع الليلي/النهاري' },
  { value: '#ffffff', label: 'أبيض' },
  { value: '#f8fafc', label: 'أبيض ثلجي' },
  { value: '#e8f0ff', label: 'أزرق فاتح جداً' },
  { value: '#dfe9f8', label: 'أزرق باهت' },
  { value: '#5b9bff', label: 'أزرق ليلي (وضع معتم)' },
  { value: '#38bdf8', label: 'سماوي فاتح' },
  { value: '#fef3c7', label: 'كريمي فاتح' },
  { value: '#003366', label: 'كحلي' },
  { value: '#0b2a4a', label: 'كحلي داكن' },
  { value: '#111827', label: 'أسود رمادي' },
];

export const BODY_TEXT_COLOR_OPTIONS: ThemeColorOption[] = [
  { value: '', label: 'تلقائي — فاتح ليلاً / غامق نهاراً' },
  { value: '#001F3F', label: 'كحلي غامق (نهاري)' },
  { value: '#0a1a2e', label: 'أسود مزرق' },
  { value: '#1a2a3a', label: 'رمادي غامق' },
  { value: '#334455', label: 'رمادي متوسط' },
  { value: '#e7eefb', label: 'أبيض مزرق (ليلي)' },
  { value: '#dfe9f8', label: 'أزرق فاتح (ليلي)' },
  { value: '#f0f4ff', label: 'أبيض مائل للأزرق' },
  { value: '#ffffff', label: 'أبيض نقي' },
];

export const HEADING_TEXT_COLOR_OPTIONS: ThemeColorOption[] = [
  { value: '', label: 'تلقائي — يتبع اللون الأساسي' },
  { value: '#003366', label: 'كحلي' },
  { value: '#0b2a4a', label: 'كحلي داكن' },
  { value: '#1e3a8a', label: 'أزرق ملكي' },
  { value: '#2563eb', label: 'أزرق ساطع' },
  { value: '#5b9bff', label: 'أزرق ليلي' },
  { value: '#0d9488', label: 'أخضر مائي' },
  { value: '#7c3aed', label: 'بنفسجي' },
  { value: '#ffffff', label: 'أبيض' },
  { value: '#111827', label: 'أسود رمادي' },
];

export const MUTED_TEXT_COLOR_OPTIONS: ThemeColorOption[] = [
  { value: '', label: 'تلقائي — ثانوي حسب الثيم' },
  { value: '#556677', label: 'رمادي أزرق (نهاري)' },
  { value: '#667788', label: 'رمادي متوسط' },
  { value: '#8899aa', label: 'رمادي فاتح' },
  { value: '#9fb3cc', label: 'رمادي مزرق (ليلي)' },
  { value: '#b8cce8', label: 'أزرق باهت (ليلي)' },
  { value: '#c7d4ea', label: 'أزرق شفاف' },
];

export const LOGO_COLOR_OPTIONS: ThemeColorOption[] = [
  { value: '', label: 'تلقائي — أبيض ليلاً / كحلي نهاراً' },
  { value: '#ffffff', label: 'أبيض' },
  { value: '#003366', label: 'كحلي' },
  { value: '#5b9bff', label: 'أزرق ليلي' },
  { value: '#0ea5e9', label: 'سماوي' },
  { value: '#111827', label: 'أسود رمادي' },
];

export const SITE_FONT_OPTIONS = [
  { value: 'Tajawal', label: 'Tajawal — افتراضي الموقع' },
  { value: 'Cairo', label: 'Cairo — عصري وواضح' },
  { value: 'Almarai', label: 'Almarai — بسيط ومريح' },
  { value: 'IBM Plex Sans Arabic', label: 'IBM Plex Arabic — احترافي' },
  { value: 'Noto Sans Arabic', label: 'Noto Sans Arabic — محايد' },
  { value: 'El Messiri', label: 'El Messiri — أنيق' },
  { value: 'Amiri', label: 'Amiri — كلاسيكي' },
  { value: 'Readex Pro', label: 'Readex Pro — تقني' },
] as const;

export const DEFAULT_BODY_TEXT = { light: '#001F3F', dark: '#e7eefb' } as const;
export const DEFAULT_MUTED_TEXT = { light: '#556677', dark: '#9fb3cc' } as const;

export function resolveBodyTextColor(raw: string | undefined, dark: boolean): string {
  const v = (raw || '').trim();
  if (v) return v;
  return dark ? DEFAULT_BODY_TEXT.dark : DEFAULT_BODY_TEXT.light;
}

export function resolveMutedTextColor(raw: string | undefined, dark: boolean): string {
  const v = (raw || '').trim();
  if (v) return v;
  return dark ? DEFAULT_MUTED_TEXT.dark : DEFAULT_MUTED_TEXT.light;
}

export function resolveHeadingTextColor(raw: string | undefined, accentNavy: string): string {
  const v = (raw || '').trim();
  return v || accentNavy;
}

export function isHexColor(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test((v || '').trim());
}
