import type { CustomerReport, PublicReport, ML } from './appData';

const ml = (ar: string, en = '', de = ''): ML => ({ ar, en, de });

function row(
  id: string,
  testAr: string, testEn: string, testDe: string,
  actAr: string, actEn: string, actDe: string,
  idealAr: string, idealEn: string, idealDe: string,
) {
  return {
    id,
    test: ml(testAr, testEn, testDe),
    actual: ml(actAr, actEn, actDe),
    ideal: ml(idealAr, idealEn, idealDe),
  };
}

const LOC_DUBAI = ml(
  'دبي، الإمارات العربية المتحدة',
  'Dubai, UAE',
  'Dubai, VAE',
);

/** تقارير نموذجية — أسماء ومواقع منفصلة لكل لغة */
export const SAMPLE_CUSTOMER_REPORTS: CustomerReport[] = [
  {
    id: 'sample-soil-tomato-ansari',
    reportType: 'soil',
    customerName: ml('أحمد الأنصاري', 'Ahmed Al-Ansari', 'Ahmed Al-Ansari'),
    customerPhone: '+971 50 123 4567',
    customerLocation: LOC_DUBAI,
    attendanceDate: '2026-07-10',
    examDate: '2026-07-12',
    images: [],
    plantName: ml('طماطم (Solanum lycopersicum)', 'Tomato (Solanum lycopersicum)', 'Tomate (Solanum lycopersicum)'),
    description: ml(
      'تربة رملية مالحة نسبياً في مزرعة بدبي. لوحظ اصفرار الأوراق السفلية وضعف العقد الثمري. طُلب تحليل تربة شامل لتحديد النقص المعدني ووصفة تسميد للطماطم.',
      'Sandy, moderately saline soil on a Dubai farm. Lower-leaf yellowing and weak fruit set observed. A full soil panel was requested to identify mineral deficiencies and a tomato fertilizer plan.',
      'Sandiger, mäßig salzhaltiger Boden auf einer Farm in Dubai. Vergilbung der unteren Blätter und schwacher Fruchtansatz. Vollständige Bodenanalyse zur Ermittlung von Mineralstoffmängeln und einem Tomaten-Düngeplan.',
    ),
    soilRows: [
      row('t-ph', 'درجة الحموضة pH', 'Soil pH', 'Boden-pH', '7.8', '7.8', '7.8', '6.0 – 6.8', '6.0 – 6.8', '6.0 – 6.8'),
      row('t-ec', 'الملوحة EC (مللي سيمنز/سم)', 'Salinity EC (mS/cm)', 'Salzgehalt EC (mS/cm)', '3.2', '3.2', '3.2', '< 2.0', '< 2.0', '< 2.0'),
      row('t-om', 'المادة العضوية %', 'Organic matter %', 'Organische Substanz %', '0.9%', '0.9%', '0.9%', '2.0 – 3.5%', '2.0 – 3.5%', '2.0 – 3.5%'),
      row('t-n', 'نيتروجين N (متاح)', 'Available Nitrogen N', 'Verfügbarer Stickstoff N', 'منخفض', 'Low', 'Niedrig', 'متوسط–مرتفع', 'Medium–High', 'Mittel–Hoch'),
      row('t-p', 'فوسفور P (متاح)', 'Available Phosphorus P', 'Verfügbarer Phosphor P', 'متوسط', 'Medium', 'Mittel', 'متوسط–مرتفع', 'Medium–High', 'Mittel–Hoch'),
      row('t-k', 'بوتاسيوم K (متاح)', 'Available Potassium K', 'Verfügbares Kalium K', 'منخفض', 'Low', 'Niedrig', 'مرتفع للطماطم', 'High for tomato', 'Hoch für Tomate'),
      row('t-ca', 'كالسيوم Ca', 'Calcium Ca', 'Calcium Ca', 'متوسط', 'Medium', 'Mittel', 'متوسط–مرتفع', 'Medium–High', 'Mittel–Hoch'),
      row('t-mg', 'مغنيسيوم Mg', 'Magnesium Mg', 'Magnesium Mg', 'منخفض', 'Low', 'Niedrig', 'كافٍ–مرتفع', 'Adequate–High', 'Ausreichend–Hoch'),
      row('t-s', 'كبريت S', 'Sulfur S', 'Schwefel S', 'منخفض', 'Low', 'Niedrig', 'كافٍ', 'Adequate', 'Ausreichend'),
      row('t-fe', 'حديد Fe', 'Iron Fe', 'Eisen Fe', 'منخفض–متوسط', 'Low–Medium', 'Niedrig–Mittel', 'كافٍ', 'Adequate', 'Ausreichend'),
      row('t-zn', 'زنك Zn', 'Zinc Zn', 'Zink Zn', 'منخفض', 'Low', 'Niedrig', 'كافٍ', 'Adequate', 'Ausreichend'),
      row('t-mn', 'منغنيز Mn', 'Manganese Mn', 'Mangan Mn', 'متوسط', 'Medium', 'Mittel', 'كافٍ', 'Adequate', 'Ausreichend'),
      row('t-cu', 'نحاس Cu', 'Copper Cu', 'Kupfer Cu', 'كافٍ', 'OK', 'OK', 'كافٍ', 'Adequate', 'Ausreichend'),
      row('t-b', 'بورون B', 'Boron B', 'Bor B', 'منخفض', 'Low', 'Niedrig', 'كافٍ (حساس للطماطم)', 'Adequate (tomato-sensitive)', 'Ausreichend (tomatenempfindlich)'),
      row('t-na', 'صوديوم Na / SAR', 'Sodium Na / SAR', 'Natrium Na / SAR', 'مرتفع نسبياً', 'Relatively high', 'Relativ hoch', 'منخفض–متوسط', 'Low–Medium', 'Niedrig–Mittel'),
      row('t-tex', 'قوام التربة', 'Soil texture', 'Bodentextur', 'رملي خفيف', 'Light sandy', 'Leicht sandig', 'طميي–رملي جيد الصرف', 'Loamy–sand, well drained', 'Lehmig–sandig, gut drainiert'),
    ],
    finalReport: ml(
      'الخلاصة: نقص واضح في N و K و Mg و Zn و B مع ارتفاع الملوحة وpH القلوي. التوصيات: 1) غسيل ملوحة خفيف وري منتظم دون تغدق. 2) خفض pH تدريجياً بمادة عضوية وكبريت زراعي. 3) تسميد متوازن للطماطم: نيتروجين مرحلي + بوتاسيوم عالي في الإزهار/العقد + مغنيسيوم (كبريتات مغنيسيوم) + زنك وبورون ورقي بحذر. 4) كمبوست ناضج لرفع المادة العضوية. 5) إعادة تحليل بعد 6–8 أسابيع.',
      'Summary: Clear deficiency in N, K, Mg, Zn and B with elevated salinity and alkaline pH. Recommendations: 1) Light salt leaching and regular irrigation without waterlogging. 2) Gradually lower pH with organic matter and agricultural sulfur. 3) Tomato-balanced nutrition: staged nitrogen + high potassium at flowering/fruit set + magnesium sulfate + careful foliar Zn/B. 4) Mature compost to raise organic matter. 5) Re-test in 6–8 weeks.',
      'Zusammenfassung: Deutlicher Mangel an N, K, Mg, Zn und B bei erhöhtem Salzgehalt und alkalischem pH. Empfehlungen: 1) Leichte Salzauswaschung, regelmäßige Bewässerung ohne Staunässe. 2) pH schrittweise senken (organische Substanz, landwirtschaftlicher Schwefel). 3) Tomaten-Düngung: gestaffelter Stickstoff + viel Kalium in Blüte/Fruchtansatz + Magnesiumsulfat + vorsichtiges Zn/B-Blattdüngung. 4) Reifer Kompost. 5) Nachkontrolle in 6–8 Wochen.',
    ),
    createdAt: '2026-07-12T10:00:00.000Z',
  },
  {
    id: 'sample-soil-palm-ansari',
    reportType: 'soil',
    customerName: ml('أيمن السالم', 'Ayman Al-Salem', 'Ayman Al-Salem'),
    customerPhone: '+971 55 987 6543',
    customerLocation: LOC_DUBAI,
    attendanceDate: '2026-07-10',
    examDate: '2026-07-13',
    images: [],
    plantName: ml('نخيل التمر (Phoenix dactylifera)', 'Date palm (Phoenix dactylifera)', 'Dattelpalme (Phoenix dactylifera)'),
    description: ml(
      'نخيل تمر في دبي تظهر عليه حروق أطراف السعف واصفرار بين العروق. يُشتبه بنقص بوتاسيوم ومغنيسيوم مع إجهاد ملحي.',
      'Date palms in Dubai showing frond tip burn and interveinal yellowing. Suspected K/Mg deficiency with salinity stress.',
      'Dattelpalmen in Dubai mit Blattspitzenverbrennung und intervenaler Vergilbung. Verdacht auf K/Mg-Mangel bei Salzstress.',
    ),
    soilRows: [
      row('p-ph', 'درجة الحموضة pH', 'Soil pH', 'Boden-pH', '8.1', '8.1', '8.1', '7.0 – 8.0', '7.0 – 8.0', '7.0 – 8.0'),
      row('p-ec', 'الملوحة EC (مللي سيمنز/سم)', 'Salinity EC (mS/cm)', 'Salzgehalt EC (mS/cm)', '4.1', '4.1', '4.1', '< 4.0 (تحمل النخيل)', '< 4.0 (palm tolerance)', '< 4.0 (Palmentoleranz)'),
      row('p-om', 'المادة العضوية %', 'Organic matter %', 'Organische Substanz %', '1.1%', '1.1%', '1.1%', '1.5 – 3.0%', '1.5 – 3.0%', '1.5 – 3.0%'),
      row('p-n', 'نيتروجين N', 'Nitrogen N', 'Stickstoff N', 'متوسط', 'Medium', 'Mittel', 'متوسط', 'Medium', 'Mittel'),
      row('p-p', 'فوسفور P', 'Phosphorus P', 'Phosphor P', 'متوسط', 'Medium', 'Mittel', 'متوسط', 'Medium', 'Mittel'),
      row('p-k', 'بوتاسيوم K', 'Potassium K', 'Kalium K', 'ناقص بشدة', 'Severely deficient', 'Stark mangelhaft', 'مرتفع للنخيل', 'High for palm', 'Hoch für Palme'),
      row('p-mg', 'مغنيسيوم Mg', 'Magnesium Mg', 'Magnesium Mg', 'ناقص', 'Deficient', 'Mangelhaft', 'كافٍ–مرتفع', 'Adequate–High', 'Ausreichend–Hoch'),
      row('p-ca', 'كالسيوم Ca', 'Calcium Ca', 'Calcium Ca', 'مرتفع', 'High', 'Hoch', 'متوازن مع K/Mg', 'Balanced with K/Mg', 'Ausgewogen mit K/Mg'),
      row('p-fe', 'حديد Fe', 'Iron Fe', 'Eisen Fe', 'منخفض عند pH مرتفع', 'Low at high pH', 'Niedrig bei hohem pH', 'كافٍ', 'Adequate', 'Ausreichend'),
      row('p-zn', 'زنك Zn', 'Zinc Zn', 'Zink Zn', 'منخفض', 'Low', 'Niedrig', 'كافٍ', 'Adequate', 'Ausreichend'),
      row('p-b', 'بورون B', 'Boron B', 'Bor B', 'متوسط', 'Medium', 'Mittel', 'كافٍ (تجنب الزيادة)', 'Adequate (avoid excess)', 'Ausreichend (Übermaß vermeiden)'),
      row('p-na', 'صوديوم Na / SAR', 'Sodium Na / SAR', 'Natrium Na / SAR', 'مرتفع', 'High', 'Hoch', 'منخفض–متوسط', 'Low–Medium', 'Niedrig–Mittel'),
      row('p-drain', 'الصرف حول الحوض', 'Basin drainage', 'Beckendrainage', 'متوسط–ضعيف', 'Medium–poor', 'Mittel–schwach', 'صرف جيد عميق', 'Good deep drainage', 'Gute tiefe Drainage'),
    ],
    finalReport: ml(
      'الخلاصة: نقص K و Mg مع ملوحة مرتفعة وpH قلوي يحدّ من امتصاص الحديد والزنك. التوصيات: سماد بوتاسيوم عالي الجودة + مغنيسيوم، تحسين صرف الحوض، ري عميق متباعد، مادة عضوية خفيفة، حديد/زنك مخلب عند الحاجة، ومراقبة EC شهرياً.',
      'Summary: K and Mg deficiency with high salinity and alkaline pH limiting Fe/Zn uptake. Recommendations: quality potassium + magnesium fertilizer, improve basin drainage, deep infrequent irrigation, light organic matter, chelated Fe/Zn if needed, monthly EC monitoring.',
      'Zusammenfassung: K- und Mg-Mangel bei hohem Salzgehalt und alkalischem pH (Fe/Zn-Aufnahme gehemmt). Empfehlungen: hochwertiger Kalium- + Magnesiumdünger, Beckendrainage verbessern, tiefe seltene Bewässerung, leichte organische Substanz, ggf. cheliertes Fe/Zn, monatliche EC-Kontrolle.',
    ),
    createdAt: '2026-07-13T10:00:00.000Z',
  },
  {
    id: 'sample-soil-fig-ansari',
    reportType: 'soil',
    customerName: ml('شاهين دياب', 'Shaheen Diab', 'Shaheen Diab'),
    customerPhone: '+971 52 444 7788',
    customerLocation: LOC_DUBAI,
    attendanceDate: '2026-07-10',
    examDate: '2026-07-14',
    images: [],
    plantName: ml('تين (Ficus carica)', 'Fig (Ficus carica)', 'Feige (Ficus carica)'),
    description: ml(
      'أشجار تين مع تساقط ثمار مبكر وضعف امتلاء الثمرة. التربة فقيرة بالمادة العضوية مع مؤشرات نقص كالسيوم ورطوبة غير مستقرة.',
      'Fig trees with early fruit drop and poor fruit fill. Soil low in organic matter with signs of calcium deficiency and uneven moisture.',
      'Feigenbäume mit frühem Fruchtfall und schlechter Fruchtfüllung. Boden arm an organischer Substanz, Calciummangel und ungleichmäßige Feuchte.',
    ),
    soilRows: [
      row('f-ph', 'درجة الحموضة pH', 'Soil pH', 'Boden-pH', '7.6', '7.6', '7.6', '6.0 – 7.5', '6.0 – 7.5', '6.0 – 7.5'),
      row('f-ec', 'الملوحة EC (مللي سيمنز/سم)', 'Salinity EC (mS/cm)', 'Salzgehalt EC (mS/cm)', '2.4', '2.4', '2.4', '< 2.5', '< 2.5', '< 2.5'),
      row('f-om', 'المادة العضوية %', 'Organic matter %', 'Organische Substanz %', '0.8%', '0.8%', '0.8%', '2.0 – 3.0%', '2.0 – 3.0%', '2.0 – 3.0%'),
      row('f-n', 'نيتروجين N', 'Nitrogen N', 'Stickstoff N', 'متوسط منخفض', 'Low–medium', 'Niedrig–mittel', 'متوسط', 'Medium', 'Mittel'),
      row('f-p', 'فوسفور P', 'Phosphorus P', 'Phosphor P', 'متوسط', 'Medium', 'Mittel', 'متوسط', 'Medium', 'Mittel'),
      row('f-k', 'بوتاسيوم K', 'Potassium K', 'Kalium K', 'متوسط', 'Medium', 'Mittel', 'متوسط–مرتفع', 'Medium–High', 'Mittel–Hoch'),
      row('f-ca', 'كالسيوم Ca', 'Calcium Ca', 'Calcium Ca', 'منخفض', 'Low', 'Niedrig', 'متوسط–مرتفع', 'Medium–High', 'Mittel–Hoch'),
      row('f-mg', 'مغنيسيوم Mg', 'Magnesium Mg', 'Magnesium Mg', 'متوسط', 'Medium', 'Mittel', 'كافٍ', 'Adequate', 'Ausreichend'),
      row('f-zn', 'زنك Zn', 'Zinc Zn', 'Zink Zn', 'منخفض', 'Low', 'Niedrig', 'كافٍ', 'Adequate', 'Ausreichend'),
      row('f-b', 'بورون B', 'Boron B', 'Bor B', 'منخفض', 'Low', 'Niedrig', 'كافٍ', 'Adequate', 'Ausreichend'),
      row('f-drain', 'الرطوبة / الصرف', 'Moisture / Drainage', 'Feuchte / Drainage', 'صرف ضعيف جزئياً', 'Partially poor drainage', 'Teilweise schlechte Drainage', 'صرف جيد منتظم', 'Good steady drainage', 'Gute gleichmäßige Drainage'),
      row('f-tex', 'قوام التربة', 'Soil texture', 'Bodentextur', 'رملي', 'Sandy', 'Sandig', 'طميي جيد التهوية', 'Well-aerated loam', 'Gut belüfteter Lehm'),
    ],
    finalReport: ml(
      'الخلاصة: مادة عضوية منخفضة ونقص Ca مع Zn/B وضعف صرف جزئي يفسر تساقط الثمار. التوصيات: كمبوست ناضج + جبس زراعي/مصدر كالسيوم، تحسين الصرف، ري منتظم دون إغراق، تسميد متوازن خفيف، ورقي Zn/B بحذر، ومتابعة العقد في الموسم التالي.',
      'Summary: Low organic matter and Ca deficiency with Zn/B and partial poor drainage explain fruit drop. Recommendations: mature compost + gypsum/calcium source, improve drainage, steady irrigation without flooding, light balanced fertility, careful foliar Zn/B, monitor fruit set next season.',
      'Zusammenfassung: Wenig organische Substanz und Ca-Mangel mit Zn/B sowie teilweise schlechter Drainage erklären den Fruchtfall. Empfehlungen: reifer Kompost + Gips/Calcium, Drainage verbessern, gleichmäßige Bewässerung ohne Flutung, leichte ausgewogene Düngung, vorsichtiges Zn/B, Fruchtansatz nächste Saison prüfen.',
    ),
    createdAt: '2026-07-14T10:00:00.000Z',
  },
];

export const SAMPLE_PUBLIC_REPORTS: PublicReport[] = [
  {
    id: 'pub-soil-tomato-ansari',
    title: ml(
      'تحليل تربة — طماطم — أحمد الأنصاري (دبي)',
      'Soil analysis — Tomato — Ahmed Al-Ansari (Dubai)',
      'Bodenanalyse — Tomate — Ahmed Al-Ansari (Dubai)',
    ),
    thumbnail: '',
    url: 'customer-report:sample-soil-tomato-ansari',
    visible: true,
  },
  {
    id: 'pub-soil-palm-ansari',
    title: ml(
      'تحليل تربة — نخيل تمر — أيمن السالم (دبي)',
      'Soil analysis — Date palm — Ayman Al-Salem (Dubai)',
      'Bodenanalyse — Dattelpalme — Ayman Al-Salem (Dubai)',
    ),
    thumbnail: '',
    url: 'customer-report:sample-soil-palm-ansari',
    visible: true,
  },
  {
    id: 'pub-soil-fig-ansari',
    title: ml(
      'تحليل تربة — تين — شاهين دياب (دبي)',
      'Soil analysis — Fig — Shaheen Diab (Dubai)',
      'Bodenanalyse — Feige — Shaheen Diab (Dubai)',
    ),
    thumbnail: '',
    url: 'customer-report:sample-soil-fig-ansari',
    visible: true,
  },
];

/** دمج العينات وتحديث محتوى العينات المحفوظة سابقاً بنفس المعرّف */
export function mergeSoilReportSamples<T extends {
  customerReports: CustomerReport[];
  publicReports: PublicReport[];
}>(data: T): T {
  const sampleCr = new Map(SAMPLE_CUSTOMER_REPORTS.map(r => [r.id, r]));
  const samplePr = new Map(SAMPLE_PUBLIC_REPORTS.map(r => [r.id, r]));

  const customerReports = data.customerReports.map(r => sampleCr.get(r.id) ?? r);
  for (const s of SAMPLE_CUSTOMER_REPORTS) {
    if (!customerReports.some(r => r.id === s.id)) customerReports.push(s);
  }

  const publicReports = data.publicReports.map(r => samplePr.get(r.id) ?? r);
  for (const s of SAMPLE_PUBLIC_REPORTS) {
    if (!publicReports.some(r => r.id === s.id)) publicReports.push(s);
  }

  return { ...data, customerReports, publicReports };
}
