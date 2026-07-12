/** عنصر في ترتيب الصفحات — مقطع محتوى (0+) أو صفحة فارغة */
export type CvPageSlot = number | 'blank';

export const CV_BLANK_PAGE_OFFSET = -1;

export function defaultPageSequence(contentCount: number, extraBlankAtEnd = 0): CvPageSlot[] {
  const n = Math.max(1, contentCount);
  const seq: CvPageSlot[] = Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < extraBlankAtEnd; i++) seq.push('blank');
  return seq;
}

export function sanitizePageSequence(seq: CvPageSlot[], contentCount: number): CvPageSlot[] {
  const max = Math.max(1, contentCount);
  return seq.filter(s => s === 'blank' || (typeof s === 'number' && s >= 0 && s < max));
}

/** دمج الترتيب اليدوي مع مقاطع المحتوى التلقائية */
export function applyPageSequence(
  contentOffsets: number[],
  sequence: CvPageSlot[] | undefined,
  extraBlankPages: number,
): number[] {
  const contentCount = contentOffsets.length;
  let seq = sequence?.length
    ? sanitizePageSequence(sequence, contentCount)
    : defaultPageSequence(contentCount, extraBlankPages);

  if (!seq.length) seq = defaultPageSequence(contentCount, extraBlankPages);

  const used = new Set(seq.filter((s): s is number => s !== 'blank'));
  const missing = Array.from({ length: contentCount }, (_, i) => i).filter(i => !used.has(i));
  if (missing.length) {
    let splitAt = seq.length;
    while (splitAt > 0 && seq[splitAt - 1] === 'blank') splitAt -= 1;
    seq = [...seq.slice(0, splitAt), ...missing, ...seq.slice(splitAt)];
  }

  return seq.map(slot => (slot === 'blank' ? CV_BLANK_PAGE_OFFSET : (contentOffsets[slot] ?? 0)));
}

export function isBlankPageOffset(offset: number): boolean {
  return offset < 0;
}

export function initPageSequence(contentCount: number, extraBlankPages: number, existing?: CvPageSlot[]): CvPageSlot[] {
  if (existing?.length) return sanitizePageSequence(existing, contentCount);
  return defaultPageSequence(contentCount, extraBlankPages);
}

export function movePageSlot(seq: CvPageSlot[], from: number, to: number): CvPageSlot[] {
  if (from < 0 || from >= seq.length || to < 0 || to >= seq.length || from === to) return seq;
  const out = [...seq];
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

export function insertBlankAfter(seq: CvPageSlot[], afterIndex: number): CvPageSlot[] {
  const out = [...seq];
  const at = Math.max(0, Math.min(afterIndex + 1, out.length));
  out.splice(at, 0, 'blank');
  return out;
}

export function removePageAt(seq: CvPageSlot[], index: number): CvPageSlot[] {
  if (index < 0 || index >= seq.length) return seq;
  return seq.filter((_, i) => i !== index);
}

export function pageSlotLabel(slot: CvPageSlot, displayNum: number): string {
  if (slot === 'blank') return `صفحة ${displayNum} — فارغة`;
  return `صفحة ${displayNum} — محتوى ${slot + 1}`;
}
