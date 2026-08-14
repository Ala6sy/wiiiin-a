/** روابط مباشرة لكل قسم ومشروع ومقال — SPA على Hostinger */

export type SitePortal =
  | 'home'
  | 'about'
  | 'agri'
  | 'graphics'
  | 'software'
  | 'cv'
  | 'admin';

export const AGRI_TAB_KEYS = ['diag', 'season', 'books', 'articles', 'soilreq'] as const;
export type AgriTabKey = (typeof AGRI_TAB_KEYS)[number];

export interface NavSnapshot {
  portal?: SitePortal;
  agriTab?: number;
  /** مفتاح ثابت للتبويب — لا يتأثر بترتيب التبويبات */
  agriTabKey?: AgriTabKey | string;
  gfxTab?: number;
  softSubTab?: 'projects' | 'labs';
  gfxSelCatId?: string;
  gfxSelSubId?: string;
  activeCat?: string | null;
  gfxProjectId?: string | null;
  articleId?: string | null;
  webProjectId?: string | null;
  scrollY?: number;
}

const NAV_KEY = 'siteNav_v1';

function enc(id: string): string {
  return encodeURIComponent(id);
}

function dec(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

export function agriTabsForSite(diagEnabled: boolean): AgriTabKey[] {
  return [
    ...(diagEnabled ? (['diag'] as AgriTabKey[]) : []),
    'season',
    'books',
    'articles',
    'soilreq',
  ];
}

export function agriTabKeyToIndex(
  key: string | undefined,
  diagEnabled: boolean,
): number {
  const tabs = agriTabsForSite(diagEnabled);
  if (!key) return 0;
  const idx = tabs.indexOf(key as AgriTabKey);
  return idx >= 0 ? idx : 0;
}

export function agriTabIndexToKey(
  index: number | undefined,
  diagEnabled: boolean,
): AgriTabKey | undefined {
  const tabs = agriTabsForSite(diagEnabled);
  if (index == null || index < 0 || index >= tabs.length) return undefined;
  return tabs[index];
}

/** تحويل حالة التصفح الحالية إلى مسار URL */
export function navToPath(nav: NavSnapshot): string {
  const portal = nav.portal || 'home';

  if (portal === 'home') return '/';
  if (portal === 'about') return '/about';
  if (portal === 'cv') return '/cv';
  if (portal === 'admin') return '/admin';

  if (portal === 'agri') {
    if (nav.articleId) return `/agri/article/${enc(nav.articleId)}`;
    if (nav.agriTabKey) return `/agri/${nav.agriTabKey}`;
    return '/agri';
  }

  if (portal === 'graphics') {
    if (nav.gfxProjectId) return `/designs/${enc(nav.gfxProjectId)}`;
    return '/designs';
  }

  if (portal === 'software') {
    if (nav.webProjectId) return `/software/${enc(nav.webProjectId)}`;
    if (nav.softSubTab === 'labs') return '/software/labs';
    return '/software';
  }

  return '/';
}

/** قراءة المسار وتحويله إلى حالة تصفح */
export function pathToNav(pathname: string): Partial<NavSnapshot> | null {
  const clean = (pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  const parts = clean.split('/').filter(Boolean);

  if (clean === '/') return { portal: 'home' };
  if (parts[0] === 'about') return { portal: 'about' };
  if (parts[0] === 'cv') return { portal: 'cv' };
  if (parts[0] === 'admin') return { portal: 'admin' };

  if (parts[0] === 'designs' || parts[0] === 'design' || parts[0] === 'graphics') {
    if (parts[1]) return { portal: 'graphics', gfxProjectId: dec(parts[1]) };
    return { portal: 'graphics' };
  }

  if (parts[0] === 'agri') {
    if (parts[1] === 'article' && parts[2]) {
      return {
        portal: 'agri',
        agriTabKey: 'articles',
        articleId: dec(parts[2]),
      };
    }
    if (parts[1] && (AGRI_TAB_KEYS as readonly string[]).includes(parts[1])) {
      return { portal: 'agri', agriTabKey: parts[1] };
    }
    return { portal: 'agri' };
  }

  // اختصار: /article/id
  if (parts[0] === 'article' && parts[1]) {
    return {
      portal: 'agri',
      agriTabKey: 'articles',
      articleId: dec(parts[1]),
    };
  }

  if (parts[0] === 'software' || parts[0] === 'dev') {
    if (parts[1] === 'labs') return { portal: 'software', softSubTab: 'labs' };
    if (parts[1]) return { portal: 'software', webProjectId: dec(parts[1]) };
    return { portal: 'software', softSubTab: 'projects' };
  }

  return null;
}

export function readNavFromBrowser(): NavSnapshot | null {
  let fromPath: Partial<NavSnapshot> | null = null;
  try {
    fromPath = pathToNav(window.location.pathname);
  } catch {
    fromPath = null;
  }

  let fromSession: NavSnapshot | null = null;
  try {
    fromSession = JSON.parse(sessionStorage.getItem(NAV_KEY) || 'null');
  } catch {
    fromSession = null;
  }

  let fromHistory: NavSnapshot | null = null;
  try {
    const h = typeof history !== 'undefined' ? (history.state as { __nav?: NavSnapshot } | null) : null;
    if (h?.__nav) fromHistory = h.__nav;
  } catch {
    fromHistory = null;
  }

  if (fromPath && Object.keys(fromPath).length > 0) {
    return { ...fromSession, ...fromHistory, ...fromPath };
  }
  return fromHistory || fromSession;
}

export function writeNavToBrowser(nav: NavSnapshot, push: boolean): void {
  try {
    sessionStorage.setItem(NAV_KEY, JSON.stringify(nav));
  } catch {
    /* ignore */
  }
  try {
    const path = navToPath(nav);
    const st = { ...(history.state || {}), __nav: nav };
    if (push) history.pushState(st, '', path);
    else history.replaceState(st, '', path);
  } catch {
    /* ignore */
  }
}

/** رابط كامل للمشاركة */
export function buildShareUrl(nav: NavSnapshot): string {
  const path = navToPath(nav);
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
}
