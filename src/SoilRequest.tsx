import { useEffect, useRef, useState } from 'react';
import { AgriVideo, AppData, CustomerReport, ML, ml, pickML, pickReportML, LangKey } from './appData';
import {
  resolveVideoEmbedSrc,
  resolveVideoPlaybackSrc,
  resolveImageSrc,
  resolveReportDisplay,
  isGoogleDriveUrl,
  isVideoMediaUrl,
} from './mediaUrl';
import { parseCustomerReportUrl, SoilReportA4Viewer } from './SoilReportA4Viewer';
import { SoilReportLiveThumb, reportTypeLabel, reportPlantLabel } from './SoilReportLiveThumb';
import { createPortal } from 'react-dom';
import { useIsMobile } from './hooks/use-mobile';
import { responsiveGridColumns } from './GridFontControls';

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
  playVideo: ml('تشغيل الفيديو', 'Play video', 'Video abspielen'),
  pauseVideo: ml('إيقاف', 'Pause', 'Pause'),
  muteVideo: ml('كتم الصوت', 'Mute', 'Stumm'),
  unmuteVideo: ml('تشغيل الصوت', 'Unmute', 'Ton an'),
  loadingHq: ml('جاري التشغيل…', 'Starting…', 'Wird gestartet…'),
  exitFs: ml('إنهاء ملء الشاشة', 'Exit fullscreen', 'Vollbild beenden'),
  reportsTitle: ml('تقارير العملاء', 'Client Reports', 'Kundenberichte'),
  reportsIntro: ml('اضغط على أي تقرير لفتحه ومشاهدته.', 'Tap any report to open and view it.', 'Tippen Sie auf einen Bericht, um ihn zu öffnen.'),
  viewReport: ml('عرض التقرير', 'View Report', 'Bericht ansehen'),
  viewA4: ml('عرض A4 / PDF', 'View A4 / PDF', 'A4 / PDF ansehen'),
};

function buildBody(L: (m: ML) => string, name: string, phone: string, msg: string, loc: string) {
  const lines: string[] = [];
  if (name) lines.push(`${L(LBL.nameLabel)}: ${name}`);
  if (phone) lines.push(`${L(LBL.phoneLabel)}: ${phone}`);
  lines.push(`${L(LBL.msgLabel)}: ${msg}`);
  if (loc) lines.push(`${L(LBL.locLabel)}: ${loc}`);
  return lines.join('\n');
}

/* Convert a public video link (YouTube / Drive / Vimeo / WebM / GIF) to an embeddable source */
export function videoEmbed(url: string): { kind: 'iframe' | 'video' | 'gif'; src: string } | null {
  const u = (url || '').trim();
  if (!u) return null;
  if (/\.gif(\?|#|$)/i.test(u) || /^data:image\/gif/i.test(u)) {
    return { kind: 'gif', src: u.startsWith('data:') ? u : resolveImageSrc(u) };
  }
  const isYtOrVimeo = /youtube\.com|youtu\.be|vimeo\.com/i.test(u);
  if (!isYtOrVimeo && (
    isVideoMediaUrl(u)
    || isGoogleDriveUrl(u)
    || /^data:video\//i.test(u)
    || u.startsWith('blob:')
    || /^\/?uploads\//i.test(u)
  )) {
    if (u.startsWith('data:') || u.startsWith('blob:') || /^\/uploads\//i.test(u) || /^\.\.?\//.test(u)) {
      return { kind: 'video', src: u.startsWith('uploads/') ? `/${u}` : u };
    }
    return { kind: 'video', src: resolveVideoPlaybackSrc(u) };
  }
  const src = resolveVideoEmbedSrc(u);
  if (!src) return null;
  if (/\.(mp4|webm|ogg|ogv|mov|m4v)(\?|$)/i.test(src) && !src.includes('drive.google.com')) {
    return { kind: 'video', src };
  }
  return { kind: 'iframe', src };
}

/** قص الشريط الأسود من أعلى/أسفل الصورة المصغّرة إن وُجد */
function cropLetterboxDataUrl(img: HTMLImageElement, quality = 0.9): string | null {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  try {
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);
    const rowIsBlack = (y: number) => {
      let dark = 0;
      let n = 0;
      const step = Math.max(1, Math.floor(w / 48));
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        if (data[i]! + data[i + 1]! + data[i + 2]! < 48) dark++;
        n++;
      }
      return n > 0 && dark / n > 0.88;
    };
    let top = 0;
    let bottom = h - 1;
    while (top < h - 2 && rowIsBlack(top)) top++;
    while (bottom > top + 2 && rowIsBlack(bottom)) bottom--;
    const ch = bottom - top + 1;
    if (ch >= h * 0.92 || ch < h * 0.35) return null;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = ch;
    out.getContext('2d')!.drawImage(c, 0, top, w, ch, 0, 0, w, ch);
    return out.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}

const ctrlBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 10,
  border: 'none',
  background: 'rgba(255,255,255,0.14)',
  color: '#fff',
  fontSize: 15,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
};

/** مشغّل أصلي + شريط تحكم سفلي أنيق (بدون واجهة Drive) */
function VideoCard({
  video,
  title,
  fsLabel,
  exitFsLabel,
  playLabel,
  pauseLabel,
  muteLabel,
  unmuteLabel,
  loadingLabel,
}: {
  video: AgriVideo;
  title: string;
  fsLabel: string;
  exitFsLabel: string;
  playLabel: string;
  pauseLabel: string;
  muteLabel: string;
  unmuteLabel: string;
  loadingLabel: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isMobile = useIsMobile();
  const embed = videoEmbed(video.url);
  const posterRaw = (video.poster || '').trim() ? resolveImageSrc(video.poster!) : '';
  const wantAutoplay = !!video.autoplay;
  const wantLoop = video.loop !== false;
  const wantMuted = !!video.muted || wantAutoplay;
  const isFile = embed?.kind === 'video';
  const isGif = embed?.kind === 'gif';
  const isIframe = embed?.kind === 'iframe';

  const [posterSrc, setPosterSrc] = useState(posterRaw);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mediaOn, setMediaOn] = useState(false);
  const [iframeOn, setIframeOn] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(wantMuted);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFs, setIsFs] = useState(false);
  const [showBar, setShowBar] = useState(true);

  useEffect(() => {
    setPosterSrc(posterRaw);
    if (!posterRaw) return;
    const img = new Image();
    img.onload = () => {
      const cropped = cropLetterboxDataUrl(img);
      if (cropped) setPosterSrc(cropped);
    };
    img.src = posterRaw;
  }, [posterRaw]);

  useEffect(() => {
    setReady(!!isGif);
    setStarted(false);
    setLoading(false);
    setMediaOn(false);
    setIframeOn(false);
    setPlaying(false);
    setMuted(wantMuted);
    setProgress(0);
    setDuration(0);
    if (wantAutoplay && !isGif) {
      if (isFile) {
        setMediaOn(true);
        setLoading(true);
      } else if (isIframe) {
        setIframeOn(true);
        setStarted(true);
        setReady(true);
        setPlaying(true);
      }
    }
  }, [video.url, video.poster, video.autoplay, video.loop, video.muted, isGif, isFile, isIframe, wantAutoplay, wantMuted]);

  useEffect(() => {
    const onFs = () => {
      const fsEl = document.fullscreenElement
        || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement;
      setIsFs(!!fsEl && !!wrapRef.current && (fsEl === wrapRef.current || wrapRef.current.contains(fsEl)));
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!mediaOn || !isFile) return;
    const el = videoRef.current;
    if (!el) return;

    const playWhenReady = () => {
      setReady(true);
      setLoading(false);
      setStarted(true);
      el.muted = muted;
      void el.play().then(() => setPlaying(true)).catch(() => {
        el.muted = true;
        setMuted(true);
        void el.play().then(() => setPlaying(true)).catch(() => setLoading(false));
      });
    };

    if (el.readyState >= 2) {
      playWhenReady();
      return;
    }
    const onCanPlay = () => playWhenReady();
    el.addEventListener('canplay', onCanPlay);
    return () => el.removeEventListener('canplay', onCanPlay);
  }, [mediaOn, isFile, muted, video.url]);

  if (!embed) return null;

  if (isGif) {
    return (
      <div style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', overflow: 'hidden' }}>
          <img src={embed.src} alt={title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
        </div>
        {title && <div style={{ padding: '9px 12px', fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>{title}</div>}
      </div>
    );
  }

  const toggleFs = () => {
    const el = wrapRef.current;
    if (!el) return;
    const doc = document as Document & {
      webkitExitFullscreen?: () => void;
      webkitFullscreenElement?: Element;
    };
    const anyEl = el as HTMLElement & { webkitRequestFullscreen?: () => void };
    const active = document.fullscreenElement || doc.webkitFullscreenElement;
    if (active) {
      if (document.exitFullscreen) void document.exitFullscreen();
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      return;
    }
    if (el.requestFullscreen) void el.requestFullscreen();
    else if (anyEl.webkitRequestFullscreen) anyEl.webkitRequestFullscreen();
  };

  const startPlayback = () => {
    if (started && ready && !loading && isFile) {
      const v = videoRef.current;
      if (v?.paused) void v.play().then(() => setPlaying(true));
      return;
    }
    setLoading(true);

    if (isIframe) {
      setIframeOn(true);
      setStarted(true);
      setReady(true);
      setLoading(false);
      setPlaying(true);
      return;
    }

    setMediaOn(true);
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (!v) return;
      const playNow = () => {
        setReady(true);
        setLoading(false);
        setStarted(true);
        v.muted = muted;
        void v.play().then(() => setPlaying(true)).catch(() => {
          v.muted = true;
          setMuted(true);
          void v.play().then(() => setPlaying(true)).catch(() => setLoading(false));
        });
      };
      if (v.readyState >= 2) playNow();
      else {
        const onReady = () => {
          v.removeEventListener('canplay', onReady);
          playNow();
        };
        v.addEventListener('canplay', onReady);
        try { v.load(); } catch { /* */ }
      }
    });
  };

  const togglePlay = () => {
    if (!started || !ready) {
      startPlayback();
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().then(() => setPlaying(true));
    else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    const next = !muted;
    setMuted(next);
    if (v) v.muted = next;
  };

  const onSeek = (pct: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = Math.max(0, Math.min(duration, (pct / 100) * duration));
    setProgress(pct);
  };

  const showCover = !started || loading || (!ready && !iframeOn);
  const showNativeControls = isFile && started && ready && !loading;

  return (
    <div style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 14, overflow: 'hidden' }}>
      <div
        ref={wrapRef}
        onMouseEnter={() => setShowBar(true)}
        onTouchStart={() => setShowBar(true)}
        style={{
          position: 'relative',
          width: '100%',
          paddingTop: '56.25%',
          background: '#000',
          overflow: 'hidden',
        }}
      >
        {posterSrc ? (
          <img
            src={posterSrc}
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center top',
              display: showCover ? 'block' : 'none',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
        ) : (
          showCover && <div style={{ position: 'absolute', inset: 0, background: '#0a1628', zIndex: 1 }} />
        )}

        {iframeOn && isIframe ? (
          <iframe
            src={embed.src + (embed.src.includes('?') ? '&' : '?') + 'autoplay=1'}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', zIndex: 2, display: 'block' }}
          />
        ) : null}

        {isFile && mediaOn ? (
          <video
            ref={videoRef}
            key={embed.src}
            src={embed.src}
            controls={false}
            playsInline
            loop={wantLoop}
            muted={muted}
            preload={isMobile ? 'metadata' : 'auto'}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
              display: 'block',
              zIndex: 2,
              opacity: started && ready && !loading ? 1 : 0,
              background: '#000',
            }}
            onTimeUpdate={() => {
              const v = videoRef.current;
              if (!v || !v.duration) return;
              setDuration(v.duration);
              setProgress((v.currentTime / v.duration) * 100);
            }}
            onLoadedMetadata={() => {
              const v = videoRef.current;
              if (v?.duration) setDuration(v.duration);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onCanPlay={() => {
              setReady(true);
              if (wantAutoplay || started || loading) {
                setLoading(false);
                setStarted(true);
                const el = videoRef.current;
                if (el && el.paused) {
                  el.muted = muted;
                  void el.play().then(() => setPlaying(true)).catch(() => {
                    el.muted = true;
                    setMuted(true);
                    void el.play().then(() => setPlaying(true)).catch(() => undefined);
                  });
                }
              }
            }}
            onPlaying={() => {
              setReady(true);
              setLoading(false);
              setStarted(true);
              setPlaying(true);
            }}
          />
        ) : null}

        {showCover && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: !started ? 'pointer' : 'default',
              background: 'transparent',
            }}
            onClick={() => { if (!started || loading) startPlayback(); }}
            role={!started ? 'button' : undefined}
            aria-label={!started ? playLabel : undefined}
          >
            {loading ? (
              <div style={{
                background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 12,
                padding: '10px 16px', fontSize: 12, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: '90%',
              }}>
                <i className="fa-solid fa-spinner fa-spin" /> {loadingLabel}
              </div>
            ) : !started ? (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); startPlayback(); }}
                title={playLabel}
                aria-label={playLabel}
                style={{
                  width: 64, height: 64, borderRadius: '50%', border: 'none',
                  background: 'rgba(0,51,102,0.88)', color: '#fff', fontSize: 22,
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                }}
              >
                <i className="fa-solid fa-play" style={{ marginInlineStart: 3 }} />
              </button>
            ) : null}
          </div>
        )}

        {/* شريط تحكم سفلي أنيق — تشغيل / صوت / تقدم / ملء الشاشة */}
        {(showNativeControls || (isIframe && started)) && showBar && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 5,
              padding: '10px 10px 12px',
              background: 'linear-gradient(transparent, rgba(0,12,28,0.92))',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
            onClick={e => e.stopPropagation()}
          >
            {showNativeControls && (
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={progress}
                aria-label="seek"
                onChange={e => onSeek(Number(e.target.value))}
                style={{
                  width: '100%',
                  height: 4,
                  accentColor: '#4da3ff',
                  cursor: 'pointer',
                  margin: 0,
                }}
              />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {showNativeControls && (
                  <>
                    <button type="button" style={ctrlBtn} title={playing ? pauseLabel : playLabel} aria-label={playing ? pauseLabel : playLabel} onClick={togglePlay}>
                      <i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'}`} style={!playing ? { marginInlineStart: 2 } : undefined} />
                    </button>
                    <button type="button" style={ctrlBtn} title={muted ? unmuteLabel : muteLabel} aria-label={muted ? unmuteLabel : muteLabel} onClick={toggleMute}>
                      <i className={`fa-solid ${muted ? 'fa-volume-xmark' : 'fa-volume-high'}`} />
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                style={ctrlBtn}
                title={isFs ? exitFsLabel : fsLabel}
                aria-label={isFs ? exitFsLabel : fsLabel}
                onClick={toggleFs}
              >
                <i className={`fa-solid ${isFs ? 'fa-compress' : 'fa-expand'}`} />
              </button>
            </div>
          </div>
        )}
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
  const [reportPreview, setReportPreview] = useState<{ title: string; url: string } | null>(null);
  const [a4Report, setA4Report] = useState<CustomerReport | null>(null);

  const engPhone = (data.personalInfo.phone || '').replace(/[^\d]/g, '');
  const engEmail = data.personalInfo.email || '';

  const videos = (data.agriVideos || []).filter(v => v.visible && videoEmbed(v.url));
  const reports = (data.publicReports || []).filter(r => r.visible && (r.url || r.thumbnail));
  const isMobile = useIsMobile();
  const reportColsDesktop = Math.min(6, Math.max(1, data.siteSettings?.reportGalleryColsDesktop ?? 3));
  const reportColsMobile = Math.min(4, Math.max(1, data.siteSettings?.reportGalleryColsMobile ?? 2));
  const reportGridCols = responsiveGridColumns(reportColsDesktop, reportColsMobile, isMobile);

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
            {videos.map(v => (
              <VideoCard
                key={v.id}
                video={v}
                title={L(v.title)}
                fsLabel={L(LBL.fullscreen)}
                exitFsLabel={L(LBL.exitFs)}
                playLabel={L(LBL.playVideo)}
                pauseLabel={L(LBL.pauseVideo)}
                muteLabel={L(LBL.muteVideo)}
                unmuteLabel={L(LBL.unmuteVideo)}
                loadingLabel={L(LBL.loadingHq)}
              />
            ))}
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
          <div style={{ display: 'grid', gridTemplateColumns: reportGridCols, gap: 12 }}>
            {reports.map(r => {
              const title = L(r.title);
              const disp = resolveReportDisplay(r.url, r.thumbnail);
              const customThumb = (r.thumbnail || '').trim();
              const thumbSrc = customThumb ? resolveImageSrc(customThumb) : '';
              const crId = parseCustomerReportUrl(r.url || '');
              const linked = crId ? (data.customerReports || []).find(c => c.id === crId) : undefined;
              const isA4 = !!crId;
              const showCustomer = data.siteSettings?.reportGalleryShowCustomerName !== false;
              const typeTxt = linked ? reportTypeLabel(linked.reportType, lang) : L(LBL.viewReport);
              const plantTxt = linked ? reportPlantLabel(linked, lang) : '';
              const customerTxt = linked && showCustomer ? pickReportML(linked.customerName, lang) : '';
              const useLiveThumb = !thumbSrc && !!linked;
              const openReport = (e: React.MouseEvent) => {
                if (!r.url && !thumbSrc && !linked) return;
                e.preventDefault();
                if (linked) {
                  setA4Report(linked);
                  return;
                }
                if (disp.useModal && disp.previewUrl) {
                  setReportPreview({ title, url: disp.previewUrl });
                } else if (r.url) {
                  window.open(r.url, '_blank', 'noreferrer');
                }
              };
              const clickable = !!(r.url || thumbSrc || linked);
              const inner = (
                <>
                  <div style={{
                    width: '100%', aspectRatio: '3 / 4', background: '#d8e4f0',
                    display: 'block', overflow: 'hidden', position: 'relative',
                  }}>
                    {thumbSrc ? (
                      <img
                        src={thumbSrc}
                        alt={typeTxt}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => {
                          e.currentTarget.style.display = 'none';
                          const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                          if (fb) fb.style.display = 'block';
                        }}
                      />
                    ) : null}
                    {useLiveThumb ? (
                      <SoilReportLiveThumb data={data} report={linked!} lang={lang} />
                    ) : !thumbSrc ? (
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex',
                        alignItems: 'center', justifyContent: 'center', background: '#e8eef5',
                      }}>
                        <i className="fa-solid fa-file-pdf" style={{ fontSize: 38, color: 'var(--navy)' }} />
                      </div>
                    ) : (
                      <div style={{ display: 'none' }} />
                    )}
                  </div>
                  <div style={{ padding: '8px 10px 10px' }}>
                    {/* سطر 1: نوع التحليل */}
                    <div style={{
                      fontSize: 11, fontWeight: 800, color: 'var(--navy)', lineHeight: 1.35,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {typeTxt}
                    </div>
                    {/* سطر 2: اسم النبات — سطر واحد فقط */}
                    {plantTxt ? (
                      <div style={{
                        marginTop: 3, fontSize: 11, fontWeight: 600, color: 'var(--muted)', lineHeight: 1.35,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }} title={plantTxt}>
                        {plantTxt}
                      </div>
                    ) : (
                      <div style={{
                        marginTop: 3, fontSize: 11, fontWeight: 600, color: 'var(--muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }} title={title}>
                        {title}
                      </div>
                    )}
                    {customerTxt ? (
                      <div style={{
                        marginTop: 5, fontSize: 11.5, fontWeight: 500, color: 'var(--text)',
                        opacity: 0.78,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        borderTop: '1px solid rgba(128,160,180,0.22)', paddingTop: 5,
                      }}>
                        {customerTxt}
                      </div>
                    ) : null}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 7,
                      fontSize: 11, fontWeight: 700, color: clickable ? 'var(--navy)' : 'var(--muted)',
                    }}>
                      <i className={`fa-solid ${isA4 || disp.useModal ? 'fa-file-pdf' : 'fa-up-right-from-square'}`} />
                      {isA4 || disp.useModal ? L(LBL.viewA4) : L(LBL.viewReport)}
                    </span>
                  </div>
                </>
              );
              const cardStyle: React.CSSProperties = {
                background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 12,
                overflow: 'hidden', textDecoration: 'none', display: 'block',
                cursor: clickable ? 'pointer' : 'default',
              };
              return clickable
                ? <a key={r.id} href={disp.useModal ? '#' : (r.url || '#')} onClick={openReport} style={cardStyle}>{inner}</a>
                : <div key={r.id} style={cardStyle}>{inner}</div>;
            })}
          </div>
          {reportPreview && (
            <div onClick={() => setReportPreview(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, width: 'min(960px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #eee', background: 'var(--navy)', color: '#fff' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}><i className="fa-solid fa-file-pdf" style={{ marginInlineEnd: 8 }} />{reportPreview.title}</span>
                  <button onClick={() => setReportPreview(null)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
                <iframe src={reportPreview.url} title={reportPreview.title} style={{ flex: 1, minHeight: 480, border: 'none', width: '100%' }} allow="autoplay" />
              </div>
            </div>
          )}
        </div>
      )}

      {a4Report && createPortal(
        <SoilReportA4Viewer
          data={data}
          report={a4Report}
          initialLang={lang}
          onClose={() => setA4Report(null)}
        />,
        document.body,
      )}
    </div>
  );
}
