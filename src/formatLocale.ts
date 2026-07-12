import type { LangKey } from './appData';

/** أرقام غربية (1 2 3) حتى في الواجهة العربية */
export function formatWesternNum(n: number, maxFractionDigits = 1): string {
  return new Intl.NumberFormat('ar-SY-u-nu-latn', { maximumFractionDigits: maxFractionDigits }).format(n);
}

export function formatWesternDate(lang: LangKey, date = new Date()): string {
  if (lang === 'ar') {
    return new Intl.DateTimeFormat('ar-SY-u-nu-latn', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    }).format(date);
  }
  const loc = lang === 'de' ? 'de-DE' : 'en-US';
  return new Intl.DateTimeFormat(loc, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

/** شهر وسنة بأرقام غربية — لختم «أُنشئت» في السيرة */
export function formatWesternMonthYear(lang: LangKey, date = new Date()): string {
  if (lang === 'ar') {
    return new Intl.DateTimeFormat('ar-SY-u-nu-latn', { year: 'numeric', month: 'long' }).format(date);
  }
  const loc = lang === 'de' ? 'de-DE' : 'en-GB';
  return new Intl.DateTimeFormat(loc, { year: 'numeric', month: 'long' }).format(date);
}
