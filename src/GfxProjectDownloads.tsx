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
  link, lang, theme, projectTitle, itemId, waPhone, contactEmail,
}: {
  link: GfxDownloadLink;
  lang: LangKey;
  theme: 'dark' | 'light';
  projectTitle: string;
  itemId: string;
  waPhone: string;
  contactEmail: string;
}) {
  const [unlocked, setUnlocked] = useState(!(link.password || '').trim());
  const label = (link.label || 'ملف').trim();
  const hasPwd = !!(link.password || '').trim();

  if (link.isPaid) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
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
      <div>
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
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: '#25d366', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
      <i className="fa-solid fa-download" />
      {t(L.free, lang)} — {label}
    </a>
  );
}

export function GfxProjectDownloads({
  item,
  lang,
  theme,
  projectTitle,
  waPhone = '',
  contactEmail = '',
}: {
  item: GfxProjectItem;
  lang: LangKey;
  theme: 'dark' | 'light';
  projectTitle: string;
  waPhone?: string;
  contactEmail?: string;
}) {
  const links = getGfxDownloadLinks(item).filter(l => l.visible !== false && l.url.trim());
  if (!links.length) return null;

  const border = theme === 'dark' ? 'rgba(0,180,130,0.22)' : '#a0e0c8';
  const bg = theme === 'dark' ? 'rgba(0,180,130,0.08)' : '#f0fff8';

  return (
    <div style={{ marginBottom: 16, padding: '18px 20px', background: bg, borderRadius: 16, border: `1px solid ${border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 24 }}>📦</span>
        <div style={{ fontWeight: 700, fontSize: 15, color: theme === 'dark' ? '#7fddbb' : '#006644' }}>
          {t(L.section, lang)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          />
        ))}
      </div>
    </div>
  );
}
