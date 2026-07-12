import { useState } from 'react';
import type { GfxProjectItem } from './appData';
import type { LangKey } from './appData';
import { pickML } from './appData';
import { driveDownloadUrl } from './mediaUrl';
import { trackFileDownload } from './analytics';

const L = {
  title: { ar: 'ملف التصميم الأصلي', en: 'Original Design File', de: 'Original-Designdatei' },
  hint: { ar: 'للتعديل — PSD، AutoCAD، Cinema 4D، Blender…', en: 'For editing — PSD, AutoCAD, Cinema 4D, Blender…', de: 'Zum Bearbeiten — PSD, AutoCAD, Cinema 4D…' },
  download: { ar: 'تنزيل الملف الأصلي', en: 'Download Source File', de: 'Quelldatei herunterladen' },
  passwordPh: { ar: 'أدخل كلمة السر', en: 'Enter password', de: 'Passwort eingeben' },
  unlock: { ar: 'فتح التنزيل', en: 'Unlock Download', de: 'Download freischalten' },
  wrong: { ar: 'كلمة السر غير صحيحة', en: 'Incorrect password', de: 'Falsches Passwort' },
  protected: { ar: 'محمي بكلمة سر', en: 'Password protected', de: 'Passwortgeschützt' },
};

function t(m: Record<LangKey, string>, lang: LangKey) {
  return m[lang] || m.en;
}

export function GfxSourceFileDownload({
  item,
  lang,
  theme,
}: {
  item: GfxProjectItem;
  lang: LangKey;
  theme: 'dark' | 'light';
}) {
  const url = (item.sourceFileUrl || '').trim();
  const visible = item.sourceFileVisible !== false;
  if (!url || !visible) return null;

  const hasPwd = !!(item.sourceFilePassword || '').trim();
  const [pwd, setPwd] = useState('');
  const [unlocked, setUnlocked] = useState(!hasPwd);
  const [err, setErr] = useState(false);
  const downloadUrl = driveDownloadUrl(url);
  const label = (item.sourceFileLabel || '').trim();
  const border = theme === 'dark' ? 'rgba(100,180,255,0.22)' : '#aac4ee';
  const bg = theme === 'dark' ? 'rgba(68,136,255,0.08)' : '#f0f4ff';

  const tryUnlock = () => {
    if (pwd.trim() === (item.sourceFilePassword || '').trim()) {
      setUnlocked(true);
      setErr(false);
    } else {
      setErr(true);
    }
  };

  return (
    <div style={{ marginBottom: 16, padding: '18px 20px', background: bg, borderRadius: 16, border: `1px solid ${border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 26 }}>📁</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: theme === 'dark' ? '#a8c8f0' : '#003366' }}>
            {t(L.title, lang)}
            {label ? ` (${label})` : ''}
          </div>
          <div style={{ fontSize: 12, color: theme === 'dark' ? '#8aa8cc' : '#667' }}>{t(L.hint, lang)}</div>
          {hasPwd && !unlocked && (
            <div style={{ fontSize: 11, color: theme === 'dark' ? '#f0c060' : '#996600', marginTop: 4, fontWeight: 600 }}>
              <i className="fa-solid fa-lock" style={{ marginInlineEnd: 5 }} />{t(L.protected, lang)}
            </div>
          )}
        </div>
      </div>

      {hasPwd && !unlocked ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
          <input
            type="password"
            value={pwd}
            onChange={e => { setPwd(e.target.value); setErr(false); }}
            onKeyDown={e => e.key === 'Enter' && tryUnlock()}
            placeholder={t(L.passwordPh, lang)}
            style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${err ? '#e53935' : border}`, fontFamily: 'inherit', fontSize: 13, background: theme === 'dark' ? 'rgba(0,0,0,0.25)' : '#fff', color: theme === 'dark' ? '#dfe9f8' : '#003366' }}
          />
          {err && <span style={{ fontSize: 12, color: '#e53935', fontWeight: 600 }}><i className="fa-solid fa-triangle-exclamation" /> {t(L.wrong, lang)}</span>}
          <button type="button" onClick={tryUnlock}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, background: '#003366', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <i className="fa-solid fa-unlock" /> {t(L.unlock, lang)}
          </button>
        </div>
      ) : (
        <a href={downloadUrl} target="_blank" rel="noopener noreferrer"
          onClick={() => trackFileDownload(label || pickML(item.title, lang) || 'source file', item.id)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: '#003366', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
          <i className="fa-solid fa-download" />
          {t(L.download, lang)}
          {label ? ` — ${label}` : ''}
        </a>
      )}
    </div>
  );
}
