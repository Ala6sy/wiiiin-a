import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CvDoc, CvEditTarget, CvFooterLayout, CvQrCredential, CvSection, CvTypography, LangKey, mergeCvTypography, ml, pickML, resolveCvEntryAlign, Skill, cvTypographyVars } from './appData';
import { resolvePageBands, type ResolvedPageBands } from './cvPageBands';
import { baseCvTypography, scaleCvTypography, shouldCompressCvForLang, CV_LANG_FIT_MIN } from './cvLangFit';
import { CV_EXPORT_PX, cvLayout } from './cvPdfExport';
import {
  planCvPageOffsets, CV_SHEET_INNER_H,
} from './cvPagedLayout';
import {
  buildPhysicalPagePlan, isFlowSection, sectionOnPinnedPage, type CvPhysicalPagePlan,
} from './cvPagePlan';
import { rasterizeSectionTitle } from './cvSectionTitleRaster';
import { hasArabic } from './cvTextRaster';
import { formatWesternMonthYear } from './formatLocale';
import { SkillIcon } from './SkillIcon';

const PRESENT: Record<LangKey, string> = { ar: 'الآن', en: 'Present', de: 'heute' };
const CREATED: Record<LangKey, string> = { ar: 'أُنشئت', en: 'Created', de: 'Erstellt' };
const YEARS: Record<LangKey, string> = { ar: 'سنوات خبرة', en: 'years of experience', de: 'Jahre Erfahrung' };
const SCAN: Record<LangKey, string> = { ar: 'مسح للتحقق', en: 'Scan to verify', de: 'Zum Verifizieren scannen' };
const DOCS: Record<LangKey, string> = { ar: 'الوثائق', en: 'Documents', de: 'Dokumente' };

export type CvRenderPart = 'all' | 'body' | 'header' | 'footer' | 'continued-header' | 'continued-footer';

function calcYears(since: number) { const y = new Date().getFullYear() - (since || 2016); return y > 0 ? y : 1; }

function dateStamp(lang: LangKey) {
  try { return formatWesternMonthYear(lang); } catch { return String(new Date().getFullYear()); }
}

function qrUrl(url: string, size = 110) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
}

function skillsForSection(sec: CvSection, skills: Skill[]): Skill[] {
  if (sec.skillIds && sec.skillIds.length > 0) {
    return sec.skillIds
      .map(id => skills.find(s => s.id === id))
      .filter(Boolean) as Skill[];
  }
  if (sec.useGlobalSkills === false) return [];
  return skills;
}

function editProps(editMode: boolean, onEdit: (() => void) | undefined, title?: string, extraClass?: string) {
  if (!editMode || !onEdit) return extraClass ? { className: extraClass } : {};
  const cls = ['cv-edit-hit', extraClass].filter(Boolean).join(' ');
  return {
    className: cls,
    role: 'button' as const,
    tabIndex: 0,
    title: title || 'انقر للتعديل',
    onClick: (e: MouseEvent) => { e.stopPropagation(); onEdit(); },
    onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEdit(); } },
  };
}

function CvSectionTitle({
  text, accent, barH, fontPx, fontWeight, rtl, editMode, onEdit,
}: {
  text: string; accent: string; barH: number;
  fontPx: number; fontWeight: number; rtl: boolean;
  editMode?: boolean; onEdit?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [imgSrc, setImgSrc] = useState('');
  const [imgW, setImgW] = useState(0);

  const paint = useCallback(async () => {
    const el = wrapRef.current;
    if (!el || !text) return;
    const w = Math.round(el.offsetWidth);
    if (w < 12) return;
    const url = await rasterizeSectionTitle(w, barH, text, accent, rtl, fontPx, fontWeight);
    if (url) {
      setImgW(w);
      setImgSrc(url);
      el.dataset.cvTitleReady = '1';
    }
  }, [text, accent, barH, fontPx, fontWeight, rtl]);

  useLayoutEffect(() => {
    let cancelled = false;
    const run = async () => {
      await paint();
      if (cancelled) return;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (!cancelled) await paint();
    };
    void run();

    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') {
      return () => { cancelled = true; };
    }
    const ro = new ResizeObserver(() => { void paint(); });
    ro.observe(el);
    return () => { cancelled = true; ro.disconnect(); };
  }, [paint]);

  return (
    <div
      ref={wrapRef}
      {...editProps(editMode ?? false, onEdit, 'تعديل عنوان القسم', 'cv-sec-title cv-sec-title--raster')}
      style={{ height: barH }}
      data-cv-title-text={text}
      data-cv-bar-h={String(barH)}
      data-cv-accent={accent}
      data-cv-rtl={rtl ? '1' : '0'}
      data-cv-font-px={String(fontPx)}
      data-cv-font-weight={String(fontWeight)}
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt=""
          className="cv-sec-title-img"
          width={imgW}
          height={barH}
          style={{ display: 'block', width: imgW, maxWidth: '100%', height: barH }}
          draggable={false}
        />
      ) : (
        <span className="cv-sec-title-placeholder" aria-hidden="true">{text}</span>
      )}
    </div>
  );
}

function CvDocumentsGrid({
  items, cols, lang, accent,
}: {
  items: CvQrCredential[]; cols: number; lang: LangKey; accent: string;
}) {
  const active = items.filter(q => q.driveUrl);
  const itemCount = active.length;
  const gridCols = Math.min(5, Math.max(2, cols < itemCount ? itemCount : cols));
  const qrSize = gridCols >= 4 ? 54 : gridCols === 3 ? 68 : 76;
  const gap = gridCols >= 4 ? 6 : 10;
  return (
    <div
      className="cv-docs-qr-grid cv-page-break-avoid"
      data-qr-cols={gridCols}
      data-qr-count={itemCount}
      style={{
        gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
        gap: `${gap}px`,
        ['--cv-qr-cols' as string]: String(gridCols),
      }}
    >
      {active.map(qr => {
        const caption = pickML(qr.caption, lang);
        return (
          <div key={qr.id} className="cv-docs-qr-cell cv-page-break-avoid">
            <a href={qr.driveUrl} target="_blank" rel="noreferrer" className="cv-docs-qr-link">
              <img
                src={qrUrl(qr.driveUrl, 96)}
                alt={caption}
                className="cv-docs-qr-img"
                width={qrSize}
                height={qrSize}
                draggable={false}
              />
            </a>
            {caption && <div className="cv-docs-qr-caption">{caption}</div>}
          </div>
        );
      })}
    </div>
  );
}

function langCellText(v: ML | number | undefined, lang: LangKey): string {
  if (typeof v === 'number') return `${v}%`;
  return pickML(v, lang);
}

function SectionBody({
  sec, doc, lang, skills, accent, editMode, onEditTarget, typo,
}: {
  sec: CvSection; doc: CvDoc; lang: LangKey; skills: Skill[]; accent: string;
  editMode?: boolean;
  onEditTarget?: (t: CvEditTarget) => void;
  typo: Required<CvTypography>;
}) {
  const sectionTarget = () => onEditTarget?.({ tab: 'sections', sectionId: sec.id });
  const entryTarget = (entryId: string) => onEditTarget?.({ tab: 'sections', sectionId: sec.id, entryId });

  switch (sec.kind) {
    case 'contact': {
      const visibleContacts = (sec.contactItems || []).filter(c => pickML(c.value, lang));
      return (
        <>
          {visibleContacts.map((c, idx) => {
            const val = pickML(c.value, lang)!;
            return (
            <div
              key={c.id}
              style={{ marginBottom: idx < visibleContacts.length - 1 ? typo.contactGapPx : 0 }}
              {...editProps(editMode ?? false, sectionTarget, 'تعديل بيانات الاتصال', 'cv-item cv-side-item')}
            >
              <b className="cv-side-label">{pickML(c.label, lang)}:</b>{' '}
              <span className="cv-side-value">
                {c.ltr && !hasArabic(val) ? <span className="cv-ltr">{val}</span> : val}
              </span>
            </div>
            );
          })}
        </>
      );
    }

    case 'tags': {
      const visibleTags = (sec.tags || [])
        .map(tg => pickML(tg, lang))
        .filter((txt): txt is string => !!txt);
      return (
        <>
          {visibleTags.map((txt, i) => (
              <div
                key={i}
                style={{
                  fontSize: typo.tagsPx,
                  fontWeight: typo.tagsWeight,
                  marginBottom: i < visibleTags.length - 1 ? typo.tagsGapPx : 0,
                }}
                {...editProps(editMode ?? false, sectionTarget, 'تعديل الوسوم', 'cv-item cv-tag-item')}
              >• {txt}</div>
          ))}
        </>
      );
    }

    case 'langtable': {
      const cols = sec.langTableCols?.length
        ? sec.langTableCols
        : [
          { id: 'name', header: ml('اللغة') },
          { id: 'level', header: ml('المستوى') },
          { id: 'percent', header: ml('%') },
        ];
      const rows = (sec.langRows || []).filter(r =>
        cols.some(c => {
          const v = r.cells?.[c.id];
          if (typeof v === 'number') return true;
          return !!pickML(v, lang);
        }),
      );
      if (rows.length === 0) return null;
      const pad = sec.langTableCellPadPx ?? 5;
      const gap = sec.langTableColGapPx ?? 0;
      return (
        <table
          className="cv-lang-table"
          style={{
            ['--cv-lang-cell-pad' as string]: `${pad}px`,
            ['--cv-lang-col-gap' as string]: `${gap}px`,
          }}
        >
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c.id} className="cv-lang-table-head">{pickML(c.header, lang)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                {cols.map(c => {
                  const txt = langCellText(r.cells?.[c.id], lang);
                  const isPct = c.id === 'percent' || typeof r.cells?.[c.id] === 'number';
                  return (
                    <td
                      key={c.id}
                      className={`cv-lang-table-cell${c.id === 'name' ? ' cv-lang-table-name' : ''}${isPct ? ' cv-ltr' : ''}`}
                    >
                      {txt}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    case 'documents': {
      const items = doc.qrCredentials || [];
      if (items.length === 0) return null;
      return (
        <CvDocumentsGrid
          items={items}
          cols={doc.qrGridCols ?? 3}
          lang={lang}
          accent={accent}
        />
      );
    }

    case 'skillbars': {
      const barColor = sec.skillBarColor || accent;
      return (
        <>
          {skillsForSection(sec, skills).map(s => (
            <div key={s.id} {...editProps(editMode ?? false, () => onEditTarget?.({ tab: 'skills' }), 'تعديل المهارات', 'cv-skill-bar-row')}>
              <div className="cv-skill-bar-line">
                <span className="cv-skill-bar-pct cv-ltr" style={{ color: barColor }}>{s.percent}%</span>
                <span className="cv-skill-bar-name-chip cv-skill-bar-name">
                  <span className="cv-skill-bar-name-text">{s.name}</span>
                  <SkillIcon icon={s.icon} name={s.name} size={14} />
                </span>
              </div>
              <div className="cv-skill-bar-track">
                <div className="cv-skill-bar-fill" style={{ width: `${s.percent}%`, background: barColor }} />
              </div>
            </div>
          ))}
        </>
      );
    }

    case 'entries':
      return (
        <>
          {(sec.entries || []).map((e, idx, arr) => {
            const title = pickML(e.title, lang);
            const org = pickML(e.org, lang);
            const desc = pickML(e.desc, lang);
            const to = e.to === 'present' ? PRESENT[lang] : e.to;
            const hasDate = e.from || e.to;
            const orgLayout = e.orgLayout ?? typo.defaultOrgLayout;
            const dateTitleLayout = e.dateTitleLayout ?? typo.defaultDateTitleLayout;
            const inlineOrg = orgLayout === 'inline';
            const stackedDateTitle = dateTitleLayout === 'block';
            const entryAlign = resolveCvEntryAlign(lang, typo.entryAlign);
            const headClass = stackedDateTitle ? 'cv-entry-head cv-entry-head--stack' : 'cv-entry-head cv-entry-head--inline-dt';
            return (
              <div
                key={e.id}
                style={{ marginBottom: idx < arr.length - 1 ? typo.entryGapPx : 0 }}
                {...editProps(editMode ?? false, () => entryTarget(e.id), 'تعديل هذا الإدخال', `cv-entry cv-entry-align-${entryAlign}`)}
              >
                {(hasDate || title || (org && inlineOrg)) && (
                  <div
                    className={headClass}
                    style={stackedDateTitle ? { gap: typo.dateTitleGapPx } : undefined}
                  >
                    {hasDate && (
                      <div
                        className="cv-date"
                        style={{
                          color: accent,
                          paddingInlineEnd: stackedDateTitle ? undefined : typo.dateTitleGapPx,
                        }}
                      >
                        {e.from}{e.from && to ? ' – ' : ''}{to}
                      </div>
                    )}
                    {(title || (org && inlineOrg)) && (
                      <div className="cv-entry-headline">
                        {title && <span className="cv-entry-title">{title}</span>}
                        {org && inlineOrg && (
                          <span className="cv-entry-org cv-entry-org--inline"> — {org}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {org && !inlineOrg && (
                  <div className="cv-entry-org cv-entry-org--block" style={{ marginTop: typo.titleOrgGapPx }}>{org}</div>
                )}
                {desc && <div className="cv-entry-desc" style={{ marginTop: typo.entryDetailsGapPx }}>{desc}</div>}
              </div>
            );
          })}
        </>
      );

    case 'text': {
      const txt = pickML(sec.text, lang);
      return txt ? (
        <div
          style={{ whiteSpace: 'pre-line', fontSize: typo.sideValuePx, fontWeight: typo.sideValueWeight }}
          {...editProps(editMode ?? false, sectionTarget, 'تعديل النص', 'cv-item cv-side-item cv-side-value')}
        >{txt}</div>
      ) : null;
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
              }} {...editProps(editMode ?? false, sectionTarget, 'تعديل المعرض')}>
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
                    <div className="cv-entry-desc" style={{
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
                              <SkillIcon icon={s.icon} name={s.name} size={13} />
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

function Section({
  sec, doc, lang, skills, accent, editMode, onEditTarget, typo,
}: {
  sec: CvSection; doc: CvDoc; lang: LangKey; skills: Skill[]; accent: string;
  editMode?: boolean;
  onEditTarget?: (t: CvEditTarget) => void;
  typo: Required<CvTypography>;
}) {
  if (!sec.visible || sec.kind === 'header') return null;
  const sectionTarget = () => onEditTarget?.({ tab: 'sections', sectionId: sec.id });
  const barH = typo.sectionTitlePx + 18;
  const titleText = pickML(sec.title, lang);
  const rtl = lang === 'ar';
  const avoidBreak = sec.kind === 'documents';
  return (
    <div
      className={`cv-block${sec.pageBreakBefore ? ' cv-page-break-before' : ''}${avoidBreak ? ' cv-page-break-avoid' : ''}`}
      style={sec.pageBreakBefore ? { pageBreakBefore: 'always', breakBefore: 'page' } : undefined}
      data-cv-section={sec.id}
    >
      {titleText ? (
        <CvSectionTitle
          text={titleText}
          accent={accent}
          barH={barH}
          fontPx={typo.sectionTitlePx}
          fontWeight={typo.sectionTitleWeight}
          rtl={rtl}
          editMode={editMode}
          onEdit={sectionTarget}
        />
      ) : null}
      <SectionBody sec={sec} doc={doc} lang={lang} skills={skills} accent={accent} editMode={editMode} onEditTarget={onEditTarget} typo={typo} />
    </div>
  );
}

function CvHeaderBand({
  doc, lang, name, accent, photoSize, minHeightMm, compact, editMode, onEditTarget,
}: {
  doc: CvDoc; lang: LangKey; name: string; accent: string;
  photoSize: number; minHeightMm: number; compact?: boolean;
  editMode?: boolean;
  onEditTarget?: (t: CvEditTarget) => void;
}) {
  const header = doc.sections.find(s => s.kind === 'header');
  if (header && !header.visible) return null;
  const fullName = pickML(doc.fullName, lang) || name;
  const subtitle = pickML(doc.subtitle, lang);
  const sidebarDocs = doc.sidebarDocs || [];
  const photoPx = compact ? Math.round(photoSize * 0.55) : photoSize;

  return (
    <div
      className="cv-head cv-page-header-band"
      style={{
        borderBottomColor: accent,
        minHeight: `${minHeightMm}mm`,
        boxSizing: 'border-box',
        padding: compact ? '4mm 14mm' : undefined,
      }}
      {...editProps(editMode ?? false, () => onEditTarget?.({ tab: 'meta' }), 'تعديل الرأس')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 10 : 16, flex: 1 }}>
        {doc.photo && (
          <img
            src={doc.photo}
            alt=""
            style={{
              width: photoPx,
              height: photoPx,
              borderRadius: '50%',
              objectFit: 'cover',
              border: `3px solid ${accent}`,
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ flex: 1 }}>
          <div className="cv-name-big" style={{ color: accent, fontSize: compact ? 16 : undefined }}>{fullName}</div>
          {subtitle && !compact && <div className="cv-sub">{subtitle}</div>}
        </div>
      </div>
      {!compact && (
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
      )}
    </div>
  );
}

function CvContinuedHeaderBand({
  doc, lang, name, accent, bands, minHeightMm,
}: {
  doc: CvDoc; lang: LangKey; name: string; accent: string;
  bands: ResolvedPageBands; minHeightMm: number;
}) {
  if (bands.hideHeader) return null;
  if (bands.useFirstPageHeader) {
    return (
      <CvHeaderBand
        doc={doc} lang={lang} name={name} accent={accent}
        photoSize={Math.min(100, Math.max(40, doc.headerPhotoSize ?? 72))}
        minHeightMm={bands.headerHeightMm || minHeightMm}
      />
    );
  }

  const label = bands.headerText || pickML(doc.fullName, lang) || name;
  const barH = Math.max(4, (bands.headerHeightMm || minHeightMm) * 0.35);

  if (bands.headerStyle === 'full-bleed') {
    return (
      <div
        className="cv-continued-header-band cv-header-full-bleed"
        style={{
          minHeight: `${Math.max(10, (bands.headerHeightMm || minHeightMm) * 0.45)}mm`,
          background: bands.headerBg,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 14mm',
          boxSizing: 'border-box',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6 }}>{label}</span>
      </div>
    );
  }

  if (bands.headerStyle === 'bar') {
    return (
      <div
        className="cv-continued-header-band cv-header-bar-layout"
        style={{
          minHeight: `${Math.max(10, (bands.headerHeightMm || minHeightMm) * 0.45)}mm`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2mm 0',
          boxSizing: 'border-box',
          background: '#fff',
        }}
      >
        <div
          className="cv-header-color-bar"
          style={{
            width: `${bands.headerBarWidthPct}%`,
            minHeight: `${barH}mm`,
            background: bands.headerBg,
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.6,
          }}
        >
          {label}
        </div>
      </div>
    );
  }

  return (
    <div
      className="cv-continued-header-band"
      style={{
        minHeight: `${Math.max(10, (bands.headerHeightMm || minHeightMm) * 0.45)}mm`,
        borderBottom: `2px solid ${bands.headerBg}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 14mm',
        boxSizing: 'border-box',
        background: '#fff',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 800, color: bands.headerBg }}>{label}</span>
    </div>
  );
}

function CvFooterBand({
  footerBg, footerTxt, minHeightMm, layout, barWidthPct, textInside, editMode, onEditTarget,
}: {
  footerBg: string;
  footerTxt: string;
  minHeightMm: number;
  layout: CvFooterLayout;
  barWidthPct: number;
  textInside: boolean;
  editMode?: boolean;
  onEditTarget?: (t: CvEditTarget) => void;
}) {
  const footerHit = editProps(editMode ?? false, () => onEditTarget?.({ tab: 'branding' }), 'تعديل التذييل');
  if (layout === 'bar') {
    const barH = Math.max(3, minHeightMm * 0.38);
    return (
      <div
        className="cv-footer-bar-layout"
        {...footerHit}
        style={{
          minHeight: `${minHeightMm}mm`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 5,
          padding: '3mm 0',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="cv-footer-color-bar"
          style={{
            width: `${barWidthPct}%`,
            minHeight: `${barH}mm`,
            background: footerBg,
            borderRadius: 3,
            display: textInside ? 'flex' : undefined,
            alignItems: textInside ? 'center' : undefined,
            justifyContent: textInside ? 'center' : undefined,
            color: textInside ? '#fff' : undefined,
            fontSize: textInside ? 10 : undefined,
            letterSpacing: textInside ? 0.8 : undefined,
          }}
        >
          {textInside ? footerTxt : null}
        </div>
        {!textInside && footerTxt && (
          <div className="cv-footer-text-below" style={{ fontSize: 10, color: '#555', letterSpacing: 0.6, fontWeight: 600 }}>
            {footerTxt}
          </div>
        )}
      </div>
    );
  }

  const bleed = layout === 'full-bleed';
  return (
    <div
      className={`cv-page-footer-band${bleed ? ' cv-footer-full-bleed' : ''}`}
      {...footerHit}
      style={{
        background: footerBg,
        color: '#fff',
        minHeight: `${minHeightMm}mm`,
        padding: '0 16px',
        borderRadius: bleed ? 0 : '0 0 6px 6px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: 10,
        letterSpacing: 0.8,
        boxSizing: 'border-box',
      }}
    >
      {footerTxt}
    </div>
  );
}

function CvBodyContent({
  doc, lang, skills, accent, editMode, onEditTarget, typo,
  contentPage, showExtras = true,
}: {
  doc: CvDoc; lang: LangKey; skills: Skill[]; accent: string;
  editMode?: boolean;
  onEditTarget?: (t: CvEditTarget) => void;
  typo: Required<CvTypography>;
  contentPage?: { kind: 'flow' | 'pinned'; pageNum?: number };
  showExtras?: boolean;
}) {
  const visible = doc.sections.filter(s => {
    if (!s.visible || s.kind === 'header') return false;
    if (!contentPage) return true;
    if (contentPage.kind === 'pinned') return sectionOnPinnedPage(s, contentPage.pageNum ?? 0);
    return isFlowSection(s);
  });
  const left = visible.filter(s => s.column === 'left');
  const right = visible.filter(s => s.column === 'right');
  const full = visible.filter(s => s.column === 'full');
  const years = calcYears(doc.since);
  const qrCredentials = doc.qrCredentials || [];
  const hasDocsSection = doc.sections.some(s => s.kind === 'documents' && s.visible);

  return (
    <>
      <div className="cv-two-col">
        <div className="cv-col-l" style={{ borderColor: `${accent}33` }}>
          {left.map(s => <Section key={s.id} sec={s} doc={doc} lang={lang} skills={skills} accent={accent} editMode={editMode} onEditTarget={onEditTarget} typo={typo} />)}
          {doc.since > 0 && showExtras && (
            <div className="cv-item" style={{ marginTop: 10, background: `${accent}0f`, padding: 8, borderRadius: 6, fontSize: 11, borderLeft: `3px solid ${accent}` }}>
              <b style={{ color: accent }}>{years} {YEARS[lang]}</b>
            </div>
          )}
        </div>
        <div>
          {right.map(s => <Section key={s.id} sec={s} doc={doc} lang={lang} skills={skills} accent={accent} editMode={editMode} onEditTarget={onEditTarget} typo={typo} />)}
        </div>
      </div>

      {full.map(s => (
        <div key={s.id} style={{ marginTop: 22 }}>
          <Section sec={s} doc={doc} lang={lang} skills={skills} accent={accent} editMode={editMode} onEditTarget={onEditTarget} typo={typo} />
        </div>
      ))}

      {!hasDocsSection && qrCredentials.length > 0 && showExtras && (
        <div
          className="cv-docs-qr-block cv-page-break-avoid"
          {...editProps(editMode ?? false, () => onEditTarget?.({ tab: 'docs' }), 'تعديل الوثائق')}
        >
          <div className="cv-docs-qr-block-title" style={{ color: accent }}>
            {SCAN[lang]}
          </div>
          <CvDocumentsGrid items={qrCredentials} cols={doc.qrGridCols ?? 3} lang={lang} accent={accent} />
        </div>
      )}
    </>
  );
}

type CvPagedLayoutState = {
  pages: number;
  firstBudget: number;
  contBudget: number;
  plan: CvPhysicalPagePlan[];
};

function CvPagedDocument({
  doc, lang, name, skills, accent, layout, editMode, onEditTarget,
}: {
  doc: CvDoc; lang: LangKey; name: string; skills: Skill[]; accent: string;
  layout: ReturnType<typeof cvLayout>;
  editMode?: boolean;
  onEditTarget?: (t: CvEditTarget) => void;
}) {
  const baseTypo = useMemo(() => baseCvTypography(doc), [doc]);
  const [fitTypo, setFitTypo] = useState(baseTypo);
  const fitFactorRef = useRef(1);
  const typoStyle = useMemo(() => cvTypographyVars(doc, fitTypo) as CSSProperties, [doc, fitTypo]);
  const typo = fitTypo;

  useEffect(() => {
    setFitTypo(baseTypo);
    fitFactorRef.current = 1;
  }, [baseTypo, lang, name, skills]);
  const footerBg = doc.footerBgColor || '#003366';
  const footerTxt = pickML(doc.footerText, lang) || 'eng-alaa.com';
  const contMeasureBands = resolvePageBands(1, doc, lang);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const measureBodyRef = useRef<HTMLDivElement>(null);
  const measureHeaderRef = useRef<HTMLDivElement>(null);
  const measureFooterRef = useRef<HTMLDivElement>(null);
  const measureContHeaderRef = useRef<HTMLDivElement>(null);
  const measureContFooterRef = useRef<HTMLDivElement>(null);
  const [pageLayout, setPageLayout] = useState<CvPagedLayoutState>({
    pages: 1,
    firstBudget: CV_SHEET_INNER_H - 220,
    contBudget: CV_SHEET_INNER_H - 120,
    plan: [{ kind: 'flow', pageNum: 1, flowOffset: 0 }],
  });

  const remeasure = useCallback(() => {
    const bodyH = measureBodyRef.current?.scrollHeight ?? 0;
    const headerH = measureHeaderRef.current?.offsetHeight ?? 0;
    const footerH = measureFooterRef.current?.offsetHeight ?? 0;
    const contHeaderH = measureContHeaderRef.current?.offsetHeight ?? 0;
    const contFooterH = measureContFooterRef.current?.offsetHeight ?? 0;
    const firstBudget = Math.max(120, CV_SHEET_INNER_H - headerH - footerH);
    const contBudget = Math.max(120, CV_SHEET_INNER_H - contHeaderH - contFooterH);
    const breakStarts: number[] = [];
    measureBodyRef.current?.querySelectorAll('.cv-page-break-before').forEach(el => {
      breakStarts.push((el as HTMLElement).offsetTop);
    });
    const avoidZones: { top: number; height: number }[] = [];
    measureBodyRef.current?.querySelectorAll('.cv-page-break-avoid').forEach(el => {
      const h = el as HTMLElement;
      if (h.offsetHeight > 0) avoidZones.push({ top: h.offsetTop, height: h.offsetHeight });
    });
    const contentOffsets = planCvPageOffsets(bodyH, breakStarts, firstBudget, contBudget, avoidZones);
    const plan = buildPhysicalPagePlan(
      contentOffsets,
      doc.pageSequence,
      doc.sections,
      doc.extraBlankPages ?? 0,
    );
    setPageLayout({ pages: plan.length, firstBudget, contBudget, plan });
  }, [doc.extraBlankPages, doc.pageSequence, doc.sections]);

  useLayoutEffect(() => {
    remeasure();
    requestAnimationFrame(() => requestAnimationFrame(remeasure));
  }, [doc, lang, skills, name, fitTypo, remeasure]);

  useLayoutEffect(() => {
    const bodyH = measureBodyRef.current?.scrollHeight ?? 0;
    if (!shouldCompressCvForLang(lang, pageLayout.pages, bodyH)) return;
    if (fitFactorRef.current <= CV_LANG_FIT_MIN) return;
    fitFactorRef.current *= 0.9;
    setFitTypo(scaleCvTypography(baseTypo, fitFactorRef.current));
  }, [pageLayout, lang, baseTypo]);

  useLayoutEffect(() => {
    const el = measureBodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => remeasure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [remeasure]);

  const bodyProps = { doc, lang, skills, accent, editMode, onEditTarget };

  return (
    <>
      <div className="cv-paged-measure" aria-hidden="true">
        <div style={{ width: CV_EXPORT_PX, direction: dir }}>
          <div ref={measureHeaderRef}>
            <CvHeaderBand
              doc={doc} lang={lang} name={name} accent={accent}
              photoSize={layout.headerPhotoSize} minHeightMm={layout.headerHeightMm}
            />
          </div>
          <div ref={measureFooterRef}>
            <CvFooterBand
              footerBg={footerBg} footerTxt={footerTxt}
              minHeightMm={layout.footerHeightMm}
              layout={doc.footerLayout ?? 'content-full'}
              barWidthPct={doc.footerBarWidthPct ?? 55}
              textInside={doc.footerTextInside === true}
            />
          </div>
          <div ref={measureContHeaderRef}>
            <CvContinuedHeaderBand
              doc={doc} lang={lang} name={name} accent={accent} bands={contMeasureBands}
              minHeightMm={layout.headerHeightMm}
            />
          </div>
          <div ref={measureContFooterRef}>
            {!contMeasureBands.hideFooter && (
              <CvFooterBand
                footerBg={contMeasureBands.footerBg} footerTxt={contMeasureBands.footerTxt}
                minHeightMm={contMeasureBands.footerHeightMm}
                layout={contMeasureBands.footerLayout}
                barWidthPct={contMeasureBands.footerBarWidthPct}
                textInside={contMeasureBands.footerTextInside}
              />
            )}
          </div>
          <div ref={measureBodyRef} className="cv-page-body-inner" style={typoStyle}>
            <CvBodyContent {...bodyProps} typo={typo} contentPage={{ kind: 'flow' }} />
          </div>
        </div>
      </div>

      <div className="cv-paged-root" data-cv-page-count={pageLayout.pages}>
        {pageLayout.plan.map((pagePlan, pageIndex) => {
          const isFirst = pageIndex === 0;
          const bodyBudget = isFirst ? pageLayout.firstBudget : pageLayout.contBudget;
          const bands = resolvePageBands(pageIndex, doc, lang);
          const pageNum = pagePlan.pageNum;
          return (
            <div
              key={`${pageIndex}-${pagePlan.kind}-${pageNum}`}
              className="a4-page cv-a4-sheet cvx-preview-a4 cvx-preview-a4-full"
              style={{ width: CV_EXPORT_PX, direction: dir }}
              data-cv-page={pageNum}
              data-cv-page-kind={pagePlan.kind}
            >
              <div
                className="cv-page-frame cv-page-frame--paged"
                style={{ ...typoStyle, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}
              >
                <div style={{ flexShrink: 0 }}>
                  {isFirst ? (
                    <CvHeaderBand
                      doc={doc} lang={lang} name={name} accent={accent}
                      photoSize={layout.headerPhotoSize} minHeightMm={layout.headerHeightMm}
                      editMode={editMode} onEditTarget={onEditTarget}
                    />
                  ) : (
                    <CvContinuedHeaderBand
                      doc={doc} lang={lang} name={name} accent={accent} bands={bands}
                      minHeightMm={layout.headerHeightMm}
                    />
                  )}
                </div>
                <div
                  className="cv-page-body-window"
                  data-cv-body-budget={bodyBudget}
                  style={{ height: bodyBudget, flexShrink: 0 }}
                >
                  {pagePlan.kind === 'blank' ? null : pagePlan.kind === 'pinned' ? (
                    <div className="cv-page-body-inner">
                      <CvBodyContent
                        {...bodyProps}
                        typo={typo}
                        contentPage={{ kind: 'pinned', pageNum }}
                        showExtras={false}
                      />
                    </div>
                  ) : (
                    <div
                      className="cv-page-body-shift"
                      data-cv-flow-offset={pagePlan.flowOffset ?? 0}
                      style={{ transform: `translateY(-${pagePlan.flowOffset ?? 0}px)` }}
                    >
                      <div className="cv-page-body-inner">
                        <CvBodyContent
                          {...bodyProps}
                          typo={typo}
                          contentPage={{ kind: 'flow' }}
                          showExtras={(pagePlan.flowOffset ?? 0) === 0}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0, marginTop: 'auto' }}>
                  {isFirst ? (
                    <CvFooterBand
                      footerBg={footerBg} footerTxt={footerTxt}
                      minHeightMm={layout.footerHeightMm}
                      layout={doc.footerLayout ?? 'content-full'}
                      barWidthPct={doc.footerBarWidthPct ?? 55}
                      textInside={doc.footerTextInside === true}
                      editMode={editMode} onEditTarget={onEditTarget}
                    />
                  ) : !bands.hideFooter ? (
                    <CvFooterBand
                      footerBg={bands.footerBg} footerTxt={bands.footerTxt}
                      minHeightMm={bands.footerHeightMm}
                      layout={bands.footerLayout}
                      barWidthPct={bands.footerBarWidthPct}
                      textInside={bands.footerTextInside}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function CvRenderer({
  doc, lang, name, skills, part = 'all', editMode, onEditTarget,
}: {
  doc: CvDoc; lang: LangKey; name: string; skills: Skill[];
  part?: CvRenderPart;
  editMode?: boolean;
  onEditTarget?: (t: CvEditTarget) => void;
}) {
  const accent = doc.globalColor || doc.accent || '#003366';
  const layout = cvLayout(doc);
  const typoStyle = cvTypographyVars(doc) as CSSProperties;
  const footerBg = doc.footerBgColor || '#003366';
  const footerTxt = pickML(doc.footerText, lang) || 'eng-alaa.com';

  if (part === 'header') {
    return (
      <CvHeaderBand
        doc={doc} lang={lang} name={name} accent={accent}
        photoSize={layout.headerPhotoSize} minHeightMm={layout.headerHeightMm}
      />
    );
  }

  if (part === 'continued-header') {
    const bands = resolvePageBands(1, doc, lang);
    return (
      <CvContinuedHeaderBand
        doc={doc} lang={lang} name={name} accent={accent} bands={bands}
        minHeightMm={layout.headerHeightMm}
      />
    );
  }

  if (part === 'footer') {
    return (
      <CvFooterBand
        footerBg={footerBg}
        footerTxt={footerTxt}
        minHeightMm={layout.footerHeightMm}
        layout={doc.footerLayout ?? 'content-full'}
        barWidthPct={doc.footerBarWidthPct ?? 55}
        textInside={doc.footerTextInside === true}
      />
    );
  }

  if (part === 'continued-footer') {
    const bands = resolvePageBands(1, doc, lang);
    if (bands.hideFooter) return null;
    return (
      <CvFooterBand
        footerBg={bands.footerBg}
        footerTxt={bands.footerTxt}
        minHeightMm={bands.footerHeightMm}
        layout={bands.footerLayout}
        barWidthPct={bands.footerBarWidthPct}
        textInside={bands.footerTextInside}
      />
    );
  }

  if (part === 'body') {
    return (
      <div className="cv-page-body-inner" style={typoStyle}>
        <CvBodyContent doc={doc} lang={lang} skills={skills} accent={accent} editMode={editMode} onEditTarget={onEditTarget} typo={mergeCvTypography(doc.typography)} />
      </div>
    );
  }

  return (
    <CvPagedDocument
      doc={doc}
      lang={lang}
      name={name}
      skills={skills}
      accent={accent}
      layout={layout}
      editMode={editMode}
      onEditTarget={onEditTarget}
    />
  );
}
