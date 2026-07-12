/** Known design source file extensions for gallery projects */
export const KNOWN_GFX_FILE_TYPES: { id: string; label: string }[] = [
  { id: 'PSD', label: 'Photoshop (PSD)' },
  { id: 'AI', label: 'Illustrator (AI)' },
  { id: 'INDD', label: 'InDesign (INDD)' },
  { id: 'PDF', label: 'PDF' },
  { id: 'EPS', label: 'EPS' },
  { id: 'SVG', label: 'SVG' },
  { id: 'C4D', label: 'Cinema 4D (C4D)' },
  { id: 'MAX', label: '3ds Max (MAX)' },
  { id: 'BLEND', label: 'Blender (BLEND)' },
  { id: 'DWG', label: 'AutoCAD (DWG)' },
  { id: 'SKP', label: 'SketchUp (SKP)' },
  { id: 'FIG', label: 'Figma (FIG)' },
  { id: 'XD', label: 'Adobe XD (XD)' },
  { id: 'AEP', label: 'After Effects (AEP)' },
  { id: 'PRPROJ', label: 'Premiere (PRPROJ)' },
  { id: 'CDR', label: 'CorelDRAW (CDR)' },
];

const KNOWN_IDS = new Set(KNOWN_GFX_FILE_TYPES.map(t => t.id));

export function parseSourceFileLabels(label?: string): string[] {
  if (!label?.trim()) return [];
  const parts = label.split(/[,،+/|]/).map(s => s.trim().toUpperCase()).filter(Boolean);
  const seen = new Set<string>();
  return parts.filter(p => {
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });
}

export function joinSourceFileLabels(labels: string[]): string {
  return labels.map(l => l.trim().toUpperCase()).filter(Boolean).join(', ');
}

export function isKnownFileType(id: string): boolean {
  return KNOWN_IDS.has(id.toUpperCase());
}

export function splitKnownAndCustomLabels(label?: string): { known: string[]; custom: string[] } {
  const all = parseSourceFileLabels(label);
  const known: string[] = [];
  const custom: string[] = [];
  for (const id of all) {
    if (KNOWN_IDS.has(id)) known.push(id);
    else custom.push(id);
  }
  return { known, custom };
}
