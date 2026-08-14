import { useEffect, useMemo, useRef, useState } from 'react';
import { AlaaLogo } from './AlaaLogo';
import {
  AppData,
  AgriWalkthroughSettings,
  LangKey,
  loadAppData,
  loadAppDataFromDb,
  pickML,
} from './appData';
import { resolveImageSrc } from './mediaUrl';
import { HeroNameDisplay } from './HeroNameDisplay';
import './agri-walkthrough.css';

type Copy = Record<LangKey, string>;
type Screen =
  | 'home'
  | 'agri'
  | 'plant-upload'
  | 'camera'
  | 'plant-images'
  | 'diagnosing'
  | 'plant-report'
  | 'whatsapp'
  | 'season-location'
  | 'season-report'
  | 'books'
  | 'articles'
  | 'soil'
  | 'done';

export interface WalkStep {
  id: string;
  screen: Screen;
  title: Copy;
  body: Copy;
  action?: string;
  reportFocus?: 'overview' | 'identity' | 'care' | 'soil' | 'nutrients' | 'planting' | 'uses' | 'health' | 'disease' | 'signature';
  seasonFocus?: 'overview' | 'weather' | 'table' | 'guide';
}

const T = (ar: string, en: string, de: string): Copy => ({ ar, en, de });
const tx = (value: Copy, lang: LangKey) => value[lang] || value.en;

const UI = {
  pageTitle: T('جولة تفاعلية في قسم الزراعة', 'Interactive Agri Tour', 'Interaktive Agrar-Tour'),
  pageLead: T(
    'شاهد كيف تعمل خدمات الزراعة خطوة بخطوة داخل محاكاة حقيقية للجوال.',
    'See how the agricultural services work step by step inside a realistic phone simulation.',
    'Sehen Sie Schritt für Schritt, wie die Agrardienste in einer realistischen Handy-Simulation funktionieren.',
  ),
  back: T('العودة للموقع', 'Back to website', 'Zur Website'),
  previous: T('السابق', 'Previous', 'Zurück'),
  next: T('التالي', 'Next', 'Weiter'),
  play: T('تشغيل الجولة', 'Play tour', 'Tour starten'),
  pause: T('إيقاف مؤقت', 'Pause', 'Pause'),
  replay: T('إعادة الجولة', 'Replay tour', 'Tour wiederholen'),
  speed: T('سرعة الشرح', 'Tour speed', 'Geschwindigkeit'),
  narration: T('قراءة صوتية', 'Voice narration', 'Sprachausgabe'),
  steps: T('خطوات الجولة', 'Tour steps', 'Tour-Schritte'),
  step: T('الخطوة', 'Step', 'Schritt'),
  of: T('من', 'of', 'von'),
  chooseLang: T('اللغة', 'Language', 'Sprache'),
  voiceHint: T(
    'الصوت اختياري ويعتمد على الأصوات المتوفرة في متصفحك.',
    'Voice is optional and uses voices available in your browser.',
    'Die Sprachausgabe ist optional und verwendet Browser-Stimmen.',
  ),
};

export const WALKTHROUGH_STEPS: WalkStep[] = [
  {
    id: 'home',
    screen: 'home',
    title: T('البداية من الصفحة الرئيسية', 'Start from the home page', 'Start auf der Startseite'),
    body: T(
      'هذه بوابة المهندس علاء أحمد المصري. تجمع خدمات الزراعة والتصاميم والبرمجة في موقع واحد.',
      'This is Eng. Alaa Ahmad Almasri’s portal, bringing agriculture, design and programming services together.',
      'Dies ist das Portal von Ing. Alaa Ahmad Almasri – Agrar-, Design- und Programmierdienste an einem Ort.',
    ),
  },
  {
    id: 'nav-home',
    screen: 'home',
    action: 'nav-home',
    title: T('زر الرئيسية', 'Home button', 'Startseite'),
    body: T(
      'زر الرئيسية يعيد المستخدم دائماً إلى بوابة التعريف الرئيسية والخدمات الثلاث.',
      'The Home button always returns to the main introduction and the three service portals.',
      'Die Start-Schaltfläche führt jederzeit zur Hauptvorstellung und den drei Leistungsbereichen zurück.',
    ),
  },
  {
    id: 'tap-agri',
    screen: 'home',
    action: 'nav-agri',
    title: T('الدخول إلى الزراعة', 'Open the Agri section', 'Agrarbereich öffnen'),
    body: T(
      'يضيء زر الزراعة في أسفل الجوال، ثم نضغط عليه للانتقال إلى بوابة الهندسة الزراعية.',
      'The Agri button lights up in the bottom bar. Tap it to enter the Agricultural Engineering Portal.',
      'Die Schaltfläche „Agrar“ leuchtet unten auf. Ein Tipp öffnet das Agrartechnik-Portal.',
    ),
  },
  {
    id: 'nav-design',
    screen: 'home',
    action: 'nav-design',
    title: T('زر التصاميم', 'Design button', 'Design-Schaltfläche'),
    body: T(
      'زر التصاميم يفتح معرض الأعمال الهندسية والبصرية والنماذج ثلاثية الأبعاد.',
      'The Design button opens the visual and engineering portfolio and 3D models.',
      'Die Design-Schaltfläche öffnet das visuelle und technische Portfolio sowie 3D-Modelle.',
    ),
  },
  {
    id: 'nav-dev',
    screen: 'home',
    action: 'nav-dev',
    title: T('زر البرمجة', 'Dev button', 'Dev-Schaltfläche'),
    body: T(
      'زر البرمجة ينقل إلى المشاريع البرمجية والتطبيقات والأدوات الرقمية.',
      'The Dev button opens software projects, applications and digital tools.',
      'Die Dev-Schaltfläche öffnet Softwareprojekte, Anwendungen und digitale Werkzeuge.',
    ),
  },
  {
    id: 'nav-cv',
    screen: 'home',
    action: 'nav-cv',
    title: T('زر السيرة الذاتية', 'CV button', 'CV-Schaltfläche'),
    body: T(
      'زر السيرة يعرض الخبرات والمهارات وملفات السيرة القابلة للتنزيل.',
      'The CV button shows experience, skills and downloadable résumé files.',
      'Die CV-Schaltfläche zeigt Erfahrung, Fähigkeiten und herunterladbare Lebensläufe.',
    ),
  },
  {
    id: 'agri-menu',
    screen: 'agri',
    action: 'tab-plant',
    title: T('خدمات الزراعة', 'Agricultural services', 'Agrardienste'),
    body: T(
      'تظهر خدمات: افحص نباتك، موسمك الآن، الكتب، الأبحاث والمقالات، وتحليل التربة. نبدأ بخدمة افحص نباتك.',
      'The services are Plant Check, Your Season Now, Books, Articles and Soil Analysis. We begin with Plant Check.',
      'Verfügbar sind Pflanzencheck, Ihre Saison, Bücher, Artikel und Bodenanalyse. Wir beginnen mit dem Pflanzencheck.',
    ),
  },
  {
    id: 'plant-upload',
    screen: 'plant-upload',
    action: 'add-image',
    title: T('رفع صور النبات', 'Upload plant images', 'Pflanzenbilder hochladen'),
    body: T(
      'يمكن إضافة صور للورقة أو الساق أو الجذور أو صورة مجهرية. نضغط على زر رفع صورة لفتح كاميرا الجوال.',
      'Add photos of leaves, stems, roots or microscopic details. Tap Add image to open the phone camera.',
      'Fügen Sie Bilder von Blatt, Stängel, Wurzeln oder Mikroskopie hinzu. „Bild hinzufügen“ öffnet die Kamera.',
    ),
  },
  {
    id: 'camera',
    screen: 'camera',
    action: 'camera-shutter',
    title: T('تصوير النبات', 'Photograph the plant', 'Pflanze fotografieren'),
    body: T(
      'تفتح الكاميرا مباشرة. نثبت الصورة على الجزء المطلوب فحصه ثم نضغط زر التصوير.',
      'The camera opens directly. Frame the part you want to inspect, then press the shutter.',
      'Die Kamera öffnet sich direkt. Richten Sie sie auf den zu prüfenden Pflanzenteil und lösen Sie aus.',
    ),
  },
  {
    id: 'images-ready',
    screen: 'plant-images',
    action: 'diagnose',
    title: T('مراجعة الصور وبدء التشخيص', 'Review images and diagnose', 'Bilder prüfen und Diagnose starten'),
    body: T(
      'تظهر الصور الملتقطة ويمكن إضافة أكثر من صورة. بعد المراجعة نضغط تشخيص فوري وتقرير PDF.',
      'Captured images appear and more can be added. Then tap Instant diagnosis & PDF report.',
      'Die aufgenommenen Bilder werden angezeigt; weitere können ergänzt werden. Danach startet die Sofortdiagnose mit PDF-Bericht.',
    ),
  },
  {
    id: 'diagnosing',
    screen: 'diagnosing',
    title: T('تحليل الصور', 'Image analysis', 'Bildanalyse'),
    body: T(
      'يحلل النظام صور النبات ويجمع بيانات التعرف والعناية والتربة والتغذية والتشخيص المرضي في تقرير واحد.',
      'The system analyzes the plant images and compiles identification, care, soil, nutrition and disease findings into one report.',
      'Das System analysiert die Bilder und bündelt Bestimmung, Pflege, Boden, Nährstoffe und Krankheitsdiagnose in einem Bericht.',
    ),
  },
  {
    id: 'report-overview',
    screen: 'plant-report',
    reportFocus: 'overview',
    title: T('تقرير التشخيص الكامل', 'Complete diagnostic report', 'Vollständiger Diagnosebericht'),
    body: T(
      'يظهر التقرير داخل شاشة الجوال بهوية الموقع، مع اسم النبات وصوره وتفاصيله الكاملة.',
      'The complete branded report appears inside the phone, with plant name, images and all diagnostic details.',
      'Der vollständige Bericht erscheint im Handy – mit Pflanzenname, Bildern und allen Diagnosedetails.',
    ),
  },
  {
    id: 'report-identity',
    screen: 'plant-report',
    reportFocus: 'identity',
    title: T('هوية النبات والعناية', 'Plant identity and care', 'Pflanzenbestimmung und Pflege'),
    body: T(
      'يكبّر الشرح قسم اسم النبات والاسم العلمي والموطن، ثم تعليمات الري والتسميد والإضاءة والحرارة.',
      'The tour zooms into the plant name, scientific name and origin, followed by water, fertilizer, light and temperature guidance.',
      'Die Ansicht vergrößert Pflanzenname, wissenschaftlichen Namen und Herkunft sowie Bewässerung, Düngung, Licht und Temperatur.',
    ),
  },
  {
    id: 'report-care-details',
    screen: 'plant-report',
    reportFocus: 'care',
    title: T('تفاصيل العناية والبيئة', 'Care and environment details', 'Pflege- und Umweltdetails'),
    body: T(
      'يوضح التقرير الري والتسميد وشدة الإضاءة ودرجة الحرارة المثلى لزراعة حليب الشوك.',
      'The report explains watering, fertilization, light intensity and optimal temperature for Milk Thistle.',
      'Der Bericht erklärt Bewässerung, Düngung, Lichtintensität und optimale Temperatur der Mariendistel.',
    ),
  },
  {
    id: 'report-care',
    screen: 'plant-report',
    reportFocus: 'soil',
    title: T('التربة والعناصر الغذائية', 'Soil and nutrients', 'Boden und Nährstoffe'),
    body: T(
      'يعرض التقرير نوع التربة المناسبة ونسب العناصر الكبرى والصغرى ومعلومات الزراعة والحصاد.',
      'The report shows suitable soil, macro and micronutrient ratios, and planting and harvest information.',
      'Der Bericht zeigt geeigneten Boden, Makro- und Mikronährstoffe sowie Pflanz- und Ernteinformationen.',
    ),
  },
  {
    id: 'report-nutrients',
    screen: 'plant-report',
    reportFocus: 'nutrients',
    title: T('العناصر ونسب التسميد', 'Nutrients and fertilization ratios', 'Nährstoffe und Düngungsverhältnisse'),
    body: T(
      'يعرض التقرير احتياجات النيتروجين والفوسفور والبوتاسيوم والعناصر الصغرى، مع نسبة التسميد المقترحة وموعد تطبيقها.',
      'The report lists nitrogen, phosphorus, potassium and micronutrient needs, with the suggested fertilizer ratio and timing.',
      'Der Bericht nennt den Bedarf an Stickstoff, Phosphor, Kalium und Spurenelementen sowie Düngungsverhältnis und Zeitpunkt.',
    ),
  },
  {
    id: 'report-planting',
    screen: 'plant-report',
    reportFocus: 'planting',
    title: T('الزراعة والحصاد', 'Planting and harvest', 'Aussaat und Ernte'),
    body: T(
      'هنا تظهر إجابات موعد الزراعة، عدد الأيام المتوقعة حتى الحصاد، وعلامات وموعد جمع البذور الناضجة.',
      'Here are the planting date, expected days to harvest, and the signs and timing for collecting mature seeds.',
      'Hier stehen Aussaatzeit, erwartete Tage bis zur Ernte sowie Merkmale und Zeitpunkt der Samenreife.',
    ),
  },
  {
    id: 'report-uses',
    screen: 'plant-report',
    reportFocus: 'uses',
    title: T('الاستخدامات والفوائد', 'Uses and benefits', 'Verwendung und Nutzen'),
    body: T(
      'يوضح التقرير استخدامات حليب الشوك، فوائده المعروفة، المادة الفعالة سيليمارين، وأشكال المستحضرات المتداولة.',
      'The report explains Milk Thistle uses, known benefits, its active compound silymarin and common preparation forms.',
      'Der Bericht erklärt Verwendung, bekannten Nutzen, den Wirkstoff Silymarin und übliche Präparateformen.',
    ),
  },
  {
    id: 'report-health',
    screen: 'plant-report',
    reportFocus: 'health',
    title: T('الفوائد والتشخيص المرضي', 'Benefits and disease diagnosis', 'Nutzen und Krankheitsdiagnose'),
    body: T(
      'تظهر استخدامات النبات وفوائده والمواد الفعالة، ثم الأمراض أو الآفات والمبيدات والجرعات المقترحة عند الحاجة.',
      'Plant uses, benefits and active compounds are shown, followed by detected diseases, pests and suggested treatments when needed.',
      'Anwendungen, Nutzen und Wirkstoffe werden angezeigt, danach erkannte Krankheiten, Schädlinge und empfohlene Maßnahmen.',
    ),
  },
  {
    id: 'report-disease',
    screen: 'plant-report',
    reportFocus: 'disease',
    title: T('أسئلة التشخيص المرضي', 'Disease diagnosis questions', 'Fragen zur Krankheitsdiagnose'),
    body: T(
      'يجيب التقرير عن وجود مرض أو آفة، الأعراض المرئية، درجة الثقة، والحاجة إلى مبيد وجرعته. الصور الحالية لا تُظهر إصابة واضحة.',
      'The report answers whether disease or pests are present, visible symptoms, confidence, and whether treatment and dosage are needed. No clear infection appears here.',
      'Der Bericht beantwortet Fragen zu Krankheit oder Schädlingen, Symptomen, Sicherheit und nötiger Behandlung. Hier ist kein deutlicher Befall sichtbar.',
    ),
  },
  {
    id: 'report-signature',
    screen: 'plant-report',
    reportFocus: 'signature',
    title: T('الختم وتوقيع المهندس', 'Engineer stamp and signature', 'Stempel und Unterschrift'),
    body: T(
      'في أسفل التقرير يظهر ختم وتوقيع المهندس ونص التقرير الرسمي، ويمكن تصديره أو طباعته بصيغة PDF.',
      'The footer includes the engineer’s stamp, signature and official report text. The report can be exported or printed as PDF.',
      'Am Ende stehen Stempel, Unterschrift und offizieller Berichtstext. Der Bericht kann als PDF exportiert oder gedruckt werden.',
    ),
  },
  {
    id: 'report-share',
    screen: 'plant-report',
    action: 'share-pdf',
    title: T('مشاركة تقرير PDF', 'Share the PDF report', 'PDF-Bericht teilen'),
    body: T(
      'نضغط زر المشاركة لإعداد نسخة PDF جاهزة للإرسال عبر واتساب أو تنزيلها على الجهاز.',
      'Tap Share to prepare a PDF that can be sent by WhatsApp or downloaded to the device.',
      'Tippen Sie auf „Teilen“, um eine PDF für WhatsApp oder den Download vorzubereiten.',
    ),
  },
  {
    id: 'whatsapp',
    screen: 'whatsapp',
    title: T('الإرسال عبر واتساب', 'Send via WhatsApp', 'Über WhatsApp senden'),
    body: T(
      'تظهر معاينة ملف التقرير داخل محادثة واتساب، باسم واضح وصيغة PDF، ثم يمكن إرساله للعميل أو المختص.',
      'A clearly named PDF report appears in a WhatsApp conversation, ready to send to a client or specialist.',
      'Der benannte PDF-Bericht erscheint in WhatsApp und kann an Kunden oder Fachleute gesendet werden.',
    ),
  },
  {
    id: 'season-open',
    screen: 'agri',
    action: 'tab-season',
    title: T('الانتقال إلى موسمك الآن', 'Open Your Season Now', '„Ihre Saison“ öffnen'),
    body: T(
      'نغلق فحص النبات ونختار موسمك الآن لمعرفة ما يزرع وما يحصد في موقع المستخدم.',
      'Close Plant Check and choose Your Season Now to see what can be planted and harvested at the user’s location.',
      'Nach dem Pflanzencheck öffnen wir „Ihre Saison“, um passende Pflanz- und Erntezeiten am Standort zu sehen.',
    ),
  },
  {
    id: 'season-location',
    screen: 'season-location',
    action: 'location',
    title: T('تحديد الموقع', 'Detect location', 'Standort bestimmen'),
    body: T(
      'بعد موافقة المستخدم نضغط تحديد موقعي. يعتمد التقرير على الإحداثيات والطقس الحالي في المنطقة.',
      'With user consent, tap Use my location. The report uses coordinates and current local weather.',
      'Nach Zustimmung wird der Standort verwendet. Der Bericht basiert auf Koordinaten und aktuellem Wetter.',
    ),
  },
  {
    id: 'season-overview',
    screen: 'season-report',
    seasonFocus: 'overview',
    title: T('تقرير موسمك الآن', 'Your Season Now report', 'Bericht „Ihre Saison“'),
    body: T(
      'يظهر تقرير كامل يتضمن المنطقة والإحداثيات والحرارة والرطوبة والرياح.',
      'A complete report appears with region, coordinates, temperature, humidity and wind.',
      'Ein vollständiger Bericht zeigt Region, Koordinaten, Temperatur, Luftfeuchtigkeit und Wind.',
    ),
  },
  {
    id: 'season-table',
    screen: 'season-report',
    seasonFocus: 'table',
    title: T('الزراعة والحصاد حسب الصنف', 'Planting and harvest by category', 'Pflanzen und Ernten nach Kategorie'),
    body: T(
      'يعرض الجدول ما يزرع الآن وما يحصد الآن ضمن الخضار والفواكه والمحاصيل الحقلية والنباتات الطبية والأعلاف والمراعي.',
      'The table lists what to plant and harvest now across vegetables, fruits, field crops, medicinal plants, fodder and pastures.',
      'Die Tabelle zeigt aktuelle Pflanz- und Ernteempfehlungen für Gemüse, Obst, Feldfrüchte, Heilpflanzen, Futter und Weiden.',
    ),
  },
  {
    id: 'season-guide',
    screen: 'season-report',
    seasonFocus: 'guide',
    title: T('الإرشادات ومشاركة التقرير', 'Guidance and report sharing', 'Hinweise und Bericht teilen'),
    body: T(
      'يقدم التقرير إرشادات عملية للزراعة والحصاد، ويمكن طباعته أو مشاركته كملف PDF مثل تقرير التشخيص.',
      'The report provides practical planting and harvest guidance and can be printed or shared as a PDF.',
      'Der Bericht enthält praktische Anbau- und Erntehinweise und kann als PDF gedruckt oder geteilt werden.',
    ),
  },
  {
    id: 'books',
    screen: 'books',
    title: T('مرور سريع على الكتب', 'Quick look at Books', 'Kurzer Blick auf Bücher'),
    body: T(
      'قسم الكتب ينظم المراجع الزراعية النظرية والعملية ضمن مكتبة سهلة البحث والتصفح.',
      'The Books section organizes theoretical and practical agricultural references in a searchable library.',
      'Der Bücherbereich ordnet theoretische und praktische Agrarliteratur in einer durchsuchbaren Bibliothek.',
    ),
  },
  {
    id: 'articles',
    screen: 'articles',
    title: T('الأبحاث والمقالات', 'Research and articles', 'Forschung und Artikel'),
    body: T(
      'هنا تجد الأبحاث والمقالات الزراعية، مع تصنيفات وصور وصفحات قراءة كاملة.',
      'This section contains agricultural research and articles with categories, images and full reading pages.',
      'Hier finden Sie Agrarforschung und Fachartikel mit Kategorien, Bildern und vollständigen Leseseiten.',
    ),
  },
  {
    id: 'soil',
    screen: 'soil',
    title: T('تحليل التربة والتواصل', 'Soil analysis and contact', 'Bodenanalyse und Kontakt'),
    body: T(
      'يشرح قسم تحليل التربة الخدمة بالفيديو التوضيحي، ويتيح التواصل مع المهندس وإرسال موقع الأرض ومشاهدة تقارير العملاء.',
      'Soil Analysis explains the service, lets users contact the engineer, send the land location and view client reports.',
      'Die Bodenanalyse erklärt den Service, ermöglicht Kontakt und Standortübermittlung und zeigt Kundenberichte.',
    ),
  },
  {
    id: 'done',
    screen: 'done',
    title: T('قسم زراعة متكامل', 'A complete Agri section', 'Ein vollständiger Agrarbereich'),
    body: T(
      'من صورة نبات إلى تقرير تشخيص، ومن الموقع والطقس إلى تقرير الموسم، إضافةً إلى المعرفة والتواصل — كل ذلك داخل eng-alaa.com.',
      'From a plant photo to a diagnostic report, and from location and weather to a season report—plus knowledge and contact, all inside eng-alaa.com.',
      'Vom Pflanzenfoto zum Diagnosebericht und von Standort und Wetter zum Saisonbericht – ergänzt durch Wissen und Kontakt auf eng-alaa.com.',
    ),
  },
];

const PLANT_IMAGE = '/milk-thistle-field.jpg';
const LEAF_IMAGE = '/milk-thistle-leaf-field.jpg';

function FauxLogo({ data }: { data: AppData }) {
  const color = data.siteSettings?.logoColor || '#dceaff';
  return data.siteSettings?.logoType === 'image' && data.siteSettings.logoImg ? (
    <img className="p-logo-img" src={resolveImageSrc(data.siteSettings.logoImg)} alt="AIA" />
  ) : (
    <AlaaLogo color={color} size={25} />
  );
}

function PhoneHeader({ data, lang }: { data: AppData; lang: LangKey }) {
  return (
    <header className="p-phone-header">
      <div className="p-phone-brand">
        <FauxLogo data={data} />
        <b>{lang === 'de' ? 'Ing.' : lang === 'ar' ? 'م.' : 'Eng.'} Alaa Ahmad Almasri</b>
      </div>
      <span><i className="fa-solid fa-globe" /> {lang.toUpperCase()}</span>
    </header>
  );
}

function BottomNav({ active = 'agri', focus, lang }: { active?: string; focus?: string; lang: LangKey }) {
  const items = [
    ['home', 'fa-house', T('الرئيسية', 'Home', 'Start')],
    ['agri', 'fa-seedling', T('الزراعة', 'Agri', 'Agrar')],
    ['design', 'fa-bezier-curve', T('التصاميم', 'Design', 'Design')],
    ['dev', 'fa-code', T('البرمجة', 'Dev', 'Dev')],
    ['cv', 'fa-user', T('السيرة', 'CV', 'CV')],
  ];
  return (
    <nav className="p-bottom-nav">
      {items.map(([key, icon, label]) => (
        <button type="button" data-tour-step={key === 'agri' ? 'tap-agri' : `nav-${key}`} key={key} className={`p-nav-item ${active === key ? 'active' : ''} ${focus === `nav-${key}` ? 'p-focus' : ''}`}>
          <i className={`fa-solid ${icon}`} />
          <small>{tx(label as Copy, lang)}</small>
        </button>
      ))}
    </nav>
  );
}

function AgriTabs({ focus, selected = 'plant', lang }: { focus?: string; selected?: string; lang: LangKey }) {
  const items = [
    ['plant', 'fa-leaf', T('افحص نباتك', 'Plant', 'Pflanze')],
    ['season', 'fa-cloud-sun', T('موسمك الآن', 'Season', 'Saison')],
    ['books', 'fa-book-open', T('الكتب', 'Books', 'Bücher')],
    ['articles', 'fa-newspaper', T('المقالات', 'Articles', 'Artikel')],
    ['soil', 'fa-flask', T('التربة', 'Soil', 'Boden')],
  ];
  return (
    <div className="p-agri-tabs">
      {items.map(([key, icon, label]) => (
        <button type="button" data-tour-step={key === 'plant' ? 'plant-upload' : key === 'season' ? 'season-open' : key} key={key as string} className={`p-agri-tab ${selected === key ? 'active' : ''} ${focus === `tab-${key}` ? 'p-focus' : ''}`}>
          <i className={`fa-solid ${icon}`} />
          <span>{tx(label as Copy, lang)}</span>
        </button>
      ))}
    </div>
  );
}

function HomeScreen({ data, focus, lang }: { data: AppData; focus?: string; lang: LangKey }) {
  const socialLinks = data.siteSettings?.socialLinks?.length
    ? data.siteSettings.socialLinks
    : [
        { id: 'phone', icon: 'fa-solid fa-phone', url: '#' },
        { id: 'mail', icon: 'fa-solid fa-envelope', url: '#' },
        { id: 'linkedin', icon: 'fa-brands fa-linkedin-in', url: '#' },
        { id: 'behance', icon: 'fa-brands fa-behance', url: '#' },
      ];
  return (
    <>
      <PhoneHeader data={data} lang={lang} />
      <main className="p-phone-main p-home-screen">
        <div className="p-home-orbits" aria-hidden="true"><span /><span /><span /></div>
        <div className="p-home-eyebrow">
          <span />
          <b>{lang === 'ar' ? 'مُهندس · مُصمّم · مُطوّر' : lang === 'de' ? 'Ingenieur · Designer · Entwickler' : 'Engineer · Designer · Developer'}</b>
          <span />
        </div>
        <HeroNameDisplay
          name={pickML(data.name, lang)}
          display={data.nameDisplay}
          logo={data.nameLogo}
          logoColor={data.nameLogoColor}
          shimmer={data.nameShimmer}
          shimmerSpeed={data.nameShimmerSpeed}
          shimmerColor={data.nameShimmerColor}
          shimmerAngle={data.nameShimmerAngle}
          shimmerMotion={data.nameShimmerMotion}
          shimmerDirection={data.nameShimmerDirection}
          shimmerWidth={data.nameShimmerWidth}
          className="p-real-name"
          as="div"
        />
        <div className="p-home-divider"><i /><span /><i /></div>
        <p>{pickML(data.bio, lang) || (lang === 'ar' ? 'مهندس زراعي سوري، متخصص في البيوتكنولوجي ومصمم ومطور برمجيات.' : 'Agricultural engineer, designer and software developer.')}</p>
        <div className="p-home-socials">
          {socialLinks.slice(0, 4).map(link => <span key={link.id}><i className={link.icon} /></span>)}
        </div>
        <div className="p-portal-cards">
          <div><i className="fa-solid fa-seedling" /><b>01</b><span>{lang === 'ar' ? 'الزراعة' : lang === 'de' ? 'Agrar' : 'Agri'}</span></div>
          <div><i className="fa-solid fa-bezier-curve" /><b>02</b><span>{lang === 'ar' ? 'التصاميم' : 'Design'}</span></div>
          <div><i className="fa-solid fa-code" /><b>03</b><span>{lang === 'ar' ? 'البرمجة' : lang === 'de' ? 'Code' : 'Dev'}</span></div>
        </div>
        <i className="fa-solid fa-chevron-down p-home-down" />
      </main>
      <BottomNav active="home" focus={focus} lang={lang} />
    </>
  );
}

function AgriMenuScreen({ data, focus, lang }: { data: AppData; focus?: string; lang: LangKey }) {
  return (
    <>
      <PhoneHeader data={data} lang={lang} />
      <main className="p-phone-main">
        <h2 className="p-portal-title">{lang === 'ar' ? 'بوابة الهندسة الزراعية' : lang === 'de' ? 'Portal für Agrartechnik' : 'Agricultural Engineering Portal'}</h2>
        <AgriTabs focus={focus} selected={focus === 'tab-season' ? 'season' : 'plant'} lang={lang} />
        <section className="p-intro-card">
          <i className="fa-solid fa-seedling" />
          <h3>{lang === 'ar' ? 'خدمات زراعية ذكية' : lang === 'de' ? 'Intelligente Agrardienste' : 'Smart agricultural services'}</h3>
          <p>{lang === 'ar' ? 'التشخيص، الموسم، المعرفة وتحليل التربة.' : lang === 'de' ? 'Diagnose, Saison, Wissen und Bodenanalyse.' : 'Diagnosis, season, knowledge and soil analysis.'}</p>
        </section>
      </main>
      <BottomNav active="agri" lang={lang} />
    </>
  );
}

function UploadScreen({ data, focus, lang, withImages = false, plantImages }: { data: AppData; focus?: string; lang: LangKey; withImages?: boolean; plantImages: string[] }) {
  return (
    <>
      <PhoneHeader data={data} lang={lang} />
      <main className="p-phone-main">
        <h2 className="p-portal-title">{lang === 'ar' ? 'بوابة الهندسة الزراعية' : 'Agricultural Engineering Portal'}</h2>
        <AgriTabs selected="plant" lang={lang} />
        <section className="p-upload-card">
          <h3><i className="fa-solid fa-seedling" /> {lang === 'ar' ? 'ارفع صور النبات' : lang === 'de' ? 'Pflanzenbilder hochladen' : 'Upload plant images'}</h3>
          <div className="p-image-row">
            {withImages && (
              <>
                <img src={plantImages[0] || PLANT_IMAGE} alt="" />
                <img src={plantImages[1] || plantImages[0] || LEAF_IMAGE} alt="" />
              </>
            )}
            <button type="button" data-tour-step="camera" className={`p-add-image ${focus === 'add-image' ? 'p-focus' : ''}`}>
              <i className="fa-solid fa-plus" />
              <span>{lang === 'ar' ? 'رفع صورة' : lang === 'de' ? 'Bild hinzufügen' : 'Add image'}</span>
            </button>
          </div>
          <button type="button" data-tour-step="diagnosing" className={`p-primary ${focus === 'diagnose' ? 'p-focus' : ''}`}>
            <i className="fa-solid fa-wand-magic-sparkles" />
            {lang === 'ar' ? 'تشخيص فوري وتقرير PDF' : lang === 'de' ? 'Sofortdiagnose & PDF-Bericht' : 'Instant diagnosis & PDF report'}
          </button>
        </section>
      </main>
      <BottomNav active="agri" lang={lang} />
    </>
  );
}

function CameraScreen({ focus, lang, plantImage }: { focus?: string; lang: LangKey; plantImage: string }) {
  return (
    <div className="p-camera">
      <img src={plantImage || PLANT_IMAGE} alt="Milk thistle plant" />
      <div className="p-camera-top"><i className="fa-solid fa-xmark" /><span>PHOTO</span><i className="fa-solid fa-bolt" /></div>
      <div className="p-focus-square"><span /><span /><span /><span /></div>
      <div className="p-camera-label">{lang === 'ar' ? 'ثبّت النبات داخل الإطار' : lang === 'de' ? 'Pflanze im Rahmen halten' : 'Keep the plant in frame'}</div>
      <div className="p-camera-bottom">
        <div className="p-camera-thumb" />
        <button type="button" data-tour-step="images-ready" className={focus === 'camera-shutter' ? 'p-focus' : ''}><span /></button>
        <i className="fa-solid fa-camera-rotate" />
      </div>
    </div>
  );
}

function DiagnosingScreen({ data, lang, plantImage }: { data: AppData; lang: LangKey; plantImage: string }) {
  return (
    <>
      <PhoneHeader data={data} lang={lang} />
      <main className="p-phone-main p-analyzing">
        <div className="p-scan-image"><img src={plantImage || PLANT_IMAGE} alt="" /><span /></div>
        <div className="p-loader-ring"><i className="fa-solid fa-leaf" /></div>
        <h2>{lang === 'ar' ? 'جاري تحليل النبات…' : lang === 'de' ? 'Pflanze wird analysiert…' : 'Analyzing plant…'}</h2>
        <div className="p-analysis-list">
          <span><i className="fa-solid fa-check" /> {lang === 'ar' ? 'التعرف على النبات' : 'Plant identification'}</span>
          <span><i className="fa-solid fa-check" /> {lang === 'ar' ? 'فحص الأعراض والآفات' : 'Symptoms and pests'}</span>
          <span className="loading"><i className="fa-solid fa-spinner fa-spin" /> {lang === 'ar' ? 'إعداد التقرير' : 'Preparing report'}</span>
        </div>
      </main>
    </>
  );
}

const reportLabels = {
  identity: T('نتيجة التشخيص', 'Diagnosis Result', 'Diagnoseergebnis'),
  care: T('تعليمات العناية', 'Care Instructions', 'Pflegehinweise'),
  soil: T('التربة والعناصر الغذائية', 'Soil & Nutrients', 'Boden & Nährstoffe'),
  health: T('الفوائد والتشخيص المرضي', 'Benefits & Disease Diagnosis', 'Nutzen & Krankheitsdiagnose'),
  signature: T('اعتماد التقرير', 'Report Approval', 'Berichtsfreigabe'),
};

function PlantReportScreen({
  data,
  focus = 'overview',
  action,
  lang,
  plantImage,
}: {
  data: AppData;
  focus?: WalkStep['reportFocus'];
  action?: string;
  lang: LangKey;
  plantImage: string;
}) {
  const tpl = data.reportTemplate;
  const isFocus = (key: string) => focus === key;
  const logo = tpl?.headerLogo ? (
    <img src={resolveImageSrc(tpl.headerLogo)} alt="logo" />
  ) : <AlaaLogo color="#153c78" size={32} />;
  return (
    <div className={`p-report-viewport focus-${focus}`}>
      <article className="p-report-sheet">
        <header>
          <div className="p-report-brand">{logo}<span><b>{pickML(tpl?.engName, lang) || 'Eng. Alaa Ahmad Almasri'}</b><small>{pickML(tpl?.headerText, lang) || 'Agricultural Engineering Portal'}</small></span></div>
          <div><b>{lang === 'ar' ? 'تقرير التشخيص الزراعي' : lang === 'de' ? 'Agrardiagnosebericht' : 'Agricultural Diagnostic Report'}</b><small>14 / 08 / 2026</small></div>
        </header>
        <section className={`p-r-section p-r-identity ${isFocus('identity') ? 'is-focus' : ''}`}>
          <h3>{tx(reportLabels.identity, lang)}</h3>
          <div className="p-report-id">
            <img src={plantImage || PLANT_IMAGE} alt="" />
            <div className="p-report-qa">
              <span><b>{lang === 'ar' ? 'ما اسم النبات؟' : lang === 'de' ? 'Wie heißt die Pflanze?' : 'What is the plant?'}</b>{lang === 'ar' ? 'حليب الشوك' : lang === 'de' ? 'Mariendistel' : 'Milk Thistle'}</span>
              <span><b>{lang === 'ar' ? 'ما الاسم العلمي؟' : lang === 'de' ? 'Wissenschaftlicher Name?' : 'Scientific name?'}</b><em>Silybum marianum</em></span>
              <span><b>{lang === 'ar' ? 'ما الموطن والأصل؟' : lang === 'de' ? 'Herkunft?' : 'Origin?'}</b>{lang === 'ar' ? 'حوض البحر المتوسط وغرب آسيا' : lang === 'de' ? 'Mittelmeerraum und Westasien' : 'Mediterranean basin and Western Asia'}</span>
            </div>
          </div>
        </section>
        <section className={`p-r-section p-r-care ${isFocus('care') ? 'is-focus' : ''}`}>
          <h3>{tx(reportLabels.care, lang)}</h3>
          <div className="p-report-qa p-report-qa-grid">
            <span><b>💧 {lang === 'ar' ? 'كيف يكون الري؟' : 'How to water?'}</b>{lang === 'ar' ? 'ري معتدل بعد جفاف السطح، دون إغراق.' : 'Moderate watering after topsoil dries; avoid waterlogging.'}</span>
            <span><b>☀️ {lang === 'ar' ? 'ما الإضاءة المناسبة؟' : 'Required light?'}</b>{lang === 'ar' ? 'شمس كاملة، 6–8 ساعات يومياً.' : 'Full sun, 6–8 hours daily.'}</span>
            <span><b>🌡 {lang === 'ar' ? 'ما الحرارة المثلى؟' : 'Best temperature?'}</b>18–28°C</span>
            <span><b>🌱 {lang === 'ar' ? 'كيف يتم التسميد؟' : 'How to fertilize?'}</b>{lang === 'ar' ? 'تسميد متوازن خفيف، وتجنب زيادة الآزوت.' : 'Light balanced feeding; avoid excess nitrogen.'}</span>
          </div>
        </section>
        <section className={`p-r-section p-r-soil ${isFocus('soil') ? 'is-focus' : ''}`}>
          <h3>{tx(reportLabels.soil, lang)}</h3>
          <table><tbody><tr><th>{lang === 'ar' ? 'ما نوع التربة؟' : 'Suitable soil?'}</th><td>{lang === 'ar' ? 'طميية أو رملية جيدة الصرف' : 'Well-drained loam or sandy soil'}</td></tr><tr><th>{lang === 'ar' ? 'ما الحموضة المناسبة؟' : 'Suitable pH?'}</th><td>6.0 – 7.5</td></tr><tr><th>{lang === 'ar' ? 'هل يتحمل الجفاف؟' : 'Drought tolerant?'}</th><td>{lang === 'ar' ? 'نعم بعد تثبيت الجذور' : 'Yes, after establishment'}</td></tr></tbody></table>
        </section>
        <section className={`p-r-section p-r-nutrients ${isFocus('nutrients') ? 'is-focus' : ''}`}>
          <h3>{lang === 'ar' ? 'العناصر الغذائية ونسب التسميد' : lang === 'de' ? 'Nährstoffe und Düngung' : 'Nutrients & Fertilization'}</h3>
          <table><tbody>
            <tr><th>N · P · K</th><td>10 · 10 · 10</td></tr>
            <tr><th>{lang === 'ar' ? 'العناصر الكبرى' : 'Macronutrients'}</th><td>{lang === 'ar' ? 'آزوت متوسط، فوسفور وبوتاسيوم متوازنان' : 'Moderate N; balanced P and K'}</td></tr>
            <tr><th>{lang === 'ar' ? 'العناصر الصغرى' : 'Micronutrients'}</th><td>Fe · Zn · Mn · B</td></tr>
            <tr><th>{lang === 'ar' ? 'موعد الإضافة' : 'Application'}</th><td>{lang === 'ar' ? 'جرعة خفيفة عند النمو الخضري، ثم قبل الإزهار' : 'Light dose during vegetative growth, then pre-flowering'}</td></tr>
          </tbody></table>
        </section>
        <section className={`p-r-section p-r-schedule ${isFocus('planting') ? 'is-focus' : ''}`}>
          <h3>{lang === 'ar' ? 'مواعيد الزراعة والحصاد' : lang === 'de' ? 'Pflanz- und Erntezeiten' : 'Planting & Harvest Schedule'}</h3>
          <div className="p-report-qa p-report-qa-grid">
            <span><b>{lang === 'ar' ? 'متى تزرع البذور؟' : 'When to sow?'}</b>{lang === 'ar' ? 'الخريف أو أواخر الشتاء.' : 'Autumn or late winter.'}</span>
            <span><b>{lang === 'ar' ? 'كم يوماً حتى الحصاد؟' : 'Days to harvest?'}</b>{lang === 'ar' ? 'نحو 120–150 يوماً.' : 'About 120–150 days.'}</span>
            <span><b>{lang === 'ar' ? 'متى تحصد؟' : 'When to harvest?'}</b>{lang === 'ar' ? 'عند جفاف الرؤوس وتحولها للبني.' : 'When flower heads dry and turn brown.'}</span>
            <span><b>{lang === 'ar' ? 'ما الجزء المحصود؟' : 'Harvested part?'}</b>{lang === 'ar' ? 'البذور الناضجة.' : 'Mature seeds.'}</span>
          </div>
        </section>
        <section className={`p-r-section p-r-uses ${isFocus('uses') || isFocus('health') ? 'is-focus' : ''}`}>
          <h3>{lang === 'ar' ? 'استخدامات النبات والمواد الفعالة' : lang === 'de' ? 'Verwendung und Wirkstoffe' : 'Plant Uses & Active Compounds'}</h3>
          <div className="p-report-qa">
            <span><b>{lang === 'ar' ? 'ما الاستخدام؟' : 'Main use?'}</b>{lang === 'ar' ? 'نبات طبي وتزييني؛ تُجمع بذوره الناضجة.' : 'Medicinal and ornamental plant; mature seeds are collected.'}</span>
            <span><b>{lang === 'ar' ? 'ما المادة الفعالة؟' : 'Active compound?'}</b>{lang === 'ar' ? 'السيليمارين: خليط من السيليبين والسيليكريستين والسيليديانين.' : 'Silymarin: silybin, silychristin and silydianin complex.'}</span>
            <span><b>{lang === 'ar' ? 'ما الفوائد المعروفة؟' : 'Known benefit?'}</b>{lang === 'ar' ? 'تدخل مستخلصاته في مستحضرات داعمة لصحة الكبد؛ لا يغني ذلك عن الاستشارة الطبية.' : 'Extracts are used in liver-support preparations; this is not a substitute for medical advice.'}</span>
            <span><b>{lang === 'ar' ? 'ما أشكال المستحضرات؟' : 'Preparation forms?'}</b>{lang === 'ar' ? 'كبسولات ومستخلصات وشاي بذور.' : 'Capsules, extracts and seed tea.'}</span>
          </div>
        </section>
        <section className={`p-r-section p-r-health ${isFocus('disease') ? 'is-focus' : ''}`}>
          <h3>{tx(reportLabels.health, lang)}</h3>
          <div className="p-report-qa">
            <span><b>{lang === 'ar' ? 'هل توجد إصابة مرضية؟' : 'Disease detected?'}</b>{lang === 'ar' ? 'لا تظهر إصابة مرضية واضحة في الصورتين.' : 'No clear disease is visible in the two images.'}</span>
            <span><b>{lang === 'ar' ? 'هل توجد آفة حشرية؟' : 'Pest detected?'}</b>{lang === 'ar' ? 'لا توجد حشرات أو قضمات أو أنفاق ظاهرة.' : 'No visible insects, feeding marks or mines.'}</span>
            <span><b>{lang === 'ar' ? 'ما درجة الثقة؟' : 'Confidence?'}</b>92%</span>
            <span><b>{lang === 'ar' ? 'هل يلزم مبيد وجرعة؟' : 'Pesticide and dosage?'}</b>{lang === 'ar' ? 'لا يوصى بمبيد حالياً؛ المراقبة وإعادة التصوير عند ظهور أعراض.' : 'No pesticide is advised now; monitor and photograph again if symptoms appear.'}</span>
          </div>
          <div className="p-ok-row"><i className="fa-solid fa-circle-check" /> {lang === 'ar' ? 'حالة النبات جيدة' : lang === 'de' ? 'Guter Pflanzenzustand' : 'Plant condition is good'}</div>
        </section>
        <footer className={`p-r-section p-r-signature ${isFocus('signature') ? 'is-focus' : ''}`}>
          <div>
            {tpl?.engSignature ? <img src={resolveImageSrc(tpl.engSignature)} alt="signature" /> : <span className="p-signature-text">Alaa Almasri</span>}
            <small>{lang === 'ar' ? 'توقيع المهندس' : lang === 'de' ? 'Unterschrift' : 'Engineer signature'}</small>
          </div>
          {tpl?.engStamp ? <img className="p-stamp" src={resolveImageSrc(tpl.engStamp)} alt="stamp" /> : <div className="p-faux-stamp"><b>AIA</b><span>OFFICIAL</span></div>}
        </footer>
      </article>
      <div className="p-report-actions">
        <button><i className="fa-solid fa-print" /></button>
        <button type="button" data-tour-step="whatsapp" className={action === 'share-pdf' ? 'p-focus' : ''}><i className="fa-solid fa-share-nodes" /> PDF</button>
      </div>
    </div>
  );
}

function WhatsAppScreen({ lang }: { lang: LangKey }) {
  return (
    <div className="p-wa-screen">
      <header><i className="fa-solid fa-arrow-left" /><div className="p-wa-avatar"><AlaaLogo color="#fff" size={20} /></div><span><b>Eng. Alaa</b><small>online</small></span><i className="fa-solid fa-video" /><i className="fa-solid fa-phone" /></header>
      <main>
        <div className="p-wa-date">{lang === 'ar' ? 'اليوم' : lang === 'de' ? 'Heute' : 'Today'}</div>
        <div className="p-wa-bubble">
          <div className="p-pdf-icon"><i className="fa-solid fa-file-pdf" /></div>
          <div><b>Plant_Diagnostic_Milk_Thistle.pdf</b><small>PDF · 2.4 MB · 4 pages</small></div>
          <i className="fa-solid fa-circle-down" />
        </div>
        <div className="p-wa-message">{lang === 'ar' ? 'مرفق تقرير التشخيص الزراعي الكامل.' : lang === 'de' ? 'Anbei der vollständige Agrardiagnosebericht.' : 'Attached is the complete agricultural diagnostic report.'}<small>12:24 ✓✓</small></div>
      </main>
      <footer><i className="fa-regular fa-face-smile" /><span>{lang === 'ar' ? 'رسالة' : 'Message'}</span><i className="fa-solid fa-paperclip" /><i className="fa-solid fa-camera" /><button><i className="fa-solid fa-microphone" /></button></footer>
    </div>
  );
}

function SeasonLocationScreen({ data, focus, lang }: { data: AppData; focus?: string; lang: LangKey }) {
  return (
    <>
      <PhoneHeader data={data} lang={lang} />
      <main className="p-phone-main">
        <h2 className="p-portal-title">{lang === 'ar' ? 'بوابة الهندسة الزراعية' : 'Agricultural Engineering Portal'}</h2>
        <AgriTabs selected="season" lang={lang} />
        <section className="p-location-card">
          <div className="p-location-orbit"><i className="fa-solid fa-location-crosshairs" /></div>
          <h3>{lang === 'ar' ? 'اعرف موسمك الزراعي الآن' : lang === 'de' ? 'Ihre aktuelle Agrarsaison' : 'Know your season now'}</h3>
          <p>{lang === 'ar' ? 'حدد موقعك لمعرفة ما يزرع وما يحصد الآن.' : lang === 'de' ? 'Standort freigeben für aktuelle Pflanz- und Ernteempfehlungen.' : 'Share your location to see what to plant and harvest now.'}</p>
          <button type="button" data-tour-step="season-overview" className={`p-primary ${focus === 'location' ? 'p-focus' : ''}`}><i className="fa-solid fa-location-dot" /> {lang === 'ar' ? 'تحديد موقعي' : lang === 'de' ? 'Standort freigeben' : 'Use my location'}</button>
        </section>
      </main>
      <BottomNav active="agri" lang={lang} />
    </>
  );
}

function SeasonReportScreen({ data, focus = 'overview', lang }: { data: AppData; focus?: WalkStep['seasonFocus']; lang: LangKey }) {
  const tpl = data.reportTemplate;
  return (
    <div className={`p-season-viewport focus-${focus}`}>
      <article className="p-season-sheet">
        <header><div><AlaaLogo color="#276d34" size={30} /><span><b>Eng. Alaa Ahmad Almasri</b><small>Agricultural Engineering Portal</small></span></div><span><b>{lang === 'ar' ? 'تقرير موسمك الآن' : lang === 'de' ? 'Saisonbericht' : 'Your Season Now Report'}</b><small>14 Aug 2026</small></span></header>
        <section className={`p-season-weather ${focus === 'weather' || focus === 'overview' ? 'is-focus' : ''}`}>
          <div><small>{lang === 'ar' ? 'المنطقة' : 'Region'}</small><b>{lang === 'ar' ? 'عجمان · الإمارات' : lang === 'de' ? 'Ajman · Vereinigte Arabische Emirate' : 'Ajman · United Arab Emirates'}</b></div>
          <div><small>{lang === 'ar' ? 'الطقس' : 'Weather'}</small><b>33.4°C · 80% · 6.7 km/h</b></div>
        </section>
        <section className={`p-season-table-wrap ${focus === 'table' ? 'is-focus' : ''}`}>
          <h3>{lang === 'ar' ? 'النباتات حسب الصنف' : lang === 'de' ? 'Pflanzen nach Kategorie' : 'Plants by category'}</h3>
          <table><thead><tr><th>{lang === 'ar' ? 'الصنف' : 'Category'}</th><th>{lang === 'ar' ? 'يزرع الآن' : 'Plant now'}</th><th>{lang === 'ar' ? 'يحصد الآن' : 'Harvest now'}</th></tr></thead><tbody>
            <tr><th>{lang === 'ar' ? 'الخضار' : 'Vegetables'}</th><td>{lang === 'ar' ? 'بامية · باذنجان · فلفل' : 'Okra · Eggplant · Pepper'}</td><td>{lang === 'ar' ? 'خيار · طماطم · كوسا' : 'Cucumber · Tomato · Zucchini'}</td></tr>
            <tr><th>{lang === 'ar' ? 'الفواكه' : 'Fruits'}</th><td>{lang === 'ar' ? 'بطيخ · شمام · نخيل' : 'Watermelon · Melon · Date palm'}</td><td>{lang === 'ar' ? 'بطيخ · ليمون · نخيل' : 'Watermelon · Lemon · Date palm'}</td></tr>
            <tr><th>{lang === 'ar' ? 'محاصيل حقلية' : 'Field crops'}</th><td>{lang === 'ar' ? 'سمسم · قطن · ذرة' : 'Sesame · Cotton · Corn'}</td><td>{lang === 'ar' ? 'الذرة' : 'Corn'}</td></tr>
            <tr><th>{lang === 'ar' ? 'نباتات طبية' : 'Medicinal'}</th><td>{lang === 'ar' ? 'نعناع · ريحان · صبار' : 'Mint · Basil · Aloe'}</td><td>{lang === 'ar' ? 'نعناع · صبار' : 'Mint · Aloe'}</td></tr>
          </tbody></table>
        </section>
        <section className={`p-season-guide ${focus === 'guide' ? 'is-focus' : ''}`}>
          <h3>{lang === 'ar' ? 'إرشادات الزراعة والحصاد' : lang === 'de' ? 'Anbau- und Erntehinweise' : 'Planting & harvest guidelines'}</h3>
          <p>• {lang === 'ar' ? 'ازرع في الصباح الباكر. افحص رطوبة التربة قبل الري.' : lang === 'de' ? 'Morgens pflanzen. Bodenfeuchte vor dem Gießen prüfen.' : 'Plant in early morning. Check soil moisture before watering.'}</p>
        </section>
      </article>
      <div className="p-report-actions"><button><i className="fa-solid fa-print" /></button><button><i className="fa-solid fa-share-nodes" /> PDF</button></div>
    </div>
  );
}

function QuickSectionScreen({ data, screen, lang }: { data: AppData; screen: Screen; lang: LangKey }) {
  const cfg = {
    books: { icon: 'fa-book-open', title: T('المكتبة الزراعية', 'Agricultural Library', 'Agrarbibliothek') },
    articles: { icon: 'fa-newspaper', title: T('الأبحاث والمقالات', 'Research & Articles', 'Forschung & Artikel') },
    soil: { icon: 'fa-flask', title: T('تحليل التربة', 'Soil Analysis', 'Bodenanalyse') },
  }[screen as 'books' | 'articles' | 'soil'];
  return (
    <>
      <PhoneHeader data={data} lang={lang} />
      <main className="p-phone-main">
        <h2 className="p-portal-title">{lang === 'ar' ? 'بوابة الهندسة الزراعية' : 'Agricultural Engineering Portal'}</h2>
        <AgriTabs selected={screen} lang={lang} />
        <section className="p-quick-section">
          <h3><i className={`fa-solid ${cfg.icon}`} /> {tx(cfg.title, lang)}</h3>
          {screen === 'books' && <div className="p-book-grid"><div><i className="fa-solid fa-book" /><b>{lang === 'ar' ? 'علوم النبات' : 'Plant Science'}</b></div><div><i className="fa-solid fa-book" /><b>{lang === 'ar' ? 'التربة والمياه' : 'Soil & Water'}</b></div><div><i className="fa-solid fa-book" /><b>{lang === 'ar' ? 'التطبيقات العملية' : 'Practical Guides'}</b></div></div>}
          {screen === 'articles' && <div className="p-article-list"><article><img src={LEAF_IMAGE} alt="" /><span><b>{lang === 'ar' ? 'التكنولوجيا الحيوية النباتية' : 'Plant Biotechnology'}</b><small>8 min read</small></span></article><article><img src={PLANT_IMAGE} alt="" /><span><b>{lang === 'ar' ? 'النباتات الطبية' : 'Medicinal Plants'}</b><small>6 min read</small></span></article></div>}
          {screen === 'soil' && <div className="p-soil-demo"><div className="p-soil-video"><img src={PLANT_IMAGE} alt="" /><i className="fa-solid fa-play" /></div><h4>{lang === 'ar' ? 'اطلب تحليل التربة — تواصل مع المهندس' : 'Request Soil Analysis — Contact the Engineer'}</h4><div className="p-form-lines"><span /><span /><span /></div><button className="p-primary"><i className="fa-brands fa-whatsapp" /> WhatsApp</button></div>}
        </section>
      </main>
      <BottomNav active="agri" lang={lang} />
    </>
  );
}

function DoneScreen({ data, lang }: { data: AppData; lang: LangKey }) {
  return (
    <div className="p-done-screen">
      <AlaaLogo color="#fff" size={74} />
      <h2>{lang === 'ar' ? 'بوابة الهندسة الزراعية' : lang === 'de' ? 'Portal für Agrartechnik' : 'Agricultural Engineering Portal'}</h2>
      <p>eng-alaa.com</p>
      <div><span><i className="fa-solid fa-leaf" /> Plant</span><span><i className="fa-solid fa-cloud-sun" /> Season</span><span><i className="fa-solid fa-flask" /> Soil</span></div>
    </div>
  );
}

function PhoneContent({ step, data, lang, plantImages }: { step: WalkStep; data: AppData; lang: LangKey; plantImages: string[] }) {
  const plantImage = plantImages[0] || PLANT_IMAGE;
  switch (step.screen) {
    case 'home': return <HomeScreen data={data} lang={lang} focus={step.action} />;
    case 'agri': return <AgriMenuScreen data={data} lang={lang} focus={step.action} />;
    case 'plant-upload': return <UploadScreen data={data} lang={lang} focus={step.action} plantImages={plantImages} />;
    case 'camera': return <CameraScreen lang={lang} focus={step.action} plantImage={plantImage} />;
    case 'plant-images': return <UploadScreen data={data} lang={lang} focus={step.action} withImages plantImages={plantImages} />;
    case 'diagnosing': return <DiagnosingScreen data={data} lang={lang} plantImage={plantImage} />;
    case 'plant-report': return <PlantReportScreen data={data} lang={lang} focus={step.reportFocus} action={step.action} plantImage={plantImage} />;
    case 'whatsapp': return <WhatsAppScreen lang={lang} />;
    case 'season-location': return <SeasonLocationScreen data={data} lang={lang} focus={step.action} />;
    case 'season-report': return <SeasonReportScreen data={data} lang={lang} focus={step.seasonFocus} />;
    case 'books':
    case 'articles':
    case 'soil': return <QuickSectionScreen data={data} lang={lang} screen={step.screen} />;
    case 'done': return <DoneScreen data={data} lang={lang} />;
    default: return null;
  }
}

export default function AgriWalkthrough() {
  const [lang, setLang] = useState<LangKey>('ar');
  const [data, setData] = useState<AppData>(loadAppData);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [narration, setNarration] = useState(false);
  const [pressing, setPressing] = useState(false);
  const spokenRef = useRef('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const settings: AgriWalkthroughSettings = data.agriWalkthrough || {};
  const steps = useMemo(() => {
    const overrides = new Map((settings.steps || []).map(value => [value.id, value]));
    return WALKTHROUGH_STEPS.map(base => {
      const override = overrides.get(base.id);
      return {
        ...base,
        title: override?.title
          ? {
              ar: override.title.ar || base.title.ar,
              en: override.title.en || base.title.en,
              de: override.title.de || base.title.de,
            }
          : base.title,
        body: override?.body
          ? {
              ar: override.body.ar || base.body.ar,
              en: override.body.en || base.body.en,
              de: override.body.de || base.body.de,
            }
          : base.body,
        enabled: override?.enabled !== false,
        durationMs: override?.durationMs || 5200,
        audio: override?.audio || {},
      };
    }).filter(value => value.enabled);
  }, [settings.steps]);
  const step = steps[Math.min(index, Math.max(0, steps.length - 1))] || WALKTHROUGH_STEPS[0]!;
  const configuredImages = settings.plantImages?.filter(Boolean) || [];
  const hasLegacyDemoImages = configuredImages.some(image => image.includes('images.unsplash.com/photo-1515150144380') || image.includes('images.unsplash.com/photo-1530595467537'));
  const plantImages = configuredImages.length && !hasLegacyDemoImages
    ? configuredImages
    : [PLANT_IMAGE, LEAF_IMAGE];

  useEffect(() => {
    let alive = true;
    void loadAppDataFromDb().then(remote => {
      if (alive && remote) {
        setData(remote);
        setSpeed(remote.agriWalkthrough?.defaultSpeed || 1);
        if (remote.agriWalkthrough?.autoplay) setPlaying(true);
      }
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.pTour = 'true';
    return () => { delete document.documentElement.dataset.pTour; };
  }, []);

  useEffect(() => {
    if (index >= steps.length) setIndex(Math.max(0, steps.length - 1));
  }, [index, steps.length]);

  useEffect(() => {
    if (!playing) return;
    if (index >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => setIndex(i => Math.min(steps.length - 1, i + 1)),
      (step.durationMs || 5200) / speed,
    );
    return () => window.clearTimeout(timer);
  }, [playing, index, speed, step.durationMs, steps.length]);

  useEffect(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (!narration) return;
    const key = `${lang}-${step.id}`;
    if (spokenRef.current === key) return;
    spokenRef.current = key;
    const recordedAudio = step.audio?.[lang];
    if (recordedAudio) {
      const audio = new Audio(resolveImageSrc(recordedAudio));
      audio.playbackRate = speed;
      audioRef.current = audio;
      void audio.play().catch(() => undefined);
      return () => {
        audio.pause();
        audioRef.current = null;
      };
    }
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(`${tx(step.title, lang)}. ${tx(step.body, lang)}`);
    utterance.lang = lang === 'ar' ? 'ar-AE' : lang === 'de' ? 'de-DE' : 'en-US';
    utterance.rate = Math.min(1.25, 0.92 * speed);
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [step, lang, narration, speed]);

  const groups = useMemo(() => [
    { label: T('البداية والشريط السفلي', 'Start & bottom bar', 'Start & untere Leiste'), ids: ['home', 'nav-home', 'tap-agri', 'nav-design', 'nav-dev', 'nav-cv', 'agri-menu'] },
    { label: T('فحص النبات', 'Plant Check', 'Pflanzencheck'), ids: steps.filter(s => s.id.startsWith('plant') || s.id.startsWith('report') || ['camera', 'images-ready', 'diagnosing', 'whatsapp'].includes(s.id)).map(s => s.id) },
    { label: T('موسمك الآن', 'Your Season', 'Ihre Saison'), ids: steps.filter(s => s.id.startsWith('season')).map(s => s.id) },
    { label: T('المعرفة والتربة', 'Knowledge & Soil', 'Wissen & Boden'), ids: ['books', 'articles', 'soil', 'done'] },
  ], [steps]);

  const go = (next: number) => {
    setIndex(Math.max(0, Math.min(steps.length - 1, next)));
  };

  const toggleNarration = () => {
    setNarration(v => {
      if (v && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      audioRef.current?.pause();
      audioRef.current = null;
      spokenRef.current = '';
      return !v;
    });
  };

  return (
    <div className="p-tour" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="p-tour-nav">
        <a href="/" className="p-tour-brand">
          <FauxLogo data={data} />
          <span><b>Eng. Alaa Ahmad Almasri</b><small>eng-alaa.com</small></span>
        </a>
        <div className="p-tour-langs" aria-label={tx(UI.chooseLang, lang)}>
          {(['ar', 'en', 'de'] as LangKey[]).map(code => (
            <button key={code} className={lang === code ? 'active' : ''} onClick={() => { setLang(code); spokenRef.current = ''; }}>
              {code === 'ar' ? 'العربية' : code === 'en' ? 'English' : 'Deutsch'}
            </button>
          ))}
        </div>
        <a className="p-back-link" href="/"><i className="fa-solid fa-arrow-up-right-from-square" /> {tx(UI.back, lang)}</a>
      </header>

      <main className="p-tour-layout">
        <section className="p-tour-copy">
          <span className="p-tour-kicker"><i className="fa-solid fa-seedling" /> ENG-ALAA · AGRI</span>
          <h1>{tx(UI.pageTitle, lang)}</h1>
          <p className="p-tour-lead">{tx(UI.pageLead, lang)}</p>

          <div className="p-step-counter">
            <span>{tx(UI.step, lang)} {index + 1} {tx(UI.of, lang)} {steps.length}</span>
            <div><i style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
          </div>

          <article className="p-explain-card" key={`${lang}-${step.id}`}>
            <span className="p-explain-num">{String(index + 1).padStart(2, '0')}</span>
            <div><h2>{tx(step.title, lang)}</h2><p>{tx(step.body, lang)}</p></div>
          </article>

          <div className="p-tour-controls">
            <button onClick={() => go(index - 1)} disabled={index === 0} title={tx(UI.previous, lang)}><i className="fa-solid fa-backward-step" /></button>
            <button className="primary" onClick={() => {
              if (index === steps.length - 1) {
                go(0);
                setPlaying(true);
              } else setPlaying(v => !v);
            }}>
              <i className={`fa-solid ${index === steps.length - 1 ? 'fa-rotate-right' : playing ? 'fa-pause' : 'fa-play'}`} />
              {tx(index === steps.length - 1 ? UI.replay : playing ? UI.pause : UI.play, lang)}
            </button>
            <button onClick={() => go(index + 1)} disabled={index === steps.length - 1} title={tx(UI.next, lang)}><i className="fa-solid fa-forward-step" /></button>
          </div>

          <div className="p-tour-options">
            <label><span><i className="fa-solid fa-gauge-high" /> {tx(UI.speed, lang)}</span>
              <select value={speed} onChange={e => setSpeed(Number(e.target.value))}>
                <option value={0.65}>0.65×</option>
                <option value={1}>1×</option>
                <option value={1.5}>1.5×</option>
                <option value={2}>2×</option>
              </select>
            </label>
            <button className={narration ? 'active' : ''} onClick={toggleNarration}><i className={`fa-solid ${narration ? 'fa-volume-high' : 'fa-volume-xmark'}`} /> {tx(UI.narration, lang)}</button>
          </div>
          {narration && <small className="p-voice-hint">{tx(UI.voiceHint, lang)}</small>}
        </section>

        <section className="p-phone-stage" aria-live="polite">
          <div className="p-phone-glow" />
          <div className="p-phone-shell">
            <div className="p-phone-side p-phone-side--left" />
            <div className="p-phone-side p-phone-side--right" />
            <div className="p-phone-notch"><span /><i /></div>
            <div
              className={`p-phone-screen ${step.action ? 'has-focus' : ''} ${pressing ? 'is-pressing' : ''}`}
              key={step.screen + step.id}
              onClick={event => {
                const target = (event.target as HTMLElement).closest<HTMLElement>('[data-tour-step]');
                const id = target?.dataset.tourStep;
                if (!id) return;
                const next = steps.findIndex(value => value.id === id);
                if (next >= 0) {
                  setPlaying(false);
                  setPressing(true);
                  window.setTimeout(() => {
                    go(next);
                    setPressing(false);
                  }, 320);
                }
              }}
            >
              <PhoneContent step={step} data={data} lang={lang} plantImages={plantImages} />
            </div>
          </div>
          <div className="p-phone-shadow" />
        </section>

        <aside className="p-tour-timeline">
          <h2>{tx(UI.steps, lang)}</h2>
          {groups.map(group => (
            <div className="p-step-group" key={group.ids[0]}>
              <h3>{tx(group.label, lang)}</h3>
              {group.ids.map(id => {
                const i = steps.findIndex(s => s.id === id);
                if (i < 0) return null;
                return (
                  <button key={id} className={`${i === index ? 'active' : ''} ${i < index ? 'done' : ''}`} onClick={() => go(i)}>
                    <span>{i < index ? <i className="fa-solid fa-check" /> : i + 1}</span>
                    <b>{tx(steps[i]!.title, lang)}</b>
                  </button>
                );
              })}
            </div>
          ))}
        </aside>
      </main>
    </div>
  );
}
