import type { LangKey } from './appData';
import { trackAnalytics } from './analytics';
import {
  EXTENDED_HARVEST,
  EXTENDED_PLANTS,
  WEATHER_PLANT_BOOST,
  type PlantEntry,
} from './seasonPlantsExtended';
import { PASTURE_FORESTRY } from './pastureForestryPlants';
import { formatWesternNum } from './formatLocale';

const LOC_KEY = '__visitor_gps__';
const LOC_DECISION_KEY = '__visitor_gps_decision__';

export interface VisitorPlaceParts {
  city?: string;
  region?: string;
  country?: string;
  displayName?: string;
}

export interface VisitorGpsLocation {
  lat: number;
  lon: number;
  city?: string;
  region?: string;
  country?: string;
  displayName?: string;
  /** أسماء المكان حسب لغة الواجهة — حتى لا تظهر عجمان بالعربية في تقرير EN/DE */
  labels?: Partial<Record<LangKey, VisitorPlaceParts>>;
  accuracy?: number;
  consent: true;
  at: number;
}

function hasArabicScript(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s);
}

function nominatimLang(lang: LangKey): string {
  if (lang === 'de') return 'de,en';
  if (lang === 'ar') return 'ar,en';
  return 'en';
}

export interface SeasonWeatherInput {
  temperature: number;
  humidity: number;
  windSpeed: number;
}

export function getStoredVisitorLocation(): VisitorGpsLocation | null {
  try {
    const raw = localStorage.getItem(LOC_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as VisitorGpsLocation;
    if (!o?.consent || typeof o.lat !== 'number' || typeof o.lon !== 'number') return null;
    return o;
  } catch {
    return null;
  }
}

export function clearStoredVisitorLocation() {
  try { localStorage.removeItem(LOC_KEY); } catch { /* */ }
}

export function getVisitorGpsDecision(): 'accepted' | 'declined' | null {
  try {
    const value = localStorage.getItem(LOC_DECISION_KEY);
    return value === 'accepted' || value === 'declined' ? value : null;
  } catch {
    return null;
  }
}

export function saveVisitorGpsDecision(value: 'accepted' | 'declined') {
  try { localStorage.setItem(LOC_DECISION_KEY, value); } catch { /* */ }
}

export function clearVisitorGpsDecision() {
  try { localStorage.removeItem(LOC_DECISION_KEY); } catch { /* */ }
}

async function reverseGeocode(lat: number, lon: number, lang: LangKey = 'ar'): Promise<VisitorPlaceParts> {
  try {
    const accept = nominatimLang(lang);
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=${encodeURIComponent(accept)}`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': accept, 'User-Agent': 'eng-alaa.com/1.0' },
    });
    if (!res.ok) return {};
    const j = await res.json() as {
      display_name?: string;
      address?: { city?: string; town?: string; village?: string; state?: string; country?: string };
    };
    const a = j.address || {};
    const city = a.city || a.town || a.village || a.state || '';
    return {
      city,
      region: a.state,
      country: a.country,
      displayName: j.display_name,
    };
  } catch {
    return {};
  }
}

function persistLocation(loc: VisitorGpsLocation): void {
  try { localStorage.setItem(LOC_KEY, JSON.stringify(loc)); } catch { /* */ }
}

/** يجلب اسم المنطقة بلغة الواجهة إن لم يكن محفوظاً (للمواقع القديمة المخزّنة بالعربية فقط) */
export async function ensureLocationInLang(
  loc: VisitorGpsLocation,
  lang: LangKey,
): Promise<VisitorGpsLocation> {
  const existing = loc.labels?.[lang];
  if (existing?.city || existing?.region || existing?.country) return loc;

  if (lang === 'ar' && (loc.city || loc.region || loc.country)) {
    const next: VisitorGpsLocation = {
      ...loc,
      labels: {
        ...loc.labels,
        ar: {
          city: loc.city,
          region: loc.region,
          country: loc.country,
          displayName: loc.displayName,
        },
      },
    };
    persistLocation(next);
    return next;
  }

  const geo = await reverseGeocode(loc.lat, loc.lon, lang);
  if (!geo.city && !geo.region && !geo.country) return loc;

  const next: VisitorGpsLocation = {
    ...loc,
    labels: {
      ...loc.labels,
      [lang]: geo,
    },
  };
  if (lang === 'ar') {
    next.city = geo.city || loc.city;
    next.region = geo.region || loc.region;
    next.country = geo.country || loc.country;
    next.displayName = geo.displayName || loc.displayName;
  }
  persistLocation(next);
  return next;
}

async function saveLocation(lat: number, lon: number, accuracy?: number): Promise<VisitorGpsLocation> {
  const [ar, en, de] = await Promise.all([
    reverseGeocode(lat, lon, 'ar'),
    reverseGeocode(lat, lon, 'en'),
    reverseGeocode(lat, lon, 'de'),
  ]);
  const loc: VisitorGpsLocation = {
    lat,
    lon,
    city: ar.city || en.city,
    region: ar.region || en.region,
    country: ar.country || en.country,
    displayName: ar.displayName || en.displayName,
    labels: { ar, en, de },
    accuracy,
    consent: true,
    at: Date.now(),
  };
  persistLocation(loc);
  saveVisitorGpsDecision('accepted');
  trackAnalytics('heartbeat', {
    path: 'gps_location',
    label: loc.displayName || `${lat},${lon}`,
    meta: {
      gps: true, lat, lon,
      city: loc.city, region: loc.region, country: loc.country,
      ...(accuracy != null && Number.isFinite(accuracy) ? { accuracy } : {}),
    },
  });
  return loc;
}

const GEO_OPTS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 18000,
  maximumAge: 0,
};

/** يطلب موقع GPS دقيق — أسرع عبر watchPosition ثم إيقافه عند أول إحداثيات جيدة */
export function requestVisitorLocation(): Promise<VisitorGpsLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('المتصفح لا يدعم تحديد الموقع'));
      return;
    }

    let settled = false;
    let watchId: number | null = null;
    const started = Date.now();

    const finish = async (pos: GeolocationPosition) => {
      if (settled) return;
      const acc = pos.coords.accuracy;
      const elapsed = Date.now() - started;
      const goodEnough = acc <= 120 || elapsed >= 8000;
      if (!goodEnough) return;

      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      try {
        resolve(await saveLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy));
      } catch (e) {
        reject(e);
      }
    };

    const onError = (err: GeolocationPositionError) => {
      if (settled) return;
      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      reject(new Error(err.code === 1 ? 'denied' : err.code === 2 ? 'unavailable' : 'timeout'));
    };

    watchId = navigator.geolocation.watchPosition(finish, onError, GEO_OPTS);

    navigator.geolocation.getCurrentPosition(finish, () => { /* watchPosition يتولى */ }, {
      ...GEO_OPTS,
      maximumAge: 60000,
      timeout: 4000,
    });

    setTimeout(() => {
      if (settled) return;
      navigator.geolocation.getCurrentPosition(
        finish,
        onError,
        { ...GEO_OPTS, timeout: 12000 },
      );
    }, 9000);
  });
}

export type ClimateZone = 'tropical' | 'subtropical' | 'mediterranean' | 'arid' | 'temperate' | 'cold';

export function climateZoneFromLat(lat: number): ClimateZone {
  const a = Math.abs(lat);
  if (a < 15) return 'tropical';
  if (a < 25) return 'subtropical';
  if (a < 32) return 'arid';
  if (a < 40) return 'mediterranean';
  if (a < 50) return 'temperate';
  return 'cold';
}

type Season = 'spring' | 'summer' | 'autumn' | 'winter';

function seasonForLat(lat: number, month: number): Season {
  const north = lat >= 0;
  const m = month;
  if (north) {
    if (m >= 3 && m <= 5) return 'spring';
    if (m >= 6 && m <= 8) return 'summer';
    if (m >= 9 && m <= 11) return 'autumn';
    return 'winter';
  }
  if (m >= 9 || m <= 11) return 'spring';
  if (m === 12 || m <= 2) return 'summer';
  if (m >= 3 && m <= 5) return 'autumn';
  return 'winter';
}

function seasonContext(loc: VisitorGpsLocation) {
  const zone = climateZoneFromLat(loc.lat);
  const month = new Date().getMonth() + 1;
  const season = seasonForLat(loc.lat, month);
  return { zone, season };
}

function dedupePlants(list: PlantEntry[]): PlantEntry[] {
  const seen = new Set<string>();
  const out: PlantEntry[] = [];
  for (const p of list) {
    const key = p.ar || p.en;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function weatherBoostPlants(weather?: SeasonWeatherInput): PlantEntry[] {
  if (!weather) return [];
  const extra: PlantEntry[] = [];
  const { temperature: t, humidity: h, windSpeed: w } = weather;

  if (t >= 32) extra.push(WEATHER_PLANT_BOOST.veryHot, WEATHER_PLANT_BOOST.hot, WEATHER_PLANT_BOOST.dry);
  else if (t >= 26) extra.push(WEATHER_PLANT_BOOST.hot, WEATHER_PLANT_BOOST.mild);
  else if (t >= 18) extra.push(WEATHER_PLANT_BOOST.mild);
  else if (t >= 10) extra.push(WEATHER_PLANT_BOOST.cool);
  else extra.push(WEATHER_PLANT_BOOST.cold);

  if (h >= 65) extra.push(WEATHER_PLANT_BOOST.humid);
  if (h <= 35) extra.push(WEATHER_PLANT_BOOST.dry);
  if (w >= 20) extra.push(WEATHER_PLANT_BOOST.windy);

  return extra;
}

function filterPlantsByWeather(list: PlantEntry[], weather?: SeasonWeatherInput): PlantEntry[] {
  if (!weather) return list;
  const t = weather.temperature;
  const coldSensitive = ['بطيخ', 'Watermelon', 'مانجو', 'Mango', 'موز', 'Banana'];
  const heatSensitive = ['سبانخ', 'Spinach', 'خس', 'Lettuce', 'بروكلي', 'Broccoli'];

  return list.filter(p => {
    const key = p.ar || p.en;
    if (t >= 30 && heatSensitive.some(s => key.includes(s))) return false;
    if (t <= 8 && coldSensitive.some(s => key.includes(s))) return false;
    return true;
  });
}

export function plantsForVisitorLocation(
  loc: VisitorGpsLocation,
  _lang: LangKey,
  weather?: SeasonWeatherInput,
): PlantEntry[] {
  const { zone, season } = seasonContext(loc);
  const base = EXTENDED_PLANTS[zone]?.[season] || EXTENDED_PLANTS.mediterranean[season];
  const pasture = PASTURE_FORESTRY[zone]?.[season] || PASTURE_FORESTRY.mediterranean[season] || [];
  const merged = dedupePlants([...base, ...pasture, ...weatherBoostPlants(weather)]);
  return filterPlantsByWeather(merged, weather);
}

export function harvestForVisitorLocation(
  loc: VisitorGpsLocation,
  _lang: LangKey,
  weather?: SeasonWeatherInput,
): PlantEntry[] {
  const { zone, season } = seasonContext(loc);
  const base = EXTENDED_HARVEST[zone]?.[season] || EXTENDED_HARVEST.mediterranean[season];
  const pasture = PASTURE_FORESTRY[zone]?.[season] || PASTURE_FORESTRY.mediterranean[season] || [];
  const merged = dedupePlants([...base, ...pasture, ...weatherBoostPlants(weather)]);
  return filterPlantsByWeather(merged, weather);
}

export function seasonGuideText(
  loc: VisitorGpsLocation,
  _plantNow: PlantEntry[],
  _harvestNow: PlantEntry[],
  lang: LangKey,
  weather?: SeasonWeatherInput,
): string {
  const region = locationLabel(loc, lang);
  const weatherLine = weather
    ? (lang === 'ar'
      ? `الطقس الآن: ${formatWesternNum(weather.temperature)}°م، رطوبة ${formatWesternNum(weather.humidity, 0)}%، رياح ${formatWesternNum(weather.windSpeed)} كم/س.`
      : lang === 'de'
        ? `Wetter: ${weather.temperature.toFixed(1)}°C, ${Math.round(weather.humidity)}% Feuchte, Wind ${Math.round(weather.windSpeed)} km/h.`
        : `Weather: ${weather.temperature.toFixed(1)}°C, ${Math.round(weather.humidity)}% humidity, wind ${Math.round(weather.windSpeed)} km/h.`)
    : '';

  if (lang === 'ar') {
    return `منطقة ${region}.\n${weatherLine ? weatherLine + '\n' : ''}`
      + 'راجع الجداول أعلاه للنباتات المقترحة حسب التصنيف.\n'
      + '• ازرع في ساعات الصباح الباكر.\n'
      + '• رُش الماء على الجذور لا الأوراق.\n'
      + '• تحقق من رطوبة التربة قبل الري.\n'
      + '• بعض النباتات قد تكون مقيدة قانونياً — تحقق من القوانين المحلية.';
  }
  if (lang === 'de') {
    return `Region: ${region}.\n${weatherLine ? weatherLine + '\n' : ''}`
      + 'Siehe Tabellen oben nach Kategorie.\n'
      + '• Morgens pflanzen.\n'
      + '• Wurzeln bewässern, nicht Blätter.\n'
      + '• Bodenfeuchte prüfen.\n'
      + '• Einige Pflanzen können rechtlich eingeschränkt sein.';
  }
  return `Region: ${region}.\n${weatherLine ? weatherLine + '\n' : ''}`
    + 'See tables above by category.\n'
    + '• Plant in early morning.\n'
    + '• Water roots, not leaves.\n'
    + '• Check soil moisture before watering.\n'
    + '• Some plants may be legally restricted — check local regulations.';
}

export function locationLabel(loc: VisitorGpsLocation, lang: LangKey): string {
  const L = loc.labels?.[lang];
  let parts = [L?.city, L?.region, L?.country].filter(Boolean) as string[];

  if (!parts.length && lang === 'ar') {
    parts = [loc.city, loc.region, loc.country].filter(Boolean) as string[];
  }

  /* لا نعرض أسماء عربية داخل تقرير/واجهة إنجليزي أو ألماني */
  if (!parts.length && lang !== 'ar') {
    const raw = [loc.city, loc.region, loc.country].filter(Boolean) as string[];
    if (raw.length && !raw.some(hasArabicScript)) parts = raw;
  }

  if (parts.length) return parts.join(' · ');
  return `${loc.lat.toFixed(4)}°, ${loc.lon.toFixed(4)}°`;
}

export type { PlantEntry };
