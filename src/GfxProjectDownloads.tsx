import { useState } from 'react';
import type { GfxProjectItem, LangKey } from './appData';
import { pickML } from './appData';
import { getGfxDownloadLinks } from './gfxDownloadLinks';
import type { GfxDownloadLink } from './gfxDownloadLinks';
import { driveDownloadUrl } from './mediaUrl';
import { trackFileDownload } from './analytics';

const L = {
  section: { ar: 'ملفات التحميل', en: 'Download Files', de: 'Download-Dateien' },
  free: { ar: 'تنزيل مجاني', en: 'Free Download', de: 'Kostenlos' },
  paid: { ar: 'للشراء', en: 'Purchase', de: 'Kaufen' },
  price: { ar: 'السعر', en: 'Price', de: 'Preis' },
  passwordPh: { ar: 'أدخل كلمة السر', en: 'Enter password', de: 'Passwort' },
  unlock: { ar: 'فتح التنزيل', en: 'Unlock', de: 'Freischalten' },
  wrong: { ar: 'كلمة السر غير صحيحة', en: 'Wrong password', de: 'Falsches Passwort' },
  protected: { ar: 'محمي بكلمة سر', en: 'Password protected', de: 'Passwortgeschützt' },
};

function t(m: Record<LangKey, string>, lang: LangKey) {
  return m[lang] || m.en;
}

function PasswordGate({
  link, lang, theme, onUnlock,
}: {
  link: GfxDownloadLink;
  lang: LangKey;
  theme: 'dark' | 'light';
  onUnlock: () => void;
}) {
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState(false);
  const border = theme === 'dark' ? 'rgba(100,180,255,0.22)' : '#aac4ee';

  const tryUnlock = () => {
    if (pwd.trim() === (link.password || '').trim()) {
      onUnlock();
      setErr(false);
    } else {
      setErr(true);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 280 }}>
      <input type="password" value={pwd} onChange={e => { setPwd(e.target.value); setErr(false); }}
        onKeyDown={e => e.key === 'Enter' && tryUnlock()}
        placeholder={t(L.passwordPh, lang)}
        style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${err ? '#e53935' : border}`, fontSize: 12, fontFamily: 'inherit' }} />
      {err && <span style={{ fontSize: 11, color: '#e53935' }}>{t(L.wrong, lang)}</span>}
      <button type="button" onClick={tryUnlock}
        style={{ padding: '8px 14px', borderRadius: 8, background: '#003366', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
        <i className="fa-solid fa-unlock" /> {t(L.unlock, lang)}
      </button>
    </div>
  );
}

function DownloadLinkButton({
  link, lang, theme, projectTitle, itemId, waPhone, contactEmail, freeBtnColor, freeBtnTextColor,
}: {
  link: GfxDownloadLink;
  lang: LangKey;
  theme: 'dark' | 'light';
  projectTitle: string;
  itemId: string;
  waPhone: string;
  contactEmail: string;
  freeBtnColor: string;
  freeBtnTextColor: string;
}) {
  const [unlocked, setUnlocked] = useState(!(link.password || '').trim());
  const label = (link.label || 'ملف').trim();
  const hasPwd = !!(link.password || '').trim();

  if (link.isPaid) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', gridColumn: '1 / -1' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: theme === 'dark' ? '#f0d080' : '#996600' }}>
          {label} — {t(L.price, lang)}: {link.price} {link.currency || 'USD'}
        </span>
        {waPhone && (
          <a href={`https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(
            lang === 'ar' ? `أريد شراء ملف ${label} للمشروع: ${projectTitle}` :
            lang === 'de' ? `Ich möchte die Datei ${label} für: ${projectTitle}` :
            `I want to buy ${label} for: ${projectTitle}`,
          )}`}
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: '#25d366', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 12 }}>
            <i className="fa-brands fa-whatsapp" /> WhatsApp
          </a>
        )}
        {contactEmail && (
          <a href={`mailto:${contactEmail}?subject=${encodeURIComponent(
            (lang === 'ar' ? `طلب ملف: ${label} — ` : lang === 'de' ? `Datei: ${label} — ` : `File: ${label} — `) + projectTitle,
          )}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: '#003366', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 12 }}>
            <i className="fa-solid fa-envelope" /> {lang === 'ar' ? 'إيميل' : lang === 'de' ? 'E-Mail' : 'Email'}
          </a>
        )}
      </div>
    );
  }

  if (hasPwd && !unlocked) {
    return (
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{ fontSize: 11, color: theme === 'dark' ? '#f0c060' : '#996600', marginBottom: 6, fontWeight: 600 }}>
          <i className="fa-solid fa-lock" /> {label} — {t(L.protected, lang)}
        </div>
        <PasswordGate link={link} lang={lang} theme={theme} onUnlock={() => setUnlocked(true)} />
      </div>
    );
  }

  return (
    <a href={driveDownloadUrl(link.url)} target="_blank" rel="noopener noreferrer"
      onClick={() => trackFileDownload(label, itemId)}
      className="gfx-dl-btn"
      title={`${t(L.free, lang)} — ${label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        width: '100%',
        boxSizing: 'border-box',
        padding: '8px 10px',
        borderRadius: 11,
        background: `linear-gradient(145deg, ${freeBtnColor} 0%, ${freeBtnColor}cc 100%)`,
        color: freeBtnTextColor,
        textDecoration: 'none',
        fontWeight: 700,
        fontSize: 12,
        textAlign: 'center',
        lineHeight: 1.2,
        minHeight: 38,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        boxShadow: '0 3px 12px rgba(0, 30, 70, 0.2)',
        border: '1px solid rgba(255,255,255,0.12)',
      }}>
      <i className="fa-solid fa-download" style={{ flexShrink: 0, fontSize: 12, opacity: 0.95 }} />
      <span className="gfx-dl-btn__text" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <span className="gfx-dl-btn__short">{label}</span>
        <span className="gfx-dl-btn__full">{t(L.free, lang)} — {label}</span>
      </span>
    </a>
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function GfxProjectDownloads({
  item,
  lang,
  theme,
  projectTitle,
  waPhone = '',
  contactEmail = '',
  freeBtnColor = '#003366',
  freeBtnTextColor = '#ffffff',
}: {
  item: GfxProjectItem;
  lang: LangKey;
  theme: 'dark' | 'light';
  projectTitle: string;
  waPhone?: string;
  contactEmail?: string;
  freeBtnColor?: string;
  freeBtnTextColor?: string;
}) {
  const links = getGfxDownloadLinks(item).filter(l => l.visible !== false && l.url.trim());
  if (!links.length) return null;

  const rgb = hexToRgb(freeBtnColor) || { r: 0, g: 51, b: 102 };
  const border = theme === 'dark'
    ? `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`
    : `rgba(${rgb.r},${rgb.g},${rgb.b},0.28)`;
  const bg = theme === 'dark'
    ? `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`
    : `rgba(${rgb.r},${rgb.g},${rgb.b},0.06)`;
  const titleColor = theme === 'dark' ? '#a8c8f0' : freeBtnColor;

  const freeCount = links.filter(l => !l.isPaid).length;
  const cols = freeCount >= 5 ? 3 : freeCount >= 2 ? 2 : 1;

  return (
    <div style={{ marginBottom: 16, padding: '16px 16px', background: bg, borderRadius: 16, border: `1px solid ${border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>📦</span>
        <div style={{ fontWeight: 700, fontSize: 15, color: titleColor }}>
          {t(L.section, lang)}
        </div>
      </div>
      <div
        className="gfx-dl-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: cols === 1 ? '1fr' : `repeat(${Math.min(cols, 2)}, minmax(0, 1fr))`,
          gap: 10,
        }}
      >
        {links.map(link => (
          <DownloadLinkButton
            key={link.id}
            link={link}
            lang={lang}
            theme={theme}
            projectTitle={projectTitle || pickML(item.title, lang)}
            itemId={item.id}
            waPhone={waPhone}
            contactEmail={contactEmail}
            freeBtnColor={freeBtnColor}
            freeBtnTextColor={freeBtnTextColor}
          />
        ))}
      </div>
    </div>
  );
}
