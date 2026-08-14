export type AnalyticsEvent = 'page_view' | 'page_duration' | 'cv_download' | 'file_download' | 'heartbeat';

const SID_KEY = '__visitor_sid__';
const GPS_KEY = '__visitor_gps__';

function storedGpsMeta(): Record<string, unknown> | undefined {
  try {
    const raw = localStorage.getItem(GPS_KEY);
    if (!raw) return undefined;
    const o = JSON.parse(raw) as {
      consent?: boolean;
      lat?: number;
      lon?: number;
      city?: string;
      region?: string;
      country?: string;
      accuracy?: number;
    };
    if (!o?.consent || typeof o.lat !== 'number' || typeof o.lon !== 'number') return undefined;
    return {
      gps: true, lat: o.lat, lon: o.lon,
      city: o.city, region: o.region, country: o.country,
      accuracy: o.accuracy,
    };
  } catch {
    return undefined;
  }
}

function analyticsUrl(): string {
  return (import.meta.env.VITE_ANALYTICS_URL as string | undefined) || '/api/analytics.php';
}

function clientHints(): Record<string, string> {
  try {
    const ua = navigator.userAgent || '';
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const tablet = /iPad|Tablet/i.test(ua);
    const deviceType = tablet ? 'tablet' : mobile ? 'mobile' : 'desktop';
    let deviceName = 'Computer';
    if (/iPhone/i.test(ua)) deviceName = 'Apple iPhone';
    else if (/iPad/i.test(ua)) deviceName = 'Apple iPad';
    else {
      const androidModel = ua.match(/Android[^;]*;\s*([^;)]+?)(?:\s+Build\/|;|\))/i)?.[1]?.trim();
      if (androidModel) deviceName = androidModel;
      else if (/Android/i.test(ua)) deviceName = 'Android device';
      else if (/Windows/i.test(ua)) deviceName = 'Windows PC';
      else if (/Macintosh|Mac OS X/i.test(ua)) deviceName = 'Apple Mac';
      else if (/Linux/i.test(ua)) deviceName = 'Linux PC';
    }
    const browser =
      /Edg\//i.test(ua) ? 'Edge'
        : /OPR\//i.test(ua) ? 'Opera'
          : /Chrome\//i.test(ua) ? 'Chrome'
            : /Firefox\//i.test(ua) ? 'Firefox'
              : /Safari\//i.test(ua) ? 'Safari'
                : 'Other';
    const os =
      /Android/i.test(ua) ? 'Android'
        : /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
          : /Windows/i.test(ua) ? 'Windows'
            : /Mac OS X|Macintosh/i.test(ua) ? 'macOS'
              : /Linux/i.test(ua) ? 'Linux'
                : 'Other';
    return {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      locale: navigator.language || '',
      deviceType,
      deviceName,
      browser,
      os,
      screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
    };
  } catch {
    return {};
  }
}

export function getVisitorSessionId(): string {
  try {
    let id = localStorage.getItem(SID_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `v_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem(SID_KEY, id);
    }
    return id;
  } catch {
    return `v_${Date.now()}`;
  }
}

export async function trackAnalytics(
  event: AnalyticsEvent,
  opts?: { path?: string; label?: string; meta?: Record<string, unknown> },
): Promise<void> {
  try {
    await fetch(analyticsUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'track',
        sessionId: getVisitorSessionId(),
        event,
        path: opts?.path ?? null,
        label: opts?.label ?? null,
        meta: { ...clientHints(), ...(opts?.meta || {}) },
      }),
      keepalive: true,
    });
  } catch {
    /* silent — analytics must not break the site */
  }
}

export function trackPageView(path: string) {
  return trackAnalytics('page_view', {
    path,
    label: typeof document !== 'undefined' ? document.title : undefined,
    meta: storedGpsMeta(),
  });
}

export function trackPageDuration(path: string, durationSeconds: number) {
  const duration = Math.max(0, Math.min(86400, Math.round(durationSeconds)));
  if (duration < 1) return Promise.resolve();
  return trackAnalytics('page_duration', {
    path,
    label: typeof document !== 'undefined' ? document.title : undefined,
    meta: { durationSeconds: duration, ...storedGpsMeta() },
  });
}

export function trackCvDownload(docId: string, docName: string, lang: string) {
  return trackAnalytics('cv_download', {
    path: docId,
    label: docName,
    meta: { lang, ...storedGpsMeta() },
  });
}

export function trackFileDownload(label: string, path?: string) {
  return trackAnalytics('file_download', { path: path || label, label });
}

export function trackHeartbeat() {
  const gps = storedGpsMeta();
  return trackAnalytics('heartbeat', { path: gps ? 'gps_sync' : 'active', meta: gps });
}

export interface AnalyticsStats {
  ok: boolean;
  since?: string;
  onlineMinutes?: number;
  totals?: {
    pageViews: number;
    uniqueVisitors: number;
    cvDownloads: number;
    fileDownloads: number;
    onlineNow: number;
  };
  today?: {
    pageViews: number;
    uniqueVisitors: number;
    cvDownloads: number;
    fileDownloads: number;
    onlineNow: number;
  };
  byCountry?: { country: string; code: string; visitors: string; lat: string | null; lon: string | null }[];
  onlineNow?: VisitorRow[];
  recentVisitors?: VisitorRow[];
  recentEvents?: {
    id: string;
    sessionId?: string | null;
    eventType: string;
    path: string | null;
    label: string | null;
    createdAt: string;
    ip: string | null;
    country: string | null;
    city: string | null;
    region?: string | null;
    zip?: string | null;
    lat?: string | null;
    lon?: string | null;
    geoSource?: string | null;
    durationSeconds?: number | null;
    deviceType?: string | null;
    deviceName?: string | null;
    browser?: string | null;
    os?: string | null;
  }[];
  cvDownloads?: { label: string; count: string }[];
  fileDownloads?: { label: string; count: string }[];
  gpsVisitors?: (VisitorRow & { gpsConsentAt?: string | null; gpsAccuracy?: string | null })[];
  cvDownloadsDetail?: {
    id: string;
    sessionId: string;
    path: string | null;
    label: string | null;
    createdAt: string;
    ip: string | null;
    city: string | null;
    country: string | null;
    lat: number | null;
    lon: number | null;
    geoSource: string | null;
  }[];
  periodReports?: {
    day: PeriodReport;
    month: PeriodReport;
    year: PeriodReport;
  };
  error?: string;
}

export interface PeriodReport {
  label: string;
  visitors: number;
  cvDownloads: number;
  gpsVisitors: number;
  cvDownloadsWithGps: number;
}

export interface VisitorRow {
  sessionId: string;
  ip: string | null;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  zip: string | null;
  isp: string | null;
  timezone: string | null;
  clientTimezone: string | null;
  geoSource: string | null;
  lat: string | null;
  lon: string | null;
  deviceType?: string | null;
  deviceName?: string | null;
  browser?: string | null;
  os?: string | null;
  screenSize?: string | null;
  currentPath?: string | null;
  currentPageSeconds?: string | number | null;
  lastPageDuration?: string | number | null;
  pageViews: string;
  lastSeen: string;
  firstSeen: string;
}

export async function fetchAnalyticsStats(token: string): Promise<AnalyticsStats> {
  const res = await fetch(`${analyticsUrl()}?action=stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json() as AnalyticsStats;
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}

export async function deleteAnalyticsItems(
  token: string,
  opts: { sessionIds?: string[]; eventIds?: string[] },
): Promise<void> {
  const res = await fetch(analyticsUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action: 'delete',
      sessionIds: opts.sessionIds || [],
      eventIds: opts.eventIds || [],
    }),
  });
  const json = await res.json() as { ok?: boolean; error?: string };
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
}

export async function resetAnalyticsData(token: string): Promise<void> {
  const res = await fetch(analyticsUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'reset' }),
  });
  const json = await res.json() as { ok?: boolean; error?: string };
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
}
