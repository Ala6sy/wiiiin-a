import type { CvSection } from './appData';
import { CV_BLANK_PAGE_OFFSET, type CvPageSlot } from './cvPageSequence';

/** صفحة تعرض أقساماً مثبتة (editorPage) فقط — بدون translateY */
export const CV_PINNED_PAGE_OFFSET = -2;

export type CvPhysicalPageKind = 'flow' | 'pinned' | 'blank';

export type CvPhysicalPagePlan = {
  kind: CvPhysicalPageKind;
  pageNum: number;
  /** إزاحة محتوى التدفق — flow فقط */
  flowOffset?: number;
};

export function maxPinnedEditorPage(sections: CvSection[]): number {
  let max = 0;
  for (const s of sections) {
    if (!s.visible || s.kind === 'header') continue;
    if (typeof s.editorPage === 'number' && s.editorPage > max) max = s.editorPage;
  }
  return max;
}

export function hasPinnedSectionsOnPage(sections: CvSection[], pageNum: number): boolean {
  return sections.some(
    s => s.visible && s.kind !== 'header' && s.editorPage === pageNum,
  );
}

/** أقسام التدفق التلقائي (صفحة 1+) — بدون تثبيت صفحة 2+ */
export function isFlowSection(sec: CvSection): boolean {
  if (!sec.visible || sec.kind === 'header') return false;
  return !(typeof sec.editorPage === 'number' && sec.editorPage >= 2);
}

export function sectionOnPinnedPage(sec: CvSection, pageNum: number): boolean {
  return sec.visible && sec.kind !== 'header' && sec.editorPage === pageNum;
}

export function buildPhysicalPagePlan(
  flowOffsets: number[],
  sequence: CvPageSlot[] | undefined,
  sections: CvSection[],
  extraBlankPages: number,
): CvPhysicalPagePlan[] {
  const maxPinned = maxPinnedEditorPage(sections);
  const seq = sequence?.length
    ? sequence
    : Array.from({ length: Math.max(1, flowOffsets.length) }, (_, i) => i as number);
  if (extraBlankPages > 0 && !sequence?.length) {
    for (let i = 0; i < extraBlankPages; i++) seq.push('blank');
  }

  let total = Math.max(flowOffsets.length, maxPinned, seq.length, 1);
  const plan: CvPhysicalPagePlan[] = [];
  let flowIdx = 0;

  for (let pageNum = 1; pageNum <= total; pageNum++) {
    const slot = seq[pageNum - 1];
    const pinned = hasPinnedSectionsOnPage(sections, pageNum);

    if (pinned) {
      plan.push({ kind: 'pinned', pageNum });
      continue;
    }

    if (slot === 'blank' && flowIdx >= flowOffsets.length) {
      plan.push({ kind: 'blank', pageNum });
      continue;
    }

    if (flowIdx < flowOffsets.length) {
      plan.push({ kind: 'flow', pageNum, flowOffset: flowOffsets[flowIdx] });
      flowIdx += 1;
      continue;
    }

    if (slot === 'blank') {
      plan.push({ kind: 'blank', pageNum });
      continue;
    }

    plan.push({ kind: 'blank', pageNum });
  }

  while (flowIdx < flowOffsets.length) {
    const pageNum = plan.length + 1;
    if (hasPinnedSectionsOnPage(sections, pageNum)) {
      plan.push({ kind: 'pinned', pageNum });
    } else {
      plan.push({ kind: 'flow', pageNum, flowOffset: flowOffsets[flowIdx] });
      flowIdx += 1;
    }
  }

  return plan.length ? plan : [{ kind: 'flow', pageNum: 1, flowOffset: 0 }];
}

export function planToLayoutOffsets(plan: CvPhysicalPagePlan[]): number[] {
  return plan.map(p => {
    if (p.kind === 'blank') return CV_BLANK_PAGE_OFFSET;
    if (p.kind === 'pinned') return CV_PINNED_PAGE_OFFSET;
    return p.flowOffset ?? 0;
  });
}

export function isPinnedPageOffset(offset: number): boolean {
  return offset === CV_PINNED_PAGE_OFFSET;
}
