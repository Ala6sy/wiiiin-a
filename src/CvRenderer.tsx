import { CvDoc, CvSection, LangKey, pickML, Skill } from './appData';
import { SkillIcon } from './SkillIcon';

const PRESENT: Record<LangKey, string> = { ar: 'الآن', en: 'Present', de: 'heute' };
const CREATED: Record<LangKey, string> = { ar: 'أُنشئت', en: 'Created', de: 'Erstellt' };
const YEARS: Record<LangKey, string> = { ar: 'سنوات خبرة', en: 'years of experience', de: 'Jahre Erfahrung' };
const SCAN: Record<LangKey, string> = { ar: 'مسح للتحقق', en: 'Scan to verify', de: 'Zum Verifizieren scannen' };
const DOCS: Record<LangKey, string> = { ar: 'الوثائق', en: 'Documents', de: 'Dokumente' };

function calcYears(since: number) { const y = new Date().getFullYear() - (since || 2016); return y > 0 ? y : 1; }

function dateStamp(lang: LangKey) {
  const locale = lang === 'ar' ? 'ar-EG' : lang === 'de' ? 'de-DE' : 'en-GB';
  try { return new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long' }); } catch { return new Date().getFullYear().toString(); }
}

function qrUrl(url: string, size = 110) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
}

function SectionBody({ sec, lang, skills, accent }: { sec: CvSection; lang: LangKey; skills: Skill[]; accent: string }) {
  switch (sec.kind) {
    case 'contact':
      return (
        <>
          {(sec.contactItems || []).map(c => c.value && (
            <div key={c.id} className="cv-item">
              <b>{pickML(c.label, lang)}:</b>{' '}
              {c.ltr ? <span className="cv-ltr">{c.value}</span> : c.value}
            </div>
          ))}
        </>
      );

    case 'tags':
      return (
        <>
          {(sec.tags || []).map((tg, i) => {
            const txt = pickML(tg, lang);
            return txt ? <div key={i} className="cv-item">• {txt}</div> : null;
          })}
        </>
      );

    case 'skillbars':
      return (
        <>
          {skills.map(s => (
            <div key={s.id} className="cv-skill-bar-row">
              <div className="cv-skill-bar-header">
                <span className="cv-skill-bar-name" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <SkillIcon icon={s.icon} size={14} />
                  {s.name}
                </span>
                <span className="cv-skill-bar-pct cv-ltr">{s.percent}%</span>
              </div>
              <div className="cv-skill-bar-track">
                <div className="cv-skill-bar-fill" style={{ width: `${s.percent}%`, background: accent }} />
              </div>
            </div>
          ))}
        </>
      );

    case 'entries':
      return (
        <>
          {(sec.entries || []).map(e => {
            const title = pickML(e.title, lang);
            const org = pickML(e.org, lang);
            const desc = pickML(e.desc, lang);
            const to = e.to === 'present' ? PRESENT[lang] : e.to;
            const hasDate = e.from || e.to;
            return (
              <div key={e.id} className="cv-item" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                {hasDate && <div className="cv-date" style={{ color: accent }}>{e.from}{e.from && to ? ' – ' : ''}{to}</div>}
                {title && <b>{title}</b>}
                {org && <> — {org}</>}
                {desc && <><br />{desc}</>}
              </div>
            );
          })}
        </>
      );

    case 'text': {
      const txt = pickML(sec.text, lang);
      return txt ? <div className="cv-item" style={{ whiteSpace: 'pre-line' }}>{txt}</div> : null;
    }

    case 'portfolio': {
      const cols = sec.galleryLayout ?? 2;
      const imgH = sec.imgHeight ?? 130;
      const items = (sec.portfolio || []);
      if (items.length === 0) return null;

      return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, marginTop: 6 }}>
          {items.map(p => {
            const caption = pickML(p.caption, lang);
            const desc = p.showDesc && p.description ? pickML(p.description, lang) : '';
            const toolSkills = p.showTools && p.toolIds
              ? p.toolIds.map(tid => skills.find(s => s.id === tid)).filter(Boolean) as Skill[]
              : [];
            const hasQr = p.showQr && p.qrUrl;
            const hasFooter = toolSkills.length > 0 || hasQr;

            return (
              <div key={p.id} style={{
                breakInside: 'avoid',
                pageBreakInside: 'avoid',
                border: `1px solid ${accent}30`,
                borderRadius: 7,
                overflow: 'hidden',
                background: '#fafbff',
              }}>
                {p.img && (
                  <img
                    src={p.img}
                    alt={caption}
                    style={{
                      width: '100%',
                      height: imgH,
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                )}
                <div style={{ padding: '5px 7px' }}>
                  {caption && (
                    <div style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      color: '#222',
                      marginBottom: desc ? 2 : 0,
                      lineHeight: 1.3,
                    }}>
                      {caption}
                    </div>
                  )}
                  {desc && (
                    <div style={{
                      fontSize: 8,
                      color: '#666',
                      lineHeight: 1.4,
                      marginBottom: hasFooter ? 4 : 0,
                    }}>
                      {desc}
                    </div>
                  )}
                  {hasFooter && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 4,
                      marginTop: 3,
                    }}>
                      {toolSkills.length > 0 && (
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', flex: 1 }}>
                          {toolSkills.map(s => (
                            <span key={s.id} title={s.name} style={{ display: 'inline-flex', alignItems: 'center' }}>
                              <SkillIcon icon={s.icon} size={13} />
                            </span>
                          ))}
                        </div>
                      )}
                      {hasQr && (
                        <a href={p.qrUrl} target="_blank" rel="noreferrer" style={{ flexShrink: 0 }}>
                          <img
                            src={qrUrl(p.qrUrl!, 56)}
                            alt="QR"
                            style={{ width: 36, height: 36, display: 'block', borderRadius: 3 }}
                          />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    default:
      return null;
  }
}

function Section({ sec, lang, skills, accent }: { sec: CvSection; lang: LangKey; skills: Skill[]; accent: string }) {
  if (!sec.visible || sec.kind === 'header') return null;
  return (
    <div
      className="cv-block"
      style={sec.pageBreakBefore ? { pageBreakBefore: 'always', breakBefore: 'page' } : undefined}
    >
      <div className="cv-sec-title" style={{ borderColor: accent, color: accent }}>{pickML(sec.title, lang)}</div>
      <SectionBody sec={sec} lang={lang} skills={skills} accent={accent} />
    </div>
  );
}

export function CvRenderer({ doc, lang, name, skills }: { doc: CvDoc; lang: LangKey; name: string; skills: Skill[] }) {
  const accent = doc.globalColor || doc.accent || '#003366';
  const footerBg = doc.footerBgColor || '#003366';
  const footerTxt = pickML(doc.footerText, lang) || 'eng-alaa.com';
  const sidebarDocs = doc.sidebarDocs || [];
  const qrCredentials = doc.qrCredentials || [];

  const header = doc.sections.find(s => s.kind === 'header');
  const showHeader = !header || header.visible;
  const fullName = pickML(doc.fullName, lang) || name;
  const subtitle = pickML(doc.subtitle, lang);
  const visible = doc.sections.filter(s => s.visible && s.kind !== 'header');
  const left = visible.filter(s => s.column === 'left');
  const right = visible.filter(s => s.column === 'right');
  const full = visible.filter(s => s.column === 'full');
  const years = calcYears(doc.since);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div style={{ flex: 1 }}>
        {showHeader && (
          <div className="cv-head" style={{ borderBottomColor: accent }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
              {doc.photo && (
                <img src={doc.photo} alt="" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${accent}`, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div className="cv-name-big" style={{ color: accent }}>{fullName}</div>
                {subtitle && <div className="cv-sub">{subtitle}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <div className="cv-stamp">{CREATED[lang]}: {dateStamp(lang)}</div>
              {sidebarDocs.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: '#888', alignSelf: 'center' }}>{DOCS[lang]}:</span>
                  {sidebarDocs.map(sd => (
                    <a key={sd.id} href={sd.fileUrl} target="_blank" rel="noreferrer"
                      title={pickML(sd.title, lang)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, color: accent, textDecoration: 'none', background: `${accent}18`, padding: '2px 6px', borderRadius: 4, border: `1px solid ${accent}44` }}>
                      <i className={`fa-solid ${sd.icon || 'fa-file'}`} style={{ fontSize: 9 }} />
                      {pickML(sd.title, lang)}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="cv-two-col">
          <div className="cv-col-l" style={{ borderColor: `${accent}33` }}>
            {left.map(s => <Section key={s.id} sec={s} lang={lang} skills={skills} accent={accent} />)}
            {doc.since > 0 && (
              <div className="cv-item" style={{ marginTop: 10, background: `${accent}0f`, padding: 8, borderRadius: 6, fontSize: 11, borderLeft: `3px solid ${accent}` }}>
                <b style={{ color: accent }}>{years} {YEARS[lang]}</b>
              </div>
            )}
          </div>
          <div>
            {right.map(s => <Section key={s.id} sec={s} lang={lang} skills={skills} accent={accent} />)}
          </div>
        </div>

        {full.map(s => (
          <div key={s.id} style={{ marginTop: 22 }}>
            <Section sec={s} lang={lang} skills={skills} accent={accent} />
          </div>
        ))}

        {qrCredentials.length > 0 && (
          <div style={{ marginTop: 24, padding: '16px 12px', background: '#f8f9fb', borderRadius: 8, border: `1px solid ${accent}22` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, marginBottom: 12, letterSpacing: 0.5 }}>
              {SCAN[lang]}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {qrCredentials.map(qr => (
                <div key={qr.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <a href={qr.driveUrl} target="_blank" rel="noreferrer">
                    <img src={qrUrl(qr.driveUrl)} alt={pickML(qr.caption, lang)} style={{ width: 80, height: 80, display: 'block', border: `2px solid ${accent}44`, borderRadius: 6 }} />
                  </a>
                  <span style={{ fontSize: 8, color: '#666', textAlign: 'center', maxWidth: 80 }}>{pickML(qr.caption, lang)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ background: footerBg, color: '#fff', padding: '8px 16px', marginTop: 20, borderRadius: '0 0 6px 6px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 10, letterSpacing: 0.8 }}>
        {footerTxt}
      </div>
    </div>
  );
}
