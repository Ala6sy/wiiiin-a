import { useCallback, useEffect, useState } from 'react';
import { fetchAnalyticsStats, resetAnalyticsData, type AnalyticsStats, type VisitorRow } from './analytics';
import { getApiToken } from './appData';

function StatCard({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: string }) {
  return (
    <div className="analytics-stat-card" style={{ borderInlineStartColor: accent || '#0af' }}>
      <div className="analytics-stat-label">{label}</div>
      <div className="analytics-stat-value">{value}</div>
      {sub && <div className="analytics-stat-sub">{sub}</div>}
    </div>
  );
}

function parseCoord(v: string | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function googleMapsLink(v: VisitorRow): string | null {
  const lat = parseCoord(v.lat);
  const lon = parseCoord(v.lon);
  if (lat == null || lon == null) return null;
  return `https://www.google.com/maps?q=${lat},${lon}&z=14`;
}

function osmLink(v: VisitorRow): string | null {
  const lat = parseCoord(v.lat);
  const lon = parseCoord(v.lon);
  if (lat == null || lon == null) return null;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=13/${lat}/${lon}`;
}

function formatCityCountry(v: { city?: string | null; country?: string | null }): string {
  const parts: string[] = [];
  if (v.city?.trim()) parts.push(v.city.trim());
  if (v.country?.trim()) parts.push(v.country.trim());
  return parts.join(' · ') || '—';
}

function formatCoords(v: VisitorRow): string | null {
  const lat = parseCoord(v.lat);
  const lon = parseCoord(v.lon);
  if (lat == null || lon == null) return null;
  return `${lat.toFixed(5)}°, ${lon.toFixed(5)}°`;
}

function LocationCell({ v, ar }: { v: VisitorRow; ar: boolean }) {
  const place = formatCityCountry(v);
  const isGps = v.geoSource === 'gps';
  const gMap = isGps ? googleMapsLink(v) : null;
  const oMap = isGps ? osmLink(v) : null;
  const coords = isGps ? formatCoords(v) : null;

  return (
    <td className="analytics-location-cell">
      <div className="analytics-location-main">{place}</div>
      {isGps && (
        <>
          <div className="analytics-location-gps" style={{ color: '#7dffb0', fontWeight: 700, fontSize: 11, marginTop: 4 }}>
            {ar ? '📍 موقع GPS دقيق (موافقة الزائر)' : 'GPS (user consent)'}
          </div>
          {coords && <div className="analytics-location-coords cv-ltr">{coords}</div>}
          {(gMap || oMap) && (
            <div className="analytics-map-btns">
              {gMap && (
                <a href={gMap} target="_blank" rel="noreferrer" className="analytics-map-link" title={ar ? 'فتح على خرائط Google' : 'Open in Google Maps'}>
                  <i className="fa-solid fa-location-dot" /> Maps
                </a>
              )}
              {oMap && (
                <a href={oMap} target="_blank" rel="noreferrer" className="analytics-map-link analytics-map-link--osm" title="OpenStreetMap">
                  <i className="fa-solid fa-map" /> OSM
                </a>
              )}
            </div>
          )}
        </>
      )}
    </td>
  );
}

function EventLocationCell({ e, ar }: { e: { geoSource?: string | null; city?: string | null; country?: string | null; lat?: string | null; lon?: string | null }; ar: boolean }) {
  const place = formatCityCountry(e);
  const isGps = e.geoSource === 'gps';
  const lat = parseCoord(e.lat);
  const lon = parseCoord(e.lon);
  const coords = isGps && lat != null && lon != null ? `${lat.toFixed(5)}°, ${lon.toFixed(5)}°` : null;
  const gMap = isGps && lat != null && lon != null ? `https://www.google.com/maps?q=${lat},${lon}&z=14` : null;

  return (
    <td className="analytics-location-cell">
      <div className="analytics-location-main">{place}</div>
      {isGps && (
        <>
          <div className="analytics-location-gps" style={{ color: '#7dffb0', fontWeight: 700, fontSize: 11, marginTop: 4 }}>
            {ar ? '📍 GPS' : 'GPS'}
          </div>
          {coords && <div className="analytics-location-coords cv-ltr">{coords}</div>}
          {gMap && (
            <a href={gMap} target="_blank" rel="noreferrer" className="analytics-map-link" style={{ fontSize: 11 }}>
              <i className="fa-solid fa-location-dot" /> Maps
            </a>
          )}
        </>
      )}
    </td>
  );
}

type AnalyticsView = 'summary' | 'online' | 'today' | 'countries' | 'visitors' | 'downloads' | 'activity';

const VIEW_TABS: { id: AnalyticsView; ar: string; en: string; de: string; icon: string }[] = [
  { id: 'summary', ar: 'ملخص', en: 'Summary', de: 'Übersicht', icon: 'fa-chart-pie' },
  { id: 'online', ar: 'المتواجدون الآن', en: 'Online now', de: 'Online', icon: 'fa-circle' },
  { id: 'today', ar: 'اليوم', en: 'Today', de: 'Heute', icon: 'fa-calendar-day' },
  { id: 'countries', ar: 'حسب البلد', en: 'By country', de: 'Nach Land', icon: 'fa-earth-americas' },
  { id: 'visitors', ar: 'آخر الزوار', en: 'Recent', de: 'Besucher', icon: 'fa-users' },
  { id: 'downloads', ar: 'التنزيلات', en: 'Downloads', de: 'Downloads', icon: 'fa-download' },
  { id: 'activity', ar: 'النشاطات', en: 'Activity', de: 'Aktivität', icon: 'fa-clock-rotate-left' },
];

function eventLabel(type: string, ar: boolean) {
  if (type === 'cv_download') return ar ? 'تنزيل سيرة' : 'CV download';
  if (type === 'file_download') return ar ? 'تنزيل ملف' : 'File download';
  return ar ? 'مشاهدة صفحة' : 'Page view';
}

export function AnalyticsDashboard({ lang }: { lang: 'ar' | 'en' | 'de' }) {
  const ar = lang === 'ar';
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [view, setView] = useState<AnalyticsView>('summary');
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    const token = getApiToken();
    if (!token) {
      setErr(ar ? 'سجّل الدخول للخادم أولاً (إعدادات الموقع → اتصال MySQL)' : 'Connect to server first (Site Settings → MySQL)');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const data = await fetchAnalyticsStats(token);
      setStats(data);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [ar]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  async function handleReset() {
    const token = getApiToken();
    if (!token) return;
    const ok = window.confirm(
      ar
        ? 'حذف كل بيانات الإحصائيات (الزوار، المواقع، التنزيلات)؟ لا يمكن التراجع.'
        : lang === 'de'
          ? 'Alle Statistikdaten löschen? Nicht rückgängig.'
          : 'Delete all analytics data? This cannot be undone.',
    );
    if (!ok) return;
    setResetting(true);
    try {
      await resetAnalyticsData(token);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setResetting(false);
    }
  }

  if (loading && !stats) {
    return <p className="analytics-dashboard analytics-muted" style={{ textAlign: 'center', padding: 30 }}><i className="fa-solid fa-spinner fa-spin" /> {ar ? 'جاري التحميل...' : 'Loading...'}</p>;
  }

  if (err && !stats) {
    return (
      <div className="analytics-dashboard" style={{ textAlign: 'center', padding: 30 }}>
        <p style={{ color: '#ffb4b4', marginBottom: 12 }}><i className="fa-solid fa-triangle-exclamation" /> {err}</p>
        <button className="btn-outline-sm" onClick={load}>{ar ? 'إعادة المحاولة' : 'Retry'}</button>
      </div>
    );
  }

  const t = stats?.totals;
  const d = stats?.today;

  return (
    <div className="analytics-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h4 style={{ margin: 0 }}>
            <i className="fa-solid fa-chart-line" style={{ color: '#5ec8ff', marginInlineEnd: 8 }} />
            {ar ? 'إحصائيات الزوار' : lang === 'de' ? 'Besucherstatistik' : 'Visitor Analytics'}
          </h4>
          <p className="analytics-muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
            {ar ? `منذ ${stats?.since || '—'} — يُحدَّث كل دقيقة` : `Since ${stats?.since || '—'} — refreshes every minute`}
          </p>
          <p className="analytics-hint" style={{ margin: '8px 0 0', fontSize: 11, maxWidth: 560, lineHeight: 1.5 }}>
            {ar
              ? '📍 يُعرض: المدينة · البلد — وGPS الدقيق عند موافقة الزائر. المناطق المجاورة ومزود الإنترنت وغيرها مخفية.'
              : lang === 'de'
                ? '📍 Stadt · Land — GPS nur bei Zustimmung. Weitere Details ausgeblendet.'
                : '📍 City · country — GPS when visitor consents. Region, ISP, etc. hidden.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-outline-sm" onClick={load} disabled={loading || resetting}>
            <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-rotate'}`} /> {ar ? 'تحديث' : 'Refresh'}
          </button>
          <button
            type="button"
            className="btn-outline-sm"
            style={{ borderColor: '#e57373', color: '#ffb4b4' }}
            onClick={handleReset}
            disabled={loading || resetting}
          >
            <i className={`fa-solid ${resetting ? 'fa-spinner fa-spin' : 'fa-trash'}`} />
            {ar ? 'حذف كل الإحصائيات' : lang === 'de' ? 'Alles löschen' : 'Clear all data'}
          </button>
        </div>
      </div>

      <div className="analytics-filter-tabs">
        {VIEW_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`analytics-filter-tab${view === tab.id ? ' active' : ''}`}
            onClick={() => setView(tab.id)}
          >
            <i className={`fa-solid ${tab.icon}`} />
            {ar ? tab.ar : lang === 'de' ? tab.de : tab.en}
          </button>
        ))}
      </div>

      {(view === 'summary' || view === 'today') && (
      <div style={{ marginTop: 18 }}>
        {view === 'summary' && (
        <>
        <div className="analytics-section-title">{ar ? 'الإجمالي منذ إنشاء الموقع' : lang === 'de' ? 'Gesamt seit Start' : 'All-time totals'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          <StatCard label={ar ? 'زوار فريدون' : 'Unique visitors'} value={t?.uniqueVisitors ?? 0} accent="#0af" />
          <StatCard label={ar ? 'مشاهدات الصفحات' : 'Page views'} value={t?.pageViews ?? 0} accent="#2a7a2a" />
          <StatCard label={ar ? 'تنزيل السيرة' : 'CV downloads'} value={t?.cvDownloads ?? 0} accent="#b388ff" />
          <StatCard label={ar ? 'تنزيل الملفات' : 'File downloads'} value={t?.fileDownloads ?? 0} accent="#ffb74d" />
          <StatCard
            label={ar ? 'متصلون الآن' : 'Online now'}
            value={t?.onlineNow ?? 0}
            sub={ar ? `آخر ${stats?.onlineMinutes || 5} دقائق` : `Last ${stats?.onlineMinutes || 5} min`}
            accent="#69f0ae"
          />
        </div>
        </>
        )}

        {(view === 'summary' || view === 'today') && (
        <div style={{ marginTop: view === 'summary' ? 18 : 0 }}>
        <div className="analytics-section-title analytics-section-title--today">{ar ? 'إجمالي اليوم' : lang === 'de' ? 'Heute' : 'Today'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
          <StatCard label={ar ? 'زوار اليوم' : 'Visitors today'} value={d?.uniqueVisitors ?? 0} accent="#f0a030" />
          <StatCard label={ar ? 'مشاهدات اليوم' : 'Views today'} value={d?.pageViews ?? 0} accent="#f0a030" />
          <StatCard label={ar ? 'سيرة اليوم' : 'CV today'} value={d?.cvDownloads ?? 0} accent="#f0a030" />
          <StatCard label={ar ? 'ملفات اليوم' : 'Files today'} value={d?.fileDownloads ?? 0} accent="#f0a030" />
        </div>
        </div>
        )}
      </div>
      )}

      {(view === 'summary' || view === 'online') && (stats?.onlineNow?.length ?? 0) > 0 && (
        <div style={{ marginTop: 18 }}>
          <h5 className="analytics-block-title">
            <i className="fa-solid fa-circle" style={{ color: '#69f0ae', fontSize: 10, marginInlineEnd: 6 }} />
            {ar ? 'المتواجدون حالياً' : 'Currently online'}
          </h5>
          <div className="analytics-table-wrap">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>IP</th>
                  <th>{ar ? 'المدينة / البلد' : 'City / country'}</th>
                  <th>{ar ? 'مشاهدات' : 'Views'}</th>
                </tr>
              </thead>
              <tbody>
                {stats!.onlineNow!.map(v => (
                  <tr key={v.sessionId}>
                    <td className="cv-ltr analytics-ip">{v.ip || '—'}</td>
                    <LocationCell v={v} ar={ar} />
                    <td>{v.pageViews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(view === 'summary' || view === 'countries') && (stats?.byCountry?.length ?? 0) > 0 && (
        <div style={{ marginTop: 18 }}>
          <h5 className="analytics-block-title"><i className="fa-solid fa-earth-americas" style={{ marginInlineEnd: 6 }} />{ar ? 'الزوار حسب البلد' : 'Visitors by country'}</h5>
          <div className="analytics-table-wrap">
            <table className="analytics-table">
              <thead><tr><th>{ar ? 'البلد' : 'Country'}</th><th>{ar ? 'عدد الزوار' : 'Visitors'}</th></tr></thead>
              <tbody>
                {stats!.byCountry!.map((c, i) => (
                  <tr key={i}>
                    <td>{c.country} {c.code ? `(${c.code})` : ''}</td>
                    <td><strong>{c.visitors}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(view === 'summary' || view === 'visitors') && (
        <div style={{ marginTop: 18 }}>
        <h5 className="analytics-block-title"><i className="fa-solid fa-users" style={{ marginInlineEnd: 6 }} />{ar ? 'آخر الزوار' : 'Recent visitors'}</h5>
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>IP</th>
                <th>{ar ? 'المدينة / البلد' : 'City / country'}</th>
                <th>{ar ? 'أول زيارة' : 'First'}</th>
                <th>{ar ? 'آخر نشاط' : 'Last'}</th>
                <th>{ar ? 'مشاهدات' : 'Views'}</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recentVisitors || []).map(v => (
                <tr key={v.sessionId}>
                  <td className="cv-ltr analytics-ip">{v.ip || '—'}</td>
                  <LocationCell v={v} ar={ar} />
                  <td className="analytics-time">{v.firstSeen?.slice(0, 16)}</td>
                  <td className="analytics-time">{v.lastSeen?.slice(0, 16)}</td>
                  <td>{v.pageViews}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}

      {(view === 'summary' || view === 'downloads') && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 18 }}>
        {(stats?.cvDownloads?.length ?? 0) > 0 && (
          <div>
            <h5 className="analytics-block-title"><i className="fa-solid fa-file-pdf" style={{ marginInlineEnd: 6 }} />{ar ? 'تنزيلات السيرة' : 'CV downloads'}</h5>
            <ul className="analytics-list">
              {stats!.cvDownloads!.map((r, i) => (
                <li key={i}><span>{r.label}</span><strong>{r.count}</strong></li>
              ))}
            </ul>
          </div>
        )}
        {(stats?.fileDownloads?.length ?? 0) > 0 && (
          <div>
            <h5 className="analytics-block-title"><i className="fa-solid fa-download" style={{ marginInlineEnd: 6 }} />{ar ? 'تنزيلات الملفات' : 'File downloads'}</h5>
            <ul className="analytics-list">
              {stats!.fileDownloads!.map((r, i) => (
                <li key={i}><span>{r.label}</span><strong>{r.count}</strong></li>
              ))}
            </ul>
          </div>
        )}
      </div>
      )}

      {(view === 'summary' || view === 'activity') && (stats?.recentEvents?.length ?? 0) > 0 && (
        <div style={{ marginTop: 18 }}>
          <h5 className="analytics-block-title"><i className="fa-solid fa-clock-rotate-left" style={{ marginInlineEnd: 6 }} />{ar ? 'آخر النشاطات' : 'Recent activity'}</h5>
          <div className="analytics-table-wrap">
            <table className="analytics-table">
              <thead>
                <tr><th>{ar ? 'النوع' : 'Type'}</th><th>{ar ? 'التفاصيل' : 'Details'}</th><th>IP</th><th>{ar ? 'المدينة / البلد' : 'City / country'}</th><th>{ar ? 'الوقت' : 'Time'}</th></tr>
              </thead>
              <tbody>
                {stats!.recentEvents!.map(e => (
                  <tr key={e.id}>
                    <td>{eventLabel(e.eventType, ar)}</td>
                    <td>{e.label || e.path || '—'}</td>
                    <td className="cv-ltr analytics-ip">{e.ip || '—'}</td>
                    <EventLocationCell e={e} ar={ar} />
                    <td className="analytics-time">{e.createdAt?.slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'online' && (stats?.onlineNow?.length ?? 0) === 0 && (
        <p className="analytics-muted" style={{ textAlign: 'center', padding: 24 }}>{ar ? 'لا يوجد زوار متصلون الآن' : 'No visitors online right now'}</p>
      )}

      {t?.uniqueVisitors === 0 && (
        <p className="analytics-muted" style={{ textAlign: 'center', padding: 20, fontSize: 13 }}>
          {ar ? 'لا توجد بيانات بعد — ستظهر عند زيارة الموقع من قبل الزوار بعد رفع analytics.php' : 'No data yet — visits will appear after deploying analytics.php'}
        </p>
      )}
    </div>
  );
}
