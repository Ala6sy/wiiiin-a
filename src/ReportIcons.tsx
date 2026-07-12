/** PDF-safe icons as SVG data-URI images (dompdf renders img reliably). */
const PATHS: Record<string, string> = {
  default: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z',
  'fa-droplet': 'M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z',
  'fa-sun': 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-6v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M2 12h2m16 0h2M4.2 19.8l1.4-1.4m12.8-12.8 1.4-1.4',
  'fa-leaf': 'M11.6 20.9C6.1 17.4 2.25 12.2 2.25 8.25 2.25 5.32 4.71 3 7.69 3 9.5 3 11.1 3.8 12 5.06 12.9 3.8 14.5 3 16.31 3 19.29 3 21.75 5.32 21.75 8.25c0 3.95-3.85 9.15-10.15 12.65z',
  'fa-flask': 'M9.75 3.1v5.7c0 .6-.24 1.17-.66 1.59L5 14.5h14l-4.09-4.11A2.25 2.25 0 0 1 14.25 8.8V3.1M9.75 3.1h4.5',
  'fa-flask-vial': 'M9.75 3.1v5.7c0 .6-.24 1.17-.66 1.59L5 14.5h14l-4.09-4.11A2.25 2.25 0 0 1 14.25 8.8V3.1M9.75 3.1h4.5',
  'fa-earth-asia': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93A8.005 8.005 0 0 1 4.07 13H2.05c.05 4.52 3.47 8.26 7.95 8.93V19.93zM12 4.07V6h2V4.07A8.005 8.005 0 0 1 19.93 11H22c0-.05 0-.1-.01-.15A10 10 0 0 0 12 4.07z',
  'fa-wheat-awn': 'M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1 3-6z',
  'fa-temperature-half': 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0-7v2m0 16v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4',
  'fa-bolt': 'M13 2L3 14h7l-1 8 10-12h-7l1-8z',
  'fa-mountain': 'M12 3L2 18h20L12 3zm0 5.5L16.5 16h-9L12 8.5z',
  'fa-layer-group': 'M12 2L2 7l10 5 10-5-10-5zm0 8L2 15l10 5 10-5-10-5z',
  'fa-percent': 'M7 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm10 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5 19l14-14 1.4 1.4L6.4 20.4 5 19z',
  'fa-vials': 'M8 2v6l-4 12h16L16 8V2H8zm0 0h8',
  'fa-seedling': 'M12 2v6m0 0c-3 0-5 2-5 5v9h10V13c0-3-2-5-5-5z',
  'fa-calendar-days': 'M7 2v2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 8H5v10h14V10z',
  'fa-clock-rotate-left': 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 5v5l4 2',
  'fa-tractor': 'M5 15h2v2H5v-2zm10 0h2v2h-2v-2zM7 11h10v2H7v-2zM4 7h16v2H4V7z',
  'fa-tree': 'M12 2L8 10h3v4H9l3 8 3-8h-2v-4h3L12 2z',
  'fa-recycle': 'M6 18l-2-4h4l2 4H6zm12 0l2-4h-4l-2 4h4zM12 4l2 4h-4l2-4zm-4 8h8l-2 4H10l-2-4z',
  'fa-heart-pulse': 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  'fa-apple-whole': 'M12 2c1.5 2.5 1.5 5.5 0 8-1.5-2.5-1.5-5.5 0-8zm-2 10c-3 0-5 2.5-5 6h14c0-3.5-2-6-5-6H10z',
  'fa-pills': 'M8 2h8v4H8V2zm-4 6h16v12H4V8zm4 4v4h8v-4H8z',
  'fa-capsules': 'M6 2h12v6H6V2zm0 8h12v12H6V10zm2 2v8h8v-8H8z',
  'fa-virus': 'M12 2v4m0 12v4M4.2 4.2l2.8 2.8m9.9 9.9 2.8 2.8M2 12h4m12 0h4M4.2 19.8l2.8-2.8m9.9-9.9 2.8-2.8M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  'fa-image': 'M4 4h16v16H4V4zm2 2v8l4-3 4 5 3-4 3 4V6H6z',
  'fa-bug': 'M12 2a4 4 0 0 0-4 4v2H6v2h2v2H6v2h2v2a4 4 0 0 0 8 0v-2h2v-2h-2v-2h2v-2h-2V8a4 4 0 0 0-4-4z',
  'fa-stethoscope': 'M6 4h12v2H6V4zm0 4h12v2H6V8zm2 4h8v6a4 4 0 0 1-8 0v-6z',
  'fa-spray-can': 'M8 4h8v4H8V4zm-2 6h12v10H6V10zm2 2v6h8v-6H8z',
  'fa-circle-check': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 14l-4-4 1.4-1.4L11 13.2l5.6-5.6L18 9l-7 7z',
};

export function ReportIcon({ name, color, size = 14 }: { name: string; color: string; size?: number }) {
  const d = PATHS[name] ?? PATHS.default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}"><path fill="${color}" d="${d}"/></svg>`;
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return (
    <img
      className="pdf-report-icon"
      data-pdf-icon="1"
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ display: 'inline-block', verticalAlign: '-0.12em', marginInlineEnd: 0, flexShrink: 0 }}
    />
  );
}
