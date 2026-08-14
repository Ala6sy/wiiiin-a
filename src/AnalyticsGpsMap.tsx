import { useEffect, useMemo, useRef } from 'react';
import type { VisitorRow } from './analytics';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

export type GpsMapVisitor = VisitorRow & {
  gpsConsentAt?: string | null;
  gpsAccuracy?: string | null;
};

type GpsPin = GpsMapVisitor & { lat: number; lon: number };

function loadStyle(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) {
      resolve();
      return;
    }
    if (document.querySelector(`script[src="${src}"]`)) {
      const wait = () => {
        if ((window as any).L) resolve();
        else window.setTimeout(wait, 50);
      };
      wait();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function toPins(visitors: GpsMapVisitor[]): GpsPin[] {
  return visitors
    .filter(v => v.gpsConsentAt)
    .map(v => {
      const lat = parseFloat(String(v.lat ?? ''));
      const lon = parseFloat(String(v.lon ?? ''));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
      return { ...v, lat, lon };
    })
    .filter((v): v is GpsPin => v != null);
}

export function AnalyticsGpsMap({
  visitors,
  ar,
  height = 500,
}: {
  visitors: GpsMapVisitor[];
  ar: boolean;
  height?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const pins = useMemo(() => toPins(visitors), [visitors]);
  const pinsKey = useMemo(
    () => pins.map(p => `${p.sessionId}:${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join('|'),
    [pins],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (!pins.length) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      host.innerHTML = '';
      return;
    }

    let cancelled = false;
    loadStyle(LEAFLET_CSS);
    loadScript(LEAFLET_JS)
      .then(() => {
        if (cancelled || !hostRef.current) return;
        const L = (window as any).L;
        if (!L) return;

        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
        host.innerHTML = '';

        const map = L.map(host, { worldCopyJump: true, maxZoom: 18 });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        const pinIcon = L.divIcon({
          className: 'analytics-gps-pin-wrap',
          html: '<div class="analytics-gps-pin-dot"><i class="fa-solid fa-location-dot"></i></div>',
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -30],
        });

        const bounds: [number, number][] = [];
        pins.forEach((p) => {
          bounds.push([p.lat, p.lon]);
          const place = [p.city, p.country].filter(Boolean).join(' · ') || 'GPS';
          const accRaw = p.gpsAccuracy != null ? parseFloat(String(p.gpsAccuracy)) : NaN;
          const acc = Number.isFinite(accRaw) ? `±${accRaw.toFixed(0)}m` : '—';
          const device = [p.deviceName, p.os, p.browser].filter(Boolean).join(' · ');
          const html = `
            <div class="analytics-gps-popup">
              <div class="analytics-gps-popup-title">${place}</div>
              <div class="analytics-gps-popup-coords">${p.lat.toFixed(5)}°, ${p.lon.toFixed(5)}°</div>
              ${device ? `<div>${device}</div>` : ''}
              <div>${ar ? 'دقة GPS' : 'GPS accuracy'}: <b>${acc}</b></div>
              <div>${ar ? 'موافقة' : 'Consent'}: ${p.gpsConsentAt?.slice(0, 16) || '—'}</div>
              <div>${ar ? 'آخر نشاط' : 'Last seen'}: ${p.lastSeen?.slice(0, 16) || '—'}</div>
              <a href="https://www.google.com/maps?q=${p.lat},${p.lon}&z=16" target="_blank" rel="noreferrer">Google Maps</a>
            </div>`;
          L.marker([p.lat, p.lon], { icon: pinIcon }).addTo(map).bindPopup(html, { maxWidth: 280 });
        });

        if (bounds.length === 1) {
          map.setView(bounds[0], 13);
        } else {
          map.fitBounds(bounds, { padding: [48, 48], maxZoom: 12 });
        }

        mapRef.current = map;
        window.setTimeout(() => map.invalidateSize(), 120);
      })
      .catch(() => { /* silent */ });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [pinsKey, ar, pins]);

  if (!pins.length) {
    return (
      <p className="analytics-muted" style={{ textAlign: 'center', padding: 32 }}>
        {ar
          ? 'لا توجد دبابيس GPS بعد — تظهر فقط للزوار الذين وافقوا صراحةً على مشاركة الموقع الدقيق.'
          : 'No GPS pins yet — only visitors who explicitly consented appear here.'}
      </p>
    );
  }

  return (
    <div className="analytics-gps-map-shell">
      <div ref={hostRef} className="analytics-gps-map" style={{ height }} />
      <div className="analytics-gps-map-legend">
        <span><i className="fa-solid fa-location-dot" style={{ color: '#39c77f' }} /> {pins.length} {ar ? 'موقع GPS دقيق' : 'precise GPS pin(s)'}</span>
        <span className="analytics-muted">{ar ? 'ليس تقدير IP' : 'Not IP estimate'}</span>
      </div>
    </div>
  );
}
