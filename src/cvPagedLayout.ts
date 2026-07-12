export {
  CV_EXPORT_PX,
  CV_PAGE_H_PX,
  CV_PAD_Y_PX,
  CV_SHEET_INNER_H,
  CV_PAGE_STACK_GAP,
} from './cvConstants';

export function bodyOffsetForPage(pageIndex: number, firstBudget: number, contBudget: number): number {
  if (pageIndex <= 0) return 0;
  return firstBudget + (pageIndex - 1) * contBudget;
}

export function countCvPages(bodyHeight: number, firstBudget: number, contBudget: number): number {
  return planCvPageOffsets(bodyHeight, [], firstBudget, contBudget).length;
}

export type CvPageAvoidZone = { top: number; height: number };

function adjustPageEndForAvoidZones(y: number, end: number, zones: CvPageAvoidZone[]): number {
  let adjusted = end;
  for (const z of zones) {
    const zEnd = z.top + z.height;
    if (z.top < adjusted && zEnd > adjusted && z.top > y) {
      adjusted = z.top;
    }
  }
  return Math.max(y + 40, adjusted);
}

export function planCvPageOffsets(
  bodyHeight: number,
  breakStarts: number[],
  firstBudget: number,
  contBudget: number,
  avoidZones: CvPageAvoidZone[] = [],
): number[] {
  if (bodyHeight <= 0) return [0];
  const safeFirst = Math.max(120, firstBudget);
  const safeCont = Math.max(120, contBudget);
  const breaks = [...new Set(breakStarts.filter(b => b > 0 && b < bodyHeight))].sort((a, b) => a - b);

  const offsets: number[] = [];
  let y = 0;

  while (y < bodyHeight - 0.5) {
    offsets.push(y);
    const pageIdx = offsets.length - 1;
    const budget = pageIdx === 0 ? safeFirst : safeCont;
    let end = Math.min(y + budget, bodyHeight);
    end = adjustPageEndForAvoidZones(y, end, avoidZones);

    const nextBreak = breaks.find(b => b > y && b < end);
    if (nextBreak !== undefined) {
      y = nextBreak;
      continue;
    }

    if (end >= bodyHeight) break;
    y = end;
    if (offsets.length > 40) break;
  }

  return offsets.length ? offsets : [0];
}

/** إضافة صفحات فارغة في النهاية (زر إضافة صفحة) */
export function extendOffsetsWithBlankPages(
  offsets: number[],
  extraPages: number,
  firstBudget: number,
  contBudget: number,
): number[] {
  if (extraPages <= 0 || offsets.length === 0) return offsets;
  const out = [...offsets];
  for (let i = 0; i < extraPages; i++) {
    const pageIdx = out.length;
    const budget = pageIdx === 0 ? firstBudget : contBudget;
    const prev = out[out.length - 1] ?? 0;
    out.push(prev + budget);
  }
  return out;
}
