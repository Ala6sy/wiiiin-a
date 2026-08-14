import { useCallback, useEffect, useState } from 'react';
import { deleteAnalyticsItems, fetchAnalyticsStats, resetAnalyticsData, type AnalyticsStats, type PeriodReport, type VisitorRow } from './analytics';
import { AnalyticsGpsMap } from './AnalyticsGpsMap';
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

function formatDuration(value: string | number | null | undefined, ar: boolean): string {
  const seconds = Math.max(0, Math.round(Number(value) || 0));
  if (seconds < 60) return `${seconds} ${ar ? 'ث' : 's'}`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return `${minutes}:${String(rest).padStart(2, '0')} ${ar ? 'د' : 'min'}`;
  const hours = Math.floor(minutes / 60);
  return `${hours}:${String(minutes % 60).padStart(2, '0')} ${ar ? 'س' : 'h'}`;
}

function DeviceCell({ v }: { v: Pick<VisitorRow, 'deviceType' | 'deviceName' | 'browser' | 'os' | 'screenSize'> }) {
  const icon = v.deviceType === 'mobile' ? 'fa-mobile-screen' : v.deviceType === 'tablet' ? 'fa-tablet-screen-button' : 'fa-desktop';
  return (
    <td>
      <div style={{ fontWeight: 700 }}><i className={`fa-solid ${icon}`} /> {v.deviceName || v.deviceType || '—'}</div>
      <div className="analytics-muted" style={{ fontSize: 10 }}>
        {[v.os, v.browser, v.screenSize].filter(Boolean).join(' · ')}
      </div>
    </td>
  );
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

type AnalyticsView = 'summary' | 'online' | 'today' | 'countries' | 'visitors' | 'downloads' | 'activity' | 'gps' | 'gpsmap' | 'reports';

const VIEW_TABS: { id: AnalyticsView; ar: string; en: string; de: string; icon: string }[] = [
  { id: 'summary', ar: 'ملخص', en: 'Summary', de: 'Übersicht', icon: 'fa-chart-pie' },
  { id: 'reports', ar: 'تقارير', en: 'Reports', de: 'Berichte', icon: 'fa-calendar-days' },
  { id: 'gpsmap', ar: 'خريطة GPS', en: 'GPS Map', de: 'GPS-Karte', icon: 'fa-map-location-dot' },
  { id: 'gps', ar: 'GPS دقيق', en: 'GPS', de: 'GPS', icon: 'fa-location-crosshairs' },
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
  if (type === 'page_duration') return ar ? 'مدة صفحة' : 'Page duration';
  return ar ? 'مشاهدة صفحة' : 'Page view';
}

function RowDeleteBtn({ onClick, disabled, title }: { onClick: () => void; disabled?: boolean; title: string }) {
  return (
    <button type="button" className="analytics-row-del" onClick={onClick} disabled={disabled} title={title} aria-label={title}>
      <i className="fa-solid fa-trash" />
    </button>
  );
}

function SelCheckbox({ checked, onChange, aria }: { checked: boolean; onChange: () => void; aria: string }) {
  return (
    <input type="checkbox" className="analytics-sel-cb" checked={checked} onChange={onChange} aria-label={aria} />
  );
}

function PeriodReportSection({ title, report, ar, lang }: { title: string; report?: PeriodReport; ar: boolean; lang: 'ar' | 'en' | 'de' }) {
  if (!report) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <h5 className="analytics-block-title">{title} <span className="analytics-muted" style={{ fontWeight: 600 }}>({report.label})</span></h5>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
        <StatCard label={ar ? 'زوار' : lang === 'de' ? 'Besucher' : 'Visitors'} value={report.visitors} accent="#0af" />
        <StatCard label={ar ? 'تنزيل سيرة' : 'CV downloads'} value={report.cvDownloads} accent="#b388ff" />
        <StatCard label={ar ? 'GPS دقيق' : 'GPS consent'} value={report.gpsVisitors} accent="#7dffb0" />
        <StatCard label={ar ? 'سيرة + GPS' : 'CV + GPS'} value={report.cvDownloadsWithGps} accent="#69f0ae" />
      </div>
    </div>
  );
}

export function AnalyticsDashboard({ lang }: { lang: 'ar' | 'en' | 'de' }) {
  const ar = lang === 'ar';
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [view, setView] = useState<AnalyticsView>('summary');
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());

  const selCount = selectedSessions.size + selectedEvents.size;

  const toggleSession = (id: string) => {
    setSelectedSessions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleEvent = (id: string) => {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllSessions = (ids: string[], on: boolean) => {
    setSelectedSessions(prev => {
      const next = new Set(prev);
      ids.forEach(id => { if (on) next.add(id); else next.delete(id); });
      return next;
    });
  };

  const toggleAllEvents = (ids: string[], on: boolean) => {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      ids.forEach(id => { if (on) next.add(id); else next.delete(id); });
      return next;
    });
  };

  const confirmDelete = async (sessionIds: string[], eventIds: string[]) => {
    const token = getApiToken();
    if (!token || (!sessionIds.length && !eventIds.length)) return;
    const n = sessionIds.length + eventIds.length;
    const ok = window.confirm(
      ar
        ? `حذف ${n} عنصر من الإحصائيات؟ لا يمكن التراجع.`
        : lang === 'de'
          ? `${n} Eintrag/Einträge löschen? Nicht rückgängig.`
          : `Delete ${n} item(s)? This cannot be undone.`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteAnalyticsItems(token, { sessionIds, eventIds });
      setSelectedSessions(new Set());
      setSelectedEvents(new Set());
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setDeleting(false);
    }
  };

  const delTitle = ar ? 'حذف' : lang === 'de' ? 'Löschen' : 'Delete';
  const selTitle = ar ? 'تحديد' : 'Select';

  const sessionTableExtras = (sessionId: string) => (
    <>
      <td className="analytics-sel-col">
        <SelCheckbox checked={selectedSessions.has(sessionId)} onChange={() => toggleSession(sessionId)} aria={selTitle} />
      </td>
      <td className="analytics-del-col">
        <RowDeleteBtn onClick={() => confirmDelete([sessionId], [])} disabled={deleting || resetting} title={delTitle} />
      </td>
    </>
  );

  const eventTableExtras = (eventId: string) => (
    <>
      <td className="analytics-sel-col">
        <SelCheckbox checked={selectedEvents.has(eventId)} onChange={() => toggleEvent(eventId)} aria={selTitle} />
      </td>
      <td className="analytics-del-col">
        <RowDeleteBtn
          onClick={() => confirmDelete([], [eventId])}
          disabled={deleting || resetting}
          title={delTitle}
        />
      </td>
    </>
  );

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

      {selCount > 0 && (
        <div className="analytics-sel-bar">
          <span>{ar ? `محدد: ${selCount}` : lang === 'de' ? `Ausgewählt: ${selCount}` : `Selected: ${selCount}`}</span>
          <button
            type="button"
            className="btn-outline-sm"
            style={{ borderColor: '#e57373', color: '#ffb4b4' }}
            disabled={deleting || resetting}
            onClick={() => confirmDelete([...selectedSessions], [...selectedEvents])}
          >
            <i className={`fa-solid ${deleting ? 'fa-spinner fa-spin' : 'fa-trash'}`} />
            {ar ? 'حذف المحدد' : lang === 'de' ? 'Auswahl löschen' : 'Delete selected'}
          </button>
          <button
            type="button"
            className="btn-outline-sm"
            onClick={() => { setSelectedSessions(new Set()); setSelectedEvents(new Set()); }}
            disabled={deleting}
          >
            {ar ? 'إلغاء التحديد' : lang === 'de' ? 'Auswahl aufheben' : 'Clear selection'}
          </button>
        </div>
      )}

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
                  <th className="analytics-sel-col">
                    <SelCheckbox
                      checked={(stats!.onlineNow || []).length > 0 && stats!.onlineNow!.every(v => selectedSessions.has(v.sessionId))}
                      onChange={() => {
                        const ids = stats!.onlineNow!.map(v => v.sessionId);
                        const allOn = ids.every(id => selectedSessions.has(id));
                        toggleAllSessions(ids, !allOn);
                      }}
                      aria={ar ? 'تحديد الكل' : 'Select all'}
                    />
                  </th>
                  <th className="analytics-del-col">{ar ? 'حذف' : 'Del'}</th>
                  <th>IP</th>
                  <th>{ar ? 'المدينة / البلد' : 'City / country'}</th>
                  <th>{ar ? 'الرابط الحالي' : 'Current URL'}</th>
                  <th>{ar ? 'المدة الحالية' : 'Current time'}</th>
                  <th>{ar ? 'الجهاز' : 'Device'}</th>
                  <th>{ar ? 'مشاهدات' : 'Views'}</th>
                </tr>
              </thead>
              <tbody>
                {stats!.onlineNow!.map(v => (
                  <tr key={v.sessionId}>
                    {sessionTableExtras(v.sessionId)}
                    <td className="cv-ltr analytics-ip">{v.ip || '—'}</td>
                    <LocationCell v={v} ar={ar} />
                    <td className="cv-ltr" style={{ maxWidth: 240, wordBreak: 'break-all' }}>{v.currentPath || '—'}</td>
                    <td>{formatDuration(v.currentPageSeconds, ar)}</td>
                    <DeviceCell v={v} />
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
                <th className="analytics-sel-col">
                  <SelCheckbox
                    checked={(stats?.recentVisitors || []).length > 0 && (stats?.recentVisitors || []).every(v => selectedSessions.has(v.sessionId))}
                    onChange={() => {
                      const ids = (stats?.recentVisitors || []).map(v => v.sessionId);
                      const allOn = ids.every(id => selectedSessions.has(id));
                      toggleAllSessions(ids, !allOn);
                    }}
                    aria={ar ? 'تحديد الكل' : 'Select all'}
                  />
                </th>
                <th className="analytics-del-col">{ar ? 'حذف' : 'Del'}</th>
                <th>IP</th>
                <th>{ar ? 'المدينة / البلد' : 'City / country'}</th>
                <th>{ar ? 'أول زيارة' : 'First'}</th>
                <th>{ar ? 'آخر نشاط' : 'Last'}</th>
                <th>{ar ? 'آخر رابط' : 'Last URL'}</th>
                <th>{ar ? 'الجهاز' : 'Device'}</th>
                <th>{ar ? 'مشاهدات' : 'Views'}</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.recentVisitors || []).map(v => (
                <tr key={v.sessionId}>
                  {sessionTableExtras(v.sessionId)}
                  <td className="cv-ltr analytics-ip">{v.ip || '—'}</td>
                  <LocationCell v={v} ar={ar} />
                  <td className="analytics-time">{v.firstSeen?.slice(0, 16)}</td>
                  <td className="analytics-time">{v.lastSeen?.slice(0, 16)}</td>
                  <td className="cv-ltr" style={{ maxWidth: 220, wordBreak: 'break-all' }}>{v.currentPath || '—'}</td>
                  <DeviceCell v={v} />
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
                <tr>
                  <th className="analytics-sel-col">
                    <SelCheckbox
                      checked={(stats!.recentEvents || []).length > 0 && stats!.recentEvents!.every(e => selectedEvents.has(e.id))}
                      onChange={() => {
                        const ids = stats!.recentEvents!.map(e => e.id);
                        const allOn = ids.every(id => selectedEvents.has(id));
                        toggleAllEvents(ids, !allOn);
                      }}
                      aria={ar ? 'تحديد الكل' : 'Select all'}
                    />
                  </th>
                  <th className="analytics-del-col">{ar ? 'حذف' : 'Del'}</th>
                  <th>{ar ? 'النوع' : 'Type'}</th><th>{ar ? 'الرابط / التفاصيل' : 'URL / details'}</th><th>{ar ? 'المدة' : 'Duration'}</th><th>{ar ? 'الجهاز' : 'Device'}</th><th>IP</th><th>{ar ? 'المدينة / البلد' : 'City / country'}</th><th>{ar ? 'الوقت' : 'Time'}</th>
                </tr>
              </thead>
              <tbody>
                {stats!.recentEvents!.map(e => (
                  <tr key={e.id}>
                    {eventTableExtras(e.id)}
                    <td>{eventLabel(e.eventType, ar)}</td>
                    <td className="cv-ltr" style={{ maxWidth: 260, wordBreak: 'break-all' }}>{e.path || e.label || '—'}</td>
                    <td>{e.durationSeconds != null ? formatDuration(e.durationSeconds, ar) : '—'}</td>
                    <DeviceCell v={e} />
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

      {view === 'reports' && (
        <div style={{ marginTop: 18 }}>
          <PeriodReportSection title={ar ? 'تقرير اليوم' : lang === 'de' ? 'Heute' : 'Today'} report={stats?.periodReports?.day} ar={ar} lang={lang} />
          <PeriodReportSection title={ar ? 'تقرير الشهر الحالي' : lang === 'de' ? 'Dieser Monat' : 'This month'} report={stats?.periodReports?.month} ar={ar} lang={lang} />
          <PeriodReportSection title={ar ? 'تقرير السنة الحالية' : lang === 'de' ? 'Dieses Jahr' : 'This year'} report={stats?.periodReports?.year} ar={ar} lang={lang} />

          {(stats?.cvDownloadsDetail?.length ?? 0) > 0 && (
            <div style={{ marginTop: 8 }}>
              <h5 className="analytics-block-title">
                <i className="fa-solid fa-file-pdf" style={{ marginInlineEnd: 6 }} />
                {ar ? 'تنزيلات السيرة مع الموقع' : 'CV downloads with location'}
              </h5>
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th className="analytics-sel-col">
                        <SelCheckbox
                          checked={stats!.cvDownloadsDetail!.length > 0 && stats!.cvDownloadsDetail!.every(r => selectedEvents.has(r.id))}
                          onChange={() => {
                            const ids = stats!.cvDownloadsDetail!.map(r => r.id);
                            const allOn = ids.every(id => selectedEvents.has(id));
                            toggleAllEvents(ids, !allOn);
                          }}
                          aria={ar ? 'تحديد الكل' : 'Select all'}
                        />
                      </th>
                      <th className="analytics-del-col">{ar ? 'حذف' : 'Del'}</th>
                      <th>{ar ? 'السيرة' : 'CV'}</th>
                      <th>IP</th>
                      <th>{ar ? 'الموقع' : 'Location'}</th>
                      <th>{ar ? 'الوقت' : 'Time'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats!.cvDownloadsDetail!.map(row => (
                      <tr key={row.id}>
                        {eventTableExtras(row.id)}
                        <td>{row.label || row.path || '—'}</td>
                        <td className="cv-ltr analytics-ip">{row.ip || '—'}</td>
                        <EventLocationCell e={{
                          geoSource: row.geoSource,
                          city: row.city,
                          country: row.country,
                          lat: row.lat != null ? String(row.lat) : null,
                          lon: row.lon != null ? String(row.lon) : null,
                        }} ar={ar} />
                        <td className="analytics-time">{row.createdAt?.slice(0, 16)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'gpsmap' && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <h5 className="analytics-block-title" style={{ margin: 0 }}>
              <i className="fa-solid fa-map-location-dot" style={{ marginInlineEnd: 6, color: '#7dffb0' }} />
              {ar ? 'خريطة العالم — مواقع GPS الدقيقة' : 'World map — precise GPS'}
            </h5>
            <button type="button" className="btn-outline-sm" onClick={() => setView('gps')}>
              <i className="fa-solid fa-table" /> {ar ? 'جدول GPS' : 'GPS table'}
            </button>
          </div>
          <p className="analytics-hint" style={{ marginBottom: 12, fontSize: 11 }}>
            {ar
              ? 'الدبابيس الخضراء فقط للزوار الذين وافقوا صراحةً على GPS — لا تُعرض مواقع IP التقريبية.'
              : 'Green pins are consent-based GPS only — IP estimates are excluded.'}
          </p>
          <AnalyticsGpsMap
            visitors={(stats?.gpsVisitors || []) as Parameters<typeof AnalyticsGpsMap>[0]['visitors']}
            ar={ar}
            height={520}
          />
        </div>
      )}

      {view === 'gps' && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
            <h5 className="analytics-block-title" style={{ margin: 0 }}>
              <i className="fa-solid fa-location-crosshairs" style={{ marginInlineEnd: 6, color: '#7dffb0' }} />
              {ar ? 'مواقع GPS دقيق (موافقة الزائر)' : 'Accurate GPS (visitor consent)'}
              <span className="analytics-muted" style={{ fontWeight: 600, marginInlineStart: 8 }}>({stats?.gpsVisitors?.length ?? 0})</span>
            </h5>
            <button type="button" className="btn-prime btn-sm" onClick={() => setView('gpsmap')}>
              <i className="fa-solid fa-map-location-dot" /> {ar ? 'عرض الخريطة' : 'View map'}
            </button>
          </div>
          {(stats?.gpsVisitors?.length ?? 0) > 0 ? (
            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th className="analytics-sel-col">
                      <SelCheckbox
                        checked={stats!.gpsVisitors!.length > 0 && stats!.gpsVisitors!.every(v => selectedSessions.has(v.sessionId))}
                        onChange={() => {
                          const ids = stats!.gpsVisitors!.map(v => v.sessionId);
                          const allOn = ids.every(id => selectedSessions.has(id));
                          toggleAllSessions(ids, !allOn);
                        }}
                        aria={ar ? 'تحديد الكل' : 'Select all'}
                      />
                    </th>
                    <th className="analytics-del-col">{ar ? 'حذف' : 'Del'}</th>
                    <th>IP</th>
                    <th>{ar ? 'الموقع الدقيق' : 'GPS location'}</th>
                    <th>{ar ? 'موافقة GPS' : 'GPS consent'}</th>
                    <th>{ar ? 'آخر نشاط' : 'Last active'}</th>
                    <th>{ar ? 'مشاهدات' : 'Views'}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats!.gpsVisitors!.map(v => (
                    <tr key={v.sessionId}>
                      {sessionTableExtras(v.sessionId)}
                      <td className="cv-ltr analytics-ip">{v.ip || '—'}</td>
                      <LocationCell v={{ ...v, geoSource: 'gps' }} ar={ar} />
                      <td className="analytics-time">{(v as VisitorRow & { gpsConsentAt?: string }).gpsConsentAt?.slice(0, 16) || '—'}</td>
                      <td className="analytics-time">{v.lastSeen?.slice(0, 16)}</td>
                      <td>{v.pageViews}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="analytics-muted" style={{ textAlign: 'center', padding: 24 }}>
              {ar ? 'لا توجد موافقات GPS محفوظة بعد — فعّل طلب الموقع من إعدادات الموقع، ثم يوافق الزائر عند دخوله.' : 'No GPS consents saved yet — enable the prompt in Site Settings.'}
            </p>
          )}
        </div>
      )}

      {(view === 'summary' || view === 'downloads') && (stats?.cvDownloadsDetail?.length ?? 0) > 0 && view !== 'reports' && (
        <div style={{ marginTop: 18 }}>
          <h5 className="analytics-block-title">
            <i className="fa-solid fa-file-pdf" style={{ marginInlineEnd: 6 }} />
            {ar ? 'آخر تنزيلات السيرة (مع GPS إن وُجد)' : 'Recent CV downloads'}
          </h5>
          <div className="analytics-table-wrap">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th className="analytics-sel-col">
                    <SelCheckbox
                      checked={stats!.cvDownloadsDetail!.slice(0, 30).length > 0 && stats!.cvDownloadsDetail!.slice(0, 30).every(r => selectedEvents.has(r.id))}
                      onChange={() => {
                        const ids = stats!.cvDownloadsDetail!.slice(0, 30).map(r => r.id);
                        const allOn = ids.every(id => selectedEvents.has(id));
                        toggleAllEvents(ids, !allOn);
                      }}
                      aria={ar ? 'تحديد الكل' : 'Select all'}
                    />
                  </th>
                  <th className="analytics-del-col">{ar ? 'حذف' : 'Del'}</th>
                  <th>{ar ? 'السيرة' : 'CV'}</th>
                  <th>IP</th>
                  <th>{ar ? 'الموقع' : 'Location'}</th>
                  <th>{ar ? 'الوقت' : 'Time'}</th>
                </tr>
              </thead>
              <tbody>
                {stats!.cvDownloadsDetail!.slice(0, 30).map(row => (
                  <tr key={row.id}>
                    {eventTableExtras(row.id)}
                    <td>{row.label || row.path || '—'}</td>
                    <td className="cv-ltr analytics-ip">{row.ip || '—'}</td>
                    <EventLocationCell e={{
                      geoSource: row.geoSource,
                      city: row.city,
                      country: row.country,
                      lat: row.lat != null ? String(row.lat) : null,
                      lon: row.lon != null ? String(row.lon) : null,
                    }} ar={ar} />
                    <td className="analytics-time">{row.createdAt?.slice(0, 16)}</td>
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
