import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export type Html2CanvasFn = (
  el: HTMLElement,
  opts?: Record<string, unknown>,
) => Promise<HTMLCanvasElement>;

export type JsPDFCtor = new (opts?: object) => {
  addImage: (...args: unknown[]) => void;
  addPage: (...args: unknown[]) => void;
  output: (type: string) => Blob;
};

export function getHtml2Canvas(): Html2CanvasFn {
  return html2canvas as unknown as Html2CanvasFn;
}

export function getJsPDFCtor(): JsPDFCtor {
  return jsPDF as unknown as JsPDFCtor;
}

export function exportLibsReady(): boolean {
  return typeof html2canvas === 'function' && typeof jsPDF === 'function';
}
