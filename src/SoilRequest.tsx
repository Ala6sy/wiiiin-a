import { useRef, useState } from 'react';
import { AppData, ML, ml, pickML, LangKey } from './appData';

const LBL = {
  title: ml('اطلب تحليل التربة — تواصل مع المهندس', 'Request Soil Analysis — Contact the Engineer', 'Bodenanalyse anfragen — Ingenieur kontaktieren'),
  intro: ml(
    'اكتب رسالتك وأرفق موقع الأرض، ثم أرسلها مباشرة إلى المهندس عبر واتساب أو البريد الإلكتروني.',
    'Write your message, attach your land location, then send it directly to the engineer via WhatsApp or Email.',
    'Schreiben Sie Ihre Nachricht, fügen Sie den Standort hinzu und senden Sie sie direkt per WhatsApp oder E-Mail an den Ingenieur.',
  ),
  nameLabel: ml('الاسم', 'Name', 'Name'),
  namePh: ml('اسمك الكامل', 'Your full name', 'Ihr vollständiger Name'),
  phoneLabel: ml('رقم التواصل', 'Contact Number', 'Kontaktnummer'),
  phonePh: ml('رقم هاتفك', 'Your phone number', 'Ihre Telefonnummer'),
  msgLabel: ml('الرسالة', 'Message', 'Nachricht'),
  msgPh: ml('صف حالة الأرض أو المحصول وما تحتاجه...', 'Describe your land / crop and what you need...', 'Beschreiben Sie Ihr Land / Ihre Ernte und Ihren Bedarf...'),
  locLabel: ml('موقع الأرض', 'Land Location', 'Standort des Landes'),
  locPh: ml('الصق رابط الموقع (خرائط جوجل) أو الإحداثيات', 'Paste a location link (Google Maps) or coordinates', 'Standortlink (Google Maps) oder Koordinaten einfügen'),
  detect: ml('تحديد موقعي الحالي', 'Detect my current location', 'Meinen Standort ermitteln'),
  detecting: ml('جاري تحديد الموقع...', 'Detecting location...', 'Standort wird ermittelt...'),
  geoErr: ml('تعذّر تحديد الموقع. الصق الرابط يدوياً.', 'Could not detect location. Paste the link manually.', 'Standort konnte nicht ermittelt werden. Bitte Link manuell einfügen.'),
  sendWa: ml('إرسال عبر واتساب', 'Send via WhatsApp', 'Per WhatsApp senden'),
  sendMail: ml('إرسال عبر البريد', 'Send via Email', 'Per E-Mail senden'),
  needMsg: ml('الرجاء كتابة رسالتك أولاً.', 'Please write your message first.', 'Bitte schreiben Sie zuerst Ihre Nachricht.'),
  emailSubject: ml('طلب تحليل تربة', 'Soil Analysis Request', 'Bodenanalyse-Anfrage'),
  videosTitle: ml('فيديو توضيحي', 'Instructional Videos', 'Lehrvideos'),
  fullscreen: ml('ملء الشاشة', 'Fullscreen', 'Vollbild'),
  reportsTitle: ml('تقارير العملاء', 'Client Reports', 'Kundenberichte'),
  reportsIntro: ml('اضغط على أي تقرير لفتحه ومشاهدته.', 'Tap any report to open and view it.', 'Tippen Sie auf einen Bericht, um ihn zu öffnen.'),
  viewReport: ml('عرض التقرير', 'View Report', 'Bericht ansehen'),
};

function buildBody(L: (m: ML) => string, name: string, phone: string, msg: string, loc: string) {
  const lines: string[] = [];
  if (name) lines.push(`${L(LBL.nameLabel)}: ${name}`);
  if (phone) lines.push(`${L(LBL.phoneLabel)}: ${phone}`);
  lines.push(`${L(LBL.msgLabel)}: ${msg}`);
  if (loc) lines.push(`${L(LBL.locLabel)}: ${loc}`);
  return lines.join('\n');
}

/* Convert a public video link (YouTube / Drive / Vimeo / direct file) to an embeddable source */
export function videoEmbed(url: string): { kind: 'iframe' | 'video'; src: string } | null {
  const u = (url || '').trim();
  if (!u) return null;
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` };
  const gd = u.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (gd) return { kind: 'iframe', src: `https://drive.google.com/file/d/${gd[1]}/preview` };
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vm[1]}` };
  if (/^https?:\/\/\S+\.(mp4|webm|ogg|ogv|mov|m4v)(\?\S*)?$/i.test(u)) return { kind: 'video', src: u };
  return null;
}

function VideoCard({ title, url, fsLabel }: { title: string; url: string; fsLabel: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const embed = videoEmbed(url);
  if (!embed) return null;

  const goFull = () => {
    const el = wrapRef.current;
    if (!el) return;
    const anyEl = el as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (el.requestFullscreen) el.requestFullscreen();
    else if (anyEl.webkitRequestFullscreen) anyEl.webkitRequestFullscreen();
  };

  return (
    <div style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 14, overflow: 'hidden' }}>
      <div ref={wrapRef} style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: '#000' }}>
        {embed.kind === 'iframe'
          ? <iframe src={embed.src} title={title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
          : <video src={embed.src} controls playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />}
        <button onClick={goFull} title={fsLabel} aria-label={fsLabel}
          style={{ position: 'absolute', top: 8, insetInlineEnd: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa-solid fa-expand" />
        </button>
      </div>
      {title && <div style={{ padding: '9px 12px', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{title}</div>}
    </div>
  );
}

export function SoilRequest({ data, lang }: { data: AppData; lang: LangKey }) {
  const isRtl = lang === 'ar';
  const L = (m: ML) => pickML(m, lang);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const [loc, setLoc] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);
  const [err, setErr] = useState('');

  const engPhone = (data.personalInfo.phone || '').replace(/[^\d]/g, '');
  const engEmail = data.personalInfo.email || '';

  const videos = (data.agriVideos || []).filter(v => v.visible && videoEmbed(v.url));
  const reports = (data.publicReports || []).filter(r => r.visible && (r.url || r.thumbnail));

  function detect() {
    if (!navigator.geolocation) { setErr(L(LBL.geoErr)); return; }
    setGeoBusy(true); setErr('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setLoc(`https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`);
        setGeoBusy(false);
      },
      () => { setErr(L(LBL.geoErr)); setGeoBusy(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function sendWhatsApp() {
    if (!msg.trim()) { setErr(L(LBL.needMsg)); return; }
    setErr('');
    const body = buildBody(L, name, phone, msg, loc);
    window.open(`https://wa.me/${engPhone}?text=${encodeURIComponent(body)}`, '_blank');
  }

  function sendEmail() {
    if (!msg.trim()) { setErr(L(LBL.needMsg)); return; }
    setErr('');
    const body = buildBody(L, name, phone, msg, loc);
    window.location.href = `mailto:${engEmail}?subject=${encodeURIComponent(L(LBL.emailSubject))}&body=${encodeURIComponent(body)}`;
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--glass-border)', borderRadius: 10, fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box', background: 'var(--field)', color: 'var(--text)' };
  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--navy)', display: 'block', marginBottom: 6 };
  const sectionHead: React.CSSProperties = { fontWeight: 800, color: 'var(--navy)', fontSize: 16, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 };

  return (
    <div className="fade-up" style={{ direction: isRtl ? 'rtl' : 'ltr', maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 26 }}>

      {/* ══ Instructional videos ══ */}
      {videos.length > 0 && (
        <div>
          <div style={sectionHead}><i className="fa-solid fa-clapperboard" /> {L(LBL.videosTitle)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: videos.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginTop: 12 }}>
            {videos.map(v => <VideoCard key={v.id} title={L(v.title)} url={v.url} fsLabel={L(LBL.fullscreen)} />)}
          </div>
        </div>
      )}

      {/* ══ Contact the engineer ══ */}
      <div style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 24, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
        <div style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 17, marginBottom: 6 }}>
          <i className="fa-solid fa-vials" /> {L(LBL.title)}
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.7 }}>{L(LBL.intro)}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>{L(LBL.nameLabel)}</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={L(LBL.namePh)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{L(LBL.phoneLabel)}</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={L(LBL.phonePh)} style={{ ...inputStyle, direction: 'ltr' }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>{L(LBL.msgLabel)}</label>
          <textarea value={msg} onChange={e => setMsg(e.target.value)} placeholder={L(LBL.msgPh)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{L(LBL.locLabel)}</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={loc} onChange={e => setLoc(e.target.value)} placeholder={L(LBL.locPh)} style={{ ...inputStyle, flex: 1, minWidth: 200, direction: 'ltr' }} />
            <button onClick={detect} disabled={geoBusy}
              style={{ border: '1px solid var(--navy)', background: 'transparent', color: 'var(--navy)', borderRadius: 10, padding: '0 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <i className={`fa-solid ${geoBusy ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'}`} /> {geoBusy ? L(LBL.detecting) : L(LBL.detect)}
            </button>
          </div>
        </div>

        {err && <div style={{ color: '#c0392b', fontSize: 13, fontWeight: 600, margin: '8px 0' }}><i className="fa-solid fa-triangle-exclamation" /> {err}</div>}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <button onClick={sendWhatsApp} disabled={!engPhone}
            style={{ flex: 1, minWidth: 200, background: '#25D366', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: engPhone ? 1 : 0.5 }}>
            <i className="fa-brands fa-whatsapp" style={{ fontSize: 18 }} /> {L(LBL.sendWa)}
          </button>
          <button onClick={sendEmail} disabled={!engEmail}
            style={{ flex: 1, minWidth: 200, background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 18px', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: engEmail ? 1 : 0.5 }}>
            <i className="fa-solid fa-envelope" style={{ fontSize: 16 }} /> {L(LBL.sendMail)}
          </button>
        </div>
      </div>

      {/* ══ Client reports gallery ══ */}
      {reports.length > 0 && (
        <div>
          <div style={sectionHead}><i className="fa-solid fa-folder-open" /> {L(LBL.reportsTitle)}</div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '4px 0 12px', lineHeight: 1.7 }}>{L(LBL.reportsIntro)}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {reports.map(r => {
              const title = L(r.title);
              const inner = (
                <>
                  <div style={{ width: '100%', aspectRatio: '3 / 4', background: 'var(--navy-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {r.thumbnail
                      ? <img src={r.thumbnail} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <i className="fa-solid fa-file-lines" style={{ fontSize: 38, color: 'var(--navy)' }} />}
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title || '—'}</div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: r.url ? 'var(--navy)' : 'var(--muted)' }}>
                      <i className="fa-solid fa-up-right-from-square" /> {L(LBL.viewReport)}
                    </span>
                  </div>
                </>
              );
              const cardStyle: React.CSSProperties = { background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 12, overflow: 'hidden', textDecoration: 'none', display: 'block', cursor: r.url ? 'pointer' : 'default' };
              return r.url
                ? <a key={r.id} href={r.url} target="_blank" rel="noreferrer" style={cardStyle}>{inner}</a>
                : <div key={r.id} style={cardStyle}>{inner}</div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
