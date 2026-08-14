/**
 * يولّد صفحات HTML لتقارير التربة النموذجية (عربي / إنجليزي / ألماني)
 * تشغيل: node scripts/generate-soil-sample-reports.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'reports');

const ENG = {
  ar: 'م. علاء أحمد المصري',
  en: 'Eng. Alaa Ahmad Almasri',
  de: 'Ing. Alaa Ahmad Almasri',
};

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(report) {
  const langs = ['ar', 'en', 'de'];
  const labels = {
    ar: {
      title: 'تقرير تحليل التربة',
      customer: 'بيانات العميل',
      name: 'الاسم',
      phone: 'الهاتف',
      location: 'الموقع',
      attendance: 'تاريخ الحضور',
      exam: 'تاريخ الفحص',
      plant: 'النبات',
      desc: 'الوصف',
      soil: 'نتائج تحليل التربة',
      test: 'عنصر الفحص',
      actual: 'النتيجة الفعلية',
      ideal: 'القراءة المثلى للنبات',
      final: 'التقرير النهائي والتوصيات',
      sign: 'توقيع المهندس',
      stamp: 'الختم',
      sample: 'نموذج عرض — توقيع وختم المهندس كما في إعدادات التقرير بالموقع',
      print: 'طباعة / PDF',
    },
    en: {
      title: 'Soil Analysis Report',
      customer: 'Customer details',
      name: 'Name',
      phone: 'Phone',
      location: 'Location',
      attendance: 'Attendance date',
      exam: 'Examination date',
      plant: 'Crop',
      desc: 'Description',
      soil: 'Soil analysis results',
      test: 'Test item',
      actual: 'Actual result',
      ideal: 'Ideal for the crop',
      final: 'Final report & recommendations',
      sign: 'Engineer signature',
      stamp: 'Stamp',
      sample: 'Display sample — engineer signature & stamp follow Site Report Settings',
      print: 'Print / PDF',
    },
    de: {
      title: 'Bodenanalysebericht',
      customer: 'Kundendaten',
      name: 'Name',
      phone: 'Telefon',
      location: 'Standort',
      attendance: 'Anwesenheitsdatum',
      exam: 'Untersuchungsdatum',
      plant: 'Kultur',
      desc: 'Beschreibung',
      soil: 'Ergebnisse der Bodenanalyse',
      test: 'Prüfparameter',
      actual: 'Istwert',
      ideal: 'Idealwert für die Kultur',
      final: 'Abschlussbericht & Empfehlungen',
      sign: 'Unterschrift des Ingenieurs',
      stamp: 'Stempel',
      sample: 'Anzeigebeispiel — Unterschrift & Stempel gemäß Berichtseinstellungen der Website',
      print: 'Drucken / PDF',
    },
  };

  const panels = langs.map((lang) => {
    const L = labels[lang];
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const rows = report.soilRows
      .map(
        (r) => `<tr>
        <td>${esc(r.test[lang])}</td>
        <td class="actual">${esc(r.actual[lang])}</td>
        <td class="ideal">${esc(r.ideal[lang])}</td>
      </tr>`,
      )
      .join('\n');
    return `<section class="panel" data-lang="${lang}" dir="${dir}" hidden>
      <header class="head">
        <div>
          <div class="brand">${esc(ENG[lang])}</div>
          <div class="sub">eng-alaa.com · Agricultural Engineering</div>
        </div>
        <div class="head-title">
          <h1>${esc(L.title)}</h1>
          <span class="badge">${esc(report.plantName[lang])}</span>
        </div>
      </header>

      <h2>${esc(L.customer)}</h2>
      <div class="info-grid">
        <div><b>${esc(L.name)}</b><span>${esc(report.customerName)}</span></div>
        <div><b>${esc(L.phone)}</b><span>${esc(report.customerPhone)}</span></div>
        <div><b>${esc(L.location)}</b><span>${esc(report.customerLocation)}</span></div>
        <div><b>${esc(L.attendance)}</b><span>${esc(report.attendanceDate)}</span></div>
        <div><b>${esc(L.exam)}</b><span>${esc(report.examDate)}</span></div>
        <div><b>${esc(L.plant)}</b><span>${esc(report.plantName[lang])}</span></div>
      </div>

      <h2>${esc(L.desc)}</h2>
      <p class="desc">${esc(report.description[lang])}</p>

      <h2>${esc(L.soil)}</h2>
      <table>
        <thead>
          <tr><th>${esc(L.test)}</th><th>${esc(L.actual)}</th><th>${esc(L.ideal)}</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <h2>${esc(L.final)}</h2>
      <p class="final">${esc(report.finalReport[lang])}</p>

      <footer class="sign-row">
        <div class="sign-box">
          <div class="sign-line"></div>
          <div><b>${esc(L.sign)}</b></div>
          <div>${esc(ENG[lang])}</div>
        </div>
        <div class="stamp-box">
          <div class="stamp-circle">${esc(L.stamp)}</div>
          <div class="hint">${esc(L.sample)}</div>
        </div>
      </footer>
    </section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(report.plantName.ar)} — ${esc(report.customerName)} | Soil Report</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap" rel="stylesheet" />
  <style>
    :root { --green:#2a7a2a; --navy:#003366; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Tajawal, sans-serif; background:#eef2f0; color:#1a1a1a; }
    .topbar { position:sticky; top:0; z-index:5; display:flex; gap:8px; flex-wrap:wrap; align-items:center; justify-content:space-between;
      padding:10px 16px; background:#0b1a12; color:#fff; }
    .topbar h1 { margin:0; font-size:15px; font-weight:800; }
    .langs { display:flex; gap:6px; }
    .langs button, .print-btn { border:1px solid rgba(255,255,255,.25); background:rgba(255,255,255,.08); color:#fff;
      border-radius:999px; padding:7px 14px; font:inherit; font-weight:700; font-size:12px; cursor:pointer; }
    .langs button.active { background:var(--green); border-color:var(--green); }
    .wrap { max-width:900px; margin:18px auto 40px; padding:0 12px; }
    .panel { background:#fff; border-radius:14px; padding:28px 26px; box-shadow:0 10px 30px rgba(0,40,20,.08); }
    .head { display:flex; justify-content:space-between; gap:16px; border-bottom:3px solid var(--green); padding-bottom:14px; margin-bottom:18px; flex-wrap:wrap; }
    .brand { font-weight:900; color:var(--navy); font-size:18px; }
    .sub { font-size:11px; color:#667; margin-top:2px; }
    .head-title { text-align:end; }
    .head-title h1 { margin:0; color:var(--green); font-size:18px; }
    .badge { display:inline-block; margin-top:6px; background:var(--green); color:#fff; font-size:11px; font-weight:700; border-radius:999px; padding:3px 12px; }
    h2 { color:var(--green); font-size:15px; margin:20px 0 10px; padding-inline-start:8px; border-inline-start:4px solid var(--green); }
    .info-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:10px; }
    .info-grid div { background:#f6faf6; border:1px solid #d7e8d7; border-radius:10px; padding:10px 12px; }
    .info-grid b { display:block; font-size:11px; color:var(--green); margin-bottom:4px; }
    .info-grid span { font-size:13px; font-weight:700; }
    .desc, .final { line-height:1.85; font-size:14px; white-space:pre-wrap; }
    .final { background:#f3faf3; border:1px solid #cfe3cf; border-radius:12px; padding:14px 16px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th { background:var(--green); color:#fff; padding:9px 8px; text-align:start; }
    td { padding:8px; border-bottom:1px solid #e5efe5; vertical-align:top; }
    td.actual { font-weight:800; color:#8a1c1c; }
    td.ideal { font-weight:700; color:#1b5e20; }
    .sign-row { display:flex; justify-content:space-between; gap:20px; margin-top:34px; flex-wrap:wrap; align-items:flex-end; }
    .sign-box { min-width:200px; text-align:center; }
    .sign-line { height:48px; border-bottom:1.5px solid #333; margin-bottom:8px; }
    .stamp-box { text-align:center; }
    .stamp-circle { width:110px; height:110px; margin:0 auto 8px; border:3px double var(--green); border-radius:50%;
      display:flex; align-items:center; justify-content:center; color:var(--green); font-weight:900; font-size:12px; transform:rotate(-8deg); }
    .hint { font-size:10px; color:#778; max-width:220px; line-height:1.4; margin:0 auto; }
    @media print {
      .topbar { display:none !important; }
      body { background:#fff; }
      .wrap { margin:0; max-width:none; padding:0; }
      .panel { box-shadow:none; border-radius:0; padding:0; }
      .panel[hidden] { display:none !important; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>${esc(report.plantName.ar)} — ${esc(report.customerName)}</h1>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div class="langs">
        <button type="button" data-set="ar" class="active">العربية</button>
        <button type="button" data-set="en">English</button>
        <button type="button" data-set="de">Deutsch</button>
      </div>
      <button type="button" class="print-btn" onclick="window.print()">طباعة / PDF</button>
    </div>
  </div>
  <div class="wrap">
    ${panels}
  </div>
  <script>
    const panels = [...document.querySelectorAll('.panel')];
    const buttons = [...document.querySelectorAll('.langs button')];
    function show(lang) {
      panels.forEach(p => { p.hidden = p.dataset.lang !== lang; });
      buttons.forEach(b => b.classList.toggle('active', b.dataset.set === lang));
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
    buttons.forEach(b => b.addEventListener('click', () => show(b.dataset.set)));
    show('ar');
  </script>
</body>
</html>`;
}

// Inline copies of sample reports (keep in sync with src/soilReportSamples.ts)
const reports = [
  {
    file: 'soil-tomato-ansari.html',
    customerName: 'أحمد الأنصاري / Ahmed Al-Ansari',
    customerPhone: '+971 50 123 4567',
    customerLocation: 'دبي، الإمارات العربية المتحدة / Dubai, UAE',
    attendanceDate: '2026-07-10',
    examDate: '2026-07-12',
    plantName: {
      ar: 'طماطم (Solanum lycopersicum)',
      en: 'Tomato (Solanum lycopersicum)',
      de: 'Tomate (Solanum lycopersicum)',
    },
    description: {
      ar: 'تربة رملية مالحة نسبياً في مزرعة بدبي. لوحظ اصفرار الأوراق السفلية وضعف العقد الثمري. طُلب تحليل تربة شامل لتحديد النقص المعدني ووصفة تسميد للطماطم.',
      en: 'Sandy, moderately saline soil on a Dubai farm. Lower-leaf yellowing and weak fruit set observed. A full soil panel was requested to identify mineral deficiencies and a tomato fertilizer plan.',
      de: 'Sandiger, mäßig salzhaltiger Boden auf einer Farm in Dubai. Vergilbung der unteren Blätter und schwacher Fruchtansatz. Vollständige Bodenanalyse zur Ermittlung von Mineralstoffmängeln und einem Tomaten-Düngeplan.',
    },
    soilRows: [
      { test: { ar: 'درجة الحموضة pH', en: 'Soil pH', de: 'Boden-pH' }, actual: { ar: '7.8', en: '7.8', de: '7.8' }, ideal: { ar: '6.0 – 6.8', en: '6.0 – 6.8', de: '6.0 – 6.8' } },
      { test: { ar: 'الملوحة EC (مللي سيمنز/سم)', en: 'Salinity EC (mS/cm)', de: 'Salzgehalt EC (mS/cm)' }, actual: { ar: '3.2', en: '3.2', de: '3.2' }, ideal: { ar: '< 2.0', en: '< 2.0', de: '< 2.0' } },
      { test: { ar: 'المادة العضوية %', en: 'Organic matter %', de: 'Organische Substanz %' }, actual: { ar: '0.9%', en: '0.9%', de: '0.9%' }, ideal: { ar: '2.0 – 3.5%', en: '2.0 – 3.5%', de: '2.0 – 3.5%' } },
      { test: { ar: 'نيتروجين N (متاح)', en: 'Available Nitrogen N', de: 'Verfügbarer Stickstoff N' }, actual: { ar: 'منخفض / Low', en: 'منخفض / Low', de: 'منخفض / Low' }, ideal: { ar: 'متوسط–مرتفع', en: 'Medium–High', de: 'Mittel–Hoch' } },
      { test: { ar: 'فوسفور P (متاح)', en: 'Available Phosphorus P', de: 'Verfügbarer Phosphor P' }, actual: { ar: 'متوسط / Medium', en: 'متوسط / Medium', de: 'متوسط / Medium' }, ideal: { ar: 'متوسط–مرتفع', en: 'Medium–High', de: 'Mittel–Hoch' } },
      { test: { ar: 'بوتاسيوم K (متاح)', en: 'Available Potassium K', de: 'Verfügbares Kalium K' }, actual: { ar: 'منخفض / Low', en: 'منخفض / Low', de: 'منخفض / Low' }, ideal: { ar: 'مرتفع للطماطم', en: 'High for tomato', de: 'Hoch für Tomate' } },
      { test: { ar: 'كالسيوم Ca', en: 'Calcium Ca', de: 'Calcium Ca' }, actual: { ar: 'متوسط / Medium', en: 'متوسط / Medium', de: 'متوسط / Medium' }, ideal: { ar: 'متوسط–مرتفع', en: 'Medium–High', de: 'Mittel–Hoch' } },
      { test: { ar: 'مغنيسيوم Mg', en: 'Magnesium Mg', de: 'Magnesium Mg' }, actual: { ar: 'منخفض / Low', en: 'منخفض / Low', de: 'منخفض / Low' }, ideal: { ar: 'كافٍ–مرتفع', en: 'Adequate–High', de: 'Ausreichend–Hoch' } },
      { test: { ar: 'كبريت S', en: 'Sulfur S', de: 'Schwefel S' }, actual: { ar: 'منخفض / Low', en: 'منخفض / Low', de: 'منخفض / Low' }, ideal: { ar: 'كافٍ', en: 'Adequate', de: 'Ausreichend' } },
      { test: { ar: 'حديد Fe', en: 'Iron Fe', de: 'Eisen Fe' }, actual: { ar: 'منخفض–متوسط', en: 'منخفض–متوسط', de: 'منخفض–متوسط' }, ideal: { ar: 'كافٍ', en: 'Adequate', de: 'Ausreichend' } },
      { test: { ar: 'زنك Zn', en: 'Zinc Zn', de: 'Zink Zn' }, actual: { ar: 'منخفض / Low', en: 'منخفض / Low', de: 'منخفض / Low' }, ideal: { ar: 'كافٍ', en: 'Adequate', de: 'Ausreichend' } },
      { test: { ar: 'منغنيز Mn', en: 'Manganese Mn', de: 'Mangan Mn' }, actual: { ar: 'متوسط / Medium', en: 'متوسط / Medium', de: 'متوسط / Medium' }, ideal: { ar: 'كافٍ', en: 'Adequate', de: 'Ausreichend' } },
      { test: { ar: 'نحاس Cu', en: 'Copper Cu', de: 'Kupfer Cu' }, actual: { ar: 'كافٍ / OK', en: 'كافٍ / OK', de: 'كافٍ / OK' }, ideal: { ar: 'كافٍ', en: 'Adequate', de: 'Ausreichend' } },
      { test: { ar: 'بورون B', en: 'Boron B', de: 'Bor B' }, actual: { ar: 'منخفض / Low', en: 'منخفض / Low', de: 'منخفض / Low' }, ideal: { ar: 'كافٍ (حساس للطماطم)', en: 'Adequate (tomato-sensitive)', de: 'Ausreichend (tomatenempfindlich)' } },
      { test: { ar: 'صوديوم Na / SAR', en: 'Sodium Na / SAR', de: 'Natrium Na / SAR' }, actual: { ar: 'مرتفع نسبياً', en: 'مرتفع نسبياً', de: 'مرتفع نسبياً' }, ideal: { ar: 'منخفض–متوسط', en: 'Low–Medium', de: 'Niedrig–Mittel' } },
      { test: { ar: 'قوام التربة', en: 'Soil texture', de: 'Bodentextur' }, actual: { ar: 'رملي خفيف', en: 'رملي خفيف', de: 'رملي خفيف' }, ideal: { ar: 'طميي–رملي جيد الصرف', en: 'Loamy–sand, well drained', de: 'Lehmig–sandig, gut drainiert' } },
    ],
    finalReport: {
      ar: 'الخلاصة: نقص واضح في N و K و Mg و Zn و B مع ارتفاع الملوحة وpH القلوي. التوصيات: 1) غسيل ملوحة خفيف وري منتظم دون تغدق. 2) خفض pH تدريجياً بمادة عضوية وكبريت زراعي. 3) تسميد متوازن للطماطم: نيتروجين مرحلي + بوتاسيوم عالي في الإزهار/العقد + مغنيسيوم + زنك وبورون ورقي بحذر. 4) كمبوست ناضج. 5) إعادة تحليل بعد 6–8 أسابيع.',
      en: 'Summary: Clear deficiency in N, K, Mg, Zn and B with elevated salinity and alkaline pH. Recommendations: 1) Light salt leaching and regular irrigation without waterlogging. 2) Gradually lower pH with organic matter and agricultural sulfur. 3) Tomato-balanced nutrition: staged N + high K at flowering/fruit set + Mg + careful foliar Zn/B. 4) Mature compost. 5) Re-test in 6–8 weeks.',
      de: 'Zusammenfassung: Deutlicher Mangel an N, K, Mg, Zn und B bei erhöhtem Salzgehalt und alkalischem pH. Empfehlungen: 1) Leichte Salzauswaschung. 2) pH senken. 3) Tomaten-Düngung mit N gestaffelt + viel K + Mg + vorsichtig Zn/B. 4) Reifer Kompost. 5) Nachkontrolle in 6–8 Wochen.',
    },
  },
  {
    file: 'soil-palm-ansari.html',
    customerName: 'أحمد الأنصاري / Ahmed Al-Ansari',
    customerPhone: '+971 50 123 4567',
    customerLocation: 'دبي، الإمارات العربية المتحدة / Dubai, UAE',
    attendanceDate: '2026-07-10',
    examDate: '2026-07-13',
    plantName: {
      ar: 'نخيل التمر (Phoenix dactylifera)',
      en: 'Date palm (Phoenix dactylifera)',
      de: 'Dattelpalme (Phoenix dactylifera)',
    },
    description: {
      ar: 'نخيل تمر في دبي تظهر عليه حروق أطراف السعف واصفرار بين العروق. يُشتبه بنقص بوتاسيوم ومغنيسيوم مع إجهاد ملحي.',
      en: 'Date palms in Dubai showing frond tip burn and interveinal yellowing. Suspected K/Mg deficiency with salinity stress.',
      de: 'Dattelpalmen in Dubai mit Blattspitzenverbrennung und intervenaler Vergilbung. Verdacht auf K/Mg-Mangel bei Salzstress.',
    },
    soilRows: [
      { test: { ar: 'درجة الحموضة pH', en: 'Soil pH', de: 'Boden-pH' }, actual: { ar: '8.1', en: '8.1', de: '8.1' }, ideal: { ar: '7.0 – 8.0', en: '7.0 – 8.0', de: '7.0 – 8.0' } },
      { test: { ar: 'الملوحة EC (مللي سيمنز/سم)', en: 'Salinity EC (mS/cm)', de: 'Salzgehalt EC (mS/cm)' }, actual: { ar: '4.1', en: '4.1', de: '4.1' }, ideal: { ar: '< 4.0 (تحمل النخيل)', en: '< 4.0 (palm tolerance)', de: '< 4.0 (Palmentoleranz)' } },
      { test: { ar: 'المادة العضوية %', en: 'Organic matter %', de: 'Organische Substanz %' }, actual: { ar: '1.1%', en: '1.1%', de: '1.1%' }, ideal: { ar: '1.5 – 3.0%', en: '1.5 – 3.0%', de: '1.5 – 3.0%' } },
      { test: { ar: 'نيتروجين N', en: 'Nitrogen N', de: 'Stickstoff N' }, actual: { ar: 'متوسط / Medium', en: 'متوسط / Medium', de: 'متوسط / Medium' }, ideal: { ar: 'متوسط', en: 'Medium', de: 'Mittel' } },
      { test: { ar: 'فوسفور P', en: 'Phosphorus P', de: 'Phosphor P' }, actual: { ar: 'متوسط / Medium', en: 'متوسط / Medium', de: 'متوسط / Medium' }, ideal: { ar: 'متوسط', en: 'Medium', de: 'Mittel' } },
      { test: { ar: 'بوتاسيوم K', en: 'Potassium K', de: 'Kalium K' }, actual: { ar: 'ناقص بشدة', en: 'ناقص بشدة', de: 'ناقص بشدة' }, ideal: { ar: 'مرتفع للنخيل', en: 'High for palm', de: 'Hoch für Palme' } },
      { test: { ar: 'مغنيسيوم Mg', en: 'Magnesium Mg', de: 'Magnesium Mg' }, actual: { ar: 'ناقص / Deficient', en: 'ناقص / Deficient', de: 'ناقص / Deficient' }, ideal: { ar: 'كافٍ–مرتفع', en: 'Adequate–High', de: 'Ausreichend–Hoch' } },
      { test: { ar: 'كالسيوم Ca', en: 'Calcium Ca', de: 'Calcium Ca' }, actual: { ar: 'مرتفع / High', en: 'مرتفع / High', de: 'مرتفع / High' }, ideal: { ar: 'متوازن مع K/Mg', en: 'Balanced with K/Mg', de: 'Ausgewogen mit K/Mg' } },
      { test: { ar: 'حديد Fe', en: 'Iron Fe', de: 'Eisen Fe' }, actual: { ar: 'منخفض عند pH مرتفع', en: 'منخفض عند pH مرتفع', de: 'منخفض عند pH مرتفع' }, ideal: { ar: 'كافٍ', en: 'Adequate', de: 'Ausreichend' } },
      { test: { ar: 'زنك Zn', en: 'Zinc Zn', de: 'Zink Zn' }, actual: { ar: 'منخفض / Low', en: 'منخفض / Low', de: 'منخفض / Low' }, ideal: { ar: 'كافٍ', en: 'Adequate', de: 'Ausreichend' } },
      { test: { ar: 'بورون B', en: 'Boron B', de: 'Bor B' }, actual: { ar: 'متوسط / Medium', en: 'متوسط / Medium', de: 'متوسط / Medium' }, ideal: { ar: 'كافٍ (تجنب الزيادة)', en: 'Adequate (avoid excess)', de: 'Ausreichend (Übermaß vermeiden)' } },
      { test: { ar: 'صوديوم Na / SAR', en: 'Sodium Na / SAR', de: 'Natrium Na / SAR' }, actual: { ar: 'مرتفع', en: 'مرتفع', de: 'مرتفع' }, ideal: { ar: 'منخفض–متوسط', en: 'Low–Medium', de: 'Niedrig–Mittel' } },
      { test: { ar: 'الصرف حول الحوض', en: 'Basin drainage', de: 'Beckendrainage' }, actual: { ar: 'متوسط–ضعيف', en: 'متوسط–ضعيف', de: 'متوسط–ضعيف' }, ideal: { ar: 'صرف جيد عميق', en: 'Good deep drainage', de: 'Gute tiefe Drainage' } },
    ],
    finalReport: {
      ar: 'الخلاصة: نقص K و Mg مع ملوحة مرتفعة وpH قلوي يحدّ من امتصاص الحديد والزنك. التوصيات: سماد بوتاسيوم + مغنيسيوم، تحسين صرف الحوض، ري عميق متباعد، مادة عضوية خفيفة، حديد/زنك مخلب عند الحاجة، ومراقبة EC شهرياً.',
      en: 'Summary: K and Mg deficiency with high salinity and alkaline pH limiting Fe/Zn uptake. Recommendations: potassium + magnesium fertilizer, improve basin drainage, deep infrequent irrigation, light organic matter, chelated Fe/Zn if needed, monthly EC monitoring.',
      de: 'Zusammenfassung: K- und Mg-Mangel bei hohem Salzgehalt und alkalischem pH. Empfehlungen: Kalium- + Magnesiumdünger, Drainage verbessern, tiefe seltene Bewässerung, leichte organische Substanz, ggf. cheliertes Fe/Zn, monatliche EC-Kontrolle.',
    },
  },
  {
    file: 'soil-fig-ansari.html',
    customerName: 'أحمد الأنصاري / Ahmed Al-Ansari',
    customerPhone: '+971 50 123 4567',
    customerLocation: 'دبي، الإمارات العربية المتحدة / Dubai, UAE',
    attendanceDate: '2026-07-10',
    examDate: '2026-07-14',
    plantName: {
      ar: 'تين (Ficus carica)',
      en: 'Fig (Ficus carica)',
      de: 'Feige (Ficus carica)',
    },
    description: {
      ar: 'أشجار تين مع تساقط ثمار مبكر وضعف امتلاء الثمرة. التربة فقيرة بالمادة العضوية مع مؤشرات نقص كالسيوم ورطوبة غير مستقرة.',
      en: 'Fig trees with early fruit drop and poor fruit fill. Soil low in organic matter with signs of calcium deficiency and uneven moisture.',
      de: 'Feigenbäume mit frühem Fruchtfall und schlechter Fruchtfüllung. Boden arm an organischer Substanz, Calciummangel und ungleichmäßige Feuchte.',
    },
    soilRows: [
      { test: { ar: 'درجة الحموضة pH', en: 'Soil pH', de: 'Boden-pH' }, actual: { ar: '7.6', en: '7.6', de: '7.6' }, ideal: { ar: '6.0 – 7.5', en: '6.0 – 7.5', de: '6.0 – 7.5' } },
      { test: { ar: 'الملوحة EC (مللي سيمنز/سم)', en: 'Salinity EC (mS/cm)', de: 'Salzgehalt EC (mS/cm)' }, actual: { ar: '2.4', en: '2.4', de: '2.4' }, ideal: { ar: '< 2.5', en: '< 2.5', de: '< 2.5' } },
      { test: { ar: 'المادة العضوية %', en: 'Organic matter %', de: 'Organische Substanz %' }, actual: { ar: '0.8%', en: '0.8%', de: '0.8%' }, ideal: { ar: '2.0 – 3.0%', en: '2.0 – 3.0%', de: '2.0 – 3.0%' } },
      { test: { ar: 'نيتروجين N', en: 'Nitrogen N', de: 'Stickstoff N' }, actual: { ar: 'متوسط منخفض', en: 'متوسط منخفض', de: 'متوسط منخفض' }, ideal: { ar: 'متوسط', en: 'Medium', de: 'Mittel' } },
      { test: { ar: 'فوسفور P', en: 'Phosphorus P', de: 'Phosphor P' }, actual: { ar: 'متوسط / Medium', en: 'متوسط / Medium', de: 'متوسط / Medium' }, ideal: { ar: 'متوسط', en: 'Medium', de: 'Mittel' } },
      { test: { ar: 'بوتاسيوم K', en: 'Potassium K', de: 'Kalium K' }, actual: { ar: 'متوسط / Medium', en: 'متوسط / Medium', de: 'متوسط / Medium' }, ideal: { ar: 'متوسط–مرتفع', en: 'Medium–High', de: 'Mittel–Hoch' } },
      { test: { ar: 'كالسيوم Ca', en: 'Calcium Ca', de: 'Calcium Ca' }, actual: { ar: 'منخفض / Low', en: 'منخفض / Low', de: 'منخفض / Low' }, ideal: { ar: 'متوسط–مرتفع', en: 'Medium–High', de: 'Mittel–Hoch' } },
      { test: { ar: 'مغنيسيوم Mg', en: 'Magnesium Mg', de: 'Magnesium Mg' }, actual: { ar: 'متوسط / Medium', en: 'متوسط / Medium', de: 'متوسط / Medium' }, ideal: { ar: 'كافٍ', en: 'Adequate', de: 'Ausreichend' } },
      { test: { ar: 'زنك Zn', en: 'Zinc Zn', de: 'Zink Zn' }, actual: { ar: 'منخفض / Low', en: 'منخفض / Low', de: 'منخفض / Low' }, ideal: { ar: 'كافٍ', en: 'Adequate', de: 'Ausreichend' } },
      { test: { ar: 'بورون B', en: 'Boron B', de: 'Bor B' }, actual: { ar: 'منخفض / Low', en: 'منخفض / Low', de: 'منخفض / Low' }, ideal: { ar: 'كافٍ', en: 'Adequate', de: 'Ausreichend' } },
      { test: { ar: 'الرطوبة / الصرف', en: 'Moisture / Drainage', de: 'Feuchte / Drainage' }, actual: { ar: 'صرف ضعيف جزئياً', en: 'صرف ضعيف جزئياً', de: 'صرف ضعيف جزئياً' }, ideal: { ar: 'صرف جيد منتظم', en: 'Good steady drainage', de: 'Gute gleichmäßige Drainage' } },
      { test: { ar: 'قوام التربة', en: 'Soil texture', de: 'Bodentextur' }, actual: { ar: 'رملي', en: 'رملي', de: 'رملي' }, ideal: { ar: 'طميي جيد التهوية', en: 'Well-aerated loam', de: 'Gut belüfteter Lehm' } },
    ],
    finalReport: {
      ar: 'الخلاصة: مادة عضوية منخفضة ونقص Ca مع Zn/B وضعف صرف جزئي يفسر تساقط الثمار. التوصيات: كمبوست ناضج + جبس زراعي/كالسيوم، تحسين الصرف، ري منتظم دون إغراق، تسميد متوازن خفيف، ورقي Zn/B بحذر.',
      en: 'Summary: Low organic matter and Ca deficiency with Zn/B and partial poor drainage explain fruit drop. Recommendations: mature compost + gypsum/calcium, improve drainage, steady irrigation without flooding, light balanced fertility, careful foliar Zn/B.',
      de: 'Zusammenfassung: Wenig organische Substanz und Ca-Mangel mit Zn/B sowie teilweise schlechter Drainage erklären den Fruchtfall. Empfehlungen: reifer Kompost + Gips/Calcium, Drainage verbessern, gleichmäßige Bewässerung, leichte Düngung, vorsichtiges Zn/B.',
    },
  },
];

fs.mkdirSync(outDir, { recursive: true });
for (const r of reports) {
  const html = buildHtml(r);
  const fp = path.join(outDir, r.file);
  fs.writeFileSync(fp, html, 'utf8');
  console.log('Wrote', fp);
}
console.log('Done.');
