/** مساعد بسيط للنص العربي في المعاينة */

export function hasArabic(s: string) {
  return /[\u0600-\u06FF\u0750-\u077F]/.test(s);
}
